import { BossArchetype, ChapterDef, HeroId, WeaponId } from '../types/game';

// ============================================================================
// 1. 50-CHAPTER GALACTIC CAMPAIGN (5 GALAXIES x 10 CHAPTERS + 150 CHESTS)
// ============================================================================

export interface GalaxyDef {
  id: number;
  roman: string;
  name: string;
  subtitle: string;
  bgTop: string;
  bgBottom: string;
  gridColor: string;
  accent: string;
  bossNames: string[];
  bossOrder: BossArchetype[];
  chapterNames: string[];
}

export const GALAXIES: GalaxyDef[] = [
  {
    id: 1,
    roman: 'I',
    name: 'Neon Frontier',
    subtitle: 'Cybernetic sectors & orbital shipyards',
    bgTop: '#071024',
    bgBottom: '#0d1b38',
    gridColor: 'rgba(56,189,248,0.14)',
    accent: '#38bdf8',
    bossNames: ['Iron Dreadnought', 'Neon Cyber-Hydra', 'Grid Storm Warden'],
    bossOrder: [1, 2, 3],
    chapterNames: [
      'Outer Docklands',
      'Neon Conduit',
      'Orbital Relay',
      'Data Foundry',
      'Chrome Viaduct',
      'Pulse Shipyard',
      'Synth Sector 7',
      'Holo Citadel',
      'Overdrive Spire',
      'Frontier Core',
    ],
  },
  {
    id: 2,
    roman: 'II',
    name: 'Cryo Expanse',
    subtitle: 'Sub-zero glaciers & crystalline vaults',
    bgTop: '#061523',
    bgBottom: '#0c283d',
    gridColor: 'rgba(34,211,238,0.14)',
    accent: '#22d3ee',
    bossNames: ['Cryo Leviathan', 'Blizzard Warden', 'Frost Dreadnought'],
    bossOrder: [2, 3, 4],
    chapterNames: [
      'Frostbite Ridge',
      'Glacier Rift',
      'Permafrost Gate',
      'Crystal Basin',
      'Cryo Observatory',
      'Absolute Trench',
      'Shattered Shelf',
      'Blizzard Spire',
      'Subzero Vault',
      'Glacial Throne',
    ],
  },
  {
    id: 3,
    roman: 'III',
    name: 'Magma Caldera',
    subtitle: 'Volcanic smelters & solar reactors',
    bgTop: '#1c0b07',
    bgBottom: '#2d140c',
    gridColor: 'rgba(251,146,60,0.15)',
    accent: '#fb923c',
    bossNames: ['Solar Colossus', 'Magma Dreadnought', 'Cinder Hydra'],
    bossOrder: [3, 4, 5],
    chapterNames: [
      'Cinder Outpost',
      'Basalt Bridge',
      'Slag Refinery',
      'Ember Canyon',
      'Obsidian Forge',
      'Pyro Conduit',
      'Magma Core',
      'Solar Crucible',
      'Inferno Bastion',
      'Caldera Crown',
    ],
  },
  {
    id: 4,
    roman: 'IV',
    name: 'Toxic Bio-Spire',
    subtitle: 'Mutagen hives & overgrown orbital labs',
    bgTop: '#071a0f',
    bgBottom: '#102b1a',
    gridColor: 'rgba(74,222,128,0.14)',
    accent: '#4ade80',
    bossNames: ['Bio-Venom Hydra', 'Plague Leviathan', 'Hive Overmind'],
    bossOrder: [4, 5, 6],
    chapterNames: [
      'Spore Perimeter',
      'Acidic Marsh',
      'Bio-Vat Corridor',
      'Venom Canopy',
      'Mutagen Annex',
      'Plague Foundry',
      'Chitin Labyrinth',
      'Blight Reactor',
      'Hive Nexus',
      'Overmind Spire',
    ],
  },
  {
    id: 5,
    roman: 'V',
    name: 'Abyssal Singularity',
    subtitle: 'Deep-space rifts & the Starforge heart',
    bgTop: '#10071f',
    bgBottom: '#1e0e38',
    gridColor: 'rgba(192,132,252,0.15)',
    accent: '#c084fc',
    bossNames: ['Void Emperor', 'Eclipse Colossus', 'Singularity Warden'],
    bossOrder: [6, 5, 4],
    chapterNames: [
      'Event Horizon',
      'Astral Fracture',
      'Null Corridor',
      'Eclipse Bastion',
      'Dark Matter Rift',
      'Singularity Gate',
      'Chrono Wreckage',
      'Oblivion Sanctum',
      'Omega Forge',
      'Starforge Throne',
    ],
  },
];

