import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  session,
  shell,
  type Display,
  type Rectangle,
} from 'electron';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type {
  AppCommand,
  AppSettings,
  HistoryRetentionHours,
  HistoryRecord,
  HotkeyRegistrationPayload,
  HotkeyStatus,
  IdleUnloadMinutes,
  ModelCatalogItem,
  ModelProgressEvent,
  ModelStatus,
  SttChunkPayload,
  SttEvent,
} from './preload';
import {
  checkForUpdates,
  getUpdateStatus,
  initializeUpdater,
  installDownloadedUpdate,
  shutdownUpdater,
} from './updater';

const require = createRequire(import.meta.url);
const isDev = !app.isPackaged;
const defaultModelId = 'parakeet-tdt-0.6b-v3-int8';

interface SherpaOfflineStream {
  acceptWaveform(payload: { sampleRate: number; samples: Float32Array }): void;
}

interface SherpaOfflineRecognizer {
  createStream(): SherpaOfflineStream;
  decode(stream: SherpaOfflineStream): void;
  decodeAsync?: (stream: SherpaOfflineStream) => Promise<void>;
  getResult(stream: SherpaOfflineStream): { text?: string };
}

interface SherpaModule {
  OfflineRecognizer: {
    new(config: Record<string, unknown>): SherpaOfflineRecognizer;
    createAsync?: (config: Record<string, unknown>) => Promise<SherpaOfflineRecognizer>;
  };
}

type ModelEngine = 'transducer' | 'nemoCtc' | 'whisper';
type DownloadSource =
  | { kind: 'archive'; archiveName: string; url: string }
  | { kind: 'hf-files'; repo: string; files: string[] };

interface InternalModel extends ModelCatalogItem {
  engine: ModelEngine;
  installDirName: string;
  requiredFiles: string[];
  download: DownloadSource;
  whisperLanguage?: string;
}

const modelCatalog: InternalModel[] = [
  {
    id: defaultModelId,
    title: 'Parakeet TDT 0.6B v3 INT8',
    description: 'Universal RU/EN model already used by ASSIST. Good default balance of quality and speed.',
    languages: ['ru', 'en'],
    approxSizeMb: 1200,
    license: 'CC BY 4.0',
    source: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
    engine: 'transducer',
    installDirName: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
    requiredFiles: ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'],
    download: {
      kind: 'archive',
      archiveName: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2',
    },
  },
  {
    id: 'gigaam-v3-ctc-punct-ru',
    title: 'GigaAM-v3 CTC Punct RU',
    description: 'Russian fast mode with punctuation and normalization.',
    languages: ['ru'],
    approxSizeMb: 225,
    license: 'MIT',
    source: 'csukuangfj/sherpa-onnx-nemo-ctc-punct-giga-am-v3-russian-2025-12-16',
    engine: 'nemoCtc',
    installDirName: 'sherpa-onnx-nemo-ctc-punct-giga-am-v3-russian-2025-12-16',
    requiredFiles: ['model.int8.onnx', 'tokens.txt'],
    download: {
      kind: 'hf-files',
      repo: 'csukuangfj/sherpa-onnx-nemo-ctc-punct-giga-am-v3-russian-2025-12-16',
      files: ['model.int8.onnx', 'tokens.txt', 'LICENSE', 'README.md'],
    },
  },
  {
    id: 'gigaam-v3-rnnt-ru',
    title: 'GigaAM-v3 RNNT RU',
    description: 'Russian accurate transducer mode for higher quality speech recognition.',
    languages: ['ru'],
    approxSizeMb: 230,
    license: 'MIT',
    source: 'csukuangfj/sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16',
    engine: 'transducer',
    installDirName: 'sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16',
    requiredFiles: ['encoder.int8.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    download: {
      kind: 'hf-files',
      repo: 'csukuangfj/sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16',
      files: ['encoder.int8.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt', 'LICENSE', 'README.md'],
    },
  },
  {
    id: 'whisper-turbo',
    title: 'Whisper Turbo INT8',
    description: 'RU/EN accurate fallback for noisy speech and mixed-language sessions.',
    languages: ['ru', 'en'],
    approxSizeMb: 1040,
    license: 'MIT',
    source: 'csukuangfj/sherpa-onnx-whisper-turbo',
    engine: 'whisper',
    installDirName: 'sherpa-onnx-whisper-turbo',
    requiredFiles: ['turbo-encoder.int8.onnx', 'turbo-decoder.int8.onnx', 'turbo-tokens.txt'],
    download: {
      kind: 'hf-files',
      repo: 'csukuangfj/sherpa-onnx-whisper-turbo',
      files: ['turbo-encoder.int8.onnx', 'turbo-decoder.int8.onnx', 'turbo-tokens.txt'],
    },
  },
  {
    id: 'whisper-small',
    title: 'Whisper Small INT8',
    description: 'Smaller RU/EN fallback for machines where Turbo is too heavy.',
    languages: ['ru', 'en'],
    approxSizeMb: 375,
    license: 'MIT',
    source: 'csukuangfj/sherpa-onnx-whisper-small',
    engine: 'whisper',
    installDirName: 'sherpa-onnx-whisper-small',
    requiredFiles: ['small-encoder.int8.onnx', 'small-decoder.int8.onnx', 'small-tokens.txt'],
    download: {
      kind: 'hf-files',
      repo: 'csukuangfj/sherpa-onnx-whisper-small',
      files: ['small-encoder.int8.onnx', 'small-decoder.int8.onnx', 'small-tokens.txt'],
    },
  },
  {
    id: 'whisper-small-en',
    title: 'Whisper Small.en INT8',
    description: 'English-only fast Whisper mode.',
    languages: ['en'],
    approxSizeMb: 375,
    license: 'MIT',
    source: 'csukuangfj/sherpa-onnx-whisper-small.en',
    engine: 'whisper',
    installDirName: 'sherpa-onnx-whisper-small.en',
    requiredFiles: ['small.en-encoder.int8.onnx', 'small.en-decoder.int8.onnx', 'small.en-tokens.txt'],
    whisperLanguage: 'en',
    download: {
      kind: 'hf-files',
      repo: 'csukuangfj/sherpa-onnx-whisper-small.en',
      files: ['small.en-encoder.int8.onnx', 'small.en-decoder.int8.onnx', 'small.en-tokens.txt'],
    },
  },
  {
    id: 'whisper-base-en',
    title: 'Whisper Base.en INT8',
    description: 'Compact English-only mode for lower resource use.',
    languages: ['en'],
    approxSizeMb: 161,
    license: 'MIT',
    source: 'csukuangfj/sherpa-onnx-whisper-base.en',
    engine: 'whisper',
    installDirName: 'sherpa-onnx-whisper-base.en',
    requiredFiles: ['base.en-encoder.int8.onnx', 'base.en-decoder.int8.onnx', 'base.en-tokens.txt'],
    whisperLanguage: 'en',
    download: {
      kind: 'hf-files',
      repo: 'csukuangfj/sherpa-onnx-whisper-base.en',
      files: ['base.en-encoder.int8.onnx', 'base.en-decoder.int8.onnx', 'base.en-tokens.txt'],
    },
  },
];

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayPlacementLookup: Promise<void> | null = null;
let tray: Tray | null = null;
let lastTrayState: TrayStateSnapshot | null = null;
let activeRecognizer: SherpaOfflineRecognizer | null = null;
let activeRecognizerModelId = '';
let sttQueue = Promise.resolve();
let sttActive = false;
let modelDownloadController: AbortController | null = null;
let modelDownloadModelId = '';
let modelExtractProcess: ChildProcessWithoutNullStreams | null = null;
let idleUnloadTimer: NodeJS.Timeout | null = null;
let registeredHotkey = '';
let holdHook: HoldHookHandle | null = null;
let holdDown = false;
let hotkeyRegistrationQueue: Promise<void> = Promise.resolve();
let isQuitting = false;

