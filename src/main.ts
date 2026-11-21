import './style.css';
import {
  ACHIEVEMENTS,
  ASCENSIONS,
  BOOSTER_COSTS,
  BOSS_BESTIARY,
  CHAPTERS,
  CRATE_COSTS,
  DAILY_QUESTS,
  HEROES,
  LOGIN_STREAK_REWARDS,
  MASTERY_TIERS,
  PASSIVES,
  RARITY_META,
  RELICS,
  SLOT_LABELS,
  TALENTS,
  WEAPONS,
  WEAPON_STYLES,
  WHEEL_REWARDS,
  WheelSliceDef,
  buildDailyRunChapter,
  getDailyRunConfig,
  getTodayDateKey,
} from './data/gameCatalog';
import { DraftOption, HudSnapshot, SurvivorEngine } from './engine/survivorEngine';
import { ADMOB_CONFIG, SHOP_SKUS } from './config/monetization';
import { audio } from './services/audio';
import { monetizationBridge } from './services/billing';
import { fetchOnlineLeaderboard, submitOnlineScore } from './services/leaderboard';
import {
  applyPurchasedSku,
  applyRunOutcome,
  autoMergeAllGear,
  claimVipDailyShards,
  clearActiveRun,
  collectPatrolEarnings,
  computePatrolEarnings,
  computePlayerStats,
  createDefaultSave,
  findMergeCandidates,
  getGearPower,
  getGearStats,
  getGearUpgradeCost,
  getSalvageYield,
  loadActiveRun,
  loadSave,
  mergeGearTriplet,
  openCrate,
  rollWheelReward,
  salvageAllCommonGear,
  salvageGearItem,
  saveActiveRun,
  saveGame,
  upgradeGearItem,
} from './storage/saveState';
import {
  ActiveRunBoosters,
  AscensionTier,
  ChapterDef,
  DailyRunConfig,
  GearItem,
  GearSlot,
  HeroId,
  LeaderboardEntry,
  LeaderboardMode,
  PlayerSave,
  RelicDef,
  RunSummary,
  SavedRunSnapshot,
  WeaponId,
  WeaponStyle,
} from './types/game';
import {
  bossEmblemSvg,
  gearSlotIconSvg,
  heroPortraitSvg,
  relicIconSvg,
  uiIconSvg,
  weaponIconSvg,
} from './ui/svgAssets';

type MainTab = 'battle' | 'heroes' | 'forge' | 'mastery' | 'vault';
type ForgeSubTab = 'gear' | 'crates' | 'talents';
type MasterySubTab = 'track' | 'quests' | 'achievements';
type VaultSubTab = 'store' | 'evos' | 'relics' | 'bosses';

type ModalState =
  | null
  | { kind: 'chapters' }
  | { kind: 'daily_streak' }
  | {
      kind: 'leaderboard';
      mode: LeaderboardMode;
      loading: boolean;
      online: boolean;
      entries: LeaderboardEntry[];
    }
  | { kind: 'patrol' }
  | { kind: 'lucky_wheel'; rotation: number; spinning: boolean; lastResult: WheelSliceDef | null }
  | { kind: 'settings'; confirmReset: boolean }
  | { kind: 'gear_detail'; uid: string }
  | { kind: 'crate_result'; drops: GearItem[]; title: string }
  | { kind: 'resume_run'; snapshot: SavedRunSnapshot }
  | { kind: 'run_summary'; summary: RunSummary; doubled?: boolean };

class StarforgeApp {
  private root: HTMLElement;
  private save: PlayerSave;
  private tab: MainTab = 'battle';
  private forgeSub: ForgeSubTab = 'gear';
  private masterySub: MasterySubTab = 'track';
  private vaultSub: VaultSubTab = 'store';
  private selectedChapterId = 1;
  private modal: ModalState = null;
  private boosters: ActiveRunBoosters = { extraWeapon: false, overdriveAtk: false, doubleLuck: false };
  private gearFilter: 'all' | GearSlot = 'all';
  private wheelTimer: number | null = null;

  private toastMsg = '';
  private toastTimer: number | null = null;

  // Battle state
  private inBattle = false;
  private engine: SurvivorEngine | null = null;
  private hudSnap: HudSnapshot | null = null;
  private lastWeaponKey = '';
  private lastRelicKey = '';
  private battleModal:
    | null
    | { kind: 'draft'; options: DraftOption[]; rerollsLeft: number; banishesLeft: number }
    | { kind: 'relic'; choices: RelicDef[] }
    | { kind: 'chest'; rewards: DraftOption[]; coins: number }
    | { kind: 'revive' }
    | { kind: 'pause' } = null;
  private bossBannerText: string | null = null;
  private waveBannerText: string | null = null;
  private bossBannerTimer: number | null = null;
  private waveBannerTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.save = loadSave();
    this.selectedChapterId = Math.min(6, Math.max(1, this.save.highestChapterUnlocked));
    audio.configure(this.save.soundEnabled, this.save.musicEnabled);

    const pendingSnap = loadActiveRun();
    if (pendingSnap) {
      this.modal = { kind: 'resume_run', snapshot: pendingSnap };
    }

    this.render();

