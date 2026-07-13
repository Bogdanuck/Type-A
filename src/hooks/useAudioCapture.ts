import { useCallback, useRef, useState } from 'react';
import type { AppSettings, AudioInputDevice, AudioSource, SttChunkPayload } from '../../electron/preload';

interface SourceRuntime {
  context: AudioContext;
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  silentGainNode: GainNode;
  segmentId: string;
  sequence: number;
  sampleChunks: Float32Array[];
  sampleCount: number;
  segmentStartedAt: number;
}

interface SourceStartResult {
  source: AudioSource;
  ok: boolean;
  error?: string;
}

export interface CaptureState {
  status: 'idle' | 'starting' | 'recording' | 'error';
  devices: AudioInputDevice[];
  error: string;
}

const targetSampleRate = 16000;
const minChunkSeconds = 0.25;
const audioDrainMs = 80;
const sttStartTimeoutMs = 30_000;
const audioSourceTimeoutMs = 10_000;

function createSegmentId(source: AudioSource): string {
  const randomId = window.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);
  return `${source}-${Date.now()}-${randomId}`;
}

function downsample(samples: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === targetSampleRate) {
    return samples;
  }
  const ratio = sourceRate / targetSampleRate;
  const length = Math.floor(samples.length / ratio);
  const output = new Float32Array(length);

  if (ratio < 1) {
    for (let index = 0; index < length; index += 1) {
      const position = index * ratio;
      const left = Math.floor(position);
      const right = Math.min(samples.length - 1, left + 1);
      const fraction = position - left;
      output[index] = (samples[left] ?? 0) * (1 - fraction) + (samples[right] ?? 0) * fraction;
    }
    return output;
  }

  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((index + 1) * ratio)));
    let sum = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += samples[sourceIndex] ?? 0;
    }
    output[index] = sum / (end - start);
  }
  return output;
}

function rms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

function readableError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Audio permission was denied';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function startSystemStream(): Promise<MediaStream> {
  void window.typeA.startSystemLoopback().catch(() => undefined);
  const constraints = {
    video: true,
    audio: {
      suppressLocalAudioPlayback: false,
    },
    systemAudio: 'include',
  } as DisplayMediaStreamOptions;
  const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
  stream.getVideoTracks().forEach((track) => track.stop());
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    throw new Error('System audio track was not provided');
  }
  return new MediaStream(audioTracks);
}

async function startMicrophoneStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    video: false,
  });
}

