import {
  ChapterDef,
  GearSlot,
  HeroDef,
  PassiveDef,
  Rarity,
  TalentNodeDef,
  WeaponDef,
} from '../types/game';

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
    description: 'Snelle plasma-zwaardvechter met dodelijke crit-kansen en bliksemsnelle dash.',
    startingWeapon: 'plasma_blade',
    ultName: 'Omnislash Nova',
    ultDesc: 'Ontketent een gigantische 360° plasma-schokgolf rondom je held.',
    accentColor: '#38bdf8',
    secondaryColor: '#0284c7',
    baseHp: 220,
    baseAtk: 26,
    baseSpeed: 195,
    unlockCostGems: 0,
    perkLabel: '+12% Crit Kans',
  },
  {
    id: 'nova',
    name: 'Nova',
    title: 'Storm Weaver',
    description: 'Beheerst bliksemketens en versnelt alle wapen-cooldowns.',
    startingWeapon: 'tesla_arc',
    ultName: 'Ion Tempest',
    ultDesc: 'Laat 18 verwoestende bliksemstralen inslaan op vijanden in beeld.',
    accentColor: '#a855f7',
    secondaryColor: '#6366f1',
    baseHp: 195,
    baseAtk: 31,
    baseSpeed: 205,
    unlockCostGems: 350,
    perkLabel: '-15% Wapen Cooldown',
  },
  {
    id: 'titan',
    name: 'Titan-X',
    title: 'Siege Juggernaut',
    description: 'Zwaar gepantserde mech met enorme HP en verpletterende orbitals.',
    startingWeapon: 'orbital_saw',
    ultName: 'Orbital Fortress',
    ultDesc: 'Herstelt 40% HP & lanceert een vernietigende pulserende barrière.',
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
    description: 'Schaduwmoordenaar met levenszuigende zeisen en extreme schade.',
    startingWeapon: 'vamp_scythe',
    ultName: 'Eclipse Singularity',
    ultDesc: 'Trekt alle monsters naar binnen en snijdt ze aan stukken met Void-energie.',
    accentColor: '#f43f5e',
    secondaryColor: '#9f1239',
    baseHp: 240,
    baseAtk: 38,
    baseSpeed: 215,
    unlockCostGems: 1200,
    perkLabel: '+20% Schade & Life-Steal',
  },
];

