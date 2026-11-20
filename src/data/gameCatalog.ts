import {
  AscensionDef,
  AscensionTier,
  BossArchetype,
  ChapterDef,
  DailyModifierDef,
  DailyRunConfig,
  GearSlot,
  HeroDef,
  PassiveDef,
  Rarity,
  RelicDef,
  TalentNodeDef,
  WeaponDef,
  WeaponId,
  WeaponStyle,
} from '../types/game';

export const CRATE_COSTS = {
  basicCoins: 900,
  cyberGems: 140,
  cyberTenGems: 1200,
  mythicGems: 320,
  wheelFreeLimit: 3,
  wheelGoldCost: 1000,
  wheelGemCost: 25,
};

export const BOOSTER_COSTS = {
  extraWeapon: 250,
  overdriveAtk: 350,
  doubleLuck: 300,
};

export interface WeaponStyleDef {
  id: WeaponStyle;
  weaponId?: WeaponId;
  name: string;
  subtitle: string;
  color: string;
}

export const WEAPON_STYLES: WeaponStyleDef[] = [
  {
    id: 'signature',
    name: 'Signature',
    subtitle: 'Hero native weapon',
    color: '#fbbf24',
  },
  {
    id: 'sword',
    weaponId: 'plasma_blade',
    name: 'Blade',
    subtitle: 'Wide plasma arcs',
    color: '#38bdf8',
  },
  {
    id: 'staff',
    weaponId: 'arcane_staff',
    name: 'Staff',
    subtitle: 'Explosive orbs',
    color: '#c084fc',
  },
  {
    id: 'bow',
    weaponId: 'star_bow',
    name: 'Bow',
    subtitle: 'Piercing arrows',
    color: '#22c55e',
  },
];

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_META: Record<
  Rarity,
  { label: string; color: string; bg: string; mult: number; maxLv: number }
> = {
  common: { label: 'Common', color: '#94a3b8', bg: 'rgba(148,163,184,0.16)', mult: 1.0, maxLv: 15 },
  uncommon: { label: 'Uncommon', color: '#22c55e', bg: 'rgba(34,197,94,0.18)', mult: 1.45, maxLv: 25 },
  rare: { label: 'Rare', color: '#3b82f6', bg: 'rgba(59,130,246,0.2)', mult: 2.1, maxLv: 40 },
  epic: { label: 'Epic', color: '#a855f7', bg: 'rgba(168,85,247,0.22)', mult: 3.2, maxLv: 60 },
  legendary: { label: 'Legendary', color: '#f59e0b', bg: 'rgba(245,158,11,0.24)', mult: 5.0, maxLv: 85 },
  mythic: { label: 'Mythic', color: '#ef4444', bg: 'rgba(239,68,68,0.26)', mult: 8.2, maxLv: 120 },
};

export const HEROES: HeroDef[] = [
  {
    id: 'kael',
    name: 'Kael-7',
    title: 'Cyber Ronin',
    description: 'Agile vanguard with lethal critical strikes and blazing plasma katana sweeps.',
    startingWeapon: 'plasma_blade',
    ultName: 'Omnislash Nova',
    ultDesc: 'Unleashes a massive 360° hyper-plasma shockwave around your hero.',
    accentColor: '#38bdf8',
    secondaryColor: '#0284c7',
    baseHp: 225,
    baseAtk: 27,
    baseSpeed: 198,
    unlockCostGems: 0,
    perkLabel: '+12% Crit Chance',
  },
  {
    id: 'nova',
    name: 'Nova',
    title: 'Storm Weaver',
    description: 'Commands arcane starfire storms and accelerates all weapon cooldowns.',
    startingWeapon: 'arcane_staff',
    ultName: 'Ion Tempest',
    ultDesc: 'Calls down 18 jagged lightning strikes across nearby enemies.',
    accentColor: '#a855f7',
    secondaryColor: '#6366f1',
    baseHp: 200,
    baseAtk: 31,
    baseSpeed: 205,
    unlockCostGems: 200,
    perkLabel: '-15% Weapon Cooldown',
  },
  {
    id: 'titan',
    name: 'Titan-X',
    title: 'Siege Juggernaut',
    description: 'Heavily armored dreadnought built for huge HP, armor, and close-quarters saws.',
    startingWeapon: 'orbital_saw',
    ultName: 'Orbital Fortress',
    ultDesc: 'Restores 40% HP and blasts back enemies with a pulsing barrier.',
    accentColor: '#f59e0b',
    secondaryColor: '#b45309',
    baseHp: 345,
    baseAtk: 29,
    baseSpeed: 180,
    unlockCostGems: 350,
    perkLabel: '+35% Max HP & +5 Armor',
  },
  {
    id: 'aegis',
    name: 'Aegis-9',
    title: 'Field Engineer',
    description: 'Tactical combat artificer deploying autonomous orbital laser turrets and barriers.',
    startingWeapon: 'orbital_turret',
    ultName: 'Aegis Overdrive',
    ultDesc: 'Deploys 3 supercharged defense turrets and grants a 90-HP energy barrier.',
    accentColor: '#14b8a6',
    secondaryColor: '#0f766e',
    baseHp: 265,
    baseAtk: 30,
    baseSpeed: 194,
    unlockCostGems: 450,
    perkLabel: '+15% Area & +3 Armor',
  },
  {
    id: 'pyro',
    name: 'Pyro-Valk',
    title: 'Solar Valkyrie',
    description: 'Jet-winged pyromancer piercing hordes with blazing solar lances and scorch trails.',
    startingWeapon: 'solar_lance',
    ultName: 'Solar Cataclysm',
    ultDesc: 'Rains 8 blazing solar meteors that scorch the ground and incinerate swarms.',
    accentColor: '#f97316',
    secondaryColor: '#c2410c',
    baseHp: 235,
    baseAtk: 34,
    baseSpeed: 214,
    unlockCostGems: 550,
    perkLabel: '+12% Speed & Burn Aura',
  },
  {
    id: 'vespera',
    name: 'Vespera',
    title: 'Void Reaper',
    description: 'Shadow marksman with extreme precision, rapid speed, and passive life-steal.',
    startingWeapon: 'star_bow',
    ultName: 'Eclipse Singularity',
    ultDesc: 'Pulls enemies into a void vortex, shreds them, and drains their vitality.',
    accentColor: '#f43f5e',
    secondaryColor: '#9f1239',
    baseHp: 245,
    baseAtk: 38,
    baseSpeed: 216,
    unlockCostGems: 700,
    perkLabel: '+20% ATK & Life-Steal (+3 HP / 10 kills)',
  },
];