export const TOTAL_CAMPAIGN_CHAPTERS = 50;

export function buildCampaignChapters(): ChapterDef[] {
  const list: ChapterDef[] = [];
  let id = 1;
  for (const g of GALAXIES) {
    for (let i = 0; i < 10; i++) {
      const globalIdx = id - 1;
      const bossArchetype = g.bossOrder[i % g.bossOrder.length];
      const isGalaxyBoss = i === 9;
      list.push({
        id,
        name: `Ch.${id}: ${g.chapterNames[i]}`,
        subtitle: `${g.name} • ${isGalaxyBoss ? 'Galaxy Finale Boss' : `Sector ${i + 1}/10`}`,
        mode: 'chapter',
        bossArchetype,
        bgTop: g.bgTop,
        bgBottom: g.bgBottom,
        gridColor: g.gridColor,
        accentColor: g.accent,
        bossName: g.bossNames[i % g.bossNames.length],
        durationSec: 210 + Math.min(90, Math.floor(globalIdx / 5) * 10),
        enemyHpMult: Number((1 + globalIdx * 0.24 + Math.pow(globalIdx, 1.32) * 0.04).toFixed(2)),
        enemyDmgMult: Number((1 + globalIdx * 0.14 + Math.pow(globalIdx, 1.18) * 0.025).toFixed(2)),
        spawnRateMult: Number((1 + Math.min(2.4, globalIdx * 0.045)).toFixed(2)),
        recommendedPower: Math.round(520 + globalIdx * 340 + globalIdx * globalIdx * 24),
        rewardCoins: Math.round(1400 + globalIdx * 520 + (isGalaxyBoss ? 2500 : 0)),
        rewardGems: Math.round(35 + Math.floor(globalIdx * 2.5) + (isGalaxyBoss ? 80 : 0)),
      });
      id++;
    }
  }
  return list;
}

export const CAMPAIGN_CHAPTERS_50: ChapterDef[] = buildCampaignChapters();

export interface ChapterMilestoneDef {
  key: '2m' | '4m' | 'clear';
  label: string;
  coins: number;
  gems: number;
  cyberKeys: number;
}

export function getChapterMilestones(chapterId: number): ChapterMilestoneDef[] {
  const scale = 1 + (chapterId - 1) * 0.12;
  return [
    { key: '2m', label: 'Survive 1:30', coins: Math.round(800 * scale), gems: 25, cyberKeys: 0 },
    { key: '4m', label: 'Survive 3:00', coins: Math.round(1400 * scale), gems: 45, cyberKeys: 0 },
    { key: 'clear', label: 'Clear Sector', coins: Math.round(2400 * scale), gems: 80, cyberKeys: chapterId % 5 === 0 ? 2 : 1 },
  ];
}

// ============================================================================
// 2. 6 UPGRADEABLE COMBAT DRONES / CYBER-PETS
// ============================================================================

export type DroneId = 'volt_wasp' | 'medi_orb' | 'cryo_owl' | 'scrap_hound' | 'nova_turret' | 'aegis_sentinel';

export interface CombatDroneDef {
  id: DroneId;
  name: string;
  role: string;
  color: string;
  desc: string;
  unlockCostGems: number;
  atkBonusPerLv: number;
  hpBonusPerLv: number;
  cooldownSec: number;
}

