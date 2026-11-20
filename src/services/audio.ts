import { WeaponId } from '../types/game';

/**
 * Zero-dependency WebAudio lookahead synthwave sequencer & layered weapon SFX engine.
 * Features kick/snare/hi-hat drums, resonant sawtooth bass, arpeggio lead, and a boss intensity layer.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private soundOn = true;
  private musicOn = true;
  private musicActive = false;
  private musicPaused = false;
  private bossIntensity = false;

  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private stepIdx = 0;

  private xpPitchStep = 0;
  private lastXpAt = 0;
  private lastHitAt = 0;
  private lastXpSoundAt = 0;
  private lastWeaponSfxAt = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.setMusicPaused(true);
        } else if (this.musicActive && !this.musicPaused) {
          this.ensureCtx();
        }
      });
    }
  }

  private ensureCtx(): AudioContext | null {
    if (!this.soundOn && !this.musicOn) return null;
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => undefined);
      }
      if (!this.noiseBuffer) {
        const len = Math.floor(this.ctx.sampleRate * 0.25);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buf;
      }
      return this.ctx;
    } catch {
      return null;
    }
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

  setBossIntensity(active: boolean): void {
    this.bossIntensity = active;
  }

  setMusicPaused(paused: boolean): void {
    this.musicPaused = paused;
    if (!this.ctx) return;
    if (paused) {
      if (this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => undefined);
      }
    } else if (this.musicActive && this.musicOn) {
      void this.ctx.resume().catch(() => undefined);
      this.nextStepTime = this.ctx.currentTime + 0.05;
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.11,
    endFreq?: number,
    delaySec = 0
  ): void {
    if (!this.soundOn) return;
    const ctx = this.ensureCtx();
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(24, freq), now);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), now + durationSec);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Ignore audio scheduling errors
    }
  }

  private playNoise(durationSec: number, filterFreq: number, filterType: BiquadFilterType, volume: number, time?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || ctx.state !== 'running') return;
    try {
      const t = time ?? ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0005, volume), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      src.stop(t + durationSec + 0.02);
    } catch {
      // Ignore
    }
  }

  playTap(): void {
    this.playTone(580, 0.045, 'triangle', 0.065, 760);
  }

  playDodge(): void {
    this.playTone(720, 0.09, 'sine', 0.08, 1320);
    this.playTone(1040, 0.08, 'triangle', 0.05, 1560, 0.03);
  }

  playWeaponSfx(weaponId: WeaponId): void {
    if (!this.soundOn) return;
    const now = performance.now();
    if (now - this.lastWeaponSfxAt < 65) return;
    this.lastWeaponSfxAt = now;

    switch (weaponId) {
      case 'plasma_blade':
        this.playTone(420, 0.09, 'sawtooth', 0.048, 160);
        if (this.ctx) this.playNoise(0.06, 2200, 'bandpass', 0.035);
        break;
      case 'arcane_staff':
        this.playTone(620, 0.11, 'sine', 0.055, 980);
        this.playTone(930, 0.08, 'triangle', 0.035, 520, 0.02);
        break;
      case 'star_bow':
        this.playTone(880, 0.07, 'triangle', 0.05, 340);
        break;
      case 'orbital_turret':
        this.playTone(1240, 0.055, 'square', 0.032, 680);
        break;
      case 'solar_lance':
        this.playTone(310, 0.14, 'sawtooth', 0.055, 760);
        if (this.ctx) this.playNoise(0.09, 1400, 'bandpass', 0.035);
        break;
      case 'pulse_rifle':
        this.playTone(960, 0.05, 'square', 0.03, 420);
        break;
      case 'tesla_arc':
        this.playTone(1480, 0.08, 'sawtooth', 0.045, 520);
        if (this.ctx) this.playNoise(0.07, 4200, 'highpass', 0.032);
        break;
      case 'frost_nova':
        this.playTone(1180, 0.18, 'sine', 0.06, 1760);
        this.playTone(880, 0.18, 'triangle', 0.04, 440, 0.02);
        break;
      case 'inferno_drone':
        this.playTone(360, 0.08, 'sawtooth', 0.04, 620);
        break;
      case 'gravity_well':
        this.playTone(140, 0.22, 'sine', 0.07, 68);
        break;
      case 'vamp_scythe':
        this.playTone(540, 0.11, 'triangle', 0.05, 290);
        break;
      default:
        break;
    }
  }

  playHit(isCrit = false): void {
    const now = performance.now();
    if (now - this.lastHitAt < (isCrit ? 28 : 52)) return;
    this.lastHitAt = now;
    if (isCrit) {
      this.playTone(1040, 0.07, 'sawtooth', 0.065, 440);
      this.playTone(1560, 0.05, 'triangle', 0.045, 1980, 0.015);
    } else {
      this.playTone(210, 0.04, 'triangle', 0.038, 105);
    }
  }

  playXpPickup(): void {
    const now = performance.now();
    if (now - this.lastXpSoundAt < 34) return;
    this.lastXpSoundAt = now;
    if (now - this.lastXpAt < 260) {
      this.xpPitchStep = Math.min(14, this.xpPitchStep + 1);
    } else {
      this.xpPitchStep = 0;
    }
    this.lastXpAt = now;
    const scale = [523, 587, 659, 698, 784, 880, 988, 1046, 1175, 1318, 1397, 1568, 1760, 1976, 2093];
    const freq = scale[this.xpPitchStep] || 880;
    this.playTone(freq, 0.06, 'sine', 0.052, freq * 1.12);
  }

  playMagnetSweep(): void {
    this.playTone(320, 0.34, 'sine', 0.1, 1280);
    this.playTone(480, 0.3, 'triangle', 0.075, 1600, 0.05);
  }

  playDash(): void {
    this.playTone(480, 0.13, 'sawtooth', 0.08, 150);
    if (this.soundOn && this.ctx) this.playNoise(0.1, 2400, 'highpass', 0.045);
  }

  playUltimate(): void {
    this.playTone(160, 0.48, 'sawtooth', 0.13, 760);
    this.playTone(540, 0.45, 'triangle', 0.11, 1480, 0.04);
    if (this.soundOn && this.ctx) this.playNoise(0.22, 900, 'lowpass', 0.08);
  }

  playShrineTick(progressFrac: number): void {
    const freq = 440 + progressFrac * 660;
    this.playTone(freq, 0.07, 'sine', 0.05, freq * 1.06);
  }

  playRelicUnlock(): void {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.2, 'triangle', 0.11, n * 1.02, idx * 0.065);
    });
  }

  playLevelUp(): void {
    this.playTone(523, 0.11, 'triangle', 0.11, 523, 0);
    this.playTone(659, 0.11, 'triangle', 0.11, 659, 0.065);
    this.playTone(784, 0.14, 'triangle', 0.12, 784, 0.13);
    this.playTone(1046, 0.25, 'sine', 0.13, 1120, 0.2);
  }

  playEvoUnlock(): void {
    const notes = [523, 659, 784, 1046, 1318, 1568];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.18, 'sawtooth', 0.095, n * 1.03, idx * 0.055);
    });
  }

  playBossWarning(): void {
    this.playTone(150, 0.22, 'sawtooth', 0.13, 105, 0);
    this.playTone(150, 0.22, 'sawtooth', 0.13, 105, 0.28);
    this.playTone(195, 0.34, 'sawtooth', 0.15, 92, 0.56);
  }

  playChestJackpot(): void {
    const arp = [587, 740, 880, 1175, 1480];
    arp.forEach((n, idx) => {
      this.playTone(n, 0.15, 'triangle', 0.11, n, idx * 0.065);
    });
  }

  playPurchaseSuccess(): void {
    this.playTone(988, 0.09, 'sine', 0.11, 988, 0);
    this.playTone(1319, 0.22, 'sine', 0.13, 1319, 0.075);
    this.playTone(1976, 0.2, 'triangle', 0.09, 1976, 0.13);
  }

  // ---- WebAudio Lookahead Synthwave Sequencer (128 BPM, 16th notes) ----

  private scheduleKick(t: number, accent = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    gain.gain.setValueAtTime(0.095 * accent, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private scheduleSnare(t: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.playNoise(0.12, 1800, 'bandpass', 0.045, t);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(115, t + 0.08);
    gain.gain.setValueAtTime(0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  private scheduleHiHat(t: number, open = false): void {
    this.playNoise(open ? 0.08 : 0.03, 7200, 'highpass', open ? 0.022 : 0.014, t);
  }

  private scheduleBass(t: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.bossIntensity ? 740 : 480, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + dur);
    filter.Q.setValueAtTime(3.2, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(this.bossIntensity ? 0.046 : 0.036, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private scheduleArp(t: number, freq: number, dur: number, vol = 0.022): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = this.bossIntensity ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.bossIntensity ? 2600 : 1800, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private scheduleStep(step: number, t: number): void {
    // 4-bar chord progression (64 sixteenth-note steps): Am -> F -> C -> G (in Hz)
    const bar = Math.floor((step % 64) / 16);
    const stepInBar = step % 16;

    const bassRoots = [55.0, 43.65, 65.41, 49.0]; // A1, F1, C2, G1
    const arpChords = [
      [220.0, 261.63, 329.63, 440.0], // Am
      [174.61, 220.0, 261.63, 349.23], // F
      [261.63, 329.63, 392.0, 523.25], // C
      [196.0, 246.94, 293.66, 392.0], // G
    ];
    const root = bassRoots[bar];
    const chord = arpChords[bar];

    // Drums: Four-on-the-floor kick, snare on 4 & 12, crisp hats
    if (stepInBar % 4 === 0) {
      this.scheduleKick(t, stepInBar === 0 ? 1.08 : 0.92);
    }
    if (stepInBar === 4 || stepInBar === 12) {
      this.scheduleSnare(t);
    }
    if (this.bossIntensity) {
      this.scheduleHiHat(t, stepInBar % 4 === 2);
      if (stepInBar === 14) this.scheduleKick(t, 0.72);
    } else if (stepInBar % 2 === 0) {
      this.scheduleHiHat(t, stepInBar % 4 === 2);
    }

    // Driving 8th-note synthwave bassline with octave bounce
    if (stepInBar % 2 === 0) {
      const oct = stepInBar % 4 === 2 ? 2 : 1;
      this.scheduleBass(t, root * oct, 0.16);
    }

    // Arpeggio lead
    const arpNote = chord[stepInBar % 4];
    if (stepInBar % 2 === 1 || this.bossIntensity) {
      const mult = this.bossIntensity && stepInBar % 4 === 3 ? 2 : 1;
      this.scheduleArp(t, arpNote * mult, 0.13, this.bossIntensity ? 0.025 : 0.019);
    }
  }

  startMusicLoop(): void {
    this.musicActive = true;
    this.musicPaused = false;
    if (!this.musicOn || this.schedulerId !== null) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;

    this.nextStepTime = ctx.currentTime + 0.06;
    const stepDurSec = 60 / 128 / 4; // 128 BPM 16th-note (~117ms)

    this.schedulerId = window.setInterval(() => {
      if (!this.musicOn || !this.musicActive || this.musicPaused || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const lookahead = 0.14;
      if (this.nextStepTime < this.ctx.currentTime - 0.25) {
        this.nextStepTime = this.ctx.currentTime + 0.04;
      }
      while (this.nextStepTime < this.ctx.currentTime + lookahead) {
        this.scheduleStep(this.stepIdx, this.nextStepTime);
        this.stepIdx = (this.stepIdx + 1) % 64;
        this.nextStepTime += stepDurSec;
      }
    }, 35);
  }

  stopMusicLoop(): void {
    this.musicActive = false;
    this.bossIntensity = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }
}

export const audio = new AudioEngine();