export const WEAPONS: WeaponDef[] = [
  {
    id: 'plasma_blade',
    name: 'Plasma Blade',
    shortDesc: 'Razor-sharp energy slashes that knock enemies back.',
    evoName: 'Hyper-Nova Blade',
    evoPassive: 'chrono_core',
    evoDesc: '360° crimson plasma slashes with massive reach on every swing!',
    color: '#38bdf8',
    maxLevel: 5,
    baseDamage: 36,
    baseCooldownMs: 850,
  },
  {
    id: 'arcane_staff',
    name: 'Starfire Staff',
    shortDesc: 'Fires arcane energy orbs that detonate on impact.',
    evoName: 'Aether Nova Staff',
    evoPassive: 'overclock_chip',
    evoDesc: 'Huge violet energy blasts that home in and trigger chain shockwaves!',
    color: '#c084fc',
    maxLevel: 5,
    baseDamage: 33,
    baseCooldownMs: 880,
    isProjectile: true,
  },
  {
    id: 'star_bow',
    name: 'Energy Bow',
    shortDesc: 'Unleashes rapid piercing light arrows through enemy packs.',
    evoName: 'Stormrain Bow',
    evoPassive: 'eagle_optics',
    evoDesc: 'Fires 5 golden storm arrows straight through entire swarms!',
    color: '#22c55e',
    maxLevel: 5,
    baseDamage: 30,
    baseCooldownMs: 680,
    isProjectile: true,
  },
  {
    id: 'orbital_turret',
    name: 'Orbital Turret',
    shortDesc: 'Autonomous hover-turrets that lock onto foes with rapid laser bolts.',
    evoName: 'Bastion Matrix',
    evoPassive: 'fusion_cell',
    evoDesc: '4 twin-linked fortress turrets firing piercing plasma beams non-stop!',
    color: '#14b8a6',
    maxLevel: 5,
    baseDamage: 27,
    baseCooldownMs: 620,
    isProjectile: true,
  },
  {
    id: 'solar_lance',
    name: 'Solar Lance',
    shortDesc: 'Thrusts a piercing solar spear that ignites scorched ground trails.',
    evoName: 'Supernova Halberd',
    evoPassive: 'dark_matter',
    evoDesc: 'Twin blazing solar lances erupting in fiery magma shockwaves!',
    color: '#f97316',
    maxLevel: 5,
    baseDamage: 38,
    baseCooldownMs: 900,
    isProjectile: true,
  },
  {
    id: 'pulse_rifle',
    name: 'Ion Repeater',
    shortDesc: 'Locks onto the nearest target with rapid-fire bolts.',
    evoName: 'Railcannon Overdrive',
    evoPassive: 'eagle_optics',
    evoDesc: 'Piercing railgun beams that detonate on impact!',
    color: '#22d3ee',
    maxLevel: 5,
    baseDamage: 24,
    baseCooldownMs: 520,
    isProjectile: true,
  },
  {
    id: 'orbital_saw',
    name: 'Aether Orbitals',
    shortDesc: 'Spinning energy blades orbit you and shred nearby foes.',
    evoName: 'Solar Vortex',
    evoPassive: 'magnet_halo',
    evoDesc: '6 blazing plasma saws spinning at high speed non-stop!',
    color: '#f59e0b',
    maxLevel: 5,
    baseDamage: 22,
    baseCooldownMs: 120,
  },
  {
    id: 'tesla_arc',
    name: 'Tempest Coil',
    shortDesc: 'Jagged chain lightning that arcs across groups of enemies.',
    evoName: 'Thunderstorm Conduit',
    evoPassive: 'overclock_chip',
    evoDesc: 'High-voltage forked lightning arcs with slowing shockwaves!',
    color: '#a855f7',
    maxLevel: 5,
    baseDamage: 31,
    baseCooldownMs: 1020,
  },
  {
    id: 'frost_nova',
    name: 'Cryo Pulse',
    shortDesc: 'Crystalline ice ring that chills and damages surrounding foes.',
    evoName: 'Absolute Zero',
    evoPassive: 'cryo_reactor',
    evoDesc: 'Massive frost vortex leaving frozen rime that shatters swarms!',
    color: '#60a5fa',
    maxLevel: 5,
    baseDamage: 27,
    baseCooldownMs: 1800,
  },
  {
    id: 'inferno_drone',
    name: 'Phoenix Drones',
    shortDesc: 'Autonomous drones that fire homing micro-missiles.',
    evoName: 'Valkyrie Swarm',
    evoPassive: 'fusion_cell',
    evoDesc: '4 elite drones firing continuous explosive missile barrages!',
    color: '#fb7185',
    maxLevel: 5,
    baseDamage: 28,
    baseCooldownMs: 940,
    isProjectile: true,
  },
  {
    id: 'gravity_well',
    name: 'Void Singularity',
    shortDesc: 'Spawns black holes that pull enemies inward and crush them.',
    evoName: 'Event Horizon',
    evoPassive: 'dark_matter',
    evoDesc: 'Massive violet dimensional rifts with crushing pulse damage!',
    color: '#c084fc',
    maxLevel: 5,
    baseDamage: 19,
    baseCooldownMs: 2350,
  },
  {
    id: 'vamp_scythe',
    name: 'Soul Scythe',
    shortDesc: 'Boomerang scythe that slices swarms and restores HP.',
    evoName: "Reaper's Eclipse",
    evoPassive: 'blood_ruby',
    evoDesc: 'Giant returning scythes with relentless life-steal!',
    color: '#ef4444',
    maxLevel: 5,
    baseDamage: 36,
    baseCooldownMs: 1220,
    isProjectile: true,
  },
];

