import {
  ChapterDef,
  GearSlot,
  HeroDef,
  PassiveDef,
  Rarity,
  TalentNodeDef,
  WeaponDef,
  WeaponId,
  WeaponStyle,
} from '../types/game';

export interface WeaponStyleDef {
  id: WeaponStyle;
  weaponId: WeaponId;
  name: string;
  icon: string;
  subtitle: string;
  color: string;
}

export const WEAPON_STYLES: WeaponStyleDef[] = [
  {
    id: 'sword',
    weaponId: 'plasma_blade',
    name: 'Sword',
    icon: '⚔️',
    subtitle: 'Heavy arcs & knockback',
    color: '#38bdf8',
  },
  {
    id: 'staff',
    weaponId: 'arcane_staff',
    name: 'Staff',
    icon: '🪄',
    subtitle: 'Explosive arcane orbs',
    color: '#c084fc',
  },
  {
    id: 'bow',
    weaponId: 'star_bow',
    name: 'Bow',
    icon: '🏹',
    subtitle: 'Rapid piercing arrows',
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
    description: 'Agile elite warrior with lethal critical strikes and a lightning-fast dash.',
    startingWeapon: 'plasma_blade',
    ultName: 'Omnislash Nova',
    ultDesc: 'Unleashes a massive 360° plasma shockwave around your hero.',
    accentColor: '#38bdf8',
    secondaryColor: '#0284c7',
    baseHp: 220,
    baseAtk: 26,
    baseSpeed: 195,
    unlockCostGems: 0,
    perkLabel: '+12% Crit Chance',
  },
  {
    id: 'nova',
    name: 'Nova',
    title: 'Storm Weaver',
    description: 'Commands energy storms and accelerates all weapon cooldowns.',
    startingWeapon: 'arcane_staff',
    ultName: 'Ion Tempest',
    ultDesc: 'Calls down 18 devastating lightning bolts on enemies across the arena.',
    accentColor: '#a855f7',
    secondaryColor: '#6366f1',
    baseHp: 195,
    baseAtk: 31,
    baseSpeed: 205,
    unlockCostGems: 350,
    perkLabel: '-15% Weapon Cooldown',
  },
  {
    id: 'titan',
    name: 'Titan-X',
    title: 'Siege Juggernaut',
    description: 'Heavily armored vanguard built for huge HP and frontline durability.',
    startingWeapon: 'orbital_saw',
    ultName: 'Orbital Fortress',
    ultDesc: 'Restores 40% HP and blasts back enemies with a pulsing barrier.',
    accentColor: '#f59e0b',
    secondaryColor: '#d97706',
    baseHp: 340,
    baseAtk: 29,
    baseSpeed: 178,
    unlockCostGems: 650,
    perkLabel: '+35% Max HP & +5 Armor',
  },
  {
    id: 'vespera',
    name: 'Vespera',
    title: 'Void Reaper',
    description: 'Shadow hunter with deadly precision, high speed, and life-steal.',
    startingWeapon: 'star_bow',
    ultName: 'Eclipse Singularity',
    ultDesc: 'Pulls nearby enemies inward and shreds them with Void energy.',
    accentColor: '#f43f5e',
    secondaryColor: '#9f1239',
    baseHp: 240,
    baseAtk: 38,
    baseSpeed: 215,
    unlockCostGems: 1200,
    perkLabel: '+20% Damage & Life-Steal',
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
    evoDesc: 'Huge violet energy blasts that trigger chain shockwaves!',
    color: '#c084fc',
    maxLevel: 5,
    baseDamage: 33,
    baseCooldownMs: 880,
  },
  {
    id: 'star_bow',
    name: 'Energy Bow',
    shortDesc: 'Unleashes rapid piercing light arrows through enemy packs.',
    evoName: 'Stormrain Bow',
    evoPassive: 'eagle_optics',
    evoDesc: 'Fires 5 golden storm arrows at once straight through entire swarms!',
    color: '#22c55e',
    maxLevel: 5,
    baseDamage: 30,
    baseCooldownMs: 680,
  },
  {
    id: 'pulse_rifle',
    name: 'Ion Repeater',
    shortDesc: 'Locks onto the nearest target with rapid-fire bolts.',
    evoName: 'Railcannon Overdrive',
    evoPassive: 'eagle_optics',
    evoDesc: 'Piercing railgun beams that explode on impact!',
    color: '#22d3ee',
    maxLevel: 5,
    baseDamage: 24,
    baseCooldownMs: 520,
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
    shortDesc: 'Chain lightning that arcs across groups of enemies.',
    evoName: 'Thunderstorm Conduit',
    evoPassive: 'overclock_chip',
    evoDesc: 'Dual high-voltage arcs with slowing shockwaves!',
    color: '#a855f7',
    maxLevel: 5,
    baseDamage: 30,
    baseCooldownMs: 1050,
  },
  {
    id: 'frost_nova',
    name: 'Cryo Pulse',
    shortDesc: 'Freezing ice ring that chills and damages surrounding foes.',
    evoName: 'Absolute Zero',
    evoPassive: 'cryo_reactor',
    evoDesc: 'Massive frost vortex that freezes and shatters swarms!',
    color: '#60a5fa',
    maxLevel: 5,
    baseDamage: 26,
    baseCooldownMs: 1850,
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
    baseCooldownMs: 950,
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
    baseDamage: 18,
    baseCooldownMs: 2400,
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
    baseCooldownMs: 1250,
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
    rewardCoins: 1800,
    rewardGems: 50,
    bossName: 'Dread-Mech Mk.I',
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
    enemyHpMult: 1.75,
    enemyDmgMult: 1.35,
    spawnRateMult: 1.2,
    rewardCoins: 3200,
    rewardGems: 70,
    bossName: 'Scorpio Colossus',
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
    enemyHpMult: 2.8,
    enemyDmgMult: 1.75,
    spawnRateMult: 1.35,
    rewardCoins: 5200,
    rewardGems: 90,
    bossName: 'Glacier Sovereign',
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
    enemyHpMult: 4.3,
    enemyDmgMult: 2.25,
    spawnRateMult: 1.48,
    rewardCoins: 8000,
    rewardGems: 110,
    bossName: 'Inferno Behemoth',
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
    enemyHpMult: 6.5,
    enemyDmgMult: 2.9,
    spawnRateMult: 1.62,
    rewardCoins: 12500,
    rewardGems: 150,
    bossName: 'Archon Nullifier',
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
    enemyHpMult: 9.5,
    enemyDmgMult: 3.6,
    spawnRateMult: 1.75,
    rewardCoins: 18000,
    rewardGems: 200,
    bossName: 'Nexus Overlord',
  },
  {
    id: 99,
    name: '∞ Endless Void',
    subtitle: 'Infinite waves — compete for the #1 leaderboard spot!',
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
    rewardCoins: 4500,
    rewardGems: 80,
    bossName: 'Omega Void Leviathan',
  },
  {
    id: 88,
    name: '🔥 Boss Rush: Titan Gauntlet',
    subtitle: '5 relentless Bosses back-to-back — huge Gem & Blueprint loot!',
    mode: 'boss_rush',
    durationSec: 360,
    recommendedPower: 380,
    bgTop: '#1f0710',
    bgBottom: '#330a1a',
    gridColor: 'rgba(244, 63, 94, 0.12)',
    accentColor: '#f43f5e',
    enemyHpMult: 1.35,
    enemyDmgMult: 1.25,
    spawnRateMult: 0.55,
    rewardCoins: 6500,
    rewardGems: 130,
    bossName: 'Titan Gauntlet (5 Bosses)',
  },
];