interface TrayStateSnapshot {
  isRecording: boolean;
  settings: AppSettings;
  modelStatus: ModelStatus;
}

interface HoldHookHandle {
  stop: () => void;
  ready?: Promise<void>;
}

const defaultSettings: AppSettings = {
  systemEnabled: true,
  microphoneEnabled: true,
  microphoneDeviceId: '',
  activeModelId: defaultModelId,
  hotkey: 'CommandOrControl+Shift+Space',
  activationMode: 'toggle',
  autoType: true,
  autoCopy: false,
  idleUnloadMinutes: 5,
  historyRetentionHours: 72,
  launchToTray: false,
  theme: 'dark',
  language: 'auto',
};

const supportedLanguageModes = new Set([
  'auto',
  'ru',
  'en',
  'es',
  'sr',
  'he',
  'be',
  'uk',
  'kk',
  'ky',
  'uz',
  'tg',
  'hy',
  'az',
  'ro',
  'tk',
]);

function userDataPath(...parts: string[]): string {
  return join(app.getPath('userData'), ...parts);
}

function assetPath(...parts: string[]): string {
  return join(app.getAppPath(), ...parts);
}

function settingsPath(): string {
  return userDataPath('settings.json');
}

function historyPath(): string {
  return userDataPath('history.jsonl');
}

function modelConfigPath(): string {
  return userDataPath('model-config.json');
}

function modelsRoot(): string {
  return userDataPath('models');
}

function modelDownloadRoot(): string {
  return join(modelsRoot(), '_downloads');
}

function getModel(modelId: string): InternalModel {
  return modelCatalog.find((model) => model.id === modelId) ?? modelCatalog[0];
}

function modelDir(modelId = readActiveModelId()): string {
  return join(modelsRoot(), getModel(modelId).installDirName);
}

function safeReadJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function readActiveModelId(): string {
  const parsed = safeReadJson<Partial<{ activeModelId: string }>>(modelConfigPath(), {});
  return parsed.activeModelId && modelCatalog.some((model) => model.id === parsed.activeModelId)
    ? parsed.activeModelId
    : readSettings().activeModelId;
}

function writeActiveModelId(modelId: string): void {
  mkdirSync(dirname(modelConfigPath()), { recursive: true });
  writeFileSync(modelConfigPath(), JSON.stringify({ activeModelId: modelId }, null, 2));
}

function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  const idle = [0, 1, 5, 15, 30].includes(Number(value.idleUnloadMinutes))
    ? Number(value.idleUnloadMinutes) as IdleUnloadMinutes
    : defaultSettings.idleUnloadMinutes;
  const historyRetention = [0, 1, 6, 24, 72, 168, 240, 720].includes(Number(value.historyRetentionHours))
    ? Number(value.historyRetentionHours) as HistoryRetentionHours
    : defaultSettings.historyRetentionHours;
  const activeModelId = value.activeModelId && modelCatalog.some((model) => model.id === value.activeModelId)
    ? value.activeModelId
    : defaultModelId;
  return {
    systemEnabled: value.systemEnabled ?? defaultSettings.systemEnabled,
    microphoneEnabled: value.microphoneEnabled ?? defaultSettings.microphoneEnabled,
    microphoneDeviceId: typeof value.microphoneDeviceId === 'string' ? value.microphoneDeviceId : '',
    activeModelId,
    hotkey: typeof value.hotkey === 'string' && value.hotkey.trim()
      ? value.hotkey.trim()
      : defaultSettings.hotkey,
    activationMode: value.activationMode === 'hold' ? 'hold' : 'toggle',
    autoType: value.autoType ?? defaultSettings.autoType,
    autoCopy: value.autoCopy ?? defaultSettings.autoCopy,
    idleUnloadMinutes: idle,
    historyRetentionHours: historyRetention,
    launchToTray: value.launchToTray ?? defaultSettings.launchToTray,
    theme: value.theme === 'light' ? 'light' : 'dark',
    language: supportedLanguageModes.has(String(value.language))
      ? value.language as AppSettings['language']
      : defaultSettings.language,
  };
}

function readSettings(): AppSettings {
  return normalizeSettings(safeReadJson<Partial<AppSettings>>(settingsPath(), defaultSettings));
}