export const PASSIVES: PassiveDef[] = [
  {
    id: 'chrono_core',
    name: 'Chrono Core',
    shortDesc: 'Reduces all weapon cooldowns.',
    perLevelLabel: '-8% Cooldown / lv',
    color: '#38bdf8',
    maxLevel: 5,
  },
  {
    id: 'eagle_optics',
    name: 'Eagle Optics',
    shortDesc: 'Increases Crit Chance and Crit Damage.',
    perLevelLabel: '+6% Crit Chance / lv',
    color: '#22d3ee',
    maxLevel: 5,
  },
  {
    id: 'magnet_halo',
    name: 'Magnet Halo',
    shortDesc: 'Pulls XP crystals & Gold from farther away.',
    perLevelLabel: '+35% Magnet Range / lv',
    color: '#f59e0b',
    maxLevel: 5,
  },
  {
    id: 'overclock_chip',
    name: 'Overclock Chip',
    shortDesc: 'Boosts all attack damage.',
    perLevelLabel: '+13% Damage / lv',
    color: '#a855f7',
    maxLevel: 5,
  },
  {
    id: 'cryo_reactor',
    name: 'Cryo Reactor',
    shortDesc: 'Increases Max HP & durability.',
    perLevelLabel: '+18% Max HP / lv',
    color: '#60a5fa',
    maxLevel: 5,
  },
  {
    id: 'fusion_cell',
    name: 'Fusion Cell',
    shortDesc: 'Adds projectiles & area size to weapons.',
    perLevelLabel: '+15% Area & +Projectile',
    color: '#fb7185',
    maxLevel: 5,
  },
  {
    id: 'dark_matter',
    name: 'Dark Matter Thruster',
    shortDesc: 'Boosts movement speed & Dash recharge.',
    perLevelLabel: '+9% Move Speed / lv',
    color: '#c084fc',
    maxLevel: 5,
  },
  {
    id: 'blood_ruby',
    name: 'Blood Ruby',
    shortDesc: 'Passive HP regeneration & bonus Gold/XP.',
    perLevelLabel: '+1.5 HP/s & +10% Greed / lv',
    color: '#ef4444',
    maxLevel: 5,
  },
];

export const RELICS: RelicDef[] = [
  {
    id: 'plasma_mines',
    name: 'Plasma Dash Mines',
    shortDesc: 'Dashing deploys 3 volatile plasma mines that detonate on contact.',
    color: '#38bdf8',
  },
  {
    id: 'chain_crit',
    name: 'Chain-Crit Arc',
    shortDesc: 'Critical hits arc high-voltage lightning to 2 nearby enemies (55% DMG).',
    color: '#a855f7',
  },
  {
    id: 'nova_burst',
    name: 'Nova Burst',
    shortDesc: 'Every 10th weapon activation unleashes a 360° explosive shockwave.',
    color: '#fbbf24',
  },
  {
    id: 'vampiric_core',
    name: 'Vampiric Core',
    shortDesc: 'Restores +2 HP every 8 kills and amplifies healing by +20%.',
    color: '#ef4444',
  },
  {
    id: 'overclock_shield',
    name: 'Overclocked Shield',
    shortDesc: 'Generates a recharging 50-HP energy barrier every 12 seconds.',
    color: '#22d3ee',
  },
  {
    id: 'mag_singularity',
    name: 'Magnetic Singularity',
    shortDesc: 'Sweeps nearby XP & Gold toward you every 9s and +25% pickup radius.',
    color: '#f59e0b',
  },
  {
    id: 'frost_retaliation',
    name: 'Frost Nova on Hit',
    shortDesc: 'Taking damage releases a freezing cryo wave that chills & pushes foes.',
    color: '#60a5fa',
  },
  {
    id: 'executioner_mark',
    name: "Executioner's Mark",
    shortDesc: '+35% damage vs enemies under 35% HP and +22% damage vs Bosses.',
    color: '#f43f5e',
  },
  {
    id: 'solar_afterburn',
    name: 'Solar Afterburn',
    shortDesc: 'Weapon hits ignite foes, dealing bonus solar burn damage over 2s.',
    color: '#f97316',
  },
  {
    id: 'quantum_accel',
    name: 'Quantum Accelerator',
    shortDesc: '-10% weapon cooldowns, +10% move speed, and +25% Ultimate charge rate.',
    color: '#10b981',
  },
];