export const TALENTS: TalentNodeDef[] = [
  {
    id: 'might',
    name: 'Hyper Might',
    desc: '+6 Attack Damage per level',
    icon: '⚔️',
    maxLevel: 30,
    baseCostCoins: 250,
    costStepCoins: 190,
    statKey: 'atkFlat',
    perLevelValue: 6,
  },
  {
    id: 'vitality',
    name: 'Nano Armor HP',
    desc: '+35 Max HP per level',
    icon: '❤️',
    maxLevel: 30,
    baseCostCoins: 220,
    costStepCoins: 170,
    statKey: 'hpFlat',
    perLevelValue: 35,
  },
  {
    id: 'armor',
    name: 'Titanium Shield',
    desc: '-2 incoming damage per level',
    icon: '🛡️',
    maxLevel: 20,
    baseCostCoins: 400,
    costStepCoins: 300,
    statKey: 'armor',
    perLevelValue: 2,
  },
  {
    id: 'greed',
    name: 'Cyber Greed',
    desc: '+8% bonus Gold from runs & patrol',
    icon: '🪙',
    maxLevel: 20,
    baseCostCoins: 350,
    costStepCoins: 260,
    statKey: 'greedPct',
    perLevelValue: 8,
  },
  {
    id: 'magnet',
    name: 'Quantum Magnet',
    desc: '+10% XP & Gold pickup radius',
    icon: '🧲',
    maxLevel: 15,
    baseCostCoins: 300,
    costStepCoins: 240,
    statKey: 'magnetPct',
    perLevelValue: 10,
  },
  {
    id: 'agility',
    name: 'Jet Thrusters',
    desc: '+3% move speed per level',
    icon: '⚡',
    maxLevel: 15,
    baseCostCoins: 320,
    costStepCoins: 250,
    statKey: 'speedPct',
    perLevelValue: 3,
  },
  {
    id: 'crit',
    name: 'Precision Optics',
    desc: '+2% Crit Chance per level',
    icon: '🎯',
    maxLevel: 15,
    baseCostCoins: 450,
    costStepCoins: 350,
    statKey: 'critPct',
    perLevelValue: 2,
  },
  {
    id: 'haste',
    name: 'Turbo Processor',
    desc: '-2% weapon cooldown per level',
    icon: '⏱️',
    maxLevel: 12,
    baseCostCoins: 600,
    costStepCoins: 480,
    statKey: 'hastePct',
    perLevelValue: 2,
  },
  {
    id: 'xp',
    name: 'Neural Boost',
    desc: '+7% XP gain in battle',
    icon: '💠',
    maxLevel: 15,
    baseCostCoins: 380,
    costStepCoins: 280,
    statKey: 'xpPct',
    perLevelValue: 7,
  },
  {
    id: 'revival',
    name: 'Phoenix Core',
    desc: '+1 free revive per run (max 1)',
    icon: '🔥',
    maxLevel: 1,
    baseCostCoins: 6500,
    costStepCoins: 0,
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
  { templateId: 'wp_katana', slot: 'weapon', name: 'Plasma Katana', baseAtk: 24, baseHp: 0, perkText: '+10% Crit Damage' },
  { templateId: 'wp_voidcannon', slot: 'weapon', name: 'Void Blaster', baseAtk: 28, baseHp: 0, perkText: '+8% Projectile Power' },
  { templateId: 'ar_aegis', slot: 'armor', name: 'Aegis Exo-Suit', baseAtk: 0, baseHp: 140, perkText: '-4 Damage Taken' },
  { templateId: 'ar_stealth', slot: 'armor', name: 'Phantom Rig', baseAtk: 6, baseHp: 115, perkText: '+5% Dodge / Speed' },
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

export interface PassTierDef {
  tier: number;
  xpRequired: number;
  freeLabel: string;
  freeReward: { coins?: number; gems?: number; blueprints?: number; basicKeys?: number; cyberKeys?: number };
  premiumLabel: string;
  premiumReward: { coins?: number; gems?: number; blueprints?: number; cyberKeys?: number; reviveTokens?: number };
}

export const PASS_TIERS: PassTierDef[] = Array.from({ length: 30 }, (_, idx) => {
  const tier = idx + 1;
  const xpRequired = tier * 100;
  const isMilestone = tier % 5 === 0;
  return {
    tier,
    xpRequired,
    freeLabel:
      tier % 10 === 0
        ? '1x Cyber Key'
        : isMilestone
          ? `${50 + tier * 2} Gems`
          : tier % 2 === 0
            ? `${8 + tier} Blueprints`
            : `${600 + tier * 120} Gold`,
    freeReward:
      tier % 10 === 0
        ? { cyberKeys: 1 }
        : isMilestone
          ? { gems: 50 + tier * 2 }
          : tier % 2 === 0
            ? { blueprints: 8 + tier }
            : { coins: 600 + tier * 120 },
    premiumLabel:
      tier === 30
        ? '400 Gems + 3x Cyber Key'
        : tier % 5 === 0
          ? `${120 + tier * 4} Gems`
          : tier % 3 === 0
            ? '2x Cyber Key'
            : `${2000 + tier * 250} Gold`,
    premiumReward:
      tier === 30
        ? { gems: 400, cyberKeys: 3 }
        : tier % 5 === 0
          ? { gems: 120 + tier * 4 }
          : tier % 3 === 0
            ? { cyberKeys: 2 }
            : { coins: 2000 + tier * 250 },
  };
});

export interface DailyQuestDef {
  id: string;
  title: string;
  target: number;
  field: 'killsToday' | 'runsToday' | 'bossesToday' | 'upgradesToday' | 'adsToday';
  gems: number;
  coins: number;
  passXp: number;
}

export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: 'dq_kills_200', title: 'Defeat 200 enemies', target: 200, field: 'killsToday', gems: 25, coins: 1200, passXp: 80 },
  { id: 'dq_runs_2', title: 'Complete 2 battles', target: 2, field: 'runsToday', gems: 20, coins: 1000, passXp: 70 },
  { id: 'dq_boss_1', title: 'Defeat 1 Boss / Elite', target: 1, field: 'bossesToday', gems: 35, coins: 1800, passXp: 100 },
  { id: 'dq_upg_2', title: 'Upgrade gear or talent 2x', target: 2, field: 'upgradesToday', gems: 20, coins: 900, passXp: 70 },
  { id: 'dq_ad_1', title: 'Claim 1x Bonus Reward', target: 1, field: 'adsToday', gems: 30, coins: 1500, passXp: 80 },
];

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  gems: number;
  cyberKeys?: number;
  check: (s: { totalKills: number; totalRuns: number; totalBossesKilled: number; clearedCount: number; bestEndlessSec: number }) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_kill_500', title: 'Swarm Breaker', desc: 'Defeat 500 enemies in total', gems: 50, check: (s) => s.totalKills >= 500 },
  { id: 'ach_kill_2500', title: 'Neon Exterminator', desc: 'Defeat 2,500 enemies in total', gems: 120, cyberKeys: 1, check: (s) => s.totalKills >= 2500 },
  { id: 'ach_kill_10000', title: 'Galactic Reaper', desc: 'Defeat 10,000 enemies in total', gems: 300, cyberKeys: 2, check: (s) => s.totalKills >= 10000 },
  { id: 'ach_ch1', title: 'First Victory', desc: 'Clear Chapter 1 (Neon Outskirts)', gems: 60, check: (s) => s.clearedCount >= 1 },
  { id: 'ach_ch3', title: 'Cryo Conqueror', desc: 'Clear 3 Chapters', gems: 150, cyberKeys: 1, check: (s) => s.clearedCount >= 3 },
  { id: 'ach_ch6', title: 'Starforge Master', desc: 'Clear all 6 Story Chapters', gems: 450, cyberKeys: 3, check: (s) => s.clearedCount >= 6 },
  { id: 'ach_boss_10', title: 'Boss Hunter', desc: 'Defeat 10 Bosses / Elites', gems: 100, check: (s) => s.totalBossesKilled >= 10 },
  { id: 'ach_endless_180', title: 'Void Survivor', desc: 'Survive 3 minutes in Endless Void', gems: 140, check: (s) => s.bestEndlessSec >= 180 },
];

