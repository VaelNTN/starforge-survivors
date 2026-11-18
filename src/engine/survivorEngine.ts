import { GEAR_TEMPLATES, HEROES, PASSIVES, WEAPONS, WEAPON_STYLES } from '../data/gameCatalog';
import { audio } from '../services/audio';
import {
  ActiveRunBoosters,
  ChapterDef,
  CombatStats,
  HeroDef,
  PassiveId,
  Rarity,
  WeaponId,
  WeaponStyle,
} from '../types/game';
import { createGearItem } from '../storage/saveState';

export interface DraftOption {
  kind: 'weapon' | 'passive' | 'evo' | 'heal_coins';
  id: string;
  name: string;
  subtitle: string;
  currentLv: number;
  nextLv: number;
  color: string;
  isEvo?: boolean;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  level: number;
  xpFrac: number;
  elapsedSec: number;
  durationSec: number;
  isEndless: boolean;
  isBossRush: boolean;
  bossRushStage: number;
  kills: number;
  combo: number;
  threatLevel: number;
  enemyPowerPct: number;
  coins: number;
  gems: number;
  ultCharge: number; // 0..100
  dashReadyFrac: number; // 0..1
  bossName: string | null;
  bossHpFrac: number;
  weapons: { id: WeaponId; lv: number; evolved: boolean }[];
  passives: { id: PassiveId; lv: number }[];
}

interface Enemy {
  id: number;
  kind: 'swarmer' | 'dasher' | 'sentinel' | 'spitter' | 'splitter' | 'goblin' | 'elite' | 'boss';
  tier: 0 | 1 | 2; // 0 = normaal, 1 = Versterkt, 2 = Apex Mutant
  animSeed: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  color: string;
  xpValue: number;
  hitFlash: number;
  slowTimer: number;
  shootTimer: number;
  bossPatternTimer: number;
}

interface Projectile {
  fromEnemy: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  life: number;
  maxLife: number;
  color: string;
  explosive?: boolean;
  boomerang?: boolean;
  vampiric?: boolean;
  homing?: boolean;
  isArrow?: boolean;
  isMagicOrb?: boolean;
  hitIds: Set<number>;
}

interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  radius: number;
  spread: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightningArc {
  points: { x: number; y: number }[];
  color: string;
  life: number;
}

interface RingWave {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface GravityZone {
  x: number;
  y: number;
  radius: number;
  damagePerSec: number;
  color: string;
  life: number;
  tickAccum: number;
}

interface Pickup {
  kind: 'xp_s' | 'xp_m' | 'xp_l' | 'coin' | 'gem' | 'heal' | 'magnet' | 'bomb' | 'chest';
  x: number;
  y: number;
  val: number;
  magnetized: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  scale: number;
}

export interface EngineCallbacks {
  onHud: (snap: HudSnapshot) => void;
  onLevelUp: (choices: DraftOption[]) => void;
  onChestJackpot: (rewards: DraftOption[], bonusCoins: number) => void;
  onBossBanner: (bossName: string) => void;
  onWaveBanner: (message: string) => void;
  onDeathOffer: (canFreeAd: boolean) => void;
  onFinish: (result: {
    victory: boolean;
    survivedSec: number;
    kills: number;
    bossesKilled: number;
    coinsEarned: number;
    gemsEarned: number;
    blueprintsEarned: number;
    levelReached: number;
    evolutionsUnlocked: string[];
    evoIdsUnlocked: WeaponId[];
    maxCombo: number;
    newGearDrop: ReturnType<typeof createGearItem> | null;
  }) => void;
}

const BOSS_RUSH_NAMES = [
  'Dread-Mech Mk.I',
  'Scorpio Colossus',
  'Glacier Sovereign',
  'Inferno Behemoth',
  'Omega Overlord',
];

export class SurvivorEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chapter: ChapterDef;
  private hero: HeroDef;
  private weaponStyle: WeaponStyle;
  private stats: CombatStats;
  private boosters: ActiveRunBoosters;
  private damageNumbers: boolean;
  private vibration: boolean;
  private cb: EngineCallbacks;

  private rafId: number | null = null;
  private victoryTimer: number | null = null;
  private lastTs = 0;
  private paused = false;
  private ended = false;
  private hudAccum = 0;

  // Player state in world coordinates
  private px = 0;
  private py = 0;
  private facingAngle = 0;
  private weaponAimAngle = 0;
  private walkPhase = 0;
  private isMoving = false;
  private attackAnimTimer = 0;
  private attackAnimDuration = 0.28;
  private hp: number;
  private level = 1;
  private xp = 0;
  private xpNext = 24;
  private invulnTimer = 0;
  private dashTimer = 0;
  private dashCd = 0;
  private dashMaxCd = 3.0;
  private dashVx = 0;
  private dashVy = 0;
  private ultCharge = 35;

  private elapsedSec = 0;
  private threatLevel = 1;
  private lastSurgeSec = 0;
  private kills = 0;
  private comboCount = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private bossesKilled = 0;
  private coinsEarned = 0;
  private gemsEarned = 0;
  private revivesLeft: number;
  private usedAdRevive = false;
  private screenShake = 0;

  // Loadout
  private weapons = new Map<WeaponId, { lv: number; cd: number; evolved: boolean }>();
  private passives = new Map<PassiveId, number>();
  private evosUnlocked: string[] = [];
  private evoIdsUnlocked: WeaponId[] = [];
  private orbitalAngle = 0;

  // Entities
  private nextEnemyId = 1;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private slashes: SlashEffect[] = [];
  private lightnings: LightningArc[] = [];
  private rings: RingWave[] = [];
  private gravZones: GravityZone[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private afterimages: { x: number; y: number; life: number; angle: number }[] = [];
  private ambientMotes: { rx: number; ry: number; vx: number; vy: number; size: number; alpha: number }[] = [];

  private spawnAccum = 0;
  private eliteSpawnedMin = new Set<number>();
  private bossSpawned = false;
  private activeBossId: number | null = null;
  private activeBossLabel: string | null = null;
  private bossRushStage = 0;
  private bossRushCooldown = 2.0;

  // Input state
  private keys = new Set<string>();
  private activePointerId: number | null = null;
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurX = 0;
  private touchCurY = 0;
  private joyX = 0;
  private joyY = 0;

  private width = 390;
  private height = 780;
  private dpr = 1;

  constructor(
    canvas: HTMLCanvasElement,
    chapter: ChapterDef,
    heroId: HeroDef['id'],
    weaponStyle: WeaponStyle,
    stats: CombatStats,
    damageNumbers: boolean,
    vibration: boolean,
    boosters: ActiveRunBoosters,
    cb: EngineCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D context unavailable');
    this.ctx = context;
    this.chapter = chapter;
    this.hero = HEROES.find((h) => h.id === heroId) || HEROES[0];
    this.weaponStyle = weaponStyle;
    this.stats = boosters.overdriveAtk ? { ...stats, atk: Math.round(stats.atk * 1.25) } : stats;
    this.boosters = boosters;
    this.damageNumbers = damageNumbers;
    this.vibration = vibration;
    this.cb = cb;

    this.hp = this.stats.maxHp;
    this.revivesLeft = this.stats.revives;
    const styleDef = WEAPON_STYLES.find((s) => s.id === weaponStyle) || WEAPON_STYLES[0];
    this.weapons.set(styleDef.weaponId, { lv: 1, cd: 0.2, evolved: false });

    if (boosters.extraWeapon) {
      const others = WEAPONS.filter((w) => w.id !== styleDef.weaponId);
      const bonusW = others[Math.floor(Math.random() * others.length)];
      if (bonusW) {
        this.weapons.set(bonusW.id, { lv: 1, cd: 0.35, evolved: false });
      }
    }

    if (chapter.mode === 'boss_rush') {
      // Give starter level-up boost in Boss Rush so the fight feels immediately intense
      this.xp = this.xpNext;
    }

    for (let i = 0; i < 28; i++) {
      this.ambientMotes.push({
        rx: Math.random(),
        ry: Math.random(),
        vx: (Math.random() - 0.5) * 0.025,
        vy: -0.015 - Math.random() * 0.025,
        size: 1.4 + Math.random() * 2.4,
        alpha: 0.18 + Math.random() * 0.42,
      });
    }

    this.resize();
    this.bindInput();
  }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private resetInputState = () => {
    this.keys.clear();
    this.activePointerId = null;
    this.touchActive = false;
    this.joyX = 0;
    this.joyY = 0;
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.resetInputState();
    } else {
      this.lastTs = performance.now();
    }
  };