export const COMBAT_DRONES: CombatDroneDef[] = [
  {
    id: 'volt_wasp',
    name: 'Volt Wasp',
    role: 'Chain Striker',
    color: '#38bdf8',
    desc: 'Zaps nearby foes with rapid chain-lightning arcs every 2.2s.',
    unlockCostGems: 0, // Free starter drone!
    atkBonusPerLv: 8,
    hpBonusPerLv: 25,
    cooldownSec: 2.2,
  },
  {
    id: 'medi_orb',
    name: 'Medi-Orb',
    role: 'Field Medic',
    color: '#34d399',
    desc: 'Restores 5% Max HP and emits a healing shockwave every 7.5s.',
    unlockCostGems: 350,
    atkBonusPerLv: 5,
    hpBonusPerLv: 55,
    cooldownSec: 7.5,
  },
  {
    id: 'cryo_owl',
    name: 'Cryo Owl',
    role: 'Frost Control',
    color: '#22d3ee',
    desc: 'Launches cryo pulses every 3.5s that slow & chill nearby swarms.',
    unlockCostGems: 450,
    atkBonusPerLv: 9,
    hpBonusPerLv: 35,
    cooldownSec: 3.5,
  },
  {
    id: 'scrap_hound',
    name: 'Scrap Hound',
    role: 'Auto-Collector',
    color: '#fbbf24',
    desc: 'Autonomously darts out to magnetize XP gems & Gold + boosts pickup radius.',
    unlockCostGems: 550,
    atkBonusPerLv: 7,
    hpBonusPerLv: 40,
    cooldownSec: 3.0,
  },
  {
    id: 'nova_turret',
    name: 'Nova Turret',
    role: 'Boss Hunter',
    color: '#fb923c',
    desc: 'Locks onto the highest-HP Elite or Boss with heavy plasma shells every 2.4s.',
    unlockCostGems: 750,
    atkBonusPerLv: 14,
    hpBonusPerLv: 30,
    cooldownSec: 2.4,
  },
  {
    id: 'aegis_sentinel',
    name: 'Aegis Sentinel',
    role: 'Bullet Blocker',
    color: '#a78bfa',
    desc: 'Orbits closely around you, vaporizing incoming enemy projectiles on contact!',
    unlockCostGems: 900,
    atkBonusPerLv: 10,
    hpBonusPerLv: 65,
    cooldownSec: 1.5,
  },
];

// ============================================================================
// 3. 10 WEAPON TECH CHIPS (EQUIPPABLE MODIFIERS, UP TO 3 ACTIVE)
// ============================================================================

export interface TechChipDef {
  id: string;
  weaponId: WeaponId;
  name: string;
  desc: string;
  color: string;
  costGems: number;
  dmgBonusPct: number;
  extraProj?: number;
  areaBonusPct?: number;
}

export const TECH_CHIPS: TechChipDef[] = [
  { id: 'chip_pulse', weaponId: 'pulse_rifle', name: 'Split-Barrel Core', desc: 'Pulse Rifle fires +1 extra bolt & +18% DMG', color: '#38bdf8', costGems: 260, dmgBonusPct: 18, extraProj: 1 },
  { id: 'chip_blade', weaponId: 'plasma_blade', name: 'Twin-Wave Edge', desc: 'Plasma Blade gains +28% slash arc & +20% DMG', color: '#f472b6', costGems: 320, dmgBonusPct: 20, areaBonusPct: 28 },
  { id: 'chip_drone', weaponId: 'inferno_drone', name: 'Overclocked Rotors', desc: 'Inferno Drone gains +1 volley & +20% DMG', color: '#fb923c', costGems: 340, dmgBonusPct: 20, extraProj: 1 },
  { id: 'chip_tesla', weaponId: 'tesla_arc', name: 'Forked Capacitor', desc: 'Tesla Arc strikes +2 additional targets & +18% DMG', color: '#a78bfa', costGems: 340, dmgBonusPct: 18, extraProj: 2 },
  { id: 'chip_staff', weaponId: 'arcane_staff', name: 'Astral Resonator', desc: 'Arcane Staff gains +25% blast radius & +22% DMG', color: '#c084fc', costGems: 360, dmgBonusPct: 22, areaBonusPct: 25 },
  { id: 'chip_frost', weaponId: 'frost_nova', name: 'Cryo Shatter Matrix', desc: 'Frost Nova gains +26% radius & +25% DMG', color: '#67e8f9', costGems: 320, dmgBonusPct: 25, areaBonusPct: 26 },
  { id: 'chip_saw', weaponId: 'orbital_saw', name: 'Hyper-Return Gyro', desc: 'Orbital Saw adds +1 extra blade & +20% DMG', color: '#4ade80', costGems: 300, dmgBonusPct: 20, extraProj: 1 },
  { id: 'chip_lance', weaponId: 'solar_lance', name: 'Prism Amplifier', desc: 'Solar Lance widens +30% & deals +24% DMG', color: '#facc15', costGems: 380, dmgBonusPct: 24, areaBonusPct: 30 },
  { id: 'chip_grav', weaponId: 'gravity_well', name: 'Singularity Primer', desc: 'Gravity Well expands +25% & +22% DMG', color: '#818cf8', costGems: 350, dmgBonusPct: 22, areaBonusPct: 25 },
  { id: 'chip_bow', weaponId: 'star_bow', name: 'Starlight Quiver', desc: 'Star Bow fires +2 piercing arrows & +20% DMG', color: '#fb7185', costGems: 320, dmgBonusPct: 20, extraProj: 2 },
];

