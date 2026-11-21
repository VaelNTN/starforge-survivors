import { ShopSkuDef } from '../types/game';

/**
 * GOOGLE ADMOB CONFIGURATION — Starforge Survivors (Hybrid Monetization Edition)
 * Uses Google's official AdMob Test IDs by default so test/APK builds never risk
 * AdMob policy strikes. Before Google Play Production release, swap in your live
 * AdMob App ID (in android/app/src/main/res/values/strings.xml) and Unit IDs below.
 */
export const ADMOB_CONFIG = {
  testMode: true,
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  // Ethical frequency cap: never interrupt new players; max 1 post-run interstitial per 4 min
  interstitialMinCooldownMs: 240_000,
  skipInterstitialFirstRuns: 2,
  dailyAdGemsLimit: 5,
  dailyAdGemsAmount: 75,
  dailyAdKeysLimit: 3,
} as const;

/**
 * HIGH-CONVERTING GOOGLE PLAY BILLING PRODUCT CATALOG
 * Every `sku` matches a Product ID in Google Play Console:
 * Monetize -> Products -> In-app products / Subscriptions.
 */
export const SHOP_SKUS: ShopSkuDef[] = [
  {
    sku: 'starforge_starter_pack',
    productType: 'inapp',
    isConsumable: true,
    category: 'bundle',
    title: 'Commander Starter Pack',
    subtitle: '500 Star Shards • Epic Plasma Katana • 20,000 Gold • 2× Cyber Keys',
    badge: '600% VALUE • 1× ONLY',
    fallbackPrice: '€1.99',
    priceEur: 1.99,
    gems: 500,
    coins: 20000,
    keys: 2,
    grantsStarterGear: true,
    oneTimeOnly: true,
    highlightColor: '#f59e0b',
  },
  {
    sku: 'starforge_no_ads',
    productType: 'inapp',
    isConsumable: false,
    category: 'vip',
    title: 'No Ads + Permanent 2× Loot',
    subtitle: 'Zero ads forever • Instant FREE Revives & Rerolls • +100% Run Gold • 400 Shards',
    badge: 'MOST POPULAR',
    fallbackPrice: '€4.99',
    priceEur: 4.99,
    gems: 400,
    grantsNoAds: true,
    oneTimeOnly: true,
    highlightColor: '#10b981',
  },
  {
    sku: 'starforge_season_pass',
    productType: 'inapp',
    isConsumable: false,
    category: 'pass',
    title: 'Starforge Season Pass',
    subtitle: 'Unlock ALL 30 Premium Mastery Rewards (+2,800 Shards & Epic Crates) + 400 Shards',
    badge: 'BEST VALUE',
    fallbackPrice: '€6.99',
    priceEur: 6.99,
    gems: 400,
    grantsPass: true,
    oneTimeOnly: true,
    highlightColor: '#8b5cf6',
  },
  {
    sku: 'starforge_vip_monthly',
    productType: 'subs',
    isConsumable: false,
    category: 'vip',
    title: 'VIP Commander Club (30d)',
    subtitle: '100 Star Shards/day • +25% XP & Gold • Ad-Free Instant Revives • 300 Instant Shards',
    badge: 'VIP CLUB',
    fallbackPrice: '€4.99/mo',
    priceEur: 4.99,
    gems: 300,
    grantsVip: true,
    grantsNoAds: true,
    highlightColor: '#ec4899',
  },
  {
    sku: 'starforge_gems_small',
    productType: 'inapp',
    isConsumable: true,
    category: 'gems',
    title: 'Star Shard Pouch',
    subtitle: '500 Star Shards (+100 First-Time Bonus)',
    badge: '+20% BONUS',
    fallbackPrice: '€2.99',
    priceEur: 2.99,
    gems: 500,
    firstTimeBonusGems: 100,
    highlightColor: '#38bdf8',
  },
  {
    sku: 'starforge_gems_medium',
    productType: 'inapp',
    isConsumable: true,
    category: 'gems',
    title: 'Star Shard Vault',
    subtitle: '2,000 Star Shards (+500 First-Time Bonus)',
    badge: 'POPULAR',
    fallbackPrice: '€9.99',
    priceEur: 9.99,
    gems: 2000,
    firstTimeBonusGems: 500,
    highlightColor: '#6366f1',
  },
  {
    sku: 'starforge_gems_mega',
    productType: 'inapp',
    isConsumable: true,
    category: 'gems',
    title: 'Nova Treasury',
    subtitle: '5,000 Star Shards (+1,500 First-Time Bonus)',
    badge: 'MEGA VALUE',
    fallbackPrice: '€19.99',
    priceEur: 19.99,
    gems: 5000,
    firstTimeBonusGems: 1500,
    highlightColor: '#f43f5e',
  },
];

export interface SevenDayRewardDef {
  day: number;
  label: string;
  coins?: number;
  gems?: number;
  cyberKeys?: number;
  epicGear?: boolean;
  legendaryGear?: boolean;
}

export const SEVEN_DAY_LOGIN_REWARDS: SevenDayRewardDef[] = [
  { day: 1, label: '2.5K Gold + 100 Shards', coins: 2500, gems: 100 },
  { day: 2, label: '2× Cyber Keys', cyberKeys: 2 },
  { day: 3, label: '5K Gold + 150 Shards', coins: 5000, gems: 150 },
  { day: 4, label: 'Guaranteed Epic Gear', epicGear: true, gems: 100 },
  { day: 5, label: '300 Star Shards', gems: 300 },
  { day: 6, label: '3× Cyber Keys + 10K Gold', cyberKeys: 3, coins: 10000 },
  { day: 7, label: '500 Shards + Legendary Gear', gems: 500, legendaryGear: true },
];