export const ASCENSIONS: AscensionDef[] = [
  {
    tier: 1,
    roman: 'I',
    name: 'Standard',
    subtitle: 'Baseline sector threat',
    enemyHpMult: 1.0,
    enemyDmgMult: 1.0,
    spawnMult: 1.0,
    rewardMult: 1.0,
    color: '#38bdf8',
  },
  {
    tier: 2,
    roman: 'II',
    name: 'Veteran',
    subtitle: '1.45x HP • 1.25x DMG • +35% Loot',
    enemyHpMult: 1.45,
    enemyDmgMult: 1.25,
    spawnMult: 1.12,
    rewardMult: 1.35,
    color: '#22c55e',
  },
  {
    tier: 3,
    roman: 'III',
    name: 'Nightmare',
    subtitle: '2.1x HP • 1.6x DMG • +75% Loot',
    enemyHpMult: 2.1,
    enemyDmgMult: 1.6,
    spawnMult: 1.24,
    rewardMult: 1.75,
    color: '#f59e0b',
  },
  {
    tier: 4,
    roman: 'IV',
    name: 'Apex',
    subtitle: '3.0x HP • 2.0x DMG • +125% Loot',
    enemyHpMult: 3.0,
    enemyDmgMult: 2.0,
    spawnMult: 1.36,
    rewardMult: 2.25,
    color: '#a855f7',
  },
  {
    tier: 5,
    roman: 'V',
    name: 'Cataclysm',
    subtitle: '4.2x HP • 2.5x DMG • +200% Loot',
    enemyHpMult: 4.2,
    enemyDmgMult: 2.5,
    spawnMult: 1.5,
    rewardMult: 3.0,
    color: '#ef4444',
  },
];

