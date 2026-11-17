/**
 * Zero-dependency WebAudio procedural SFX & adaptive synth pulse music engine.
 * Gives crisp dopamine audio feedback on XP pickups, crits, level-ups, chests & purchases.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private soundOn = true;
  private musicOn = true;
  private musicTimer: number | null = null;
  private stepIdx = 0;
  private xpPitchStep = 0;
  private lastXpAt = 0;

  private ensureCtx(): AudioContext | null {
    if (!this.soundOn && !this.musicOn) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  configure(soundEnabled: boolean, musicEnabled: boolean): void {
    this.soundOn = soundEnabled;
    this.musicOn = musicEnabled;
    if (!musicEnabled) {
      this.stopMusicLoop();
    }
  }

  unlock(): void {
    this.ensureCtx();
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    endFreq?: number,
    delaySec = 0
  ): void {
    if (!this.soundOn) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  playTap(): void {
    this.playTone(540, 0.05, 'triangle', 0.07, 720);
  }

  playHit(isCrit = false): void {
    if (isCrit) {
      this.playTone(980, 0.07, 'sawtooth', 0.08, 420);
    } else {
      this.playTone(220, 0.045, 'triangle', 0.05, 110);
    }
  }

  playXpPickup(): void {
    const now = performance.now();
    if (now - this.lastXpAt < 260) {
      this.xpPitchStep = Math.min(14, this.xpPitchStep + 1);
    } else {
      this.xpPitchStep = 0;
    }
    this.lastXpAt = now;
    const scale = [523, 587, 659, 698, 784, 880, 988, 1046, 1175, 1318, 1397, 1568, 1760, 1976, 2093];
    const freq = scale[this.xpPitchStep] || 880;
    this.playTone(freq, 0.065, 'sine', 0.065, freq * 1.12);
  }

  playMagnetSweep(): void {
    this.playTone(320, 0.35, 'sine', 0.11, 1280);
    this.playTone(480, 0.32, 'triangle', 0.08, 1600, 0.05);
  }

  playDash(): void {
    this.playTone(460, 0.14, 'sawtooth', 0.09, 140);
  }

  playUltimate(): void {
    this.playTone(180, 0.45, 'sawtooth', 0.14, 720);
    this.playTone(540, 0.45, 'triangle', 0.12, 1440, 0.04);
  }

  playLevelUp(): void {
    this.playTone(523, 0.11, 'triangle', 0.12, 523, 0);
    this.playTone(659, 0.11, 'triangle', 0.12, 659, 0.07);
    this.playTone(784, 0.14, 'triangle', 0.13, 784, 0.14);
    this.playTone(1046, 0.25, 'sine', 0.14, 1120, 0.21);
  }

  playEvoUnlock(): void {
    const notes = [523, 659, 784, 1046, 1318, 1568];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.16, 'sawtooth', 0.11, n * 1.04, idx * 0.055);
    });
  }

  playBossWarning(): void {
    this.playTone(160, 0.22, 'sawtooth', 0.13, 110, 0);
    this.playTone(160, 0.22, 'sawtooth', 0.13, 110, 0.28);
    this.playTone(190, 0.32, 'sawtooth', 0.15, 95, 0.56);
  }

  playChestJackpot(): void {
    const arp = [587, 740, 880, 1175, 1480];
    arp.forEach((n, idx) => {
      this.playTone(n, 0.15, 'triangle', 0.12, n, idx * 0.07);
    });
  }

  playPurchaseSuccess(): void {
    this.playTone(988, 0.09, 'sine', 0.13, 988, 0);
    this.playTone(1319, 0.24, 'sine', 0.15, 1319, 0.08);
    this.playTone(1976, 0.22, 'triangle', 0.1, 1976, 0.14);
  }

  startMusicLoop(): void {
    if (!this.musicOn || this.musicTimer !== null) return;
    this.ensureCtx();
    const bassSeq = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    this.musicTimer = window.setInterval(() => {
      if (!this.musicOn || !this.ctx || this.ctx.state !== 'running') return;
      const note = bassSeq[this.stepIdx % bassSeq.length];
      this.stepIdx++;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.038, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    }, 240);
  }

  stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioEngine();
