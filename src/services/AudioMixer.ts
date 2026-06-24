export class AudioMixer {
  private activeSounds: { type: string; age: number; phase: number }[] = [];
  private readonly sampleRate = 44100;
  private readonly fps = 60;
  private readonly samplesPerFrame = this.sampleRate / this.fps; // 735

  public playSound(type: 'shoot' | 'explosion') {
    this.activeSounds.push({ type, age: 0, phase: 0 });
  }

  public getFrameBuffer(): Buffer {
    // 16-bit PCM requires 2 bytes per sample
    const buf = Buffer.alloc(this.samplesPerFrame * 2);

    for (let i = 0; i < this.samplesPerFrame; i++) {
      let sample = 0;
      
      for (const s of this.activeSounds) {
        const t = s.age + (i / this.sampleRate);
        
        if (s.type === 'shoot') {
          if (t < 0.1) {
            // Square wave: 880Hz down to 110Hz, gain 0.1 down to 0.01
            const freq = 880 * Math.pow(110/880, t/0.1);
            s.phase += 2 * Math.PI * freq / this.sampleRate;
            const gain = 0.1 * Math.pow(0.01/0.1, t/0.1);
            
            const val = Math.sin(s.phase) > 0 ? 1 : -1;
            sample += val * gain;
          }
        } else if (s.type === 'explosion') {
          if (t < 0.2) {
            // Sawtooth wave: 100Hz down to 0.01Hz, gain 0.2 down to 0.01
            const freq = 100 * Math.pow(0.01/100, t/0.2);
            s.phase += 2 * Math.PI * freq / this.sampleRate;
            const gain = 0.2 * Math.pow(0.01/0.2, t/0.2);
            
            const val = 2 * ((s.phase / (2 * Math.PI)) % 1) - 1;
            sample += val * gain;
          }
        }
      }

      // Clamp between -1.0 and 1.0 to prevent clipping
      if (sample > 1.0) sample = 1.0;
      if (sample < -1.0) sample = -1.0;

      // Convert from float [-1, 1] to signed 16-bit integer [-32768, 32767]
      const intSample = Math.floor(sample * 32767);
      buf.writeInt16LE(intSample, i * 2);
    }

    // Advance age for all active sounds by exactly 1 frame's duration
    const frameDuration = 1 / this.fps;
    this.activeSounds = this.activeSounds.filter(s => {
      s.age += frameDuration;
      if (s.type === 'shoot' && s.age >= 0.1) return false;
      if (s.type === 'explosion' && s.age >= 0.2) return false;
      return true;
    });

    return buf;
  }
}
