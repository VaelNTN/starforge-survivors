export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type GearSlot = 'weapon' | 'armor' | 'helmet' | 'boots' | 'ring' | 'core';

export type WeaponStyle = 'signature' | 'sword' | 'staff' | 'bow';

export type WeaponId =
  | 'plasma_blade'
  | 'arcane_staff'
  | 'star_bow'
  | 'pulse_rifle'
  | 'orbital_saw'
  | 'tesla_arc'
  | 'frost_nova'
  | 'inferno_drone'
  | 'gravity_well'
  | 'vamp_scythe'
  | 'orbital_turret'
  | 'solar_lance';

export type PassiveId =
  | 'chrono_core'
  | 'eagle_optics'
  | 'magnet_halo'
  | 'overclock_chip'
  | 'cryo_reactor'
  | 'fusion_cell'
  | 'dark_matter'
  | 'blood_ruby';

export type HeroId = 'kael' | 'nova' | 'titan' | 'vespera' | 'aegis' | 'pyro';

export type RelicId =
  | 'plasma_mines'
  | 'chain_crit'
  | 'nova_burst'
  | 'vampiric_core'
  | 'overclock_shield'
  | 'mag_singularity'
  | 'frost_retaliation'
  | 'executioner_mark'
  | 'solar_afterburn'
  | 'quantum_accel';

export type AscensionTier = 1 | 2 | 3 | 4 | 5;

export type BossArchetype = 1 | 2 | 3 | 4 | 5 | 6;

export type LeaderboardMode = 'endless' | 'boss_rush' | 'daily';

export type DailyModifierId =
  | 'hyper_haste'
  | 'glass_cannon'
  | 'swarm_frenzy'
  | 'crit_storm'
  | 'titan_bosses'
  | 'low_gravity';

export interface DailyModifierDef {
  id: DailyModifierId;
  name: string;
  desc: string;
  color: string;
}

export interface DailyRunConfig {
  dateKey: string;
  seed: number;
  themeChapterId: number;
  modifiers: DailyModifierDef[];
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  description: string;
  startingWeapon: WeaponId;
  ultName: string;
  ultDesc: string;
  accentColor: string;
  secondaryColor: string;
  baseHp: number;
  baseAtk: number;
  baseSpeed: number;
  unlockCostGems: number;
  perkLabel: string;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  shortDesc: string;
  evoName: string;
  evoPassive: PassiveId;
  evoDesc: string;
  color: string;
  maxLevel: number;
  baseDamage: number;
  baseCooldownMs: number;
  isProjectile?: boolean;
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  shortDesc: string;
  perLevelLabel: string;
  color: string;
  maxLevel: number;
}

export interface RelicDef {
  id: RelicId;
  name: string;
  shortDesc: string;
  color: string;
}

export interface AscensionDef {
  tier: AscensionTier;
  roman: string;
  name: string;
  subtitle: string;
  enemyHpMult: number;
  enemyDmgMult: number;
  spawnMult: number;
  rewardMult: number;
  color: string;
}

export interface GearItem {
  uid: string;
  templateId: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  level: number;
  baseAtk: number;
  baseHp: number;
  perkText?: string;
}

export interface ChapterDef {
  id: number;
  name: string;
  subtitle: string;
  mode: 'chapter' | 'endless' | 'boss_rush' | 'daily';
  durationSec: number;
  recommendedPower: number;
  bgTop: string;
  bgBottom: string;
  gridColor: string;
  accentColor: string;
  enemyHpMult: number;
  enemyDmgMult: number;
  spawnRateMult: number;
  rewardCoins: number;
  rewardGems: number;
  bossName: string;
  bossArchetype: BossArchetype;
}

export interface TalentNodeDef {
  id: string;
  name: string;
  desc: string;
  iconKey: string;
  maxLevel: number;
  baseCostCoins: number;
  costStepCoins: number;
  statKey:
    | 'atkFlat'
    | 'hpFlat'
    | 'armor'
    | 'greedPct'
    | 'magnetPct'
    | 'speedPct'
    | 'critPct'
    | 'hastePct'
    | 'revives'
    | 'xpPct'
    | 'rerolls'
    | 'banishes';
  perLevelValue: number;
}

export interface QuestProgress {
  killsToday: number;
  runsToday: number;
  bossesToday: number;
  upgradesToday: number;
  objectivesToday: number;
  claimedIds: string[];
}

export interface LeaderboardEntry {
  rank?: number;
  deviceId?: string;
  playerName: string;
  mode: LeaderboardMode;
  score: number;
  wave: number;
  kills: number;
  heroId: HeroId;
  ascension: AscensionTier;
  isPlayer?: boolean;
  updatedAt?: string;
}

export interface PlayerSave {
  version: number;
  deviceId: string;
  playerName: string;
  accountLevel: number;
  accountXp: number;
  coins: number;
  gems: number; // Displayed as Star Shards
  blueprints: number;
  basicKeys: number;
  cyberKeys: number;
  reviveTokens: number;
  pityCounter: number;

  selectedHero: HeroId;
  selectedWeaponStyle: WeaponStyle;
  selectedAscension: AscensionTier;
  unlockedHeroes: HeroId[];
  heroLevels: Record<HeroId, number>;