    // Initialize Google Play Billing & AdMob in background and restore owned passes
    void monetizationBridge.initAll().then(async () => {
      const owned = await monetizationBridge.restorePurchases();
      let changed = false;
      for (const sku of owned) {
        if (!this.save.purchasedSkus.includes(sku)) {
          applyPurchasedSku(this.save, sku);
          changed = true;
        }
      }
      if (changed && !this.inBattle) this.render();
    });
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastMsg = '';
      this.updateToastDom();
    }, 2600);
    this.updateToastDom();
  }

  private updateToastDom(): void {
    const existing = this.root.querySelector('.toast');
    if (existing) existing.remove();
    if (this.toastMsg) {
      this.root.insertAdjacentHTML('beforeend', `<div class="toast">${this.esc(this.toastMsg)}</div>`);
    }
  }

  private esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  }

  private fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString('en-US');
  }

  private fmtTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private getAchievementContext() {
    return {
      totalKills: this.save.totalKills,
      totalRuns: this.save.totalRuns,
      totalBossesKilled: this.save.totalBossesKilled,
      clearedCount: this.save.clearedChapters.length,
      bestEndlessSec: this.save.bestEndlessSec,
      totalShrinesClaimed: this.save.totalShrinesClaimed,
      highestAscensionCleared: this.save.highestAscensionCleared,
      discoveredRelicsCount: this.save.discoveredRelics.length,
    };
  }

  private hasUnclaimedCodex(): boolean {
    return this.save.discoveredEvos.some((id) => !this.save.claimedEvoCodex.includes(id));
  }

  private hasUnclaimedMasteryTiers(): boolean {
    for (const mt of MASTERY_TIERS) {
      if (this.save.passXp >= mt.xpRequired && !this.save.passClaimedTiers.includes(mt.tier)) return true;
    }
    return false;
  }

  private hasUnclaimedMasteryTab(): boolean {
    if (this.hasUnclaimedMasteryTiers()) return true;
    for (const q of DAILY_QUESTS) {
      if (!this.save.quests.claimedIds.includes(q.id) && this.save.quests[q.field] >= q.target) return true;
    }
    const ctx = this.getAchievementContext();
    for (const a of ACHIEVEMENTS) {
      if (!this.save.claimedAchievements.includes(a.id) && a.check(ctx)) return true;
    }
    return false;
  }

  private getBoosterCost(): number {
    let total = 0;
    if (this.boosters.extraWeapon) total += BOOSTER_COSTS.extraWeapon;
    if (this.boosters.overdriveAtk) total += BOOSTER_COSTS.overdriveAtk;
    if (this.boosters.doubleLuck) total += BOOSTER_COSTS.doubleLuck;
    return total;
  }

  private openLeaderboardModal(mode: LeaderboardMode = 'endless'): void {
    this.modal = {
      kind: 'leaderboard',
      mode,
      loading: true,
      online: false,
      entries: this.save.localLeaderboard[mode] || [],
    };
    this.render();
    void fetchOnlineLeaderboard(mode, this.save).then((res) => {
      if (this.modal?.kind === 'leaderboard' && this.modal.mode === mode) {
        this.modal = {
          kind: 'leaderboard',
          mode,
          loading: false,
          online: res.online,
          entries: res.entries,
        };
        this.render();
      }
    });
  }

  private launchBattle(opts: {
    chapter: ChapterDef;
    ascension: AscensionTier;
    dailyConfig: DailyRunConfig | null;
    heroId: HeroId;
    weaponStyle: WeaponStyle;
    boosters: ActiveRunBoosters;
    restoreSnap?: SavedRunSnapshot;
  }): void {
    if (this.bossBannerTimer !== null) {
      window.clearTimeout(this.bossBannerTimer);
      this.bossBannerTimer = null;
    }
    if (this.waveBannerTimer !== null) {
      window.clearTimeout(this.waveBannerTimer);
      this.waveBannerTimer = null;
    }
    this.engine?.destroy();
    this.engine = null;

    this.inBattle = true;
    this.battleModal = null;
    this.bossBannerText = null;
    this.waveBannerText = null;
    this.lastWeaponKey = '';
    this.lastRelicKey = '';
    this.modal = null;
    this.render();

    const canvas = this.root.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) return;

    const stats = computePlayerStats(this.save);
    const { chapter, ascension, dailyConfig } = opts;

    this.engine = new SurvivorEngine(
      canvas,
      chapter,
      opts.heroId,
      opts.weaponStyle,
      stats,
      this.save.damageNumbersEnabled,
      this.save.vibrationEnabled,
      opts.boosters,
      ascension,
      dailyConfig,
      {
        onHud: (snap) => {
          this.hudSnap = snap;
          this.updateBattleHudOnly();
        },
        onLevelUp: (options, rerollsLeft, banishesLeft) => {
          this.battleModal = { kind: 'draft', options, rerollsLeft, banishesLeft };
          this.renderBattleOverlays();
        },
        onRelicChoice: (choices) => {
          this.battleModal = { kind: 'relic', choices };
          this.renderBattleOverlays();
        },
        onChestJackpot: (rewards, coins) => {
          this.battleModal = { kind: 'chest', rewards, coins };
          this.renderBattleOverlays();
        },
        onBossBanner: (bossName) => {
          this.bossBannerText = `BOSS DETECTED: ${bossName}`;
          this.updateBattleBannersOnly();
          if (this.bossBannerTimer !== null) window.clearTimeout(this.bossBannerTimer);
          this.bossBannerTimer = window.setTimeout(() => {
            this.bossBannerTimer = null;
            this.bossBannerText = null;
            this.updateBattleBannersOnly();
          }, 2700);
        },
        onWaveBanner: (message) => {
          this.waveBannerText = message;
          this.updateBattleBannersOnly();
          if (this.waveBannerTimer !== null) window.clearTimeout(this.waveBannerTimer);
          this.waveBannerTimer = window.setTimeout(() => {
            this.waveBannerTimer = null;
            if (this.waveBannerText === message) {
              this.waveBannerText = null;
              this.updateBattleBannersOnly();
            }
          }, 2600);
        },
        onDeathOffer: () => {
          this.battleModal = { kind: 'revive' };
          this.renderBattleOverlays();
        },
        onAutoSave: (snap) => {
          saveActiveRun(snap);
        },
        onFinish: (result) => {
          clearActiveRun();
          if (this.bossBannerTimer !== null) {
            window.clearTimeout(this.bossBannerTimer);
            this.bossBannerTimer = null;
          }
          if (this.waveBannerTimer !== null) {
            window.clearTimeout(this.waveBannerTimer);
            this.waveBannerTimer = null;
          }
          this.engine?.destroy();
          this.engine = null;
          this.inBattle = false;
          this.battleModal = null;

          const summary: RunSummary = {
            chapterId: chapter.id,
            mode: chapter.mode,
            ascension,
            dailyDateKey: dailyConfig?.dateKey,
            victory: result.victory,
            survivedSec: result.survivedSec,
            kills: result.kills,
            bossesKilled: result.bossesKilled,
            shrinesClaimed: result.shrinesClaimed,
            coinsEarned: result.coinsEarned,
            gemsEarned: result.gemsEarned,
            blueprintsEarned: result.blueprintsEarned,
            passXpEarned: Math.max(
              30,
              Math.floor((result.survivedSec * 0.65 + result.kills * 0.25 + result.shrinesClaimed * 20 + (result.victory ? 75 : 0)) * (ASCENSIONS.find((a) => a.tier === ascension)?.rewardMult || 1))
            ),
            accountXpEarned: Math.max(24, Math.floor(result.survivedSec * 0.55 + (result.victory ? 60 : 0))),
            levelReached: result.levelReached,
            newGearDrop: result.newGearDrop,
            evolutionsUnlocked: result.evolutionsUnlocked,
            evoIdsUnlocked: result.evoIdsUnlocked,
            relicsCollected: result.relicsCollected,
            bossArchetypesDefeated: result.bossArchetypesDefeated,
            maxCombo: result.maxCombo,
            score: result.score,
            weaponBreakdown: result.weaponBreakdown,
          };

          applyRunOutcome(this.save, summary);
          if (chapter.mode === 'chapter') {
            this.selectedChapterId = Math.min(6, this.save.highestChapterUnlocked);
          }

          if (chapter.mode === 'endless' || chapter.mode === 'boss_rush' || chapter.mode === 'daily') {
            void submitOnlineScore({
              deviceId: this.save.deviceId,
              playerName: this.save.playerName,
              mode: chapter.mode,
              score: summary.score,
              wave: chapter.mode === 'boss_rush' ? summary.bossesKilled : summary.survivedSec,
              kills: summary.kills,
              heroId: opts.heroId,
              ascension,
            });
          }

          this.modal = { kind: 'run_summary', summary };
          this.render();
        },
      }
    );

    if (opts.restoreSnap) {
      this.engine.restoreSnapshot(opts.restoreSnap);
    }
    this.engine.start();
  }

  private startBattle(chapterId: number, isDaily = false): void {
    const boosterCost = this.getBoosterCost();
    if (boosterCost > this.save.coins) {
      this.showToast(`Not enough Gold for boosters (${this.fmtNum(boosterCost)} needed)`);
      return;
    }
    if (boosterCost > 0) {
      this.save.coins -= boosterCost;
      saveGame(this.save);
    }

    const activeBoosters: ActiveRunBoosters = { ...this.boosters };
    this.boosters = { extraWeapon: false, overdriveAtk: false, doubleLuck: false };

    let dailyConfig: DailyRunConfig | null = null;
    let ch: ChapterDef;
    if (isDaily) {
      dailyConfig = getDailyRunConfig(getTodayDateKey());
      ch = buildDailyRunChapter(dailyConfig);
    } else {
      ch = CHAPTERS.find((c) => c.id === chapterId) || CHAPTERS[0];
    }

    this.launchBattle({
      chapter: ch,
      ascension: this.save.selectedAscension,
      dailyConfig,
      heroId: this.save.selectedHero,
      weaponStyle: this.save.selectedWeaponStyle,
      boosters: activeBoosters,
    });
  }

  private resumeSavedRun(snap: SavedRunSnapshot): void {
    let dailyConfig: DailyRunConfig | null = null;
    let ch: ChapterDef;
    if (snap.dailyDateKey) {
      dailyConfig = getDailyRunConfig(snap.dailyDateKey);
      ch = buildDailyRunChapter(dailyConfig);
    } else {
      ch = CHAPTERS.find((c) => c.id === snap.chapterId) || CHAPTERS[0];
    }
    this.launchBattle({
      chapter: ch,
      ascension: snap.ascension,
      dailyConfig,
      heroId: snap.heroId,
      weaponStyle: snap.weaponStyle,
      boosters: snap.boosters,
      restoreSnap: snap,
    });
  }

  private render(): void {
    if (this.inBattle) {
      const existingCanvas = this.root.querySelector<HTMLCanvasElement>('#game-canvas');
      if (existingCanvas) {
        this.renderBattleOverlays();
        return;
      }

      // Build battle DOM skeleton ONCE (zero 140ms innerHTML wipes!)
      this.root.innerHTML = `
        <div class="app-root in-battle">
          <div class="battle-stage">
            <canvas id="game-canvas"></canvas>
            <div class="battle-hud-top" id="battle-hud-top">
              <div class="xp-bar-wrap">
                <div class="xp-bar-fill" id="hud-xp-fill" style="width:0%;"></div>
              </div>
              <div class="battle-stats-row">
                <span class="hud-stat-group">
                  <strong id="hud-lv">Lv.1</strong>
                  <span class="hud-inline-stat">${uiIconSvg('heart', 13, '#10b981')}<span id="hud-hp">0/0</span></span>
                  <span class="hud-shield-pill" id="hud-shield" hidden>${uiIconSvg('shield', 12, '#22d3ee')}<span id="hud-shield-val">0</span></span>
                </span>
                <span class="hud-timer" id="hud-timer">00:00</span>
                <span class="hud-stat-group">
                  <span class="hud-inline-stat">${uiIconSvg('skull', 13, '#f43f5e')}<span id="hud-kills">0</span></span>
                  <span class="hud-inline-stat">${uiIconSvg('coin', 13)}<span id="hud-coins">0</span></span>
                  <button class="icon-btn" id="btn-battle-pause" aria-label="Pause">${uiIconSvg('pause', 16, '#f8fafc')}</button>
                </span>
              </div>
              <div class="hud-badges-row">
                <div class="hud-weapon-strip" id="hud-weapons"></div>
                <div class="hud-relic-strip" id="hud-relics"></div>
                <span class="badge-tag hud-wave-pill" id="hud-wave">Wave 1</span>
                <span class="combo-pill" id="hud-combo" hidden>0x COMBO</span>
              </div>
              <div class="boss-bar-card" id="hud-boss-bar" hidden>
                <div class="boss-bar-header">
                  <span id="hud-boss-name">BOSS</span>
                  <span class="boss-phase-tag" id="hud-boss-phase" hidden>PHASE 2 ENRAGE</span>
                </div>
                <div class="progress-track" style="margin-top:4px;height:7px;">
                  <div class="progress-fill" id="hud-boss-fill" style="width:100%;background:linear-gradient(90deg,#ef4444,#f97316);"></div>
                </div>
              </div>
              <div class="objective-bar-card" id="hud-obj-bar" hidden>
                <div class="boss-bar-header">
                  <span id="hud-obj-name">Starforge Shrine</span>
                  <span id="hud-obj-pct">0%</span>
                </div>
                <div class="progress-track" style="margin-top:3px;height:5px;">
                  <div class="progress-fill" id="hud-obj-fill" style="width:0%;background:#fbbf24;"></div>
                </div>
              </div>
              <div class="battle-banners-stack" id="battle-banners"></div>
            </div>

            <div class="battle-actions-br">
              <button class="skill-btn" id="btn-ult">
                ${uiIconSvg('flame', 20, '#fef08a')}
                <span id="lbl-ult">0%</span>
              </button>
              <button class="skill-btn" id="btn-dash">
                ${uiIconSvg('dash', 20, '#38bdf8')}
                <span>DASH</span>
              </button>
            </div>
            <div id="battle-overlays"></div>
          </div>
        </div>
      `;
      this.bindBattleControlEvents();
      this.updateBattleHudOnly();
      this.renderBattleOverlays();
      return;
    }

    const stats = computePlayerStats(this.save);
    const unclaimedVault = !this.save.freeGiftClaimedToday || this.hasUnclaimedCodex();

    this.root.innerHTML = `
      <div class="app-root lobby-mode">
        <header class="top-bar">
          <div class="player-pill">
            <div class="lv-badge">${this.save.accountLevel}</div>
            <div style="min-width:0;">
              <div class="player-name-line">
                <span>${this.esc(this.save.playerName)}</span>
                <span class="badge-tag premium-badge">PREMIUM</span>
              </div>
              <div class="power-line">
                ${uiIconSvg('bolt', 12, '#38bdf8')} Power ${this.fmtNum(stats.powerRating)}
              </div>
            </div>
          </div>
          <div class="currencies">
            <button class="curr-chip" data-go-tab="forge" title="Gold">
              ${uiIconSvg('coin', 14)} <span>${this.fmtNum(this.save.coins)}</span>
            </button>
            <button class="curr-chip shard-chip" data-go-tab="vault" title="Star Shards">
              ${uiIconSvg('shard', 14)} <span>${this.fmtNum(this.save.gems)}</span>
            </button>
            <button class="icon-btn" id="btn-settings" title="Settings" aria-label="Settings">
              ${uiIconSvg('settings', 17, '#e2e8f0')}
            </button>
          </div>
        </header>

        <main class="tab-body">
          ${this.renderTabContent(stats)}
        </main>

        <nav class="bottom-nav">
          <button class="nav-btn ${this.tab === 'battle' ? 'active' : ''}" data-tab="battle">
            <span class="ico">${uiIconSvg('battle', 19)}</span><span>Battle</span>
            ${!this.save.loginClaimedToday ? '<span class="nav-dot"></span>' : ''}
          </button>
          <button class="nav-btn ${this.tab === 'heroes' ? 'active' : ''}" data-tab="heroes">
            <span class="ico">${uiIconSvg('heroes', 19)}</span><span>Heroes</span>
          </button>
          <button class="nav-btn ${this.tab === 'forge' ? 'active' : ''}" data-tab="forge">
            <span class="ico">${uiIconSvg('armory', 19)}</span><span>Armory</span>
          </button>
          <button class="nav-btn ${this.tab === 'mastery' ? 'active' : ''}" data-tab="mastery">
            <span class="ico">${uiIconSvg('mastery', 19)}</span><span>Mastery</span>
            ${this.hasUnclaimedMasteryTab() ? '<span class="nav-dot"></span>' : ''}
          </button>
          <button class="nav-btn ${this.tab === 'vault' ? 'active' : ''}" data-tab="vault">
            <span class="ico">${uiIconSvg('vault', 19)}</span><span>Store</span>
            ${unclaimedVault || !this.save.freeGiftClaimedToday ? '<span class="nav-dot"></span>' : ''}
          </button>
        </nav>

        ${this.renderModalHtml()}
        ${this.toastMsg ? `<div class="toast">${this.esc(this.toastMsg)}</div>` : ''}
      </div>
    `;

    this.bindLobbyEvents();
  }

  private renderTabContent(stats: ReturnType<typeof computePlayerStats>): string {
    if (this.tab === 'battle') return this.renderBattleTab(stats);
    if (this.tab === 'heroes') return this.renderHeroesTab();
    if (this.tab === 'forge') return this.renderForgeTab();
    if (this.tab === 'mastery') return this.renderMasteryTab();
    return this.renderVaultTab();
  }

  private renderBattleTab(stats: ReturnType<typeof computePlayerStats>): string {
    const hero = HEROES.find((h) => h.id === this.save.selectedHero) || HEROES[0];
    const ch = CHAPTERS.find((c) => c.id === this.selectedChapterId) || CHAPTERS[0];
    const patrol = computePatrolEarnings(this.save);
    const totalBoosterCost = this.getBoosterCost();
    const freeWheelLeft = Math.max(0, CRATE_COSTS.wheelFreeLimit - this.save.wheelSpinsFreeUsedToday);
    const unclaimedCodex = this.save.discoveredEvos.filter((id) => !this.save.claimedEvoCodex.includes(id)).length;
    const dailyCfg = getDailyRunConfig(getTodayDateKey());
    const dailyDone = this.save.dailyCompletedDate === dailyCfg.dateKey;
    const maxUnlockedAsc = Math.min(5, this.save.highestAscensionCleared + 1);
    const activeAsc = ASCENSIONS.find((a) => a.tier === this.save.selectedAscension) || ASCENSIONS[0];

    return `
      <div class="battle-home-grid">
        <div class="battle-col-left">
          <div class="card glow-cyan" style="gap:9px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="flex-shrink:0;">${heroPortraitSvg(hero.id, 64, this.save.selectedWeaponStyle)}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:11px;color:var(--cyan);font-weight:900;">LV.${this.save.heroLevels[hero.id] || 1}</span>
                  <span style="font-size:11px;color:var(--muted);font-weight:700;">${hero.title}</span>
                </div>
                <div style="font-size:18px;font-weight:900;line-height:1.15;">${hero.name}</div>
                <div class="stat-pill-row">
                  <span class="stat-pill">${uiIconSvg('heart', 11, '#10b981')} ${stats.maxHp}</span>
                  <span class="stat-pill">${uiIconSvg('sword', 11, '#38bdf8')} ${stats.atk}</span>
                  <span class="stat-pill">${uiIconSvg('target', 11, '#fbbf24')} ${Math.round(stats.critChance * 100)}%</span>
                  ${stats.dodgeChance > 0 ? `<span class="stat-pill">${uiIconSvg('dash', 11, '#22d3ee')} ${Math.round(stats.dodgeChance * 100)}%</span>` : ''}
                </div>
              </div>
            </div>

            <div class="weapon-style-row four-col">
              ${WEAPON_STYLES.map((ws) => {
                const active = this.save.selectedWeaponStyle === ws.id;
                const wIconId: WeaponId = ws.weaponId || hero.startingWeapon;
                return `
                  <button class="weapon-style-chip ${active ? 'active' : ''}" data-pick-wstyle="${ws.id}" style="${active ? `border-color:${ws.color};` : ''}">
                    <span>${weaponIconSvg(wIconId, 18)}</span>
                    <strong style="font-size:11px;color:${active ? ws.color : 'var(--text)'};">${ws.name}</strong>
                  </button>
                `;
              }).join('')}
            </div>

            <div class="ascension-strip">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;font-weight:900;color:${activeAsc.color};letter-spacing:0.4px;">ASCENSION ${activeAsc.roman} • ${activeAsc.name.toUpperCase()}</span>
                <span style="font-size:10px;color:var(--muted);">${activeAsc.subtitle}</span>
              </div>
              <div class="ascension-row">
                ${ASCENSIONS.map((a) => {
                  const locked = a.tier > maxUnlockedAsc;
                  const active = this.save.selectedAscension === a.tier;
                  return `
                    <button class="asc-pill ${active ? 'active' : ''}" data-pick-asc="${a.tier}" style="${active ? `border-color:${a.color};color:${a.color};` : ''}" ${locked ? 'disabled' : ''}>
                      ${locked ? uiIconSvg('lock', 11, '#64748b') : a.roman}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="card booster-strip">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:900;color:#fbbf24;display:inline-flex;align-items:center;gap:4px;">
                ${uiIconSvg('bolt', 13, '#fbbf24')} TACTICAL BOOSTERS
              </span>
              <span style="font-size:10px;color:var(--muted);">Gold-only • Optional</span>
            </div>
            <div class="boosters-row">
              <button class="booster-chip ${this.boosters.extraWeapon ? 'active' : ''}" data-toggle-booster="extraWeapon">
                <span>${uiIconSvg('sword', 13, '#38bdf8')} +1 Weapon</span>
                <small style="color:#fbbf24;">${BOOSTER_COSTS.extraWeapon} Gold</small>
              </button>
              <button class="booster-chip ${this.boosters.overdriveAtk ? 'active' : ''}" data-toggle-booster="overdriveAtk">
                <span>${uiIconSvg('flame', 13, '#f97316')} +25% ATK</span>
                <small style="color:#fbbf24;">${BOOSTER_COSTS.overdriveAtk} Gold</small>
              </button>
              <button class="booster-chip ${this.boosters.doubleLuck ? 'active' : ''}" data-toggle-booster="doubleLuck">
                <span>${uiIconSvg('star', 13, '#22c55e')} 1.5x Loot</span>
                <small style="color:#fbbf24;">${BOOSTER_COSTS.doubleLuck} Gold</small>
              </button>
            </div>
          </div>
        </div>

        <div class="battle-col-right">
          <button class="arena-select-card" id="btn-pick-chapter" style="border-color:${ch.accentColor}55;">
            <div style="min-width:0;flex:1;">
              <div style="font-size:10px;font-weight:900;color:${ch.accentColor};letter-spacing:0.5px;">ARENA • REC POWER ${ch.recommendedPower}</div>
              <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.name}</div>
              <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.subtitle}</div>
            </div>
            <span class="badge-tag" style="background:var(--bg-card-2);border:1px solid var(--border);color:var(--text);padding:6px 10px;flex-shrink:0;">Select</span>
          </button>

          <button class="btn btn-play-mega" id="btn-start-battle">
            ${uiIconSvg('play', 18, '#ffffff')} PLAY ${activeAsc.tier > 1 ? `ASC.${activeAsc.roman}` : ''} ${totalBoosterCost > 0 ? `(-${this.fmtNum(totalBoosterCost)} Gold)` : ''}
          </button>

          <div class="card daily-run-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="min-width:0;">
                <div style="font-size:10px;font-weight:900;color:#fbbf24;display:inline-flex;align-items:center;gap:4px;">
                  ${uiIconSvg('calendar', 12, '#fbbf24')} DAILY SEEDED RUN • ${dailyCfg.dateKey}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">
                  ${dailyCfg.modifiers
                    .map(
                      (m) =>
                        `<span class="badge-tag" style="background:${m.color}22;color:${m.color};border:1px solid ${m.color}55;" title="${this.esc(m.desc)}">${m.name}</span>`
                    )
                    .join('')}
                </div>
              </div>
              <button class="btn btn-amber" id="btn-start-daily" style="padding:8px 12px;font-size:12px;flex-shrink:0;">
                ${dailyDone ? 'Replay' : 'Launch'}
              </button>
            </div>
          </div>

          <div class="quick-actions-grid">
            <button class="quick-tile" id="btn-open-wheel" style="border-color:${freeWheelLeft > 0 ? '#fbbf24' : 'var(--border)'};">
              <div class="tile-head" style="color:#fbbf24;">${uiIconSvg('wheel', 13, '#fbbf24')} Wheel</div>
              <div style="font-size:12px;font-weight:800;">350 Jackpot</div>
              <div style="font-size:10px;color:${freeWheelLeft > 0 ? 'var(--green)' : 'var(--muted)'};font-weight:800;">
                ${freeWheelLeft > 0 ? `${freeWheelLeft} Free Spins` : 'Gold / Shards'}
              </div>
            </button>

            <button class="quick-tile" id="btn-collect-patrol">
              <div class="tile-head" style="color:var(--green);">${uiIconSvg('patrol', 13, '#10b981')} Patrol</div>
              <div style="font-size:12px;font-weight:800;">${this.fmtNum(patrol.coins)} Gold</div>
              <div style="font-size:10px;color:var(--muted);font-weight:800;">${patrol.minutes}m • +${patrol.blueprints} BP</div>
            </button>

            <button class="quick-tile" id="btn-open-streak" style="border-color:${!this.save.loginClaimedToday ? 'var(--rose)' : 'var(--border)'};">
              <div class="tile-head" style="color:var(--amber);">${uiIconSvg('gift', 13, '#f59e0b')} Streak</div>
              <div style="font-size:12px;font-weight:800;">Day ${this.save.loginStreak}/7</div>
              <div style="font-size:10px;color:${this.save.loginClaimedToday ? 'var(--muted)' : 'var(--rose)'};font-weight:800;">
                ${this.save.loginClaimedToday ? 'Claimed' : 'Claim Now'}
              </div>
            </button>

            <button class="quick-tile" id="btn-open-leaderboard">
              <div class="tile-head" style="color:var(--cyan);">${uiIconSvg('trophy', 13, '#38bdf8')} Ranks</div>
              <div style="font-size:12px;font-weight:800;">${this.fmtTime(this.save.bestEndlessSec)}</div>
              <div style="font-size:10px;color:var(--muted);font-weight:800;">Global & Local</div>
            </button>

            <button class="quick-tile" data-go-tab="vault" style="border-color:${unclaimedCodex > 0 ? '#a855f7' : 'var(--border)'};">
              <div class="tile-head" style="color:#c084fc;">${uiIconSvg('codex', 13, '#c084fc')} Codex</div>
              <div style="font-size:12px;font-weight:800;">${this.save.discoveredRelics.length}/${RELICS.length} Relics</div>
              <div style="font-size:10px;color:${unclaimedCodex > 0 ? '#fbbf24' : 'var(--muted)'};font-weight:800;">
                ${unclaimedCodex > 0 ? `+${unclaimedCodex * 30} Shards` : `${this.save.discoveredEvos.length}/${WEAPONS.length} Evos`}
              </div>
            </button>

            <button class="quick-tile" data-go-tab="mastery">
              <div class="tile-head" style="color:#fbbf24;">${uiIconSvg('crown', 13, '#fbbf24')} Mastery</div>
              <div style="font-size:12px;font-weight:800;">Tier ${Math.min(30, Math.floor(this.save.passXp / 100))}/30</div>
              <div style="font-size:10px;color:${this.hasUnclaimedMasteryTiers() ? 'var(--green)' : 'var(--muted)'};font-weight:800;">
                ${this.hasUnclaimedMasteryTiers() ? 'Reward Ready!' : 'All 30 Free'}
              </div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderHeroesTab(): string {
    return `
      <div class="heroes-grid">
        ${HEROES.map((h) => {
          const unlocked = this.save.unlockedHeroes.includes(h.id);
          const selected = this.save.selectedHero === h.id;
          const lv = this.save.heroLevels[h.id] || 1;
          const upgCost = 350 + lv * 220;
          const startW = WEAPONS.find((w) => w.id === h.startingWeapon);

          return `
            <div class="card ${selected ? 'glow-cyan' : ''}">
              <div style="display:flex;align-items:center;gap:12px;">
                <div>${heroPortraitSvg(h.id, 62, 'signature')}</div>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <strong style="font-size:16px;">${h.name}</strong>
                    <span class="badge-tag" style="background:${h.accentColor}22;color:${h.accentColor};">${h.title}</span>
                  </div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px;">${h.description}</div>
                  <div style="font-size:11px;font-weight:800;color:#fbbf24;margin-top:4px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;">
                    <span style="display:inline-flex;align-items:center;gap:3px;">${weaponIconSvg(h.startingWeapon, 14)} ${startW?.name || ''}</span>
                    <span>• Ult: ${h.ultName}</span>
                  </div>
                  <div style="font-size:10px;color:var(--cyan);font-weight:800;margin-top:2px;">Perk: ${h.perkLabel}</div>
                </div>
              </div>

              <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:4px;">
                ${
                  unlocked
                    ? `
                  <button class="btn ${selected ? 'btn-green' : 'btn-primary'}" style="flex:1;" data-select-hero="${h.id}">
                    ${selected ? `${uiIconSvg('check', 14)} SELECTED` : 'SELECT HERO'}
                  </button>
                  <button class="btn btn-amber" data-upgrade-hero="${h.id}" ${this.save.coins < upgCost ? 'disabled' : ''}>
                    Lv.${lv + 1} (${this.fmtNum(upgCost)})
                  </button>
                `
                    : `
                  <button class="btn btn-primary" style="flex:1;" data-unlock-hero="${h.id}" ${this.save.gems < h.unlockCostGems ? 'disabled' : ''}>
                    ${uiIconSvg('shard', 14)} Unlock (${h.unlockCostGems} Shards)
                  </button>
                `
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderForgeTab(): string {
    return `
      <div class="subtabs">
        <button class="subtab ${this.forgeSub === 'gear' ? 'active' : ''}" data-forge-sub="gear">${uiIconSvg('sword', 13)} Gear</button>
        <button class="subtab ${this.forgeSub === 'crates' ? 'active' : ''}" data-forge-sub="crates">${uiIconSvg('crate', 13)} Chests (${this.save.basicKeys + this.save.cyberKeys})</button>
        <button class="subtab ${this.forgeSub === 'talents' ? 'active' : ''}" data-forge-sub="talents">${uiIconSvg('bolt', 13)} Talents</button>
      </div>
      ${
        this.forgeSub === 'gear'
          ? this.renderForgeGear()
          : this.forgeSub === 'crates'
            ? this.renderForgeCrates()
            : this.renderForgeTalents()
      }
    `;
  }

  private renderForgeGear(): string {
    const slots = (['weapon', 'armor', 'helmet', 'boots', 'ring', 'core'] as const).map((sl) => {
      const uid = this.save.equipped[sl];
      const item = uid ? this.save.inventory.find((g) => g.uid === uid) : null;
      if (!item) {
        return `<div class="gear-slot-box"><span style="opacity:0.4;">${gearSlotIconSvg(sl, 22, '#94a3b8')}</span><small style="color:var(--muted);">${SLOT_LABELS[sl]}</small><small>Empty</small></div>`;
      }
      const rm = RARITY_META[item.rarity];
      return `
        <button class="gear-slot-box" data-gear-uid="${item.uid}" style="border-color:${rm.color};background:${rm.bg};color:var(--text);">
          <span>${gearSlotIconSvg(sl, 22, rm.color)}</span>
          <strong style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${item.name}</strong>
          <small style="color:${rm.color};font-weight:900;">Lv.${item.level} • ${rm.label}</small>
        </button>
      `;
    });

    const eqSet = new Set(Object.values(this.save.equipped).filter(Boolean));
    const mergeableCount = this.save.inventory.filter((g) => findMergeCandidates(this.save, g.uid).length >= 3).length;
    const commonSalvageCount = this.save.inventory.filter((g) => !eqSet.has(g.uid) && g.rarity === 'common').length;
    const filteredItems =
      this.gearFilter === 'all'
        ? this.save.inventory
        : this.save.inventory.filter((g) => g.slot === this.gearFilter);

    return `
      <div class="forge-layout">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <strong style="font-size:13px;">Equipped Gear (6 Slots)</strong>
            <span style="font-size:11px;color:var(--cyan);font-weight:800;display:inline-flex;align-items:center;gap:4px;">
              ${uiIconSvg('blueprint', 14)} ${this.save.blueprints} Blueprints
            </span>
          </div>
          <div class="equip-grid">${slots.join('')}</div>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:13px;">Backpack (${filteredItems.length}/${this.save.inventory.length})</strong>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-ghost" id="btn-salvage-common" style="padding:5px 8px;font-size:10px;" ${commonSalvageCount === 0 ? 'disabled' : ''}>
                ${uiIconSvg('salvage', 12)} Common (${commonSalvageCount})
              </button>
              <button class="btn btn-amber" id="btn-auto-merge" style="padding:5px 9px;font-size:10px;" ${mergeableCount === 0 ? 'disabled' : ''}>
                ${uiIconSvg('merge', 12)} Merge 3→1
              </button>
            </div>
          </div>
          <div class="filter-row">
            <button class="filter-chip ${this.gearFilter === 'all' ? 'active' : ''}" data-gear-filter="all">All</button>
            ${(['weapon', 'armor', 'helmet', 'boots', 'ring', 'core'] as const)
              .map(
                (sl) =>
                  `<button class="filter-chip ${this.gearFilter === sl ? 'active' : ''}" data-gear-filter="${sl}">${gearSlotIconSvg(sl, 12)} ${SLOT_LABELS[sl]}</button>`
              )
              .join('')}
          </div>
          <div class="inv-grid">
            ${filteredItems
              .map((item) => {
                const rm = RARITY_META[item.rarity];
                const isEq = this.save.equipped[item.slot] === item.uid;
                return `
                  <button class="inv-item" data-gear-uid="${item.uid}" style="border-color:${rm.color};background:${rm.bg};color:var(--text);">
                    <div>${gearSlotIconSvg(item.slot, 18, rm.color)}</div>
                    <div style="font-weight:800;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
                    <div style="font-size:10px;color:${rm.color};font-weight:900;">Lv.${item.level}${isEq ? ' • EQ' : ''}</div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderForgeCrates(): string {
    return `
      <div class="heroes-grid">
        <div class="card glow-purple">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:15px;">Cyber Supply Chest</strong>
              <div style="font-size:11px;color:var(--muted);">Pity Guarantee: <b>${Math.max(1, 10 - this.save.pityCounter)}</b> pulls to guaranteed Epic+</div>
            </div>
            <span class="badge-tag" style="background:rgba(168,85,247,0.3);color:#e9d5ff;">${uiIconSvg('key', 11, '#e9d5ff')} ${this.save.cyberKeys}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" style="flex:1;" id="btn-open-cyber-key" ${this.save.cyberKeys < 1 ? 'disabled' : ''}>Use Key</button>
            <button class="btn btn-primary" style="flex:1;" id="btn-open-cyber-1" ${this.save.gems < CRATE_COSTS.cyberGems ? 'disabled' : ''}>1x (${CRATE_COSTS.cyberGems} Shards)</button>
            <button class="btn btn-amber" style="flex:1;" id="btn-open-cyber-10" ${this.save.gems < CRATE_COSTS.cyberTenGems ? 'disabled' : ''}>10x (${CRATE_COSTS.cyberTenGems})</button>
          </div>
        </div>

        <div class="card glow-amber">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:15px;">Mythic Vault Chest</strong>
              <div style="font-size:11px;color:var(--muted);">100% chance for Epic / Legendary / Mythic gear!</div>
            </div>
          </div>
          <button class="btn btn-amber" id="btn-open-mythic" ${this.save.gems < CRATE_COSTS.mythicGems ? 'disabled' : ''}>
            ${uiIconSvg('shard', 14)} Open Mythic Vault (${CRATE_COSTS.mythicGems} Shards)
          </button>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="font-size:14px;">Basic Supply Chest</strong>
              <div style="font-size:11px;color:var(--muted);">Common to Rare gear for merging & salvage</div>
            </div>
            <span class="badge-tag" style="background:rgba(148,163,184,0.2);color:#e2e8f0;">${uiIconSvg('key', 11, '#e2e8f0')} ${this.save.basicKeys}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost" style="flex:1;" id="btn-open-basic-key" ${this.save.basicKeys < 1 ? 'disabled' : ''}>Use Key</button>
            <button class="btn btn-green" style="flex:1;" id="btn-open-basic-coin" ${this.save.coins < CRATE_COSTS.basicCoins ? 'disabled' : ''}>${this.fmtNum(CRATE_COSTS.basicCoins)} Gold</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderForgeTalents(): string {
    return `
      <div class="heroes-grid">
        ${TALENTS.map((t) => {
          const lv = this.save.talents[t.id] || 0;
          const maxed = lv >= t.maxLevel;
          const cost = t.baseCostCoins + lv * t.costStepCoins;
          return `
            <div class="card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:10px;">
              <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                <span class="talent-ico-box">${uiIconSvg(t.iconKey, 20, '#38bdf8')}</span>
                <div style="min-width:0;">
                  <div style="font-size:13px;font-weight:900;">${t.name} <span style="color:var(--cyan);">Lv.${lv}/${t.maxLevel}</span></div>
                  <div style="font-size:11px;color:var(--muted);">${t.desc}</div>
                </div>
              </div>
              <button class="btn btn-primary" data-talent-id="${t.id}" style="flex-shrink:0;" ${maxed || this.save.coins < cost ? 'disabled' : ''}>
                ${maxed ? 'MAX' : `${this.fmtNum(cost)}`}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderMasteryTab(): string {
    return `
      <div class="subtabs">
        <button class="subtab ${this.masterySub === 'track' ? 'active' : ''}" data-mastery-sub="track">${uiIconSvg('crown', 13)} Mastery Track</button>
        <button class="subtab ${this.masterySub === 'quests' ? 'active' : ''}" data-mastery-sub="quests">${uiIconSvg('calendar', 13)} Daily Quests</button>
        <button class="subtab ${this.masterySub === 'achievements' ? 'active' : ''}" data-mastery-sub="achievements">${uiIconSvg('trophy', 13)} Achievements</button>
      </div>
      ${
        this.masterySub === 'track'
          ? this.renderMasteryTrack()
          : this.masterySub === 'quests'
            ? this.renderDailyQuests()
            : this.renderAchievements()
      }
    `;
  }

  private renderMasteryTrack(): string {
    const curTier = Math.min(30, Math.floor(this.save.passXp / 100));
    const canClaimAny = this.hasUnclaimedMasteryTiers();
    const passOwned = this.save.seasonPassOwned;
    const passPrice = monetizationBridge.getDisplayPrice('starforge_season_pass', '€6.99');

    return `
      <div class="card glow-purple">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>
            <strong style="font-size:15px;">Starforge Season Pass • Tier ${curTier}/30</strong>
            <div style="font-size:11px;color:var(--muted);">Mastery XP: ${this.save.passXp} — ${passOwned ? 'Premium Track UNLOCKED!' : 'Unlock Premium Track for +2,800 bonus Shards & Cyber Keys!'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${
              !passOwned
                ? `<button class="btn btn-amber" data-buy-sku="starforge_season_pass" style="padding:7px 12px;font-size:12px;">${uiIconSvg('crown', 14)} Unlock Pass ${this.esc(passPrice)}</button>`
                : `<span class="badge-tag" style="background:rgba(139,92,246,0.28);color:#ddd6fe;">PREMIUM ACTIVE</span>`
            }
            ${
              canClaimAny
                ? `<button class="btn btn-green" id="btn-claim-all-mastery" style="padding:7px 12px;font-size:12px;">${uiIconSvg('gift', 14)} Claim All</button>`
                : ''
            }
          </div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round((this.save.passXp / 3000) * 100))}%;"></div></div>
      </div>

      <div class="heroes-grid">
        ${MASTERY_TIERS.map((mt) => {
          const unlocked = this.save.passXp >= mt.xpRequired;
          const claimed = this.save.passClaimedTiers.includes(mt.tier);
          const premClaimed = this.save.passPremiumClaimedTiers.includes(mt.tier);
          const premShards = mt.isMilestone ? 200 : 75;
          const premLabel = mt.isMilestone ? `+${premShards} Shards + 1 Cyber Key` : `+${premShards} Shards`;
          return `
            <div class="card ${mt.isMilestone ? 'glow-amber' : ''}" style="padding:9px 12px;gap:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;">
                <div>
                  <strong style="color:${mt.isMilestone ? '#fbbf24' : 'var(--text)'};">Tier ${mt.tier} ${mt.isMilestone ? '• MILESTONE' : ''}</strong>
                  <div style="font-size:11px;color:var(--cyan);font-weight:700;">FREE: ${mt.label}</div>
                </div>
                <button class="btn ${claimed ? 'btn-ghost' : unlocked ? 'btn-green' : 'btn-ghost'}" style="padding:6px 12px;font-size:11px;flex-shrink:0;" data-claim-mastery="${mt.tier}" ${!unlocked || claimed ? 'disabled' : ''}>
                  ${claimed ? 'Claimed' : unlocked ? 'Claim' : `${mt.xpRequired} XP`}
                </button>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.14);">
                <div style="color:#c084fc;font-weight:800;">★ PASS: ${premLabel}</div>
                ${
                  passOwned
                    ? `<button class="btn ${premClaimed ? 'btn-ghost' : unlocked ? 'btn-amber' : 'btn-ghost'}" style="padding:4px 10px;font-size:10px;" data-claim-prem-mastery="${mt.tier}" ${!unlocked || premClaimed ? 'disabled' : ''}>
                        ${premClaimed ? 'Claimed' : unlocked ? 'Claim Pass' : 'Locked'}
                      </button>`
                    : `<button class="btn btn-ghost" style="padding:4px 10px;font-size:10px;border-color:rgba(192,132,252,0.45);color:#ddd6fe;" data-buy-sku="starforge_season_pass">Unlock</button>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderDailyQuests(): string {
    return `
      <div class="heroes-grid">
        ${DAILY_QUESTS.map((q) => {
          const val = Math.min(q.target, this.save.quests[q.field]);
          const claimed = this.save.quests.claimedIds.includes(q.id);
          const ready = val >= q.target && !claimed;
          return `
            <div class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div style="flex:1;">
                  <strong style="font-size:13px;">${q.title} (${val}/${q.target})</strong>
                  <div style="font-size:11px;color:var(--cyan);">+${q.gems} Shards • +${q.coins} Gold • +${q.passXp} Mastery XP</div>
                </div>
                <button class="btn ${ready ? 'btn-green' : 'btn-ghost'}" data-claim-quest="${q.id}" ${!ready ? 'disabled' : ''}>
                  ${claimed ? uiIconSvg('check', 14) : ready ? 'Claim' : `${val}/${q.target}`}
                </button>
              </div>
              <div class="progress-track"><div class="progress-fill" style="width:${Math.round((val / q.target) * 100)}%;"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderAchievements(): string {
    const ctx = this.getAchievementContext();
    return `
      <div class="heroes-grid">
        ${ACHIEVEMENTS.map((a) => {
          const done = a.check(ctx);
          const claimed = this.save.claimedAchievements.includes(a.id);
          return `
            <div class="card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;">
              <div>
                <strong style="font-size:13px;">${a.title}</strong>
                <div style="font-size:11px;color:var(--muted);">${a.desc}</div>
                <div style="font-size:11px;color:var(--cyan);font-weight:800;">+${a.gems} Shards${a.cyberKeys ? ` • +${a.cyberKeys} Cyber Key` : ''}</div>
              </div>
              <button class="btn ${done && !claimed ? 'btn-green' : 'btn-ghost'}" data-claim-ach="${a.id}" ${!done || claimed ? 'disabled' : ''}>
                ${claimed ? uiIconSvg('check', 14) : done ? 'Claim' : 'Locked'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderVaultTab(): string {
    const hasNoAds = this.save.noAdsOwned || this.save.vipActive;
    const adGemsLeft = Math.max(0, ADMOB_CONFIG.dailyAdGemsLimit - this.save.adGemsUsedToday);
    const adKeysLeft = Math.max(0, ADMOB_CONFIG.dailyAdKeysLimit - this.save.adKeysUsedToday);
    const vipClaimedToday = this.save.vipLastClaimDay === getTodayDateKey();

    return `
      <div class="subtabs">
        <button class="subtab ${this.vaultSub === 'store' ? 'active' : ''}" data-vault-sub="store">★ Store</button>
        <button class="subtab ${this.vaultSub === 'evos' ? 'active' : ''}" data-vault-sub="evos">Evos (${this.save.discoveredEvos.length}/${WEAPONS.length})</button>
        <button class="subtab ${this.vaultSub === 'relics' ? 'active' : ''}" data-vault-sub="relics">Relics (${this.save.discoveredRelics.length}/${RELICS.length})</button>
        <button class="subtab ${this.vaultSub === 'bosses' ? 'active' : ''}" data-vault-sub="bosses">Bosses (${this.save.defeatedBosses.length}/6)</button>
      </div>

      ${
        this.vaultSub === 'store'
          ? `
            ${
              !this.save.firstPurchaseBonusClaimed
                ? `
                  <div class="card glow-amber" style="flex-direction:row;align-items:center;justify-content:space-between;gap:10px;">
                    <div>
                      <strong style="font-size:13px;color:#fbbf24;">★ FIRST-PURCHASE BONUS ACTIVE</strong>
                      <div style="font-size:11px;color:var(--text);">Any Store purchase also grants <b>+300 Bonus Shards & 2× Cyber Keys</b> FREE!</div>
                    </div>
                  </div>
                `
                : ''
            }

            ${
              this.save.vipActive
                ? `
                  <div class="card glow-purple" style="flex-direction:row;align-items:center;justify-content:space-between;gap:10px;">
                    <div>
                      <strong style="font-size:13px;color:#f472b6;">VIP Commander Daily Allowance</strong>
                      <div style="font-size:11px;color:var(--muted);">+100 Star Shards every day • +25% XP & Gold active</div>
                    </div>
                    <button class="btn ${vipClaimedToday ? 'btn-ghost' : 'btn-amber'}" id="btn-vip-daily-claim" ${vipClaimedToday ? 'disabled' : ''}>
                      ${vipClaimedToday ? 'Claimed' : '+100 Shards'}
                    </button>
                  </div>
                `
                : ''
            }

            <div class="card glow-cyan" style="gap:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <div>
                  <strong style="font-size:14px;">Daily Free Supplies</strong>
                  <div style="font-size:11px;color:var(--muted);">Free daily grant + ${hasNoAds ? 'instant No-Ads claims!' : 'optional Rewarded Video supplies'}</div>
                </div>
                <button class="btn ${this.save.freeGiftClaimedToday ? 'btn-ghost' : 'btn-green'}" id="btn-free-daily-gift" style="padding:6px 11px;font-size:11px;" ${this.save.freeGiftClaimedToday ? 'disabled' : ''}>
                  ${this.save.freeGiftClaimedToday ? `${uiIconSvg('check', 13)} Claimed` : `${uiIconSvg('gift', 13)} +1.5K Gold & 50 Shards`}
                </button>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary" id="btn-ad-free-gems" style="flex:1;min-width:140px;font-size:11px;padding:7px 10px;" ${adGemsLeft <= 0 ? 'disabled' : ''}>
                  ${hasNoAds ? '⚡' : '📺'} +${ADMOB_CONFIG.dailyAdGemsAmount} Shards (${adGemsLeft}/${ADMOB_CONFIG.dailyAdGemsLimit})
                </button>
                <button class="btn btn-amber" id="btn-ad-free-key" style="flex:1;min-width:140px;font-size:11px;padding:7px 10px;" ${adKeysLeft <= 0 ? 'disabled' : ''}>
                  ${hasNoAds ? '⚡' : '📺'} +1 Cyber Key (${adKeysLeft}/${ADMOB_CONFIG.dailyAdKeysLimit})
                </button>
              </div>
            </div>

            <div class="heroes-grid">
              ${SHOP_SKUS.map((sku) => {
                const owned = Boolean(sku.oneTimeOnly && this.save.purchasedSkus.includes(sku.sku));
                const displayPrice = monetizationBridge.getDisplayPrice(sku.sku, sku.fallbackPrice);
                const firstBonus =
                  sku.firstTimeBonusGems && !this.save.purchasedSkus.includes(sku.sku)
                    ? ` (+${sku.firstTimeBonusGems} 1st-Buy)`
                    : '';
                return `
                  <div class="card" style="border-color:${sku.highlightColor}88;gap:7px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                      <strong style="font-size:14px;color:${sku.highlightColor};">${this.esc(sku.title)}</strong>
                      <span class="badge-tag" style="background:${sku.highlightColor}28;color:${sku.highlightColor};">${this.esc(sku.badge)}</span>
                    </div>
                    <div style="font-size:11px;color:var(--muted);line-height:1.35;">${this.esc(sku.subtitle)}${firstBonus}</div>
                    <button class="btn ${owned ? 'btn-ghost' : 'btn-primary'}" style="${owned ? '' : `background:linear-gradient(135deg,${sku.highlightColor},#0f172a);border-color:${sku.highlightColor};`}" data-buy-sku="${sku.sku}" ${owned ? 'disabled' : ''}>
                      ${owned ? `${uiIconSvg('check', 14)} OWNED` : `Buy • ${this.esc(displayPrice)}`}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>

            <div style="display:flex;justify-content:center;padding:4px 0 8px;">
              <button class="btn btn-ghost" id="btn-restore-purchases" style="font-size:11px;padding:6px 14px;">
                Restore Google Play Purchases
              </button>
            </div>
          `
          : this.vaultSub === 'evos'
          ? `
            <div class="heroes-grid">
              ${WEAPONS.map((w) => {
                const pDef = PASSIVES.find((p) => p.id === w.evoPassive)!;
                const disc = this.save.discoveredEvos.includes(w.id);
                const claimed = this.save.claimedEvoCodex.includes(w.id);
                return `
                  <div class="codex-row ${disc ? 'discovered' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                      <strong style="font-size:13px;color:${w.color};display:inline-flex;align-items:center;gap:5px;">
                        ${weaponIconSvg(w.id, 17)} ${w.name} → ${w.evoName}
                      </strong>
                      ${
                        disc && !claimed
                          ? `<button class="btn btn-amber" data-claim-codex="${w.id}" style="padding:4px 8px;font-size:10px;">+30 Shards</button>`
                          : `<span class="badge-tag" style="background:${disc ? 'var(--green)' : 'rgba(148,163,184,0.2)'};color:#fff;">${claimed ? 'Claimed' : disc ? 'Discovered' : 'Locked'}</span>`
                      }
                    </div>
                    <div style="font-size:11px;color:var(--text);">Required Passive: <b style="color:${pDef.color};">${pDef.name}</b></div>
                    <div style="font-size:10px;color:var(--muted);">${w.evoDesc}</div>
                  </div>
                `;
              }).join('')}
            </div>
          `
          : this.vaultSub === 'relics'
            ? `
              <div class="heroes-grid">
                ${RELICS.map((r) => {
                  const disc = this.save.discoveredRelics.includes(r.id);
                  return `
                    <div class="codex-row ${disc ? 'discovered' : ''}" style="border-color:${disc ? `${r.color}88` : 'var(--border)'};">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <strong style="font-size:13px;color:${r.color};display:inline-flex;align-items:center;gap:6px;">
                          ${relicIconSvg(r.id, 20)} ${r.name}
                        </strong>
                        <span class="badge-tag" style="background:${disc ? `${r.color}33` : 'rgba(148,163,184,0.18)'};color:${disc ? r.color : 'var(--muted)'};">
                          ${disc ? 'Discovered' : 'Shrine Drop'}
                        </span>
                      </div>
                      <div style="font-size:11px;color:var(--muted);">${r.shortDesc}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            `
            : `
              <div class="heroes-grid">
                ${BOSS_BESTIARY.map((b) => {
                  const defeated = this.save.defeatedBosses.includes(b.archetype);
                  return `
                    <div class="codex-row ${defeated ? 'discovered' : ''}" style="border-color:${defeated ? `${b.color}77` : 'var(--border)'};">
                      <div style="display:flex;align-items:center;gap:10px;">
                        ${bossEmblemSvg(b.archetype, 40)}
                        <div style="flex:1;min-width:0;">
                          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                            <strong style="font-size:13px;color:${b.color};">${b.name}</strong>
                            <span class="badge-tag" style="background:${defeated ? 'var(--green)' : 'rgba(148,163,184,0.2)'};color:#fff;">
                              ${defeated ? 'Defeated' : 'Undefeated'}
                            </span>
                          </div>
                          <div style="font-size:10px;color:var(--muted);">${b.chapterName}</div>
                        </div>
                      </div>
                      <div style="font-size:11px;color:var(--text);"><b>Signature:</b> ${b.signatureAttack}</div>
                      <div style="font-size:10px;color:#fca5a5;"><b>Phase 2:</b> ${b.phase2Text}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            `
      }
    `;
  }

  // ---- INCREMENTAL BATTLE HUD UPDATES (ZERO innerHTML WIPE!) ----

  private updateBattleHudOnly(): void {
    const s = this.hudSnap;
    if (!s) return;

    const xpFill = this.root.querySelector<HTMLElement>('#hud-xp-fill');
    if (xpFill) xpFill.style.width = `${Math.round(s.xpFrac * 100)}%`;

    const lvEl = this.root.querySelector<HTMLElement>('#hud-lv');
    if (lvEl) lvEl.textContent = `Lv.${s.level}`;

    const hpEl = this.root.querySelector<HTMLElement>('#hud-hp');
    if (hpEl) hpEl.textContent = `${s.hp}/${s.maxHp}`;

    const shEl = this.root.querySelector<HTMLElement>('#hud-shield');
    const shVal = this.root.querySelector<HTMLElement>('#hud-shield-val');
    if (shEl && shVal) {
      shEl.hidden = s.shieldHp <= 0;
      if (s.shieldHp > 0) shVal.textContent = String(s.shieldHp);
    }

    const timerEl = this.root.querySelector<HTMLElement>('#hud-timer');
    if (timerEl) {
      timerEl.textContent = s.isEndless
        ? `∞ ${this.fmtTime(s.elapsedSec)}`
        : s.isBossRush
          ? `Boss ${Math.max(1, s.bossRushStage)}/6`
          : this.fmtTime(Math.max(0, s.durationSec - s.elapsedSec));
    }

    const killsEl = this.root.querySelector<HTMLElement>('#hud-kills');
    if (killsEl) killsEl.textContent = String(s.kills);

    const coinsEl = this.root.querySelector<HTMLElement>('#hud-coins');
    if (coinsEl) coinsEl.textContent = String(s.coins);

    const waveEl = this.root.querySelector<HTMLElement>('#hud-wave');
    if (waveEl) waveEl.textContent = `Wave ${s.threatLevel} (${s.enemyPowerPct}%)`;

    const comboEl = this.root.querySelector<HTMLElement>('#hud-combo');
    if (comboEl) {
      comboEl.hidden = s.combo < 3;
      if (s.combo >= 3) comboEl.textContent = `${s.combo}x COMBO`;
    }

    // Diff weapon badges only when loadout changes
    const wKey = s.weapons.map((w) => `${w.id}:${w.lv}:${w.evolved ? 1 : 0}`).join('|');
    if (wKey !== this.lastWeaponKey) {
      this.lastWeaponKey = wKey;
      const wSlot = this.root.querySelector<HTMLElement>('#hud-weapons');
      if (wSlot) {
        wSlot.innerHTML = s.weapons
          .map(
            (w) =>
              `<span class="badge-tag hud-w-badge" style="border-color:${w.evolved ? '#fbbf24' : 'var(--border)'};">${weaponIconSvg(w.id, 13)} ${w.evolved ? 'EVO' : `L${w.lv}`}</span>`
          )
          .join('');
      }
    }

    const rKey = s.relics.join('|');
    if (rKey !== this.lastRelicKey) {
      this.lastRelicKey = rKey;
      const rSlot = this.root.querySelector<HTMLElement>('#hud-relics');
      if (rSlot) {
        rSlot.innerHTML = s.relics.map((id) => `<span class="hud-relic-dot">${relicIconSvg(id, 13)}</span>`).join('');
      }
    }

    const bossBar = this.root.querySelector<HTMLElement>('#hud-boss-bar');
    if (bossBar) {
      bossBar.hidden = !s.bossName;
      if (s.bossName) {
        const bn = this.root.querySelector<HTMLElement>('#hud-boss-name');
        const bp = this.root.querySelector<HTMLElement>('#hud-boss-phase');
        const bf = this.root.querySelector<HTMLElement>('#hud-boss-fill');
        if (bn) bn.textContent = s.bossName;
        if (bp) bp.hidden = !s.bossEnraged;
        if (bf) bf.style.width = `${Math.round(s.bossHpFrac * 100)}%`;
      }
    }

    const objBar = this.root.querySelector<HTMLElement>('#hud-obj-bar');
    if (objBar) {
      objBar.hidden = !s.objectiveLabel;
      if (s.objectiveLabel) {
        const on = this.root.querySelector<HTMLElement>('#hud-obj-name');
        const op = this.root.querySelector<HTMLElement>('#hud-obj-pct');
        const ofill = this.root.querySelector<HTMLElement>('#hud-obj-fill');
        if (on) on.textContent = `${s.objectiveLabel} — Hold Circle`;
        if (op) op.textContent = `${Math.round(s.objectiveProgress * 100)}%`;
        if (ofill) ofill.style.width = `${Math.round(s.objectiveProgress * 100)}%`;
      }
    }

    const ultBtn = this.root.querySelector<HTMLElement>('#btn-ult');
    const ultLbl = this.root.querySelector<HTMLElement>('#lbl-ult');
    if (ultBtn && ultLbl) {
      ultLbl.textContent = s.ultCharge >= 100 ? 'READY' : `${s.ultCharge}%`;
      ultBtn.classList.toggle('ready-ult', s.ultCharge >= 100);
    }
    const dashBtn = this.root.querySelector<HTMLElement>('#btn-dash');
    if (dashBtn) {
      dashBtn.style.opacity = s.dashReadyFrac >= 1 ? '1' : '0.48';
    }
  }

  private updateBattleBannersOnly(): void {
    const slot = this.root.querySelector<HTMLElement>('#battle-banners');
    if (!slot) return;
    let html = '';
    if (this.waveBannerText) {
      html += `<div class="wave-alert-banner">${uiIconSvg('alert', 14, '#fef08a')} ${this.esc(this.waveBannerText)}</div>`;
    }
    if (this.bossBannerText) {
      html += `<div class="boss-alert-banner">${uiIconSvg('skull', 16, '#ffffff')} ${this.esc(this.bossBannerText)}</div>`;
    }
    slot.innerHTML = html;
  }

  private renderBattleOverlays(): void {
    const slot = this.root.querySelector<HTMLElement>('#battle-overlays');
    if (!slot) return;

    let html = '';
    const m = this.battleModal;

    if (m?.kind === 'draft') {
      html += `
        <div class="modal-backdrop">
          <div class="modal-card">
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--cyan);font-weight:900;letter-spacing:0.6px;">LEVEL UP • CHOOSE UPGRADE</div>
              <div style="font-size:19px;font-weight:900;">Level ${this.hudSnap?.level || 2}</div>
            </div>
            ${m.options
              .map((o, i) => {
                const canBanish = m.banishesLeft > 0 && o.kind !== 'heal_coins' && !o.isEvo;
                const ico =
                  o.kind === 'weapon' || o.kind === 'evo'
                    ? weaponIconSvg(o.id as WeaponId, 24)
                    : o.kind === 'passive'
                      ? uiIconSvg('shard', 22, o.color)
                      : uiIconSvg('heart', 22, '#10b981');
                return `
                  <div class="draft-row-wrap">
                    <button class="draft-card ${o.isEvo ? 'evo' : ''}" data-pick-draft="${i}">
                      <div class="draft-ico-box">${ico}</div>
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:14px;font-weight:900;color:${o.isEvo ? '#fbbf24' : 'var(--text)'};">
                          ${this.esc(o.name)} ${o.isEvo ? '★ EVO' : o.nextLv > 0 ? `(Lv.${o.nextLv})` : ''}
                        </div>
                        <div style="font-size:11px;color:var(--muted);">${this.esc(o.subtitle)}</div>
                      </div>
                    </button>
                    ${
                      canBanish
                        ? `<button class="banish-side-btn" data-banish-draft="${i}" title="Banish from this run">${uiIconSvg('banish', 16, '#fb7185')}<span>Banish</span></button>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
            <div style="display:flex;gap:8px;justify-content:center;align-items:center;">
              ${
                m.rerollsLeft > 0
                  ? `<button class="btn btn-ghost" id="btn-draft-reroll" style="flex:1;">
                      ${uiIconSvg('reroll', 14, '#38bdf8')} Reroll (${m.rerollsLeft})
                    </button>`
                  : `<button class="btn btn-amber" id="btn-draft-ad-reroll" style="flex:1;">
                      ${this.save.noAdsOwned || this.save.vipActive ? '⚡ Free Reroll (No-Ads)' : '📺 Watch Ad for Reroll'}
                    </button>`
              }
              <span class="badge-tag" style="background:rgba(244,63,94,0.16);color:#fda4af;padding:7px 10px;">
                ${uiIconSvg('banish', 12, '#fda4af')} Banishes: ${m.banishesLeft}
              </span>
            </div>
          </div>
        </div>
      `;
    } else if (m?.kind === 'relic') {
      html += `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:#fbbf24;">
            <div style="text-align:center;">
              <div style="font-size:11px;color:#fbbf24;font-weight:900;letter-spacing:0.6px;">STARFORGE SHRINE CLAIMED</div>
              <div style="font-size:19px;font-weight:900;">Select a Run Relic</div>
            </div>
            ${m.choices
              .map(
                (r) => `
              <button class="draft-card" data-pick-relic="${r.id}" style="border-color:${r.color}88;">
                <div class="draft-ico-box" style="border-color:${r.color}66;">${relicIconSvg(r.id, 24)}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:900;color:${r.color};">${this.esc(r.name)}</div>
                  <div style="font-size:11px;color:var(--muted);">${this.esc(r.shortDesc)}</div>
                </div>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (m?.kind === 'chest') {
      html += `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:#fbbf24;text-align:center;">
            <div>${uiIconSvg('chest', 32, '#fbbf24')}</div>
            <div style="font-size:18px;font-weight:900;color:#fbbf24;">ELITE JACKPOT CHEST</div>
            <div style="font-size:13px;color:var(--green);font-weight:800;">+${m.coins} Bonus Gold</div>
            ${m.rewards
              .map(
                (r) => `
              <div class="card" style="text-align:left;background:var(--bg-card-2);">
                <strong style="color:${r.isEvo ? '#fbbf24' : 'var(--cyan)'};">${this.esc(r.name)} (Lv.${r.nextLv})</strong>
                <small style="color:var(--muted);">${this.esc(r.subtitle)}</small>
              </div>
            `
              )
              .join('')}
            <button class="btn btn-amber" id="btn-close-chest">KEEP FIGHTING</button>
          </div>
        </div>
      `;
    } else if (m?.kind === 'revive') {
      const hasNoAds = this.save.noAdsOwned || this.save.vipActive;
      html += `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:var(--rose);text-align:center;">
            <div>${uiIconSvg('skull', 36, '#f43f5e')}</div>
            <div style="font-size:20px;font-weight:900;">SECOND CHANCE</div>
            <div style="font-size:12px;color:var(--muted);">Revive with 100% HP & a clearing shockwave!</div>
            <button class="btn btn-green" id="btn-revive-ad">
              ${hasNoAds ? '⚡ FREE REVIVE (No-Ads Perk)' : '📺 Watch Ad to Revive (FREE)'}
            </button>
            <button class="btn btn-primary" id="btn-revive-token" ${this.save.reviveTokens < 1 && this.save.gems < 35 ? 'disabled' : ''}>
              ${
                this.save.reviveTokens > 0
                  ? `${uiIconSvg('flame', 15)} Use Revive Token (${this.save.reviveTokens} left)`
                  : `${uiIconSvg('shard', 15)} Revive (35 Star Shards)`
              }
            </button>
            <button class="btn btn-ghost" id="btn-give-up">End Run & Claim Loot</button>
          </div>
        </div>
      `;
    } else if (m?.kind === 'pause') {
      const loadout = this.engine?.getLoadoutSnapshot();
      const passiveIds = new Set(loadout?.passives.map((p) => p.id) || []);
      html += `
        <div class="modal-backdrop">
          <div class="modal-card" style="text-align:center;">
            <div style="font-size:18px;font-weight:900;">PAUSED</div>
            ${
              loadout
                ? `
              <div class="card" style="text-align:left;background:var(--bg-card-2);gap:6px;">
                <div style="font-size:11px;font-weight:900;color:var(--cyan);">LOADOUT & EVOLUTION HINTS</div>
                ${loadout.weapons
                  .map((w) => {
                    const def = WEAPONS.find((x) => x.id === w.id)!;
                    const pDef = PASSIVES.find((p) => p.id === def.evoPassive)!;
                    const hasReq = passiveIds.has(def.evoPassive);
                    return `
                      <div style="font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <span style="display:inline-flex;align-items:center;gap:4px;">${weaponIconSvg(w.id, 14)} <b>${w.evolved ? def.evoName : def.name}</b> (${w.evolved ? 'EVO' : `Lv.${w.lv}/5`})</span>
                        <span style="color:${w.evolved ? '#fbbf24' : hasReq ? 'var(--green)' : 'var(--muted)'};font-weight:800;">
                          ${w.evolved ? 'MAX' : `Evo: ${pDef.name}${hasReq ? ' ✓' : ''}`}
                        </span>
                      </div>
                    `;
                  })
                  .join('')}
                ${
                  loadout.relics.length > 0
                    ? `<div style="font-size:11px;color:#fbbf24;margin-top:3px;">Relics: ${loadout.relics
                        .map((id) => RELICS.find((r) => r.id === id)?.name || id)
                        .join(' • ')}</div>`
                    : ''
                }
              </div>
            `
                : ''
            }
            <button class="btn btn-primary" id="btn-resume-battle">${uiIconSvg('play', 14)} Resume</button>
            <button class="btn btn-rose" id="btn-quit-battle">End Run (Keep Loot)</button>
          </div>
        </div>
      `;
    }

    slot.innerHTML = html;

    slot.querySelectorAll<HTMLElement>('[data-pick-draft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.pickDraft);
        if (this.battleModal?.kind === 'draft') {
          const opt = this.battleModal.options[idx];
          this.battleModal = null;
          this.renderBattleOverlays();
          this.engine?.applyDraftOption(opt);
        }
      });
    });

    slot.querySelectorAll<HTMLElement>('[data-banish-draft]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const idx = Number(btn.dataset.banishDraft);
        if (this.battleModal?.kind === 'draft' && this.engine) {
          const opt = this.battleModal.options[idx];
          const next = this.engine.banishOption(opt);
          if (next) {
            this.battleModal = {
              kind: 'draft',
              options: next.options,
              rerollsLeft: next.rerollsLeft,
              banishesLeft: next.banishesLeft,
            };
            this.renderBattleOverlays();
          }
        }
      });
    });

    slot.querySelector('#btn-draft-reroll')?.addEventListener('click', () => {
      if (this.battleModal?.kind !== 'draft' || !this.engine) return;
      const next = this.engine.useReroll();
      if (next) {
        this.battleModal = {
          kind: 'draft',
          options: next.options,
          rerollsLeft: next.rerollsLeft,
          banishesLeft: next.banishesLeft,
        };
        this.renderBattleOverlays();
      }
    });

    slot.querySelector('#btn-draft-ad-reroll')?.addEventListener('click', async () => {
      if (this.battleModal?.kind !== 'draft' || !this.engine) return;
      const res = await monetizationBridge.showRewardedAd('levelup_reroll', this.save.noAdsOwned || this.save.vipActive);
      if (!res.rewarded) {
        this.showToast('Ad not completed');
        return;
      }
      const next = this.engine.useBonusReroll();
      this.battleModal = {
        kind: 'draft',
        options: next.options,
        rerollsLeft: next.rerollsLeft,
        banishesLeft: next.banishesLeft,
      };
      this.renderBattleOverlays();
    });

    slot.querySelectorAll<HTMLElement>('[data-pick-relic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rId = btn.dataset.pickRelic as RelicDef['id'];
        this.battleModal = null;
        this.renderBattleOverlays();
        this.engine?.applyRelicChoice(rId);
      });
    });

    slot.querySelector('#btn-close-chest')?.addEventListener('click', () => {
      this.battleModal = null;
      this.renderBattleOverlays();
      this.engine?.setPaused(false);
    });

    slot.querySelector('#btn-revive-ad')?.addEventListener('click', async () => {
      const res = await monetizationBridge.showRewardedAd('in_run_revive', this.save.noAdsOwned || this.save.vipActive);
      if (!res.rewarded) {
        this.showToast('Watch the full video to revive!');
        return;
      }
      this.battleModal = null;
      this.renderBattleOverlays();
      this.engine?.revivePlayer();
    });

    slot.querySelector('#btn-revive-token')?.addEventListener('click', () => {
      if (this.save.reviveTokens > 0) {
        this.save.reviveTokens -= 1;
      } else if (this.save.gems >= 35) {
        this.save.gems -= 35;
      } else {
        return;
      }
      saveGame(this.save);
      this.battleModal = null;
      this.renderBattleOverlays();
      this.engine?.revivePlayer();
    });

    slot.querySelector('#btn-give-up')?.addEventListener('click', () => {
      this.battleModal = null;
      this.engine?.abortAndFinish(false);
    });

    slot.querySelector('#btn-resume-battle')?.addEventListener('click', () => {
      this.battleModal = null;
      this.renderBattleOverlays();
      this.engine?.setPaused(false);
    });

    slot.querySelector('#btn-quit-battle')?.addEventListener('click', () => {
      this.battleModal = null;
      this.engine?.abortAndFinish(false);
    });
  }

  private bindBattleControlEvents(): void {
    this.root.querySelector('#btn-dash')?.addEventListener('click', () => this.engine?.triggerDash());
    this.root.querySelector('#btn-ult')?.addEventListener('click', () => this.engine?.triggerUltimate());
    // Bound ONCE on battle mount (fixes double Pause listener bug!)
    this.root.querySelector('#btn-battle-pause')?.addEventListener('click', () => {
      if (!this.engine || this.battleModal) return;
      this.engine.setPaused(true);
      this.battleModal = { kind: 'pause' };
      this.renderBattleOverlays();
    });
  }

  private renderModalHtml(): string {
    const m = this.modal;
    if (!m) return '';

    if (m.kind === 'resume_run') {
      const snap = m.snapshot;
      const hero = HEROES.find((h) => h.id === snap.heroId) || HEROES[0];
      const ch = snap.dailyDateKey
        ? { name: `Daily Starforge (${snap.dailyDateKey})` }
        : CHAPTERS.find((c) => c.id === snap.chapterId) || CHAPTERS[0];
      const asc = ASCENSIONS.find((a) => a.tier === snap.ascension) || ASCENSIONS[0];
      return `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:var(--cyan);text-align:center;">
            <div style="display:flex;justify-content:center;">${heroPortraitSvg(hero.id, 60, snap.weaponStyle)}</div>
            <div style="font-size:18px;font-weight:900;">Resume Saved Run?</div>
            <div style="font-size:12px;color:var(--muted);">
              <b>${this.esc(ch.name)}</b> • Ascension ${asc.roman}
            </div>
            <div class="card" style="background:var(--bg-card-2);font-size:12px;">
              <div><b>${hero.name}</b> • Lv.${snap.level} • Time ${this.fmtTime(Math.floor(snap.elapsedSec))}</div>
              <div style="color:var(--cyan);">Kills: ${snap.kills} • Weapons: ${snap.weapons.length} • Relics: ${snap.relics.length}</div>
            </div>
            <button class="btn btn-primary" id="btn-resume-saved-run">${uiIconSvg('play', 15)} Resume Battle</button>
            <button class="btn btn-ghost" id="btn-discard-saved-run">Discard Saved Run</button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'chapters') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;">Select Arena / Chapter</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">${uiIconSvg('close', 16)}</button>
            </div>
            ${CHAPTERS.map((c) => {
              const unlocked = c.mode !== 'chapter' || c.id <= this.save.highestChapterUnlocked;
              const cleared = this.save.clearedChapters.includes(c.id);
              const extraMeta =
                c.mode === 'boss_rush'
                  ? `• Clears: ${this.save.bossRushClears}${this.save.bestBossRushSec > 0 ? ` (Best ${this.fmtTime(this.save.bestBossRushSec)})` : ''}`
                  : c.mode === 'endless' && this.save.bestEndlessSec > 0
                    ? `• Best: ${this.fmtTime(this.save.bestEndlessSec)}`
                    : '';
              return `
                <button class="card" data-pick-chapter="${c.id}" style="text-align:left;cursor:pointer;border-color:${c.id === this.selectedChapterId ? c.accentColor : 'var(--border)'};opacity:${unlocked ? 1 : 0.45};" ${!unlocked ? 'disabled' : ''}>
                  <div style="display:flex;justify-content:space-between;width:100%;">
                    <strong style="color:${c.accentColor};">${c.name} ${cleared ? '✓' : ''}</strong>
                    <small style="color:var(--muted);">Power ${c.recommendedPower}</small>
                  </div>
                  <div style="font-size:11px;color:var(--muted);">${c.subtitle}</div>
                  <div style="font-size:10px;color:#fbbf24;">Boss: ${c.bossName} • ${this.fmtNum(c.rewardCoins)} Gold & ${c.rewardGems} Shards ${extraMeta}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (m.kind === 'patrol') {
      const p = computePatrolEarnings(this.save);
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card" style="text-align:center;border-color:var(--green);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;color:var(--green);">Patrol Earnings (${p.minutes}m / max 12h)</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">${uiIconSvg('close', 16)}</button>
            </div>
            <div class="card" style="background:var(--bg-card-2);">
              <div style="font-size:19px;font-weight:900;">${uiIconSvg('coin', 18)} +${this.fmtNum(p.coins)} Gold</div>
              <div style="font-size:14px;font-weight:800;color:var(--cyan);">${uiIconSvg('blueprint', 16)} +${p.blueprints} Blueprints</div>
              <div style="font-size:11px;color:var(--muted);">Premium Edition full 1.5x offline patrol payout included!</div>
            </div>
            <button class="btn btn-green" id="btn-patrol-claim">Collect Patrol Loot</button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'lucky_wheel') {
      const freeLeft = Math.max(0, CRATE_COSTS.wheelFreeLimit - this.save.wheelSpinsFreeUsedToday);
      const sliceDeg = 360 / WHEEL_REWARDS.length;
      const gradientStops = WHEEL_REWARDS.map(
        (s, i) => `${s.color} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`
      ).join(', ');

      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card" style="text-align:center;border-color:#fbbf24;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;color:#fbbf24;">Starforge Lucky Wheel</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close" ${m.spinning ? 'disabled' : ''}>${uiIconSvg('close', 16)}</button>
            </div>

            <div class="wheel-stage">
              <div class="wheel-pointer"></div>
              <div class="wheel-disc" id="wheel-disc" style="background:conic-gradient(${gradientStops});transform:rotate(${m.rotation}deg);">
                ${WHEEL_REWARDS.map((s, i) => {
                  const angle = i * sliceDeg + sliceDeg / 2;
                  return `<div class="wheel-slice-label" style="transform:rotate(${angle - 90}deg) translate(32px,-50%);">${s.shortLabel}</div>`;
                }).join('')}
              </div>
              <div class="wheel-center">${uiIconSvg('bolt', 20, '#fbbf24')}</div>
            </div>

            ${
              m.lastResult
                ? `<div class="card glow-amber" style="padding:8px;font-size:13px;font-weight:900;color:#fbbf24;">Won: ${m.lastResult.label}!</div>`
                : `<div style="font-size:11px;color:var(--muted);">3 Free Daily Spins • Win Gold, Shards, Cyber Keys & 350 Shards Jackpot!</div>`
            }

            <div style="display:flex;flex-direction:column;gap:7px;">
              ${
                freeLeft > 0
                  ? `<button class="btn btn-green" id="btn-wheel-free" ${m.spinning ? 'disabled' : ''}>Free Daily Spin (${freeLeft}/${CRATE_COSTS.wheelFreeLimit} left)</button>`
                  : `<button class="btn btn-amber" id="btn-wheel-gold" ${m.spinning || this.save.coins < CRATE_COSTS.wheelGoldCost ? 'disabled' : ''}>Spin with Gold (${this.fmtNum(CRATE_COSTS.wheelGoldCost)})</button>`
              }
              <button class="btn btn-primary" id="btn-wheel-gems" ${m.spinning || this.save.gems < CRATE_COSTS.wheelGemCost ? 'disabled' : ''}>
                ${uiIconSvg('shard', 14)} Spin Now (${CRATE_COSTS.wheelGemCost} Shards)
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (m.kind === 'daily_streak') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;">7-Day Login Streak</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">${uiIconSvg('close', 16)}</button>
            </div>
            <div class="quick-grid">
              ${LOGIN_STREAK_REWARDS.map((r) => {
                const isToday = r.day === this.save.loginStreak;
                const past = r.day < this.save.loginStreak || (isToday && this.save.loginClaimedToday);
                return `
                  <div class="card" style="border-color:${isToday ? 'var(--amber)' : 'var(--border)'};opacity:${past ? 0.6 : 1};">
                    <strong style="font-size:12px;">Day ${r.day} ${past ? '✓' : ''}</strong>
                    <div style="font-size:12px;color:var(--cyan);font-weight:800;">${r.label}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <button class="btn ${this.save.loginClaimedToday ? 'btn-ghost' : 'btn-amber'}" id="btn-claim-streak" ${this.save.loginClaimedToday ? 'disabled' : ''}>
              ${this.save.loginClaimedToday ? 'Claimed Today' : 'Claim Daily Reward'}
            </button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'leaderboard') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="display:flex;align-items:center;gap:8px;">
                <strong style="font-size:16px;">Leaderboards</strong>
                <span class="badge-tag" style="background:${m.online ? 'rgba(16,185,129,0.22)' : 'rgba(148,163,184,0.2)'};color:${m.online ? '#34d399' : '#cbd5e1'};">
                  ${m.loading ? 'Syncing...' : m.online ? 'ONLINE' : 'LOCAL'}
                </span>
              </div>
              <button class="icon-btn" id="modal-close" aria-label="Close">${uiIconSvg('close', 16)}</button>
            </div>

            <div class="subtabs">
              <button class="subtab ${m.mode === 'endless' ? 'active' : ''}" data-lb-mode="endless">Endless</button>
              <button class="subtab ${m.mode === 'boss_rush' ? 'active' : ''}" data-lb-mode="boss_rush">Boss Rush</button>
              <button class="subtab ${m.mode === 'daily' ? 'active' : ''}" data-lb-mode="daily">Daily Run</button>
            </div>

            ${
              m.entries.length === 0
                ? `<div class="card" style="text-align:center;color:var(--muted);font-size:12px;">No records yet for this mode. Complete a run to post your high score!</div>`
                : m.entries
                    .map((e, idx) => {
                      const asc = ASCENSIONS.find((a) => a.tier === e.ascension) || ASCENSIONS[0];
                      const waveLabel =
                        m.mode === 'boss_rush' ? `${e.wave} Bosses` : this.fmtTime(Math.max(0, Math.floor(e.wave)));
                      return `
                        <div class="card" style="padding:8px 10px;flex-direction:row;align-items:center;justify-content:space-between;gap:8px;border-color:${e.isPlayer ? 'var(--cyan)' : 'var(--border)'};">
                          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                            <strong style="width:24px;color:${idx < 3 ? '#fbbf24' : 'var(--muted)'};">#${e.rank || idx + 1}</strong>
                            ${heroPortraitSvg(e.heroId, 30)}
                            <div style="min-width:0;">
                              <div style="font-size:12px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${this.esc(e.playerName)} ${e.isPlayer ? '<span style="color:var(--cyan);">(YOU)</span>' : ''}
                              </div>
                              <div style="font-size:10px;color:var(--muted);">
                                Asc.${asc.roman} • ${waveLabel} • ${this.fmtNum(e.kills)} kills
                              </div>
                            </div>
                          </div>
                          <strong style="color:var(--amber);font-size:13px;flex-shrink:0;">${this.fmtNum(e.score)}</strong>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>
        </div>
      `;
    }

    if (m.kind === 'gear_detail') {
      const item = this.save.inventory.find((g) => g.uid === m.uid);
      if (!item) return '';
      const rm = RARITY_META[item.rarity];
      const gs = getGearStats(item);
      const cost = getGearUpgradeCost(item);
      const isEq = this.save.equipped[item.slot] === item.uid;
      const mergeCount = findMergeCandidates(this.save, item.uid).length;
      const itemPower = getGearPower(item);
      const eqUid = this.save.equipped[item.slot];
      const eqItem = eqUid ? this.save.inventory.find((g) => g.uid === eqUid) : null;
      const powerDelta = !isEq && eqItem ? itemPower - getGearPower(eqItem) : 0;
      const salvage = getSalvageYield(item);

      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card" style="border-color:${rm.color};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;color:${rm.color};display:inline-flex;align-items:center;gap:6px;">
                ${gearSlotIconSvg(item.slot, 20, rm.color)} ${item.name}
              </strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">${uiIconSvg('close', 16)}</button>
            </div>
            <div style="font-size:12px;">
              Rarity: <b style="color:${rm.color};">${rm.label}</b> • Lv.${item.level}/${rm.maxLv} • Power <b>${itemPower}</b>
              ${
                !isEq && eqItem
                  ? `<span style="color:${powerDelta >= 0 ? 'var(--green)' : 'var(--rose)'};font-weight:900;"> (${powerDelta >= 0 ? `+${powerDelta}` : powerDelta} vs equipped)</span>`
                  : ''
              }
            </div>
            <div style="font-size:13px;font-weight:800;">+${gs.atk} ATK • +${gs.hp} HP</div>
            ${item.perkText ? `<div style="font-size:12px;color:var(--cyan);">Perk: ${item.perkText}</div>` : ''}
            <div style="display:flex;gap:8px;">
              <button class="btn ${isEq ? 'btn-ghost' : 'btn-green'}" style="flex:1;" id="btn-gear-equip" ${isEq ? 'disabled' : ''}>
                ${isEq ? 'Equipped' : 'Equip'}
              </button>
              <button class="btn btn-primary" style="flex:1;" id="btn-gear-upgrade" ${item.level >= rm.maxLv || this.save.coins < cost.coins || this.save.blueprints < cost.blueprints ? 'disabled' : ''}>
                Upgrade (${this.fmtNum(cost.coins)}G • ${cost.blueprints} BP)
              </button>
            </div>
            ${
              mergeCount >= 3
                ? `<button class="btn btn-amber" id="btn-gear-merge">${uiIconSvg('merge', 14)} Merge 3x → Next Rarity</button>`
                : `<div style="font-size:11px;color:var(--muted);">Collect 3 identical items (${mergeCount}/3) to merge!</div>`
            }
            ${
              !isEq
                ? `<button class="btn btn-rose" id="btn-gear-salvage" style="font-size:12px;">${uiIconSvg('salvage', 14)} Salvage (+${this.fmtNum(salvage.coins)} Gold • +${salvage.blueprints} BP)</button>`
                : ''
            }
          </div>
        </div>
      `;
    }

    if (m.kind === 'crate_result') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card" style="text-align:center;">
            <strong style="font-size:18px;color:#fbbf24;">${this.esc(m.title)}</strong>
            <div class="crate-loot-grid">
              ${m.drops
                .map((d) => {
                  const rm = RARITY_META[d.rarity];
                  return `
                    <div class="inv-item" style="border-color:${rm.color};background:${rm.bg};padding:10px 6px;">
                      <div>${gearSlotIconSvg(d.slot, 22, rm.color)}</div>
                      <div style="font-size:11px;font-weight:800;margin-top:3px;">${d.name}</div>
                      <div style="font-size:10px;color:${rm.color};font-weight:900;">${rm.label}</div>
                    </div>
                  `;
                })
                .join('')}
            </div>
            <button class="btn btn-primary" id="modal-close">Awesome!</button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'run_summary') {
      const s = m.summary;
      const asc = ASCENSIONS.find((a) => a.tier === s.ascension) || ASCENSIONS[0];
      const maxDmg = s.weaponBreakdown.length > 0 ? s.weaponBreakdown[0].totalDamage : 1;

      return `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:${s.victory ? 'var(--green)' : 'var(--cyan)'};">
            <div style="text-align:center;">
              <div>${s.victory ? uiIconSvg('trophy', 34, '#fbbf24') : uiIconSvg('battle', 34, '#38bdf8')}</div>
              <div style="font-size:21px;font-weight:900;color:${s.victory ? '#34d399' : '#f8fafc'};">${s.victory ? 'VICTORY!' : 'RUN COMPLETE'}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">
                Ascension ${asc.roman} • Score: <b style="color:#fbbf24;">${this.fmtNum(s.score)}</b>
              </div>
              <div style="font-size:12px;color:var(--muted);">
                Time: <b>${this.fmtTime(s.survivedSec)}</b> • Kills: <b>${s.kills}</b> • Bosses: <b>${s.bossesKilled}</b>
                ${s.shrinesClaimed > 0 ? ` • Shrines: <b>${s.shrinesClaimed}</b>` : ''}
                ${s.maxCombo >= 5 ? ` • Max Combo: <b style="color:#fbbf24;">${s.maxCombo}x</b>` : ''}
              </div>
            </div>

            <div class="card" style="background:var(--bg-card-2);text-align:center;">
              <div style="font-size:14px;font-weight:900;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
                <span>${uiIconSvg('coin', 14)} +${this.fmtNum(s.coinsEarned)} Gold</span>
                <span style="color:var(--cyan);">${uiIconSvg('shard', 14)} +${s.gemsEarned} Shards</span>
              </div>
              <div style="font-size:12px;color:var(--muted);">
                +${s.blueprintsEarned} Blueprints • +${s.passXpEarned} Mastery XP
              </div>
              ${s.evolutionsUnlocked.length > 0 ? `<div style="font-size:11px;color:#fbbf24;font-weight:800;">Evolutions: ${s.evolutionsUnlocked.map((e) => this.esc(e)).join(', ')}</div>` : ''}
              ${s.newGearDrop ? `<div style="font-size:12px;color:${RARITY_META[s.newGearDrop.rarity].color};font-weight:800;">Gear Drop: ${s.newGearDrop.name} (${RARITY_META[s.newGearDrop.rarity].label})</div>` : ''}
            </div>

            ${
              s.weaponBreakdown.length > 0
                ? `
              <div class="card" style="background:var(--bg-card-2);gap:7px;">
                <div style="font-size:11px;font-weight:900;color:var(--cyan);display:flex;align-items:center;gap:5px;">
                  ${uiIconSvg('chart', 14, '#38bdf8')} PER-WEAPON DPS BREAKDOWN
                </div>
                ${s.weaponBreakdown
                  .slice(0, 7)
                  .map((row) => {
                    const widthPct = Math.max(4, Math.round((row.totalDamage / Math.max(1, maxDmg)) * 100));
                    return `
                      <div class="dps-bar-row">
                        <div class="dps-bar-head">
                          <span style="font-weight:800;color:${row.color};">${this.esc(row.label)}</span>
                          <span style="color:var(--muted);">${this.fmtNum(row.totalDamage)} (${this.fmtNum(row.dps)}/s • ${row.sharePct}%)</span>
                        </div>
                        <div class="dps-bar-track">
                          <div class="dps-bar-fill" style="width:${widthPct}%;background:${row.color};"></div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
                : ''
            }

            <button class="btn btn-primary" id="modal-close">Back to Base</button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'settings') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;">Settings & Profile</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">${uiIconSvg('close', 16)}</button>
            </div>
            <label style="font-size:12px;font-weight:800;">Commander Name
              <input id="in-player-name" value="${this.esc(this.save.playerName)}" style="width:100%;margin-top:4px;padding:8px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card-2);color:#fff;font-weight:700;">
            </label>
            <label class="setting-toggle-row">
              <span>Sound Effects</span>
              <input type="checkbox" id="chk-sound" ${this.save.soundEnabled ? 'checked' : ''}>
            </label>
            <label class="setting-toggle-row">
              <span>Synthwave Music</span>
              <input type="checkbox" id="chk-music" ${this.save.musicEnabled ? 'checked' : ''}>
            </label>
            <label class="setting-toggle-row">
              <span>Haptic Vibration</span>
              <input type="checkbox" id="chk-vibe" ${this.save.vibrationEnabled ? 'checked' : ''}>
            </label>
            <label class="setting-toggle-row">
              <span>Arena Damage Numbers</span>
              <input type="checkbox" id="chk-dmg" ${this.save.damageNumbersEnabled ? 'checked' : ''}>
            </label>
            <button class="btn btn-primary" id="btn-save-settings">Save Preferences</button>
            ${
              !m.confirmReset
                ? `<button class="btn btn-ghost" id="btn-reset-step1" style="font-size:11px;color:#fda4af;border-color:rgba(244,63,94,0.4);">Reset Progress...</button>`
                : `
                  <div class="card" style="border-color:var(--rose);background:rgba(244,63,94,0.12);gap:8px;">
                    <div style="font-size:12px;font-weight:800;color:#fda4af;text-align:center;">Erase ALL heroes, gear, talents & records?</div>
                    <div style="display:flex;gap:8px;">
                      <button class="btn btn-ghost" id="btn-reset-cancel" style="flex:1;">Cancel</button>
                      <button class="btn btn-rose" id="btn-reset-confirm" style="flex:1;">Yes, Erase Save</button>
                    </div>
                  </div>
                `
            }
          </div>
        </div>
      `;
    }

    return '';
  }

  private bindLobbyEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => {
      el.addEventListener('click', () => {
        audio.playTap();
        this.tab = el.dataset.tab as MainTab;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-go-tab]').forEach((el) => {
      el.addEventListener('click', () => {
        audio.playTap();
        this.tab = el.dataset.goTab as MainTab;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-forge-sub]').forEach((el) => {
      el.addEventListener('click', () => {
        audio.playTap();
        this.forgeSub = el.dataset.forgeSub as ForgeSubTab;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-mastery-sub]').forEach((el) => {
      el.addEventListener('click', () => {
        audio.playTap();
        this.masterySub = el.dataset.masterySub as MasterySubTab;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-vault-sub]').forEach((el) => {
      el.addEventListener('click', () => {
        audio.playTap();
        this.vaultSub = el.dataset.vaultSub as VaultSubTab;
        this.render();
      });
    });

    this.root.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.modal = { kind: 'settings', confirmReset: false };
      this.render();
    });

    this.root.querySelector('#btn-pick-chapter')?.addEventListener('click', () => {
      this.modal = { kind: 'chapters' };
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-pick-wstyle]').forEach((b) => {
      b.addEventListener('click', () => {
        this.save.selectedWeaponStyle = b.dataset.pickWstyle as WeaponStyle;
        saveGame(this.save);
        audio.playTap();
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-pick-asc]').forEach((b) => {
      b.addEventListener('click', () => {
        const tier = Number(b.dataset.pickAsc) as AscensionTier;
        this.save.selectedAscension = tier;
        saveGame(this.save);
        audio.playTap();
        this.render();
      });
    });

    this.root.querySelector('#btn-start-battle')?.addEventListener('click', () => {
      audio.unlock();
      this.startBattle(this.selectedChapterId, false);
    });

    this.root.querySelector('#btn-start-daily')?.addEventListener('click', () => {
      audio.unlock();
      this.startBattle(77, true);
    });

    this.root.querySelector('#btn-collect-patrol')?.addEventListener('click', () => {
      const p = computePatrolEarnings(this.save);
      if (p.coins <= 0 && p.blueprints <= 0) {
        this.showToast('Patrol automatically collects offline Gold & Blueprints!');
        return;
      }
      this.modal = { kind: 'patrol' };
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-toggle-booster]').forEach((b) => {
      b.addEventListener('click', () => {
        const key = b.dataset.toggleBooster as keyof ActiveRunBoosters;
        this.boosters[key] = !this.boosters[key];
        audio.playTap();
        this.render();
      });
    });

    this.root.querySelector('#btn-open-wheel')?.addEventListener('click', () => {
      this.modal = { kind: 'lucky_wheel', rotation: 0, spinning: false, lastResult: null };
      this.render();
    });

    this.root.querySelector('#btn-open-streak')?.addEventListener('click', () => {
      this.modal = { kind: 'daily_streak' };
      this.render();
    });

    this.root.querySelector('#btn-open-leaderboard')?.addEventListener('click', () => {
      this.openLeaderboardModal('endless');
    });

    // Heroes
    this.root.querySelectorAll<HTMLElement>('[data-select-hero]').forEach((b) => {
      b.addEventListener('click', () => {
        this.save.selectedHero = b.dataset.selectHero as HeroId;
        saveGame(this.save);
        audio.playTap();
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-unlock-hero]').forEach((b) => {
      b.addEventListener('click', () => {
        const hId = b.dataset.unlockHero as HeroId;
        const h = HEROES.find((x) => x.id === hId);
        if (!h || this.save.gems < h.unlockCostGems) return;
        this.save.gems -= h.unlockCostGems;
        if (!this.save.unlockedHeroes.includes(hId)) this.save.unlockedHeroes.push(hId);
        this.save.selectedHero = hId;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`${h.name} unlocked and selected!`);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-upgrade-hero]').forEach((b) => {
      b.addEventListener('click', () => {
        const hId = b.dataset.upgradeHero as HeroId;
        const lv = this.save.heroLevels[hId] || 1;
        const cost = 350 + lv * 220;
        if (this.save.coins < cost) return;
        this.save.coins -= cost;
        this.save.heroLevels[hId] = lv + 1;
        this.save.quests.upgradesToday += 1;
        saveGame(this.save);
        audio.playLevelUp();
        this.render();
      });
    });

    // Forge Gear & Crates & Talents
    this.root.querySelectorAll<HTMLElement>('[data-gear-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        this.gearFilter = b.dataset.gearFilter as 'all' | GearSlot;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-gear-uid]').forEach((b) => {
      b.addEventListener('click', () => {
        this.modal = { kind: 'gear_detail', uid: b.dataset.gearUid! };
        this.render();
      });
    });

    this.root.querySelector('#btn-salvage-common')?.addEventListener('click', () => {
      const res = salvageAllCommonGear(this.save);
      if (res.count > 0) {
        audio.playPurchaseSuccess();
        this.showToast(`Salvaged ${res.count}x Common: +${this.fmtNum(res.coins)} Gold & +${res.blueprints} BP`);
        this.render();
      }
    });

    this.root.querySelector('#btn-auto-merge')?.addEventListener('click', () => {
      const count = autoMergeAllGear(this.save);
      if (count > 0) {
        audio.playEvoUnlock();
        this.showToast(`Merged ${count}x Gear to higher rarity!`);
        this.render();
      }
    });

    const handleCrate = (type: 'basic' | 'cyber' | 'mythic', count: 1 | 10, useKey: boolean, title: string) => {
      const drops = openCrate(this.save, type, count, useKey);
      if (!drops) {
        this.showToast('Not enough keys or currency!');
        return;
      }
      audio.playChestJackpot();
      this.modal = { kind: 'crate_result', drops, title };
      this.render();
    };

    this.root.querySelector('#btn-open-cyber-key')?.addEventListener('click', () => handleCrate('cyber', 1, true, 'Cyber Supply Chest'));
    this.root.querySelector('#btn-open-cyber-1')?.addEventListener('click', () => handleCrate('cyber', 1, false, 'Cyber Supply Chest'));
    this.root.querySelector('#btn-open-cyber-10')?.addEventListener('click', () => handleCrate('cyber', 10, false, '10x Cyber Mega Pull'));
    this.root.querySelector('#btn-open-mythic')?.addEventListener('click', () => handleCrate('mythic', 1, false, 'Mythic Vault Chest'));
    this.root.querySelector('#btn-open-basic-key')?.addEventListener('click', () => handleCrate('basic', 1, true, 'Basic Supply Chest'));
    this.root.querySelector('#btn-open-basic-coin')?.addEventListener('click', () => handleCrate('basic', 1, false, 'Basic Supply Chest'));

    this.root.querySelectorAll<HTMLElement>('[data-talent-id]').forEach((b) => {
      b.addEventListener('click', () => {
        const t = TALENTS.find((x) => x.id === b.dataset.talentId);
        if (!t) return;
        const lv = this.save.talents[t.id] || 0;
        const cost = t.baseCostCoins + lv * t.costStepCoins;
        if (lv >= t.maxLevel || this.save.coins < cost) return;
        this.save.coins -= cost;
        this.save.talents[t.id] = lv + 1;
        this.save.quests.upgradesToday += 1;
        saveGame(this.save);
        audio.playLevelUp();
        this.render();
      });
    });

    // Mastery Track, Quests, Achievements
    const applyMasteryReward = (tier: number) => {
      const mt = MASTERY_TIERS.find((x) => x.tier === tier);
      if (!mt || this.save.passXp < mt.xpRequired || this.save.passClaimedTiers.includes(tier)) return false;
      this.save.passClaimedTiers.push(tier);
      this.save.coins += mt.reward.coins || 0;
      this.save.gems += mt.reward.gems || 0;
      this.save.blueprints += mt.reward.blueprints || 0;
      this.save.basicKeys += mt.reward.basicKeys || 0;
      this.save.cyberKeys += mt.reward.cyberKeys || 0;
      this.save.reviveTokens += mt.reward.reviveTokens || 0;
      return true;
    };

    this.root.querySelector('#btn-claim-all-mastery')?.addEventListener('click', () => {
      let claimed = 0;
      for (const mt of MASTERY_TIERS) {
        if (applyMasteryReward(mt.tier)) claimed += 1;
      }
      if (claimed > 0) {
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`Claimed ${claimed} Mastery Tier rewards!`);
        this.render();
      }
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-mastery]').forEach((b) => {
      b.addEventListener('click', () => {
        const tier = Number(b.dataset.claimMastery);
        if (applyMasteryReward(tier)) {
          saveGame(this.save);
          audio.playPurchaseSuccess();
          this.showToast(`Mastery Tier ${tier} claimed!`);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-quest]').forEach((b) => {
      b.addEventListener('click', () => {
        const q = DAILY_QUESTS.find((x) => x.id === b.dataset.claimQuest);
        if (!q || this.save.quests.claimedIds.includes(q.id) || this.save.quests[q.field] < q.target) return;
        this.save.quests.claimedIds.push(q.id);
        this.save.gems += q.gems;
        this.save.coins += q.coins;
        this.save.passXp += q.passXp;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`Quest complete: +${q.gems} Shards & +${q.coins} Gold`);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-ach]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = ACHIEVEMENTS.find((x) => x.id === b.dataset.claimAch);
        if (!a || this.save.claimedAchievements.includes(a.id)) return;
        this.save.claimedAchievements.push(a.id);
        this.save.gems += a.gems;
        this.save.cyberKeys += a.cyberKeys || 0;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`${a.title}: +${a.gems} Shards!`);
        this.render();
      });
    });

    // Vault, Store & Codex
    this.root.querySelector('#btn-free-daily-gift')?.addEventListener('click', () => {
      if (this.save.freeGiftClaimedToday) return;
      this.save.freeGiftClaimedToday = true;
      this.save.coins += 1500;
      this.save.gems += 50;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      this.showToast('Daily Supply Grant: +1,500 Gold & +50 Shards!');
      this.render();
    });

    this.root.querySelector('#btn-vip-daily-claim')?.addEventListener('click', () => {
      const res = claimVipDailyShards(this.save);
      if (res.ok) {
        audio.playPurchaseSuccess();
        this.showToast(`VIP Daily Allowance: +${res.amount} Star Shards!`);
        this.render();
      }
    });

    this.root.querySelector('#btn-ad-free-gems')?.addEventListener('click', async () => {
      if (this.save.adGemsUsedToday >= ADMOB_CONFIG.dailyAdGemsLimit) return;
      const res = await monetizationBridge.showRewardedAd('store_free_gems', this.save.noAdsOwned || this.save.vipActive);
      if (!res.rewarded) {
        this.showToast('Watch the full video to claim Shards');
        return;
      }
      this.save.adGemsUsedToday += 1;
      this.save.gems += ADMOB_CONFIG.dailyAdGemsAmount;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      this.showToast(`+${ADMOB_CONFIG.dailyAdGemsAmount} Star Shards claimed!`);
      this.render();
    });

    this.root.querySelector('#btn-ad-free-key')?.addEventListener('click', async () => {
      if (this.save.adKeysUsedToday >= ADMOB_CONFIG.dailyAdKeysLimit) return;
      const res = await monetizationBridge.showRewardedAd('store_free_key', this.save.noAdsOwned || this.save.vipActive);
      if (!res.rewarded) {
        this.showToast('Watch the full video to claim Cyber Key');
        return;
      }
      this.save.adKeysUsedToday += 1;
      this.save.cyberKeys += 1;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      this.showToast('+1 Cyber Key claimed!');
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-prem-mastery]').forEach((b) => {
      b.addEventListener('click', () => {
        const tier = Number(b.dataset.claimPremMastery);
        if (!this.save.seasonPassOwned || this.save.passPremiumClaimedTiers.includes(tier)) return;
        const mt = MASTERY_TIERS.find((x) => x.tier === tier);
        if (!mt || this.save.passXp < mt.xpRequired) return;
        this.save.passPremiumClaimedTiers.push(tier);
        const shards = mt.isMilestone ? 200 : 75;
        this.save.gems += shards;
        if (mt.isMilestone) this.save.cyberKeys += 1;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`Pass Tier ${tier}: +${shards} Shards${mt.isMilestone ? ' + 1 Cyber Key' : ''}!`);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-buy-sku]').forEach((b) => {
      b.addEventListener('click', async () => {
        const sku = b.dataset.buySku;
        if (!sku) return;
        b.setAttribute('disabled', 'true');
        const res = await monetizationBridge.purchaseSku(sku);
        if (res.purchased) {
          const grant = applyPurchasedSku(this.save, sku);
          audio.playPurchaseSuccess();
          this.showToast(`${res.isSandbox ? '[Test] ' : ''}${grant.summary}`);
          this.render();
        } else {
          b.removeAttribute('disabled');
          if (!res.cancelled) {
            this.showToast(res.error || 'Purchase could not be completed');
          }
        }
      });
    });

    this.root.querySelector('#btn-restore-purchases')?.addEventListener('click', async () => {
      const owned = await monetizationBridge.restorePurchases();
      let restored = 0;
      for (const sku of owned) {
        if (!this.save.purchasedSkus.includes(sku)) {
          applyPurchasedSku(this.save, sku);
          restored += 1;
        }
      }
      this.showToast(restored > 0 ? `Restored ${restored} purchase(s)!` : 'All purchases are up to date');
      if (restored > 0) this.render();
    });

    this.root.querySelector('#btn-double-run-rewards')?.addEventListener('click', async () => {
      if (this.modal?.kind !== 'run_summary' || this.modal.doubled) return;
      const res = await monetizationBridge.showRewardedAd('post_run_double', this.save.noAdsOwned || this.save.vipActive);
      if (!res.rewarded) {
        this.showToast('Watch the full video to double rewards');
        return;
      }
      const s = this.modal.summary;
      this.save.coins += s.coinsEarned;
      this.save.gems += s.gemsEarned;
      saveGame(this.save);
      this.modal = { kind: 'run_summary', summary: s, doubled: true };
      audio.playPurchaseSuccess();
      this.showToast(`2× BONUS: +${this.fmtNum(s.coinsEarned)} Gold & +${s.gemsEarned} Shards!`);
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-codex]').forEach((b) => {
      b.addEventListener('click', () => {
        const wId = b.dataset.claimCodex as WeaponId;
        if (!this.save.discoveredEvos.includes(wId) || this.save.claimedEvoCodex.includes(wId)) return;
        this.save.claimedEvoCodex.push(wId);
        this.save.gems += 30;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast('Codex Bonus: +30 Star Shards claimed!');
        this.render();
      });
    });

    this.bindModalEvents();
  }

  private spinWheel(mode: 'free' | 'gold' | 'gems'): void {
    if (this.modal?.kind !== 'lucky_wheel' || this.modal.spinning) return;
    if (mode === 'free') {
      if (this.save.wheelSpinsFreeUsedToday >= CRATE_COSTS.wheelFreeLimit) return;
      this.save.wheelSpinsFreeUsedToday += 1;
    } else if (mode === 'gold') {
      if (this.save.coins < CRATE_COSTS.wheelGoldCost) return;
      this.save.coins -= CRATE_COSTS.wheelGoldCost;
    } else {
      if (this.save.gems < CRATE_COSTS.wheelGemCost) return;
      this.save.gems -= CRATE_COSTS.wheelGemCost;
    }

    const { slice, index } = rollWheelReward(this.save);
    const sliceDeg = 360 / WHEEL_REWARDS.length;
    const targetMod = (360 - (index * sliceDeg + sliceDeg / 2) + 360) % 360;
    const prevRot = this.modal.rotation;
    const deltaMod = (targetMod - (prevRot % 360) + 360) % 360;
    const nextRot = prevRot + 5 * 360 + deltaMod;

    this.modal = { kind: 'lucky_wheel', rotation: prevRot, spinning: true, lastResult: null };
    this.render();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const disc = this.root.querySelector<HTMLElement>('#wheel-disc');
        if (disc) disc.style.transform = `rotate(${nextRot}deg)`;
      });
    });

    if (this.wheelTimer) window.clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => {
      this.wheelTimer = null;
      if (this.modal?.kind === 'lucky_wheel') {
        this.modal = { kind: 'lucky_wheel', rotation: nextRot, spinning: false, lastResult: slice };
        audio.playPurchaseSuccess();
        this.showToast(`Lucky Wheel: Won ${slice.label}!`);
        this.render();
      }
    }, 3250);
  }

  private bindModalEvents(): void {
    const closeIfAllowed = () => {
      if (this.modal?.kind === 'lucky_wheel' && this.modal.spinning) return;
      this.modal = null;
      this.render();
    };

    this.root.querySelector('#modal-bg')?.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).id === 'modal-bg') {
        closeIfAllowed();
      }
    });

    this.root.querySelector('#modal-close')?.addEventListener('click', closeIfAllowed);

    this.root.querySelector('#btn-resume-saved-run')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'resume_run') return;
      const snap = this.modal.snapshot;
      audio.unlock();
      this.resumeSavedRun(snap);
    });

    this.root.querySelector('#btn-discard-saved-run')?.addEventListener('click', () => {
      clearActiveRun();
      this.modal = null;
      this.showToast('Saved run discarded');
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-pick-chapter]').forEach((b) => {
      b.addEventListener('click', () => {
        this.selectedChapterId = Number(b.dataset.pickChapter);
        this.modal = null;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-lb-mode]').forEach((b) => {
      b.addEventListener('click', () => {
        audio.playTap();
        this.openLeaderboardModal(b.dataset.lbMode as LeaderboardMode);
      });
    });

    this.root.querySelector('#btn-patrol-claim')?.addEventListener('click', () => {
      const got = collectPatrolEarnings(this.save);
      audio.playPurchaseSuccess();
      this.showToast(`Patrol Collected: +${this.fmtNum(got.coins)} Gold & +${got.blueprints} BP`);
      this.modal = null;
      this.render();
    });

    this.root.querySelector('#btn-wheel-free')?.addEventListener('click', () => this.spinWheel('free'));
    this.root.querySelector('#btn-wheel-gold')?.addEventListener('click', () => this.spinWheel('gold'));
    this.root.querySelector('#btn-wheel-gems')?.addEventListener('click', () => this.spinWheel('gems'));

    this.root.querySelector('#btn-claim-streak')?.addEventListener('click', () => {
      if (this.save.loginClaimedToday) return;
      const r = LOGIN_STREAK_REWARDS[(this.save.loginStreak - 1) % LOGIN_STREAK_REWARDS.length];
      this.save.loginClaimedToday = true;
      this.save.coins += r.coins;
      this.save.gems += r.gems;
      this.save.cyberKeys += r.cyberKeys;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      this.showToast(`Day ${r.day} claimed: ${r.label}`);
      this.modal = null;
      this.render();
    });

    this.root.querySelector('#btn-gear-equip')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'gear_detail') return;
      const uid = this.modal.uid;
      const target = this.save.inventory.find((g) => g.uid === uid);
      if (!target) return;
      this.save.equipped[target.slot] = target.uid;
      saveGame(this.save);
      audio.playTap();
      this.render();
    });

    this.root.querySelector('#btn-gear-upgrade')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'gear_detail') return;
      if (upgradeGearItem(this.save, this.modal.uid)) {
        audio.playLevelUp();
        this.render();
      }
    });

    this.root.querySelector('#btn-gear-merge')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'gear_detail') return;
      const merged = mergeGearTriplet(this.save, this.modal.uid);
      if (merged) {
        audio.playEvoUnlock();
        this.showToast(`Merged to ${RARITY_META[merged.rarity].label}!`);
        this.modal = { kind: 'gear_detail', uid: merged.uid };
        this.render();
      }
    });

    this.root.querySelector('#btn-gear-salvage')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'gear_detail') return;
      const payout = salvageGearItem(this.save, this.modal.uid);
      if (payout) {
        audio.playPurchaseSuccess();
        this.showToast(`Salvaged: +${this.fmtNum(payout.coins)} Gold & +${payout.blueprints} BP`);
        this.modal = null;
        this.render();
      }
    });

    this.root.querySelector('#btn-save-settings')?.addEventListener('click', () => {
      const nameIn = this.root.querySelector<HTMLInputElement>('#in-player-name')?.value.trim();
      if (nameIn) this.save.playerName = nameIn.slice(0, 18);
      this.save.soundEnabled = Boolean(this.root.querySelector<HTMLInputElement>('#chk-sound')?.checked);
      this.save.musicEnabled = Boolean(this.root.querySelector<HTMLInputElement>('#chk-music')?.checked);
      this.save.vibrationEnabled = Boolean(this.root.querySelector<HTMLInputElement>('#chk-vibe')?.checked);
      this.save.damageNumbersEnabled = Boolean(this.root.querySelector<HTMLInputElement>('#chk-dmg')?.checked);
      audio.configure(this.save.soundEnabled, this.save.musicEnabled);
      saveGame(this.save);
      this.modal = null;
      this.showToast('Preferences saved');
      this.render();
    });

    this.root.querySelector('#btn-reset-step1')?.addEventListener('click', () => {
      this.modal = { kind: 'settings', confirmReset: true };
      this.render();
    });

    this.root.querySelector('#btn-reset-cancel')?.addEventListener('click', () => {
      this.modal = { kind: 'settings', confirmReset: false };
      this.render();
    });

    this.root.querySelector('#btn-reset-confirm')?.addEventListener('click', () => {
      clearActiveRun();
      this.save = createDefaultSave();
      saveGame(this.save);
      this.selectedChapterId = 1;
      this.modal = null;
      this.showToast('Progress reset');
      this.render();
    });
  }
}

const appRoot = document.querySelector<HTMLElement>('#app');
if (appRoot) {
  new StarforgeApp(appRoot);
}