export const DAILY_MODIFIERS: DailyModifierDef[] = [
  { id: 'hyper_haste', name: 'Hyper Haste', desc: '-25% all weapon cooldowns', color: '#38bdf8' },
  { id: 'glass_cannon', name: 'Glass Cannon', desc: '+40% Attack Damage, -20% Max HP', color: '#f43f5e' },
  { id: 'swarm_frenzy', name: 'Swarm Frenzy', desc: '+35% enemy density & +40% XP gain', color: '#a855f7' },
  { id: 'crit_storm', name: 'Crit Storm', desc: '+22% Critical Hit Chance', color: '#fbbf24' },
  { id: 'titan_bosses', name: 'Titan Protocol', desc: '+30% Boss HP, 2x Star Shard drops', color: '#f97316' },
  { id: 'low_gravity', name: 'Zero-G Thrusters', desc: '+20% Move Speed & faster Dash', color: '#10b981' },
];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailyRunConfig(dateKey = getTodayDateKey()): DailyRunConfig {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = hash >>> 0;
  const rng = mulberry32(seed);
  const themeChapterId = 1 + Math.floor(rng() * 6);
  const pool = [...DAILY_MODIFIERS];
  const m1Idx = Math.floor(rng() * pool.length);
  const m1 = pool.splice(m1Idx, 1)[0];
  const m2Idx = Math.floor(rng() * pool.length);
  const m2 = pool[m2Idx];
  return {
    dateKey,
    seed,
    themeChapterId,
    modifiers: [m1, m2],
  };
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    name: '01. Neon Outskirts',
    subtitle: 'Outer sectors teeming with scout drones & Loot Goblins',
    mode: 'chapter',
    durationSec: 180,
    recommendedPower: 100,
    bgTop: '#070d20',
    bgBottom: '#0d1b36',
    gridColor: 'rgba(56, 189, 248, 0.08)',
    accentColor: '#38bdf8',
    enemyHpMult: 1.0,
    enemyDmgMult: 1.0,
    spawnRateMult: 1.0,
    rewardCoins: 2000,
    rewardGems: 65,
    bossName: 'Dread-Mech Mk.I',
    bossArchetype: 1,
  },
  {
    id: 2,
    name: '02. Rust Canyon',
    subtitle: 'Desert refinery guarded by armored Sentinels',
    mode: 'chapter',
    durationSec: 210,
    recommendedPower: 260,
    bgTop: '#1c1008',
    bgBottom: '#2d180a',
    gridColor: 'rgba(245, 158, 11, 0.09)',
    accentColor: '#f59e0b',
    enemyHpMult: 1.7,
    enemyDmgMult: 1.32,
    spawnRateMult: 1.18,
    rewardCoins: 3600,
    rewardGems: 90,
    bossName: 'Scorpio Colossus',
    bossArchetype: 2,
  },
  {
    id: 3,
    name: '03. Cryo Citadel',
    subtitle: 'Frozen server fortress patrolled by swift Stalkers',
    mode: 'chapter',
    durationSec: 240,
    recommendedPower: 480,
    bgTop: '#061529',
    bgBottom: '#0b2545',
    gridColor: 'rgba(96, 165, 250, 0.1)',
    accentColor: '#60a5fa',
    enemyHpMult: 2.7,
    enemyDmgMult: 1.7,
    spawnRateMult: 1.32,
    rewardCoins: 5600,
    rewardGems: 115,
    bossName: 'Glacier Sovereign',
    bossArchetype: 3,
  },
  {
    id: 4,
    name: '04. Magma Core',
    subtitle: 'Volcanic reactor crawling with plasma spitters',
    mode: 'chapter',
    durationSec: 240,
    recommendedPower: 780,
    bgTop: '#24070a',
    bgBottom: '#3c0b12',
    gridColor: 'rgba(239, 68, 68, 0.1)',
    accentColor: '#ef4444',
    enemyHpMult: 4.1,
    enemyDmgMult: 2.2,
    spawnRateMult: 1.45,
    rewardCoins: 8600,
    rewardGems: 145,
    bossName: 'Inferno Behemoth',
    bossArchetype: 4,
  },
  {
    id: 5,
    name: '05. Void Rift',
    subtitle: 'Violet hyperspace filled with splitting anomalies',
    mode: 'chapter',
    durationSec: 270,
    recommendedPower: 1200,
    bgTop: '#140826',
    bgBottom: '#230d42',
    gridColor: 'rgba(168, 85, 247, 0.11)',
    accentColor: '#a855f7',
    enemyHpMult: 6.2,
    enemyDmgMult: 2.8,
    spawnRateMult: 1.58,
    rewardCoins: 13500,
    rewardGems: 185,
    bossName: 'Archon Nullifier',
    bossArchetype: 5,
  },
  {
    id: 6,
    name: '06. Cyberopolis',
    subtitle: 'Megacity under siege by relentless elite drones',
    mode: 'chapter',
    durationSec: 300,
    recommendedPower: 1800,
    bgTop: '#041b1b',
    bgBottom: '#082f33',
    gridColor: 'rgba(20, 184, 166, 0.1)',
    accentColor: '#14b8a6',
    enemyHpMult: 9.0,
    enemyDmgMult: 3.45,
    spawnRateMult: 1.72,
    rewardCoins: 19500,
    rewardGems: 240,
    bossName: 'Nexus Overlord',
    bossArchetype: 6,
  },
  {
    id: 99,
    name: 'Endless Void',
    subtitle: 'Infinite waves — compete on the global Endless leaderboard!',
    mode: 'endless',
    durationSec: 99999,
    recommendedPower: 250,
    bgTop: '#080518',
    bgBottom: '#18082b',
    gridColor: 'rgba(236, 72, 153, 0.11)',
    accentColor: '#ec4899',
    enemyHpMult: 1.25,
    enemyDmgMult: 1.15,
    spawnRateMult: 1.25,
    rewardCoins: 5000,
    rewardGems: 100,
    bossName: 'Omega Void Leviathan',
    bossArchetype: 5,
  },
  {
    id: 88,
    name: 'Boss Rush: Titan Gauntlet',
    subtitle: 'All 6 bespoke Bosses back-to-back — huge Shard & Blueprint loot!',
    mode: 'boss_rush',
    durationSec: 420,
    recommendedPower: 380,
    bgTop: '#1f0710',
    bgBottom: '#330a1a',
    gridColor: 'rgba(244, 63, 94, 0.12)',
    accentColor: '#f43f5e',
    enemyHpMult: 1.35,
    enemyDmgMult: 1.22,
    spawnRateMult: 0.52,
    rewardCoins: 7500,
    rewardGems: 170,
    bossName: 'Titan Gauntlet (6 Bosses)',
    bossArchetype: 6,
  },
];

export function buildDailyRunChapter(cfg: DailyRunConfig): ChapterDef {
  const base = CHAPTERS.find((c) => c.id === cfg.themeChapterId) || CHAPTERS[0];
  return {
    id: 77,
    name: `Daily Starforge (${cfg.dateKey})`,
    subtitle: cfg.modifiers.map((m) => m.name).join(' + '),
    mode: 'daily',
    durationSec: 210,
    recommendedPower: 320,
    bgTop: base.bgTop,
    bgBottom: base.bgBottom,
    gridColor: base.gridColor,
    accentColor: '#fbbf24',
    enemyHpMult: 1.8,
    enemyDmgMult: 1.35,
    spawnRateMult: 1.25,
    rewardCoins: 6000,
    rewardGems: 150,
    bossName: base.bossName,
    bossArchetype: base.bossArchetype,
  };
}