function writeSettings(settings: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const next = normalizeSettings({ ...current, ...settings });
  mkdirSync(dirname(settingsPath()), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  if (next.historyRetentionHours !== current.historyRetentionHours) {
    readHistory(next.historyRetentionHours);
  }
  sendToRenderer('settings:changed', next);
  if (lastTrayState) {
    updateTray({ ...lastTrayState, settings: next });
  }
  return next;
}

function requiredModelPaths(modelId: string): string[] {
  const dir = modelDir(modelId);
  return getModel(modelId).requiredFiles.map((file) => join(dir, file));
}

function validateModelDir(modelId: string): boolean {
  return requiredModelPaths(modelId).every((path) => existsSync(path));
}

function modelStatus(modelId = readActiveModelId(), error?: string): ModelStatus {
  const model = getModel(modelId);
  const dir = modelDir(model.id);
  if (modelDownloadController && modelDownloadModelId === model.id) {
    return {
      status: 'downloading',
      modelId: model.id,
      modelDir: dir,
      title: model.title,
      approxSizeMb: model.approxSizeMb,
      error,
    };
  }
  if (validateModelDir(model.id)) {
    return {
      status: 'ready',
      modelId: model.id,
      modelDir: dir,
      title: model.title,
      approxSizeMb: model.approxSizeMb,
      error,
    };
  }
  if (existsSync(dir)) {
    return {
      status: 'corrupted',
      modelId: model.id,
      modelDir: dir,
      title: model.title,
      approxSizeMb: model.approxSizeMb,
      error,
    };
  }
  return {
    status: error ? 'error' : 'missing',
    modelId: model.id,
    modelDir: dir,
    title: model.title,
    approxSizeMb: model.approxSizeMb,
    error,
  };
}

function sendToRenderer(channel: string, payload: unknown): void {
  const window = mainWindow;
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, payload);
  }
}

function sendCommand(command: AppCommand): void {
  sendToRenderer('app:command', command);
  if (mainWindow?.isMinimized()) {
    mainWindow.restore();
  }
}

function sendSttEvent(event: SttEvent): void {
  sendToRenderer('stt:event', event);
}

function sendModelProgress(event: ModelProgressEvent): void {
  sendToRenderer('stt:modelProgress', event);
}

const windowsDirectTypeScript = String.raw`
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$encoded = [Console]::In.ReadToEnd().Trim()
if (-not $encoded) {
  exit 0
}
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))

Add-Type @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class TypeAInput
{
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)]
        public MOUSEINPUT mi;
        [FieldOffset(0)]
        public KEYBDINPUT ki;
        [FieldOffset(0)]
        public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT
    {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;

    public static void SendText(string text)
    {
        foreach (char ch in text)
        {
            INPUT[] inputs = new INPUT[2];
            inputs[0] = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wScan = (ushort)ch,
                        dwFlags = KEYEVENTF_UNICODE
                    }
                }
            };
            inputs[1] = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wScan = (ushort)ch,
                        dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
                    }
                }
            };
            uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
            if (sent != inputs.Length)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SendInput failed.");
            }
        }
    }
}
"@

[TypeAInput]::SendText($text)
`;

const windowsForegroundBoundsScript = String.raw`
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class TypeAForegroundWindow
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

$handle = [TypeAForegroundWindow]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) {
    exit 1
}

$rect = New-Object TypeAForegroundWindow+RECT
if (-not [TypeAForegroundWindow]::GetWindowRect($handle, [ref]$rect)) {
    exit 1
}

if ($rect.Right -le $rect.Left -or $rect.Bottom -le $rect.Top) {
    exit 1
}

[Console]::Write(("{0},{1},{2},{3}" -f $rect.Left, $rect.Top, $rect.Right, $rect.Bottom))
`;

async function getWindowsForegroundBounds(): Promise<Rectangle | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      windowsForegroundBoundsScript,
    ], { windowsHide: true });
    let stdout = '';
    let settled = false;

    const finish = (bounds: Rectangle | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(bounds);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(null);
    }, 1_500);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(null);
        return;
      }
      const [left, top, right, bottom] = stdout.trim().split(',').map(Number);
      if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
        finish(null);
        return;
      }
      finish({ x: left, y: top, width: right - left, height: bottom - top });
    });
  });
}