  private onOrientationChange = () => {
    window.setTimeout(() => this.resize(), 80);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.paused || this.ended) return;
    if (this.activePointerId !== null) return;
    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    // Deadzone over bottom-right Dash / Ultimate controls (170x170px)
    if (localX >= rect.width - 170 && localY >= rect.height - 170) {
      return;
    }
    audio.unlock();
    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    this.touchActive = true;
    this.touchStartX = localX;
    this.touchStartY = localY;
    this.touchCurX = localX;
    this.touchCurY = localY;
    this.updateJoystickVector();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.touchActive || e.pointerId !== this.activePointerId) return;
    const rect = this.canvas.getBoundingClientRect();
    this.touchCurX = e.clientX - rect.left;
    this.touchCurY = e.clientY - rect.top;
    this.updateJoystickVector();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    if (this.activePointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture(this.activePointerId)) {
          this.canvas.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Ignore release errors
      }
    }
    this.activePointerId = null;
    this.touchActive = false;
    this.joyX = 0;
    this.joyY = 0;
  };

  private updateJoystickVector(): void {
    const dx = this.touchCurX - this.touchStartX;
    const dy = this.touchCurY - this.touchStartY;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      this.joyX = 0;
      this.joyY = 0;
      return;
    }
    const maxR = 52;
    const clamped = Math.min(maxR, dist) / maxR;
    this.joyX = (dx / dist) * clamped;
    this.joyY = (dy / dist) * clamped;
  }

  private bindInput(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.resetInputState);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerleave', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.onOrientationChange);
  }

  resize = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = dpr;
    this.width = Math.max(320, rect.width || window.innerWidth);
    this.height = Math.max(480, rect.height || window.innerHeight);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  start(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTs = performance.now();
    audio.startMusicLoop();
    const tick = (now: number) => {
      if (this.ended) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
      this.lastTs = now;
      if (!this.paused) {
        this.update(dt);
      }
      if (this.ended) {
        this.rafId = null;
        return;
      }
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  destroy(): void {
    this.ended = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.victoryTimer !== null) {
      window.clearTimeout(this.victoryTimer);
      this.victoryTimer = null;
    }
    audio.stopMusicLoop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.resetInputState);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.onOrientationChange);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.resetInputState();
    } else {
      this.lastTs = performance.now();
    }
  }

  getLoadoutSnapshot(): {
    weapons: { id: WeaponId; lv: number; evolved: boolean }[];
    passives: { id: PassiveId; lv: number }[];
  } {
    return {
      weapons: Array.from(this.weapons.entries()).map(([id, s]) => ({ id, lv: s.lv, evolved: s.evolved })),
      passives: Array.from(this.passives.entries()).map(([id, lv]) => ({ id, lv })),
    };
  }

  triggerDash(): void {
    if (this.paused || this.ended || this.dashCd > 0) return;
    const speedMult = 1 + (this.passives.get('dark_matter') || 0) * 0.09;
    this.dashMaxCd = Math.max(1.5, 3.0 / speedMult);
    this.dashCd = this.dashMaxCd;
    this.dashTimer = 0.2;
    this.invulnTimer = Math.max(this.invulnTimer, 0.36);
    const angle = this.facingAngle;
    this.dashVx = Math.cos(angle) * 640;
    this.dashVy = Math.sin(angle) * 640;
    audio.playDash();
    this.spawnRing(this.px, this.py, 58, this.hero.accentColor, 0.26);
    for (let i = 0; i < 10; i++) {
      const spread = angle + Math.PI + (Math.random() - 0.5) * 0.9;
      const spd = 70 + Math.random() * 140;
      this.spawnParticle(this.px, this.py, Math.cos(spread) * spd, Math.sin(spread) * spd, 3.2, this.hero.accentColor, 0.28);
    }
  }

  triggerUltimate(): void {
    if (this.paused || this.ended || this.ultCharge < 100) return;
    this.ultCharge = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 1.0);
    this.screenShake = 12;
    audio.playUltimate();
    if (this.vibration && navigator.vibrate) navigator.vibrate([40, 30, 70]);

    const baseUltDmg = this.stats.atk * 5.8;

    if (this.hero.id === 'titan') {
      const maxHp = this.getEffectiveMaxHp();
      this.hp = Math.min(maxHp, this.hp + Math.round(maxHp * 0.4));
      this.spawnRing(this.px, this.py, 280, '#f59e0b', 0.45);
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 290) {
          this.damageEnemy(e, baseUltDmg * 1.15, true);
          const ang = Math.atan2(e.y - this.py, e.x - this.px);
          e.x += Math.cos(ang) * 75;
          e.y += Math.sin(ang) * 75;
        }
      }
    } else if (this.hero.id === 'nova') {
      this.spawnRing(this.px, this.py, 220, '#a855f7', 0.35);
      const targets = [...this.enemies].slice(0, 18);
      for (const e of targets) {
        this.lightnings.push({
          points: [
            { x: e.x + (Math.random() - 0.5) * 30, y: e.y - 260 },
            { x: e.x + (Math.random() - 0.5) * 20, y: e.y - 120 },
            { x: e.x, y: e.y },
          ],
          color: '#e879f9',
          life: 0.28,
        });
        this.damageEnemy(e, baseUltDmg * 1.25, true);
      }
    } else if (this.hero.id === 'vespera') {
      this.spawnRing(this.px, this.py, 320, '#f43f5e', 0.5);
      let healed = 0;
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 340) {
          e.x += (this.px - e.x) * 0.45;
          e.y += (this.py - e.y) * 0.45;
          this.damageEnemy(e, baseUltDmg * 1.1, true);
          healed += 2;
        }
      }
      this.hp = Math.min(this.getEffectiveMaxHp(), this.hp + Math.min(80, healed));
    } else {
      // Kael Omnislash Nova
      this.spawnRing(this.px, this.py, 290, '#38bdf8', 0.45);
      this.slashes.push({
        x: this.px,
        y: this.py,
        angle: 0,
        radius: 230,
        spread: Math.PI * 2,
        color: '#38bdf8',
        life: 0.32,
        maxLife: 0.32,
      });
      for (const e of [...this.enemies]) {
        if (Math.hypot(e.x - this.px, e.y - this.py) < 285) {
          this.damageEnemy(e, baseUltDmg * 1.2, true);
        }
      }
    }

    this.emitHud();
  }

  buildDraftOptions(): DraftOption[] {
    const pool: DraftOption[] = [];

    // 1. Check evolutions first (Weapon lv 5 + matching passive >= 1)
    for (const [wId, state] of this.weapons.entries()) {
      const def = WEAPONS.find((w) => w.id === wId);
      if (!def || state.evolved || state.lv < def.maxLevel) continue;
      if ((this.passives.get(def.evoPassive) || 0) >= 1) {
        pool.push({
          kind: 'evo',
          id: wId,
          name: def.evoName,
          subtitle: `EVOLUTIE! ${def.evoDesc}`,
          currentLv: 5,
          nextLv: 6,
          color: '#fbbf24',
          isEvo: true,
        });
      }
    }

    // 2. Existing weapons upgrade or new weapons (cap 5 weapons)
    for (const w of WEAPONS) {
      const st = this.weapons.get(w.id);
      if (st) {
        if (!st.evolved && st.lv < w.maxLevel) {
          pool.push({
            kind: 'weapon',
            id: w.id,
            name: w.name,
            subtitle: w.shortDesc,
            currentLv: st.lv,
            nextLv: st.lv + 1,
            color: w.color,
          });
        }
      } else if (this.weapons.size < 5) {
        pool.push({
          kind: 'weapon',
          id: w.id,
          name: w.name,
          subtitle: `NIEUW: ${w.shortDesc}`,
          currentLv: 0,
          nextLv: 1,
          color: w.color,
        });
      }
    }

    // 3. Passives (cap 5 passives)
    for (const p of PASSIVES) {
      const lv = this.passives.get(p.id) || 0;
      if (lv > 0 && lv < p.maxLevel) {
        pool.push({
          kind: 'passive',
          id: p.id,
          name: p.name,
          subtitle: p.perLevelLabel,
          currentLv: lv,
          nextLv: lv + 1,
          color: p.color,
        });
      } else if (lv === 0 && this.passives.size < 5) {
        pool.push({
          kind: 'passive',
          id: p.id,
          name: p.name,
          subtitle: `NIEUW: ${p.perLevelLabel}`,
          currentLv: 0,
          nextLv: 1,
          color: p.color,
        });
      }
    }

    // Shuffle and prioritize at least 1 evo if available
    const evos = pool.filter((o) => o.isEvo);
    const others = pool.filter((o) => !o.isEvo).sort(() => Math.random() - 0.5);
    const picked = [...evos, ...others].slice(0, 3);

    while (picked.length < 3) {
      picked.push({
        kind: 'heal_coins',
        id: 'heal_gold',
        name: 'Nano-Herstel & Gold',
        subtitle: 'Herstel +35% HP & pak +150 Gold',
        currentLv: 0,
        nextLv: 1,
        color: '#10b981',
      });
    }
    return picked;
  }

  private checkPendingLevelUp(): boolean {
    if (this.xp >= this.xpNext && !this.paused && !this.ended) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = Math.round(24 + this.level * 15 + Math.pow(this.level, 1.35) * 4);
      audio.playLevelUp();
      this.setPaused(true);
      this.emitHud();
      this.cb.onLevelUp(this.buildDraftOptions());
      return true;
    }
    return false;
  }

  applyDraftOption(opt: DraftOption): void {
    if (opt.kind === 'evo') {
      const wId = opt.id as WeaponId;
      const st = this.weapons.get(wId);
      if (st) {
        st.evolved = true;
        st.lv = 6;
        if (!this.evosUnlocked.includes(opt.name)) this.evosUnlocked.push(opt.name);
        if (!this.evoIdsUnlocked.includes(wId)) this.evoIdsUnlocked.push(wId);
        audio.playEvoUnlock();
      }
    } else if (opt.kind === 'weapon') {
      const wId = opt.id as WeaponId;
      const st = this.weapons.get(wId);
      if (st) st.lv += 1;
      else this.weapons.set(wId, { lv: 1, cd: 0.15, evolved: false });
    } else if (opt.kind === 'passive') {
      const pId = opt.id as PassiveId;
      this.passives.set(pId, (this.passives.get(pId) || 0) + 1);
      if (pId === 'cryo_reactor') {
        const effMax = this.getEffectiveMaxHp();
        this.hp = Math.min(effMax, this.hp + Math.round(this.stats.maxHp * 0.18));
      }
    } else {
      this.hp = Math.min(this.getEffectiveMaxHp(), this.hp + Math.round(this.getEffectiveMaxHp() * 0.35));
      this.coinsEarned += 150;
    }

    this.setPaused(false);
    this.emitHud();
    this.checkPendingLevelUp();
  }

  revivePlayer(): void {
    if (this.revivesLeft > 0) this.revivesLeft -= 1;
    else this.usedAdRevive = true;

    this.hp = this.getEffectiveMaxHp();
    this.invulnTimer = 2.8;
    this.screenShake = 10;
    this.spawnRing(this.px, this.py, 260, '#10b981', 0.45);
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < 240 && e.kind !== 'boss') {
        const ang = Math.atan2(e.y - this.py, e.x - this.px);
        e.x += Math.cos(ang) * 180;
        e.y += Math.sin(ang) * 180;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.fromEnemy);
    this.setPaused(false);
    this.emitHud();
  }

  abortAndFinish(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    if (this.victoryTimer !== null) {
      window.clearTimeout(this.victoryTimer);
      this.victoryTimer = null;
    }
    audio.stopMusicLoop();

    const luckMult = this.boosters.doubleLuck ? 1.5 : 1.0;
    const bonusCoins = victory ? this.chapter.rewardCoins : Math.round(this.elapsedSec * 6);
    const bonusGems = victory ? this.chapter.rewardGems : Math.floor(this.elapsedSec / 45) * 3;
    const totalCoins = Math.round((this.coinsEarned + bonusCoins) * this.stats.goldMult * luckMult);
    const totalGems = this.gemsEarned + bonusGems;
    const blueprints = Math.max(1, Math.floor(this.bossesKilled * 3 + this.elapsedSec / 35 + (victory ? 6 : 0)));

    let gearDrop: ReturnType<typeof createGearItem> | null = null;
    if (victory || this.bossesKilled >= 1 || this.elapsedSec >= 90) {
      const tpl = GEAR_TEMPLATES[Math.floor(Math.random() * GEAR_TEMPLATES.length)];
      let rarity: Rarity = 'common';
      const r = Math.random();
      const rareThresh = this.boosters.doubleLuck ? 0.42 : 0.25;
      if (victory && r < 0.05 && this.boosters.doubleLuck) rarity = 'epic';
      else if (victory && r < rareThresh) rarity = 'rare';
      else if (r < 0.48 || victory) rarity = 'uncommon';
      gearDrop = createGearItem(tpl.templateId, rarity, 1);
    }

    this.cb.onFinish({
      victory,
      survivedSec: Math.floor(this.elapsedSec),
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      coinsEarned: totalCoins,
      gemsEarned: totalGems,
      blueprintsEarned: blueprints,
      levelReached: this.level,
      evolutionsUnlocked: this.evosUnlocked,
      evoIdsUnlocked: this.evoIdsUnlocked,
      maxCombo: this.maxCombo,
      newGearDrop: gearDrop,
    });
  }

  private getEffectiveMaxHp(): number {
    const lv = this.passives.get('cryo_reactor') || 0;
    return Math.round(this.stats.maxHp * (1 + lv * 0.18));
  }

  private getCooldownMult(): number {
    const lv = this.passives.get('chrono_core') || 0;
    return Math.max(0.35, this.stats.cooldownMult * (1 - lv * 0.08));
  }

  private getDamageMult(): number {
    const lv = this.passives.get('overclock_chip') || 0;
    return 1 + lv * 0.13;
  }

  private getAreaMult(): number {
    const lv = this.passives.get('fusion_cell') || 0;
    return 1 + lv * 0.15;
  }

  private getPickupRadius(): number {
    const lv = this.passives.get('magnet_halo') || 0;
    const base = this.stats.pickupRadius * (this.boosters.doubleLuck ? 1.35 : 1);
    return Math.round(base * (1 + lv * 0.35));
  }

  private getEnemyPowerPct(): number {
    const scale = (1 + this.elapsedSec * 0.022) * Math.pow(1.18, this.threatLevel - 1);
    return Math.round(scale * 100);
  }

  private update(dt: number): void {
    this.elapsedSec += dt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCd > 0) this.dashCd = Math.max(0, this.dashCd - dt);
    if (this.attackAnimTimer > 0) this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Progressive Threat / Wave Escalation every 25s
    const computedThreat =
      this.chapter.mode === 'boss_rush'
        ? Math.max(1, this.bossRushStage + 1)
        : Math.floor(this.elapsedSec / 25) + 1;
    if (computedThreat > this.threatLevel) {
      this.threatLevel = computedThreat;
      const pct = this.getEnemyPowerPct();
      this.cb.onWaveBanner(`⚠️ WAVE ${this.threatLevel}: Enemies are now ${pct}% stronger & faster!`);
    }

    if (
      this.chapter.mode !== 'boss_rush' &&
      this.elapsedSec >= 40 &&
      this.elapsedSec - this.lastSurgeSec >= 45
    ) {
      this.lastSurgeSec = this.elapsedSec;
      this.spawnHordeSurge();
    }

    if (this.checkPendingLevelUp()) return;

    // Passive HP Regen
    const regen = this.stats.hpRegenPerSec + (this.passives.get('blood_ruby') || 0) * 1.5;
    const maxHp = this.getEffectiveMaxHp();
    if (this.hp < maxHp) {
      this.hp = Math.min(maxHp, this.hp + regen * dt);
    }

    // Player movement
    let mx = this.joyX;
    let my = this.joyY;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('shift')) this.triggerDash();
    if (this.keys.has(' ')) this.triggerUltimate();

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.px += this.dashVx * dt;
      this.py += this.dashVy * dt;
      this.isMoving = true;
      this.walkPhase += dt * 18;
      if (this.afterimages.length < 18) {
        this.afterimages.push({ x: this.px, y: this.py, life: 0.24, angle: this.facingAngle });
      }
    } else if (len > 0.04) {
      const spdMult = 1 + (this.passives.get('dark_matter') || 0) * 0.09;
      const spd = this.stats.moveSpeed * spdMult;
      this.px += mx * spd * dt;
      this.py += my * spd * dt;
      this.facingAngle = Math.atan2(my, mx);
      if (this.attackAnimTimer <= 0) this.weaponAimAngle = this.facingAngle;
      this.isMoving = true;
      this.walkPhase += dt * 13;
    } else {
      this.isMoving = false;
    }

    // Drift ambient chapter motes
    for (const m of this.ambientMotes) {
      m.rx = (m.rx + m.vx * dt + 1) % 1;
      m.ry = (m.ry + m.vy * dt + 1) % 1;
    }

    // Spawner logic
    if (this.victoryTimer === null) {
      this.updateSpawner(dt);
    }

    // Fire weapons
    this.updateWeapons(dt);

    // Update projectiles
    this.updateProjectiles(dt);

    // Update gravity zones
    this.updateGravityZones(dt);

    // Update enemies
    this.updateEnemies(dt);

    // Update pickups & XP leveling
    this.updatePickups(dt);

    // Update visual FX
    this.slashes = this.slashes.filter((s) => (s.life -= dt) > 0);
    this.lightnings = this.lightnings.filter((l) => (l.life -= dt) > 0);
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    this.afterimages = this.afterimages.filter((a) => (a.life -= dt) > 0);
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      return p.life > 0;
    });
    this.floats = this.floats.filter((f) => {
      f.y += f.vy * dt;
      f.life -= dt;
      return f.life > 0;
    });

    // Boss & Chapter Victory Check
    if (this.victoryTimer === null) {
      if (this.chapter.mode === 'boss_rush') {
        if (!this.activeBossId && this.bossRushStage < 5) {
          this.bossRushCooldown -= dt;
          if (this.bossRushCooldown <= 0) {
            this.bossRushStage += 1;
            const label = `Boss ${this.bossRushStage}/5: ${BOSS_RUSH_NAMES[this.bossRushStage - 1]}`;
            this.spawnBoss(label, 0.72 + this.bossRushStage * 0.36);
          }
        }
      } else if (this.chapter.mode === 'chapter' && !this.bossSpawned && this.elapsedSec >= this.chapter.durationSec) {
        this.spawnBoss(this.chapter.bossName, 1.0);
      } else if (this.chapter.mode === 'endless') {
        const minute = Math.floor(this.elapsedSec / 60);
        if (minute >= 1 && !this.eliteSpawnedMin.has(minute)) {
          this.eliteSpawnedMin.add(minute);
          if (minute % 2 === 0) this.spawnBoss(`${this.chapter.bossName} Mk.${minute / 2}`, 1 + minute * 0.16);
          else this.spawnEnemy('elite');
        }
      } else if (this.chapter.mode === 'chapter') {
        const halfTime = Math.floor(this.chapter.durationSec * 0.45);
        if (this.elapsedSec >= halfTime && !this.eliteSpawnedMin.has(1)) {
          this.eliteSpawnedMin.add(1);
          this.spawnEnemy('elite');
        }
      }
    }

    this.hudAccum += dt;
    if (this.hudAccum >= 0.14) {
      this.hudAccum = 0;
      this.emitHud();
    }
  }

  private spawnHordeSurge(): void {
    const surgeCount = Math.min(20, 8 + this.threatLevel * 2);
    const baseAngle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.width, this.height) * 0.56 + 35;
    for (let i = 0; i < surgeCount; i++) {
      if (this.enemies.length >= 190) break;
      const a = baseAngle + (i / surgeCount) * Math.PI * 1.4 - Math.PI * 0.7;
      const kind: Enemy['kind'] = i % 4 === 0 ? 'dasher' : i % 5 === 0 ? 'sentinel' : 'swarmer';
      this.spawnEnemy(kind, this.px + Math.cos(a) * dist, this.py + Math.sin(a) * dist);
    }
    this.cb.onWaveBanner(`💀 SWARM SURGE! (${surgeCount} fierce enemies!)`);
  }

  private updateSpawner(dt: number): void {
    const intensity = 1 + this.elapsedSec / 34 + (this.threatLevel - 1) * 0.32;
    const rate = (1.75 + intensity * 0.95) * this.chapter.spawnRateMult;
    this.spawnAccum += dt * rate;
    const goblinChance = this.boosters.doubleLuck ? 0.05 : 0.025;

    while (this.spawnAccum >= 1 && this.enemies.length < 185) {
      this.spawnAccum -= 1;
      const r = Math.random();
      let kind: Enemy['kind'] = 'swarmer';
      if (r < goblinChance) kind = 'goblin';
      else if (this.elapsedSec > 75 && r < 0.15) kind = 'splitter';
      else if (this.elapsedSec > 45 && r < 0.3) kind = 'spitter';
      else if (this.elapsedSec > 25 && r < 0.5) kind = 'sentinel';
      else if (this.elapsedSec > 12 && r < 0.72) kind = 'dasher';
      this.spawnEnemy(kind);
    }
  }

  private spawnEnemy(kind: Enemy['kind'], customX?: number, customY?: number): Enemy {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.max(this.width, this.height) * 0.62 + 40;
    const x = customX ?? this.px + Math.cos(angle) * spawnDist;
    const y = customY ?? this.py + Math.sin(angle) * spawnDist;

    // Strong progressive scaling across HP, Damage AND Speed
    const threatPowHp = Math.pow(1.18, this.threatLevel - 1);
    const threatPowDmg = Math.pow(1.13, this.threatLevel - 1);
    const spdScale = 1 + Math.min(0.85, (this.threatLevel - 1) * 0.09);

    const hpBase = 34 * this.chapter.enemyHpMult * (1 + this.elapsedSec * 0.024) * threatPowHp;
    const dmgBase = 14 * this.chapter.enemyDmgMult * (1 + this.elapsedSec * 0.014) * threatPowDmg;

    let radius = 14;
    let hp = hpBase;
    let speed = 82 * spdScale;
    let damage = dmgBase;
    let color = '#fb7185';
    let xpValue = 4;

    if (kind === 'dasher') {
      radius = 12;
      hp = hpBase * 0.78;
      speed = 132 * spdScale;
      color = '#f97316';
      xpValue = 5;
    } else if (kind === 'sentinel') {
      radius = 20;
      hp = hpBase * 2.7;
      speed = 58 * spdScale;
      damage = dmgBase * 1.4;
      color = '#94a3b8';
      xpValue = 11;
    } else if (kind === 'spitter') {
      radius = 15;
      hp = hpBase * 1.2;
      speed = 72 * spdScale;
      color = '#a3e635';
      xpValue = 9;
    } else if (kind === 'splitter') {
      radius = 18;
      hp = hpBase * 1.85;
      speed = 75 * spdScale;
      color = '#c084fc';
      xpValue = 10;
    } else if (kind === 'goblin') {
      radius = 15;
      hp = hpBase * 1.9;
      speed = 118 * Math.min(1.4, spdScale);
      damage = 4;
      color = '#fbbf24';
      xpValue = 18;
    } else if (kind === 'elite') {
      radius = 29;
      hp = hpBase * 15;
      speed = 80 * spdScale;
      damage = dmgBase * 1.85;
      color = '#e879f9';
      xpValue = 50;
    } else if (kind === 'boss') {
      radius = 44;
      hp = hpBase * 44;
      speed = 86 * Math.min(1.45, spdScale);
      damage = dmgBase * 2.3;
      color = '#ef4444';
      xpValue = 140;
    }

    // Monster Mutation / Strength Tiers as waves progress
    let tier: 0 | 1 | 2 = 0;
    if (kind !== 'boss' && kind !== 'elite' && kind !== 'goblin') {
      const apexChance = this.threatLevel >= 3 ? Math.min(0.24, (this.threatLevel - 2) * 0.06) : 0;
      const strongChance = this.threatLevel >= 2 ? Math.min(0.42, (this.threatLevel - 1) * 0.12) : 0;
      const roll = Math.random();
      if (roll < apexChance) {
        tier = 2; // Apex Mutant
        radius = Math.round(radius * 1.3);
        hp *= 2.55;
        damage *= 1.65;
        speed *= 1.22;
        xpValue = Math.round(xpValue * 2.2);
      } else if (roll < apexChance + strongChance) {
        tier = 1; // Versterkt Monster
        radius = Math.round(radius * 1.15);
        hp *= 1.65;
        damage *= 1.3;
        speed *= 1.12;
        xpValue = Math.round(xpValue * 1.5);
      }
    }

    const enemy: Enemy = {
      id: this.nextEnemyId++,
      kind,
      tier,
      animSeed: Math.random() * Math.PI * 2,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      hp: Math.round(hp),
      maxHp: Math.round(hp),
      speed,
      damage,
      color,
      xpValue,
      hitFlash: 0,
      slowTimer: 0,
      shootTimer: 1.8 + Math.random(),
      bossPatternTimer: 2.5,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private spawnBoss(bossTitle: string, hpScale = 1.0): void {
    this.bossSpawned = true;
    const boss = this.spawnEnemy('boss');
    boss.hp = Math.round(boss.hp * hpScale);
    boss.maxHp = boss.hp;
    this.activeBossId = boss.id;
    this.activeBossLabel = bossTitle;
    audio.playBossWarning();
    if (this.vibration && navigator.vibrate) navigator.vibrate([80, 60, 120]);
    this.cb.onBossBanner(bossTitle);
  }

  private findNearestEnemy(maxRange = 540): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxRange * maxRange;
    for (const e of this.enemies) {
      const d2 = (e.x - this.px) ** 2 + (e.y - this.py) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    }
    return best;
  }

  private updateWeapons(dt: number): void {
    const cdMult = this.getCooldownMult();
    const dmgMult = this.getDamageMult();
    const areaMult = this.getAreaMult();
    const extraProj = Math.floor((this.passives.get('fusion_cell') || 0) / 2);

    // Orbitals update continuously
    const orbState = this.weapons.get('orbital_saw');
    if (orbState) {
      const orbCount = orbState.evolved ? 6 : 1 + orbState.lv + extraProj;
      const spinSpeed = orbState.evolved ? 4.4 : 2.7 + orbState.lv * 0.25;
      this.orbitalAngle += dt * spinSpeed;
      const orbRadius = (orbState.evolved ? 108 : 78 + orbState.lv * 6) * areaMult;
      orbState.cd -= dt;
      if (orbState.cd <= 0) {
        orbState.cd = orbState.evolved ? 0.14 : 0.22;
        const orbDmg = this.stats.atk * (0.75 + orbState.lv * 0.26) * dmgMult * (orbState.evolved ? 1.55 : 1);
        for (let i = 0; i < orbCount; i++) {
          const ang = this.orbitalAngle + (i * Math.PI * 2) / orbCount;
          const ox = this.px + Math.cos(ang) * orbRadius;
          const oy = this.py + Math.sin(ang) * orbRadius;
          for (const e of [...this.enemies]) {
            if (Math.hypot(e.x - ox, e.y - oy) < e.radius + (orbState.evolved ? 22 : 16)) {
              this.damageEnemy(e, orbDmg, false);
              const pushAng = Math.atan2(e.y - this.py, e.x - this.px);
              e.x += Math.cos(pushAng) * 8;
              e.y += Math.sin(pushAng) * 8;
            }
          }
        }
      }
    }

    for (const [wId, st] of this.weapons.entries()) {
      if (wId === 'orbital_saw') continue;
      st.cd -= dt;
      if (st.cd > 0) continue;

      const def = WEAPONS.find((w) => w.id === wId);
      if (!def) continue;

      const baseCd = (def.baseCooldownMs / 1000) * Math.max(0.52, 1 - (st.lv - 1) * 0.08) * cdMult;
      st.cd = st.evolved ? baseCd * 0.72 : baseCd;
      const dmg = (this.stats.atk + def.baseDamage) * (1 + (st.lv - 1) * 0.34) * dmgMult * (st.evolved ? 1.65 : 1);

      if (wId === 'plasma_blade') {
        const radius = (st.evolved ? 155 : 104 + st.lv * 10) * areaMult;
        const spread = st.evolved ? Math.PI * 2 : Math.PI * 0.9;
        const hitsBothSides = st.lv >= 3 || st.evolved;
        const target = this.findNearestEnemy(radius + 50);
        const swingAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.weaponStyle === 'sword') {
          this.weaponAimAngle = swingAng;
          this.attackAnimDuration = 0.28;
          this.attackAnimTimer = 0.28;
        }
        const angles = hitsBothSides && !st.evolved ? [swingAng, swingAng + Math.PI] : [swingAng];
        for (const ang of angles) {
          this.slashes.push({
            x: this.px,
            y: this.py,
            angle: ang,
            radius,
            spread,
            color: st.evolved ? '#f43f5e' : '#38bdf8',
            life: 0.22,
            maxLife: 0.22,
          });
          for (const e of [...this.enemies]) {
            const dx = e.x - this.px;
            const dy = e.y - this.py;
            const dist = Math.hypot(dx, dy);
            if (dist <= radius + e.radius) {
              const hit =
                st.evolved ||
                Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang))) <=
                  spread / 2 + 0.28;
              if (hit) {
                this.damageEnemy(e, dmg, false);
                if (e.kind !== 'boss' && dist > 1) {
                  e.x += (dx / dist) * 14;
                  e.y += (dy / dist) * 14;
                }
              }
            }
          }
        }
      } else if (wId === 'arcane_staff') {
        const target = this.findNearestEnemy(500);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.weaponStyle === 'staff') {
          this.weaponAimAngle = baseAng;
          this.attackAnimDuration = 0.26;
          this.attackAnimTimer = 0.26;
        }
        const count = (st.evolved ? 4 : 1 + Math.floor(st.lv / 2)) + extraProj;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 0.22;
          const a = baseAng + offset;
          this.projectiles.push({
            fromEnemy: false,
            x: this.px + Math.cos(baseAng) * 18,
            y: this.py + Math.sin(baseAng) * 18,
            vx: Math.cos(a) * (st.evolved ? 480 : 390),
            vy: Math.sin(a) * (st.evolved ? 480 : 390),
            radius: st.evolved ? 11 : 8,
            damage: dmg,
            pierce: st.evolved ? 2 : 1,
            life: 1.75,
            maxLife: 1.75,
            color: st.evolved ? '#f0abfc' : '#c084fc',
            explosive: true,
            homing: st.evolved || st.lv >= 4,
            isMagicOrb: true,
            hitIds: new Set(),
          });
        }
      } else if (wId === 'star_bow') {
        const target = this.findNearestEnemy(560);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.weaponStyle === 'bow') {
          this.weaponAimAngle = baseAng;
          this.attackAnimDuration = 0.22;
          this.attackAnimTimer = 0.22;
        }
        const count = (st.evolved ? 5 : 1 + Math.floor(st.lv / 2)) + extraProj;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 0.11;
          const a = baseAng + offset;
          const speed = st.evolved ? 820 : 680;
          this.projectiles.push({
            fromEnemy: false,
            x: this.px + Math.cos(a) * 16,
            y: this.py + Math.sin(a) * 16,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            radius: st.evolved ? 7 : 5,
            damage: dmg,
            pierce: st.evolved ? 8 : 2 + st.lv,
            life: 1.3,
            maxLife: 1.3,
            color: st.evolved ? '#fbbf24' : '#4ade80',
            isArrow: true,
            hitIds: new Set(),
          });
        }
      } else if (wId === 'pulse_rifle') {
        const target = this.findNearestEnemy(480);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        const count = (st.evolved ? 3 : 1 + Math.floor(st.lv / 2)) + extraProj;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 0.14;
          const a = baseAng + offset;
          this.projectiles.push({
            fromEnemy: false,
            x: this.px,
            y: this.py,
            vx: Math.cos(a) * (st.evolved ? 640 : 460),
            vy: Math.sin(a) * (st.evolved ? 640 : 460),
            radius: st.evolved ? 7 : 5,
            damage: dmg,
            pierce: st.evolved ? 5 : st.lv >= 4 ? 2 : 1,
            life: 1.4,
            maxLife: 1.4,
            color: st.evolved ? '#f43f5e' : '#22d3ee',
            explosive: st.evolved,
            hitIds: new Set(),
          });
        }
      } else if (wId === 'tesla_arc') {
        const chains = (st.evolved ? 7 : 2 + st.lv) + extraProj;
        let curX = this.px;
        let curY = this.py;
        const hitSet = new Set<number>();
        const pts: { x: number; y: number }[] = [{ x: curX, y: curY }];

        for (let c = 0; c < chains; c++) {
          let nextE: Enemy | null = null;
          let bestD = 260 * 260;
          for (const e of this.enemies) {
            if (hitSet.has(e.id)) continue;
            const d2 = (e.x - curX) ** 2 + (e.y - curY) ** 2;
            if (d2 < bestD) {
              bestD = d2;
              nextE = e;
            }
          }
          if (!nextE) break;
          hitSet.add(nextE.id);
          pts.push({ x: nextE.x, y: nextE.y });
          curX = nextE.x;
          curY = nextE.y;
          this.damageEnemy(nextE, dmg * (1 - c * 0.06), false);
          if (st.evolved) nextE.slowTimer = Math.max(nextE.slowTimer, 0.9);
        }
        if (pts.length > 1) {
          this.lightnings.push({
            points: pts,
            color: st.evolved ? '#f0abfc' : '#a855f7',
            life: 0.24,
          });
        }
      } else if (wId === 'frost_nova') {
        const radius = (st.evolved ? 185 : 105 + st.lv * 16) * areaMult;
        this.spawnRing(this.px, this.py, radius, st.evolved ? '#38bdf8' : '#93c5fd', 0.4);
        for (const e of [...this.enemies]) {
          if (Math.hypot(e.x - this.px, e.y - this.py) <= radius + e.radius) {
            e.slowTimer = Math.max(e.slowTimer, st.evolved ? 3.0 : 1.8);
            this.damageEnemy(e, dmg, false);
          }
        }
      } else if (wId === 'inferno_drone') {
        const missiles = (st.evolved ? 5 : 1 + st.lv) + extraProj;
        const droneCount = st.evolved ? 4 : 2;
        for (let i = 0; i < missiles; i++) {
          const droneIdx = i % droneCount;
          const dAng = this.elapsedSec * 2.4 + (droneIdx * Math.PI * 2) / droneCount;
          const sx = this.px + Math.cos(dAng) * 34;
          const sy = this.py + Math.sin(dAng) * 34;
          const target = this.enemies[(i * 3) % Math.max(1, this.enemies.length)] || null;
          const a = target
            ? Math.atan2(target.y - sy, target.x - sx) + (Math.random() - 0.5) * 0.22
            : Math.random() * Math.PI * 2;
          this.projectiles.push({
            fromEnemy: false,
            x: sx,
            y: sy,
            vx: Math.cos(a) * 360,
            vy: Math.sin(a) * 360,
            radius: st.evolved ? 8 : 6,
            damage: dmg,
            pierce: 1,
            life: 1.85,
            maxLife: 1.85,
            color: st.evolved ? '#fbbf24' : '#fb7185',
            explosive: true,
            homing: true,
            hitIds: new Set(),
          });
        }
      } else if (wId === 'gravity_well') {
        const zones = st.evolved ? 2 : 1;
        for (let i = 0; i < zones; i++) {
          const t = this.enemies[Math.floor(Math.random() * this.enemies.length)];
          const gx = t ? t.x : this.px + (Math.random() - 0.5) * 220;
          const gy = t ? t.y : this.py + (Math.random() - 0.5) * 220;
          this.gravZones.push({
            x: gx,
            y: gy,
            radius: (st.evolved ? 125 : 72 + st.lv * 9) * areaMult,
            damagePerSec: dmg * 1.15,
            color: st.evolved ? '#e879f9' : '#8b5cf6',
            life: st.evolved ? 3.8 : 2.6,
            tickAccum: 0,
          });
        }
      } else if (wId === 'vamp_scythe') {
        const count = (st.evolved ? 4 : 1 + Math.floor(st.lv / 2)) + extraProj;
        const target = this.findNearestEnemy(380);
        const baseA = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        for (let i = 0; i < count; i++) {
          const a = baseA + ((i - (count - 1) / 2) * Math.PI) / 4;
          this.projectiles.push({
            fromEnemy: false,
            x: this.px,
            y: this.py,
            vx: Math.cos(a) * 360,
            vy: Math.sin(a) * 360,
            radius: st.evolved ? 17 : 12,
            damage: dmg,
            pierce: 99,
            life: 1.6,
            maxLife: 1.6,
            color: st.evolved ? '#fb7185' : '#ef4444',
            boomerang: true,
            vampiric: true,
            hitIds: new Set(),
          });
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const alive: Projectile[] = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.life <= 0) continue;

      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) {
        continue;
      }

      if (p.boomerang && p.life < p.maxLife * 0.55) {
        const ang = Math.atan2(this.py - p.y, this.px - p.x);
        p.vx += Math.cos(ang) * 950 * dt;
        p.vy += Math.sin(ang) * 950 * dt;
        const bSpd = Math.hypot(p.vx, p.vy);
        if (bSpd > 680) {
          p.vx = (p.vx / bSpd) * 680;
          p.vy = (p.vy / bSpd) * 680;
        }
      }

      if (p.homing && this.enemies.length > 0) {
        let nearest: Enemy | null = null;
        let bestD = 380 * 380;
        for (const e of this.enemies) {
          const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
          if (d2 < bestD) {
            bestD = d2;
            nearest = e;
          }
        }
        if (nearest) {
          const spd = Math.hypot(p.vx, p.vy) || 360;
          const desired = Math.atan2(nearest.y - p.y, nearest.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-5.8 * dt, Math.min(5.8 * dt, diff));
          const nextAng = cur + turn;
          p.vx = Math.cos(nextAng) * spd;
          p.vy = Math.sin(nextAng) * spd;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.isMagicOrb && Math.random() < 0.35) {
        this.spawnParticle(p.x, p.y, (Math.random() - 0.5) * 35, (Math.random() - 0.5) * 35, 2.2, p.color, 0.22);
      }

      if (p.fromEnemy) {
        if (Math.hypot(p.x - this.px, p.y - this.py) < p.radius + 14) {
          this.damagePlayer(p.damage);
          continue;
        }
        alive.push(p);
        continue;
      }

      let consumed = false;
      for (const e of [...this.enemies]) {
        if (p.hitIds.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= p.radius + e.radius) {
          p.hitIds.add(e.id);
          this.damageEnemy(e, p.damage, false);
          if (p.vampiric && Math.random() < 0.25) {
            this.hp = Math.min(this.getEffectiveMaxHp(), this.hp + 3);
          }
          if (p.explosive) {
            this.spawnRing(p.x, p.y, 48, p.color, 0.22);
            for (const other of [...this.enemies]) {
              if (other.id !== e.id && Math.hypot(other.x - p.x, other.y - p.y) < 55) {
                this.damageEnemy(other, p.damage * 0.6, false);
              }
            }
          }
          p.pierce -= 1;
          if (p.pierce <= 0) {
            consumed = true;
            break;
          }
        }
      }
      if (!consumed) alive.push(p);
    }
    if (alive.length > 260) {
      this.projectiles = alive.slice(alive.length - 260);
    } else {
      this.projectiles = alive;
    }
  }

  private updateGravityZones(dt: number): void {
    const active: GravityZone[] = [];
    for (const z of this.gravZones) {
      z.life -= dt;
      if (z.life <= 0) continue;
      z.tickAccum += dt;
      const doDmg = z.tickAccum >= 0.25;
      if (doDmg) z.tickAccum -= 0.25;

      for (const e of [...this.enemies]) {
        const dx = z.x - e.x;
        const dy = z.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < z.radius && d > 1) {
          const pull = e.kind === 'boss' ? 18 : 95;
          e.x += (dx / d) * pull * dt;
          e.y += (dy / d) * pull * dt;
          if (doDmg) {
            this.damageEnemy(e, z.damagePerSec * 0.25, false);
          }
        }
      }
      active.push(z);
    }
    this.gravZones = active;
  }

  private updateEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = e.speed * (e.slowTimer > 0 ? 0.45 : 1);

      // Spitter / Boss ranged attacks
      if (e.kind === 'spitter' && dist < 340) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 2.6;
          const a = Math.atan2(dy, dx);
          this.projectiles.push({
            fromEnemy: true,
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 195,
            vy: Math.sin(a) * 195,
            radius: 6,
            damage: e.damage * 0.85,
            pierce: 1,
            life: 2.5,
            maxLife: 2.5,
            color: '#f43f5e',
            hitIds: new Set(),
          });
        }
      } else if (e.kind === 'boss') {
        e.bossPatternTimer -= dt;
        if (e.bossPatternTimer <= 0) {
          e.bossPatternTimer = 3.1;
          const bolts = 10;
          const offset = Math.random() * Math.PI * 2;
          for (let b = 0; b < bolts; b++) {
            const a = offset + (b * Math.PI * 2) / bolts;
            this.projectiles.push({
              fromEnemy: true,
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 185,
              vy: Math.sin(a) * 185,
              radius: 7,
              damage: e.damage * 0.8,
              pierce: 1,
              life: 3.2,
              maxLife: 3.2,
              color: '#fb7185',
              hitIds: new Set(),
            });
          }
          this.spawnRing(e.x, e.y, 125, '#ef4444', 0.38);
        }
      }

      if (e.kind !== 'spitter' || dist > 165) {
        e.x += (dx / dist) * spd * dt;
        e.y += (dy / dist) * spd * dt;
      }

      // Soft separation against nearest neighbor so hordes look crisp
      if (i + 1 < this.enemies.length) {
        const o = this.enemies[i + 1];
        const sx = e.x - o.x;
        const sy = e.y - o.y;
        const sd = Math.hypot(sx, sy);
        const minD = e.radius + o.radius;
        if (sd > 0 && sd < minD) {
          const push = (minD - sd) * 0.35;
          e.x += (sx / sd) * push;
          e.y += (sy / sd) * push;
          o.x -= (sx / sd) * push;
          o.y -= (sy / sd) * push;
        }
      }

      if (dist < e.radius + 14) {
        this.damagePlayer(e.damage);
      }
    }
  }

  private damageEnemy(e: Enemy, rawDmg: number, forceCrit: boolean): void {
    const safeRaw = Number.isFinite(rawDmg) && rawDmg > 0 ? rawDmg : 1;
    const critChance = this.stats.critChance + (this.passives.get('eagle_optics') || 0) * 0.06;
    const isCrit = forceCrit || Math.random() < critChance;
    const critMult = this.stats.critMult + (this.passives.get('eagle_optics') || 0) * 0.2;
    const dmg = Math.max(1, Math.round(safeRaw * (isCrit ? critMult : 1)));

    e.hp -= dmg;
    e.hitFlash = 0.11;
    audio.playHit(isCrit);

    if (isCrit) {
      this.screenShake = Math.max(this.screenShake, e.kind === 'boss' ? 4.2 : 2.1);
      this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 3.2, '#fde047', 0.24);
    } else if (e.kind === 'boss') {
      this.screenShake = Math.max(this.screenShake, 2.2);
    }

    if (this.damageNumbers && this.floats.length < 75) {
      this.floats.push({
        x: e.x + (Math.random() - 0.5) * 14,
        y: e.y - e.radius,
        vy: isCrit ? -52 : -42,
        text: isCrit ? `${dmg}!` : String(dmg),
        color: isCrit ? '#fde047' : '#f8fafc',
        life: isCrit ? 0.62 : 0.42,
        scale: isCrit ? 1.38 : 0.96,
      });
    }

    if (e.hp <= 0) {
      this.killEnemy(e);
    }
  }

  private killEnemy(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);

    this.kills += 1;
    this.comboCount += 1;
    this.comboTimer = 2.5;
    if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

    if (this.comboCount > 0 && this.comboCount % 50 === 0) {
      this.ultCharge = Math.min(100, this.ultCharge + 8);
      this.coinsEarned += 40;
      this.floats.push({
        x: this.px,
        y: this.py - 36,
        vy: -32,
        text: `🔥 ${this.comboCount}x COMBO!`,
        color: '#fbbf24',
        life: 1.0,
        scale: 1.35,
      });
    }

    this.ultCharge = Math.min(100, this.ultCharge + (e.kind === 'elite' ? 20 : e.kind === 'boss' ? 40 : 1.4));

    // Burst particles & death shockwaves
    const pCount = e.kind === 'boss' ? 38 : e.kind === 'elite' ? 18 : 7;
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * (e.kind === 'boss' ? 240 : 150);
      this.spawnParticle(
        e.x,
        e.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        e.kind === 'boss' ? 5.8 : 3.2,
        i % 3 === 0 ? '#ffffff' : e.color,
        0.35 + Math.random() * 0.25
      );
    }
    if (e.kind === 'elite' || e.tier === 2) {
      this.spawnRing(e.x, e.y, e.radius * 3.4, e.kind === 'elite' ? '#f0abfc' : '#fb7185', 0.34);
    }

    // Splitter spawns 2 mini dashers
    if (e.kind === 'splitter') {
      const m1 = this.spawnEnemy('dasher', e.x - 14, e.y);
      const m2 = this.spawnEnemy('dasher', e.x + 14, e.y);
      m1.hp = Math.max(1, Math.round(e.maxHp * 0.3));
      m1.maxHp = m1.hp;
      m2.hp = Math.max(1, Math.round(e.maxHp * 0.3));
      m2.maxHp = m2.hp;
    }

    if (e.kind === 'goblin') {
      for (let i = 0; i < 6; i++) {
        this.pickups.push({
          kind: 'coin',
          x: e.x + (Math.random() - 0.5) * 32,
          y: e.y + (Math.random() - 0.5) * 32,
          val: 35,
          magnetized: false,
        });
      }
      this.pickups.push({ kind: 'gem', x: e.x, y: e.y, val: 4, magnetized: false });
    } else if (e.kind === 'elite') {
      this.bossesKilled += 1;
      this.pickups.push({ kind: 'chest', x: e.x, y: e.y, val: 1, magnetized: false });
      this.pickups.push({ kind: 'gem', x: e.x + 16, y: e.y, val: 5, magnetized: false });
    } else if (e.kind === 'boss') {
      this.bossesKilled += 1;
      this.activeBossId = null;
      this.activeBossLabel = null;
      this.gemsEarned += 15;
      this.coinsEarned += 450;
      this.screenShake = 15;
      this.spawnRing(e.x, e.y, 280, '#fbbf24', 0.65);
      this.spawnRing(e.x, e.y, 175, '#ffffff', 0.45);
      if (this.chapter.mode === 'chapter') {
        this.victoryTimer = window.setTimeout(() => this.abortAndFinish(true), 650);
        return;
      } else if (this.chapter.mode === 'boss_rush') {
        this.hp = Math.min(this.getEffectiveMaxHp(), this.hp + Math.round(this.getEffectiveMaxHp() * 0.25));
        if (this.bossRushStage >= 5) {
          this.victoryTimer = window.setTimeout(() => this.abortAndFinish(true), 650);
          return;
        }
        this.bossRushCooldown = 2.6;
        this.pickups.push({ kind: 'chest', x: e.x, y: e.y, val: 1, magnetized: false });
      } else {
        this.pickups.push({ kind: 'chest', x: e.x, y: e.y, val: 1, magnetized: false });
      }
    } else {
      const xpKind: Pickup['kind'] = e.xpValue >= 10 ? 'xp_l' : e.xpValue >= 6 ? 'xp_m' : 'xp_s';
      this.pickups.push({ kind: xpKind, x: e.x, y: e.y, val: e.xpValue, magnetized: false });
      const dropRoll = Math.random();
      const luckBoost = this.boosters.doubleLuck ? 1.45 : 1.0;
      if (dropRoll < 0.08 * luckBoost) this.pickups.push({ kind: 'coin', x: e.x + 6, y: e.y, val: 15, magnetized: false });
      else if (dropRoll < 0.087 * luckBoost) this.pickups.push({ kind: 'heal', x: e.x, y: e.y, val: 30, magnetized: false });
      else if (dropRoll < 0.091 * luckBoost) this.pickups.push({ kind: 'magnet', x: e.x, y: e.y, val: 1, magnetized: false });
      else if (dropRoll < 0.094 * luckBoost) this.pickups.push({ kind: 'bomb', x: e.x, y: e.y, val: 1, magnetized: false });
    }
  }

  private damagePlayer(rawDmg: number): void {
    if (this.invulnTimer > 0 || this.ended || this.victoryTimer !== null) return;
    const safeRaw = Number.isFinite(rawDmg) ? rawDmg : 10;
    const dmg = Math.max(2, Math.round(safeRaw - this.stats.armor));
    this.hp -= dmg;
    this.invulnTimer = 0.42;
    this.screenShake = Math.max(this.screenShake, 7.5);
    if (this.vibration && navigator.vibrate) navigator.vibrate(25);

    if (this.hp <= 0) {
      this.hp = 0;
      if (this.revivesLeft > 0) {
        this.revivePlayer();
        return;
      }
      this.setPaused(true);
      this.cb.onDeathOffer(!this.usedAdRevive);
    }
  }

  private updatePickups(dt: number): void {
    const rad = this.getPickupRadius();
    const xpMult = (this.stats.xpMult + (this.passives.get('blood_ruby') || 0) * 0.1) * (this.boosters.doubleLuck ? 1.25 : 1);
    const greedBonus = (1 + (this.passives.get('blood_ruby') || 0) * 0.1) * (this.boosters.doubleLuck ? 1.25 : 1);
    const alive: Pickup[] = [];

    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const dist = Math.hypot(dx, dy);

      if (p.kind !== 'chest' && (p.magnetized || dist <= rad)) {
        p.magnetized = true;
        const spd = 520;
        if (dist > 1) {
          p.x += (dx / dist) * spd * dt;
          p.y += (dy / dist) * spd * dt;
        }
        if (Math.random() < 0.25) {
          const trailCol = p.kind === 'coin' ? '#fde047' : p.kind === 'xp_l' ? '#fbbf24' : '#38bdf8';
          this.spawnParticle(p.x, p.y, -dx * 0.2, -dy * 0.2, 2.0, trailCol, 0.2);
        }
      }

      if (dist <= 22) {
        if (p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l') {
          audio.playXpPickup();
          this.xp += p.val * xpMult;
          if (this.checkPendingLevelUp()) {
            // Keep remaining uncollected pickups for after draft closes
            for (let j = i + 1; j < this.pickups.length; j++) alive.push(this.pickups[j]);
            break;
          }
        } else if (p.kind === 'coin') {
          this.coinsEarned += Math.round(p.val * greedBonus);
          audio.playXpPickup();
        } else if (p.kind === 'gem') {
          this.gemsEarned += p.val;
          audio.playPurchaseSuccess();
        } else if (p.kind === 'heal') {
          const maxHp = this.getEffectiveMaxHp();
          this.hp = Math.min(maxHp, this.hp + Math.round(maxHp * (p.val / 100)));
          this.spawnRing(this.px, this.py, 55, '#10b981', 0.3);
        } else if (p.kind === 'magnet') {
          audio.playMagnetSweep();
          this.spawnRing(this.px, this.py, 240, '#38bdf8', 0.45);
          for (const other of this.pickups) {
            if (other.kind !== 'chest') other.magnetized = true;
          }
        } else if (p.kind === 'bomb') {
          this.screenShake = 14;
          audio.playUltimate();
          this.spawnRing(this.px, this.py, 360, '#f59e0b', 0.5);
          for (const e of [...this.enemies]) {
            if (e.kind !== 'boss' && Math.hypot(e.x - this.px, e.y - this.py) < 380) {
              this.killEnemy(e);
            }
          }
        } else if (p.kind === 'chest') {
          audio.playChestJackpot();
          this.setPaused(true);
          const count = Math.random() < 0.25 ? 3 : 1;
          const rewards: DraftOption[] = [];
          for (let k = 0; k < count; k++) {
            const opts = this.buildDraftOptions();
            const pick = opts[0];
            this.applyDraftOptionSilent(pick);
            rewards.push(pick);
          }
          const bonusCoins = 220 + this.level * 25;
          this.coinsEarned += bonusCoins;
          this.cb.onChestJackpot(rewards, bonusCoins);
          for (let j = i + 1; j < this.pickups.length; j++) alive.push(this.pickups[j]);
          break;
        }
        continue;
      }
      alive.push(p);
    }
    if (alive.length > 260) {
      // Condense oldest XP pickup values into a later XP pickup to avoid array bloat
      const kept: Pickup[] = [];
      let condensedXp = 0;
      const dropCount = alive.length - 260;
      for (let i = 0; i < alive.length; i++) {
        const pk = alive[i];
        if (i < dropCount && (pk.kind === 'xp_s' || pk.kind === 'xp_m')) {
          condensedXp += pk.val;
        } else {
          kept.push(pk);
        }
      }
      if (condensedXp > 0 && kept.length > 0) {
        kept.push({ kind: 'xp_l', x: kept[kept.length - 1].x, y: kept[kept.length - 1].y, val: condensedXp, magnetized: false });
      }
      this.pickups = kept;
    } else {
      this.pickups = alive;
    }
  }

  private applyDraftOptionSilent(opt: DraftOption): void {
    if (opt.kind === 'evo') {
      const wId = opt.id as WeaponId;
      const st = this.weapons.get(wId);
      if (st) {
        st.evolved = true;
        st.lv = 6;
        if (!this.evosUnlocked.includes(opt.name)) this.evosUnlocked.push(opt.name);
        if (!this.evoIdsUnlocked.includes(wId)) this.evoIdsUnlocked.push(wId);
      }
    } else if (opt.kind === 'weapon') {
      const wId = opt.id as WeaponId;
      const st = this.weapons.get(wId);
      if (st) st.lv += 1;
      else this.weapons.set(wId, { lv: 1, cd: 0.15, evolved: false });
    } else if (opt.kind === 'passive') {
      const pId = opt.id as PassiveId;
      this.passives.set(pId, (this.passives.get(pId) || 0) + 1);
    }
  }

  private spawnRing(x: number, y: number, maxRadius: number, color: string, life: number): void {
    if (this.rings.length < 44) {
      this.rings.push({ x, y, maxRadius, color, life, maxLife: life });
    }
  }

  private spawnParticle(x: number, y: number, vx: number, vy: number, size: number, color: string, life: number): void {
    if (this.particles.length < 240) {
      this.particles.push({ x, y, vx, vy, size, color, life, maxLife: life });
    }
  }

  private emitHud(): void {
    const boss = this.activeBossId ? this.enemies.find((e) => e.id === this.activeBossId) : null;
    this.cb.onHud({
      hp: Math.round(this.hp),
      maxHp: this.getEffectiveMaxHp(),
      level: this.level,
      xpFrac: Math.min(1, this.xp / Math.max(1, this.xpNext)),
      elapsedSec: Math.floor(this.elapsedSec),
      durationSec: this.chapter.durationSec,
      isEndless: this.chapter.mode === 'endless',
      isBossRush: this.chapter.mode === 'boss_rush',
      bossRushStage: this.bossRushStage,
      kills: this.kills,
      combo: this.comboCount,
      threatLevel: this.threatLevel,
      enemyPowerPct: this.getEnemyPowerPct(),
      coins: Math.round(this.coinsEarned * this.stats.goldMult * (this.boosters.doubleLuck ? 1.25 : 1)),
      gems: this.gemsEarned,
      ultCharge: Math.round(this.ultCharge),
      dashReadyFrac: this.dashCd <= 0 ? 1 : Math.max(0, 1 - this.dashCd / Math.max(0.5, this.dashMaxCd)),
      bossName: boss ? (this.activeBossLabel || this.chapter.bossName) : null,
      bossHpFrac: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
      weapons: Array.from(this.weapons.entries()).map(([id, s]) => ({ id, lv: s.lv, evolved: s.evolved })),
      passives: Array.from(this.passives.entries()).map(([id, lv]) => ({ id, lv })),
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this.chapter.bgTop);
    grad.addColorStop(0.55, this.chapter.bgBottom);
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const camX = this.px - w / 2 + shakeX;
    const camY = this.py - h / 2 + shakeY;

    // Subtle drifting nebula glows (chapter accent)
    const neb1X = w * (0.3 + Math.sin(this.elapsedSec * 0.14) * 0.12);
    const neb1Y = h * (0.28 + Math.cos(this.elapsedSec * 0.11) * 0.1);
    const nebGrad1 = ctx.createRadialGradient(neb1X, neb1Y, 10, neb1X, neb1Y, Math.max(w, h) * 0.52);
    nebGrad1.addColorStop(0, `${this.chapter.accentColor}1e`);
    nebGrad1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebGrad1;
    ctx.fillRect(0, 0, w, h);

    const neb2X = w * (0.72 + Math.cos(this.elapsedSec * 0.09) * 0.12);
    const neb2Y = h * (0.74 + Math.sin(this.elapsedSec * 0.13) * 0.1);
    const nebGrad2 = ctx.createRadialGradient(neb2X, neb2Y, 10, neb2X, neb2Y, Math.max(w, h) * 0.45);
    nebGrad2.addColorStop(0, `${this.chapter.accentColor}14`);
    nebGrad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebGrad2;
    ctx.fillRect(0, 0, w, h);

    // Parallax twinkling starfield
    const starTile = 160;
    const sx0 = Math.floor((camX * 0.42) / starTile) * starTile;
    const sy0 = Math.floor((camY * 0.42) / starTile) * starTile;
    for (let tx = sx0 - starTile; tx < camX * 0.42 + w + starTile; tx += starTile) {
      for (let ty = sy0 - starTile; ty < camY * 0.42 + h + starTile; ty += starTile) {
        const hash = Math.abs(Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453);
        const rx = (hash % 1) * starTile;
        const ry = ((hash * 7) % 1) * starTile;
        const screenX = tx + rx - camX * 0.42;
        const screenY = ty + ry - camY * 0.42;
        const twinkle = 0.14 + 0.22 * Math.abs(Math.sin(this.elapsedSec * 1.8 + hash * 12));
        ctx.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
        const sz = (hash * 13) % 1 > 0.78 ? 2.5 : 1.6;
        ctx.fillRect(screenX, screenY, sz, sz);
      }
    }

    // Dual-layer animated cyber grid floor
    const minorStep = 64;
    const majorStep = 256;
    const startX = -((camX % minorStep) + minorStep) % minorStep;
    const startY = -((camY % minorStep) + minorStep) % minorStep;
    ctx.strokeStyle = this.chapter.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < w; x += minorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += minorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Major circuit lines & pulsing intersection nodes
    const majStartX = -((camX % majorStep) + majorStep) % majorStep;
    const majStartY = -((camY % majorStep) + majorStep) % majorStep;
    const gridPulse = 0.16 + 0.1 * Math.sin(this.elapsedSec * 2.2);
    ctx.save();
    ctx.strokeStyle = this.chapter.accentColor;
    ctx.globalAlpha = gridPulse;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = majStartX; x < w; x += majorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = majStartY; y < h; y += majorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Glowing chapter-themed floor runes / fissures anchored in world space
    const decalTile = 256;
    const dx0 = Math.floor(camX / decalTile) * decalTile;
    const dy0 = Math.floor(camY / decalTile) * decalTile;
    ctx.fillStyle = this.chapter.accentColor;
    for (let tx = dx0 - decalTile; tx < camX + w + decalTile; tx += decalTile) {
      for (let ty = dy0 - decalTile; ty < camY + h + decalTile; ty += decalTile) {
        const sx = tx - camX;
        const sy = ty - camY;
        const hVal = Math.abs(Math.sin(tx * 0.0137 + ty * 0.0291) * 9973);
        const mod = hVal % 1;
        // Intersection node dot
        ctx.globalAlpha = gridPulse * 1.4;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();

        if (mod > 0.35) {
          const cx = sx + 128;
          const cy = sy + 128;
          ctx.globalAlpha = 0.09 + 0.05 * Math.sin(this.elapsedSec * 2 + hVal);
          if (this.chapter.id === 1 || this.chapter.id === 88) {
            // Neon Outskirts / Boss Rush: Cyber Hex Pad
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const a = (k * Math.PI) / 3 + this.elapsedSec * 0.12;
              const rx = cx + Math.cos(a) * 32;
              const ry = cy + Math.sin(a) * 32;
              if (k === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.stroke();
          } else if (this.chapter.id === 2) {
            // Rust Canyon: Hazard Chevron Plate
            ctx.beginPath();
            ctx.moveTo(cx - 28, cy - 10);
            ctx.lineTo(cx, cy - 26);
            ctx.lineTo(cx + 28, cy - 10);
            ctx.moveTo(cx - 28, cy + 8);
            ctx.lineTo(cx, cy - 8);
            ctx.lineTo(cx + 28, cy + 8);
            ctx.stroke();
          } else if (this.chapter.id === 3) {
            // Cryo Citadel: Frost Crystal Rune
            ctx.beginPath();
            for (let k = 0; k < 3; k++) {
              const a = (k * Math.PI) / 3;
              ctx.moveTo(cx - Math.cos(a) * 28, cy - Math.sin(a) * 28);
              ctx.lineTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28);
            }
            ctx.stroke();
          } else if (this.chapter.id === 4) {
            // Magma Core: Glowing Reactor Crack
            ctx.beginPath();
            ctx.moveTo(cx - 34, cy - 12);
            ctx.lineTo(cx - 8, cy + 4);
            ctx.lineTo(cx + 12, cy - 14);
            ctx.lineTo(cx + 36, cy + 12);
            ctx.stroke();
          } else {
            // Void Rift / Endless: Rotating Arcane Sigil
            ctx.beginPath();
            ctx.arc(cx, cy, 28, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 16, this.elapsedSec * 0.7, this.elapsedSec * 0.7 + Math.PI * 1.4);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();

    // Drifting ambient chapter motes (embers / ice dust / void sparks)
    ctx.save();
    ctx.fillStyle = this.chapter.accentColor;
    for (const m of this.ambientMotes) {
      ctx.globalAlpha = m.alpha * (0.7 + 0.3 * Math.sin(this.elapsedSec * 3 + m.rx * 10));
      ctx.beginPath();
      ctx.arc(m.rx * w, m.ry * h, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-camX, -camY);

    // Gravity Zones
    for (const z of this.gravZones) {
      ctx.save();
      ctx.globalAlpha = 0.3 * Math.min(1, z.life);
      const zGrad = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.radius);
      zGrad.addColorStop(0, '#020617');
      zGrad.addColorStop(0.7, z.color);
      zGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = zGrad;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f5d0fe';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this.elapsedSec * 40;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius * (0.28 + ((this.elapsedSec * 1.6) % 0.72)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pickups (with XP magnet sparkle trails & crisp faceted crystals)
    for (const p of this.pickups) {
      if (Math.abs(p.x - this.px) > w * 0.7 || Math.abs(p.y - this.py) > h * 0.7) continue;
      if (p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l') {
        const col = p.kind === 'xp_l' ? '#fbbf24' : p.kind === 'xp_m' ? '#34d399' : '#38bdf8';
        if (p.magnetized) {
          const ang = Math.atan2(this.py - p.y, this.px - p.x);
          ctx.save();
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.48;
          ctx.lineWidth = p.kind === 'xp_l' ? 4 : 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(ang) * 18, p.y - Math.sin(ang) * 18);
          ctx.stroke();
          ctx.restore();
        }
        const sz = p.kind === 'xp_l' ? 7.5 : p.kind === 'xp_m' ? 6.2 : 5.2;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - sz);
        ctx.lineTo(p.x + sz * 0.78, p.y);
        ctx.lineTo(p.x, p.y + sz);
        ctx.lineTo(p.x - sz * 0.78, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - sz * 0.7);
        ctx.lineTo(p.x + sz * 0.35, p.y);
        ctx.lineTo(p.x, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'coin') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.kind === 'gem') {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 8);
        ctx.lineTo(p.x + 6, p.y - 2);
        ctx.lineTo(p.x + 4, p.y + 7);
        ctx.lineTo(p.x - 4, p.y + 7);
        ctx.lineTo(p.x - 6, p.y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fecdd3';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (p.kind === 'heal') {
        ctx.fillStyle = 'rgba(16,185,129,0.22)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.fillRect(p.x - 7, p.y - 3, 14, 6);
        ctx.fillRect(p.x - 3, p.y - 7, 6, 14);
      } else if (p.kind === 'magnet') {
        ctx.fillStyle = 'rgba(56,189,248,0.28)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M', p.x, p.y + 4);
      } else if (p.kind === 'bomb') {
        ctx.fillStyle = 'rgba(249,115,22,0.28)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('B', p.x, p.y + 4);
      } else if (p.kind === 'chest') {
        const pulse = 1 + Math.sin(this.elapsedSec * 6) * 0.08;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = 'rgba(251,191,36,0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-13, -10, 26, 20);
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(-13, -3, 26, 4);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(-13, -10, 26, 20);
        ctx.restore();
      }
    }

    // Ring waves
    for (const r of this.rings) {
      const prog = 1 - r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4.5 * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxRadius * prog, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dash afterimages (ghostly silhouette + speed streaks)
    for (const a of this.afterimages) {
      const alpha = Math.max(0, a.life * 2.1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = this.hero.accentColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(a.x - 9, a.y - 16, 18, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - Math.cos(a.angle) * 22, a.y - Math.sin(a.angle) * 22);
      ctx.stroke();
      ctx.restore();
    }

    // Enemies (detailed animated monsters)
    for (const e of this.enemies) {
      if (Math.abs(e.x - this.px) > w * 0.72 || Math.abs(e.y - this.py) > h * 0.72) continue;
      this.drawMonster(ctx, e);
    }

    // Orbitals render (toothed spinning saw blades with glowing energy trails)
    const orbState = this.weapons.get('orbital_saw');
    if (orbState) {
      const extraProj = Math.floor((this.passives.get('fusion_cell') || 0) / 2);
      const count = orbState.evolved ? 6 : 1 + orbState.lv + extraProj;
      const orbR = (orbState.evolved ? 108 : 78 + orbState.lv * 6) * this.getAreaMult();
      ctx.save();
      ctx.strokeStyle = orbState.evolved ? 'rgba(251, 191, 36, 0.16)' : 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.px, this.py, orbR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < count; i++) {
        const ang = this.orbitalAngle + (i * Math.PI * 2) / count;
        const ox = this.px + Math.cos(ang) * orbR;
        const oy = this.py + Math.sin(ang) * orbR;
        const rSaw = orbState.evolved ? 15 : 11;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = orbState.evolved ? 'rgba(251,191,36,0.28)' : 'rgba(56,189,248,0.24)';
        ctx.beginPath();
        ctx.arc(0, 0, rSaw * 1.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(this.elapsedSec * 12);
        ctx.fillStyle = orbState.evolved ? '#fbbf24' : '#38bdf8';
        ctx.beginPath();
        for (let t = 0; t < 8; t++) {
          const a = (t * Math.PI * 2) / 8;
          const rr = t % 2 === 0 ? rSaw * 1.24 : rSaw * 0.7;
          if (t === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Phoenix Drones orbiting player when equipped
    const droneState = this.weapons.get('inferno_drone');
    if (droneState) {
      const dCount = droneState.evolved ? 4 : 2;
      for (let i = 0; i < dCount; i++) {
        const dAng = this.elapsedSec * 2.4 + (i * Math.PI * 2) / dCount;
        const dx = this.px + Math.cos(dAng) * 34;
        const dy = this.py + Math.sin(dAng) * 34;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillStyle = droneState.evolved ? 'rgba(251,191,36,0.25)' : 'rgba(251,113,133,0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = droneState.evolved ? '#fbbf24' : '#fb7185';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(7, 4);
        ctx.lineTo(0, 1);
        ctx.lineTo(-7, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Plasma Slashes (multi-layer crescent energy arc + white hot core)
    for (const s of this.slashes) {
      const alpha = Math.max(0, s.life / s.maxLife);
      const rArc = s.radius * (0.76 + (1 - alpha) * 0.14);
      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.x, s.y, rArc, s.angle - s.spread / 2, s.angle + s.spread / 2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rArc, s.angle - s.spread / 2, s.angle + s.spread / 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rArc + 2, s.angle - s.spread * 0.42, s.angle + s.spread * 0.42);
      ctx.stroke();
      ctx.restore();
    }

    // Lightning (outer plasma glow + crisp jagged white core)
    for (const l of this.lightnings) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, l.life * 4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      l.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // Projectiles (fast layered neon glow—zero heavy shadowBlur)
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.boomerang) {
        ctx.rotate(this.elapsedSec * 16);
        ctx.strokeStyle = 'rgba(244,63,94,0.35)';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, -Math.PI * 0.72, Math.PI * 0.72);
        ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.isArrow) {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.rotate(ang);
        // Energy streak tail
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-28, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Shaft
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(9, 0);
        ctx.stroke();
        // Fletching feathers
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.lineTo(-18, -4.5);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-18, 4.5);
        ctx.closePath();
        ctx.fill();
        // Plasma Arrowhead
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(6, -5);
        ctx.lineTo(8, 0);
        ctx.lineTo(6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(8, -2);
        ctx.lineTo(8, 2);
        ctx.closePath();
        ctx.fill();
      } else if (p.isMagicOrb) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        // Rotating arcane rune ring
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.38, this.elapsedSec * 7, this.elapsedSec * 7 + Math.PI * 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.38, this.elapsedSec * 7 + Math.PI * 1.25, this.elapsedSec * 7 + Math.PI * 1.9);
        ctx.stroke();
      } else if (!p.fromEnemy) {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.rotate(ang);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(-p.radius * 2.1, -p.radius * 1.0, p.radius * 4.2, p.radius * 2.0);
        ctx.globalAlpha = 1;
        ctx.fillRect(-p.radius * 1.4, -p.radius * 0.65, p.radius * 2.8, p.radius * 1.3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-p.radius * 0.6, -p.radius * 0.3, p.radius * 1.4, p.radius * 0.6);
      } else {
        ctx.fillStyle = 'rgba(244,63,94,0.32)';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    // Player Hero (Full animated character with Aura, Shield, Sword / Staff / Bow)
    this.drawPlayerCharacter(ctx);

    // Crisp Outlined Floating Damage Numbers (Crits larger + gold glow)
    for (const f of this.floats) {
      ctx.save();
      const alpha = Math.min(1, f.life * 2.6);
      ctx.globalAlpha = alpha;
      const isCritText = f.text.endsWith('!');
      const pop = f.scale * (isCritText && f.life > 0.45 ? 1.15 : 1.0);
      ctx.font = `900 ${Math.round(13 * pop)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = isCritText ? 4 : 3;
      ctx.strokeStyle = isCritText ? 'rgba(120, 53, 15, 0.92)' : 'rgba(2, 6, 23, 0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    ctx.restore();

    // Off-screen indicators for Boss / Chests / Goblins
    const markers: { x: number; y: number; color: string; label: string }[] = [];
    for (const e of this.enemies) {
      if (e.kind === 'boss' || e.kind === 'elite' || e.kind === 'goblin') {
        markers.push({
          x: e.x,
          y: e.y,
          color: e.kind === 'boss' ? '#ef4444' : e.kind === 'elite' ? '#e879f9' : '#fbbf24',
          label: e.kind === 'boss' ? 'BOSS' : e.kind === 'elite' ? 'ELITE' : '$',
        });
      }
    }
    for (const p of this.pickups) {
      if (p.kind === 'chest') markers.push({ x: p.x, y: p.y, color: '#fbbf24', label: '🎁' });
    }
    for (const m of markers) {
      const sx = m.x - camX;
      const sy = m.y - camY;
      if (sx >= 16 && sx <= w - 16 && sy >= 16 && sy <= h - 16) continue;
      const ang = Math.atan2(sy - h / 2, sx - w / 2);
      const pad = 26;
      const ix = Math.max(pad, Math.min(w - pad, w / 2 + Math.cos(ang) * (w / 2 - pad)));
      const iy = Math.max(pad + 60, Math.min(h - pad - 60, h / 2 + Math.sin(ang) * (h / 2 - pad)));
      ctx.save();
      ctx.translate(ix, iy);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, 0, 3);
      ctx.restore();
    }

    // Virtual Floating Joystick HUD
    if (this.touchActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.fillStyle = 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.touchStartX, this.touchStartY, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.hero.accentColor;
      ctx.beginPath();
      ctx.arc(this.touchStartX + this.joyX * 44, this.touchStartY + this.joyY * 44, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlayerCharacter(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.65;
    }

    // Pickup Magnet subtle halo
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.px, this.py, this.getPickupRadius(), 0, Math.PI * 2);
    ctx.stroke();

    // Hero Glowing Aura Rings beneath feet
    const auraPulse = 22 + Math.sin(this.elapsedSec * 4.5) * 2.5;
    ctx.save();
    ctx.strokeStyle = this.ultCharge >= 100 ? '#fbbf24' : this.hero.accentColor;
    ctx.globalAlpha = this.ultCharge >= 100 ? 0.55 : 0.3;
    ctx.lineWidth = this.ultCharge >= 100 ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.ellipse(this.px, this.py + 16, auraPulse, auraPulse * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const dirX = Math.cos(this.weaponAimAngle) >= 0 ? 1 : -1;
    const walkSwing = this.isMoving ? Math.sin(this.walkPhase) * 6 : 0;
    const bob = this.isMoving ? Math.abs(Math.sin(this.walkPhase)) * 3 : Math.sin(this.elapsedSec * 3.2) * 0.9;

    ctx.save();
    ctx.translate(this.px, this.py);

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, 19, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle hero aura glow
    ctx.fillStyle = `${this.hero.accentColor}26`;
    ctx.beginPath();
    ctx.arc(0, -2 - bob * 0.5, 22, 0, Math.PI * 2);
    ctx.fill();

    // Flowing cape
    const capeWave = this.isMoving ? Math.sin(this.walkPhase * 1.1) * 4 : Math.sin(this.elapsedSec * 2.5) * 1.5;
    ctx.fillStyle = this.hero.secondaryColor;
    ctx.beginPath();
    ctx.moveTo(-4 * dirX, -6 - bob);
    ctx.lineTo(-15 * dirX + capeWave * 0.4, 15 - bob * 0.5);
    ctx.lineTo(3 * dirX, 14 - bob * 0.5);
    ctx.closePath();
    ctx.fill();

    // Boots
    const drawBoot = (xOff: number, swing: number) => {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = this.hero.accentColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(xOff - 3.5, 8 + swing * 0.55 - bob * 0.3, 7, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = this.hero.secondaryColor;
      ctx.fillRect(xOff - 3 + dirX * 1.5, 14 + swing * 0.55 - bob * 0.3, 6, 4);
    };
    drawBoot(-5, walkSwing);
    drawBoot(5, -walkSwing);

    // Armored torso
    ctx.fillStyle = this.hero.secondaryColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-10, -7 - bob, 20, 17, 5);
    ctx.fill();
    ctx.stroke();

    // Chestplate & energy belt
    ctx.fillStyle = this.hero.accentColor;
    ctx.beginPath();
    ctx.roundRect(-7, -5 - bob, 14, 9, 3);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-9, 5 - bob, 18, 3);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-2, 4.5 - bob, 4, 4);

    // Pauldrons
    ctx.fillStyle = this.hero.accentColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-10, -4 - bob, 4.2, 0, Math.PI * 2);
    ctx.arc(10, -4 - bob, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Back arm
    ctx.fillStyle = this.hero.secondaryColor;
    ctx.beginPath();
    ctx.arc(-11 * dirX, 2 - bob - walkSwing * 0.35, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // Head & Helmet
    const headY = -14 - bob;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = this.hero.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hero crest
    ctx.fillStyle = this.hero.accentColor;
    if (this.hero.id === 'kael') {
      ctx.beginPath();
      ctx.moveTo(-8 * dirX, headY - 4);
      ctx.lineTo(-16 * dirX - capeWave * 0.5, headY - 8);
      ctx.lineTo(-13 * dirX, headY - 1);
      ctx.closePath();
      ctx.fill();
    } else if (this.hero.id === 'nova') {
      ctx.beginPath();
      ctx.moveTo(-7, headY - 7);
      ctx.lineTo(0, headY - 16);
      ctx.lineTo(7, headY - 7);
      ctx.closePath();
      ctx.fill();
    } else if (this.hero.id === 'titan') {
      ctx.fillRect(-7, headY - 11, 14, 4);
    } else {
      ctx.beginPath();
      ctx.moveTo(-8, headY - 5);
      ctx.lineTo(-11, headY - 14);
      ctx.lineTo(-3, headY - 8);
      ctx.moveTo(8, headY - 5);
      ctx.lineTo(11, headY - 14);
      ctx.lineTo(3, headY - 8);
      ctx.fill();
    }

    // Visor & eyes
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.roundRect(dirX * 2 - 6, headY - 3, 12, 5.5, 2.5);
    ctx.fill();
    ctx.fillStyle = this.hero.secondaryColor;
    ctx.beginPath();
    ctx.arc(dirX * 2 - 2.5, headY - 0.2, 1.5, 0, Math.PI * 2);
    ctx.arc(dirX * 2 + 2.5, headY - 0.2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Weapon in hand
    const atkFrac = this.attackAnimTimer > 0 ? 1 - this.attackAnimTimer / Math.max(0.01, this.attackAnimDuration) : 0;
    ctx.save();
    ctx.translate(dirX * 5, -1 - bob);

    if (this.weaponStyle === 'sword') {
      const swingOffset = this.attackAnimTimer > 0 ? -1.35 + atkFrac * 2.7 : -0.35 * dirX;
      ctx.rotate(this.weaponAimAngle + swingOffset);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(10, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(6, -1.8, 7, 3.6);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(12, -6.5, 3, 13);
      ctx.fillStyle = 'rgba(56,189,248,0.28)';
      ctx.beginPath();
      ctx.ellipse(29, 0, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(15, -3.2);
      ctx.lineTo(38, -2);
      ctx.lineTo(43, 0);
      ctx.lineTo(38, 2);
      ctx.lineTo(15, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (this.weaponStyle === 'staff') {
      const thrust = this.attackAnimTimer > 0 ? Math.sin(atkFrac * Math.PI) * 8 : 0;
      ctx.rotate(this.weaponAimAngle);
      ctx.translate(thrust, 0);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(10, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.fillRect(-6, -2, 34, 4);
      ctx.strokeRect(-6, -2, 34, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(27, -5);
      ctx.lineTo(33, -7);
      ctx.lineTo(31, 0);
      ctx.lineTo(33, 7);
      ctx.lineTo(27, 5);
      ctx.closePath();
      ctx.fill();
      const orbPulse = 6.2 + Math.sin(this.elapsedSec * 9) * 1.1 + (this.attackAnimTimer > 0 ? 2.5 : 0);
      ctx.fillStyle = 'rgba(192,132,252,0.32)';
      ctx.beginPath();
      ctx.arc(34, 0, orbPulse * 1.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(34, 0, orbPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(33, -1.5, orbPulse * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const drawPull = this.attackAnimTimer > 0 ? Math.sin(atkFrac * Math.PI) * 6 : 2;
      ctx.rotate(this.weaponAimAngle);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(13, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, -16);
      ctx.quadraticCurveTo(21, 0, 8, 16);
      ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(8, -15);
      ctx.lineTo(6 - drawPull, 0);
      ctx.lineTo(8, 15);
      ctx.stroke();
      if (this.attackAnimTimer <= 0.12) {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6 - drawPull, 0);
        ctx.lineTo(25 - drawPull * 0.5, 0);
        ctx.stroke();
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(29 - drawPull * 0.5, 0);
        ctx.lineTo(22 - drawPull * 0.5, -3);
        ctx.lineTo(22 - drawPull * 0.5, 3);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // Invulnerability / Dash Energy Shield Bubble
    if (this.invulnTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -1, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Overhead / Under-foot HP bar
    const barW = 36;
    const hpFrac = Math.max(0, Math.min(1, this.hp / this.getEffectiveMaxHp()));
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(this.px - barW / 2, this.py + 25, barW, 5);
    ctx.fillStyle = hpFrac > 0.35 ? '#10b981' : '#ef4444';
    ctx.fillRect(this.px - barW / 2, this.py + 25, barW * hpFrac, 5);
    ctx.restore();
  }

  private drawMonster(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const isFlashing = e.hitFlash > 0;
    const fill = isFlashing ? '#ffffff' : e.slowTimer > 0 ? '#60a5fa' : e.color;
    const face = this.px >= e.x ? 1 : -1;
    const waggle = Math.sin(this.elapsedSec * 9 + e.animSeed);
    const hop = Math.abs(waggle) * 2.2;
    const r = e.radius;

    ctx.save();
    ctx.translate(e.x, e.y);

    // Boss Attack Warning Telegraph
    if (e.kind === 'boss' && e.bossPatternTimer < 0.78) {
      const warnFrac = 1 - Math.max(0, e.bossPatternTimer) / 0.78;
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.globalAlpha = 0.45 + warnFrac * 0.45;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.35 + warnFrac * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Ground shadow under entity
    ctx.fillStyle = 'rgba(0,0,0,0.46)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.85, r * 0.88, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mutant / Empowered Monster Aura
    if (e.tier >= 1) {
      ctx.save();
      ctx.strokeStyle = e.tier === 2 ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = e.tier === 2 ? 2.6 : 1.8;
      ctx.globalAlpha = 0.72 + Math.sin(this.elapsedSec * 7 + e.animSeed) * 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(0, -hop);

    if (e.kind === 'boss') {
      const flap = Math.sin(this.elapsedSec * 5 + e.animSeed) * 8;
      ctx.fillStyle = isFlashing ? '#ffffff' : '#7f1d1d';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.5, -r * 0.1);
        ctx.lineTo(side * r * 1.45, -r * 0.65 + flap);
        ctx.lineTo(side * r * 1.25, r * 0.2 + flap * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.35, -r * 0.7);
        ctx.lineTo(side * r * 0.9, -r * 1.35);
        ctx.lineTo(side * r * 0.62, -r * 0.55);
        ctx.closePath();
        ctx.fill();
      }
      // Glowing eyes
      ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
      ctx.beginPath();
      ctx.arc(-r * 0.32, -r * 0.18, r * 0.22, 0, Math.PI * 2);
      ctx.arc(r * 0.32, -r * 0.18, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-r * 0.32, -r * 0.18, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.32, -r * 0.18, r * 0.14, 0, Math.PI * 2);
      ctx.arc(0, -r * 0.38, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-r * 0.48, r * 0.16, r * 0.96, r * 0.38, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let t = -3; t <= 3; t++) {
        ctx.beginPath();
        ctx.moveTo(t * r * 0.12 - 3, r * 0.16);
        ctx.lineTo(t * r * 0.12, r * 0.34);
        ctx.lineTo(t * r * 0.12 + 3, r * 0.16);
        ctx.fill();
      }
    } else if (e.kind === 'elite') {
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(-r * 0.85, waggle * 3, r * 0.32, 0, Math.PI * 2);
      ctx.arc(r * 0.85, -waggle * 3, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, -r * 0.78, r * 1.6, r * 1.56, r * 0.55);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.3, -r * 0.72);
        ctx.lineTo(side * r * 0.8, -r * 1.28);
        ctx.lineTo(side * r * 0.58, -r * 0.62);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 2, -r * 0.12, 6, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 2, -r * 0.12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 2, -r * 0.12, 4, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 2, -r * 0.12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r * 0.38, r * 0.22, r * 0.76, r * 0.24);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.32, r * 0.22, 4, 5);
      ctx.fillRect(r * 0.18, r * 0.22, 4, 5);
    } else if (e.kind === 'sentinel') {
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-r * 0.92, 2 + waggle * 3, r * 0.32, 0, Math.PI * 2);
      ctx.arc(r * 0.92, 2 - waggle * 3, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-r * 0.85, -r * 0.82, r * 1.7, r * 1.64, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r * 0.5, -r * 0.35, r, r * 0.28);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.beginPath();
      ctx.arc(-r * 0.22 + face * 2, -r * 0.2, 4.5, 0, Math.PI * 2);
      ctx.arc(r * 0.22 + face * 2, -r * 0.2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-r * 0.22 + face * 2, -r * 0.2, 2.8, 0, Math.PI * 2);
      ctx.arc(r * 0.22 + face * 2, -r * 0.2, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, r * 0.42);
      ctx.lineTo(-r * 0.24, r * 0.14);
      ctx.lineTo(-r * 0.12, r * 0.42);
      ctx.moveTo(r * 0.12, r * 0.42);
      ctx.lineTo(r * 0.24, r * 0.14);
      ctx.lineTo(r * 0.36, r * 0.42);
      ctx.fill();
    } else if (e.kind === 'dasher') {
      const wingY = waggle * 5;
      ctx.fillStyle = isFlashing ? '#ffffff' : '#9a3412';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(side * r * 1.45, -r * 0.5 + wingY);
        ctx.lineTo(side * r * 1.0, r * 0.35 + wingY * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.5);
      ctx.lineTo(-r * 0.75, -r * 1.2);
      ctx.lineTo(-r * 0.1, -r * 0.75);
      ctx.moveTo(r * 0.5, -r * 0.5);
      ctx.lineTo(r * 0.75, -r * 1.2);
      ctx.lineTo(r * 0.1, -r * 0.75);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 1.8, -1, 2.6, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 1.8, -1, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#ecfccb';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 2, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.22, 2.6, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.22, 2.6, 0, Math.PI * 2);
      ctx.arc(0, -r * 0.45, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -r * 0.45, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#365314';
      ctx.beginPath();
      ctx.arc(0, r * 0.28, r * 0.4, 0, Math.PI);
      ctx.fill();
    } else if (e.kind === 'splitter') {
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#a855f7';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.6, r * 0.2);
        ctx.quadraticCurveTo(side * r * 1.25, r * 0.5 + waggle * 4, side * r * 1.1, r * 0.95);
        ctx.stroke();
      }
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#f3e8ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.15, 3.2, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.15, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'goblin') {
      ctx.fillStyle = isFlashing ? '#ffffff' : '#92400e';
      ctx.beginPath();
      ctx.arc(-face * r * 0.55, -2, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isFlashing ? '#ffffff' : '#22c55e';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isFlashing ? '#ffffff' : '#22c55e';
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, -2);
      ctx.lineTo(-r * 1.35, -7);
      ctx.lineTo(-r * 0.65, 4);
      ctx.moveTo(r * 0.75, -2);
      ctx.lineTo(r * 1.35, -7);
      ctx.lineTo(r * 0.65, 4);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else {
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#881337';
      ctx.lineWidth = 2.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.5, r * 0.2);
        ctx.lineTo(side * r * 1.12, r * 0.65 + side * waggle * 3);
        ctx.moveTo(side * r * 0.55, -r * 0.1);
        ctx.lineTo(side * r * 1.15, -r * 0.15 - side * waggle * 3);
        ctx.stroke();
      }
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.65);
      ctx.lineTo(-r * 0.75, -r * 1.2);
      ctx.lineTo(-r * 0.15, -r * 0.8);
      ctx.moveTo(r * 0.45, -r * 0.65);
      ctx.lineTo(r * 0.75, -r * 1.2);
      ctx.lineTo(r * 0.15, -r * 0.8);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 1.5, -r * 0.15, 2.7, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 1.5, -r * 0.15, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 2, -r * 0.15, 1.1, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 2, -r * 0.15, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r * 0.35, r * 0.2, r * 0.7, r * 0.22);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.28, r * 0.2, 2.5, 3.2);
      ctx.fillRect(r * 0.16, r * 0.2, 2.5, 3.2);
    }

    if (e.tier === 2) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-4, -r * 0.82);
      ctx.lineTo(0, -r * 1.38);
      ctx.lineTo(4, -r * 0.82);
      ctx.closePath();
      ctx.fill();
    }

    // Crisp hit-flash white overlay pulse when damaged
    if (isFlashing) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (e.kind === 'boss' || e.kind === 'elite' || (e.tier >= 1 && e.hp < e.maxHp) || (e.kind === 'sentinel' && e.hp < e.maxHp)) {
      const bw = e.radius * 2.2;
      const frac = Math.max(0, Math.min(1, e.hp / e.maxHp));
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - bw / 2, e.y + e.radius + 6, bw, 4);
      ctx.fillStyle = e.kind === 'boss' ? '#ef4444' : e.tier === 2 ? '#f43f5e' : '#f59e0b';
      ctx.fillRect(e.x - bw / 2, e.y + e.radius + 6, bw * frac, 4);
    }
  }
}