export const TALENTS: TalentNodeDef[] = [
  {
    id: 'might',
    name: 'Hyper Might',
    desc: '+6 Attack Damage per level',
    iconKey: 'sword',
    maxLevel: 30,
    baseCostCoins: 240,
    costStepCoins: 180,
    statKey: 'atkFlat',
    perLevelValue: 6,
  },
  {
    id: 'vitality',
    name: 'Nano Armor HP',
    desc: '+35 Max HP per level',
    iconKey: 'heart',
    maxLevel: 30,
    baseCostCoins: 210,
    costStepCoins: 165,
    statKey: 'hpFlat',
    perLevelValue: 35,
  },
  {
    id: 'armor',
    name: 'Titanium Shield',
    desc: '-2 incoming damage per level',
    iconKey: 'shield',
    maxLevel: 20,
    baseCostCoins: 380,
    costStepCoins: 280,
    statKey: 'armor',
    perLevelValue: 2,
  },
  {
    id: 'greed',
    name: 'Cyber Greed',
    desc: '+8% bonus Gold from runs & patrol',
    iconKey: 'coin',
    maxLevel: 20,
    baseCostCoins: 320,
    costStepCoins: 240,
    statKey: 'greedPct',
    perLevelValue: 8,
  },
  {
    id: 'magnet',
    name: 'Quantum Magnet',
    desc: '+10% XP & Gold pickup radius',
    iconKey: 'magnet',
    maxLevel: 15,
    baseCostCoins: 280,
    costStepCoins: 220,
    statKey: 'magnetPct',
    perLevelValue: 10,
  },
  {
    id: 'agility',
    name: 'Jet Thrusters',
    desc: '+3% move speed per level',
    iconKey: 'bolt',
    maxLevel: 15,
    baseCostCoins: 300,
    costStepCoins: 230,
    statKey: 'speedPct',
    perLevelValue: 3,
  },
  {
    id: 'crit',
    name: 'Precision Optics',
    desc: '+2% Crit Chance per level',
    iconKey: 'target',
    maxLevel: 15,
    baseCostCoins: 420,
    costStepCoins: 320,
    statKey: 'critPct',
    perLevelValue: 2,
  },
  {
    id: 'haste',
    name: 'Turbo Processor',
    desc: '-2% weapon cooldown per level',
    iconKey: 'timer',
    maxLevel: 12,
    baseCostCoins: 550,
    costStepCoins: 440,
    statKey: 'hastePct',
    perLevelValue: 2,
  },
  {
    id: 'xp',
    name: 'Neural Boost',
    desc: '+7% XP gain in battle',
    iconKey: 'shard',
    maxLevel: 15,
    baseCostCoins: 350,
    costStepCoins: 260,
    statKey: 'xpPct',
    perLevelValue: 7,
  },
  {
    id: 'rerolls',
    name: 'Quantum Reroll',
    desc: '+1 Level-Up Draft Reroll charge per run',
    iconKey: 'reroll',
    maxLevel: 3,
    baseCostCoins: 1400,
    costStepCoins: 1600,
    statKey: 'rerolls',
    perLevelValue: 1,
  },
  {
    id: 'banishes',
    name: 'Signal Jammer',
    desc: '+1 Draft Banish charge per run (removes unwanted picks)',
    iconKey: 'banish',
    maxLevel: 3,
    baseCostCoins: 1600,
    costStepCoins: 1800,
    statKey: 'banishes',
    perLevelValue: 1,
  },
  {
    id: 'revival',
    name: 'Phoenix Core',
    desc: '+1 free auto-revive per run (max 2)',
    iconKey: 'flame',
    maxLevel: 2,
    baseCostCoins: 4500,
    costStepCoins: 6500,
    statKey: 'revives',
    perLevelValue: 1,
  },
];

export interface GearTemplate {
  templateId: string;
  slot: GearSlot;
  name: string;
  baseAtk: number;
  baseHp: number;
  perkText: string;
}

export const GEAR_TEMPLATES: GearTemplate[] = [
  { templateId: 'wp_katana', slot: 'weapon', name: 'Plasma Katana', baseAtk: 24, baseHp: 0, perkText: '+15% Crit Damage' },
  { templateId: 'wp_voidcannon', slot: 'weapon', name: 'Void Blaster', baseAtk: 28, baseHp: 0, perkText: '+8% Projectile Power' },
  { templateId: 'ar_aegis', slot: 'armor', name: 'Aegis Exo-Suit', baseAtk: 0, baseHp: 140, perkText: '-4 Damage Taken' },
  { templateId: 'ar_stealth', slot: 'armor', name: 'Phantom Rig', baseAtk: 6, baseHp: 115, perkText: '+8% Dodge & +5% Speed' },
  { templateId: 'hm_visor', slot: 'helmet', name: 'Cyber Visor', baseAtk: 10, baseHp: 65, perkText: '+10% XP Bonus' },
  { templateId: 'hm_titan', slot: 'helmet', name: 'Titan Helm', baseAtk: 6, baseHp: 95, perkText: '+12% Max HP' },
  { templateId: 'bt_thruster', slot: 'boots', name: 'Nova Boots', baseAtk: 5, baseHp: 55, perkText: '+12% Move Speed' },
  { templateId: 'bt_mag', slot: 'boots', name: 'Magnet Greaves', baseAtk: 4, baseHp: 60, perkText: '+20% Pickup Radius' },
  { templateId: 'rg_crit', slot: 'ring', name: 'Starfire Ring', baseAtk: 16, baseHp: 20, perkText: '+6% Crit Chance' },
  { templateId: 'rg_greed', slot: 'ring', name: 'Midas Coil', baseAtk: 12, baseHp: 25, perkText: '+15% Gold Drops' },
  { templateId: 'cr_quantum', slot: 'core', name: 'Quantum Core', baseAtk: 14, baseHp: 75, perkText: '-6% Weapon Cooldown' },
  { templateId: 'cr_phoenix', slot: 'core', name: 'Phoenix Heart', baseAtk: 10, baseHp: 105, perkText: '+2.5 HP/sec Regen' },
];