export const WEAPONS: WeaponDef[] = [
  {
    id: 'plasma_blade',
    name: 'Plasma Katana',
    shortDesc: 'Scherpe boogslagen vlak voor en achter je held.',
    evoName: 'Hyper-Nova Blade',
    evoPassive: 'chrono_core',
    evoDesc: '360° rode plasma-slagen bij elke aanval met extra reikwijdte!',
    color: '#38bdf8',
    maxLevel: 5,
    baseDamage: 34,
    baseCooldownMs: 900,
  },
  {
    id: 'pulse_rifle',
    name: 'Ion Repeater',
    shortDesc: 'Richt automatisch snelvuur op het dichtstbijzijnde doel.',
    evoName: 'Railcannon Overdrive',
    evoPassive: 'eagle_optics',
    evoDesc: 'Doorborende railgun-stralen die exploderen bij inslag!',
    color: '#22d3ee',
    maxLevel: 5,
    baseDamage: 24,
    baseCooldownMs: 520,
  },
  {
    id: 'orbital_saw',
    name: 'Aether Orbitals',
    shortDesc: 'Draaiende energiezagen om je heen die vijanden terugduwen.',
    evoName: 'Solar Vortex',
    evoPassive: 'magnet_halo',
    evoDesc: '6 brandende plasma-zagen die razendsnel permanent ronddraaien!',
    color: '#f59e0b',
    maxLevel: 5,
    baseDamage: 22,
    baseCooldownMs: 120,
  },
  {
    id: 'tesla_arc',
    name: 'Tempest Coil',
    shortDesc: 'Kettingbliksem die tussen groepen vijanden springt.',
    evoName: 'Thunderstorm Conduit',
    evoPassive: 'overclock_chip',
    evoDesc: 'Dubbele hoogspanningsbogen met verlammende schokgolven!',
    color: '#a855f7',
    maxLevel: 5,
    baseDamage: 30,
    baseCooldownMs: 1050,
  },
  {
    id: 'frost_nova',
    name: 'Cryo Pulse',
    shortDesc: 'Bevriezende ijsring die monsters vertraagt en beschadigt.',
    evoName: 'Absolute Zero',
    evoPassive: 'cryo_reactor',
    evoDesc: 'Gigantische ijsvortex die bevroren monsters laat versplinteren!',
    color: '#60a5fa',
    maxLevel: 5,
    baseDamage: 26,
    baseCooldownMs: 1850,
  },
  {
    id: 'inferno_drone',
    name: 'Phoenix Drones',
    shortDesc: 'Autonome drones die doelzoekende raketten afvuren.',
    evoName: 'Valkyrie Swarm',
    evoPassive: 'fusion_cell',
    evoDesc: '4 elite-drones die continu explosieve zwermraketten afschieten!',
    color: '#fb7185',
    maxLevel: 5,
    baseDamage: 28,
    baseCooldownMs: 950,
  },
  {
    id: 'gravity_well',
    name: 'Void Singularity',
    shortDesc: 'Creëert zwarte gaten die vijanden naar binnen trekken.',
    evoName: 'Event Horizon',
    evoPassive: 'dark_matter',
    evoDesc: 'Enorme paarse dimensiescheuren met verpletterende pulsschade!',
    color: '#c084fc',
    maxLevel: 5,
    baseDamage: 18,
    baseCooldownMs: 2400,
  },
  {
    id: 'vamp_scythe',
    name: 'Soul Scythe',
    shortDesc: 'Boe­me­rang-zeis die door zwermen snijdt en HP herstelt.',
    evoName: "Reaper's Eclipse",
    evoPassive: 'blood_ruby',
    evoDesc: 'Reuzenzeisen die non-stop om je terugkeren met life-steal!',
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
    shortDesc: 'Verlaagt alle wapen-cooldowns.',
    perLevelLabel: '-8% Cooldown / lv',
    color: '#38bdf8',
    maxLevel: 5,
  },
  {
    id: 'eagle_optics',
    name: 'Eagle Optics',
    shortDesc: 'Verhoogt Crit-kans en Crit-schade.',
    perLevelLabel: '+6% Crit Kans / lv',
    color: '#22d3ee',
    maxLevel: 5,
  },
  {
    id: 'magnet_halo',
    name: 'Magnet Halo',
    shortDesc: 'Zuigt XP-kristallen & munten van verder weg op.',
    perLevelLabel: '+35% Magnet bereik / lv',
    color: '#f59e0b',
    maxLevel: 5,
  },
  {
    id: 'overclock_chip',
    name: 'Overclock Chip',
    shortDesc: 'Verhoogt alle aanvalsschade drastisch.',
    perLevelLabel: '+13% Schade / lv',
    color: '#a855f7',
    maxLevel: 5,
  },
  {
    id: 'cryo_reactor',
    name: 'Cryo Reactor',
    shortDesc: 'Verhoogt Max HP & pantser.',
    perLevelLabel: '+18% Max HP / lv',
    color: '#60a5fa',
    maxLevel: 5,
  },
  {
    id: 'fusion_cell',
    name: 'Fusion Cell',
    shortDesc: 'Voegt projectielen & bereik toe aan wapens.',
    perLevelLabel: '+15% Bereik & +Projectiel',
    color: '#fb7185',
    maxLevel: 5,
  },
  {
    id: 'dark_matter',
    name: 'Dark Matter Thruster',
    shortDesc: 'Hogere bewegingssnelheid & snellere Dash.',
    perLevelLabel: '+9% Snelheid / lv',
    color: '#c084fc',
    maxLevel: 5,
  },
  {
    id: 'blood_ruby',
    name: 'Blood Ruby',
    shortDesc: 'Passieve HP-regeneratie & extra Gold/XP.',
    perLevelLabel: '+1.5 HP/s & +10% Greed / lv',
    color: '#ef4444',
    maxLevel: 5,
  },
];

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    name: '01. Neon Outskirts',
    subtitle: 'Buitenwijken vol verkennersdrones & Loot Goblins',
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
    subtitle: 'Woestijnraffinaderij met gepantserde Sentinels',
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
    subtitle: 'Bevroren serverbasis met snelle Stalkers',
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
    subtitle: 'Vulkaanreactor vol spugende plasma-wezens',
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
    subtitle: 'Paarse hyperruimte met splitsende anomalieën',
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
    subtitle: 'Megastad onder beleg van elite-drones',
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
    subtitle: 'Eindeloze golven — strijd om wereldwijde #1 highscores!',
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
];