export const LOGIN_STREAK_REWARDS = [
  { day: 1, label: '1,000 Gold', coins: 1000, gems: 0, cyberKeys: 0 },
  { day: 2, label: '40 Gems', coins: 0, gems: 40, cyberKeys: 0 },
  { day: 3, label: '2,500 Gold', coins: 2500, gems: 0, cyberKeys: 0 },
  { day: 4, label: '1x Cyber Key', coins: 0, gems: 0, cyberKeys: 1 },
  { day: 5, label: '80 Gems', coins: 0, gems: 80, cyberKeys: 0 },
  { day: 6, label: '5,000 Gold', coins: 5000, gems: 0, cyberKeys: 0 },
  { day: 7, label: '200 Gems + Key', coins: 0, gems: 200, cyberKeys: 1 },
];

export interface WheelSliceDef {
  id: string;
  label: string;
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
  { id: 'w_gold_s', label: '1,500 Gold', color: '#334155', weight: 24, coins: 1500 },
  { id: 'w_gems_40', label: '40 Gems', color: '#0284c7', weight: 20, gems: 40 },
  { id: 'w_bp_15', label: '15 Blueprints', color: '#0d9488', weight: 18, blueprints: 15 },
  { id: 'w_gold_l', label: '4,500 Gold', color: '#b45309', weight: 14, coins: 4500 },
  { id: 'w_revive', label: '2x Revive Token', color: '#be123c', weight: 10, reviveTokens: 2 },
  { id: 'w_key', label: '1x Cyber Key', color: '#7c3aed', weight: 8, cyberKeys: 1 },
  { id: 'w_gems_120', label: '120 Gems', color: '#2563eb', weight: 4, gems: 120 },
  { id: 'w_jackpot', label: '300 GEMS JACKPOT!', color: '#f59e0b', weight: 2, gems: 300, isJackpot: true },
];