export const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  helmet: 'Helmet',
  boots: 'Boots',
  ring: 'Ring',
  core: 'Core',
};

export interface MasteryTierDef {
  tier: number;
  xpRequired: number;
  label: string;
  reward: {
    coins?: number;
    gems?: number;
    blueprints?: number;
    basicKeys?: number;
    cyberKeys?: number;
    reviveTokens?: number;
  };
  isMilestone?: boolean;
}

export const MASTERY_TIERS: MasteryTierDef[] = Array.from({ length: 30 }, (_, idx) => {
  const tier = idx + 1;
  const xpRequired = tier * 100;
  if (tier === 30) {
    return {
      tier,
      xpRequired,
      label: '450 Shards + 3x Cyber Key',
      reward: { gems: 450, cyberKeys: 3 },
      isMilestone: true,
    };
  }
  if (tier % 10 === 0) {
    return {
      tier,
      xpRequired,
      label: `2x Cyber Key + ${120 + tier * 3} Shards`,
      reward: { cyberKeys: 2, gems: 120 + tier * 3 },
      isMilestone: true,
    };
  }
  if (tier % 5 === 0) {
    return {
      tier,
      xpRequired,
      label: `${110 + tier * 3} Shards + 1x Cyber Key`,
      reward: { gems: 110 + tier * 3, cyberKeys: 1 },
      isMilestone: true,
    };
  }
  if (tier % 3 === 0) {
    return {
      tier,
      xpRequired,
      label: `1x Cyber Key + ${14 + tier} Blueprints`,
      reward: { cyberKeys: 1, blueprints: 14 + tier },
    };
  }
  if (tier % 2 === 0) {
    return {
      tier,
      xpRequired,
      label: `${16 + tier} Blueprints + 1x Revive`,
      reward: { blueprints: 16 + tier, reviveTokens: 1 },
    };
  }
  return {
    tier,
    xpRequired,
    label: `${1400 + tier * 220} Gold + ${30 + tier} Shards`,
    reward: { coins: 1400 + tier * 220, gems: 30 + tier },
  };
});

export interface DailyQuestDef {
  id: string;
  title: string;
  target: number;
  field: 'killsToday' | 'runsToday' | 'bossesToday' | 'upgradesToday' | 'objectivesToday';
  gems: number;
  coins: number;
  passXp: number;
}

export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: 'dq_kills_200', title: 'Defeat 200 enemies', target: 200, field: 'killsToday', gems: 35, coins: 1400, passXp: 85 },
  { id: 'dq_runs_2', title: 'Complete 2 battles', target: 2, field: 'runsToday', gems: 30, coins: 1200, passXp: 75 },
  { id: 'dq_boss_1', title: 'Defeat 1 Boss or Elite', target: 1, field: 'bossesToday', gems: 45, coins: 2000, passXp: 110 },
  { id: 'dq_upg_2', title: 'Upgrade gear or talent 2x', target: 2, field: 'upgradesToday', gems: 30, coins: 1100, passXp: 75 },
  { id: 'dq_obj_1', title: 'Claim 1 Shrine or Elite Chest', target: 1, field: 'objectivesToday', gems: 40, coins: 1600, passXp: 95 },
];

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  gems: number;
  cyberKeys?: number;
  check: (s: {
    totalKills: number;
    totalRuns: number;
    totalBossesKilled: number;
    clearedCount: number;
    bestEndlessSec: number;
    totalShrinesClaimed: number;
    highestAscensionCleared: AscensionTier;
    discoveredRelicsCount: number;
  }) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_kill_500', title: 'Swarm Breaker', desc: 'Defeat 500 enemies in total', gems: 60, check: (s) => s.totalKills >= 500 },
  { id: 'ach_kill_2500', title: 'Neon Exterminator', desc: 'Defeat 2,500 enemies in total', gems: 150, cyberKeys: 1, check: (s) => s.totalKills >= 2500 },
  { id: 'ach_kill_10000', title: 'Galactic Reaper', desc: 'Defeat 10,000 enemies in total', gems: 320, cyberKeys: 2, check: (s) => s.totalKills >= 10000 },
  { id: 'ach_ch1', title: 'First Victory', desc: 'Clear Chapter 1 (Neon Outskirts)', gems: 75, check: (s) => s.clearedCount >= 1 },
  { id: 'ach_ch3', title: 'Cryo Conqueror', desc: 'Clear 3 Story Chapters', gems: 180, cyberKeys: 1, check: (s) => s.clearedCount >= 3 },
  { id: 'ach_ch6', title: 'Starforge Master', desc: 'Clear all 6 Story Chapters', gems: 500, cyberKeys: 3, check: (s) => s.clearedCount >= 6 },
  { id: 'ach_boss_10', title: 'Boss Hunter', desc: 'Defeat 10 Bosses or Elites', gems: 120, check: (s) => s.totalBossesKilled >= 10 },
  { id: 'ach_shrine_5', title: 'Relic Seeker', desc: 'Claim 5 Starforge Shrines', gems: 110, cyberKeys: 1, check: (s) => s.totalShrinesClaimed >= 5 },
  { id: 'ach_relics_6', title: 'Vault Curator', desc: 'Discover 6 distinct Relics', gems: 160, cyberKeys: 1, check: (s) => s.discoveredRelicsCount >= 6 },
  { id: 'ach_asc_3', title: 'Nightmare Walker', desc: 'Win a run on Ascension III+', gems: 220, cyberKeys: 2, check: (s) => s.highestAscensionCleared >= 3 },
  { id: 'ach_asc_5', title: 'Cataclysm Legend', desc: 'Win a run on Ascension V', gems: 450, cyberKeys: 3, check: (s) => s.highestAscensionCleared >= 5 },
  { id: 'ach_endless_180', title: 'Void Survivor', desc: 'Survive 3 minutes in Endless Void', gems: 160, check: (s) => s.bestEndlessSec >= 180 },
];

