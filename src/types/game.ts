export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type GearSlot = 'weapon' | 'armor' | 'helmet' | 'boots' | 'ring' | 'core';

export type WeaponId =
  | 'plasma_blade'
  | 'pulse_rifle'
  | 'orbital_saw'
  | 'tesla_arc'
  | 'frost_nova'
  | 'inferno_drone'
  | 'gravity_well'
  | 'vamp_scythe';

export type PassiveId =
  | 'chrono_core'
  | 'eagle_optics'
  | 'magnet_halo'
  | 'overclock_chip'
  | 'cryo_reactor'
  | 'fusion_cell'
  | 'dark_matter'
  | 'blood_ruby';

export type HeroId = 'kael' | 'nova' | 'titan' | 'vespera';

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
  unlockChapterReq?: number;
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
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  shortDesc: string;
  perLevelLabel: string;
  color: string;
  maxLevel: number;
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
  mode: 'chapter' | 'endless' | 'boss_rush';
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
}

export interface TalentNodeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
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
    | 'xpPct';
  perLevelValue: number;
}

export interface QuestProgress {
  killsToday: number;
  runsToday: number;
  bossesToday: number;
  upgradesToday: number;
  adsToday: number;
  claimedIds: string[];
}

export interface LeaderboardEntry {
  rank?: number;
  name: string;
  score: number;
  wave: number;
  heroId: HeroId;
  power: number;
  isPlayer?: boolean;
  date: string;
}

export interface ShopSkuDef {
  sku: string;
  productType: 'inapp' | 'subs';
  isConsumable: boolean;
  category: 'bundle' | 'gems' | 'vip' | 'pass';
  title: string;
  subtitle: string;
  badge?: string;
  fallbackPrice: string;
  priceEur: number;
  gems?: number;
  firstBuyBonusGems?: number;
  coins?: number;
  keys?: number;
  grantsNoAds?: boolean;
  grantsPass?: boolean;
  grantsVip?: boolean;
  grantsStarterGear?: boolean;
  oneTimeOnly?: boolean;
  highlightColor: string;
}

export interface PlayerSave {
  version: number;
  deviceId: string;
  playerName: string;
  accountLevel: number;
  accountXp: number;
  coins: number;
  gems: number;
  blueprints: number;
  basicKeys: number;
  cyberKeys: number;
  reviveTokens: number;
  rerollTokens: number;
  piggyGems: number;
  piggyMaxGems: number;
  pityCounter: number;

  selectedHero: HeroId;
  unlockedHeroes: HeroId[];
  heroLevels: Record<HeroId, number>;

  equipped: Record<GearSlot, string | null>;
  inventory: GearItem[];
  talents: Record<string, number>;

  highestChapterUnlocked: number;
  clearedChapters: number[];
  bestEndlessSec: number;
  bestEndlessKills: number;
  totalKills: number;
  totalRuns: number;
  totalBossesKilled: number;

  passXp: number;
  passPremiumUnlocked: boolean;
  passClaimedFree: number[];
  passClaimedPremium: number[];

  noAdsForever: boolean;
  vipExpiresAt: number;
  starterPackBought: boolean;
  purchasedSkusOneTime: string[];
  firstBuyUsedSkus: string[];

  lastLoginDay: string;
  loginStreak: number;
  loginClaimedToday: boolean;

  lastDailyDay: string;
  freeGiftClaimedToday: boolean;
  adGemsUsedToday: number;
  adKeysUsedToday: number;
  quests: QuestProgress;
  claimedAchievements: string[];

  lastPatrolCollectAt: number;
  lastInterstitialAt: number;

  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  damageNumbersEnabled: boolean;

  leaderboard: LeaderboardEntry[];
}

export interface CombatStats {
  maxHp: number;
  atk: number;
  armor: number;
  moveSpeed: number;
  critChance: number;
  critMult: number;
  cooldownMult: number;
  pickupRadius: number;
  goldMult: number;
  xpMult: number;
  hpRegenPerSec: number;
  revives: number;
  powerRating: number;
}

export interface RunSummary {
  chapterId: number;
  victory: boolean;
  survivedSec: number;
  kills: number;
  bossesKilled: number;
  coinsEarned: number;
  gemsEarned: number;
  blueprintsEarned: number;
  passXpEarned: number;
  accountXpEarned: number;
  levelReached: number;
  newGearDrop: GearItem | null;
  evolutionsUnlocked: string[];
  doubledByAd: boolean;
}