async function typeTextIntoActiveField(text: string): Promise<boolean> {
  if (!text) {
    return true;
  }
  if (process.platform !== 'win32') {
    throw new Error('Direct typing is currently supported on Windows only.');
  }

  const encodedText = Buffer.from(text, 'utf8').toString('base64');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      windowsDirectTypeScript,
    ], { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Direct typing failed with exit code ${code ?? 'unknown'}`));
    });
    child.stdin.end(encodedText);
  });

  return true;
}

function resetRecognizer(): void {
  activeRecognizer = null;
  activeRecognizerModelId = '';
  sttQueue = Promise.resolve();
  scheduleIdleUnload();
}

function cancelIdleUnload(): void {
  if (idleUnloadTimer) {
    clearTimeout(idleUnloadTimer);
    idleUnloadTimer = null;
  }
}

function scheduleIdleUnload(): void {
  cancelIdleUnload();
  const minutes = readSettings().idleUnloadMinutes;
  if (!minutes || sttActive || !activeRecognizer) {
    return;
  }
  idleUnloadTimer = setTimeout(() => {
    if (!sttActive) {
      activeRecognizer = null;
      activeRecognizerModelId = '';
      sendSttEvent({ type: 'status', status: 'model-unloaded' });
    }
  }, minutes * 60_000);
}

async function downloadFile(
  url: string,
  destination: string,
  signal: AbortSignal,
  onProgress: (loadedBytes: number, totalBytes: number) => void,
): Promise<void> {
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Type-A/0.1.0',
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  mkdirSync(dirname(destination), { recursive: true });
  const totalBytes = Number(response.headers.get('content-length') ?? 0);
  let loadedBytes = 0;
  const file = createWriteStream(destination);
  const reader = response.body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      loadedBytes += value.byteLength;
      if (!file.write(Buffer.from(value))) {
        await once(file, 'drain');
      }
      onProgress(loadedBytes, totalBytes);
    }
  } finally {
    file.end();
  }

  await once(file, 'finish');
}

async function extractArchive(archivePath: string, destinationRoot: string, signal: AbortSignal): Promise<void> {
  mkdirSync(destinationRoot, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const command = process.platform === 'win32' ? 'tar.exe' : 'tar';
    const processRef = spawn(command, ['-xjf', archivePath, '-C', destinationRoot], {
      windowsHide: true,
    });
    modelExtractProcess = processRef;
    let stderr = '';
    const abortHandler = (): void => {
      processRef.kill();
      reject(new Error('Model extraction cancelled'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
    processRef.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    processRef.on('error', (error) => {
      signal.removeEventListener('abort', abortHandler);
      modelExtractProcess = null;
      reject(error);
    });
    processRef.on('exit', (code) => {
      signal.removeEventListener('abort', abortHandler);
      modelExtractProcess = null;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `tar exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

function hfResolveUrl(repo: string, file: string): string {
  const encodedFile = file.split('/').map(encodeURIComponent).join('/');
  return `https://huggingface.co/${repo}/resolve/main/${encodedFile}?download=true`;
}

async function downloadAndInstallModel(modelId: string, controller: AbortController): Promise<void> {
  const model = getModel(modelId);
  const installDir = modelDir(model.id);
  rmSync(installDir, { recursive: true, force: true });
  mkdirSync(installDir, { recursive: true });

  sendModelProgress({
    modelId: model.id,
    type: 'progress',
    stage: 'starting',
    progress: 1,
  });

  if (model.download.kind === 'archive') {
    const archivePath = join(modelDownloadRoot(), `${model.download.archiveName}.tar.bz2`);
    await downloadFile(model.download.url, archivePath, controller.signal, (loaded, total) => {
      sendModelProgress({
        modelId: model.id,
        type: 'progress',
        stage: 'downloading',
        progress: total > 0 ? Math.min(84, Math.round((loaded / total) * 80)) : 35,
      });
    });
    sendModelProgress({ modelId: model.id, type: 'progress', stage: 'extracting', progress: 88 });
    await extractArchive(archivePath, modelsRoot(), controller.signal);
    rmSync(archivePath, { force: true });
  } else {
    const files = model.download.files;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const destination = join(installDir, file);
      await downloadFile(hfResolveUrl(model.download.repo, file), destination, controller.signal, (loaded, total) => {
        const fileBase = Math.round((index / files.length) * 92);
        const fileProgress = total > 0 ? Math.round((loaded / total) * (92 / files.length)) : 2;
        sendModelProgress({
          modelId: model.id,
          type: 'progress',
          stage: `downloading ${file}`,
          progress: Math.min(96, 2 + fileBase + fileProgress),
        });
      });
    }
  }

  if (!validateModelDir(model.id)) {
    throw new Error(`Model files are missing: ${model.requiredFiles.join(', ')}`);
  }

  writeActiveModelId(model.id);
  writeSettings({ activeModelId: model.id });
  sendModelProgress({ modelId: model.id, type: 'done', stage: 'ready', progress: 100 });
}