export const LOGIN_STREAK_REWARDS = [
  { day: 1, label: '1,500 Gold', coins: 1500, gems: 0, cyberKeys: 0 },
  { day: 2, label: '60 Shards', coins: 0, gems: 60, cyberKeys: 0 },
  { day: 3, label: '3,000 Gold', coins: 3000, gems: 0, cyberKeys: 0 },
  { day: 4, label: '1x Cyber Key', coins: 0, gems: 0, cyberKeys: 1 },
  { day: 5, label: '110 Shards', coins: 0, gems: 110, cyberKeys: 0 },
  { day: 6, label: '6,000 Gold', coins: 6000, gems: 0, cyberKeys: 0 },
  { day: 7, label: '250 Shards + 2x Key', coins: 0, gems: 250, cyberKeys: 2 },
];

export interface WheelSliceDef {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  weight: number;
  coins?: number;
  gems?: number;
  blueprints?: number;
  cyberKeys?: number;
  reviveTokens?: number;
  isJackpot?: boolean;
}

export const WHEEL_REWARDS: WheelSliceDef[] = [
  { id: 'w_gold_s', label: '1,800 Gold', shortLabel: '1.8k Gold', color: '#334155', weight: 22, coins: 1800 },
  { id: 'w_gems_45', label: '45 Shards', shortLabel: '45 Shards', color: '#0284c7', weight: 20, gems: 45 },
  { id: 'w_bp_18', label: '18 Blueprints', shortLabel: '18 BP', color: '#0d9488', weight: 18, blueprints: 18 },
  { id: 'w_gold_l', label: '5,000 Gold', shortLabel: '5k Gold', color: '#b45309', weight: 14, coins: 5000 },
  { id: 'w_revive', label: '2x Revive Token', shortLabel: '2x Revive', color: '#be123c', weight: 10, reviveTokens: 2 },
  { id: 'w_key', label: '1x Cyber Key', shortLabel: 'Cyber Key', color: '#7c3aed', weight: 9, cyberKeys: 1 },
  { id: 'w_gems_140', label: '140 Shards', shortLabel: '140 Shards', color: '#2563eb', weight: 5, gems: 140 },
  { id: 'w_jackpot', label: '350 SHARDS JACKPOT!', shortLabel: '350 JACKPOT', color: '#f59e0b', weight: 2, gems: 350, isJackpot: true },
];

export interface BossBestiaryDef {
  archetype: BossArchetype;
  name: string;
  chapterName: string;
  color: string;
  signatureAttack: string;
  phase2Text: string;
}

export const BOSS_BESTIARY: BossBestiaryDef[] = [
  {
    archetype: 1,
    name: 'Dread-Mech Mk.I',
    chapterName: 'Ch.1 Neon Outskirts',
    color: '#38bdf8',
    signatureAttack: 'Telegraphed Twin Sweeping Laser Beam',
    phase2Text: 'Enrages at 50% HP: Dual sweeping beams & faster pursuit.',
  },
  {
    archetype: 2,
    name: 'Scorpio Colossus',
    chapterName: 'Ch.2 Rust Canyon',
    color: '#f59e0b',
    signatureAttack: 'High-Speed Armored Dash Charge',
    phase2Text: 'Enrages at 50% HP: Chained triple dashes + radial shrapnel.',
  },
  {
    archetype: 3,
    name: 'Glacier Sovereign',
    chapterName: 'Ch.3 Cryo Citadel',
    color: '#60a5fa',
    signatureAttack: 'Frost Ring & Advancing Ice Shard Walls',
    phase2Text: 'Enrages at 50% HP: Double cryo rings & rapid ice barrages.',
  },
  {
    archetype: 4,
    name: 'Inferno Behemoth',
    chapterName: 'Ch.4 Magma Core',
    color: '#ef4444',
    signatureAttack: 'Meteor Strikes & Burning Magma Pools',
    phase2Text: 'Enrages at 50% HP: Rapid meteor storm + radial ember ring.',
  },
  {
    archetype: 5,
    name: 'Archon Nullifier',
    chapterName: 'Ch.5 Void Rift',
    color: '#a855f7',
    signatureAttack: 'Rotating Bullet-Hell Void Spiral',
    phase2Text: 'Enrages at 50% HP: Counter-rotating double spiral + void blink.',
  },
  {
    archetype: 6,
    name: 'Nexus Overlord',
    chapterName: 'Ch.6 Cyberopolis',
    color: '#14b8a6',
    signatureAttack: 'Orbiting Shield Drones & Hyper-Beam',
    phase2Text: 'Enrages at 50% HP: 4-way cross laser sweep + drone resummon.',
  },
];
