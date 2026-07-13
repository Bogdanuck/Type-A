/* global AudioWorkletProcessor, registerProcessor, sampleRate */

class TypeAPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channel = input[0];
    for (const sample of channel) {
      this.buffer.push(sample);
    }

    const frameSize = Math.max(1, Math.round(sampleRate * 0.04));
    while (this.buffer.length >= frameSize) {
      const samples = new Float32Array(this.buffer.splice(0, frameSize));
      this.port.postMessage({
        sampleRate,
        samples,
      }, [samples.buffer]);
    }

    return true;
  }
}

registerProcessor('type-a-pcm-processor', TypeAPcmProcessor);