function startModelDownload(modelId = readActiveModelId()): ModelStatus {
  if (modelDownloadController) {
    return modelStatus(modelId);
  }

  const model = getModel(modelId);
  const controller = new AbortController();
  modelDownloadController = controller;
  modelDownloadModelId = model.id;
  resetRecognizer();

  void downloadAndInstallModel(model.id, controller)
    .catch((error) => {
      if (!controller.signal.aborted) {
        sendModelProgress({
          modelId: model.id,
          type: 'error',
          stage: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
    .finally(() => {
      if (modelDownloadController === controller) {
        modelDownloadController = null;
        modelDownloadModelId = '';
      }
      const status = modelStatus(model.id);
      sendToRenderer('stt:modelStatus', status);
      if (lastTrayState) {
        updateTray({ ...lastTrayState, modelStatus: status });
      }
    });

  return modelStatus(model.id);
}

function cancelModelDownload(): ModelStatus {
  modelDownloadController?.abort();
  modelExtractProcess?.kill();
  modelDownloadController = null;
  modelDownloadModelId = '';
  modelExtractProcess = null;
  return modelStatus();
}

function buildRecognizerConfig(model: InternalModel): Record<string, unknown> {
  const dir = modelDir(model.id);
  const common = {
    tokens: join(dir, model.requiredFiles.find((file) => file.endsWith('tokens.txt')) ?? 'tokens.txt'),
    numThreads: 2,
    provider: 'cpu',
    debug: 0,
  };

  if (model.engine === 'transducer') {
    const encoder = model.requiredFiles.find((file) => file.includes('encoder')) ?? 'encoder.int8.onnx';
    const decoder = model.requiredFiles.find((file) => file.includes('decoder')) ?? 'decoder.onnx';
    const joiner = model.requiredFiles.find((file) => file.includes('joiner')) ?? 'joiner.onnx';
    return {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        ...common,
        transducer: {
          encoder: join(dir, encoder),
          decoder: join(dir, decoder),
          joiner: join(dir, joiner),
        },
      },
    };
  }

  if (model.engine === 'nemoCtc') {
    return {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        ...common,
        nemoCtc: {
          model: join(dir, 'model.int8.onnx'),
        },
      },
    };
  }

  const encoder = model.requiredFiles.find((file) => file.includes('encoder')) ?? '';
  const decoder = model.requiredFiles.find((file) => file.includes('decoder')) ?? '';
  return {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      ...common,
      whisper: {
        encoder: join(dir, encoder),
        decoder: join(dir, decoder),
        language: model.whisperLanguage ?? '',
        task: 'transcribe',
        tailPaddings: 0,
      },
    },
  };
}

async function ensureRecognizer(): Promise<SherpaOfflineRecognizer> {
  cancelIdleUnload();
  const modelId = readActiveModelId();
  if (activeRecognizer && activeRecognizerModelId === modelId) {
    return activeRecognizer;
  }
  if (!validateModelDir(modelId)) {
    throw new Error('ASR model is not installed or is corrupted');
  }

  const sherpa = require('sherpa-onnx-node') as SherpaModule;
  const model = getModel(modelId);
  const config = buildRecognizerConfig(model);
  activeRecognizer = sherpa.OfflineRecognizer.createAsync
    ? await sherpa.OfflineRecognizer.createAsync(config)
    : new sherpa.OfflineRecognizer(config);
  activeRecognizerModelId = modelId;
  sendSttEvent({ type: 'status', status: 'model-loaded' });
  return activeRecognizer;
}

async function transcribeChunk(payload: SttChunkPayload): Promise<void> {
  const recognizer = await ensureRecognizer();
  const stream = recognizer.createStream();
  const samples = payload.samples instanceof Float32Array
    ? payload.samples
    : Float32Array.from(payload.samples);

  stream.acceptWaveform({
    sampleRate: payload.sampleRate,
    samples,
  });
  if (recognizer.decodeAsync) {
    await recognizer.decodeAsync(stream);
  } else {
    recognizer.decode(stream);
  }

  const result = recognizer.getResult(stream);
  const text = (result.text ?? '').trim();
  if (!text) {
    return;
  }

  sendSttEvent({
    type: payload.final ? 'final' : 'partial',
    source: payload.source,
    segmentId: payload.segmentId,
    sequence: payload.sequence,
    text,
    startedAt: payload.startedAt,
    endedAt: payload.endedAt,
  });
}

function enqueueTranscription(payload: SttChunkPayload): void {
  sttQueue = sttQueue
    .then(() => transcribeChunk(payload))
    .catch((error) => {
      sendSttEvent({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

function readHistory(retentionHours = readSettings().historyRetentionHours): HistoryRecord[] {
  if (!existsSync(historyPath())) {
    return [];
  }
  const records = readFileSync(historyPath(), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as HistoryRecord;
      } catch {
        return null;
      }
    })
    .filter((record): record is HistoryRecord => Boolean(record));
  const cutoff = retentionHours === 0
    ? null
    : Date.now() - retentionHours * 60 * 60 * 1_000;
  const retained = cutoff === null
    ? records
    : records.filter((record) => {
        const timestamp = Number.isFinite(record.endedAt) ? record.endedAt : record.startedAt;
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      });
  if (retained.length !== records.length) {
    writeHistory(retained);
  }
  return retained.sort((a, b) => b.endedAt - a.endedAt);
}

function writeHistory(records: HistoryRecord[]): void {
  mkdirSync(dirname(historyPath()), { recursive: true });
  const content = records.length > 0
    ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n`
    : '';
  writeFileSync(historyPath(), content);
}

function addHistoryRecord(record: HistoryRecord): HistoryRecord {
  const records = readHistory().filter((item) => item.id !== record.id);
  writeHistory([record, ...records]);
  return record;
}

function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    const source = sources[0];
    if (!source) {
      callback({});
      return;
    }
    callback({
      video: source,
      audio: 'loopback',
    });
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 640,
    minHeight: 410,
    title: 'Type-A',
    icon: assetPath('favicon', 'favicon.ico'),
    backgroundColor: '#0d0d0d',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 15 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    void window.loadFile(join(__dirname, '../../dist/index.html'));
  }

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  return window;
}

const overlayWidth = 140;
const overlayHeight = 52;

function displayUnderCursor(): Display {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function positionOverlayOnDisplay(display: Display): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }
  overlayWindow.setPosition(
    Math.round(display.workArea.x + display.workArea.width / 2 - overlayWidth / 2),
    Math.round(display.workArea.y + display.workArea.height - overlayHeight - 34),
    false,
  );
}

function positionOverlayForCurrentFocus(): void {
  positionOverlayOnDisplay(displayUnderCursor());
  if (process.platform !== 'win32' || overlayPlacementLookup) {
    return;
  }

  overlayPlacementLookup = getWindowsForegroundBounds()
    .then((bounds) => {
      if (bounds) {
        positionOverlayOnDisplay(screen.getDisplayMatching(bounds));
      }
    })
    .finally(() => {
      overlayPlacementLookup = null;
    });
}

function createOverlayWindow(): BrowserWindow {
  const display = displayUnderCursor();
  const window = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round(display.workArea.x + display.workArea.width / 2 - overlayWidth / 2),
    y: Math.round(display.workArea.y + display.workArea.height - overlayHeight - 34),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  window.setIgnoreMouseEvents(true);
  window.setAlwaysOnTop(true, 'screen-saver');

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
  } else {
    void window.loadFile(join(__dirname, '../../dist/overlay.html'));
  }
  return window;
}

function createTray(): void {
  const image = nativeImage.createFromPath(assetPath('favicon', 'favicon.ico'));
  tray = new Tray(image);
  tray.setToolTip('Type-A');
  updateTray({
    isRecording: false,
    settings: readSettings(),
    modelStatus: modelStatus(),
  });
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function updateTray(state: TrayStateSnapshot): boolean {
  lastTrayState = state;
  if (!tray) {
    return false;
  }
  const { settings, modelStatus: currentModelStatus, isRecording } = state;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Type-A',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: isRecording ? 'Stop recording' : 'Start recording',
      click: () => sendCommand(isRecording ? 'stop-recording' : 'start-recording'),
    },
    {
      label: 'System audio',
      type: 'checkbox',
      checked: settings.systemEnabled,
      click: () => sendCommand('toggle-system'),
    },
    {
      label: 'Microphone',
      type: 'checkbox',
      checked: settings.microphoneEnabled,
      click: () => sendCommand('toggle-microphone'),
    },
    {
      label: 'Type into active field',
      type: 'checkbox',
      checked: settings.autoType,
      click: () => sendCommand('toggle-auto-type'),
    },
    {
      label: 'Auto-copy transcript',
      type: 'checkbox',
      checked: settings.autoCopy,
      click: () => sendCommand('toggle-auto-copy'),
    },
    { type: 'separator' },
    {
      label: `Model: ${currentModelStatus.title} (${currentModelStatus.status})`,
      enabled: false,
    },
    {
      label: 'Unload model',
      click: () => sendCommand('unload-model'),
      enabled: Boolean(activeRecognizer),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => sendCommand('open-settings'),
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(isRecording ? 'Type-A - Recording' : 'Type-A');
  return true;
}

function unregisterHotkey(): boolean {
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey);
    registeredHotkey = '';
  }
  if (holdHook) {
    holdHook.stop();
    holdHook = null;
  }
  holdDown = false;
  return true;
}

function normalizeAccelerator(accelerator: string): string {
  return accelerator
    .trim()
    .replace(/CommandOrControl/gi, process.platform === 'darwin' ? 'Command' : 'Ctrl')
    .replace(/(^|\+)Control(?=\+|$)/gi, '$1Ctrl');
}

function parseAccelerator(accelerator: string): { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } {
  const parts = normalizeAccelerator(accelerator).split('+').map((part) => part.trim()).filter(Boolean);
  const key = parts[parts.length - 1] ?? '';
  return {
    key,
    ctrl: parts.some((part) => /^ctrl$/i.test(part)),
    alt: parts.some((part) => /^(alt|option)$/i.test(part)),
    shift: parts.some((part) => /^shift$/i.test(part)),
    meta: parts.some((part) => /^(cmd|command|meta|super)$/i.test(part)),
  };
}

function resolveHookKeyCode(keyEnum: Record<string, number>, key: string): number | null {
  const normalized = key.length === 1 ? key.toUpperCase() : key;
  const variants = [
    normalized,
    normalized.toUpperCase(),
    `Key${normalized.toUpperCase()}`,
    `KEY_${normalized.toUpperCase()}`,
    normalized === 'Space' ? 'Space' : '',
    normalized === 'Space' ? 'SPACE' : '',
  ].filter(Boolean);
  for (const variant of variants) {
    const value = keyEnum[variant];
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
}

function resolveWindowsVirtualKey(key: string): number | null {
  const normalized = key.length === 1 ? key.toUpperCase() : key;
  if (/^[A-Z]$/.test(normalized)) {
    return normalized.charCodeAt(0);
  }
  if (/^[0-9]$/.test(normalized)) {
    return normalized.charCodeAt(0);
  }
  const functionKey = /^F([1-9]|1[0-9]|2[0-4])$/i.exec(normalized);
  if (functionKey) {
    return 0x70 + Number(functionKey[1]) - 1;
  }
  const namedKeys: Record<string, number> = {
    Space: 0x20,
    Enter: 0x0d,
    Return: 0x0d,
    Tab: 0x09,
    Esc: 0x1b,
    Escape: 0x1b,
    Backspace: 0x08,
    Delete: 0x2e,
    Insert: 0x2d,
    Home: 0x24,
    End: 0x23,
    PageUp: 0x21,
    PageDown: 0x22,
    Up: 0x26,
    Down: 0x28,
    Left: 0x25,
    Right: 0x27,
  };
  return namedKeys[normalized] ?? null;
}

function windowsHoldKeyGroups(accelerator: string): number[][] | null {
  const parsed = parseAccelerator(accelerator);
  const keyCode = resolveWindowsVirtualKey(parsed.key);
  if (keyCode === null) {
    return null;
  }
  const groups: number[][] = [];
  if (parsed.ctrl) groups.push([0x11]);
  if (parsed.alt) groups.push([0x12]);
  if (parsed.shift) groups.push([0x10]);
  if (parsed.meta) groups.push([0x5b, 0x5c]);
  groups.push([keyCode]);
  return groups;
}

function windowsHoldWatcherScript(groups: number[][]): string {
  const allDownExpression = groups
    .map((group) => `(${group.map((key) => `((([int][TypeAKeyState]::GetAsyncKeyState(${key})) -band 0x8000) -ne 0)`).join(' -or ')})`)
    .join(' -and ');
  return String.raw`
$down = $false
$upTicks = 0

Add-Type @"
using System.Runtime.InteropServices;

public static class TypeAKeyState
{
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);
}
"@

[Console]::Out.WriteLine("ready")
[Console]::Out.Flush()

while ($true) {
    Start-Sleep -Milliseconds 10
    $allDown = ${allDownExpression}
    if (-not $allDown) {
        $upTicks += 1
        if ($down -or ($upTicks -ge 10)) {
            [Console]::Out.WriteLine("up")
            [Console]::Out.Flush()
            $upTicks = 0
        }
        $down = $false
        continue
    }
    $upTicks = 0
    if (-not $down) {
        [Console]::Out.WriteLine("down")
        [Console]::Out.Flush()
        $down = $true
    }
}
`;
}

function stopHoldRecording(): void {
  if (holdDown) {
    holdDown = false;
    sendToRenderer('hotkey:holdStop', {});
  }
}

function startHoldRecording(): void {
  if (!holdDown) {
    holdDown = true;
    sendToRenderer('hotkey:holdStart', {});
  }
}

function startWindowsHoldWatcher(groups: number[][]): HoldHookHandle {
  const watcher = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    windowsHoldWatcherScript(groups),
  ], { windowsHide: true });
  let stopped = false;
  let stdoutBuffer = '';
  let stderr = '';
  let readySettled = false;
  let resolveReady: () => void = () => undefined;
  let rejectReady: (error: Error) => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const readyTimeout = setTimeout(() => {
    if (!readySettled) {
      readySettled = true;
      rejectReady(new Error('Hold hotkey watcher did not start in time'));
    }
  }, 5_000);

  const markReady = (): void => {
    if (!readySettled) {
      readySettled = true;
      clearTimeout(readyTimeout);
      resolveReady();
    }
  };

  const failReady = (message: string): void => {
    if (!readySettled) {
      readySettled = true;
      clearTimeout(readyTimeout);
      rejectReady(new Error(message));
    }
  };

  watcher.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf8');
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === 'ready') {
        markReady();
      }
      if (line === 'down' && !holdDown) {
        startHoldRecording();
      }
      if (line === 'up') {
        stopHoldRecording();
      }
    }
  });

  watcher.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  watcher.on('error', (error) => {
    failReady(error.message);
    if (!stopped) {
      stopHoldRecording();
    }
  });
  watcher.on('close', (code) => {
    failReady(stderr.trim() || `Hold hotkey watcher exited with code ${code ?? 'unknown'}`);
    if (!stopped) {
      stopHoldRecording();
    }
  });

  return {
    stop: () => {
      stopped = true;
      failReady('Hold hotkey watcher was stopped');
      watcher.kill();
      stopHoldRecording();
    },
    ready,
  };
}

async function registerWindowsHoldHotkey(accelerator: string): Promise<HotkeyStatus> {
  unregisterHotkey();
  if (process.platform !== 'win32') {
    return {
      ok: false,
      mode: 'hold',
      accelerator,
      error: 'Hold mode requires a native keyboard hook on this platform.',
    };
  }
  const groups = windowsHoldKeyGroups(accelerator);
  if (!groups) {
    return {
      ok: false,
      mode: 'hold',
      accelerator,
      error: 'Unsupported hold hotkey.',
    };
  }
  let watcher: HoldHookHandle | null = null;
  try {
    watcher = startWindowsHoldWatcher(groups);
    holdHook = watcher;
    await watcher.ready;
    if (holdHook !== watcher) {
      return {
        ok: false,
        mode: 'hold',
        accelerator,
        error: 'Hold hotkey registration was replaced',
      };
    }
    const ok = globalShortcut.register(accelerator, startHoldRecording);
    if (!ok) {
      throw new Error('Hotkey is already used by another app or the system');
    }
    registeredHotkey = accelerator;
    return {
      ok: true,
      mode: 'hold',
      accelerator,
    };
  } catch (error) {
    if (watcher && holdHook === watcher) {
      unregisterHotkey();
    }
    return {
      ok: false,
      mode: 'hold',
      accelerator,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function queueHotkeyRegistration(payload: HotkeyRegistrationPayload): Promise<HotkeyStatus> {
  const registration = hotkeyRegistrationQueue.then(() => registerHotkey(payload));
  hotkeyRegistrationQueue = registration.then(() => undefined, () => undefined);
  return registration;
}

async function registerHoldHotkey(accelerator: string): Promise<HotkeyStatus> {
  if (process.platform === 'win32') {
    return registerWindowsHoldHotkey(accelerator);
  }
  unregisterHotkey();
  try {
    const imported = await import('uiohook-napi') as unknown as {
      uIOhook: {
        on: (event: 'keydown' | 'keyup', listener: (event: Record<string, unknown>) => void) => void;
        off: (event: 'keydown' | 'keyup', listener: (event: Record<string, unknown>) => void) => void;
        start: () => void;
        stop: () => void;
      };
      UiohookKey: Record<string, number>;
    };
    const parsed = parseAccelerator(accelerator);
    const keycode = resolveHookKeyCode(imported.UiohookKey, parsed.key);
    if (keycode === null) {
      throw new Error(`Unsupported hold key: ${parsed.key}`);
    }
    const pressed = new Set<number>();
    const modifierCodes = {
      ctrl: [
        resolveHookKeyCode(imported.UiohookKey, 'Ctrl'),
        resolveHookKeyCode(imported.UiohookKey, 'Control'),
        resolveHookKeyCode(imported.UiohookKey, 'LeftControl'),
        resolveHookKeyCode(imported.UiohookKey, 'RightControl'),
      ].filter((value): value is number => value !== null),
      alt: [
        resolveHookKeyCode(imported.UiohookKey, 'Alt'),
        resolveHookKeyCode(imported.UiohookKey, 'LeftAlt'),
        resolveHookKeyCode(imported.UiohookKey, 'RightAlt'),
      ].filter((value): value is number => value !== null),
      shift: [
        resolveHookKeyCode(imported.UiohookKey, 'Shift'),
        resolveHookKeyCode(imported.UiohookKey, 'LeftShift'),
        resolveHookKeyCode(imported.UiohookKey, 'RightShift'),
      ].filter((value): value is number => value !== null),
      meta: [
        resolveHookKeyCode(imported.UiohookKey, 'Meta'),
        resolveHookKeyCode(imported.UiohookKey, 'Command'),
        resolveHookKeyCode(imported.UiohookKey, 'LeftMeta'),
        resolveHookKeyCode(imported.UiohookKey, 'RightMeta'),
      ].filter((value): value is number => value !== null),
    };
    const hasModifier = (codes: number[]) => codes.some((code) => pressed.has(code));
    const modifiersMatch = (): boolean =>
      (!parsed.ctrl || hasModifier(modifierCodes.ctrl)) &&
      (!parsed.alt || hasModifier(modifierCodes.alt)) &&
      (!parsed.shift || hasModifier(modifierCodes.shift)) &&
      (!parsed.meta || hasModifier(modifierCodes.meta));

    const onKeyDown = (event: Record<string, unknown>): void => {
      const code = Number(event.keycode);
      pressed.add(code);
      if (code === keycode && modifiersMatch() && !holdDown) {
        holdDown = true;
        sendToRenderer('hotkey:holdStart', {});
      }
    };
    const onKeyUp = (event: Record<string, unknown>): void => {
      const code = Number(event.keycode);
      pressed.delete(code);
      if ((code === keycode || holdDown) && holdDown && (!modifiersMatch() || code === keycode)) {
        holdDown = false;
        sendToRenderer('hotkey:holdStop', {});
      }
    };
    imported.uIOhook.on('keydown', onKeyDown);
    imported.uIOhook.on('keyup', onKeyUp);
    imported.uIOhook.start();
    holdHook = {
      stop: () => {
        imported.uIOhook.off('keydown', onKeyDown);
        imported.uIOhook.off('keyup', onKeyUp);
        imported.uIOhook.stop();
      },
    };
    registeredHotkey = accelerator;
    return { ok: true, mode: 'hold', accelerator };
  } catch {
    unregisterHotkey();
    return registerWindowsHoldHotkey(accelerator);
  }
}

async function registerHotkey(payload: HotkeyRegistrationPayload): Promise<HotkeyStatus> {
  const accelerator = payload.accelerator.trim();
  if (!accelerator) {
    unregisterHotkey();
    return { ok: false, mode: payload.mode, accelerator, error: 'Hotkey is empty' };
  }
  if (payload.mode === 'hold') {
    return registerHoldHotkey(accelerator);
  }

  unregisterHotkey();
  try {
    const ok = globalShortcut.register(accelerator, () => {
      sendToRenderer('hotkey:toggle', {});
    });
    if (ok) {
      registeredHotkey = accelerator;
    }
    return {
      ok,
      mode: 'toggle',
      accelerator,
      error: ok ? undefined : 'Hotkey is already used by another app or the system',
    };
  } catch (error) {
    unregisterHotkey();
    return {
      ok: false,
      mode: 'toggle',
      accelerator,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_event, payload: Partial<AppSettings>) => writeSettings(payload));

  ipcMain.handle('audio:startSystemLoopback', () => true);
  ipcMain.handle('audio:stopSystemLoopback', () => true);

  ipcMain.handle('stt:listModels', (): ModelCatalogItem[] =>
    modelCatalog.map((model) => ({
      id: model.id,
      title: model.title,
      description: model.description,
      languages: model.languages,
      approxSizeMb: model.approxSizeMb,
      license: model.license,
      source: model.source,
    })),
  );
  ipcMain.handle('stt:getStatus', (_event, modelId?: string) => modelStatus(modelId ?? readActiveModelId()));
  ipcMain.handle('stt:download', (_event, modelId?: string) => startModelDownload(modelId ?? readActiveModelId()));
  ipcMain.handle('stt:cancelDownload', () => cancelModelDownload());
  ipcMain.handle('stt:delete', (_event, modelId?: string) => {
    cancelModelDownload();
    const id = modelId ?? readActiveModelId();
    resetRecognizer();
    rmSync(modelDir(id), { recursive: true, force: true });
    return modelStatus(id);
  });
  ipcMain.handle('stt:setActive', (_event, modelId: string) => {
    const model = getModel(modelId);
    resetRecognizer();
    writeActiveModelId(model.id);
    writeSettings({ activeModelId: model.id });
    return modelStatus(model.id);
  });
  ipcMain.handle('stt:start', async () => {
    sttActive = true;
    cancelIdleUnload();
    await ensureRecognizer();
    return true;
  });
  ipcMain.handle('stt:pushChunk', (_event, payload: SttChunkPayload) => {
    enqueueTranscription(payload);
    return true;
  });
  ipcMain.handle('stt:stop', async () => {
    sttActive = false;
    await sttQueue;
    scheduleIdleUnload();
    return true;
  });
  ipcMain.handle('stt:unload', () => {
    resetRecognizer();
    sendSttEvent({ type: 'status', status: 'model-unloaded' });
    return modelStatus();
  });

  ipcMain.handle('hotkey:register', (_event, payload: HotkeyRegistrationPayload) => queueHotkeyRegistration(payload));
  ipcMain.handle('hotkey:unregister', () => unregisterHotkey());

  ipcMain.handle('tray:update', (_event, payload: TrayStateSnapshot) => updateTray(payload));
  ipcMain.handle('history:list', () => readHistory());
  ipcMain.handle('history:add', (_event, record: HistoryRecord) => addHistoryRecord(record));
  ipcMain.handle('history:delete', (_event, id: string) => {
    writeHistory(readHistory().filter((record) => record.id !== id));
    return true;
  });
  ipcMain.handle('history:copy', (_event, id: string) => {
    const record = readHistory().find((item) => item.id === id);
    if (!record) {
      return false;
    }
    clipboard.writeText(record.text);
    return true;
  });
  ipcMain.handle('history:toggleStar', (_event, id: string) => {
    let updated: HistoryRecord | null = null;
    const records = readHistory().map((record) => {
      if (record.id !== id) {
        return record;
      }
      updated = { ...record, starred: !record.starred };
      return updated;
    });
    if (updated) {
      writeHistory(records);
    }
    return updated;
  });
  ipcMain.handle('input:typeText', (_event, text: string) => typeTextIntoActiveField(text));
  ipcMain.handle('clipboard:writeText', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('overlay:show', (_event, requestedTheme: AppSettings['theme']) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      overlayWindow = createOverlayWindow();
    }
    positionOverlayForCurrentFocus();
    const theme = requestedTheme === 'light' ? 'light' : 'dark';
    const sendTheme = () => overlayWindow?.webContents.send('overlay:theme', theme);
    if (overlayWindow.webContents.isLoadingMainFrame()) {
      overlayWindow.webContents.once('did-finish-load', sendTheme);
    } else {
      sendTheme();
    }
    overlayWindow.showInactive();
    return true;
  });
  ipcMain.handle('overlay:updateLevel', (_event, level: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('overlay:level', level);
    }
    return true;
  });
  ipcMain.handle('overlay:hide', () => {
    overlayWindow?.hide();
    return true;
  });

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
    return true;
  });
  ipcMain.handle('window:close', () => {
    mainWindow?.hide();
    return true;
  });
  ipcMain.handle('app:getLocale', () => app.getLocale());
  ipcMain.handle('updates:getStatus', () => getUpdateStatus());
  ipcMain.handle('updates:check', () => checkForUpdates());
  ipcMain.handle('updates:install', () => installDownloadedUpdate());
  ipcMain.handle('shell:openExternal', async (_event, rawUrl: string) => {
    const url = new URL(rawUrl);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      throw new Error('Unsupported external link protocol');
    }
    await shell.openExternal(url.toString());
    return true;
  });
}

app.whenReady().then(() => {
  registerDisplayMediaHandler();
  registerIpc();
  readHistory();
  mainWindow = createMainWindow();
  createTray();
  initializeUpdater((status) => sendToRenderer('updates:status', status));

  const settings = readSettings();
  if (settings.launchToTray) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }

  void queueHotkeyRegistration({ accelerator: settings.hotkey, mode: settings.activationMode });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
    mainWindow?.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  unregisterHotkey();
  cancelModelDownload();
  cancelIdleUnload();
  shutdownUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