export const TALENTS: TalentNodeDef[] = [
  {
    id: 'might',
    name: 'Hyper Kracht',
    desc: '+6 Aanvalsschade per niveau',
    icon: '⚔️',
    maxLevel: 30,
    baseCostCoins: 250,
    costStepCoins: 190,
    statKey: 'atkFlat',
    perLevelValue: 6,
  },
  {
    id: 'vitality',
    name: 'Nano Pantsering HP',
    desc: '+35 Max HP per niveau',
    icon: '❤️',
    maxLevel: 30,
    baseCostCoins: 220,
    costStepCoins: 170,
    statKey: 'hpFlat',
    perLevelValue: 35,
  },
  {
    id: 'armor',
    name: 'Titanium Schild',
    desc: '-2 inkomende schade per niveau',
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
    desc: '+8% extra Gold uit runs & patrol',
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
    desc: '+10% XP- & coin-oppakradius',
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
    desc: '+3% loopsnelheid per niveau',
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
    desc: '+2% Crit-kans per niveau',
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
    desc: '-2% wapen-cooldown per niveau',
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
    desc: '+7% XP-winst tijdens gevechten',
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
    desc: '+1 gratis revive per run (max 1)',
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
  { templateId: 'wp_katana', slot: 'weapon', name: 'Plasma Katana', baseAtk: 24, baseHp: 0, perkText: '+10% Crit Schade' },
  { templateId: 'wp_voidcannon', slot: 'weapon', name: 'Void Blaster', baseAtk: 28, baseHp: 0, perkText: '+8% Projectielkracht' },
  { templateId: 'ar_aegis', slot: 'armor', name: 'Aegis Exo-Suit', baseAtk: 0, baseHp: 140, perkText: '-4 Schade ontvangen' },
  { templateId: 'ar_stealth', slot: 'armor', name: 'Phantom Rig', baseAtk: 6, baseHp: 115, perkText: '+5% Dodge / Speed' },
  { templateId: 'hm_visor', slot: 'helmet', name: 'Cyber Visor', baseAtk: 10, baseHp: 65, perkText: '+10% XP-bonus' },
  { templateId: 'hm_titan', slot: 'helmet', name: 'Titan Helm', baseAtk: 6, baseHp: 95, perkText: '+12% Max HP' },
  { templateId: 'bt_thruster', slot: 'boots', name: 'Nova Boots', baseAtk: 5, baseHp: 55, perkText: '+12% Bewegingssnelheid' },
  { templateId: 'bt_mag', slot: 'boots', name: 'Magnet Greaves', baseAtk: 4, baseHp: 60, perkText: '+20% Pickup Radius' },
  { templateId: 'rg_crit', slot: 'ring', name: 'Starfire Ring', baseAtk: 16, baseHp: 20, perkText: '+6% Crit Kans' },
  { templateId: 'rg_greed', slot: 'ring', name: 'Midas Coil', baseAtk: 12, baseHp: 25, perkText: '+15% Gold Drops' },
  { templateId: 'cr_quantum', slot: 'core', name: 'Quantum Core', baseAtk: 14, baseHp: 75, perkText: '-6% Wapen Cooldown' },
  { templateId: 'cr_phoenix', slot: 'core', name: 'Phoenix Heart', baseAtk: 10, baseHp: 105, perkText: '+2.5 HP/sec Regen' },
];

export const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Wapen',
  armor: 'Pantser',
  helmet: 'Helm',
  boots: 'Laarzen',
  ring: 'Ring',
  core: 'Kern',
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
  { id: 'dq_kills_200', title: 'Versla 200 vijanden', target: 200, field: 'killsToday', gems: 25, coins: 1200, passXp: 80 },
  { id: 'dq_runs_2', title: 'Speel 2 gevechten', target: 2, field: 'runsToday', gems: 20, coins: 1000, passXp: 70 },
  { id: 'dq_boss_1', title: 'Versla 1 Boss / Elite', target: 1, field: 'bossesToday', gems: 35, coins: 1800, passXp: 100 },
  { id: 'dq_upg_2', title: 'Upgrade gear of talent 2x', target: 2, field: 'upgradesToday', gems: 20, coins: 900, passXp: 70 },
  { id: 'dq_ad_1', title: 'Claim 1x Ad-beloning', target: 1, field: 'adsToday', gems: 30, coins: 1500, passXp: 80 },
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
  { id: 'ach_kill_500', title: 'Swarm Breaker', desc: 'Versla 500 vijanden in totaal', gems: 50, check: (s) => s.totalKills >= 500 },
  { id: 'ach_kill_2500', title: 'Neon Exterminator', desc: 'Versla 2.500 vijanden in totaal', gems: 120, cyberKeys: 1, check: (s) => s.totalKills >= 2500 },
  { id: 'ach_kill_10000', title: 'Galactic Reaper', desc: 'Versla 10.000 vijanden in totaal', gems: 300, cyberKeys: 2, check: (s) => s.totalKills >= 10000 },
  { id: 'ach_ch1', title: 'Eerste Overwinning', desc: 'Voltooi Chapter 1 (Neon Outskirts)', gems: 60, check: (s) => s.clearedCount >= 1 },
  { id: 'ach_ch3', title: 'Cryo Veroveraar', desc: 'Voltooi 3 Chapters', gems: 150, cyberKeys: 1, check: (s) => s.clearedCount >= 3 },
  { id: 'ach_ch6', title: 'Starforge Meester', desc: 'Voltooi alle 6 Story Chapters', gems: 450, cyberKeys: 3, check: (s) => s.clearedCount >= 6 },
  { id: 'ach_boss_10', title: 'Boss Hunter', desc: 'Versla 10 Bosses / Elites', gems: 100, check: (s) => s.totalBossesKilled >= 10 },
  { id: 'ach_endless_180', title: 'Void Overlever', desc: 'Overleef 3 minuten in Endless Void', gems: 140, check: (s) => s.bestEndlessSec >= 180 },
];

export const LOGIN_STREAK_REWARDS = [
  { day: 1, label: '1.000 Gold', coins: 1000, gems: 0, cyberKeys: 0 },
  { day: 2, label: '40 Gems', coins: 0, gems: 40, cyberKeys: 0 },
  { day: 3, label: '2.500 Gold', coins: 2500, gems: 0, cyberKeys: 0 },
  { day: 4, label: '1x Cyber Key', coins: 0, gems: 0, cyberKeys: 1 },
  { day: 5, label: '80 Gems', coins: 0, gems: 80, cyberKeys: 0 },
  { day: 6, label: '5.000 Gold', coins: 5000, gems: 0, cyberKeys: 0 },
  { day: 7, label: '200 Gems + Key', coins: 0, gems: 200, cyberKeys: 1 },
];
