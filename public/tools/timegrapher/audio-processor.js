// Standalone audio processor, no dependencies. Only 1-ms energy estimates
// leave the worklet, never raw microphone recordings.
class CrowniqEnvelopeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.last = 0;
    this.energy = 0;
    this.samples = 0;
    this.frames = [];
    this.binSamples = sampleRate / 1000;
  }
  process(inputs, outputs) {
    const inChannels = inputs[0];
    const src = inChannels && inChannels.length ? inChannels[0] : null;
    if (src) {
      for (let i=0; i<src.length; i++) {
        const v=src[i];
        // Emphasize transients (tick impacts), suppress background hum.
        const diff=v-this.last*.985;
        this.last=v;
        this.energy+=diff*diff;
        this.samples++;
        if (this.samples>=this.binSamples) {
          this.frames.push(Math.sqrt(this.energy/this.samples));
          this.samples=0;this.energy=0;
        }
      }
      if (this.frames.length>=48) {
        this.port.postMessage(this.frames);
        this.frames=[];
      }
    }
    for (const channels of outputs) for (const output of channels) output.fill(0);
    return true;
  }
}
registerProcessor('crowniq-envelope',CrowniqEnvelopeProcessor);