  equipped: Record<GearSlot, string | null>;
  inventory: GearItem[];
  talents: Record<string, number>;

  highestChapterUnlocked: number;
  clearedChapters: number[];
  highestAscensionCleared: AscensionTier;
  bestEndlessSec: number;
  bestEndlessKills: number;
  bestBossRushSec: number;
  bossRushClears: number;
  bestDailyScore: number;
  dailyCompletedDate: string;
  totalKills: number;
  totalRuns: number;
  totalBossesKilled: number;
  totalShrinesClaimed: number;

  passXp: number;
  passClaimedTiers: number[];

  lastLoginDay: string;
  loginStreak: number;
  loginClaimedToday: boolean;

  lastDailyDay: string;
  freeGiftClaimedToday: boolean;
  wheelSpinsFreeUsedToday: number;
  quests: QuestProgress;
  claimedAchievements: string[];
  discoveredEvos: WeaponId[];
  claimedEvoCodex: WeaponId[];
  discoveredRelics: RelicId[];
  defeatedBosses: BossArchetype[];

  lastPatrolCollectAt: number;

  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  damageNumbersEnabled: boolean;

  // Hybrid Monetization & Retention State
  noAdsOwned: boolean;
  seasonPassOwned: boolean;
  vipActive: boolean;
  vipLastClaimDay: string;
  starterPackPurchased: boolean;
  firstPurchaseBonusClaimed: boolean;
  purchasedSkus: string[];
  passPremiumClaimedTiers: number[];
  adGemsUsedToday: number;
  adKeysUsedToday: number;
  lastInterstitialAt: number;
  sevenDayClaimedDays: number[];

  localLeaderboard: Record<LeaderboardMode, LeaderboardEntry[]>;
}

export interface ShopSkuDef {
  sku: string;
  productType: 'inapp' | 'subs';
  isConsumable: boolean;
  category: 'bundle' | 'vip' | 'pass' | 'gems';
  title: string;
  subtitle: string;
  badge: string;
  fallbackPrice: string;
  priceEur: number;
  gems?: number;
  coins?: number;
  keys?: number;
  firstTimeBonusGems?: number;
  grantsNoAds?: boolean;
  grantsPass?: boolean;
  grantsVip?: boolean;
  grantsStarterGear?: boolean;
  oneTimeOnly?: boolean;
  highlightColor: string;
}

export interface ActiveRunBoosters {
  extraWeapon: boolean;
  overdriveAtk: boolean;
  doubleLuck: boolean;
}

export interface CombatStats {
  maxHp: number;
  atk: number;
  armor: number;
  moveSpeed: number;
  critChance: number;
  critMult: number;
  cooldownMult: number;
  projPowerMult: number;
  dodgeChance: number;
  areaMult: number;
  pickupRadius: number;
  goldMult: number;
  xpMult: number;
  hpRegenPerSec: number;
  revives: number;
  rerolls: number;
  banishes: number;
  powerRating: number;
}

export interface WeaponDamageStat {
  id: string;
  label: string;
  color: string;
  totalDamage: number;
  dps: number;
  sharePct: number;
}

export interface RunSummary {
  chapterId: number;
  mode: ChapterDef['mode'];
  ascension: AscensionTier;
  dailyDateKey?: string;
  victory: boolean;
  survivedSec: number;
  kills: number;
  bossesKilled: number;
  shrinesClaimed: number;
  coinsEarned: number;
  gemsEarned: number;
  blueprintsEarned: number;
  passXpEarned: number;
  accountXpEarned: number;
  levelReached: number;
  newGearDrop: GearItem | null;
  evolutionsUnlocked: string[];
  evoIdsUnlocked: WeaponId[];
  relicsCollected: RelicId[];
  bossArchetypesDefeated: BossArchetype[];
  maxCombo: number;
  score: number;
  weaponBreakdown: WeaponDamageStat[];
}

export interface SavedRunSnapshot {
  version: number;
  savedAt: number;
  chapterId: number;
  ascension: AscensionTier;
  dailyDateKey?: string;
  heroId: HeroId;
  weaponStyle: WeaponStyle;
  boosters: ActiveRunBoosters;
  px: number;
  py: number;
  hp: number;
  shieldHp: number;
  level: number;
  xp: number;
  xpNext: number;
  elapsedSec: number;
  threatLevel: number;
  lastSurgeSec: number;
  kills: number;
  maxCombo: number;
  bossesKilled: number;
  shrinesClaimed: number;
  coinsEarned: number;
  gemsEarned: number;
  ultCharge: number;
  revivesLeft: number;
  rerollsLeft: number;
  banishesLeft: number;
  bossSpawned: boolean;
  bossRushStage: number;
  eliteSpawnedMin: number[];
  weapons: { id: WeaponId; lv: number; evolved: boolean }[];
  passives: { id: PassiveId; lv: number }[];
  relics: RelicId[];
  banishedIds: string[];
  evosUnlocked: string[];
  evoIdsUnlocked: WeaponId[];
  bossArchetypesDefeated: BossArchetype[];
  weaponDamage: Record<string, number>;
}
