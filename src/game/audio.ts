/**
 * CS:GO Tactical Web Audio API sound engine
 * Procedurally generates realistic weapon reports (Deagle .50 AE, AK-47, M4A4, AWP),
 * authentic headshot "dink" helmet crunch, cobblestone footsteps, and combat audio.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.55;
    this.masterGain.connect(this.ctx.destination);
  }

  public ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.55, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Realistic Gunshot synthesis
  public playWeaponFire(weaponType: string) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (weaponType === 'pistol' || weaponType === 'deagle') {
      // --- DESERT EAGLE .50 ACTION EXPRESS CANNON CRACK ---
      // 1. Initial transient pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);

      // 2. High pressure explosive muzzle blast
      const noise = this.createNoiseBuffer(0.28);
      if (noise) {
        const src = this.ctx.createBufferSource();
        src.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.28);
        filter.Q.value = 1.2;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1.0, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        src.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.28);
      }

      // 3. Mechanical slide action clack
      const slideOsc = this.ctx.createOscillator();
      const slideGain = this.ctx.createGain();
      slideOsc.type = 'square';
      slideOsc.frequency.setValueAtTime(800, t + 0.04);
      slideOsc.frequency.exponentialRampToValueAtTime(300, t + 0.09);
      slideGain.gain.setValueAtTime(0.2, t + 0.04);
      slideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      slideOsc.connect(slideGain);
      slideGain.connect(this.masterGain);
      slideOsc.start(t + 0.04);
      slideOsc.stop(t + 0.09);

    } else if (weaponType === 'sniper' || weaponType === 'awp') {
      // --- AWP MAGNUM BOOM ---
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.55);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.55);

      const noise = this.createNoiseBuffer(0.65);
      if (noise) {
        const src = this.ctx.createBufferSource();
        src.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3500, t);
        filter.frequency.exponentialRampToValueAtTime(150, t + 0.65);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(1.2, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

        src.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.65);
      }

    } else if (weaponType === 'shotgun') {
      // --- SHOTGUN PUMP BLAST ---
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.3);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);

      const noise = this.createNoiseBuffer(0.3);
      if (noise) {
        const src = this.ctx.createBufferSource();
        src.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        src.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.3);
      }

    } else {
      // --- AK-47 / M4A4 ASSAULT RIFLE BARK ---
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.14);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);

      const noise = this.createNoiseBuffer(0.18);
      if (noise) {
        const src = this.ctx.createBufferSource();
        src.buffer = noise;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(400, t + 0.18);
        filter.Q.value = 1.0;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.85, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        src.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.18);
      }
    }
  }

  // Classic CS:GO Headshot "DINK" metallic helmet ping + body hit tick
  public playHitMarker(isHeadshot: boolean = false) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (isHeadshot) {
      // Iconic CS:GO headshot helmet dink (resonant high metallic double ping)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2450, t);
      osc1.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
      gain1.gain.setValueAtTime(0.85, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.12);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(3200, t + 0.01);
      gain2.gain.setValueAtTime(0.6, t + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t + 0.01);
      osc2.stop(t + 0.15);
    } else {
      // Tactical body hitmark tick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.06);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  // Reload magazine slap & slide release
  public playReload() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Mag eject
    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(500, t);
    osc1.frequency.linearRampToValueAtTime(200, t + 0.08);
    g1.gain.setValueAtTime(0.2, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(g1);
    g1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.08);

    // Mag insert click (after 0.8s)
    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(700, t + 0.7);
    osc2.frequency.setValueAtTime(1100, t + 0.75);
    g2.gain.setValueAtTime(0.35, t + 0.7);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.start(t + 0.7);
    osc2.stop(t + 0.85);

    // Slide rack snap (after 1.2s)
    const osc3 = this.ctx.createOscillator();
    const g3 = this.ctx.createGain();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(1200, t + 1.2);
    osc3.frequency.exponentialRampToValueAtTime(400, t + 1.35);
    g3.gain.setValueAtTime(0.4, t + 1.2);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 1.35);
    osc3.connect(g3);
    g3.connect(this.masterGain);
    osc3.start(t + 1.2);
    osc3.stop(t + 1.35);
  }

  // Realistic Cobblestone Footstep
  public playFootstep(isSprinting: boolean = false) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.07);

    const vol = isSprinting ? 0.35 : 0.18;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  // Jump impulse
  public playJump() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(220, t + 0.1);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Damage grunt / armor deflect
  public playDamageHurt(isShield: boolean = false) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isShield) {
      // Kevlar vest hit thud
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    } else {
      // Flesh hit groan
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Kill chime
  public playKillChime() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const freqs = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6 triumphant chord
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.3, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.28);
    });
  }

  // UI Click
  public playClick() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.03);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // Legacy compat no-op methods
  public startJetpack() {}
  public stopJetpack() {}
  public startAmbientSynth() {}
  public stopAmbientSynth() {}
}

export const soundEngine = new SoundEngine();