// ============================================================================
// 4. 3 S-GRADE ARMOR SETS (2-PC / 4-PC / 6-PC SET BONUSES)
// ============================================================================

export type GearSetId = 'solaris' | 'voidwalker' | 'titan';

export interface GearSetDef {
  id: GearSetId;
  name: string;
  color: string;
  templateIds: string[];
  bonus2: string;
  bonus4: string;
  bonus6: string;
}

export const GEAR_SETS: GearSetDef[] = [
  {
    id: 'solaris',
    name: 'Solaris Vanguard Set',
    color: '#fbbf24',
    templateIds: ['wp_katana', 'ar_aegis', 'hm_visor', 'bt_thruster', 'rg_crit', 'cr_phoenix'],
    bonus2: '+15% ATK',
    bonus4: '+25% Crit Damage & +6% Crit Chance',
    bonus6: '+30% All Damage & +25% Gold',
  },
  {
    id: 'voidwalker',
    name: 'Voidwalker Shadow Set',
    color: '#c084fc',
    templateIds: ['wp_voidcannon', 'ar_stealth', 'hm_visor', 'bt_mag', 'rg_greed', 'cr_quantum'],
    bonus2: '+10% Dodge & +8% Move Speed',
    bonus4: '+15% Cooldown Reduction',
    bonus6: '+25% Projectile Power & +20% XP',
  },
  {
    id: 'titan',
    name: 'Titan Aegis Set',
    color: '#38bdf8',
    templateIds: ['wp_pulse', 'ar_aegis', 'hm_titan', 'bt_thruster', 'rg_greed', 'cr_phoenix'],
    bonus2: '+20% Max HP',
    bonus4: '+8 Armor & +4 HP/s Regen',
    bonus6: '+35% Max HP & +20% ATK',
  },
];

// ============================================================================
// 5. 100-FLOOR STARFORGE SPIRE (TRIAL TOWER)
// ============================================================================

export interface TowerFloorDef {
  floor: number;
  title: string;
  modifierLabel: string;
  galaxyIdx: number;
  bossArchetype: BossArchetype;
  bossName: string;
  durationSec: number;
  hpMult: number;
  dmgMult: number;
  rewardCoins: number;
  rewardGems: number;
  isMilestone: boolean;
}

const TOWER_MODIFIERS = [
  'Standard Gauntlet',
  'Hyper Haste (+25% Enemy Speed)',
  'Glass Cannon (+40% DMG Taken & Dealt)',
  'Boss Surge (Early Boss Spawn)',
  'Swarm Frenzy (+35% Density)',
];

const TOWER_BOSSES: BossArchetype[] = [1, 2, 3, 4, 5, 6];

const TOWER_BOSS_NAMES = [
  'Spire Dreadnought',
  'Spire Leviathan',
  'Spire Colossus',
  'Spire Cyber-Hydra',
  'Spire Storm Warden',
  'Spire Void Emperor',
];

export function getTowerFloorDef(floor: number): TowerFloorDef {
  const f = Math.max(1, Math.min(100, Math.floor(floor)));
  const isMilestone = f % 5 === 0;
  const bIdx = (f - 1) % TOWER_BOSSES.length;
  return {
    floor: f,
    title: `Spire Floor ${f}${isMilestone ? ' ★ BOSS GAUNTLET' : ''}`,
    modifierLabel: TOWER_MODIFIERS[(f - 1) % TOWER_MODIFIERS.length],
    galaxyIdx: Math.floor((f - 1) / 5) % GALAXIES.length,
    bossArchetype: TOWER_BOSSES[bIdx],
    bossName: TOWER_BOSS_NAMES[bIdx],
    durationSec: isMilestone ? 60 : 45,
    hpMult: Number((1.15 + (f - 1) * 0.18 + Math.pow(f - 1, 1.25) * 0.03).toFixed(2)),
    dmgMult: Number((1.1 + (f - 1) * 0.11).toFixed(2)),
    rewardCoins: Math.round(1200 + f * 320 + (isMilestone ? 3000 : 0)),
    rewardGems: Math.round(25 + Math.floor(f * 1.5) + (isMilestone ? 120 : 0)),
    isMilestone,
  };
}

