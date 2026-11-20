import {
  CRATE_COSTS,
  GEAR_TEMPLATES,
  HEROES,
  RARITY_META,
  RARITY_ORDER,
  TALENTS,
  WHEEL_REWARDS,
  WheelSliceDef,
  getTodayDateKey,
} from '../data/gameCatalog';
import {
  AscensionTier,
  CombatStats,
  GearItem,
  GearSlot,
  HeroId,
  LeaderboardEntry,
  LeaderboardMode,
  PlayerSave,
  Rarity,
  RunSummary,
  SavedRunSnapshot,
} from '../types/game';

const STORAGE_KEY = 'starforge_survivors_save_v1';
const ACTIVE_RUN_KEY = 'starforge_active_run_v2';

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

export function createDefaultSave(): PlayerSave {
  const starterWeapon = createGearItem('wp_katana', 'uncommon', 1);
  const starterArmor = createGearItem('ar_aegis', 'common', 1);
  const starterBoots = createGearItem('bt_thruster', 'common', 1);
  const day = getTodayDateKey();

  return {
    version: 2,
    deviceId: makeUid('dev'),
    playerName: 'Commander',
    accountLevel: 1,
    accountXp: 0,
    coins: 1500,
    gems: 150,
    blueprints: 16,
    basicKeys: 2,
    cyberKeys: 1,
    reviveTokens: 2,
    pityCounter: 0,

    selectedHero: 'kael',
    selectedWeaponStyle: 'signature',
    selectedAscension: 1,
    unlockedHeroes: ['kael'],
    heroLevels: { kael: 1, nova: 1, titan: 1, aegis: 1, pyro: 1, vespera: 1 },

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
    highestAscensionCleared: 1,
    bestEndlessSec: 0,
    bestEndlessKills: 0,
    bestBossRushSec: 0,
    bossRushClears: 0,
    bestDailyScore: 0,
    dailyCompletedDate: '',
    totalKills: 0,
    totalRuns: 0,
    totalBossesKilled: 0,
    totalShrinesClaimed: 0,

    passXp: 0,
    passClaimedTiers: [],

    lastLoginDay: day,
    loginStreak: 1,
    loginClaimedToday: false,

    lastDailyDay: day,
    freeGiftClaimedToday: false,
    wheelSpinsFreeUsedToday: 0,
    quests: {
      killsToday: 0,
      runsToday: 0,
      bossesToday: 0,
      upgradesToday: 0,
      objectivesToday: 0,
      claimedIds: [],
    },
    claimedAchievements: [],
    discoveredEvos: [],
    claimedEvoCodex: [],
    discoveredRelics: [],
    defeatedBosses: [],

    lastPatrolCollectAt: Date.now(),

    soundEnabled: true,
    musicEnabled: true,
    vibrationEnabled: true,
    damageNumbersEnabled: true,

    localLeaderboard: {
      endless: [],
      boss_rush: [],
      daily: [],
    },
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
    const parsed = JSON.parse(raw) as Partial<PlayerSave> & {
      passClaimedFree?: number[];
      passClaimedPremium?: number[];
    };
    const base = createDefaultSave();

    const rawInv = Array.isArray(parsed.inventory) && parsed.inventory.length > 0 ? parsed.inventory : base.inventory;
    const cleanInv = rawInv
      .filter(
        (g): g is GearItem =>
          Boolean(g && typeof g.uid === 'string' && typeof g.templateId === 'string' && g.rarity in RARITY_META)
      )
      .map((g) => {
        const tpl = GEAR_TEMPLATES.find((t) => t.templateId === g.templateId);
        return {
          ...g,
          perkText: tpl ? tpl.perkText : g.perkText,
          level: Math.max(1, Math.min(RARITY_META[g.rarity].maxLv, Math.floor(safeNum(g.level, 1, 1)))),
        };
      });
    const inv = cleanInv.length > 0 ? cleanInv : base.inventory;
    const invUids = new Set(inv.map((g) => g.uid));
    const rawEquipped = { ...base.equipped, ...(parsed.equipped || {}) };
    for (const sl of Object.keys(rawEquipped) as GearSlot[]) {
      const uid = rawEquipped[sl];
      if (uid && !invUids.has(uid)) {
        rawEquipped[sl] = null;
      }
    }

    const rawHeroLevels = { ...base.heroLevels, ...(parsed.heroLevels || {}) };
    const cleanHeroLevels = { ...base.heroLevels } as Record<HeroId, number>;
    for (const h of HEROES) {
      cleanHeroLevels[h.id] = Math.floor(safeNum((rawHeroLevels as Record<string, unknown>)[h.id], 1, 1));
    }

    const cleanTalents: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.talents || {})) {
      cleanTalents[k] = Math.floor(safeNum(v, 0, 0));
    }

    // Migrate claimed tiers from v1 if present
    const migratedClaimed = Array.isArray(parsed.passClaimedTiers)
      ? parsed.passClaimedTiers
      : Array.isArray(parsed.passClaimedFree)
        ? parsed.passClaimedFree
        : [];

    const validAsc = Math.max(1, Math.min(5, Math.floor(safeNum(parsed.selectedAscension, 1, 1)))) as AscensionTier;
    const validHighAsc = Math.max(1, Math.min(5, Math.floor(safeNum(parsed.highestAscensionCleared, 1, 1)))) as AscensionTier;

    const validWStyle =
      parsed.selectedWeaponStyle === 'sword' ||
      parsed.selectedWeaponStyle === 'staff' ||
      parsed.selectedWeaponStyle === 'bow' ||
      parsed.selectedWeaponStyle === 'signature'
        ? parsed.selectedWeaponStyle
        : 'signature';

    const localLb = parsed.localLeaderboard || base.localLeaderboard;

    const merged: PlayerSave = {
      ...base,
      ...parsed,
      version: 2,
      accountLevel: Math.floor(safeNum(parsed.accountLevel, base.accountLevel, 1)),
      accountXp: safeNum(parsed.accountXp, base.accountXp, 0),
      coins: Math.floor(safeNum(parsed.coins, base.coins, 0)),
      gems: Math.floor(safeNum(parsed.gems, base.gems, 0)),
      blueprints: Math.floor(safeNum(parsed.blueprints, base.blueprints, 0)),
      basicKeys: Math.floor(safeNum(parsed.basicKeys, base.basicKeys, 0)),
      cyberKeys: Math.floor(safeNum(parsed.cyberKeys, base.cyberKeys, 0)),
      reviveTokens: Math.floor(safeNum(parsed.reviveTokens, base.reviveTokens, 0)),
      highestChapterUnlocked: Math.min(6, Math.max(1, Math.floor(safeNum(parsed.highestChapterUnlocked, 1, 1)))),
      selectedHero: HEROES.some((h) => h.id === parsed.selectedHero) ? parsed.selectedHero! : base.selectedHero,
      selectedWeaponStyle: validWStyle,
      selectedAscension: validAsc,
      highestAscensionCleared: validHighAsc,
      unlockedHeroes: Array.isArray(parsed.unlockedHeroes) && parsed.unlockedHeroes.length > 0
        ? parsed.unlockedHeroes.filter((id): id is HeroId => HEROES.some((h) => h.id === id))
        : ['kael'],
      heroLevels: cleanHeroLevels,
      equipped: rawEquipped,
      talents: cleanTalents,
      passClaimedTiers: migratedClaimed,
      quests: {
        ...base.quests,
        ...(parsed.quests || {}),
        objectivesToday: Math.floor(safeNum(parsed.quests?.objectivesToday, 0, 0)),
        claimedIds: Array.isArray(parsed.quests?.claimedIds) ? parsed.quests!.claimedIds : [],
      },
      discoveredEvos: Array.isArray(parsed.discoveredEvos) ? parsed.discoveredEvos : [],
      claimedEvoCodex: Array.isArray(parsed.claimedEvoCodex) ? parsed.claimedEvoCodex : [],
      discoveredRelics: Array.isArray(parsed.discoveredRelics) ? parsed.discoveredRelics : [],
      defeatedBosses: Array.isArray(parsed.defeatedBosses) ? parsed.defeatedBosses : [],
      inventory: inv,
      localLeaderboard: {
        endless: Array.isArray(localLb.endless) ? localLb.endless : [],
        boss_rush: Array.isArray(localLb.boss_rush) ? localLb.boss_rush : [],
        daily: Array.isArray(localLb.daily) ? localLb.daily : [],
      },
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
    // Ignore storage quota errors
  }
}

