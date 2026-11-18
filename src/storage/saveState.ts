import {
  CRATE_COSTS,
  SHOP_SKUS,
} from '../config/monetization';
import {
  GEAR_TEMPLATES,
  HEROES,
  RARITY_META,
  RARITY_ORDER,
  TALENTS,
  WHEEL_REWARDS,
  WheelSliceDef,
} from '../data/gameCatalog';
import {
  CombatStats,
  GearItem,
  GearSlot,
  LeaderboardEntry,
  PlayerSave,
  Rarity,
  RunSummary,
} from '../types/game';

const STORAGE_KEY = 'starforge_survivors_save_v1';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeUid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createGearItem(templateId: string, rarity: Rarity, level = 1): GearItem {
  const tpl = GEAR_TEMPLATES.find((t) => t.templateId === templateId) || GEAR_TEMPLATES[0];
  return {
    uid: makeUid('gear'),
    templateId: tpl.templateId,
    name: tpl.name,
    slot: tpl.slot,
    rarity,
    level,
    baseAtk: tpl.baseAtk,
    baseHp: tpl.baseHp,
    perkText: tpl.perkText,
  };
}

export function getGearStats(item: GearItem): { atk: number; hp: number } {
  const rMult = RARITY_META[item.rarity].mult;
  const lvMult = 1 + (item.level - 1) * 0.14;
  return {
    atk: Math.round(item.baseAtk * rMult * lvMult),
    hp: Math.round(item.baseHp * rMult * lvMult),
  };
}

function initialLeaderboard(): LeaderboardEntry[] {
  return [
    { name: 'CyberKuro', score: 14800, wave: 420, heroId: 'vespera', power: 2450, date: '2026-11-16' },
    { name: 'NovaPrime', score: 11200, wave: 345, heroId: 'nova', power: 1840, date: '2026-11-16' },
    { name: 'VaelCommander', score: 8650, wave: 285, heroId: 'titan', power: 1320, date: '2026-11-16' },
    { name: 'NeonPulseNL', score: 5400, wave: 210, heroId: 'kael', power: 890, date: '2026-11-16' },
    { name: 'StarDrifter', score: 2950, wave: 140, heroId: 'kael', power: 460, date: '2026-11-16' },
  ];
}

export function createDefaultSave(): PlayerSave {
  const starterWeapon = createGearItem('wp_katana', 'common', 1);
  const starterArmor = createGearItem('ar_aegis', 'common', 1);
  const starterBoots = createGearItem('bt_thruster', 'common', 1);
  const day = todayStr();

  return {
    version: 1,
    deviceId: makeUid('dev'),
    playerName: 'Commander',
    accountLevel: 1,
    accountXp: 0,
    coins: 1200,
    gems: 100,
    blueprints: 12,
    basicKeys: 1,
    cyberKeys: 0,
    reviveTokens: 1,
    rerollTokens: 2,
    piggyGems: 120,
    piggyMaxGems: 1500,
    pityCounter: 0,

    selectedHero: 'kael',
    selectedWeaponStyle: 'sword',
    unlockedHeroes: ['kael'],
    heroLevels: { kael: 1, nova: 1, titan: 1, vespera: 1 },

    equipped: {
      weapon: starterWeapon.uid,
      armor: starterArmor.uid,
      helmet: null,
      boots: starterBoots.uid,
      ring: null,
      core: null,
    },
    inventory: [starterWeapon, starterArmor, starterBoots],
    talents: {},

    highestChapterUnlocked: 1,
    clearedChapters: [],
    bestEndlessSec: 0,
    bestEndlessKills: 0,
    totalKills: 0,
    totalRuns: 0,
    totalBossesKilled: 0,

    passXp: 0,
    passPremiumUnlocked: false,
    passClaimedFree: [],
    passClaimedPremium: [],

    noAdsForever: false,
    vipExpiresAt: 0,
    starterPackBought: false,
    purchasedSkusOneTime: [],
    firstBuyUsedSkus: [],

    lastLoginDay: day,
    loginStreak: 1,
    loginClaimedToday: false,

    lastDailyDay: day,
    freeGiftClaimedToday: false,
    adGemsUsedToday: 0,
    adKeysUsedToday: 0,
    wheelSpinsFreeUsedToday: 0,
    wheelSpinsAdUsedToday: 0,
    pendingVipDailyGems: 0,
    quests: {
      killsToday: 0,
      runsToday: 0,
      bossesToday: 0,
      upgradesToday: 0,
      adsToday: 0,
      claimedIds: [],
    },
    claimedAchievements: [],
    discoveredEvos: [],
    claimedEvoCodex: [],
    bestBossRushSec: 0,
    bossRushClears: 0,

    lastPatrolCollectAt: Date.now(),
    lastInterstitialAt: 0,

    soundEnabled: true,
    musicEnabled: true,
    vibrationEnabled: true,
    damageNumbersEnabled: true,

    leaderboard: initialLeaderboard(),
  };
}