export function buildTowerChapterDef(floor: number): ChapterDef {
  const tf = getTowerFloorDef(floor);
  const g = GALAXIES[tf.galaxyIdx] || GALAXIES[0];
  return {
    id: 1000 + tf.floor,
    name: tf.title,
    subtitle: tf.modifierLabel,
    mode: 'chapter',
    bgTop: g.bgTop,
    bgBottom: g.bgBottom,
    gridColor: g.gridColor,
    accentColor: g.accent,
    bossName: tf.bossName,
    bossArchetype: tf.bossArchetype,
    durationSec: tf.durationSec,
    enemyHpMult: tf.hpMult,
    enemyDmgMult: tf.dmgMult,
    spawnRateMult: Number((1.3 + Math.min(1.6, tf.floor * 0.02)).toFixed(2)),
    recommendedPower: Math.round(600 + tf.floor * 260),
    rewardCoins: tf.rewardCoins,
    rewardGems: tf.rewardGems,
  };
}

// ============================================================================
// 6. 7-DAY NEWCOMER BOOTCAMP ("OPERATION: STARFORGE")
// ============================================================================

export interface BootcampMissionDef {
  id: string;
  day: number;
  title: string;
  target: number;
  metric: 'totalRuns' | 'totalKills' | 'totalBossesKilled' | 'clearedChapters' | 'highestTowerFloor' | 'accountLevel' | 'discoveredEvos';
  rewardCoins: number;
  rewardGems: number;
  points: number;
}

export const BOOTCAMP_MISSIONS: BootcampMissionDef[] = [
  { id: 'bc_1', day: 1, title: 'Complete 1 Combat Run', target: 1, metric: 'totalRuns', rewardCoins: 2000, rewardGems: 80, points: 10 },
  { id: 'bc_2', day: 1, title: 'Eliminate 150 Enemies', target: 150, metric: 'totalKills', rewardCoins: 2500, rewardGems: 80, points: 10 },
  { id: 'bc_3', day: 2, title: 'Clear Chapter 1', target: 1, metric: 'clearedChapters', rewardCoins: 3500, rewardGems: 120, points: 15 },
  { id: 'bc_4', day: 2, title: 'Defeat 2 Sector Bosses', target: 2, metric: 'totalBossesKilled', rewardCoins: 4000, rewardGems: 120, points: 15 },
  { id: 'bc_5', day: 3, title: 'Reach Account Level 4', target: 4, metric: 'accountLevel', rewardCoins: 4500, rewardGems: 150, points: 15 },
  { id: 'bc_6', day: 4, title: 'Clear Spire Tower Floor 2', target: 2, metric: 'highestTowerFloor', rewardCoins: 5000, rewardGems: 180, points: 15 },
  { id: 'bc_7', day: 5, title: 'Discover 2 Weapon Evolutions', target: 2, metric: 'discoveredEvos', rewardCoins: 6000, rewardGems: 200, points: 20 },
  { id: 'bc_8', day: 6, title: 'Eliminate 1,500 Enemies', target: 1500, metric: 'totalKills', rewardCoins: 8000, rewardGems: 250, points: 20 },
  { id: 'bc_9', day: 7, title: 'Clear 4 Campaign Chapters', target: 4, metric: 'clearedChapters', rewardCoins: 12000, rewardGems: 350, points: 25 },
];

export const BOOTCAMP_GRAND_POINTS = 100;

// ============================================================================
// 7. WEEKLY LIVE-OPS ROTATING EVENTS (AUTO-ROTATES BY ISO WEEK)
// ============================================================================

export interface WeeklyEventDef {
  weekKey: string;
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  tokenName: string;
  shopItems: {
    id: string;
    title: string;
    cost: number;
    limit: number;
    rewardType: 'coins' | 'gems' | 'cyberKeys' | 'blueprints';
    amount: number;
  }[];
}

const WEEKLY_THEMES = [
  { id: 'starfall', name: 'Starfall Harvest', subtitle: 'Earn Starfall Tokens from every run & boss kill!', accent: '#fbbf24', tokenName: 'Starfall Tokens' },
  { id: 'void_invasion', name: 'Void Invasion', subtitle: 'Repel the Abyssal Rift and claim rare Void supplies!', accent: '#c084fc', tokenName: 'Rift Shards' },
  { id: 'boss_hunter', name: 'Boss Hunter Week', subtitle: 'Double event tokens from every defeated Sector Boss!', accent: '#f43f5e', tokenName: 'Hunter Crests' },
  { id: 'cyber_forge', name: 'Cyber Forge Festival', subtitle: 'Stock up on Cyber Keys, Blueprints & Star Shards!', accent: '#38bdf8', tokenName: 'Forge Cores' },
];

