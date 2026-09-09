/**
 * Scene audio, synthesised with Web Audio. No files: a splash is filtered
 * noise closing down, a landing is a short low tone. Intensity can follow the
 * force of the impact, which a fixed sample cannot.
 *
 * Starts muted. Browsers will not create an AudioContext before the user
 * interacts, so the context is built on the first click of the sound button.
 */
export class BeachAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;

  /** Stops twenty simultaneous impacts turning into one bang. */
  private lastPlayedAt = 0;

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.ensureContext();
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(enabled ? 0.5 : 0, this.context.currentTime, 0.02);
    }
  }

  /** Splash: white noise closing down through a falling filter. */
  playSplash(strength: number): void {
    const context = this.activeContext();
    if (!context || !this.master) return;

    const now = context.currentTime;
    const duration = 0.28 + strength * 0.25;

    const noise = context.createBufferSource();
    noise.buffer = this.noiseBuffer(context, duration);

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(1400 + strength * 1400, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16 + strength * 0.3, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(now);
    noise.stop(now + duration);
  }

  /** Landing: a falling low tone with a little noise on top. */
  playThud(strength: number): void {
    const context = this.activeContext();
    if (!context || !this.master) return;

    const now = context.currentTime;
    const duration = 0.16 + strength * 0.1;

    const tone = context.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(150 + strength * 70, now);
    tone.frequency.exponentialRampToValueAtTime(48, now + duration);

    const toneGain = context.createGain();
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.1 + strength * 0.22, now + 0.008);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const grit = context.createBufferSource();
    grit.buffer = this.noiseBuffer(context, 0.06);
    const gritFilter = context.createBiquadFilter();
    gritFilter.type = 'lowpass';
    gritFilter.frequency.value = 900;
    const gritGain = context.createGain();
    gritGain.gain.setValueAtTime(0.05 + strength * 0.08, now);
    gritGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    tone.connect(toneGain).connect(this.master);
    grit.connect(gritFilter).connect(gritGain).connect(this.master);

    tone.start(now);
    tone.stop(now + duration);
    grit.start(now);
    grit.stop(now + 0.06);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  // ------------------------------------------------------------------ internal

  private activeContext(): AudioContext | null {
    if (!this.enabled) return null;
    const context = this.ensureContext();
    if (!context) return null;

    // A minimum gap between sounds keeps a pile-up legible.
    const now = context.currentTime;
    if (now - this.lastPlayedAt < 0.045) return null;
    this.lastPlayedAt = now;
    return context;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      // Resume if the browser suspended it in a background tab.
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }

    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return null;

    this.context = new Constructor();
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(this.context.destination);
    return this.context;
  }

  private noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      // Faded towards the end so it does not cut off abruptly.
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }
}