// ---- Mid-Run Auto-Save Persistence ----

export function saveActiveRun(snap: SavedRunSnapshot): void {
  try {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(snap));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveRun(): SavedRunSnapshot | null {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedRunSnapshot;
    if (!parsed || parsed.version !== 2 || !Number.isFinite(parsed.savedAt)) return null;
    // Expire snapshots older than 24 hours
    if (Date.now() - parsed.savedAt > 86_400_000) {
      clearActiveRun();
      return null;
    }
    if (!Array.isArray(parsed.weapons) || parsed.weapons.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveRun(): void {
  try {
    localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // Ignore
  }
}

export function ensureDailyState(save: PlayerSave): PlayerSave {
  const today = getTodayDateKey();
  if (save.lastDailyDay !== today) {
    save.lastDailyDay = today;
    save.freeGiftClaimedToday = false;
    save.wheelSpinsFreeUsedToday = 0;
    save.quests = {
      killsToday: 0,
      runsToday: 0,
      bossesToday: 0,
      upgradesToday: 0,
      objectivesToday: 0,
      claimedIds: [],
    };
  }
  if (save.lastLoginDay !== today) {
    const prev = new Date(`${save.lastLoginDay}T00:00:00`);
    const curr = new Date(`${today}T00:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    save.loginStreak = diffDays === 1 ? (save.loginStreak % 7) + 1 : 1;
    save.lastLoginDay = today;
    save.loginClaimedToday = false;
  }
  return save;
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
  let projPowerMult = 1.0;
  let dodgeChance = 0;
  let areaMult = hero.id === 'aegis' ? 1.15 : 1.0;
  let pickupRadius = 82;
  let goldMult = 1.25; // Premium Edition generous baseline!
  let xpMult = 1.15;
  let hpRegenPerSec = 0.7;
  let revives = 0;
  let rerolls = 1; // 1 free Reroll per run baseline
  let banishes = 1; // 1 free Banish per run baseline

  if (hero.id === 'titan') {
    maxHp *= 1.35;
    armor += 5;
  } else if (hero.id === 'vespera') {
    atk *= 1.2;
  } else if (hero.id === 'aegis') {
    armor += 3;
  } else if (hero.id === 'pyro') {
    moveSpeed *= 1.12;
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
      case 'rerolls':
        rerolls += val;
        break;
      case 'banishes':
        banishes += val;
        break;
    }
  }

  // Equipped gear (ALL perks wired cleanly!)
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
    if (item.templateId === 'wp_voidcannon') projPowerMult += 0.08;
    if (item.templateId === 'ar_aegis') armor += 4;
    if (item.templateId === 'ar_stealth') {
      dodgeChance += 0.08;
      moveSpeed *= 1.05;
    }
    if (item.templateId === 'hm_visor') xpMult += 0.1;
    if (item.templateId === 'hm_titan') maxHp *= 1.12;
    if (item.templateId === 'bt_thruster') moveSpeed *= 1.12;
    if (item.templateId === 'bt_mag') pickupRadius *= 1.2;
    if (item.templateId === 'rg_crit') critChance += 0.06;
    if (item.templateId === 'rg_greed') goldMult += 0.15;
    if (item.templateId === 'cr_quantum') cooldownReduction += 0.06;
    if (item.templateId === 'cr_phoenix') hpRegenPerSec += 2.5;
  }

  const finalMaxHp = Math.round(maxHp);
  const finalAtk = Math.round(atk);
  const cooldownMult = Math.max(0.42, 1 - cooldownReduction);
  const powerRating = Math.round(
    finalAtk * 3.1 * projPowerMult +
      finalMaxHp * 0.25 +
      armor * 8 +
      critChance * 420 +
      dodgeChance * 350 +
      (1 / cooldownMult - 1) * 280
  );

  return {
    maxHp: finalMaxHp,
    atk: finalAtk,
    armor: Math.round(armor),
    moveSpeed: Math.round(moveSpeed),
    critChance: Math.min(0.8, critChance),
    critMult,
    cooldownMult,
    projPowerMult,
    dodgeChance: Math.min(0.45, dodgeChance),
    areaMult,
    pickupRadius: Math.round(pickupRadius),
    goldMult,
    xpMult,
    hpRegenPerSec,
    revives,
    rerolls,
    banishes,
    powerRating,
  };
}

export function getGearUpgradeCost(item: GearItem): { coins: number; blueprints: number } {
  const lv = item.level;
  return {
    coins: Math.round(130 + lv * lv * 16 + lv * 78),
    blueprints: Math.max(1, Math.floor(1 + lv * 0.6)),
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

  return save.inventory.filter((g) => g.templateId === target.templateId && g.rarity === target.rarity);
}

export function mergeGearTriplet(save: PlayerSave, uid: string): GearItem | null {
  const target = save.inventory.find((g) => g.uid === uid);
  if (!target) return null;
  const nextIdx = RARITY_ORDER.indexOf(target.rarity) + 1;
  if (nextIdx <= 0 || nextIdx >= RARITY_ORDER.length) return null;

  const group = findMergeCandidates(save, uid);
  if (group.length < 3) return null;

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
    if (r < 0.08) rarity = 'rare';
    else if (r < 0.38) rarity = 'uncommon';
    else rarity = 'common';
  } else if (crateType === 'cyber') {
    save.pityCounter += 1;
    if (save.pityCounter >= 10) {
      rarity = 'epic';
      save.pityCounter = 0;
    } else if (r < 0.05) {
      rarity = 'legendary';
      save.pityCounter = 0;
    } else if (r < 0.22) {
      rarity = 'epic';
      save.pityCounter = 0;
    } else if (r < 0.62) {
      rarity = 'rare';
    } else {
      rarity = 'uncommon';
    }
  } else {
    if (r < 0.1) rarity = 'mythic';
    else if (r < 0.36) rarity = 'legendary';
    else rarity = 'epic';
  }

  const drop = createGearItem(tpl.templateId, rarity, 1);
  save.inventory.unshift(drop);
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
  const chapterFactor = 1 + (save.highestChapterUnlocked - 1) * 0.48;
  const stats = computePlayerStats(save);
  // Generous 1.5x patrol yield (no ad-doubler needed!)
  const coins = Math.floor(elapsedMin * 36 * chapterFactor * stats.goldMult);
  const blueprints = Math.floor(elapsedMin / 18);
  return { minutes: elapsedMin, coins, blueprints };
}

export function collectPatrolEarnings(save: PlayerSave): { coins: number; blueprints: number } {
  const p = computePatrolEarnings(save);
  save.coins += p.coins;
  save.blueprints += p.blueprints;
  save.lastPatrolCollectAt = Date.now();
  saveGame(save);
  return { coins: p.coins, blueprints: p.blueprints };
}

export function recordLocalLeaderboardEntry(save: PlayerSave, entry: LeaderboardEntry): void {
  const mode: LeaderboardMode = entry.mode;
  const list = [...(save.localLeaderboard[mode] || [])];
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  save.localLeaderboard[mode] = list.slice(0, 25);
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
    save.gems += 20;
  }

  for (const wId of summary.evoIdsUnlocked || []) {
    if (!save.discoveredEvos.includes(wId)) {
      save.discoveredEvos.push(wId);
    }
  }
  for (const rId of summary.relicsCollected || []) {
    if (!save.discoveredRelics.includes(rId)) {
      save.discoveredRelics.push(rId);
    }
  }
  for (const bArch of summary.bossArchetypesDefeated || []) {
    if (!save.defeatedBosses.includes(bArch)) {
      save.defeatedBosses.push(bArch);
    }
  }

  save.totalKills += summary.kills;
  save.totalRuns += 1;
  save.totalBossesKilled += summary.bossesKilled;
  save.totalShrinesClaimed += summary.shrinesClaimed;
  save.quests.killsToday += summary.kills;
  save.quests.runsToday += 1;
  save.quests.bossesToday += summary.bossesKilled;
  save.quests.objectivesToday += summary.shrinesClaimed + summary.bossesKilled;

  if (summary.victory && summary.ascension > save.highestAscensionCleared) {
    save.highestAscensionCleared = summary.ascension;
  }

  if (summary.mode === 'endless') {
    if (summary.survivedSec > save.bestEndlessSec) save.bestEndlessSec = summary.survivedSec;
    if (summary.kills > save.bestEndlessKills) save.bestEndlessKills = summary.kills;
    recordLocalLeaderboardEntry(save, {
      deviceId: save.deviceId,
      playerName: save.playerName,
      mode: 'endless',
      score: summary.score,
      wave: summary.survivedSec,
      kills: summary.kills,
      heroId: save.selectedHero,
      ascension: summary.ascension,
      isPlayer: true,
      updatedAt: getTodayDateKey(),
    });
  } else if (summary.mode === 'boss_rush') {
    if (summary.victory) {
      save.bossRushClears = (save.bossRushClears || 0) + 1;
      if (save.bestBossRushSec === 0 || summary.survivedSec < save.bestBossRushSec) {
        save.bestBossRushSec = summary.survivedSec;
      }
    }
    recordLocalLeaderboardEntry(save, {
      deviceId: save.deviceId,
      playerName: save.playerName,
      mode: 'boss_rush',
      score: summary.score,
      wave: summary.bossesKilled,
      kills: summary.kills,
      heroId: save.selectedHero,
      ascension: summary.ascension,
      isPlayer: true,
      updatedAt: getTodayDateKey(),
    });
  } else if (summary.mode === 'daily') {
    if (summary.score > save.bestDailyScore) save.bestDailyScore = summary.score;
    if (summary.victory && summary.dailyDateKey) save.dailyCompletedDate = summary.dailyDateKey;
    recordLocalLeaderboardEntry(save, {
      deviceId: save.deviceId,
      playerName: save.playerName,
      mode: 'daily',
      score: summary.score,
      wave: summary.survivedSec,
      kills: summary.kills,
      heroId: save.selectedHero,
      ascension: summary.ascension,
      isPlayer: true,
      updatedAt: summary.dailyDateKey || getTodayDateKey(),
    });
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