export function getIsoWeekKey(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getActiveWeeklyEvent(d = new Date()): WeeklyEventDef {
  const weekKey = getIsoWeekKey(d);
  const weekNum = parseInt(weekKey.split('-W')[1] || '1', 10);
  const theme = WEEKLY_THEMES[(weekNum - 1) % WEEKLY_THEMES.length];
  return {
    weekKey,
    ...theme,
    shopItems: [
      { id: 'wk_keys', title: '2× Cyber Keys', cost: 40, limit: 3, rewardType: 'cyberKeys', amount: 2 },
      { id: 'wk_gems', title: '+250 Star Shards', cost: 55, limit: 4, rewardType: 'gems', amount: 250 },
      { id: 'wk_gold', title: '+15,000 Gold', cost: 30, limit: 5, rewardType: 'coins', amount: 15000 },
      { id: 'wk_bp', title: '+40 Blueprints', cost: 25, limit: 5, rewardType: 'blueprints', amount: 40 },
    ],
  };
}

// ============================================================================
// 8. 12 HERO SKINS & COSMETIC AURAS (ZERO PAY-TO-WIN!)
// ============================================================================

export interface HeroSkinDef {
  id: string;
  heroId: HeroId;
  name: string;
  primaryColor: string;
  auraColor: string;
  costGems: number;
}

export const HERO_SKINS: HeroSkinDef[] = [
  { id: 'kael_solar', heroId: 'kael', name: 'Solaris Ronin', primaryColor: '#fbbf24', auraColor: '#f59e0b', costGems: 400 },
  { id: 'kael_crimson', heroId: 'kael', name: 'Crimson Blade', primaryColor: '#f43f5e', auraColor: '#fb7185', costGems: 600 },
  { id: 'nova_astral', heroId: 'nova', name: 'Astral Empress', primaryColor: '#c084fc', auraColor: '#e879f9', costGems: 400 },
  { id: 'nova_emerald', heroId: 'nova', name: 'Emerald Prism', primaryColor: '#34d399', auraColor: '#2dd4bf', costGems: 600 },
  { id: 'titan_obsidian', heroId: 'titan', name: 'Obsidian Mech', primaryColor: '#fb923c', auraColor: '#f97316', costGems: 450 },
  { id: 'titan_frost', heroId: 'titan', name: 'Glacial Juggernaut', primaryColor: '#22d3ee', auraColor: '#38bdf8', costGems: 650 },
  { id: 'aegis_gold', heroId: 'aegis', name: 'Gilded Architect', primaryColor: '#facc15', auraColor: '#fde047', costGems: 450 },
  { id: 'aegis_cyber', heroId: 'aegis', name: 'Neon Sentinel', primaryColor: '#60a5fa', auraColor: '#38bdf8', costGems: 650 },
  { id: 'pyro_blue', heroId: 'pyro', name: 'Blue Starfire', primaryColor: '#38bdf8', auraColor: '#0ea5e9', costGems: 500 },
  { id: 'pyro_phoenix', heroId: 'pyro', name: 'Eternal Phoenix', primaryColor: '#fbbf24', auraColor: '#ef4444', costGems: 700 },
  { id: 'vespera_eclipse', heroId: 'vespera', name: 'Blood Eclipse', primaryColor: '#f43f5e', auraColor: '#9f1239', costGems: 500 },
  { id: 'vespera_ghost', heroId: 'vespera', name: 'Phantom Wraith', primaryColor: '#e2e8f0', auraColor: '#94a3b8', costGems: 700 },
];

// ============================================================================
// 9. GROWTH FUND MILESTONES (15,000+ SHARDS ACROSS ACCOUNT LEVELS 5 -> 50)
// ============================================================================

export interface GrowthFundTierDef {
  level: number;
  gems: number;
}

export const GROWTH_FUND_TIERS: GrowthFundTierDef[] = [
  { level: 3, gems: 800 },
  { level: 5, gems: 1000 },
  { level: 8, gems: 1200 },
  { level: 12, gems: 1500 },
  { level: 16, gems: 1800 },
  { level: 20, gems: 2200 },
  { level: 25, gems: 2500 },
  { level: 30, gems: 3000 },
  { level: 40, gems: 4000 },
];

export const BOSS_VAULT_MAX_SHARDS = 1500;