function safeNum(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback;
}

export function loadSave(): PlayerSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createDefaultSave();
      saveGame(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerSave>;
    const base = createDefaultSave();
    const rawInv = Array.isArray(parsed.inventory) && parsed.inventory.length > 0 ? parsed.inventory : base.inventory;
    const cleanInv = rawInv.filter(
      (g): g is GearItem =>
        Boolean(g && typeof g.uid === 'string' && typeof g.templateId === 'string' && g.rarity in RARITY_META)
    ).map((g) => ({
      ...g,
      level: Math.max(1, Math.min(RARITY_META[g.rarity].maxLv, Math.floor(safeNum(g.level, 1, 1)))),
    }));
    const inv = cleanInv.length > 0 ? cleanInv : base.inventory;
    const invUids = new Set(inv.map((g) => g.uid));
    const rawEquipped = { ...base.equipped, ...(parsed.equipped || {}) };
    for (const sl of Object.keys(rawEquipped) as GearSlot[]) {
      const uid = rawEquipped[sl];
      if (uid && !invUids.has(uid)) {
        rawEquipped[sl] = null;
      }
    }

    const merged: PlayerSave = {
      ...base,
      ...parsed,
      accountLevel: Math.floor(safeNum(parsed.accountLevel, base.accountLevel, 1)),
      accountXp: safeNum(parsed.accountXp, base.accountXp, 0),
      coins: Math.floor(safeNum(parsed.coins, base.coins, 0)),
      gems: Math.floor(safeNum(parsed.gems, base.gems, 0)),
      blueprints: Math.floor(safeNum(parsed.blueprints, base.blueprints, 0)),
      basicKeys: Math.floor(safeNum(parsed.basicKeys, base.basicKeys, 0)),
      cyberKeys: Math.floor(safeNum(parsed.cyberKeys, base.cyberKeys, 0)),
      reviveTokens: Math.floor(safeNum(parsed.reviveTokens, base.reviveTokens, 0)),
      rerollTokens: Math.floor(safeNum(parsed.rerollTokens, base.rerollTokens, 0)),
      piggyGems: Math.floor(safeNum(parsed.piggyGems, base.piggyGems, 0)),
      highestChapterUnlocked: Math.min(6, Math.max(1, Math.floor(safeNum(parsed.highestChapterUnlocked, 1, 1)))),
      selectedHero: HEROES.some((h) => h.id === parsed.selectedHero) ? parsed.selectedHero! : base.selectedHero,
      selectedWeaponStyle:
        parsed.selectedWeaponStyle === 'staff' || parsed.selectedWeaponStyle === 'bow'
          ? parsed.selectedWeaponStyle
          : 'sword',
      heroLevels: { ...base.heroLevels, ...(parsed.heroLevels || {}) },
      equipped: rawEquipped,
      talents: { ...(parsed.talents || {}) },
      quests: { ...base.quests, ...(parsed.quests || {}) },
      discoveredEvos: Array.isArray(parsed.discoveredEvos) ? parsed.discoveredEvos : [],
      claimedEvoCodex: Array.isArray(parsed.claimedEvoCodex) ? parsed.claimedEvoCodex : [],
      inventory: inv,
      leaderboard: Array.isArray(parsed.leaderboard) && parsed.leaderboard.length > 0 ? parsed.leaderboard : base.leaderboard,
    };
    return ensureDailyState(merged);
  } catch {
    return createDefaultSave();
  }
}