function createChunk(source: AudioSource, runtime: SourceRuntime, final: boolean): SttChunkPayload | null {
  if (runtime.sampleCount < targetSampleRate * minChunkSeconds) {
    return null;
  }
  const samples = new Float32Array(runtime.sampleCount);
  let offset = 0;
  for (const chunk of runtime.sampleChunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  if (final) {
    runtime.sampleChunks = [];
    runtime.sampleCount = 0;
  }
  return {
    source,
    samples,
    sampleRate: targetSampleRate,
    segmentId: runtime.segmentId,
    sequence: runtime.sequence,
    final,
    startedAt: runtime.segmentStartedAt,
    endedAt: Date.now(),
  };
}

export function useAudioCapture(
  onChunk: (chunk: SttChunkPayload) => void | Promise<void>,
  onLevel: (level: number) => void,
): CaptureState & {
  refreshDevices: () => Promise<void>;
  startCapture: (settings: AppSettings) => Promise<void>;
  stopCapture: () => Promise<void>;
} {
  const [status, setStatus] = useState<CaptureState['status']>('idle');
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [error, setError] = useState('');
  const runtimes = useRef<Map<AudioSource, SourceRuntime>>(new Map());
  const pendingChunkSends = useRef<Set<Promise<void>>>(new Set());
  const runId = useRef(0);

  const refreshDevices = useCallback(async () => {
    const nextDevices = await window.typeA.listInputDevices();
    setDevices(nextDevices);
  }, []);

  const emitChunk = useCallback((chunk: SttChunkPayload): Promise<void> => {
    const send = Promise.resolve()
      .then(() => onChunk(chunk))
      .catch((nextError) => {
        setError(readableError(nextError));
        setStatus('error');
      })
      .then(() => undefined);

    pendingChunkSends.current.add(send);
    void send.finally(() => {
      pendingChunkSends.current.delete(send);
    });

    return send;
  }, [onChunk]);

  const waitForPendingChunkSends = useCallback(async () => {
    while (pendingChunkSends.current.size > 0) {
      await Promise.allSettled(Array.from(pendingChunkSends.current));
    }
  }, []);

  const stopRuntime = useCallback(async (source: AudioSource, runtime: SourceRuntime) => {
    await new Promise<void>((resolve) => setTimeout(resolve, audioDrainMs));
    const finalChunk = createChunk(source, runtime, true);
    if (finalChunk) {
      await emitChunk(finalChunk);
    }
    runtime.workletNode.port.onmessage = null;
    runtime.workletNode.disconnect();
    runtime.silentGainNode.disconnect();
    runtime.sourceNode.disconnect();
    stopMediaStream(runtime.stream);
    await runtime.context.close();
  }, [emitChunk]);

  const cleanupRuntimes = useCallback(async () => {
    const activeRuntimes = Array.from(runtimes.current.entries());
    await Promise.all(activeRuntimes.map(([source, runtime]) => stopRuntime(source, runtime)));
    runtimes.current.clear();
    await waitForPendingChunkSends();
    await window.typeA.stopSystemLoopback();
    onLevel(0);
  }, [onLevel, stopRuntime, waitForPendingChunkSends]);

  const stopCapture = useCallback(async () => {
    runId.current += 1;
    await cleanupRuntimes();
    setStatus('idle');
  }, [cleanupRuntimes]);

  const attachStream = useCallback(async (source: AudioSource, stream: MediaStream) => {
    const context = new AudioContext();
    await context.resume();
    await context.audioWorklet.addModule(new URL('/audio-worklet.js', window.location.href).toString());
    const sourceNode = context.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(context, 'type-a-pcm-processor');
    const silentGainNode = context.createGain();
    silentGainNode.gain.value = 0;
    const runtime: SourceRuntime = {
      context,
      stream,
      sourceNode,
      workletNode,
      silentGainNode,
      segmentId: createSegmentId(source),
      sequence: 0,
      sampleChunks: [],
      sampleCount: 0,
      segmentStartedAt: Date.now(),
    };

    workletNode.port.onmessage = (event: MessageEvent<{ sampleRate: number; samples: Float32Array }>) => {
      const samples = event.data.samples;
      const level = rms(samples);
      const downsampled = downsample(samples, event.data.sampleRate);
      const normalizedLevel = Math.min(1, level / (source === 'microphone' ? 0.18 : 0.08));
      onLevel(normalizedLevel);
      runtime.sampleChunks.push(downsampled);
      runtime.sampleCount += downsampled.length;
    };

    sourceNode.connect(workletNode);
    workletNode.connect(silentGainNode);
    silentGainNode.connect(context.destination);
    runtimes.current.set(source, runtime);
  }, [onLevel]);

  const startCapture = useCallback(async (settings: AppSettings) => {
    if (status === 'starting' || status === 'recording') {
      return;
    }
    if (!settings.systemEnabled && !settings.microphoneEnabled) {
      setError('Enable system audio or microphone first');
      setStatus('error');
      return;
    }

    const currentRunId = runId.current + 1;
    runId.current = currentRunId;
    setStatus('starting');
    setError('');

    const startSource = async (source: AudioSource, starter: () => Promise<MediaStream>): Promise<SourceStartResult> => {
      let stream: MediaStream | null = null;
      try {
        stream = await withTimeout(starter(), audioSourceTimeoutMs, `${source} audio did not start in time`);
        if (runId.current !== currentRunId) {
          stopMediaStream(stream);
          return { source, ok: false, error: 'Start was cancelled' };
        }
        await attachStream(source, stream);
        return { source, ok: true };
      } catch (nextError) {
        if (stream) {
          stopMediaStream(stream);
        }
        return { source, ok: false, error: readableError(nextError) };
      }
    };

    const startMicrophoneSource = async (): Promise<SourceStartResult> => {
      const result = await startSource('microphone', () => startMicrophoneStream(settings.microphoneDeviceId));
      if (result.ok || !settings.microphoneDeviceId) {
        return result;
      }
      const fallback = await startSource('microphone', () => startMicrophoneStream(''));
      return fallback.ok
        ? fallback
        : { source: 'microphone', ok: false, error: `${result.error}; ${fallback.error}` };
    };

    const sourcePromises: Array<Promise<SourceStartResult>> = [
      ...(settings.systemEnabled ? [startSource('system', startSystemStream)] : []),
      ...(settings.microphoneEnabled ? [startMicrophoneSource()] : []),
    ];

    try {
      const [results] = await Promise.all([
        Promise.all(sourcePromises),
        withTimeout(window.typeA.startStt(), sttStartTimeoutMs, 'Speech model did not start in time'),
      ]);
      if (runId.current !== currentRunId) {
        return;
      }
      const failures = results
        .filter((result) => !result.ok && result.error)
        .map((result) => result.error as string);
      if (runtimes.current.size === 0) {
        throw new Error(failures.join('; ') || 'No audio stream is enabled');
      }
      if (failures.length > 0) {
        setError(failures.join('; '));
      }
      setStatus('recording');
    } catch (nextError) {
      if (runId.current !== currentRunId) {
        return;
      }
      runId.current += 1;
      setError(readableError(nextError));
      await cleanupRuntimes();
      await window.typeA.stopStt();
      setStatus('error');
    }
  }, [attachStream, cleanupRuntimes, status]);

  return {
    status,
    devices,
    error,
    refreshDevices,
    startCapture,
    stopCapture,
  };
}
