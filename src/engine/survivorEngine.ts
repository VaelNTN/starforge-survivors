import { HEROES, PASSIVES, WEAPONS } from '../data/gameCatalog';
import { audio } from '../services/audio';
import {
  ChapterDef,
  CombatStats,
  HeroDef,
  PassiveId,
  Rarity,
  WeaponId,
} from '../types/game';
import { createGearItem } from '../storage/saveState';
import { GEAR_TEMPLATES } from '../data/gameCatalog';

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
  kills: number;
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
  onDeathOffer: (canFreeRevive: boolean) => void;
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
    newGearDrop: ReturnType<typeof createGearItem> | null;
  }) => void;
}

export class SurvivorEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chapter: ChapterDef;
  private hero: HeroDef;
  private stats: CombatStats;
  private damageNumbers: boolean;
  private vibration: boolean;
  private cb: EngineCallbacks;

  private rafId: number | null = null;
  private lastTs = 0;
  private paused = false;
  private ended = false;
  private hudAccum = 0;

  // Player state in world coordinates
  private px = 0;
  private py = 0;
  private facingAngle = 0;
  private hp: number;
  private level = 1;
  private xp = 0;
  private xpNext = 24;
  private invulnTimer = 0;
  private dashTimer = 0;
  private dashCd = 0;
  private dashVx = 0;
  private dashVy = 0;
  private ultCharge = 35;

  private elapsedSec = 0;
  private kills = 0;
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
  private afterimages: { x: number; y: number; life: number }[] = [];

  private spawnAccum = 0;
  private eliteSpawnedMin = new Set<number>();
  private bossSpawned = false;
  private activeBossId: number | null = null;

  // Input state
  private keys = new Set<string>();
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurX = 0;
  private touchCurY = 0;
  private joyX = 0;
  private joyY = 0;

  private width = 390;
  private height = 780;

  constructor(
    canvas: HTMLCanvasElement,
    chapter: ChapterDef,
    heroId: HeroDef['id'],
    stats: CombatStats,
    damageNumbers: boolean,
    vibration: boolean,
    cb: EngineCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D context unavailable');
    this.ctx = context;
    this.chapter = chapter;
    this.hero = HEROES.find((h) => h.id === heroId) || HEROES[0];
    this.stats = stats;
    this.damageNumbers = damageNumbers;
    this.vibration = vibration;
    this.cb = cb;

    this.hp = stats.maxHp;
    this.revivesLeft = stats.revives;
    this.weapons.set(this.hero.startingWeapon, { lv: 1, cd: 0.25, evolved: false });

    this.resize();
    this.bindInput();
  }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private onPointerDown = (e: PointerEvent) => {
    if (this.paused || this.ended) return;
    audio.unlock();
    this.touchActive = true;
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
    this.touchCurX = e.clientX;
    this.touchCurY = e.clientY;
    this.updateJoystickVector();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.touchActive) return;
    this.touchCurX = e.clientX;
    this.touchCurY = e.clientY;
    this.updateJoystickVector();
  };

  private onPointerUp = () => {
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
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('resize', this.resize);
  }

  resize = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(320, rect.width || window.innerWidth);
    this.height = Math.max(480, rect.height || window.innerHeight);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  start(): void {
    this.lastTs = performance.now();
    audio.startMusicLoop();
    const tick = (now: number) => {
      if (this.ended) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
      this.lastTs = now;
      if (!this.paused) {
        this.update(dt);
      }
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  destroy(): void {
    this.ended = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    audio.stopMusicLoop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('resize', this.resize);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.touchActive = false;
      this.joyX = 0;
      this.joyY = 0;
    } else {
      this.lastTs = performance.now();
    }
  }

  triggerDash(): void {
    if (this.paused || this.ended || this.dashCd > 0) return;
    const speedMult = 1 + (this.passives.get('dark_matter') || 0) * 0.09;
    this.dashCd = Math.max(1.5, 3.0 / speedMult);
    this.dashTimer = 0.2;
    this.invulnTimer = Math.max(this.invulnTimer, 0.36);
    const angle = this.facingAngle;
    this.dashVx = Math.cos(angle) * 640;
    this.dashVy = Math.sin(angle) * 640;
    audio.playDash();
    this.spawnRing(this.px, this.py, 55, this.hero.accentColor, 0.25);
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
      this.hp = Math.min(this.stats.maxHp, this.hp + Math.round(this.stats.maxHp * 0.4));
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
      this.hp = Math.min(this.stats.maxHp, this.hp + Math.min(80, healed));
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

  applyDraftOption(opt: DraftOption): void {
    if (opt.kind === 'evo') {
      const wId = opt.id as WeaponId;
      const st = this.weapons.get(wId);
      if (st) {
        st.evolved = true;
        st.lv = 6;
        if (!this.evosUnlocked.includes(opt.name)) this.evosUnlocked.push(opt.name);
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
        this.hp = Math.min(this.stats.maxHp * 1.9, this.hp + Math.round(this.stats.maxHp * 0.18));
      }
    } else {
      this.hp = Math.min(this.getEffectiveMaxHp(), this.hp + Math.round(this.getEffectiveMaxHp() * 0.35));
      this.coinsEarned += 150;
    }

    this.setPaused(false);
    this.emitHud();
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
    audio.stopMusicLoop();

    const bonusCoins = victory ? this.chapter.rewardCoins : Math.round(this.elapsedSec * 6);
    const bonusGems = victory ? this.chapter.rewardGems : Math.floor(this.elapsedSec / 45) * 3;
    const totalCoins = Math.round((this.coinsEarned + bonusCoins) * this.stats.goldMult);
    const totalGems = this.gemsEarned + bonusGems;
    const blueprints = Math.max(1, Math.floor(this.bossesKilled * 3 + this.elapsedSec / 35 + (victory ? 6 : 0)));

    let gearDrop: ReturnType<typeof createGearItem> | null = null;
    if (victory || this.bossesKilled >= 1 || this.elapsedSec >= 90) {
      const tpl = GEAR_TEMPLATES[Math.floor(Math.random() * GEAR_TEMPLATES.length)];
      let rarity: Rarity = 'common';
      const r = Math.random();
      if (victory && r < 0.25) rarity = 'rare';
      else if (r < 0.45 || victory) rarity = 'uncommon';
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
    return Math.round(this.stats.pickupRadius * (1 + lv * 0.35));
  }

  private update(dt: number): void {
    this.elapsedSec += dt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCd > 0) this.dashCd = Math.max(0, this.dashCd - dt);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 28);

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
      this.afterimages.push({ x: this.px, y: this.py, life: 0.2 });
    } else if (len > 0.04) {
      const spdMult = 1 + (this.passives.get('dark_matter') || 0) * 0.09;
      const spd = this.stats.moveSpeed * spdMult;
      this.px += mx * spd * dt;
      this.py += my * spd * dt;
      this.facingAngle = Math.atan2(my, mx);
    }

    // Spawner logic
    this.updateSpawner(dt);

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
    if (this.chapter.mode === 'chapter' && !this.bossSpawned && this.elapsedSec >= this.chapter.durationSec) {
      this.spawnBoss();
    } else if (this.chapter.mode === 'endless') {
      const minute = Math.floor(this.elapsedSec / 60);
      if (minute >= 1 && !this.eliteSpawnedMin.has(minute)) {
        this.eliteSpawnedMin.add(minute);
        if (minute % 2 === 0) this.spawnBoss();
        else this.spawnEnemy('elite');
      }
    } else if (this.chapter.mode === 'chapter') {
      const halfTime = Math.floor(this.chapter.durationSec * 0.45);
      if (this.elapsedSec >= halfTime && !this.eliteSpawnedMin.has(1)) {
        this.eliteSpawnedMin.add(1);
        this.spawnEnemy('elite');
      }
    }

    this.hudAccum += dt;
    if (this.hudAccum >= 0.14) {
      this.hudAccum = 0;
      this.emitHud();
    }
  }

  private updateSpawner(dt: number): void {
    const intensity = 1 + this.elapsedSec / 45;
    const rate = (1.65 + intensity * 0.85) * this.chapter.spawnRateMult;
    this.spawnAccum += dt * rate;

    while (this.spawnAccum >= 1 && this.enemies.length < 155) {
      this.spawnAccum -= 1;
      const r = Math.random();
      let kind: Enemy['kind'] = 'swarmer';
      if (r < 0.025) kind = 'goblin';
      else if (this.elapsedSec > 90 && r < 0.14) kind = 'splitter';
      else if (this.elapsedSec > 55 && r < 0.28) kind = 'spitter';
      else if (this.elapsedSec > 30 && r < 0.48) kind = 'sentinel';
      else if (this.elapsedSec > 15 && r < 0.7) kind = 'dasher';
      this.spawnEnemy(kind);
    }
  }

  private spawnEnemy(kind: Enemy['kind'], customX?: number, customY?: number): Enemy {
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.max(this.width, this.height) * 0.62 + 40;
    const x = customX ?? this.px + Math.cos(angle) * spawnDist;
    const y = customY ?? this.py + Math.sin(angle) * spawnDist;

    const timeScale = 1 + this.elapsedSec * 0.014;
    const hpBase = 34 * this.chapter.enemyHpMult * timeScale;
    const dmgBase = 14 * this.chapter.enemyDmgMult * (1 + this.elapsedSec * 0.004);

    let radius = 13;
    let hp = hpBase;
    let speed = 78;
    let damage = dmgBase;
    let color = '#fb7185';
    let xpValue = 4;

    if (kind === 'dasher') {
      radius = 11;
      hp = hpBase * 0.72;
      speed = 128;
      color = '#f97316';
      xpValue = 5;
    } else if (kind === 'sentinel') {
      radius = 18;
      hp = hpBase * 2.5;
      speed = 54;
      damage = dmgBase * 1.35;
      color = '#94a3b8';
      xpValue = 10;
    } else if (kind === 'spitter') {
      radius = 14;
      hp = hpBase * 1.1;
      speed = 68;
      color = '#a3e635';
      xpValue = 8;
    } else if (kind === 'splitter') {
      radius = 17;
      hp = hpBase * 1.7;
      speed = 70;
      color = '#c084fc';
      xpValue = 9;
    } else if (kind === 'goblin') {
      radius = 14;
      hp = hpBase * 1.9;
      speed = 115;
      damage = 4;
      color = '#fbbf24';
      xpValue = 16;
    } else if (kind === 'elite') {
      radius = 27;
      hp = hpBase * 14;
      speed = 74;
      damage = dmgBase * 1.75;
      color = '#e879f9';
      xpValue = 45;
    } else if (kind === 'boss') {
      radius = 40;
      hp = hpBase * 42;
      speed = 82;
      damage = dmgBase * 2.2;
      color = '#ef4444';
      xpValue = 120;
    }

    const enemy: Enemy = {
      id: this.nextEnemyId++,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      hp,
      maxHp: hp,
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

  private spawnBoss(): void {
    this.bossSpawned = true;
    const boss = this.spawnEnemy('boss');
    this.activeBossId = boss.id;
    audio.playBossWarning();
    if (this.vibration && navigator.vibrate) navigator.vibrate([80, 60, 120]);
    this.cb.onBossBanner(this.chapter.bossName);
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

      const baseCd = (def.baseCooldownMs / 1000) * Math.max(0.55, 1 - (st.lv - 1) * 0.08) * cdMult;
      st.cd = st.evolved ? baseCd * 0.72 : baseCd;
      const dmg = (this.stats.atk + def.baseDamage) * (1 + (st.lv - 1) * 0.34) * dmgMult * (st.evolved ? 1.65 : 1);

      if (wId === 'plasma_blade') {
        const radius = (st.evolved ? 148 : 96 + st.lv * 10) * areaMult;
        const spread = st.evolved ? Math.PI * 2 : Math.PI * 0.85;
        const hitsBothSides = st.lv >= 3 || st.evolved;
        const angles = hitsBothSides && !st.evolved ? [this.facingAngle, this.facingAngle + Math.PI] : [this.facingAngle];
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
              if (st.evolved) {
                this.damageEnemy(e, dmg, false);
              } else {
                const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang)));
                if (diff <= spread / 2 + 0.25) {
                  this.damageEnemy(e, dmg, false);
                }
              }
            }
          }
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
        for (let i = 0; i < missiles; i++) {
          const target = this.enemies[(i * 3) % Math.max(1, this.enemies.length)] || null;
          const a = target
            ? Math.atan2(target.y - this.py, target.x - this.px) + (Math.random() - 0.5) * 0.25
            : Math.random() * Math.PI * 2;
          this.projectiles.push({
            fromEnemy: false,
            x: this.px + Math.cos(this.elapsedSec * 3 + i) * 28,
            y: this.py + Math.sin(this.elapsedSec * 3 + i) * 28,
            vx: Math.cos(a) * 390,
            vy: Math.sin(a) * 390,
            radius: st.evolved ? 8 : 6,
            damage: dmg,
            pierce: 1,
            life: 1.6,
            maxLife: 1.6,
            color: st.evolved ? '#fbbf24' : '#fb7185',
            explosive: true,
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

      if (p.boomerang && p.life < p.maxLife * 0.55) {
        const ang = Math.atan2(this.py - p.y, this.px - p.x);
        p.vx += Math.cos(ang) * 950 * dt;
        p.vy += Math.sin(ang) * 950 * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

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
    this.projectiles = alive;
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
          this.spawnRing(e.x, e.y, 110, '#ef4444', 0.35);
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
    const critChance = this.stats.critChance + (this.passives.get('eagle_optics') || 0) * 0.06;
    const isCrit = forceCrit || Math.random() < critChance;
    const critMult = this.stats.critMult + (this.passives.get('eagle_optics') || 0) * 0.2;
    const dmg = Math.max(1, Math.round(rawDmg * (isCrit ? critMult : 1)));

    e.hp -= dmg;
    e.hitFlash = 0.09;
    audio.playHit(isCrit);

    if (this.damageNumbers && this.floats.length < 70) {
      this.floats.push({
        x: e.x + (Math.random() - 0.5) * 14,
        y: e.y - e.radius,
        vy: -42,
        text: isCrit ? `${dmg}!` : String(dmg),
        color: isCrit ? '#fbbf24' : '#f8fafc',
        life: isCrit ? 0.55 : 0.4,
        scale: isCrit ? 1.25 : 0.95,
      });
    }

    if (e.hp <= 0) {
      this.killEnemy(e);
    }
  }

  private killEnemy(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);

    this.kills += 1;
    this.ultCharge = Math.min(100, this.ultCharge + (e.kind === 'elite' ? 20 : e.kind === 'boss' ? 40 : 1.4));

    // Burst particles
    const pCount = e.kind === 'boss' ? 28 : e.kind === 'elite' ? 14 : 5;
    for (let i = 0; i < pCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: e.kind === 'boss' ? 5 : 3,
        color: e.color,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
      });
    }

    // Splitter spawns 2 mini dashers
    if (e.kind === 'splitter') {
      const m1 = this.spawnEnemy('dasher', e.x - 14, e.y);
      const m2 = this.spawnEnemy('dasher', e.x + 14, e.y);
      m1.hp = Math.round(e.maxHp * 0.3);
      m2.hp = Math.round(e.maxHp * 0.3);
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
      this.gemsEarned += 15;
      this.coinsEarned += 450;
      if (this.chapter.mode === 'chapter') {
        this.spawnRing(e.x, e.y, 260, '#fbbf24', 0.6);
        window.setTimeout(() => this.abortAndFinish(true), 650);
        return;
      } else {
        this.pickups.push({ kind: 'chest', x: e.x, y: e.y, val: 1, magnetized: false });
      }
    } else {
      const xpKind: Pickup['kind'] = e.xpValue >= 10 ? 'xp_l' : e.xpValue >= 6 ? 'xp_m' : 'xp_s';
      this.pickups.push({ kind: xpKind, x: e.x, y: e.y, val: e.xpValue, magnetized: false });
      const dropRoll = Math.random();
      if (dropRoll < 0.08) this.pickups.push({ kind: 'coin', x: e.x + 6, y: e.y, val: 15, magnetized: false });
      else if (dropRoll < 0.087) this.pickups.push({ kind: 'heal', x: e.x, y: e.y, val: 30, magnetized: false });
      else if (dropRoll < 0.091) this.pickups.push({ kind: 'magnet', x: e.x, y: e.y, val: 1, magnetized: false });
      else if (dropRoll < 0.094) this.pickups.push({ kind: 'bomb', x: e.x, y: e.y, val: 1, magnetized: false });
    }
  }

  private damagePlayer(rawDmg: number): void {
    if (this.invulnTimer > 0 || this.ended) return;
    const dmg = Math.max(2, Math.round(rawDmg - this.stats.armor));
    this.hp -= dmg;
    this.invulnTimer = 0.42;
    this.screenShake = Math.max(this.screenShake, 7);
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
    const xpMult = this.stats.xpMult + (this.passives.get('blood_ruby') || 0) * 0.1;
    const greedBonus = 1 + (this.passives.get('blood_ruby') || 0) * 0.1;
    const alive: Pickup[] = [];

    for (const p of this.pickups) {
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const dist = Math.hypot(dx, dy);

      if (p.kind !== 'chest' && (p.magnetized || dist <= rad)) {
        p.magnetized = true;
        const spd = 480;
        if (dist > 1) {
          p.x += (dx / dist) * spd * dt;
          p.y += (dy / dist) * spd * dt;
        }
      }

      if (dist <= 22) {
        if (p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l') {
          audio.playXpPickup();
          this.xp += p.val * xpMult;
          if (this.xp >= this.xpNext) {
            this.xp -= this.xpNext;
            this.level += 1;
            this.xpNext = Math.round(24 + this.level * 15 + Math.pow(this.level, 1.35) * 4);
            audio.playLevelUp();
            this.setPaused(true);
            this.cb.onLevelUp(this.buildDraftOptions());
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
          for (let i = 0; i < count; i++) {
            const opts = this.buildDraftOptions();
            const pick = opts[0];
            this.applyDraftOptionSilent(pick);
            rewards.push(pick);
          }
          const bonusCoins = 220 + this.level * 25;
          this.coinsEarned += bonusCoins;
          this.cb.onChestJackpot(rewards, bonusCoins);
        }
        continue;
      }
      alive.push(p);
    }
    this.pickups = alive;
  }

  private applyDraftOptionSilent(opt: DraftOption): void {
    if (opt.kind === 'evo') {
      const st = this.weapons.get(opt.id as WeaponId);
      if (st) {
        st.evolved = true;
        st.lv = 6;
        if (!this.evosUnlocked.includes(opt.name)) this.evosUnlocked.push(opt.name);
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
    this.rings.push({ x, y, maxRadius, color, life, maxLife: life });
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
      kills: this.kills,
      coins: Math.round(this.coinsEarned * this.stats.goldMult),
      gems: this.gemsEarned,
      ultCharge: Math.round(this.ultCharge),
      dashReadyFrac: this.dashCd <= 0 ? 1 : Math.max(0, 1 - this.dashCd / 3.0),
      bossName: boss ? this.chapter.bossName : null,
      bossHpFrac: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
      weapons: Array.from(this.weapons.entries()).map(([id, s]) => ({ id, lv: s.lv, evolved: s.evolved })),
      passives: Array.from(this.passives.entries()).map(([id, lv]) => ({ id, lv })),
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this.chapter.bgTop);
    grad.addColorStop(1, this.chapter.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const camX = this.px - w / 2 + shakeX;
    const camY = this.py - h / 2 + shakeY;

    // Cyber grid floor
    const gridStep = 64;
    const startX = -((camX % gridStep) + gridStep) % gridStep;
    const startY = -((camY % gridStep) + gridStep) % gridStep;
    ctx.strokeStyle = this.chapter.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < w; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(-camX, -camY);

    // Gravity Zones
    for (const z of this.gravZones) {
      ctx.save();
      ctx.globalAlpha = 0.28 * Math.min(1, z.life);
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Pickups
    for (const p of this.pickups) {
      if (Math.abs(p.x - this.px) > w * 0.7 || Math.abs(p.y - this.py) > h * 0.7) continue;
      if (p.kind === 'xp_s' || p.kind === 'xp_m' || p.kind === 'xp_l') {
        ctx.fillStyle = p.kind === 'xp_l' ? '#fbbf24' : p.kind === 'xp_m' ? '#34d399' : '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 6);
        ctx.lineTo(p.x - 5, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'coin') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.kind === 'gem') {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'heal') {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(p.x - 7, p.y - 3, 14, 6);
        ctx.fillRect(p.x - 3, p.y - 7, 6, 14);
      } else if (p.kind === 'magnet') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M', p.x, p.y + 4);
      } else if (p.kind === 'bomb') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('B', p.x, p.y + 4);
      } else if (p.kind === 'chest') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(p.x - 12, p.y - 10, 24, 20);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 12, p.y - 10, 24, 20);
      }
    }

    // Ring waves
    for (const r of this.rings) {
      const prog = 1 - r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - prog;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxRadius * prog, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dash afterimages
    for (const a of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = a.life * 2.5;
      ctx.fillStyle = this.hero.accentColor;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) {
      if (Math.abs(e.x - this.px) > w * 0.72 || Math.abs(e.y - this.py) > h * 0.72) continue;
      ctx.save();
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.slowTimer > 0 ? '#60a5fa' : e.color;
      ctx.beginPath();
      if (e.kind === 'sentinel' || e.kind === 'boss') {
        ctx.rect(e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
      } else {
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      }
      ctx.fill();

      if (e.kind === 'goblin' || e.kind === 'elite' || e.kind === 'boss') {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = e.kind === 'boss' ? 3.5 : 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Orbitals render
    const orbState = this.weapons.get('orbital_saw');
    if (orbState) {
      const extraProj = Math.floor((this.passives.get('fusion_cell') || 0) / 2);
      const count = orbState.evolved ? 6 : 1 + orbState.lv + extraProj;
      const orbR = (orbState.evolved ? 108 : 78 + orbState.lv * 6) * this.getAreaMult();
      for (let i = 0; i < count; i++) {
        const ang = this.orbitalAngle + (i * Math.PI * 2) / count;
        const ox = this.px + Math.cos(ang) * orbR;
        const oy = this.py + Math.sin(ang) * orbR;
        ctx.fillStyle = orbState.evolved ? '#fbbf24' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(ox, oy, orbState.evolved ? 14 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Slashes
    for (const s of this.slashes) {
      ctx.save();
      ctx.globalAlpha = s.life / s.maxLife;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.78, s.angle - s.spread / 2, s.angle + s.spread / 2);
      ctx.stroke();
      ctx.restore();
    }

    // Lightning
    for (const l of this.lightnings) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, l.life * 4);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      l.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    // Player Hero
    ctx.save();
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }
    // Pickup Magnet subtle halo
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.px, this.py, this.getPickupRadius(), 0, Math.PI * 2);
    ctx.stroke();

    // Hero Body + Glow
    ctx.shadowColor = this.hero.accentColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.hero.accentColor;
    ctx.beginPath();
    ctx.arc(this.px, this.py, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Facing visor
    const vx = this.px + Math.cos(this.facingAngle) * 7;
    const vy = this.py + Math.sin(this.facingAngle) * 7;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(vx, vy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Small overhead HP bar
    const barW = 36;
    const hpFrac = Math.max(0, Math.min(1, this.hp / this.getEffectiveMaxHp()));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.px - barW / 2, this.py + 22, barW, 5);
    ctx.fillStyle = hpFrac > 0.35 ? '#10b981' : '#ef4444';
    ctx.fillRect(this.px - barW / 2, this.py + 22, barW * hpFrac, 5);
    ctx.restore();

    // Floating Damage Numbers
    for (const f of this.floats) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2.5);
      ctx.fillStyle = f.color;
      ctx.font = `900 ${Math.round(13 * f.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    ctx.restore();

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
}