export function saveGame(save: PlayerSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function ensureDailyState(save: PlayerSave): PlayerSave {
  const today = todayStr();
  if (save.lastDailyDay !== today) {
    save.lastDailyDay = today;
    save.freeGiftClaimedToday = false;
    save.adGemsUsedToday = 0;
    save.adKeysUsedToday = 0;
    save.wheelSpinsFreeUsedToday = 0;
    save.wheelSpinsAdUsedToday = 0;
    save.quests = {
      killsToday: 0,
      runsToday: 0,
      bossesToday: 0,
      upgradesToday: 0,
      adsToday: 0,
      claimedIds: [],
    };
  }
  if (save.lastLoginDay !== today) {
    const prev = new Date(`${save.lastLoginDay}T00:00:00`);
    const curr = new Date(`${today}T00:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    save.loginStreak = diffDays === 1 ? ((save.loginStreak % 7) + 1) : 1;
    save.lastLoginDay = today;
    save.loginClaimedToday = false;
    // VIP daily bonus auto-credit
    if (save.vipExpiresAt > Date.now()) {
      save.gems += 80;
      save.pendingVipDailyGems = (save.pendingVipDailyGems || 0) + 80;
    }
  }
  return save;
}

export function isVipActive(save: PlayerSave): boolean {
  return save.vipExpiresAt > Date.now();
}

export function computePlayerStats(save: PlayerSave): CombatStats {
  const hero = HEROES.find((h) => h.id === save.selectedHero) || HEROES[0];
  const heroLv = save.heroLevels[hero.id] || 1;

  let maxHp = hero.baseHp + (heroLv - 1) * 24 + (save.accountLevel - 1) * 14;
  let atk = hero.baseAtk + (heroLv - 1) * 4 + (save.accountLevel - 1) * 2;
  let armor = 0;
  let moveSpeed = hero.baseSpeed;
  let critChance = hero.id === 'kael' ? 0.17 : 0.05;
  let critMult = 1.75;
  let cooldownReduction = hero.id === 'nova' ? 0.15 : 0;
  let pickupRadius = 78;
  let goldMult = 1.0 + (save.noAdsForever ? 0.2 : 0) + (isVipActive(save) ? 0.25 : 0);
  let xpMult = 1.0 + (isVipActive(save) ? 0.25 : 0);
  let hpRegenPerSec = 0.6;
  let revives = 0;

  if (hero.id === 'titan') {
    maxHp *= 1.35;
    armor += 5;
  } else if (hero.id === 'vespera') {
    atk *= 1.2;
  }

  // Talents
  for (const t of TALENTS) {
    const lv = save.talents[t.id] || 0;
    if (lv <= 0) continue;
    const val = lv * t.perLevelValue;
    switch (t.statKey) {
      case 'atkFlat':
        atk += val;
        break;
      case 'hpFlat':
        maxHp += val;
        break;
      case 'armor':
        armor += val;
        break;
      case 'greedPct':
        goldMult += val / 100;
        break;
      case 'magnetPct':
        pickupRadius *= 1 + val / 100;
        break;
      case 'speedPct':
        moveSpeed *= 1 + val / 100;
        break;
      case 'critPct':
        critChance += val / 100;
        break;
      case 'hastePct':
        cooldownReduction += val / 100;
        break;
      case 'xpPct':
        xpMult += val / 100;
        break;
      case 'revives':
        revives += val;
        break;
    }
  }

  // Equipped gear
  const slots: GearSlot[] = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'core'];
  for (const sl of slots) {
    const uid = save.equipped[sl];
    if (!uid) continue;
    const item = save.inventory.find((g) => g.uid === uid);
    if (!item) continue;
    const gs = getGearStats(item);
    atk += gs.atk;
    maxHp += gs.hp;

    if (item.templateId === 'wp_katana') critMult += 0.15;
    if (item.templateId === 'ar_aegis') armor += 4;
    if (item.templateId === 'ar_stealth') moveSpeed *= 1.05;
    if (item.templateId === 'hm_visor') xpMult += 0.1;
    if (item.templateId === 'hm_titan') maxHp *= 1.12;
    if (item.templateId === 'bt_thruster') moveSpeed *= 1.12;
    if (item.templateId === 'bt_mag') pickupRadius *= 1.2;
    if (item.templateId === 'rg_crit') critChance += 0.06;
    if (item.templateId === 'rg_greed') goldMult += 0.15;
    if (item.templateId === 'cr_quantum') cooldownReduction += 0.06;
    if (item.templateId === 'cr_phoenix') hpRegenPerSec += 2.5;
  }

  if (isVipActive(save)) {
    pickupRadius *= 1.25;
  }

  const finalMaxHp = Math.round(maxHp);
  const finalAtk = Math.round(atk);
  const cooldownMult = Math.max(0.45, 1 - cooldownReduction);
  const powerRating = Math.round(
    finalAtk * 3.1 +
      finalMaxHp * 0.25 +
      armor * 8 +
      critChance * 420 +
      (1 / cooldownMult - 1) * 280
  );

  return {
    maxHp: finalMaxHp,
    atk: finalAtk,
    armor: Math.round(armor),
    moveSpeed: Math.round(moveSpeed),
    critChance: Math.min(0.75, critChance),
    critMult,
    cooldownMult,
    pickupRadius: Math.round(pickupRadius),
    goldMult,
    xpMult,
    hpRegenPerSec,
    revives,
    powerRating,
  };
}

export function getGearUpgradeCost(item: GearItem): { coins: number; blueprints: number } {
  const lv = item.level;
  return {
    coins: Math.round(140 + lv * lv * 18 + lv * 85),
    blueprints: Math.max(1, Math.floor(1 + lv * 0.65)),
  };
}

export function upgradeGearItem(save: PlayerSave, uid: string): boolean {
  const item = save.inventory.find((g) => g.uid === uid);
  if (!item) return false;
  const maxLv = RARITY_META[item.rarity].maxLv;
  if (item.level >= maxLv) return false;
  const cost = getGearUpgradeCost(item);
  if (save.coins < cost.coins || save.blueprints < cost.blueprints) return false;
  save.coins -= cost.coins;
  save.blueprints -= cost.blueprints;
  item.level += 1;
  save.quests.upgradesToday += 1;
  saveGame(save);
  return true;
}

export function findMergeCandidates(save: PlayerSave, uid: string): GearItem[] {
  const target = save.inventory.find((g) => g.uid === uid);
  if (!target) return [];
  const nextIdx = RARITY_ORDER.indexOf(target.rarity) + 1;
  if (nextIdx <= 0 || nextIdx >= RARITY_ORDER.length) return [];

  return save.inventory.filter(
    (g) => g.templateId === target.templateId && g.rarity === target.rarity
  );
}

export function mergeGearTriplet(save: PlayerSave, uid: string): GearItem | null {
  const target = save.inventory.find((g) => g.uid === uid);
  if (!target) return null;
  const nextIdx = RARITY_ORDER.indexOf(target.rarity) + 1;
  if (nextIdx <= 0 || nextIdx >= RARITY_ORDER.length) return null;

  const group = findMergeCandidates(save, uid);
  if (group.length < 3) return null;

  // Keep highest level / equipped item as primary, sacrifice 2 others
  const sorted = [...group].sort((a, b) => {
    const aEq = save.equipped[a.slot] === a.uid ? 1 : 0;
    const bEq = save.equipped[b.slot] === b.uid ? 1 : 0;
    return bEq - aEq || b.level - a.level;
  });
  const keep = sorted[0];
  const sacrificeUids = new Set([sorted[1].uid, sorted[2].uid]);

  const maxLv = Math.max(keep.level, sorted[1].level, sorted[2].level);
  keep.rarity = RARITY_ORDER[nextIdx];
  keep.level = maxLv;

  save.inventory = save.inventory.filter((g) => !sacrificeUids.has(g.uid));
  for (const sl of Object.keys(save.equipped) as GearSlot[]) {
    if (save.equipped[sl] && sacrificeUids.has(save.equipped[sl]!)) {
      save.equipped[sl] = keep.uid;
    }
  }
  saveGame(save);
  return keep;
}

export function autoMergeAllGear(save: PlayerSave): number {
  let merges = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...save.inventory]) {
      if (mergeGearTriplet(save, item.uid)) {
        merges += 1;
        changed = true;
        break;
      }
    }
  }
  return merges;
}

export function getGearPower(item: GearItem): number {
  const s = getGearStats(item);
  return Math.round(s.atk * 3.1 + s.hp * 0.25);
}

export function getSalvageYield(item: GearItem): { coins: number; blueprints: number } {
  const rIdx = Math.max(0, RARITY_ORDER.indexOf(item.rarity));
  const mult = Math.pow(2.1, rIdx);
  return {
    coins: Math.round((160 + (item.level - 1) * 90) * mult),
    blueprints: Math.max(1, Math.round((1 + Math.floor(item.level * 0.4)) * mult)),
  };
}

export function salvageGearItem(save: PlayerSave, uid: string): { coins: number; blueprints: number } | null {
  const isEquipped = Object.values(save.equipped).includes(uid);
  if (isEquipped) return null;
  const idx = save.inventory.findIndex((g) => g.uid === uid);
  if (idx < 0) return null;
  const item = save.inventory[idx];
  const payout = getSalvageYield(item);
  save.inventory.splice(idx, 1);
  save.coins += payout.coins;
  save.blueprints += payout.blueprints;
  saveGame(save);
  return payout;
}

export function salvageAllCommonGear(save: PlayerSave): { count: number; coins: number; blueprints: number } {
  const eqSet = new Set(Object.values(save.equipped).filter(Boolean));
  let count = 0;
  let coins = 0;
  let blueprints = 0;
  const kept: GearItem[] = [];
  for (const item of save.inventory) {
    if (!eqSet.has(item.uid) && item.rarity === 'common') {
      const y = getSalvageYield(item);
      coins += y.coins;
      blueprints += y.blueprints;
      count += 1;
    } else {
      kept.push(item);
    }
  }
  if (count > 0) {
    save.inventory = kept;
    save.coins += coins;
    save.blueprints += blueprints;
    saveGame(save);
  }
  return { count, coins, blueprints };
}

export function rollWheelReward(save: PlayerSave): { slice: WheelSliceDef; index: number } {
  const totalWeight = WHEEL_REWARDS.reduce((acc, s) => acc + s.weight, 0);
  let r = Math.random() * totalWeight;
  let pickedIdx = 0;
  for (let i = 0; i < WHEEL_REWARDS.length; i++) {
    r -= WHEEL_REWARDS[i].weight;
    if (r <= 0) {
      pickedIdx = i;
      break;
    }
  }
  const slice = WHEEL_REWARDS[pickedIdx];
  save.coins += slice.coins || 0;
  save.gems += slice.gems || 0;
  save.blueprints += slice.blueprints || 0;
  save.cyberKeys += slice.cyberKeys || 0;
  save.reviveTokens += slice.reviveTokens || 0;
  saveGame(save);
  return { slice, index: pickedIdx };
}

export function rollCrateDrop(crateType: 'basic' | 'cyber' | 'mythic', save: PlayerSave): GearItem {
  const tpl = GEAR_TEMPLATES[Math.floor(Math.random() * GEAR_TEMPLATES.length)];
  const r = Math.random();
  let rarity: Rarity = 'common';

  if (crateType === 'basic') {
    if (r < 0.04) rarity = 'rare';
    else if (r < 0.28) rarity = 'uncommon';
    else rarity = 'common';
  } else if (crateType === 'cyber') {
    save.pityCounter += 1;
    if (save.pityCounter >= 10) {
      rarity = 'epic';
      save.pityCounter = 0;
    } else if (r < 0.025) {
      rarity = 'legendary';
      save.pityCounter = 0;
    } else if (r < 0.14) {
      rarity = 'epic';
      save.pityCounter = 0;
    } else if (r < 0.52) {
      rarity = 'rare';
    } else {
      rarity = 'uncommon';
    }
  } else {
    // Mythic Vault
    if (r < 0.05) rarity = 'mythic';
    else if (r < 0.25) rarity = 'legendary';
    else rarity = 'epic';
  }

  const drop = createGearItem(tpl.templateId, rarity, 1);
  save.inventory.unshift(drop);
  // Auto-equip if slot is empty or strictly stronger than currently equipped item
  const curUid = save.equipped[drop.slot];
  if (!curUid) {
    save.equipped[drop.slot] = drop.uid;
  } else {
    const cur = save.inventory.find((g) => g.uid === curUid);
    if (cur) {
      const sNew = getGearStats(drop);
      const sCur = getGearStats(cur);
      if (sNew.atk + sNew.hp * 0.25 > sCur.atk + sCur.hp * 0.25) {
        save.equipped[drop.slot] = drop.uid;
      }
    }
  }
  return drop;
}

export function openCrate(
  save: PlayerSave,
  crateType: 'basic' | 'cyber' | 'mythic',
  count: 1 | 10,
  useKeys: boolean
): GearItem[] | null {
  if (crateType === 'basic') {
    if (useKeys) {
      if (save.basicKeys < count) return null;
      save.basicKeys -= count;
    } else {
      const cost = CRATE_COSTS.basicCoins * count;
      if (save.coins < cost) return null;
      save.coins -= cost;
    }
  } else if (crateType === 'cyber') {
    if (useKeys) {
      if (save.cyberKeys < count) return null;
      save.cyberKeys -= count;
    } else {
      const cost = count === 10 ? CRATE_COSTS.cyberTenGems : CRATE_COSTS.cyberGems;
      if (save.gems < cost) return null;
      save.gems -= cost;
    }
  } else {
    const cost = CRATE_COSTS.mythicGems * count;
    if (save.gems < cost) return null;
    save.gems -= cost;
  }

  const drops: GearItem[] = [];
  for (let i = 0; i < count; i++) {
    drops.push(rollCrateDrop(crateType, save));
  }
  saveGame(save);
  return drops;
}

export function computePatrolEarnings(save: PlayerSave): {
  minutes: number;
  coins: number;
  blueprints: number;
} {
  const elapsedMin = Math.max(0, Math.min(720, Math.floor((Date.now() - save.lastPatrolCollectAt) / 60_000)));
  const chapterFactor = 1 + (save.highestChapterUnlocked - 1) * 0.45;
  const stats = computePlayerStats(save);
  const coins = Math.floor(elapsedMin * 24 * chapterFactor * stats.goldMult);
  const blueprints = Math.floor(elapsedMin / 25);
  return { minutes: elapsedMin, coins, blueprints };
}

export function collectPatrolEarnings(save: PlayerSave, mult = 1): { coins: number; blueprints: number } {
  const p = computePatrolEarnings(save);
  const coins = p.coins * mult;
  const blueprints = p.blueprints * mult;
  save.coins += coins;
  save.blueprints += blueprints;
  save.lastPatrolCollectAt = Date.now();
  saveGame(save);
  return { coins, blueprints };
}

export function applyRunOutcome(save: PlayerSave, summary: RunSummary): void {
  save.coins += summary.coinsEarned;
  save.gems += summary.gemsEarned;
  save.blueprints += summary.blueprintsEarned;
  save.passXp += summary.passXpEarned;
  save.accountXp += summary.accountXpEarned;

  while (save.accountXp >= save.accountLevel * 120) {
    save.accountXp -= save.accountLevel * 120;
    save.accountLevel += 1;
    save.gems += 15;
  }

  // Record newly discovered weapon evolutions for Codex
  for (const wId of summary.evoIdsUnlocked || []) {
    if (!save.discoveredEvos.includes(wId)) {
      save.discoveredEvos.push(wId);
    }
  }

  // Fill Piggy Bank up to cap from monster kills
  const piggyAdd = Math.min(save.piggyMaxGems - save.piggyGems, Math.max(10, Math.floor(summary.kills / 12)));
  save.piggyGems += piggyAdd;

  save.totalKills += summary.kills;
  save.totalRuns += 1;
  save.totalBossesKilled += summary.bossesKilled;
  save.quests.killsToday += summary.kills;
  save.quests.runsToday += 1;
  save.quests.bossesToday += summary.bossesKilled;

  if (summary.chapterId === 99) {
    if (summary.survivedSec > save.bestEndlessSec) save.bestEndlessSec = summary.survivedSec;
    if (summary.kills > save.bestEndlessKills) save.bestEndlessKills = summary.kills;

    const score = summary.survivedSec * 25 + summary.kills * 4 + summary.bossesKilled * 250;
    const stats = computePlayerStats(save);
    const existingIdx = save.leaderboard.findIndex((e) => e.isPlayer);
    const entry: LeaderboardEntry = {
      name: save.playerName,
      score,
      wave: summary.survivedSec,
      heroId: save.selectedHero,
      power: stats.powerRating,
      isPlayer: true,
      date: todayStr(),
    };
    if (existingIdx >= 0) {
      if (score > save.leaderboard[existingIdx].score) {
        save.leaderboard[existingIdx] = entry;
      }
    } else {
      save.leaderboard.push(entry);
    }
    save.leaderboard.sort((a, b) => b.score - a.score);
    save.leaderboard = save.leaderboard.slice(0, 20);
  } else if (summary.chapterId === 88) {
    if (summary.victory) {
      save.bossRushClears = (save.bossRushClears || 0) + 1;
      if (save.bestBossRushSec === 0 || summary.survivedSec < save.bestBossRushSec) {
        save.bestBossRushSec = summary.survivedSec;
      }
    }
  } else if (summary.victory) {
    if (!save.clearedChapters.includes(summary.chapterId)) {
      save.clearedChapters.push(summary.chapterId);
    }
    if (summary.chapterId >= save.highestChapterUnlocked && summary.chapterId < 6) {
      save.highestChapterUnlocked = summary.chapterId + 1;
    }
  }

  if (summary.newGearDrop) {
    save.inventory.unshift(summary.newGearDrop);
    if (!save.equipped[summary.newGearDrop.slot]) {
      save.equipped[summary.newGearDrop.slot] = summary.newGearDrop.uid;
    }
  }

  saveGame(save);
}

export function applyPurchaseReward(
  save: PlayerSave,
  sku: string
): { summaryText: string; gemsAdded: number; coinsAdded: number } {
  const def = SHOP_SKUS.find((s) => s.sku === sku);
  if (!def) return { summaryText: 'Unknown product', gemsAdded: 0, coinsAdded: 0 };

  let gemsAdded = 0;
  let coinsAdded = 0;

  if (sku === 'starforge_piggy_bank') {
    const payout = Math.max(300, save.piggyGems);
    gemsAdded = payout;
    save.gems += payout;
    save.piggyGems = 0;
  } else {
    gemsAdded = def.gems || 0;
    if (def.firstBuyBonusGems && !save.firstBuyUsedSkus.includes(sku)) {
      gemsAdded += def.firstBuyBonusGems;
      save.firstBuyUsedSkus.push(sku);
    }
    save.gems += gemsAdded;
  }

  if (def.coins) {
    coinsAdded = def.coins;
    save.coins += def.coins;
  }
  if (def.keys) {
    save.cyberKeys += def.keys;
  }
  if (def.grantsNoAds) {
    save.noAdsForever = true;
  }
  if (def.grantsPass) {
    save.passPremiumUnlocked = true;
  }
  if (def.grantsVip) {
    const base = Math.max(Date.now(), save.vipExpiresAt || 0);
    save.vipExpiresAt = base + 30 * 86_400_000;
  }
  if (def.grantsStarterGear) {
    save.starterPackBought = true;
    const epicKatana = createGearItem('wp_katana', 'epic', 10);
    save.inventory.unshift(epicKatana);
    save.equipped.weapon = epicKatana.uid;
  }
  if (def.oneTimeOnly && !save.purchasedSkusOneTime.includes(sku)) {
    save.purchasedSkusOneTime.push(sku);
  }

  saveGame(save);

  const parts: string[] = [];
  if (gemsAdded > 0) parts.push(`+${gemsAdded} Gems`);
  if (coinsAdded > 0) parts.push(`+${coinsAdded.toLocaleString('en-US')} Gold`);
  if (def.keys) parts.push(`+${def.keys}x Cyber Key`);
  if (def.grantsNoAds) parts.push('No Ads Active');
  if (def.grantsPass) parts.push('Season Pass Unlocked');
  if (def.grantsVip) parts.push('VIP Club 30 Days');
  if (def.grantsStarterGear) parts.push('Epic Plasma Katana');
  return { summaryText: parts.join(' • '), gemsAdded, coinsAdded };
}

export function applyOwnedEntitledSkus(save: PlayerSave, ownedSkus: string[]): string[] {
  const restored: string[] = [];
  for (const sku of ownedSkus) {
    if (sku === 'starforge_no_ads' && !save.noAdsForever) {
      save.noAdsForever = true;
      restored.push('No Ads Forever');
    } else if (sku === 'starforge_season_pass' && !save.passPremiumUnlocked) {
      save.passPremiumUnlocked = true;
      restored.push('Season Pass');
    } else if (sku === 'starforge_vip_monthly') {
      save.noAdsForever = true;
      if (save.vipExpiresAt < Date.now()) {
        save.vipExpiresAt = Date.now() + 30 * 86_400_000;
      }
      restored.push('VIP Club');
    }
  }
  if (restored.length > 0) saveGame(save);
  return restored;
}
