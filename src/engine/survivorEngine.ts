import {
  ASCENSIONS,
  BOSS_BESTIARY,
  GEAR_TEMPLATES,
  HEROES,
  PASSIVES,
  RELICS,
  WEAPONS,
  WEAPON_STYLES,
  mulberry32,
} from '../data/gameCatalog';
import { audio } from '../services/audio';
import { createGearItem } from '../storage/saveState';
import {
  ActiveRunBoosters,
  AscensionDef,
  AscensionTier,
  BossArchetype,
  ChapterDef,
  CombatStats,
  DailyModifierId,
  DailyRunConfig,
  HeroDef,
  HeroId,
  PassiveId,
  Rarity,
  RelicDef,
  RelicId,
  SavedRunSnapshot,
  WeaponDamageStat,
  WeaponId,
  WeaponStyle,
} from '../types/game';

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

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
  shieldHp: number;
  level: number;
  xpFrac: number;
  elapsedSec: number;
  durationSec: number;
  isEndless: boolean;
  isBossRush: boolean;
  isDaily: boolean;
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
  bossEnraged: boolean;
  weapons: { id: WeaponId; lv: number; evolved: boolean }[];
  passives: { id: PassiveId; lv: number }[];
  relics: RelicId[];
  rerollsLeft: number;
  banishesLeft: number;
  objectiveLabel: string | null;
  objectiveProgress: number;
}

interface Enemy {
  id: number;
  kind: 'swarmer' | 'dasher' | 'sentinel' | 'spitter' | 'splitter' | 'goblin' | 'elite' | 'boss';
  tier: 0 | 1 | 2; // 0 = normal, 1 = Empowered, 2 = Apex Mutant
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
  burnTimer: number;
  burnDps: number;
  shootTimer: number;
  bossPatternTimer: number;
  bossArchetype?: BossArchetype;
  enraged?: boolean;
  bossState?: 'chase' | 'telegraph_laser' | 'firing_laser' | 'telegraph_dash' | 'dashing' | 'telegraph_meteor';
  bossStateTimer?: number;
  bossAimAngle?: number;
  bossDashChains?: number;
  bossDrones?: number;
}

interface Projectile {
  fromEnemy: boolean;
  sourceId: string;
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
  isSolarLance?: boolean;
  isTurretLaser?: boolean;
  isIceShard?: boolean;
  scorchTrailAccum?: number;
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
  maxLife: number;
}

interface RingWave {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  isFrost?: boolean;
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

interface GroundDecal {
  kind: 'scorch' | 'frost' | 'crater' | 'magma_enemy';
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  dps: number;
  tickAccum: number;
  sourceId: string;
}

interface MeteorTelegraph {
  fromEnemy: boolean;
  x: number;
  y: number;
  radius: number;
  delay: number;
  maxDelay: number;
  damage: number;
  color: string;
  sourceId: string;
}

interface SpawnTelegraph {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface PlasmaMine {
  x: number;
  y: number;
  radius: number;
  damage: number;
  life: number;
}

interface DeployedTurret {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  cd: number;
  angle: number;
}

interface WorldObjective {
  kind: 'shrine' | 'supply_pod';
  x: number;
  y: number;
  radius: number;
  progress: number; // 0..3.5 sec
  duration: number;
  tickSoundAccum: number;
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
  additive?: boolean;
  shard?: boolean;
  rot?: number;
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
  onLevelUp: (choices: DraftOption[], rerollsLeft: number, banishesLeft: number) => void;
  onRelicChoice: (choices: RelicDef[]) => void;
  onChestJackpot: (rewards: DraftOption[], bonusCoins: number) => void;
  onBossBanner: (bossName: string) => void;
  onWaveBanner: (message: string) => void;
  onDeathOffer: () => void;
  onAutoSave?: (snap: SavedRunSnapshot) => void;
  onFinish: (result: {
    victory: boolean;
    survivedSec: number;
    kills: number;
    bossesKilled: number;
    shrinesClaimed: number;
    coinsEarned: number;
    gemsEarned: number;
    blueprintsEarned: number;
    levelReached: number;
    evolutionsUnlocked: string[];
    evoIdsUnlocked: WeaponId[];
    relicsCollected: RelicId[];
    bossArchetypesDefeated: BossArchetype[];
    maxCombo: number;
    score: number;
    weaponBreakdown: WeaponDamageStat[];
    newGearDrop: ReturnType<typeof createGearItem> | null;
  }) => void;
}

const SPATIAL_CELL = 56;

export class SurvivorEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chapter: ChapterDef;
  private ascensionDef: AscensionDef;
  private dailyConfig: DailyRunConfig | null;
  private dailyMods = new Set<DailyModifierId>();
  private rng: () => number;
  private hero: HeroDef;
  private weaponStyle: WeaponStyle;
  private primaryWeaponId: WeaponId;
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
  private autoSaveAccum = 0;
  private hitstopTimer = 0;
  private lastHitstopAt = 0;

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
  private shieldHp = 0;
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
  private shrinesClaimed = 0;
  private coinsEarned = 0;
  private gemsEarned = 0;
  private revivesLeft: number;
  private rerollsLeft: number;
  private banishesLeft: number;
  private screenShake = 0;

  // Loadout & Progression
  private weapons = new Map<WeaponId, { lv: number; cd: number; evolved: boolean }>();
  private passives = new Map<PassiveId, number>();
  private relics = new Set<RelicId>();
  private banishedIds = new Set<string>();
  private evosUnlocked: string[] = [];
  private evoIdsUnlocked: WeaponId[] = [];
  private bossArchetypesDefeated = new Set<BossArchetype>();
  private weaponDamage = new Map<string, number>();
  private orbitalAngle = 0;
  private weaponFireCount = 0;

  // Relic / Hero passive timers
  private overclockShieldTimer = 0;
  private magSingularityTimer = 0;
  private pyroAuraTick = 0;

  // Entities
  private nextEnemyId = 1;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private slashes: SlashEffect[] = [];
  private lightnings: LightningArc[] = [];
  private rings: RingWave[] = [];
  private gravZones: GravityZone[] = [];
  private groundDecals: GroundDecal[] = [];
  private meteorTelegraphs: MeteorTelegraph[] = [];
  private spawnTelegraphs: SpawnTelegraph[] = [];
  private plasmaMines: PlasmaMine[] = [];
  private deployedTurrets: DeployedTurret[] = [];
  private objective: WorldObjective | null = null;
  private nextObjectiveAtSec = 22;
  private objectiveCounter = 0;

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

  // AAA Systems: Companion Drone, Tech Chips, Hero Skin Aura, FTUE & Special Pickup Timer
  private droneId: string | null = null;
  private droneLevel = 1;
  private droneX = 0;
  private droneY = 0;
  private droneAngle = 0;
  private droneCd = 1.5;
  private skinPrimary: string | null = null;
  private skinAura: string | null = null;
  private showFtueHint = false;
  private nextSpecialDropSec = 55;

  constructor(
    canvas: HTMLCanvasElement,
    chapter: ChapterDef,
    heroId: HeroId,
    weaponStyle: WeaponStyle,
    stats: CombatStats,
    damageNumbers: boolean,
    vibration: boolean,
    boosters: ActiveRunBoosters,
    ascension: AscensionTier,
    dailyConfig: DailyRunConfig | null,
    cb: EngineCallbacks,
    aaaOpts?: {
      droneId?: string | null;
      droneLevel?: number;
      techChips?: string[];
      skinPrimary?: string;
      skinAura?: string;
      showFtueHint?: boolean;
    }
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D context unavailable');
    this.ctx = context;
    this.chapter = chapter;
    this.ascensionDef = ASCENSIONS.find((a) => a.tier === ascension) || ASCENSIONS[0];
    this.dailyConfig = dailyConfig;
    if (dailyConfig) {
      for (const m of dailyConfig.modifiers) this.dailyMods.add(m.id);
    }
    this.rng = dailyConfig ? mulberry32(dailyConfig.seed) : Math.random;
    this.hero = HEROES.find((h) => h.id === heroId) || HEROES[0];
    this.weaponStyle = weaponStyle;

    this.droneId = aaaOpts?.droneId || null;
    this.droneLevel = Math.max(1, aaaOpts?.droneLevel || 1);
    this.skinPrimary = aaaOpts?.skinPrimary || null;
    this.skinAura = aaaOpts?.skinAura || null;
    this.showFtueHint = Boolean(aaaOpts?.showFtueHint);

    // Apply boosters, Tech Chips & daily run stat modifiers
    let modStats: CombatStats = { ...stats };
    const chipCount = aaaOpts?.techChips?.length || 0;
    if (chipCount > 0) {
      modStats.atk = Math.round(modStats.atk * (1 + chipCount * 0.12));
      modStats.projPowerMult = Number((modStats.projPowerMult + chipCount * 0.1).toFixed(2));
    }
    if (boosters.overdriveAtk) {
      modStats.atk = Math.round(modStats.atk * 1.25);
    }
    if (this.dailyMods.has('glass_cannon')) {
      modStats.atk = Math.round(modStats.atk * 1.4);
      modStats.maxHp = Math.max(60, Math.round(modStats.maxHp * 0.8));
    }
    if (this.dailyMods.has('crit_storm')) {
      modStats.critChance = Math.min(0.95, modStats.critChance + 0.22);
    }
    if (this.dailyMods.has('low_gravity')) {
      modStats.moveSpeed = Math.round(modStats.moveSpeed * 1.2);
    }
    if (this.dailyMods.has('hyper_haste')) {
      modStats.cooldownMult = Math.max(0.32, modStats.cooldownMult * 0.75);
    }
    if (this.dailyMods.has('swarm_frenzy')) {
      modStats.xpMult *= 1.4;
    }

    this.stats = modStats;
    this.boosters = boosters;
    this.damageNumbers = damageNumbers;
    this.vibration = vibration;
    this.cb = cb;

    this.hp = this.stats.maxHp;
    this.revivesLeft = this.stats.revives;
    this.rerollsLeft = this.stats.rerolls;
    this.banishesLeft = this.stats.banishes;

    const styleDef = WEAPON_STYLES.find((s) => s.id === weaponStyle) || WEAPON_STYLES[0];
    const startWId: WeaponId =
      weaponStyle === 'signature' || !styleDef.weaponId ? this.hero.startingWeapon : styleDef.weaponId;
    this.primaryWeaponId = startWId;
    this.weapons.set(startWId, { lv: 1, cd: 0.2, evolved: false });

    if (boosters.extraWeapon) {
      const others = WEAPONS.filter((w) => w.id !== startWId);
      const bonusW = others[Math.floor(this.rng() * others.length)];
      if (bonusW) {
        this.weapons.set(bonusW.id, { lv: 1, cd: 0.35, evolved: false });
      }
    }

    if (chapter.mode === 'boss_rush') {
      this.xp = this.xpNext;
    }

    for (let i = 0; i < 30; i++) {
      this.ambientMotes.push({
        rx: Math.random(),
        ry: Math.random(),
        vx: (Math.random() - 0.5) * 0.026,
        vy: -0.015 - Math.random() * 0.026,
        size: 1.4 + Math.random() * 2.5,
        alpha: 0.18 + Math.random() * 0.44,
      });
    }

    this.resize();
    this.bindInput();
  }

  private rand(): number {
    return this.rng();
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
      if (!this.ended && this.cb.onAutoSave) {
        this.cb.onAutoSave(this.exportSnapshot());
      }
    } else {
      this.lastTs = performance.now();
    }
  };

  private onOrientationChange = () => {
    window.setTimeout(() => this.resize(), 80);
  };

  private isInsideActionButtons(clientX: number, clientY: number): boolean {
    const actionsEl = document.querySelector<HTMLElement>('.battle-actions-br');
    if (actionsEl) {
      const r = actionsEl.getBoundingClientRect();
      const pad = 8;
      if (clientX >= r.left - pad && clientX <= r.right + pad && clientY >= r.top - pad && clientY <= r.bottom + pad) {
        return true;
      }
    }
    const pauseEl = document.querySelector<HTMLElement>('#btn-battle-pause');
    if (pauseEl) {
      const r = pauseEl.getBoundingClientRect();
      if (clientX >= r.left - 6 && clientX <= r.right + 6 && clientY >= r.top - 6 && clientY <= r.bottom + 6) {
        return true;
      }
    }
    return false;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.paused || this.ended) return;
    if (this.activePointerId !== null) return;
    if (this.isInsideActionButtons(e.clientX, e.clientY)) return;
    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
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
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = dpr;
    this.width = Math.max(300, Math.round(rect.width) || window.innerWidth || 390);
    this.height = Math.max(300, Math.round(rect.height) || window.innerHeight || 780);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  start(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resize();
    this.emitHud();
    this.lastTs = performance.now();
    audio.startMusicLoop();
    const tick = (now: number) => {
      if (this.ended) {
        this.rafId = null;
        return;
      }
      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
      this.lastTs = now;
      try {
        const cw = this.canvas.clientWidth;
        const ch = this.canvas.clientHeight;
        if (cw >= 300 && ch >= 300 && (Math.abs(cw - this.width) > 1 || Math.abs(ch - this.height) > 1)) {
          this.resize();
        }
        if (!this.paused) {
          if (this.hitstopTimer > 0) {
            this.hitstopTimer = Math.max(0, this.hitstopTimer - rawDt);
          } else {
            this.update(rawDt);
          }
        }
        if (this.ended) {
          this.rafId = null;
          return;
        }
        this.render();
      } catch (err) {
        console.error('SurvivorEngine frame error:', err);
      }
      if (!this.ended) {
        this.rafId = requestAnimationFrame(tick);
      }
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
    audio.setBossIntensity(false);
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
    audio.setMusicPaused(p);
    if (p) {
      this.resetInputState();
      if (!this.ended && this.cb.onAutoSave) {
        this.cb.onAutoSave(this.exportSnapshot());
      }
    } else {
      this.lastTs = performance.now();
    }
  }

  exportSnapshot(): SavedRunSnapshot {
    return {
      version: 2,
      savedAt: Date.now(),
      chapterId: this.chapter.id,
      ascension: this.ascensionDef.tier,
      dailyDateKey: this.dailyConfig?.dateKey,
      heroId: this.hero.id,
      weaponStyle: this.weaponStyle,
      boosters: { ...this.boosters },
      px: Math.round(this.px),
      py: Math.round(this.py),
      hp: Math.round(this.hp),
      shieldHp: Math.round(this.shieldHp),
      level: this.level,
      xp: Math.round(this.xp),
      xpNext: Math.round(this.xpNext),
      elapsedSec: Math.round(this.elapsedSec * 10) / 10,
      threatLevel: this.threatLevel,
      lastSurgeSec: this.lastSurgeSec,
      kills: this.kills,
      maxCombo: this.maxCombo,
      bossesKilled: this.bossesKilled,
      shrinesClaimed: this.shrinesClaimed,
      coinsEarned: Math.round(this.coinsEarned),
      gemsEarned: Math.round(this.gemsEarned),
      ultCharge: Math.round(this.ultCharge),
      revivesLeft: this.revivesLeft,
      rerollsLeft: this.rerollsLeft,
      banishesLeft: this.banishesLeft,
      bossSpawned: this.bossSpawned,
      bossRushStage: this.bossRushStage,
      eliteSpawnedMin: Array.from(this.eliteSpawnedMin),
      weapons: Array.from(this.weapons.entries()).map(([id, s]) => ({ id, lv: s.lv, evolved: s.evolved })),
      passives: Array.from(this.passives.entries()).map(([id, lv]) => ({ id, lv })),
      relics: Array.from(this.relics),
      banishedIds: Array.from(this.banishedIds),
      evosUnlocked: [...this.evosUnlocked],
      evoIdsUnlocked: [...this.evoIdsUnlocked],
      bossArchetypesDefeated: Array.from(this.bossArchetypesDefeated),
      weaponDamage: Object.fromEntries(this.weaponDamage.entries()),
    };
  }

  restoreSnapshot(snap: SavedRunSnapshot): void {
    this.px = snap.px || 0;
    this.py = snap.py || 0;
    this.level = Math.max(1, snap.level || 1);
    this.xp = Math.max(0, snap.xp || 0);
    this.xpNext = Math.max(20, snap.xpNext || 24);
    this.elapsedSec = Math.max(0, snap.elapsedSec || 0);
    this.threatLevel = Math.max(1, snap.threatLevel || 1);
    this.lastSurgeSec = snap.lastSurgeSec || 0;
    this.kills = snap.kills || 0;
    this.maxCombo = snap.maxCombo || 0;
    this.bossesKilled = snap.bossesKilled || 0;
    this.shrinesClaimed = snap.shrinesClaimed || 0;
    this.coinsEarned = snap.coinsEarned || 0;
    this.gemsEarned = snap.gemsEarned || 0;
    this.ultCharge = Math.max(0, Math.min(100, snap.ultCharge || 0));
    this.revivesLeft = Math.max(0, snap.revivesLeft ?? this.stats.revives);
    this.rerollsLeft = Math.max(0, snap.rerollsLeft ?? this.stats.rerolls);
    this.banishesLeft = Math.max(0, snap.banishesLeft ?? this.stats.banishes);
    this.bossSpawned = Boolean(snap.bossSpawned);
    this.bossRushStage = snap.bossRushStage || 0;
    this.eliteSpawnedMin = new Set(snap.eliteSpawnedMin || []);
    this.weapons.clear();
    for (const w of snap.weapons) {
      this.weapons.set(w.id, { lv: w.lv, cd: 0.25, evolved: w.evolved });
    }
    if (this.weapons.size === 0) {
      this.weapons.set(this.primaryWeaponId, { lv: 1, cd: 0.2, evolved: false });
    } else {
      this.primaryWeaponId = snap.weapons[0].id;
    }
    this.passives.clear();
    for (const p of snap.passives || []) {
      this.passives.set(p.id, p.lv);
    }
    this.relics = new Set(snap.relics || []);
    this.banishedIds = new Set(snap.banishedIds || []);
    this.evosUnlocked = [...(snap.evosUnlocked || [])];
    this.evoIdsUnlocked = [...(snap.evoIdsUnlocked || [])];
    this.bossArchetypesDefeated = new Set(snap.bossArchetypesDefeated || []);
    this.weaponDamage.clear();
    for (const [k, v] of Object.entries(snap.weaponDamage || {})) {
      if (Number.isFinite(v) && v > 0) this.weaponDamage.set(k, v);
    }

    const effMax = this.getEffectiveMaxHp();
    this.hp = Math.max(1, Math.min(effMax, snap.hp || effMax));
    this.shieldHp = Math.max(0, snap.shieldHp || 0);
    this.invulnTimer = 2.0; // Grace invulnerability on resume
    this.nextObjectiveAtSec = this.elapsedSec + 20;

    // If chapter boss was already spawned before save, re-spawn boss if chapter wasn't finished
    if (this.chapter.mode === 'chapter' && this.bossSpawned) {
      this.bossSpawned = false;
    }
    this.emitHud();
  }

  getLoadoutSnapshot(): {
    weapons: { id: WeaponId; lv: number; evolved: boolean }[];
    passives: { id: PassiveId; lv: number }[];
    relics: RelicId[];
  } {
    return {
      weapons: Array.from(this.weapons.entries()).map(([id, s]) => ({ id, lv: s.lv, evolved: s.evolved })),
      passives: Array.from(this.passives.entries()).map(([id, lv]) => ({ id, lv })),
      relics: Array.from(this.relics),
    };
  }

  private triggerHitstop(sec = 0.03): void {
    const now = performance.now();
    if (now - this.lastHitstopAt < 260) return;
    this.lastHitstopAt = now;
    this.hitstopTimer = Math.max(this.hitstopTimer, sec);
  }

  private healPlayer(amount: number): void {
    if (amount <= 0) return;
    const mult = this.relics.has('vampiric_core') ? 1.2 : 1.0;
    const maxHp = this.getEffectiveMaxHp();
    this.hp = Math.min(maxHp, this.hp + Math.round(amount * mult));
  }

  triggerDash(): void {
    if (this.paused || this.ended || this.dashCd > 0) return;
    const speedMult =
      (1 + (this.passives.get('dark_matter') || 0) * 0.09) *
      (this.dailyMods.has('low_gravity') ? 1.25 : 1) *
      (this.relics.has('quantum_accel') ? 1.1 : 1);
    this.dashMaxCd = Math.max(1.3, 2.9 / speedMult);
    this.dashCd = this.dashMaxCd;
    this.dashTimer = 0.2;
    this.invulnTimer = Math.max(this.invulnTimer, 0.38);
    const angle = this.facingAngle;
    this.dashVx = Math.cos(angle) * 650;
    this.dashVy = Math.sin(angle) * 650;
    audio.playDash();
    this.spawnRing(this.px, this.py, 58, this.hero.accentColor, 0.26);

    // Relic: Plasma Dash Mines
    if (this.relics.has('plasma_mines')) {
      for (let i = 0; i < 3; i++) {
        const backDist = 14 + i * 24;
        this.plasmaMines.push({
          x: this.px - Math.cos(angle) * backDist + (Math.random() - 0.5) * 16,
          y: this.py - Math.sin(angle) * backDist + (Math.random() - 0.5) * 16,
          radius: 42,
          damage: this.stats.atk * 2.2 * this.getDamageMult(),
          life: 8.5,
        });
      }
    }

    for (let i = 0; i < 12; i++) {
      const spread = angle + Math.PI + (Math.random() - 0.5) * 0.9;
      const spd = 75 + Math.random() * 145;
      this.spawnParticle(
        this.px,
        this.py,
        Math.cos(spread) * spd,
        Math.sin(spread) * spd,
        3.4,
        this.hero.accentColor,
        0.28,
        true
      );
    }
  }

  triggerUltimate(): void {
    if (this.paused || this.ended || this.ultCharge < 100) return;
    this.ultCharge = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 1.05);
    this.screenShake = 13;
    audio.playUltimate();
    if (this.vibration && navigator.vibrate) navigator.vibrate([40, 30, 70]);

    const baseUltDmg = this.stats.atk * 6.0 * this.getDamageMult();

    if (this.hero.id === 'titan') {
      const maxHp = this.getEffectiveMaxHp();
      this.healPlayer(Math.round(maxHp * 0.4));
      this.spawnRing(this.px, this.py, 290, '#f59e0b', 0.45);
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 300) {
          this.damageEnemy(e, baseUltDmg * 1.15, true, 'ult');
          if (e.kind !== 'boss') {
            const ang = Math.atan2(e.y - this.py, e.x - this.px);
            e.x += Math.cos(ang) * 85;
            e.y += Math.sin(ang) * 85;
          }
        }
      }
    } else if (this.hero.id === 'nova') {
      this.spawnRing(this.px, this.py, 230, '#a855f7', 0.36);
      const targets = [...this.enemies].slice(0, 18);
      for (const e of targets) {
        this.pushJaggedLightning(e.x + (Math.random() - 0.5) * 32, e.y - 280, e.x, e.y, '#e879f9', 0.3);
        this.damageEnemy(e, baseUltDmg * 1.25, true, 'ult');
      }
    } else if (this.hero.id === 'aegis') {
      // Aegis Overdrive: 3 supercharged turrets + 90 HP barrier
      this.shieldHp = Math.min(200, this.shieldHp + 90);
      this.spawnRing(this.px, this.py, 200, '#14b8a6', 0.42);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 + this.elapsedSec;
        this.deployedTurrets.push({
          x: this.px + Math.cos(a) * 68,
          y: this.py + Math.sin(a) * 68,
          life: 12.0,
          maxLife: 12.0,
          cd: 0.15,
          angle: a,
        });
      }
      for (const e of [...this.enemies]) {
        if (Math.hypot(e.x - this.px, e.y - this.py) < 210) {
          this.damageEnemy(e, baseUltDmg * 0.75, true, 'ult');
        }
      }
    } else if (this.hero.id === 'pyro') {
      // Solar Cataclysm: 8 blazing solar meteors
      this.spawnRing(this.px, this.py, 240, '#f97316', 0.42);
      for (let i = 0; i < 8; i++) {
        const target = this.enemies[(i * 2) % Math.max(1, this.enemies.length)];
        const ang = (i * Math.PI * 2) / 8;
        const tx = target ? target.x + (Math.random() - 0.5) * 36 : this.px + Math.cos(ang) * 145;
        const ty = target ? target.y + (Math.random() - 0.5) * 36 : this.py + Math.sin(ang) * 145;
        this.meteorTelegraphs.push({
          fromEnemy: false,
          x: tx,
          y: ty,
          radius: 74,
          delay: 0.25 + i * 0.08,
          maxDelay: 0.25 + i * 0.08,
          damage: baseUltDmg * 0.9,
          color: '#f97316',
          sourceId: 'ult',
        });
      }
    } else if (this.hero.id === 'vespera') {
      this.spawnRing(this.px, this.py, 325, '#f43f5e', 0.5);
      let healed = 0;
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < 345) {
          if (e.kind !== 'boss') {
            e.x += (this.px - e.x) * 0.45;
            e.y += (this.py - e.y) * 0.45;
          }
          this.damageEnemy(e, baseUltDmg * 1.12, true, 'ult');
          healed += 2.5;
        }
      }
      this.healPlayer(Math.min(85, healed));
    } else {
      // Kael Omnislash Nova
      this.spawnRing(this.px, this.py, 295, '#38bdf8', 0.45);
      this.slashes.push({
        x: this.px,
        y: this.py,
        angle: 0,
        radius: 235,
        spread: Math.PI * 2,
        color: '#38bdf8',
        life: 0.34,
        maxLife: 0.34,
      });
      for (const e of [...this.enemies]) {
        if (Math.hypot(e.x - this.px, e.y - this.py) < 290) {
          this.damageEnemy(e, baseUltDmg * 1.22, true, 'ult');
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
          subtitle: `EVOLUTION! ${def.evoDesc}`,
          currentLv: 5,
          nextLv: 6,
          color: '#fbbf24',
          isEvo: true,
        });
      }
    }

    // 2. Existing weapons upgrade or new weapons (cap 5 weapons)
    for (const w of WEAPONS) {
      if (this.banishedIds.has(w.id)) continue;
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
          subtitle: `NEW: ${w.shortDesc}`,
          currentLv: 0,
          nextLv: 1,
          color: w.color,
        });
      }
    }

    // 3. Passives (cap 5 passives)
    for (const p of PASSIVES) {
      if (this.banishedIds.has(p.id)) continue;
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
          subtitle: `NEW: ${p.perLevelLabel}`,
          currentLv: 0,
          nextLv: 1,
          color: p.color,
        });
      }
    }

    const evos = pool.filter((o) => o.isEvo);
    const others = pool.filter((o) => !o.isEvo).sort(() => this.rand() - 0.5);
    const picked = [...evos, ...others].slice(0, 3);

    while (picked.length < 3) {
      picked.push({
        kind: 'heal_coins',
        id: 'heal_gold',
        name: 'Nano-Repair & Gold',
        subtitle: 'Restore +35% HP & grab +180 Gold',
        currentLv: 0,
        nextLv: 1,
        color: '#10b981',
      });
    }
    return picked;
  }

  useReroll(): { options: DraftOption[]; rerollsLeft: number; banishesLeft: number } | null {
    if (this.rerollsLeft <= 0) return null;
    this.rerollsLeft -= 1;
    audio.playTap();
    return {
      options: this.buildDraftOptions(),
      rerollsLeft: this.rerollsLeft,
      banishesLeft: this.banishesLeft,
    };
  }

  useBonusReroll(): { options: DraftOption[]; rerollsLeft: number; banishesLeft: number } {
    audio.playTap();
    return {
      options: this.buildDraftOptions(),
      rerollsLeft: this.rerollsLeft,
      banishesLeft: this.banishesLeft,
    };
  }

  banishOption(opt: DraftOption): { options: DraftOption[]; rerollsLeft: number; banishesLeft: number } | null {
    if (this.banishesLeft <= 0 || opt.kind === 'heal_coins' || opt.kind === 'evo') return null;
    this.banishesLeft -= 1;
    this.banishedIds.add(opt.id);
    audio.playTap();
    return {
      options: this.buildDraftOptions(),
      rerollsLeft: this.rerollsLeft,
      banishesLeft: this.banishesLeft,
    };
  }

  private checkPendingLevelUp(): boolean {
    if (this.xp >= this.xpNext && !this.paused && !this.ended) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = Math.round(24 + this.level * 15 + Math.pow(this.level, 1.35) * 4);
      audio.playLevelUp();
      this.setPaused(true);
      this.emitHud();
      this.cb.onLevelUp(this.buildDraftOptions(), this.rerollsLeft, this.banishesLeft);
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
        this.healPlayer(Math.round(this.stats.maxHp * 0.18));
      }
    } else {
      this.healPlayer(Math.round(this.getEffectiveMaxHp() * 0.35));
      this.coinsEarned += 180;
    }

    this.setPaused(false);
    this.emitHud();
    this.checkPendingLevelUp();
  }

  applyRelicChoice(relicId: RelicId): void {
    this.relics.add(relicId);
    if (relicId === 'overclock_shield') {
      this.shieldHp = Math.min(200, this.shieldHp + 50);
    }
    audio.playRelicUnlock();
    this.spawnRing(this.px, this.py, 210, '#fbbf24', 0.45);
    this.setPaused(false);
    this.emitHud();
  }

  revivePlayer(): void {
    if (this.revivesLeft > 0) this.revivesLeft -= 1;

    this.hp = this.getEffectiveMaxHp();
    this.invulnTimer = 2.8;
    this.screenShake = 11;
    this.spawnRing(this.px, this.py, 265, '#10b981', 0.48);
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < 250 && e.kind !== 'boss') {
        const ang = Math.atan2(e.y - this.py, e.x - this.px);
        e.x += Math.cos(ang) * 190;
        e.y += Math.sin(ang) * 190;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.fromEnemy);
    this.setPaused(false);
    this.emitHud();
  }

  private buildWeaponBreakdown(): WeaponDamageStat[] {
    const dur = Math.max(1, this.elapsedSec);
    let total = 0;
    for (const v of this.weaponDamage.values()) total += v;
    if (total <= 0) return [];

    const rows: WeaponDamageStat[] = [];
    for (const [id, dmg] of this.weaponDamage.entries()) {
      if (dmg <= 0) continue;
      let label = id;
      let color = '#38bdf8';
      const wDef = WEAPONS.find((w) => w.id === id);
      if (wDef) {
        const st = this.weapons.get(wDef.id);
        label = st?.evolved ? wDef.evoName : wDef.name;
        color = wDef.color;
      } else if (id === 'ult') {
        label = `Ultimate: ${this.hero.ultName}`;
        color = this.hero.accentColor;
      } else if (id === 'relic') {
        label = 'Relic Effects';
        color = '#fbbf24';
      } else if (id === 'burn') {
        label = 'Solar Burn & Aura';
        color = '#f97316';
      }
      rows.push({
        id,
        label,
        color,
        totalDamage: Math.round(dmg),
        dps: Math.round(dmg / dur),
        sharePct: Math.max(1, Math.round((dmg / total) * 100)),
      });
    }
    rows.sort((a, b) => b.totalDamage - a.totalDamage);
    return rows;
  }

  abortAndFinish(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    if (this.victoryTimer !== null) {
      window.clearTimeout(this.victoryTimer);
      this.victoryTimer = null;
    }
    audio.setBossIntensity(false);
    audio.stopMusicLoop();

    const luckMult = this.boosters.doubleLuck ? 1.5 : 1.0;
    const ascMult = this.ascensionDef.rewardMult;
    const shardDailyMult = this.dailyMods.has('titan_bosses') ? 2.0 : 1.0;

    const bonusCoins = victory ? this.chapter.rewardCoins : Math.round(this.elapsedSec * 8);
    const bonusGems = victory ? this.chapter.rewardGems : Math.floor(this.elapsedSec / 35) * 4;
    const totalCoins = Math.round((this.coinsEarned + bonusCoins) * this.stats.goldMult * luckMult * ascMult);
    const totalGems = Math.round((this.gemsEarned + bonusGems) * ascMult * shardDailyMult);
    const blueprints = Math.max(
      1,
      Math.floor((this.bossesKilled * 3 + this.shrinesClaimed * 2 + this.elapsedSec / 30 + (victory ? 7 : 0)) * ascMult)
    );

    let gearDrop: ReturnType<typeof createGearItem> | null = null;
    if (victory || this.bossesKilled >= 1 || this.elapsedSec >= 75) {
      const tpl = GEAR_TEMPLATES[Math.floor(Math.random() * GEAR_TEMPLATES.length)];
      let rarity: Rarity = 'common';
      const r = Math.random();
      const ascBonus = (this.ascensionDef.tier - 1) * 0.08;
      const rareThresh = (this.boosters.doubleLuck ? 0.44 : 0.28) + ascBonus;
      if (victory && r < 0.08 + ascBonus) rarity = 'epic';
      else if (victory && r < rareThresh) rarity = 'rare';
      else if (r < 0.52 || victory) rarity = 'uncommon';
      gearDrop = createGearItem(tpl.templateId, rarity, 1);
    }

    const score = Math.round(
      (Math.floor(this.elapsedSec) * 18 +
        this.kills * 12 +
        this.bossesKilled * 650 +
        this.shrinesClaimed * 350 +
        this.maxCombo * 6 +
        (victory ? 1500 : 0)) *
        ascMult
    );

    this.cb.onFinish({
      victory,
      survivedSec: Math.floor(this.elapsedSec),
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      shrinesClaimed: this.shrinesClaimed,
      coinsEarned: totalCoins,
      gemsEarned: totalGems,
      blueprintsEarned: blueprints,
      levelReached: this.level,
      evolutionsUnlocked: this.evosUnlocked,
      evoIdsUnlocked: this.evoIdsUnlocked,
      relicsCollected: Array.from(this.relics),
      bossArchetypesDefeated: Array.from(this.bossArchetypesDefeated),
      maxCombo: this.maxCombo,
      score,
      weaponBreakdown: this.buildWeaponBreakdown(),
      newGearDrop: gearDrop,
    });
  }

  private getEffectiveMaxHp(): number {
    const lv = this.passives.get('cryo_reactor') || 0;
    return Math.round(this.stats.maxHp * (1 + lv * 0.18));
  }

  private getCooldownMult(): number {
    const lv = this.passives.get('chrono_core') || 0;
    const relicMult = this.relics.has('quantum_accel') ? 0.9 : 1.0;
    return Math.max(0.32, this.stats.cooldownMult * (1 - lv * 0.08) * relicMult);
  }

  private getDamageMult(): number {
    const lv = this.passives.get('overclock_chip') || 0;
    return 1 + lv * 0.13;
  }

  private getAreaMult(): number {
    const lv = this.passives.get('fusion_cell') || 0;
    return this.stats.areaMult * (1 + lv * 0.15);
  }

  private getPickupRadius(): number {
    const lv = this.passives.get('magnet_halo') || 0;
    const base =
      this.stats.pickupRadius *
      (this.boosters.doubleLuck ? 1.35 : 1) *
      (this.relics.has('mag_singularity') ? 1.25 : 1);
    return Math.round(base * (1 + lv * 0.35));
  }

  private getEnemyPowerPct(): number {
    const scale = (1 + this.elapsedSec * 0.022) * Math.pow(1.18, this.threatLevel - 1) * this.ascensionDef.enemyHpMult;
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

    // Periodic mid-run auto-save every 12 seconds
    this.autoSaveAccum += dt;
    if (this.autoSaveAccum >= 12) {
      this.autoSaveAccum = 0;
      this.cb.onAutoSave?.(this.exportSnapshot());
    }

    // Relic: Overclocked Shield (recharging 50-HP barrier every 12s)
    if (this.relics.has('overclock_shield')) {
      this.overclockShieldTimer += dt;
      if (this.overclockShieldTimer >= 12) {
        this.overclockShieldTimer = 0;
        if (this.shieldHp < 50) {
          this.shieldHp = 50;
          this.spawnRing(this.px, this.py, 54, '#22d3ee', 0.35);
        }
      }
    }

    // Relic: Magnetic Singularity (sweeps XP & Gold every 9s)
    if (this.relics.has('mag_singularity')) {
      this.magSingularityTimer += dt;
      if (this.magSingularityTimer >= 9) {
        this.magSingularityTimer = 0;
        this.spawnRing(this.px, this.py, 190, '#f59e0b', 0.38);
        for (const p of this.pickups) {
          if (p.kind !== 'chest' && Math.hypot(p.x - this.px, p.y - this.py) < 340) {
            p.magnetized = true;
          }
        }
      }
    }

    // Hero Passive: Pyro-Valk Burn Aura
    if (this.hero.id === 'pyro') {
      this.pyroAuraTick += dt;
      if (this.pyroAuraTick >= 0.45) {
        this.pyroAuraTick = 0;
        const auraR = 82 * this.getAreaMult();
        const auraDmg = this.stats.atk * 0.45 * this.getDamageMult();
        for (const e of [...this.enemies]) {
          if (Math.hypot(e.x - this.px, e.y - this.py) <= auraR + e.radius) {
            e.burnTimer = Math.max(e.burnTimer, 1.4);
            e.burnDps = Math.max(e.burnDps, auraDmg * 1.4);
            this.damageEnemy(e, auraDmg, false, 'burn');
          }
        }
      }
    }

    // Progressive Threat / Wave Escalation every 25s
    const computedThreat =
      this.chapter.mode === 'boss_rush'
        ? Math.max(1, this.bossRushStage + 1)
        : Math.floor(this.elapsedSec / 25) + 1;
    if (computedThreat > this.threatLevel) {
      this.threatLevel = computedThreat;
      const pct = this.getEnemyPowerPct();
      this.cb.onWaveBanner(`WAVE ${this.threatLevel}: Enemies escalated (${pct}% power)`);
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
      const mult = this.relics.has('vampiric_core') ? 1.2 : 1.0;
      this.hp = Math.min(maxHp, this.hp + regen * mult * dt);
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
      const spdMult =
        (1 + (this.passives.get('dark_matter') || 0) * 0.09) * (this.relics.has('quantum_accel') ? 1.1 : 1);
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

    // Interactive Starforge Shrines & Supply Pods
    this.updateObjectives(dt);

    // Spawner logic
    if (this.victoryTimer === null) {
      this.updateSpawner(dt);
    }

    // Fire weapons & deployed turrets & mines
    this.updateWeapons(dt);
    this.updateCompanionDrone(dt);
    if (this.elapsedSec >= this.nextSpecialDropSec) {
      this.nextSpecialDropSec += 65;
      const ang = this.rng() * Math.PI * 2;
      const dist = 240 + this.rng() * 140;
      const kind = this.rng() < 0.52 ? 'magnet' : 'bomb';
      this.pickups.push({ kind, x: this.px + Math.cos(ang) * dist, y: this.py + Math.sin(ang) * dist, val: 1, magnetized: false });
      this.cb.onWaveBanner(kind === 'magnet' ? 'SUPER-MAGNET DETECTED!' : 'EMP NUKE BOMB DROPPED!');
    }
    this.updateDeployedTurrets(dt);
    this.updatePlasmaMines(dt);
    this.updateMeteors(dt);
    this.updateGroundDecals(dt);

    // Update projectiles
    this.updateProjectiles(dt);

    // Update gravity zones
    this.updateGravityZones(dt);

    // Update enemies (with spatial grid separation + boss multi-phase AI)
    this.updateEnemies(dt);

    // Update pickups & XP leveling
    this.updatePickups(dt);

    // Update visual FX
    this.slashes = this.slashes.filter((s) => (s.life -= dt) > 0);
    this.lightnings = this.lightnings.filter((l) => (l.life -= dt) > 0);
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    this.spawnTelegraphs = this.spawnTelegraphs.filter((t) => (t.life -= dt) > 0);
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
        if (!this.activeBossId && this.bossRushStage < 6) {
          this.bossRushCooldown -= dt;
          if (this.bossRushCooldown <= 0) {
            this.bossRushStage += 1;
            const arch = Math.min(6, Math.max(1, this.bossRushStage)) as BossArchetype;
            const bInfo = BOSS_BESTIARY.find((b) => b.archetype === arch) || BOSS_BESTIARY[0];
            const label = `Boss ${this.bossRushStage}/6: ${bInfo.name}`;
            this.spawnBoss(label, 0.72 + this.bossRushStage * 0.34, arch);
          }
        }
      } else if (
        (this.chapter.mode === 'chapter' || this.chapter.mode === 'daily') &&
        !this.bossSpawned &&
        this.elapsedSec >= this.chapter.durationSec
      ) {
        this.spawnBoss(this.chapter.bossName, 1.0, this.chapter.bossArchetype);
      } else if (this.chapter.mode === 'endless') {
        const minute = Math.floor(this.elapsedSec / 60);
        if (minute >= 1 && !this.eliteSpawnedMin.has(minute)) {
          this.eliteSpawnedMin.add(minute);
          if (minute % 2 === 0) {
            const arch = (((minute / 2 - 1) % 6) + 1) as BossArchetype;
            const bInfo = BOSS_BESTIARY.find((b) => b.archetype === arch) || BOSS_BESTIARY[0];
            this.spawnBoss(`${bInfo.name} Mk.${minute / 2}`, 1 + minute * 0.17, arch);
          } else {
            this.spawnEnemy('elite');
          }
        }
      } else if (this.chapter.mode === 'chapter' || this.chapter.mode === 'daily') {
        const halfTime = Math.floor(this.chapter.durationSec * 0.45);
        if (this.elapsedSec >= halfTime && !this.eliteSpawnedMin.has(1)) {
          this.eliteSpawnedMin.add(1);
          this.spawnEnemy('elite');
        }
      }
    }

    this.hudAccum += dt;
    if (this.hudAccum >= 0.12) {
      this.hudAccum = 0;
      this.emitHud();
    }
  }

  private updateObjectives(dt: number): void {
    if (!this.objective && this.elapsedSec >= this.nextObjectiveAtSec && this.victoryTimer === null) {
      const ang = this.rand() * Math.PI * 2;
      const dist = 210 + this.rand() * 110;
      const isShrine = this.objectiveCounter % 2 === 0 && this.relics.size < RELICS.length;
      this.objectiveCounter += 1;
      this.objective = {
        kind: isShrine ? 'shrine' : 'supply_pod',
        x: this.px + Math.cos(ang) * dist,
        y: this.py + Math.sin(ang) * dist,
        radius: 74,
        progress: 0,
        duration: 3.5,
        tickSoundAccum: 0,
      };
      this.spawnTelegraphs.push({
        x: this.objective.x,
        y: this.objective.y,
        radius: 78,
        color: isShrine ? '#fbbf24' : '#38bdf8',
        life: 0.9,
        maxLife: 0.9,
      });
      this.cb.onWaveBanner(
        isShrine ? 'STARFORGE SHRINE DETECTED — Hold circle 3.5s for a Relic!' : 'SUPPLY POD LANDED — Hold circle 3.5s for Loot!'
      );
    }

    if (!this.objective) return;
    const obj = this.objective;
    const d = Math.hypot(this.px - obj.x, this.py - obj.y);
    if (d <= obj.radius + 12) {
      obj.progress += dt;
      obj.tickSoundAccum += dt;
      if (obj.tickSoundAccum >= 0.42) {
        obj.tickSoundAccum = 0;
        audio.playShrineTick(Math.min(1, obj.progress / obj.duration));
      }
      if (obj.progress >= obj.duration) {
        this.shrinesClaimed += 1;
        this.objective = null;
        this.nextObjectiveAtSec = this.elapsedSec + 44 + this.rand() * 14;
        this.spawnRing(obj.x, obj.y, 190, obj.kind === 'shrine' ? '#fbbf24' : '#38bdf8', 0.48);

        if (obj.kind === 'shrine') {
          const unowned = RELICS.filter((r) => !this.relics.has(r.id)).sort(() => this.rand() - 0.5);
          if (unowned.length > 0) {
            audio.playRelicUnlock();
            this.setPaused(true);
            this.emitHud();
            this.cb.onRelicChoice(unowned.slice(0, 3));
          } else {
            this.coinsEarned += 600;
            this.gemsEarned += 15;
            this.healPlayer(this.getEffectiveMaxHp() * 0.4);
            audio.playRelicUnlock();
          }
        } else {
          // Supply Pod payout
          audio.playChestJackpot();
          this.pickups.push({ kind: 'chest', x: obj.x, y: obj.y, val: 1, magnetized: false });
          this.pickups.push({ kind: 'heal', x: obj.x - 24, y: obj.y + 10, val: 35, magnetized: false });
          this.pickups.push({ kind: 'gem', x: obj.x + 24, y: obj.y - 8, val: 8, magnetized: false });
          for (let i = 0; i < 6; i++) {
            this.pickups.push({
              kind: 'coin',
              x: obj.x + (Math.random() - 0.5) * 44,
              y: obj.y + (Math.random() - 0.5) * 44,
              val: 45,
              magnetized: false,
            });
          }
        }
      }
    } else if (obj.progress > 0) {
      obj.progress = Math.max(0, obj.progress - dt * 0.45);
    }
  }

  private updateDeployedTurrets(dt: number): void {
    const alive: DeployedTurret[] = [];
    for (const t of this.deployedTurrets) {
      t.life -= dt;
      if (t.life <= 0) continue;
      t.cd -= dt;
      if (t.cd <= 0) {
        t.cd = 0.24;
        let best: Enemy | null = null;
        let bestD = 380 * 380;
        for (const e of this.enemies) {
          const d2 = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
          if (d2 < bestD) {
            bestD = d2;
            best = e;
          }
        }
        if (best) {
          t.angle = Math.atan2(best.y - t.y, best.x - t.x);
          this.projectiles.push({
            fromEnemy: false,
            sourceId: 'ult',
            x: t.x + Math.cos(t.angle) * 12,
            y: t.y + Math.sin(t.angle) * 12,
            vx: Math.cos(t.angle) * 620,
            vy: Math.sin(t.angle) * 620,
            radius: 5,
            damage: this.stats.atk * 1.45 * this.getDamageMult() * this.stats.projPowerMult,
            pierce: 2,
            life: 0.9,
            maxLife: 0.9,
            color: '#2dd4bf',
            isTurretLaser: true,
            hitIds: new Set(),
          });
        }
      }
      alive.push(t);
    }
    this.deployedTurrets = alive;
  }

  private updatePlasmaMines(dt: number): void {
    const alive: PlasmaMine[] = [];
    for (const m of this.plasmaMines) {
      m.life -= dt;
      if (m.life <= 0) continue;
      let triggered = false;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - m.x, e.y - m.y) <= e.radius + 18) {
          triggered = true;
          break;
        }
      }
      if (triggered) {
        this.spawnRing(m.x, m.y, m.radius * 1.8, '#38bdf8', 0.3);
        this.pushGroundDecal('crater', m.x, m.y, m.radius * 0.9, 3.2, 0, 'relic');
        for (const e of [...this.enemies]) {
          if (Math.hypot(e.x - m.x, e.y - m.y) <= m.radius * 1.7 + e.radius) {
            this.damageEnemy(e, m.damage, false, 'relic');
          }
        }
        continue;
      }
      alive.push(m);
    }
    this.plasmaMines = alive;
  }

  private updateMeteors(dt: number): void {
    const alive: MeteorTelegraph[] = [];
    for (const mt of this.meteorTelegraphs) {
      mt.delay -= dt;
      if (mt.delay <= 0) {
        this.screenShake = Math.max(this.screenShake, mt.fromEnemy ? 7 : 5);
        this.spawnRing(mt.x, mt.y, mt.radius * 1.25, mt.color, 0.38);
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 65 + Math.random() * 145;
          this.spawnParticle(mt.x, mt.y, Math.cos(a) * spd, Math.sin(a) * spd, 4, mt.color, 0.35, true);
        }
        if (mt.fromEnemy) {
          if (Math.hypot(this.px - mt.x, this.py - mt.y) <= mt.radius + 10) {
            this.damagePlayer(mt.damage);
          }
          this.pushGroundDecal('magma_enemy', mt.x, mt.y, mt.radius * 0.78, 4.5, mt.damage * 0.4, 'enemy');
        } else {
          for (const e of [...this.enemies]) {
            if (Math.hypot(e.x - mt.x, e.y - mt.y) <= mt.radius + e.radius) {
              this.damageEnemy(e, mt.damage, true, mt.sourceId);
            }
          }
          this.pushGroundDecal('scorch', mt.x, mt.y, mt.radius * 0.85, 3.6, mt.damage * 0.35, mt.sourceId);
        }
        continue;
      }
      alive.push(mt);
    }
    this.meteorTelegraphs = alive;
  }

  private updateGroundDecals(dt: number): void {
    const alive: GroundDecal[] = [];
    for (const d of this.groundDecals) {
      d.life -= dt;
      if (d.life <= 0) continue;
      if (d.dps > 0) {
        d.tickAccum += dt;
        if (d.tickAccum >= 0.35) {
          d.tickAccum -= 0.35;
          if (d.kind === 'magma_enemy') {
            if (Math.hypot(this.px - d.x, this.py - d.y) <= d.radius + 8) {
              this.damagePlayer(d.dps * 0.35);
            }
          } else {
            for (const e of [...this.enemies]) {
              if (Math.hypot(e.x - d.x, e.y - d.y) <= d.radius + e.radius) {
                this.damageEnemy(e, d.dps * 0.35, false, d.sourceId);
                if (d.kind === 'frost') {
                  e.slowTimer = Math.max(e.slowTimer, 1.0);
                }
              }
            }
          }
        }
      }
      alive.push(d);
    }
    this.groundDecals = alive;
  }

  private pushGroundDecal(
    kind: GroundDecal['kind'],
    x: number,
    y: number,
    radius: number,
    life: number,
    dps: number,
    sourceId: string
  ): void {
    if (this.groundDecals.length >= 34) {
      this.groundDecals.shift();
    }
    this.groundDecals.push({ kind, x, y, radius, life, maxLife: life, dps, tickAccum: 0, sourceId });
  }

  private pushJaggedLightning(x1: number, y1: number, x2: number, y2: number, color: string, life: number): void {
    const segs = 5;
    const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const jitter = (Math.random() - 0.5) * Math.min(34, len * 0.16);
      pts.push({
        x: x1 + dx * t + nx * jitter,
        y: y1 + dy * t + ny * jitter,
      });
    }
    pts.push({ x: x2, y: y2 });
    this.lightnings.push({ points: pts, color, life, maxLife: life });
  }

  private spawnHordeSurge(): void {
    const surgeCount = Math.min(20, 8 + this.threatLevel * 2);
    const baseAngle = this.rand() * Math.PI * 2;
    const dist = Math.max(this.width, this.height) * 0.54 + 35;
    for (let i = 0; i < surgeCount; i++) {
      if (this.enemies.length >= 195) break;
      const a = baseAngle + (i / surgeCount) * Math.PI * 1.4 - Math.PI * 0.7;
      const kind: Enemy['kind'] = i % 4 === 0 ? 'dasher' : i % 5 === 0 ? 'sentinel' : 'swarmer';
      const sx = this.px + Math.cos(a) * dist;
      const sy = this.py + Math.sin(a) * dist;
      this.spawnEnemy(kind, sx, sy);
    }
    this.cb.onWaveBanner(`SWARM SURGE! ${surgeCount} hostile signatures incoming!`);
  }

  private updateSpawner(dt: number): void {
    const intensity = 1 + this.elapsedSec / 34 + (this.threatLevel - 1) * 0.32;
    const dailySpawnMult = this.dailyMods.has('swarm_frenzy') ? 1.35 : 1.0;
    const rate =
      (1.75 + intensity * 0.95) * this.chapter.spawnRateMult * this.ascensionDef.spawnMult * dailySpawnMult;
    this.spawnAccum += dt * rate;
    const goblinChance = this.boosters.doubleLuck ? 0.05 : 0.025;

    while (this.spawnAccum >= 1 && this.enemies.length < 185) {
      this.spawnAccum -= 1;
      const r = this.rand();
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
    const angle = this.rand() * Math.PI * 2;
    const spawnDist = Math.max(this.width, this.height) * 0.58 + 45;
    const x = customX ?? this.px + Math.cos(angle) * spawnDist;
    const y = customY ?? this.py + Math.sin(angle) * spawnDist;

    const threatPowHp = Math.pow(1.18, this.threatLevel - 1);
    const threatPowDmg = Math.pow(1.13, this.threatLevel - 1);
    const spdScale = 1 + Math.min(0.85, (this.threatLevel - 1) * 0.09);

    const hpBase =
      34 * this.chapter.enemyHpMult * this.ascensionDef.enemyHpMult * (1 + this.elapsedSec * 0.024) * threatPowHp;
    const dmgBase =
      14 * this.chapter.enemyDmgMult * this.ascensionDef.enemyDmgMult * (1 + this.elapsedSec * 0.014) * threatPowDmg;

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
      this.spawnTelegraphs.push({ x, y, radius: 52, color: '#e879f9', life: 0.7, maxLife: 0.7 });
    } else if (kind === 'boss') {
      radius = 44;
      hp = hpBase * 44 * (this.dailyMods.has('titan_bosses') ? 1.3 : 1.0);
      speed = 86 * Math.min(1.45, spdScale);
      damage = dmgBase * 2.25;
      color = '#ef4444';
      xpValue = 150;
      this.spawnTelegraphs.push({ x, y, radius: 80, color: '#ef4444', life: 0.9, maxLife: 0.9 });
    }

    let tier: 0 | 1 | 2 = 0;
    if (kind !== 'boss' && kind !== 'elite' && kind !== 'goblin') {
      const apexChance = this.threatLevel >= 3 ? Math.min(0.24, (this.threatLevel - 2) * 0.06) : 0;
      const strongChance = this.threatLevel >= 2 ? Math.min(0.42, (this.threatLevel - 1) * 0.12) : 0;
      const roll = this.rand();
      if (roll < apexChance) {
        tier = 2;
        radius = Math.round(radius * 1.3);
        hp *= 2.55;
        damage *= 1.65;
        speed *= 1.22;
        xpValue = Math.round(xpValue * 2.2);
      } else if (roll < apexChance + strongChance) {
        tier = 1;
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
      burnTimer: 0,
      burnDps: 0,
      shootTimer: 1.8 + Math.random(),
      bossPatternTimer: 2.3,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private spawnBoss(bossTitle: string, hpScale = 1.0, archetype: BossArchetype = 1): void {
    this.bossSpawned = true;
    const boss = this.spawnEnemy('boss');
    boss.hp = Math.round(boss.hp * hpScale);
    boss.maxHp = boss.hp;
    boss.bossArchetype = archetype;
    boss.enraged = false;
    boss.bossState = 'chase';
    boss.bossStateTimer = 0;
    boss.bossDrones = archetype === 6 ? 3 : 0;

    const bInfo = BOSS_BESTIARY.find((b) => b.archetype === archetype);
    if (bInfo) boss.color = bInfo.color;

    this.activeBossId = boss.id;
    this.activeBossLabel = bossTitle;
    audio.setBossIntensity(true);
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

  private onWeaponActivated(): void {
    if (!this.relics.has('nova_burst')) return;
    this.weaponFireCount += 1;
    if (this.weaponFireCount >= 10) {
      this.weaponFireCount = 0;
      const rad = 165 * this.getAreaMult();
      this.spawnRing(this.px, this.py, rad, '#fbbf24', 0.36);
      const dmg = this.stats.atk * 2.4 * this.getDamageMult();
      for (const e of [...this.enemies]) {
        if (Math.hypot(e.x - this.px, e.y - this.py) <= rad + e.radius) {
          this.damageEnemy(e, dmg, false, 'relic');
        }
      }
    }
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
      const spinSpeed = orbState.evolved ? 4.5 : 2.8 + orbState.lv * 0.25;
      this.orbitalAngle += dt * spinSpeed;
      const orbRadius = (orbState.evolved ? 110 : 78 + orbState.lv * 6) * areaMult;
      orbState.cd -= dt;
      if (orbState.cd <= 0) {
        orbState.cd = orbState.evolved ? 0.14 : 0.22;
        const orbDmg = this.stats.atk * (0.78 + orbState.lv * 0.26) * dmgMult * (orbState.evolved ? 1.58 : 1);
        for (let i = 0; i < orbCount; i++) {
          const ang = this.orbitalAngle + (i * Math.PI * 2) / orbCount;
          const ox = this.px + Math.cos(ang) * orbRadius;
          const oy = this.py + Math.sin(ang) * orbRadius;
          for (const e of [...this.enemies]) {
            if (Math.hypot(e.x - ox, e.y - oy) < e.radius + (orbState.evolved ? 22 : 16)) {
              this.damageEnemy(e, orbDmg, false, 'orbital_saw');
              if (e.kind !== 'boss') {
                const pushAng = Math.atan2(e.y - this.py, e.x - this.px);
                e.x += Math.cos(pushAng) * 8;
                e.y += Math.sin(pushAng) * 8;
              }
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

      const baseCd = (def.baseCooldownMs / 1000) * Math.max(0.5, 1 - (st.lv - 1) * 0.08) * cdMult;
      st.cd = st.evolved ? baseCd * 0.72 : baseCd;
      const projMult = def.isProjectile ? this.stats.projPowerMult : 1.0;
      const dmg =
        (this.stats.atk + def.baseDamage) * (1 + (st.lv - 1) * 0.34) * dmgMult * projMult * (st.evolved ? 1.65 : 1);

      audio.playWeaponSfx(wId);
      this.onWeaponActivated();

      if (wId === 'plasma_blade') {
        const radius = (st.evolved ? 160 : 106 + st.lv * 10) * areaMult;
        const spread = st.evolved ? Math.PI * 2 : Math.PI * 0.92;
        const hitsBothSides = st.lv >= 3 || st.evolved;
        const target = this.findNearestEnemy(radius + 50);
        const swingAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.primaryWeaponId === 'plasma_blade') {
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
            life: 0.23,
            maxLife: 0.23,
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
                this.damageEnemy(e, dmg, false, 'plasma_blade');
                if (e.kind !== 'boss' && dist > 1) {
                  e.x += (dx / dist) * 14;
                  e.y += (dy / dist) * 14;
                }
              }
            }
          }
        }
      } else if (wId === 'arcane_staff') {
        const target = this.findNearestEnemy(520);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.primaryWeaponId === 'arcane_staff') {
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
            sourceId: 'arcane_staff',
            x: this.px + Math.cos(baseAng) * 18,
            y: this.py + Math.sin(baseAng) * 18,
            vx: Math.cos(a) * (st.evolved ? 490 : 395),
            vy: Math.sin(a) * (st.evolved ? 490 : 395),
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
        const target = this.findNearestEnemy(570);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.primaryWeaponId === 'star_bow') {
          this.weaponAimAngle = baseAng;
          this.attackAnimDuration = 0.22;
          this.attackAnimTimer = 0.22;
        }
        const count = (st.evolved ? 5 : 1 + Math.floor(st.lv / 2)) + extraProj;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 0.11;
          const a = baseAng + offset;
          const speed = st.evolved ? 830 : 690;
          this.projectiles.push({
            fromEnemy: false,
            sourceId: 'star_bow',
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
      } else if (wId === 'orbital_turret') {
        const turretCount = st.evolved ? 4 : Math.min(3, 1 + Math.floor(st.lv / 2));
        const shotsPerTurret = st.evolved ? 2 : 1 + (extraProj > 0 ? 1 : 0);
        const orbitR = 46;
        for (let t = 0; t < turretCount; t++) {
          const tAng = this.elapsedSec * 1.45 + (t * Math.PI * 2) / turretCount;
          const tx = this.px + Math.cos(tAng) * orbitR;
          const ty = this.py + Math.sin(tAng) * orbitR;
          let target: Enemy | null = null;
          let bestD = 480 * 480;
          for (const e of this.enemies) {
            const d2 = (e.x - tx) ** 2 + (e.y - ty) ** 2;
            if (d2 < bestD) {
              bestD = d2;
              target = e;
            }
          }
          const fireAng = target ? Math.atan2(target.y - ty, target.x - tx) : tAng;
          if (t === 0 && this.primaryWeaponId === 'orbital_turret') {
            this.weaponAimAngle = fireAng;
            this.attackAnimDuration = 0.2;
            this.attackAnimTimer = 0.2;
          }
          for (let s = 0; s < shotsPerTurret; s++) {
            const spread = (s - (shotsPerTurret - 1) / 2) * 0.09;
            const a = fireAng + spread;
            this.projectiles.push({
              fromEnemy: false,
              sourceId: 'orbital_turret',
              x: tx,
              y: ty,
              vx: Math.cos(a) * (st.evolved ? 720 : 580),
              vy: Math.sin(a) * (st.evolved ? 720 : 580),
              radius: st.evolved ? 6.5 : 4.8,
              damage: dmg * (st.evolved ? 0.85 : 0.9),
              pierce: st.evolved ? 4 : st.lv >= 4 ? 2 : 1,
              life: 1.15,
              maxLife: 1.15,
              color: st.evolved ? '#5eead4' : '#14b8a6',
              isTurretLaser: true,
              hitIds: new Set(),
            });
          }
        }
      } else if (wId === 'solar_lance') {
        const target = this.findNearestEnemy(520);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        if (this.primaryWeaponId === 'solar_lance') {
          this.weaponAimAngle = baseAng;
          this.attackAnimDuration = 0.3;
          this.attackAnimTimer = 0.3;
        }
        const count = (st.evolved ? 2 : 1 + (st.lv >= 4 ? 1 : 0)) + extraProj;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 0.24;
          const a = baseAng + offset;
          this.projectiles.push({
            fromEnemy: false,
            sourceId: 'solar_lance',
            x: this.px + Math.cos(a) * 18,
            y: this.py + Math.sin(a) * 18,
            vx: Math.cos(a) * (st.evolved ? 740 : 600),
            vy: Math.sin(a) * (st.evolved ? 740 : 600),
            radius: st.evolved ? 13 : 9,
            damage: dmg,
            pierce: 99,
            life: st.evolved ? 0.95 : 0.72,
            maxLife: st.evolved ? 0.95 : 0.72,
            color: st.evolved ? '#fde047' : '#f97316',
            explosive: st.evolved,
            isSolarLance: true,
            scorchTrailAccum: 0,
            hitIds: new Set(),
          });
        }
      } else if (wId === 'pulse_rifle') {
        const target = this.findNearestEnemy(490);
        const baseAng = target ? Math.atan2(target.y - this.py, target.x - this.px) : this.facingAngle;
        const count = (st.evolved ? 3 : 1 + Math.floor(st.lv / 2)) + extraProj;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * 0.14;
          const a = baseAng + offset;
          this.projectiles.push({
            fromEnemy: false,
            sourceId: 'pulse_rifle',
            x: this.px,
            y: this.py,
            vx: Math.cos(a) * (st.evolved ? 660 : 470),
            vy: Math.sin(a) * (st.evolved ? 660 : 470),
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

        for (let c = 0; c < chains; c++) {
          let nextE: Enemy | null = null;
          let bestD = 270 * 270;
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
          this.pushJaggedLightning(curX, curY, nextE.x, nextE.y, st.evolved ? '#f0abfc' : '#a855f7', 0.25);
          curX = nextE.x;
          curY = nextE.y;
          this.damageEnemy(nextE, dmg * (1 - c * 0.05), false, 'tesla_arc');
          if (st.evolved) nextE.slowTimer = Math.max(nextE.slowTimer, 1.0);
        }
      } else if (wId === 'frost_nova') {
        const radius = (st.evolved ? 190 : 108 + st.lv * 16) * areaMult;
        this.rings.push({
          x: this.px,
          y: this.py,
          maxRadius: radius,
          color: st.evolved ? '#38bdf8' : '#93c5fd',
          life: 0.42,
          maxLife: 0.42,
          isFrost: true,
        });
        // Frost crystalline shard burst
        for (let s = 0; s < (st.evolved ? 16 : 10); s++) {
          const a = (s * Math.PI * 2) / (st.evolved ? 16 : 10);
          this.spawnParticle(
            this.px + Math.cos(a) * 18,
            this.py + Math.sin(a) * 18,
            Math.cos(a) * (radius * 2.1),
            Math.sin(a) * (radius * 2.1),
            5.5,
            '#bae6fd',
            0.34,
            true,
            true,
            a
          );
        }
        if (st.evolved) {
          this.pushGroundDecal('frost', this.px, this.py, radius * 0.72, 3.4, dmg * 0.45, 'frost_nova');
        }
        for (const e of [...this.enemies]) {
          if (Math.hypot(e.x - this.px, e.y - this.py) <= radius + e.radius) {
            e.slowTimer = Math.max(e.slowTimer, st.evolved ? 3.2 : 1.9);
            this.damageEnemy(e, dmg, false, 'frost_nova');
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
            sourceId: 'inferno_drone',
            x: sx,
            y: sy,
            vx: Math.cos(a) * 370,
            vy: Math.sin(a) * 370,
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
            radius: (st.evolved ? 128 : 74 + st.lv * 9) * areaMult,
            damagePerSec: dmg * 1.18,
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
            sourceId: 'vamp_scythe',
            x: this.px,
            y: this.py,
            vx: Math.cos(a) * 365,
            vy: Math.sin(a) * 365,
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

      if (p.isSolarLance) {
        p.scorchTrailAccum = (p.scorchTrailAccum || 0) + dt;
        if (p.scorchTrailAccum >= 0.14) {
          p.scorchTrailAccum = 0;
          this.pushGroundDecal('scorch', p.x, p.y, p.explosive ? 38 : 26, 2.5, p.damage * 0.42, 'solar_lance');
        }
      } else if (p.isMagicOrb && Math.random() < 0.35) {
        this.spawnParticle(p.x, p.y, (Math.random() - 0.5) * 35, (Math.random() - 0.5) * 35, 2.4, p.color, 0.22, true);
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
          this.damageEnemy(e, p.damage, false, p.sourceId);
          if (p.vampiric && Math.random() < 0.25) {
            this.healPlayer(3);
          }
          if (p.explosive) {
            this.spawnRing(p.x, p.y, p.isSolarLance ? 62 : 48, p.color, 0.22);
            for (const other of [...this.enemies]) {
              if (other.id !== e.id && Math.hypot(other.x - p.x, other.y - p.y) < (p.isSolarLance ? 66 : 55)) {
                this.damageEnemy(other, p.damage * 0.6, false, p.sourceId);
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
            this.damageEnemy(e, z.damagePerSec * 0.25, false, 'gravity_well');
          }
        }
      }
      active.push(z);
    }
    this.gravZones = active;
  }

  private updateBossAI(e: Enemy, dt: number, dx: number, dy: number, dist: number, spd: number): void {
    const arch = e.bossArchetype || 1;
    // Phase 2 Enrage at 50% HP!
    if (!e.enraged && e.hp <= e.maxHp * 0.5) {
      e.enraged = true;
      this.screenShake = Math.max(this.screenShake, 12);
      audio.playBossWarning();
      this.spawnRing(e.x, e.y, 210, '#ef4444', 0.5);
      if (arch === 6) {
        e.bossDrones = 4; // Nexus Overlord resummons drones
      }
      this.cb.onWaveBanner(`PHASE 2 ENRAGE: ${this.activeBossLabel || 'BOSS'} unleashes full power!`);
    }

    const p2 = Boolean(e.enraged);
    const state = e.bossState || 'chase';
    e.bossStateTimer = Math.max(0, (e.bossStateTimer || 0) - dt);

    if (state === 'telegraph_laser') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'firing_laser';
        e.bossStateTimer = p2 ? 1.55 : 1.15;
        this.screenShake = Math.max(this.screenShake, 6);
      }
      return;
    }

    if (state === 'firing_laser') {
      const sweepRate = arch === 6 ? (p2 ? 1.35 : 0.95) : p2 ? 1.05 : 0.72;
      e.bossAimAngle = (e.bossAimAngle || 0) + sweepRate * dt;
      const beamCount = arch === 6 ? (p2 ? 4 : 2) : p2 ? 2 : 1;
      const beamLen = 460;
      for (let b = 0; b < beamCount; b++) {
        const ang = (e.bossAimAngle || 0) + (b * Math.PI * 2) / beamCount;
        // Distance from player to beam segment
        const bx = Math.cos(ang);
        const by = Math.sin(ang);
        const rx = this.px - e.x;
        const ry = this.py - e.y;
        const proj = rx * bx + ry * by;
        if (proj > 0 && proj < beamLen) {
          const perp = Math.abs(rx * -by + ry * bx);
          if (perp < 22) {
            this.damagePlayer(e.damage * 0.95);
          }
        }
      }
      if (e.bossStateTimer <= 0) {
        e.bossState = 'chase';
        e.bossPatternTimer = p2 ? 2.4 : 3.2;
      }
      return;
    }

    if (state === 'telegraph_dash') {
      if (e.bossStateTimer <= 0) {
        e.bossState = 'dashing';
        e.bossStateTimer = 0.42;
        const ang = e.bossAimAngle ?? Math.atan2(dy, dx);
        e.vx = Math.cos(ang) * (p2 ? 520 : 420);
        e.vy = Math.sin(ang) * (p2 ? 520 : 420);
      }
      return;
    }

    if (state === 'dashing') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (Math.random() < 0.6) {
        this.spawnParticle(e.x, e.y, -e.vx * 0.2, -e.vy * 0.2, 4.5, e.color, 0.25, true);
      }
      if (e.bossStateTimer <= 0) {
        // Radial shrapnel on stop
        const bolts = p2 ? 10 : 6;
        for (let b = 0; b < bolts; b++) {
          const a = (b * Math.PI * 2) / bolts;
          this.projectiles.push({
            fromEnemy: true,
            sourceId: 'enemy',
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 210,
            vy: Math.sin(a) * 210,
            radius: 6.5,
            damage: e.damage * 0.72,
            pierce: 1,
            life: 2.4,
            maxLife: 2.4,
            color: '#fbbf24',
            hitIds: new Set(),
          });
        }
        const chainsLeft = (e.bossDashChains || 0) - 1;
        if (chainsLeft > 0) {
          e.bossDashChains = chainsLeft;
          e.bossState = 'telegraph_dash';
          e.bossStateTimer = 0.45;
          e.bossAimAngle = Math.atan2(this.py - e.y, this.px - e.x);
        } else {
          e.bossState = 'chase';
          e.bossPatternTimer = p2 ? 2.2 : 3.0;
        }
      }
      return;
    }

    // Normal chase movement
    const chaseSpd = spd * (p2 ? 1.24 : 1.0);
    e.x += (dx / dist) * chaseSpd * dt;
    e.y += (dy / dist) * chaseSpd * dt;

    // Trigger signature pattern
    e.bossPatternTimer -= dt;
    if (e.bossPatternTimer <= 0) {
      if (arch === 1) {
        // Dread-Mech Mk.I: Sweeping Laser Beam
        e.bossState = 'telegraph_laser';
        e.bossStateTimer = 0.78;
        e.bossAimAngle = Math.atan2(dy, dx) - 0.55;
      } else if (arch === 2) {
        // Scorpio Colossus: Armored Dash Charge
        e.bossState = 'telegraph_dash';
        e.bossStateTimer = 0.65;
        e.bossAimAngle = Math.atan2(dy, dx);
        e.bossDashChains = p2 ? 3 : 1;
      } else if (arch === 3) {
        // Glacier Sovereign: Frost Ring + Ice Shard Volley
        e.bossPatternTimer = p2 ? 2.1 : 2.9;
        this.rings.push({ x: e.x, y: e.y, maxRadius: p2 ? 220 : 170, color: '#60a5fa', life: 0.45, maxLife: 0.45, isFrost: true });
        const shards = p2 ? 14 : 9;
        const baseA = Math.atan2(dy, dx);
        for (let b = 0; b < shards; b++) {
          const a = baseA + (b * Math.PI * 2) / shards;
          this.projectiles.push({
            fromEnemy: true,
            sourceId: 'enemy',
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * (p2 ? 235 : 195),
            vy: Math.sin(a) * (p2 ? 235 : 195),
            radius: 7,
            damage: e.damage * 0.78,
            pierce: 1,
            life: 3.1,
            maxLife: 3.1,
            color: '#93c5fd',
            isIceShard: true,
            hitIds: new Set(),
          });
        }
      } else if (arch === 4) {
        // Inferno Behemoth: Telegraphed Meteors + Magma Pools
        e.bossPatternTimer = p2 ? 2.2 : 3.0;
        const count = p2 ? 6 : 4;
        for (let m = 0; m < count; m++) {
          const ox = m === 0 ? this.px : this.px + (Math.random() - 0.5) * 260;
          const oy = m === 0 ? this.py : this.py + (Math.random() - 0.5) * 260;
          this.meteorTelegraphs.push({
            fromEnemy: true,
            x: ox,
            y: oy,
            radius: 54,
            delay: 0.95 + m * 0.12,
            maxDelay: 0.95 + m * 0.12,
            damage: e.damage * 0.9,
            color: '#ef4444',
            sourceId: 'enemy',
          });
        }
        if (p2) {
          for (let b = 0; b < 8; b++) {
            const a = (b * Math.PI * 2) / 8;
            this.projectiles.push({
              fromEnemy: true,
              sourceId: 'enemy',
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 200,
              vy: Math.sin(a) * 200,
              radius: 7,
              damage: e.damage * 0.75,
              pierce: 1,
              life: 2.8,
              maxLife: 2.8,
              color: '#f97316',
              hitIds: new Set(),
            });
          }
        }
      } else if (arch === 5) {
        // Archon Nullifier: Rotating Void Spiral + P2 Blink
        e.bossPatternTimer = p2 ? 1.85 : 2.55;
        const arms = p2 ? 14 : 10;
        const offset = this.elapsedSec * 2.2;
        for (let b = 0; b < arms; b++) {
          const a = offset + (b * Math.PI * 2) / arms;
          this.projectiles.push({
            fromEnemy: true,
            sourceId: 'enemy',
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 190,
            vy: Math.sin(a) * 190,
            radius: 7,
            damage: e.damage * 0.78,
            pierce: 1,
            life: 3.4,
            maxLife: 3.4,
            color: '#c084fc',
            hitIds: new Set(),
          });
          if (p2) {
            const a2 = -offset + (b * Math.PI * 2) / arms + 0.18;
            this.projectiles.push({
              fromEnemy: true,
              sourceId: 'enemy',
              x: e.x,
              y: e.y,
              vx: Math.cos(a2) * 155,
              vy: Math.sin(a2) * 155,
              radius: 6,
              damage: e.damage * 0.72,
              pierce: 1,
              life: 3.4,
              maxLife: 3.4,
              color: '#f0abfc',
              hitIds: new Set(),
            });
          }
        }
        this.spawnRing(e.x, e.y, 145, '#a855f7', 0.4);
      } else {
        // Nexus Overlord: Cross Laser Sweep + Drone Barrage
        if (Math.random() < 0.55) {
          e.bossState = 'telegraph_laser';
          e.bossStateTimer = 0.8;
          e.bossAimAngle = Math.atan2(dy, dx);
        } else {
          e.bossPatternTimer = p2 ? 2.1 : 2.8;
          const drones = e.bossDrones || 3;
          for (let d = 0; d < drones; d++) {
            const dAng = this.elapsedSec * 2.0 + (d * Math.PI * 2) / drones;
            const dxPos = e.x + Math.cos(dAng) * (e.radius + 26);
            const dyPos = e.y + Math.sin(dAng) * (e.radius + 26);
            const aim = Math.atan2(this.py - dyPos, this.px - dxPos);
            for (const spread of p2 ? [-0.14, 0, 0.14] : [0]) {
              this.projectiles.push({
                fromEnemy: true,
                sourceId: 'enemy',
                x: dxPos,
                y: dyPos,
                vx: Math.cos(aim + spread) * 230,
                vy: Math.sin(aim + spread) * 230,
                radius: 6,
                damage: e.damage * 0.72,
                pierce: 1,
                life: 3.0,
                maxLife: 3.0,
                color: '#2dd4bf',
                hitIds: new Set(),
              });
            }
          }
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    // 1. Build Spatial Hash Grid for clean O(N) horde separation
    const grid = new Map<number, Enemy[]>();
    const hashCell = (cx: number, cy: number) => ((cx + 4096) << 14) | (cy + 4096);

    for (const e of this.enemies) {
      const cx = Math.floor(e.x / SPATIAL_CELL);
      const cy = Math.floor(e.y / SPATIAL_CELL);
      const key = hashCell(cx, cy);
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(e);
    }

    // 2. Update movement, burn DoT, AI, and spatial separation
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e) continue;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);

      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= e.burnDps * dt;
        this.weaponDamage.set('burn', (this.weaponDamage.get('burn') || 0) + e.burnDps * dt);
        if (Math.random() < 0.18) {
          this.spawnParticle(e.x, e.y - 4, (Math.random() - 0.5) * 25, -35, 2.4, '#f97316', 0.2, true);
        }
        if (e.hp <= 0) {
          this.killEnemy(e);
          i--;
          continue;
        }
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = e.speed * (e.slowTimer > 0 ? 0.45 : 1);

      if (e.kind === 'boss') {
        this.updateBossAI(e, dt, dx, dy, dist, spd);
      } else {
        if (e.kind === 'spitter' && dist < 340) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = 2.6;
            const a = Math.atan2(dy, dx);
            this.projectiles.push({
              fromEnemy: true,
              sourceId: 'enemy',
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
        }
        if (e.kind !== 'spitter' || dist > 165) {
          e.x += (dx / dist) * spd * dt;
          e.y += (dy / dist) * spd * dt;
        }

        // Spatial grid neighbor separation
        const cx = Math.floor(e.x / SPATIAL_CELL);
        const cy = Math.floor(e.y / SPATIAL_CELL);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const bucket = grid.get(hashCell(cx + ox, cy + oy));
            if (!bucket) continue;
            for (const o of bucket) {
              if (o.id <= e.id || o.kind === 'boss') continue;
              const sx = e.x - o.x;
              const sy = e.y - o.y;
              const minD = e.radius + o.radius;
              const d2 = sx * sx + sy * sy;
              if (d2 > 0.01 && d2 < minD * minD) {
                const sd = Math.sqrt(d2);
                const push = (minD - sd) * 0.28;
                const nx = sx / sd;
                const ny = sy / sd;
                e.x += nx * push;
                e.y += ny * push;
                o.x -= nx * push;
                o.y -= ny * push;
              }
            }
          }
        }
      }

      if (dist < e.radius + 14) {
        this.damagePlayer(e.damage);
      }
    }
  }

  private damageEnemy(e: Enemy, rawDmg: number, forceCrit: boolean, sourceId: string, fromChainCrit = false): void {
    let safeRaw = Number.isFinite(rawDmg) && rawDmg > 0 ? rawDmg : 1;

    // Relic: Executioner's Mark
    if (this.relics.has('executioner_mark')) {
      if (e.kind === 'boss') safeRaw *= 1.22;
      if (e.hp / Math.max(1, e.maxHp) < 0.35) safeRaw *= 1.35;
    }

    const critChance = this.stats.critChance + (this.passives.get('eagle_optics') || 0) * 0.06;
    const isCrit = forceCrit || Math.random() < critChance;
    const critMult = this.stats.critMult + (this.passives.get('eagle_optics') || 0) * 0.2;
    const dmg = Math.max(1, Math.round(safeRaw * (isCrit ? critMult : 1)));

    e.hp -= dmg;
    e.hitFlash = 0.11;
    this.weaponDamage.set(sourceId, (this.weaponDamage.get(sourceId) || 0) + dmg);
    audio.playHit(isCrit);

    // Relic: Solar Afterburn
    if (this.relics.has('solar_afterburn') && sourceId !== 'burn') {
      e.burnTimer = Math.max(e.burnTimer, 2.0);
      e.burnDps = Math.max(e.burnDps, dmg * 0.28);
    }

    // Relic: Chain-Crit Arc
    if (isCrit && !fromChainCrit && this.relics.has('chain_crit')) {
      let chains = 0;
      for (const other of [...this.enemies]) {
        if (other.id === e.id) continue;
        if (Math.hypot(other.x - e.x, other.y - e.y) < 175) {
          this.pushJaggedLightning(e.x, e.y, other.x, other.y, '#c084fc', 0.18);
          this.damageEnemy(other, dmg * 0.55, false, 'relic', true);
          chains += 1;
          if (chains >= 2) break;
        }
      }
    }

    if (isCrit) {
      this.screenShake = Math.max(this.screenShake, e.kind === 'boss' ? 4.4 : 2.1);
      this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 110, (Math.random() - 0.5) * 110, 3.4, '#fde047', 0.24, true);
    } else if (e.kind === 'boss') {
      this.screenShake = Math.max(this.screenShake, 2.2);
    }

    if (this.damageNumbers && this.floats.length < 75) {
      this.floats.push({
        x: e.x + (Math.random() - 0.5) * 14,
        y: e.y - e.radius,
        vy: isCrit ? -54 : -42,
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

    // Vespera passive: Life-steal (+3 HP every 10 kills)
    if (this.hero.id === 'vespera' && this.kills % 10 === 0) {
      this.healPlayer(3);
    }
    // Relic: Vampiric Core (+2 HP every 8 kills)
    if (this.relics.has('vampiric_core') && this.kills % 8 === 0) {
      this.healPlayer(2);
    }

    if (this.comboCount > 0 && this.comboCount % 50 === 0) {
      this.ultCharge = Math.min(100, this.ultCharge + 8);
      this.coinsEarned += 45;
      this.floats.push({
        x: this.px,
        y: this.py - 38,
        vy: -32,
        text: `${this.comboCount}x COMBO!`,
        color: '#fbbf24',
        life: 1.0,
        scale: 1.35,
      });
    }

    const ultGainBase = e.kind === 'elite' ? 20 : e.kind === 'boss' ? 40 : 1.45;
    const ultMult = this.relics.has('quantum_accel') ? 1.25 : 1.0;
    this.ultCharge = Math.min(100, this.ultCharge + ultGainBase * ultMult);

    // Burst particles & death shockwaves
    const pCount = e.kind === 'boss' ? 42 : e.kind === 'elite' ? 20 : 7;
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * (e.kind === 'boss' ? 250 : 155);
      this.spawnParticle(
        e.x,
        e.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        e.kind === 'boss' ? 6.0 : 3.3,
        i % 3 === 0 ? '#ffffff' : e.color,
        0.35 + Math.random() * 0.25,
        true
      );
    }
    if (e.kind === 'elite' || e.tier === 2) {
      this.triggerHitstop(0.025);
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
          val: 40,
          magnetized: false,
        });
      }
      this.pickups.push({ kind: 'gem', x: e.x, y: e.y, val: 6, magnetized: false });
    } else if (e.kind === 'elite') {
      this.bossesKilled += 1;
      this.pickups.push({ kind: 'chest', x: e.x, y: e.y, val: 1, magnetized: false });
      this.pickups.push({ kind: 'gem', x: e.x + 16, y: e.y, val: 7, magnetized: false });
    } else if (e.kind === 'boss') {
      this.triggerHitstop(0.055);
      this.bossesKilled += 1;
      if (e.bossArchetype) this.bossArchetypesDefeated.add(e.bossArchetype);
      this.activeBossId = null;
      this.activeBossLabel = null;
      audio.setBossIntensity(false);
      this.gemsEarned += 20;
      this.coinsEarned += 520;
      this.screenShake = 16;
      this.pushGroundDecal('crater', e.x, e.y, 70, 8, 0, 'boss');
      this.spawnRing(e.x, e.y, 290, '#fbbf24', 0.65);
      this.spawnRing(e.x, e.y, 185, '#ffffff', 0.45);
      if (this.chapter.mode === 'chapter' || this.chapter.mode === 'daily') {
        this.victoryTimer = window.setTimeout(() => this.abortAndFinish(true), 700);
        return;
      } else if (this.chapter.mode === 'boss_rush') {
        this.healPlayer(Math.round(this.getEffectiveMaxHp() * 0.28));
        if (this.bossRushStage >= 6) {
          this.victoryTimer = window.setTimeout(() => this.abortAndFinish(true), 700);
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
      if (dropRoll < 0.08 * luckBoost) this.pickups.push({ kind: 'coin', x: e.x + 6, y: e.y, val: 18, magnetized: false });
      else if (dropRoll < 0.087 * luckBoost) this.pickups.push({ kind: 'heal', x: e.x, y: e.y, val: 30, magnetized: false });
      else if (dropRoll < 0.091 * luckBoost) this.pickups.push({ kind: 'magnet', x: e.x, y: e.y, val: 1, magnetized: false });
      else if (dropRoll < 0.094 * luckBoost) this.pickups.push({ kind: 'bomb', x: e.x, y: e.y, val: 1, magnetized: false });
    }
  }

  private damagePlayer(rawDmg: number): void {
    if (this.invulnTimer > 0 || this.ended || this.victoryTimer !== null) return;

    // Dodge Chance (e.g. Phantom Rig)
    if (this.stats.dodgeChance > 0 && Math.random() < this.stats.dodgeChance) {
      this.invulnTimer = 0.32;
      audio.playDodge();
      this.spawnRing(this.px, this.py, 48, '#22d3ee', 0.26);
      this.floats.push({
        x: this.px,
        y: this.py - 28,
        vy: -42,
        text: 'DODGE!',
        color: '#22d3ee',
        life: 0.58,
        scale: 1.2,
      });
      return;
    }

    const safeRaw = Number.isFinite(rawDmg) ? rawDmg : 10;
    let dmg = Math.max(2, Math.round(safeRaw - this.stats.armor));

    // Absorb with Energy Shield first
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      this.spawnRing(this.px, this.py, 44, '#22d3ee', 0.22);
    }

    // Relic: Frost Nova on Hit
    if (this.relics.has('frost_retaliation')) {
      const r = 155;
      this.rings.push({ x: this.px, y: this.py, maxRadius: r, color: '#60a5fa', life: 0.38, maxLife: 0.38, isFrost: true });
      for (const e of [...this.enemies]) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < r + e.radius) {
          e.slowTimer = Math.max(e.slowTimer, 2.5);
          this.damageEnemy(e, this.stats.atk * 1.4, false, 'relic');
          if (e.kind !== 'boss' && d > 1) {
            e.x += ((e.x - this.px) / d) * 65;
            e.y += ((e.y - this.py) / d) * 65;
          }
        }
      }
    }

    this.hp -= dmg;
    this.invulnTimer = 0.44;
    this.screenShake = Math.max(this.screenShake, dmg > 0 ? 7.5 : 3.5);
    if (this.vibration && navigator.vibrate && dmg > 0) navigator.vibrate(25);

    if (this.hp <= 0) {
      this.hp = 0;
      if (this.revivesLeft > 0) {
        this.revivePlayer();
        return;
      }
      this.setPaused(true);
      this.cb.onDeathOffer();
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
        const spd = 540;
        if (dist > 1) {
          p.x += (dx / dist) * spd * dt;
          p.y += (dy / dist) * spd * dt;
        }
        if (Math.random() < 0.25) {
          const trailCol = p.kind === 'coin' ? '#fde047' : p.kind === 'xp_l' ? '#fbbf24' : '#38bdf8';
          this.spawnParticle(p.x, p.y, -dx * 0.2, -dy * 0.2, 2.0, trailCol, 0.2, true);
        }
      }

      if (dist <= 22) {
        if (p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l') {
          audio.playXpPickup();
          this.xp += p.val * xpMult;
          if (this.checkPendingLevelUp()) {
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
          this.healPlayer(Math.round(maxHp * (p.val / 100)));
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
          const count = Math.random() < 0.28 ? 3 : 1;
          const rewards: DraftOption[] = [];
          for (let k = 0; k < count; k++) {
            const opts = this.buildDraftOptions();
            const pick = opts[0];
            this.applyDraftOptionSilent(pick);
            rewards.push(pick);
          }
          const bonusCoins = 260 + this.level * 28;
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

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    color: string,
    life: number,
    additive = false,
    shard = false,
    rot = 0
  ): void {
    if (this.particles.length < 250) {
      this.particles.push({ x, y, vx, vy, size, color, life, maxLife: life, additive, shard, rot });
    }
  }

  private emitHud(): void {
    const boss = this.activeBossId ? this.enemies.find((e) => e.id === this.activeBossId) : null;
    this.cb.onHud({
      hp: Math.round(this.hp),
      maxHp: this.getEffectiveMaxHp(),
      shieldHp: Math.round(this.shieldHp),
      level: this.level,
      xpFrac: Math.min(1, this.xp / Math.max(1, this.xpNext)),
      elapsedSec: Math.floor(this.elapsedSec),
      durationSec: this.chapter.durationSec,
      isEndless: this.chapter.mode === 'endless',
      isBossRush: this.chapter.mode === 'boss_rush',
      isDaily: this.chapter.mode === 'daily',
      bossRushStage: this.bossRushStage,
      kills: this.kills,
      combo: this.comboCount,
      threatLevel: this.threatLevel,
      enemyPowerPct: this.getEnemyPowerPct(),
      coins: Math.round(this.coinsEarned * this.stats.goldMult * (this.boosters.doubleLuck ? 1.25 : 1)),
      gems: this.gemsEarned,
      ultCharge: Math.round(this.ultCharge),
      dashReadyFrac: this.dashCd <= 0 ? 1 : Math.max(0, 1 - this.dashCd / Math.max(0.5, this.dashMaxCd)),
      bossName: boss ? this.activeBossLabel || this.chapter.bossName : null,
      bossHpFrac: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
      bossEnraged: Boolean(boss?.enraged),
      weapons: Array.from(this.weapons.entries()).map(([id, s]) => ({ id, lv: s.lv, evolved: s.evolved })),
      passives: Array.from(this.passives.entries()).map(([id, lv]) => ({ id, lv })),
      relics: Array.from(this.relics),
      rerollsLeft: this.rerollsLeft,
      banishesLeft: this.banishesLeft,
      objectiveLabel: this.objective
        ? this.objective.kind === 'shrine'
          ? 'Starforge Shrine'
          : 'Supply Pod'
        : null,
      objectiveProgress: this.objective ? Math.min(1, this.objective.progress / this.objective.duration) : 0,
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

    // Subtle drifting nebula glows
    const neb1X = w * (0.3 + Math.sin(this.elapsedSec * 0.14) * 0.12);
    const neb1Y = h * (0.28 + Math.cos(this.elapsedSec * 0.11) * 0.1);
    const nebGrad1 = ctx.createRadialGradient(neb1X, neb1Y, 10, neb1X, neb1Y, Math.max(w, h) * 0.52);
    nebGrad1.addColorStop(0, `${this.chapter.accentColor}1e`);
    nebGrad1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebGrad1;
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
    ctx.restore();

    // Ambient chapter motes
    ctx.save();
    ctx.fillStyle = this.chapter.accentColor;
    for (const m of this.ambientMotes) {
      ctx.globalAlpha = m.alpha * (0.7 + 0.3 * Math.sin(this.elapsedSec * 3 + m.rx * 10));
      ctx.beginPath();
      ctx.arc(m.rx * w, m.ry * h, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ---- WORLD SPACE ----
    ctx.save();
    ctx.translate(-camX, -camY);

    // Persistent fading ground decals (scorch / frost / craters / magma)
    for (const d of this.groundDecals) {
      const a = Math.min(1, d.life / Math.min(1, d.maxLife));
      ctx.save();
      ctx.globalAlpha = a * 0.42;
      const g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, d.radius);
      if (d.kind === 'scorch' || d.kind === 'magma_enemy') {
        g.addColorStop(0, d.kind === 'magma_enemy' ? '#ef4444' : '#f97316');
        g.addColorStop(0.65, '#7c2d12');
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (d.kind === 'frost') {
        g.addColorStop(0, '#bae6fd');
        g.addColorStop(0.65, '#0284c7');
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        g.addColorStop(0, '#020617');
        g.addColorStop(0.75, '#334155');
        g.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Spawn Telegraphs
    for (const st of this.spawnTelegraphs) {
      const frac = 1 - st.life / st.maxLife;
      ctx.save();
      ctx.strokeStyle = st.color;
      ctx.globalAlpha = (1 - frac) * 0.85;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.radius * (1.2 - frac * 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Interactive Starforge Shrine / Supply Pod
    if (this.objective) {
      const obj = this.objective;
      const col = obj.kind === 'shrine' ? '#fbbf24' : '#38bdf8';
      const prog = Math.min(1, obj.progress / obj.duration);
      const pulse = 0.88 + Math.sin(this.elapsedSec * 5) * 0.12;
      ctx.save();
      ctx.fillStyle = `${col}18`;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `${col}88`;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -this.elapsedSec * 36;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (prog > 0) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }

      // Central crystal / pod beacon
      ctx.translate(obj.x, obj.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      if (obj.kind === 'shrine') {
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(12, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        roundedRectPath(ctx, -13, -13, 26, 26, 6);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Meteor impact telegraphs
    for (const mt of this.meteorTelegraphs) {
      const prog = 1 - mt.delay / Math.max(0.01, mt.maxDelay);
      ctx.save();
      ctx.strokeStyle = mt.color;
      ctx.fillStyle = `${mt.color}22`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, mt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `${mt.color}44`;
      ctx.beginPath();
      ctx.arc(mt.x, mt.y, mt.radius * prog, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Plasma Mines (Relic)
    for (const m of this.plasmaMines) {
      const blink = 0.65 + 0.35 * Math.sin(this.elapsedSec * 12);
      ctx.save();
      ctx.fillStyle = `rgba(56, 189, 248, ${(0.25 * blink).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Gravity Zones
    for (const z of this.gravZones) {
      ctx.save();
      ctx.globalAlpha = 0.32 * Math.min(1, z.life);
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
      ctx.restore();
    }

    // Deployed Aegis Turrets
    for (const t of this.deployedTurrets) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = 'rgba(20,184,166,0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(t.angle);
      ctx.fillStyle = '#0f766e';
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundedRectPath(ctx, -10, -9, 20, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(8, -4.5, 9, 3);
      ctx.fillRect(8, 1.5, 9, 3);
      ctx.restore();
    }

    // Pickups
    for (const p of this.pickups) {
      if (Math.abs(p.x - this.px) > w * 0.72 || Math.abs(p.y - this.py) > h * 0.72) continue;
      if (p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l') {
        const col = p.kind === 'xp_l' ? '#fbbf24' : p.kind === 'xp_m' ? '#34d399' : '#38bdf8';
        if (p.magnetized) {
          const ang = Math.atan2(this.py - p.y, this.px - p.x);
          ctx.save();
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.5;
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
      } else if (p.kind === 'coin') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.kind === 'gem') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 8);
        ctx.lineTo(p.x + 6, p.y - 2);
        ctx.lineTo(p.x + 4, p.y + 7);
        ctx.lineTo(p.x - 4, p.y + 7);
        ctx.lineTo(p.x - 6, p.y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      } else if (p.kind === 'heal') {
        ctx.fillStyle = 'rgba(16,185,129,0.25)';
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
        ctx.fillStyle = 'rgba(251,191,36,0.25)';
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

    // Enemies
    for (const e of this.enemies) {
      if (Math.abs(e.x - this.px) > w * 0.74 || Math.abs(e.y - this.py) > h * 0.74) continue;
      this.drawMonster(ctx, e);
    }

    // Orbiting Weapons (Orbital Saws, Orbital Turrets, Phoenix Drones)
    this.drawOrbitingWeapons(ctx);

    // Dash afterimages
    for (const a of this.afterimages) {
      const alpha = Math.max(0, a.life * 2.1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.hero.accentColor;
      ctx.beginPath();
      roundedRectPath(ctx, a.x - 9, a.y - 16, 18, 28, 6);
      ctx.fill();
      ctx.restore();
    }

    // Player Hero
    this.drawPlayerCharacter(ctx);

    // ---- ADDITIVE NEON BLOOM LAYER ('lighter') ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Ring waves
    for (const r of this.rings) {
      const prog = 1 - r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - prog);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = (r.isFrost ? 6 : 4.5) * (1 - prog * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxRadius * prog, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Plasma Slashes
    for (const s of this.slashes) {
      const alpha = Math.max(0, s.life / s.maxLife);
      const rArc = s.radius * (0.76 + (1 - alpha) * 0.14);
      ctx.save();
      ctx.globalAlpha = alpha * 0.42;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.x, s.y, rArc, s.angle - s.spread / 2, s.angle + s.spread / 2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rArc, s.angle - s.spread / 2, s.angle + s.spread / 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rArc + 2, s.angle - s.spread * 0.42, s.angle + s.spread * 0.42);
      ctx.stroke();
      ctx.restore();
    }

    // Jagged Lightning
    for (const l of this.lightnings) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, l.life / Math.max(0.05, l.maxLife));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      l.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
    }

    // Boss Lasers (additive glow)
    for (const e of this.enemies) {
      if (e.kind !== 'boss') continue;
      if (e.bossState === 'telegraph_laser' || e.bossState === 'firing_laser') {
        const p2 = Boolean(e.enraged);
        const beamCount = e.bossArchetype === 6 ? (p2 ? 4 : 2) : p2 ? 2 : 1;
        const beamLen = 460;
        for (let b = 0; b < beamCount; b++) {
          const ang = (e.bossAimAngle || 0) + (b * Math.PI * 2) / beamCount;
          const tx = e.x + Math.cos(ang) * beamLen;
          const ty = e.y + Math.sin(ang) * beamLen;
          ctx.save();
          if (e.bossState === 'telegraph_laser') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 8]);
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
          } else {
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 26;
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
          ctx.restore();
        }
      } else if (e.bossState === 'telegraph_dash') {
        const ang = e.bossAimAngle || 0;
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 4;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(ang) * 260, e.y + Math.sin(ang) * 260);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Projectiles
    for (const p of this.projectiles) {
      this.drawProjectile(ctx, p);
    }

    // Additive particles
    for (const pt of this.particles) {
      if (!pt.additive) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      if (pt.shard) {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot || 0);
        ctx.beginPath();
        ctx.moveTo(pt.size * 1.6, 0);
        ctx.lineTo(0, -pt.size * 0.55);
        ctx.lineTo(-pt.size, 0);
        ctx.lineTo(0, pt.size * 0.55);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.restore();
    }

    ctx.restore(); // End additive bloom

    // Non-additive particles
    for (const pt of this.particles) {
      if (pt.additive) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    // Floating Damage Numbers
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

    // Draw Hero Skin Cosmetic Aura + Companion Combat Drone
    if (this.skinAura) {
      ctx.save();
      ctx.strokeStyle = this.skinAura;
      ctx.globalAlpha = 0.32 + 0.14 * Math.sin(this.elapsedSec * 5);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 26 + Math.sin(this.elapsedSec * 4) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.drawCompanionDrone(ctx);

    ctx.restore(); // End World Space

    // ---- SCREEN SPACE INDICATORS (clamped safely away from Top HUD & Bottom-Right buttons) ----
    this.drawOffscreenIndicators(ctx, camX, camY, w, h);

    // FTUE First-Run Animated Joystick Hint (first 6 seconds until player touches)
    if (this.showFtueHint && !this.touchActive && this.elapsedSec < 6) {
      const cx = w * 0.5;
      const cy = h * 0.72;
      const ox = Math.cos(this.elapsedSec * 2.6) * 22;
      const oy = Math.sin(this.elapsedSec * 2.6) * 14;
      ctx.save();
      ctx.fillStyle = 'rgba(15,23,42,0.68)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DRAG TO MOVE • AUTO-FIRE ACTIVE', cx, cy + 58);
      ctx.restore();
    }

    // Virtual Floating Joystick HUD
    if (this.touchActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.fillStyle = 'rgba(15,23,42,0.36)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.touchStartX, this.touchStartY, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.skinPrimary || this.hero.accentColor;
      ctx.beginPath();
      ctx.arc(this.touchStartX + this.joyX * 44, this.touchStartY + this.joyY * 44, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawOffscreenIndicators(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    w: number,
    h: number
  ): void {
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
      if (p.kind === 'chest') markers.push({ x: p.x, y: p.y, color: '#fbbf24', label: 'CHEST' });
      else if (p.kind === 'magnet') markers.push({ x: p.x, y: p.y, color: '#c084fc', label: 'MAGNET' });
      else if (p.kind === 'bomb') markers.push({ x: p.x, y: p.y, color: '#38bdf8', label: 'EMP' });
    }
    if (this.objective) {
      markers.push({
        x: this.objective.x,
        y: this.objective.y,
        color: this.objective.kind === 'shrine' ? '#fbbf24' : '#38bdf8',
        label: this.objective.kind === 'shrine' ? 'RELIC' : 'POD',
      });
    }

    const topSafe = 148;
    const bottomSafe = 32;
    const sideSafe = 28;
    for (const m of markers) {
      const sx = m.x - camX;
      const sy = m.y - camY;
      if (sx >= 24 && sx <= w - 24 && sy >= topSafe && sy <= h - 24) continue;
      const ang = Math.atan2(sy - h / 2, sx - w / 2);
      let ix = Math.max(sideSafe, Math.min(w - sideSafe, w / 2 + Math.cos(ang) * (w / 2 - sideSafe)));
      let iy = Math.max(topSafe, Math.min(h - bottomSafe, h / 2 + Math.sin(ang) * (h / 2 - sideSafe)));

      // Keep clear of bottom-right Dash/Ultimate button cluster
      if (ix > w - 125 && iy > h - 210) {
        if (w - ix < h - iy) {
          iy = h - 215;
        } else {
          ix = w - 130;
        }
      }

      ctx.save();
      ctx.translate(ix, iy);
      // Directional pointer arrow
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.lineTo(13, -5);
      ctx.lineTo(13, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(9, 14, 30, 0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 7.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, 0, 3);
      ctx.restore();
    }
  }

  private drawOrbitingWeapons(ctx: CanvasRenderingContext2D): void {
    // Orbital Saws
    const orbState = this.weapons.get('orbital_saw');
    if (orbState) {
      const extraProj = Math.floor((this.passives.get('fusion_cell') || 0) / 2);
      const count = orbState.evolved ? 6 : 1 + orbState.lv + extraProj;
      const orbR = (orbState.evolved ? 110 : 78 + orbState.lv * 6) * this.getAreaMult();
      ctx.save();
      ctx.strokeStyle = orbState.evolved ? 'rgba(251, 191, 36, 0.18)' : 'rgba(56, 189, 248, 0.14)';
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

    // Orbital Turrets
    const turretState = this.weapons.get('orbital_turret');
    if (turretState) {
      const tCount = turretState.evolved ? 4 : Math.min(3, 1 + Math.floor(turretState.lv / 2));
      for (let i = 0; i < tCount; i++) {
        const tAng = this.elapsedSec * 1.45 + (i * Math.PI * 2) / tCount;
        const tx = this.px + Math.cos(tAng) * 46;
        const ty = this.py + Math.sin(tAng) * 46;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = turretState.evolved ? 'rgba(94,234,212,0.28)' : 'rgba(20,184,166,0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = turretState.evolved ? '#5eead4' : '#14b8a6';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        roundedRectPath(ctx, -7, -6, 14, 12, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = turretState.evolved ? '#fef08a' : '#2dd4bf';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Phoenix Drones
    const droneState = this.weapons.get('inferno_drone');
    if (droneState) {
      const dCount = droneState.evolved ? 4 : 2;
      for (let i = 0; i < dCount; i++) {
        const dAng = this.elapsedSec * 2.4 + (i * Math.PI * 2) / dCount;
        const dx = this.px + Math.cos(dAng) * 34;
        const dy = this.py + Math.sin(dAng) * 34;
        ctx.save();
        ctx.translate(dx, dy);
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
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.boomerang) {
      ctx.rotate(this.elapsedSec * 16);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, -Math.PI * 0.72, Math.PI * 0.72);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else if (p.isSolarLance) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(-34, -p.radius * 0.65, 48, p.radius * 1.3);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-14, -p.radius * 0.65);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, p.radius * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-4, -p.radius * 0.28);
      ctx.lineTo(-4, p.radius * 0.28);
      ctx.closePath();
      ctx.fill();
    } else if (p.isTurretLaser) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.radius * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (p.isArrow) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(6, -5);
      ctx.lineTo(8, 0);
      ctx.lineTo(6, 5);
      ctx.closePath();
      ctx.fill();
    } else if (p.isMagicOrb) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.34;
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
    } else if (p.isIceShard) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (!p.fromEnemy) {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.radius * 1.5, -p.radius * 0.65, p.radius * 3.0, p.radius * 1.3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-p.radius * 0.6, -p.radius * 0.3, p.radius * 1.4, p.radius * 0.6);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayerCharacter(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.65;
    }

    // Pyro-Valk burning aura ring
    if (this.hero.id === 'pyro') {
      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(this.px, this.py, 82 * this.getAreaMult(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pickup Magnet subtle halo
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.13)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.px, this.py, this.getPickupRadius(), 0, Math.PI * 2);
    ctx.stroke();

    // Hero Glowing Aura Rings beneath feet
    const auraPulse = 22 + Math.sin(this.elapsedSec * 4.5) * 2.5;
    ctx.save();
    ctx.strokeStyle = this.ultCharge >= 100 ? '#fbbf24' : this.hero.accentColor;
    ctx.globalAlpha = this.ultCharge >= 100 ? 0.6 : 0.32;
    ctx.lineWidth = this.ultCharge >= 100 ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.ellipse(this.px, this.py + 16, auraPulse, auraPulse * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const dirX = Math.cos(this.weaponAimAngle) >= 0 ? 1 : -1;
    const walkSwing = this.isMoving ? Math.sin(this.walkPhase) * 6 : 0;
    const bob = this.isMoving ? Math.abs(Math.sin(this.walkPhase)) * 3 : Math.sin(this.elapsedSec * 3.2) * 0.9;
    const bodyScale = this.hero.id === 'titan' ? 1.15 : 1.0;

    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.scale(bodyScale, bodyScale);

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, 19, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hero-specific back silhouette (Pyro jet wings, Aegis radar pack, or cape)
    const capeWave = this.isMoving ? Math.sin(this.walkPhase * 1.1) * 5.2 : Math.sin(this.elapsedSec * 2.5) * 1.8;
    if (this.hero.id === 'pyro') {
      // Blazing solar jet wings
      const flap = Math.sin(this.elapsedSec * 7) * 3;
      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 6, -4 - bob);
        ctx.lineTo(side * 24, -14 - bob + flap);
        ctx.lineTo(side * 19, 4 - bob + flap * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (this.hero.id === 'aegis') {
      // Tactical engineer backpack & antenna
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundedRectPath(ctx, -14 * dirX - 4, -8 - bob, 8, 16, 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-14 * dirX, -8 - bob);
      ctx.lineTo(-14 * dirX, -20 - bob);
      ctx.stroke();
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.arc(-14 * dirX, -21 - bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Flowing layered cape
      ctx.fillStyle = this.hero.secondaryColor;
      ctx.beginPath();
      ctx.moveTo(-4 * dirX, -6 - bob);
      ctx.quadraticCurveTo(-11 * dirX + capeWave * 0.25, 5 - bob * 0.7, -16 * dirX + capeWave * 0.5, 16 - bob * 0.4);
      ctx.lineTo(3 * dirX + capeWave * 0.15, 15 - bob * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.hero.accentColor;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Boots
    const drawBoot = (xOff: number, swing: number) => {
      const ly = 8 + swing * 0.55 - bob * 0.3;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = this.hero.accentColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      roundedRectPath(ctx, xOff - 3.5, ly, 7, 10, 3);
      ctx.fill();
      ctx.stroke();
    };
    drawBoot(-5, walkSwing);
    drawBoot(5, -walkSwing);

    // Armored torso
    ctx.fillStyle = this.hero.secondaryColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    roundedRectPath(ctx, -10, -7 - bob, 20, 17, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.hero.accentColor;
    ctx.beginPath();
    roundedRectPath(ctx, -7.5, -5.2 - bob, 15, 9.2, 3);
    ctx.fill();

    // Pauldrons
    const pRad = this.hero.id === 'titan' ? 6.2 : 4.5;
    ctx.fillStyle = this.hero.accentColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(-10.2, -4 - bob, pRad, 0, Math.PI * 2);
    ctx.arc(10.2, -4 - bob, pRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head & Hero-specific Helmet Crest
    const headY = -14 - bob;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = this.hero.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY, 9.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.hero.accentColor;
    if (this.hero.id === 'kael') {
      ctx.beginPath();
      ctx.moveTo(-8 * dirX, headY - 4);
      ctx.lineTo(-18 * dirX - capeWave * 0.55, headY - 9);
      ctx.lineTo(-13 * dirX, headY - 1);
      ctx.closePath();
      ctx.fill();
    } else if (this.hero.id === 'nova') {
      ctx.beginPath();
      ctx.moveTo(-7, headY - 7);
      ctx.lineTo(0, headY - 17);
      ctx.lineTo(7, headY - 7);
      ctx.closePath();
      ctx.fill();
    } else if (this.hero.id === 'titan') {
      ctx.fillRect(-8.5, headY - 12, 17, 4.5);
    } else if (this.hero.id === 'aegis') {
      ctx.fillRect(-7, headY - 11.5, 14, 3.5);
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.arc(0, headY - 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.hero.id === 'pyro') {
      ctx.beginPath();
      ctx.moveTo(-8, headY - 6);
      ctx.lineTo(-12, headY - 15);
      ctx.lineTo(0, headY - 10);
      ctx.lineTo(12, headY - 15);
      ctx.lineTo(8, headY - 6);
      ctx.closePath();
      ctx.fill();
    } else {
      // Vespera twin void horns
      ctx.beginPath();
      ctx.moveTo(-8, headY - 5);
      ctx.lineTo(-12, headY - 15.5);
      ctx.lineTo(-3, headY - 8);
      ctx.moveTo(8, headY - 5);
      ctx.lineTo(12, headY - 15.5);
      ctx.lineTo(3, headY - 8);
      ctx.fill();
    }

    // Visor
    ctx.fillStyle = this.hero.id === 'pyro' ? '#fef08a' : '#e0f2fe';
    ctx.beginPath();
    roundedRectPath(ctx, dirX * 2 - 6, headY - 3, 12, 5.5, 2.5);
    ctx.fill();

    // Visually Evolving Held Weapon
    this.drawHeldWeapon(ctx, dirX, bob);

    // Energy Barrier Shield (Aegis Ult / Overclocked Shield Relic)
    if (this.shieldHp > 0) {
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -1, 27, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (this.invulnTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -1, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Overhead / Under-foot HP & Shield bar
    const barW = 38;
    const hpFrac = Math.max(0, Math.min(1, this.hp / this.getEffectiveMaxHp()));
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(this.px - barW / 2, this.py + 25, barW, 5);
    ctx.fillStyle = hpFrac > 0.35 ? '#10b981' : '#ef4444';
    ctx.fillRect(this.px - barW / 2, this.py + 25, barW * hpFrac, 5);
    if (this.shieldHp > 0) {
      const shFrac = Math.min(1, this.shieldHp / 90);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(this.px - barW / 2, this.py + 22, barW * shFrac, 2.5);
    }
    ctx.restore();
  }

  private drawHeldWeapon(ctx: CanvasRenderingContext2D, dirX: number, bob: number): void {
    const st = this.weapons.get(this.primaryWeaponId);
    const lv = st?.lv || 1;
    const evolved = Boolean(st?.evolved);
    const wScale = evolved ? 1.24 : 1 + (lv - 1) * 0.05;
    const atkFrac = this.attackAnimTimer > 0 ? 1 - this.attackAnimTimer / Math.max(0.01, this.attackAnimDuration) : 0;

    ctx.save();
    ctx.translate(dirX * 5, -1 - bob);
    ctx.scale(wScale, wScale);

    if (this.primaryWeaponId === 'plasma_blade') {
      const swingOffset = this.attackAnimTimer > 0 ? -1.35 + atkFrac * 2.7 : -0.35 * dirX;
      ctx.rotate(this.weaponAimAngle + swingOffset);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(11, -7, 3.2, 14);
      const bladeCol = evolved ? '#f43f5e' : lv >= 3 ? '#7dd3fc' : '#38bdf8';
      ctx.fillStyle = evolved ? '#fef08a' : '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(14, -3.5);
      ctx.lineTo(40, -2);
      ctx.lineTo(45, 0);
      ctx.lineTo(40, 2);
      ctx.lineTo(14, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = bladeCol;
      ctx.lineWidth = evolved ? 2.2 : 1.4;
      ctx.stroke();
    } else if (this.primaryWeaponId === 'arcane_staff') {
      const thrust = this.attackAnimTimer > 0 ? Math.sin(atkFrac * Math.PI) * 8 : 0;
      ctx.rotate(this.weaponAimAngle);
      ctx.translate(thrust, 0);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-5, -2, 32, 4);
      const orbCol = evolved ? '#f0abfc' : '#c084fc';
      ctx.fillStyle = orbCol;
      ctx.beginPath();
      ctx.arc(32, 0, evolved ? 7.5 : 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(31, -1.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.primaryWeaponId === 'star_bow') {
      const drawPull = this.attackAnimTimer > 0 ? Math.sin(atkFrac * Math.PI) * 6 : 2;
      ctx.rotate(this.weaponAimAngle);
      ctx.strokeStyle = evolved ? '#fbbf24' : '#22c55e';
      ctx.lineWidth = evolved ? 3.8 : 3.0;
      ctx.beginPath();
      ctx.moveTo(8, -15);
      ctx.quadraticCurveTo(21, 0, 8, 15);
      ctx.stroke();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(8, -14);
      ctx.lineTo(6 - drawPull, 0);
      ctx.lineTo(8, 14);
      ctx.stroke();
    } else if (this.primaryWeaponId === 'solar_lance') {
      const thrust = this.attackAnimTimer > 0 ? Math.sin(atkFrac * Math.PI) * 14 : 0;
      ctx.rotate(this.weaponAimAngle);
      ctx.translate(thrust, 0);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-6, -1.8, 34, 3.6);
      ctx.fillStyle = evolved ? '#ef4444' : '#f97316';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(25, -6);
      ctx.lineTo(28, 0);
      ctx.lineTo(25, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.primaryWeaponId === 'orbital_turret') {
      ctx.rotate(this.weaponAimAngle);
      ctx.fillStyle = '#0f766e';
      ctx.strokeStyle = evolved ? '#fef08a' : '#5eead4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundedRectPath(ctx, 4, -5, 16, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(20, -2.5, 7, 5);
    } else {
      // Orbital Saw / Wrench blaster fallback
      ctx.rotate(this.weaponAimAngle);
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(16, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawBossSprite(ctx: CanvasRenderingContext2D, e: Enemy, fill: string, r: number): void {
    const arch = e.bossArchetype || 1;
    const enraged = Boolean(e.enraged);

    // Phase 2 Enrage Aura
    if (enraged) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.2;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.elapsedSec * 12);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (arch === 1) {
      // Dread-Mech Mk.I: Heavy Armored Mech with Twin Shoulder Cannons
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = fill;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      roundedRectPath(ctx, -r * 0.86, -r * 0.72, r * 1.72, r * 1.44, 12);
      ctx.fill();
      ctx.stroke();
      // Twin shoulder cannons
      ctx.fillStyle = fill;
      ctx.fillRect(-r * 1.18, -r * 0.45, r * 0.36, r * 0.85);
      ctx.fillRect(r * 0.82, -r * 0.45, r * 0.36, r * 0.85);
      // Glowing cyclops visor
      ctx.fillStyle = enraged ? '#ef4444' : '#fef08a';
      ctx.fillRect(-r * 0.52, -r * 0.25, r * 1.04, r * 0.26);
    } else if (arch === 2) {
      // Scorpio Colossus: Armored Scorpion Carapace + Overhead Tail Stinger
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 0.96, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Pincers
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.1);
      ctx.lineTo(-r * 1.28, -r * 0.65);
      ctx.moveTo(r * 0.7, -r * 0.1);
      ctx.lineTo(r * 1.28, -r * 0.65);
      ctx.stroke();
      // Curved plasma stinger tail
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.65, -r * 1.45, 0, -r * 1.22);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -r * 1.22, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (arch === 3) {
      // Glacier Sovereign: Crystalline Frost Monarch
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.22);
      ctx.lineTo(r * 0.95, -r * 0.25);
      ctx.lineTo(r * 0.65, r * 0.95);
      ctx.lineTo(-r * 0.65, r * 0.95);
      ctx.lineTo(-r * 0.95, -r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Inner prism core
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(r * 0.34, 0);
      ctx.lineTo(0, r * 0.55);
      ctx.lineTo(-r * 0.34, 0);
      ctx.closePath();
      ctx.fill();
    } else if (arch === 4) {
      // Inferno Behemoth: Horned Volcanic Juggernaut
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f97316';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.35, -r * 0.72);
        ctx.lineTo(side * r * 1.05, -r * 1.4);
        ctx.lineTo(side * r * 0.68, -r * 0.45);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-r * 0.32, -r * 0.15, 7, 0, Math.PI * 2);
      ctx.arc(r * 0.32, -r * 0.15, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (arch === 5) {
      // Archon Nullifier: Floating Diamond Void Entity with Rotating Rings
      ctx.save();
      ctx.rotate(this.elapsedSec * 1.5);
      ctx.strokeStyle = '#f0abfc';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = fill;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.82, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.82, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Nexus Overlord: Hexagonal Fortress Core + Orbiting Shield Drones
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#ccfbf1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + this.elapsedSec * 0.35;
        const px = Math.cos(a) * r * 0.96;
        const py = Math.sin(a) * r * 0.96;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();

      const drones = e.bossDrones || 3;
      for (let d = 0; d < drones; d++) {
        const a = this.elapsedSec * 2.0 + (d * Math.PI * 2) / drones;
        const dx = Math.cos(a) * (r + 26);
        const dy = Math.sin(a) * (r + 26);
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(dx, dy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
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

    // Ground shadow
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
      this.drawBossSprite(ctx, e, fill, r);
    } else if (e.kind === 'elite') {
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      roundedRectPath(ctx, -r * 0.8, -r * 0.78, r * 1.6, r * 1.56, r * 0.55);
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
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 2, -r * 0.12, 4, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 2, -r * 0.12, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'sentinel') {
      ctx.fillStyle = fill;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundedRectPath(ctx, -r * 0.85, -r * 0.82, r * 1.7, r * 1.64, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-r * 0.5, -r * 0.35, r, r * 0.28);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-r * 0.22 + face * 2, -r * 0.2, 2.8, 0, Math.PI * 2);
      ctx.arc(r * 0.22 + face * 2, -r * 0.2, 2.8, 0, Math.PI * 2);
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
    } else if (e.kind === 'splitter') {
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
      ctx.fillStyle = isFlashing ? '#ffffff' : '#22c55e';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else {
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-r * 0.28 + face * 1.5, -r * 0.15, 2.7, 0, Math.PI * 2);
      ctx.arc(r * 0.28 + face * 1.5, -r * 0.15, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isFlashing) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
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

  private updateCompanionDrone(dt: number): void {
    if (!this.droneId) return;
    this.droneAngle += dt * (this.droneId === 'aegis_sentinel' ? 3.8 : 1.9);
    const orbitR = this.droneId === 'aegis_sentinel' ? 44 : 52;
    const targetX = this.px + Math.cos(this.droneAngle) * orbitR;
    const targetY = this.py + Math.sin(this.droneAngle) * orbitR - 8;
    this.droneX += (targetX - this.droneX) * Math.min(1, dt * 8);
    this.droneY += (targetY - this.droneY) * Math.min(1, dt * 8);

    // Aegis Sentinel continuously intercepts nearby enemy projectiles
    if (this.droneId === 'aegis_sentinel') {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (!p.fromEnemy) continue;
        if (Math.hypot(p.x - this.droneX, p.y - this.droneY) < 28) {
          this.projectiles.splice(i, 1);
          this.rings.push({ x: p.x, y: p.y, maxRadius: 30, color: '#a78bfa', life: 0.22, maxLife: 0.22 });
        }
      }
    }

    this.droneCd -= dt;
    if (this.droneCd > 0) return;

    const lvMult = 1 + (this.droneLevel - 1) * 0.14;
    if (this.droneId === 'volt_wasp') {
      this.droneCd = 2.2;
      const nearby = this.enemies
        .filter((e) => Math.hypot(e.x - this.droneX, e.y - this.droneY) < 260)
        .slice(0, 3);
      if (nearby.length > 0) {
        const pts: { x: number; y: number }[] = [{ x: this.droneX, y: this.droneY }];
        const dmg = this.stats.atk * 1.35 * lvMult;
        for (const e of nearby) {
          pts.push({ x: e.x, y: e.y });
          this.damageEnemy(e, dmg, false, 'drone');
        }
        this.lightnings.push({ points: pts, color: '#38bdf8', life: 0.2, maxLife: 0.2 });
      }
    } else if (this.droneId === 'medi_orb') {
      this.droneCd = 7.5;
      const healAmt = Math.max(8, Math.round(this.stats.maxHp * 0.05 * lvMult));
      this.hp = Math.min(this.stats.maxHp, this.hp + healAmt);
      this.rings.push({ x: this.px, y: this.py, maxRadius: 72, color: '#34d399', life: 0.35, maxLife: 0.35 });
    } else if (this.droneId === 'cryo_owl') {
      this.droneCd = 3.5;
      const dmg = this.stats.atk * 1.15 * lvMult;
      this.rings.push({ x: this.droneX, y: this.droneY, maxRadius: 120, color: '#22d3ee', life: 0.35, maxLife: 0.35, isFrost: true });
      for (const e of this.enemies) {
        if (Math.hypot(e.x - this.droneX, e.y - this.droneY) < 125) {
          e.slowTimer = Math.max(e.slowTimer, 2.2);
          this.damageEnemy(e, dmg, false, 'drone');
        }
      }
    } else if (this.droneId === 'scrap_hound') {
      this.droneCd = 3.0;
      for (const p of this.pickups) {
        if ((p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l' || p.kind === 'coin') &&
            Math.hypot(p.x - this.px, p.y - this.py) < 380) {
          p.magnetized = true;
        }
      }
      this.rings.push({ x: this.droneX, y: this.droneY, maxRadius: 56, color: '#fbbf24', life: 0.28, maxLife: 0.28 });
    } else if (this.droneId === 'nova_turret') {
      this.droneCd = 2.4;
      let target: Enemy | null = null;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - this.droneX, e.y - this.droneY) > 360) continue;
        if (!target || e.maxHp > target.maxHp) target = e;
      }
      if (target) {
        const dmg = this.stats.atk * 2.5 * lvMult;
        this.lightnings.push({ points: [{ x: this.droneX, y: this.droneY }, { x: target.x, y: target.y }], color: '#fb923c', life: 0.18, maxLife: 0.18 });
        this.rings.push({ x: target.x, y: target.y, maxRadius: 52, color: '#fb923c', life: 0.25, maxLife: 0.25 });
        this.damageEnemy(target, dmg, true, 'drone');
      }
    } else {
      this.droneCd = 2.0;
    }
  }

  private drawCompanionDrone(ctx: CanvasRenderingContext2D): void {
    if (!this.droneId) return;
    const colorMap: Record<string, string> = {
      volt_wasp: '#38bdf8',
      medi_orb: '#34d399',
      cryo_owl: '#22d3ee',
      scrap_hound: '#fbbf24',
      nova_turret: '#fb923c',
      aegis_sentinel: '#a78bfa',
    };
    const col = colorMap[this.droneId] || '#38bdf8';
    const bob = Math.sin(this.elapsedSec * 7) * 3;
    ctx.save();
    ctx.translate(this.droneX, this.droneY + bob);
    // Outer glow
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    // Drone chassis
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Core eye
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
