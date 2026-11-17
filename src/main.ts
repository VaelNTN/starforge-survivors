import './style.css';
import { ADMOB_CONFIG, CRATE_COSTS, SHOP_SKUS } from './config/monetization';
import {
  ACHIEVEMENTS,
  CHAPTERS,
  DAILY_QUESTS,
  HEROES,
  LOGIN_STREAK_REWARDS,
  PASSIVES,
  PASS_TIERS,
  RARITY_META,
  SLOT_LABELS,
  TALENTS,
  WEAPONS,
  WEAPON_STYLES,
  WHEEL_REWARDS,
  WheelSliceDef,
} from './data/gameCatalog';
import { DraftOption, HudSnapshot, SurvivorEngine } from './engine/survivorEngine';
import { audio } from './services/audio';
import { billing } from './services/billing';
import {
  applyOwnedEntitledSkus,
  applyPurchaseReward,
  applyRunOutcome,
  autoMergeAllGear,
  collectPatrolEarnings,
  computePatrolEarnings,
  computePlayerStats,
  createDefaultSave,
  findMergeCandidates,
  getGearPower,
  getGearStats,
  getGearUpgradeCost,
  getSalvageYield,
  isVipActive,
  loadSave,
  mergeGearTriplet,
  openCrate,
  rollWheelReward,
  salvageAllCommonGear,
  salvageGearItem,
  saveGame,
  upgradeGearItem,
} from './storage/saveState';
import { ActiveRunBoosters, GearItem, GearSlot, HeroId, PlayerSave, RunSummary, WeaponId, WeaponStyle } from './types/game';
import { gearSlotEmoji, heroPortraitSvg, weaponEmoji } from './ui/svgAssets';

type MainTab = 'battle' | 'heroes' | 'forge' | 'pass' | 'shop';
type ForgeSubTab = 'gear' | 'crates' | 'talents';
type PassSubTab = 'pass' | 'quests' | 'achievements';

type ModalState =
  | null
  | { kind: 'chapters' }
  | { kind: 'daily_streak' }
  | { kind: 'leaderboard' }
  | { kind: 'patrol' }
  | { kind: 'lucky_wheel'; rotation: number; spinning: boolean; lastResult: WheelSliceDef | null }
  | { kind: 'codex' }
  | { kind: 'settings' }
  | { kind: 'gear_detail'; uid: string }
  | { kind: 'crate_result'; drops: GearItem[]; title: string }
  | { kind: 'ad_preview'; placement: string; secondsLeft: number; onDone: (ok: boolean) => void }
  | { kind: 'run_summary'; summary: RunSummary };

const BOOSTER_COSTS: Record<keyof ActiveRunBoosters, number> = {
  extraWeapon: 600,
  overdriveAtk: 800,
  doubleLuck: 700,
};

const AD_PLACEMENT_LABELS: Record<string, string> = {
  draft_reroll: 'Bonus Roll',
  battle_revive: 'Extra Revive',
  shop_gems: 'Daily Gems',
  lucky_wheel: 'Lucky Spin',
  shop_cyber_key: 'Supply Key',
  free_boosters: 'Run Boosters',
  patrol_2x: '2x Patrol Loot',
  double_run_loot: '2x Run Loot',
};

class StarforgeApp {
  private root: HTMLElement;
  private save: PlayerSave;
  private tab: MainTab = 'battle';
  private forgeSub: ForgeSubTab = 'gear';
  private passSub: PassSubTab = 'pass';
  private selectedChapterId = 1;
  private modal: ModalState = null;
  private boosters: ActiveRunBoosters = { extraWeapon: false, overdriveAtk: false, doubleLuck: false };
  private boosterAdGranted = false;
  private gearFilter: 'all' | GearSlot = 'all';
  private wheelTimer: number | null = null;

  private toastMsg = '';
  private toastTimer: number | null = null;

  // Battle state
  private inBattle = false;
  private engine: SurvivorEngine | null = null;
  private hudSnap: HudSnapshot | null = null;
  private battleModal:
    | null
    | { kind: 'draft'; options: DraftOption[]; rerolled: boolean }
    | { kind: 'chest'; rewards: DraftOption[]; coins: number }
    | { kind: 'revive'; canFreeAd: boolean }
    | { kind: 'pause' } = null;
  private bossBannerText: string | null = null;
  private waveBannerText: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.save = loadSave();
    this.selectedChapterId = Math.min(6, Math.max(1, this.save.highestChapterUnlocked));
    audio.configure(this.save.soundEnabled, this.save.musicEnabled);

    if (this.save.pendingVipDailyGems > 0) {
      const vipGems = this.save.pendingVipDailyGems;
      this.save.pendingVipDailyGems = 0;
      saveGame(this.save);
      window.setTimeout(() => {
        this.showToast(`👑 VIP Daily Bonus: +${vipGems} Gems credited!`);
      }, 350);
    }

    this.render();
    void this.initMonetization();
  }

  private async initMonetization(): Promise<void> {
    await billing.initAll();
    const owned = await billing.restorePurchases();
    if (owned.length > 0) {
      const restored = applyOwnedEntitledSkus(this.save, owned);
      if (restored.length > 0) {
        this.showToast(`Restored: ${restored.join(', ')}`);
      }
    }
    this.render();
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

  private hasUnclaimedCodex(): boolean {
    return this.save.discoveredEvos.some((id) => !this.save.claimedEvoCodex.includes(id));
  }

  private hasUnclaimedPassTiers(): boolean {
    for (const pt of PASS_TIERS) {
      if (this.save.passXp < pt.xpRequired) continue;
      if (!this.save.passClaimedFree.includes(pt.tier)) return true;
      if (this.save.passPremiumUnlocked && !this.save.passClaimedPremium.includes(pt.tier)) return true;
    }
    return false;
  }

  private hasUnclaimedRewards(): boolean {
    if (!this.save.loginClaimedToday || !this.save.freeGiftClaimedToday) return true;
    if (this.save.wheelSpinsFreeUsedToday < ADMOB_CONFIG.dailyWheelFreeLimit) return true;
    if (this.hasUnclaimedCodex() || this.hasUnclaimedPassTiers()) return true;
    for (const q of DAILY_QUESTS) {
      if (!this.save.quests.claimedIds.includes(q.id) && this.save.quests[q.field] >= q.target) return true;
    }
    for (const a of ACHIEVEMENTS) {
      if (
        !this.save.claimedAchievements.includes(a.id) &&
        a.check({
          totalKills: this.save.totalKills,
          totalRuns: this.save.totalRuns,
          totalBossesKilled: this.save.totalBossesKilled,
          clearedCount: this.save.clearedChapters.length,
          bestEndlessSec: this.save.bestEndlessSec,
        })
      ) {
        return true;
      }
    }
    return false;
  }

  private async watchRewardedAd(placement: string, onReward: () => void): Promise<void> {
    const res = await billing.showRewardedAd(placement, () => {
      return new Promise<boolean>((resolve) => {
        let left = 3;
        const finish = (ok: boolean) => {
          window.clearInterval(timer);
          this.modal = null;
          this.render();
          resolve(ok);
        };
        this.modal = { kind: 'ad_preview', placement, secondsLeft: left, onDone: finish };
        this.render();
        const timer = window.setInterval(() => {
          left -= 1;
          if (this.modal?.kind === 'ad_preview') {
            this.modal.secondsLeft = Math.max(0, left);
            this.render();
          }
          if (left <= 0) {
            finish(true);
          }
        }, 1000);
      });
    });

    if (res.rewarded) {
      this.save.quests.adsToday += 1;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      onReward();
    } else if (res.error) {
      this.showToast(res.error);
    }
  }

  private async handlePurchaseSku(sku: string): Promise<void> {
    audio.playTap();
    const res = await billing.purchaseSku(sku);
    if (res.purchased) {
      const reward = applyPurchaseReward(this.save, sku);
      audio.playPurchaseSuccess();
      this.showToast(`🎉 Purchase complete! ${reward.summaryText}`);
      this.render();
    } else if (res.pending) {
      this.showToast('⏳ Payment pending on Google Play...');
    } else if (!res.cancelled) {
      this.showToast(res.error || 'Purchase failed');
    }
  }

  private getBoosterCost(): number {
    if (isVipActive(this.save) || this.boosterAdGranted) return 0;
    let total = 0;
    if (this.boosters.extraWeapon) total += BOOSTER_COSTS.extraWeapon;
    if (this.boosters.overdriveAtk) total += BOOSTER_COSTS.overdriveAtk;
    if (this.boosters.doubleLuck) total += BOOSTER_COSTS.doubleLuck;
    return total;
  }

  private startBattle(chapterId: number): void {
    const ch = CHAPTERS.find((c) => c.id === chapterId) || CHAPTERS[0];
    const boosterCost = this.getBoosterCost();
    if (boosterCost > this.save.coins) {
      this.showToast(`Not enough Gold for boosters (${this.fmtNum(boosterCost)} needed)!`);
      return;
    }
    if (boosterCost > 0) {
      this.save.coins -= boosterCost;
      saveGame(this.save);
    }

    const activeBoosters: ActiveRunBoosters = { ...this.boosters };
    this.boosters = { extraWeapon: false, overdriveAtk: false, doubleLuck: false };
    this.boosterAdGranted = false;

    this.inBattle = true;
    this.battleModal = null;
    this.bossBannerText = null;
    this.waveBannerText = null;
    this.modal = null;
    this.render();

    const canvas = this.root.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) return;

    const stats = computePlayerStats(this.save);
    this.engine = new SurvivorEngine(
      canvas,
      ch,
      this.save.selectedHero,
      this.save.selectedWeaponStyle,
      stats,
      this.save.damageNumbersEnabled,
      this.save.vibrationEnabled,
      activeBoosters,
      {
        onHud: (snap) => {
          this.hudSnap = snap;
          this.updateBattleHudOnly();
        },
        onLevelUp: (options) => {
          this.battleModal = { kind: 'draft', options, rerolled: false };
          this.renderBattleOverlays();
        },
        onChestJackpot: (rewards, coins) => {
          this.battleModal = { kind: 'chest', rewards, coins };
          this.renderBattleOverlays();
        },
        onBossBanner: (bossName) => {
          this.bossBannerText = `⚠️ BOSS INCOMING: ${bossName}`;
          this.renderBattleOverlays();
          window.setTimeout(() => {
            this.bossBannerText = null;
            this.renderBattleOverlays();
          }, 2600);
        },
        onWaveBanner: (message) => {
          this.waveBannerText = message;
          this.renderBattleOverlays();
          window.setTimeout(() => {
            if (this.waveBannerText === message) {
              this.waveBannerText = null;
              this.renderBattleOverlays();
            }
          }, 2400);
        },
        onDeathOffer: (canFreeAd) => {
          this.battleModal = { kind: 'revive', canFreeAd };
          this.renderBattleOverlays();
        },
        onFinish: (result) => {
          this.engine?.destroy();
          this.engine = null;
          this.inBattle = false;
          this.battleModal = null;

          const summary: RunSummary = {
            chapterId: ch.id,
            victory: result.victory,
            survivedSec: result.survivedSec,
            kills: result.kills,
            bossesKilled: result.bossesKilled,
            coinsEarned: result.coinsEarned,
            gemsEarned: result.gemsEarned,
            blueprintsEarned: result.blueprintsEarned,
            passXpEarned: Math.max(25, Math.floor(result.survivedSec * 0.6 + result.kills * 0.25 + (result.victory ? 60 : 0))),
            accountXpEarned: Math.max(20, Math.floor(result.survivedSec * 0.5 + (result.victory ? 50 : 0))),
            levelReached: result.levelReached,
            newGearDrop: result.newGearDrop,
            evolutionsUnlocked: result.evolutionsUnlocked,
            evoIdsUnlocked: result.evoIdsUnlocked,
            maxCombo: result.maxCombo,
            doubledByAd: false,
          };

          applyRunOutcome(this.save, summary);
          if (ch.mode === 'chapter') {
            this.selectedChapterId = Math.min(6, this.save.highestChapterUnlocked);
          }
          this.modal = { kind: 'run_summary', summary };
          this.render();

          // Fair, respectful post-run interstitial check (skipped if No-Ads/VIP or early runs)
          void billing
            .maybeShowPostRunInterstitial(
              this.save.noAdsForever || isVipActive(this.save),
              this.save.totalRuns,
              this.save.lastInterstitialAt
            )
            .then((shown) => {
              if (shown) {
                this.save.lastInterstitialAt = Date.now();
                saveGame(this.save);
              }
            });
        },
      }
    );

    this.engine.start();
  }

  private render(): void {
    if (this.inBattle) {
      this.root.innerHTML = `
        <div class="app-root">
          <div class="battle-stage">
            <canvas id="game-canvas"></canvas>
            <div class="battle-hud-top" id="battle-hud-top"></div>
            <div class="battle-actions-br">
              <button class="skill-btn" id="btn-ult">🔥<span id="lbl-ult">0%</span></button>
              <button class="skill-btn" id="btn-dash">💨<span>DASH</span></button>
            </div>
            <div id="battle-overlays"></div>
          </div>
          ${this.modal?.kind === 'ad_preview' ? this.renderModalHtml() : ''}
        </div>
      `;
      this.bindBattleControlEvents();
      this.updateBattleHudOnly();
      this.renderBattleOverlays();
      this.bindModalEvents();
      return;
    }

    const stats = computePlayerStats(this.save);
    const vip = isVipActive(this.save);

    this.root.innerHTML = `
      <div class="app-root">
        <header class="top-bar">
          <div class="player-pill">
            <div class="lv-badge">${this.save.accountLevel}</div>
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${this.esc(this.save.playerName)} ${vip ? '<span class="badge-tag" style="background:#ec4899;color:#fff;">VIP</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--cyan);font-weight:800;">⚡ Power ${this.fmtNum(stats.powerRating)}</div>
            </div>
          </div>
          <div class="currencies">
            <button class="curr-chip" data-go-tab="shop">🪙 ${this.fmtNum(this.save.coins)}</button>
            <button class="curr-chip" data-go-tab="shop" style="border-color:rgba(56,189,248,0.5);">💎 ${this.fmtNum(this.save.gems)} <span style="color:var(--cyan);">+</span></button>
            <button class="icon-btn" id="btn-settings" title="Settings" aria-label="Settings">⚙️</button>
          </div>
        </header>

        <main class="tab-body">
          ${this.renderTabContent(stats)}
        </main>

        <nav class="bottom-nav">
          <button class="nav-btn ${this.tab === 'battle' ? 'active' : ''}" data-tab="battle">
            <span class="ico">⚔️</span><span>Battle</span>
            ${!this.save.loginClaimedToday ? '<span class="nav-dot"></span>' : ''}
          </button>
          <button class="nav-btn ${this.tab === 'heroes' ? 'active' : ''}" data-tab="heroes">
            <span class="ico">🦸</span><span>Heroes</span>
          </button>
          <button class="nav-btn ${this.tab === 'forge' ? 'active' : ''}" data-tab="forge">
            <span class="ico">🛡️</span><span>Armory</span>
          </button>
          <button class="nav-btn ${this.tab === 'pass' ? 'active' : ''}" data-tab="pass">
            <span class="ico">🎖️</span><span>Quests</span>
            ${this.hasUnclaimedRewards() ? '<span class="nav-dot"></span>' : ''}
          </button>
          <button class="nav-btn ${this.tab === 'shop' ? 'active' : ''}" data-tab="shop">
            <span class="ico">💎</span><span>Shop</span>
            ${!this.save.freeGiftClaimedToday ? '<span class="nav-dot"></span>' : ''}
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
    if (this.tab === 'pass') return this.renderPassTab();
    return this.renderShopTab();
  }

  private renderBattleTab(stats: ReturnType<typeof computePlayerStats>): string {
    const hero = HEROES.find((h) => h.id === this.save.selectedHero) || HEROES[0];
    const ch = CHAPTERS.find((c) => c.id === this.selectedChapterId) || CHAPTERS[0];
    const patrol = computePatrolEarnings(this.save);
    const starterSku = SHOP_SKUS.find((s) => s.sku === 'starforge_starter_pack')!;
    const starterPrice = billing.getLocalizedPrice(starterSku.sku, starterSku.fallbackPrice);
    const vip = isVipActive(this.save);
    const freeBoosters = vip || this.boosterAdGranted;
    const totalBoosterCost = this.getBoosterCost();
    const freeWheelLeft = Math.max(0, ADMOB_CONFIG.dailyWheelFreeLimit - this.save.wheelSpinsFreeUsedToday);
    const unclaimedCodex = this.save.discoveredEvos.filter((id) => !this.save.claimedEvoCodex.includes(id)).length;

    return `
      ${
        !this.save.starterPackBought
          ? `
        <div class="card glow-amber" style="flex-direction:row;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;">
          <div style="min-width:0;">
            <div style="font-size:10px;font-weight:900;color:#fbbf24;">🔥 ${starterSku.badge}</div>
            <div style="font-size:14px;font-weight:900;">${starterSku.title}</div>
            <div style="font-size:11px;color:var(--muted);">${starterSku.subtitle}</div>
          </div>
          <button class="btn btn-amber" data-buy-sku="${starterSku.sku}" style="flex-shrink:0;">${starterPrice}</button>
        </div>
      `
          : ''
      }

      <div class="card glow-cyan" style="gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="flex-shrink:0;">${heroPortraitSvg(hero.id, 64, this.save.selectedWeaponStyle)}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;color:var(--cyan);font-weight:900;">LV.${this.save.heroLevels[hero.id] || 1}</span>
              <span style="font-size:11px;color:var(--muted);font-weight:700;">• ${hero.title}</span>
            </div>
            <div style="font-size:18px;font-weight:900;line-height:1.15;">${hero.name}</div>
            <div class="stat-pill-row">
              <span class="stat-pill">❤️ ${stats.maxHp}</span>
              <span class="stat-pill">⚔️ ${stats.atk}</span>
              <span class="stat-pill">🎯 ${Math.round(stats.critChance * 100)}%</span>
            </div>
          </div>
        </div>

        <div class="weapon-style-row">
          ${WEAPON_STYLES.map((ws) => {
            const active = this.save.selectedWeaponStyle === ws.id;
            return `
              <button class="weapon-style-chip ${active ? 'active' : ''}" data-pick-wstyle="${ws.id}" style="${active ? `border-color:${ws.color};` : ''}">
                <span style="font-size:19px;">${ws.icon}</span>
                <strong style="font-size:12px;color:${active ? ws.color : 'var(--text)'};">${ws.name}</strong>
                <small style="font-size:9px;color:var(--muted);line-height:1.15;">${ws.subtitle}</small>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <button class="arena-select-card" id="btn-pick-chapter" style="border-color:${ch.accentColor}55;">
        <div style="min-width:0;flex:1;">
          <div style="font-size:10px;font-weight:900;color:${ch.accentColor};letter-spacing:0.5px;">ARENA • ⚡ ${ch.recommendedPower} REC</div>
          <div style="font-size:15px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.name}</div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ch.subtitle}</div>
        </div>
        <span class="badge-tag" style="background:var(--bg-card-2);border:1px solid var(--border);color:var(--text);padding:5px 9px;flex-shrink:0;">Change ▾</span>
      </button>

      <div class="card booster-strip">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:900;color:#fbbf24;">⚡ BOOSTERS ${freeBoosters ? '<span style="color:var(--green);">• FREE ACTIVE</span>' : ''}</span>
          ${
            !freeBoosters
              ? `<button class="btn btn-ghost" id="btn-boosters-ad" style="padding:3px 9px;font-size:10px;border-color:#fbbf24;color:#fbbf24;">📺 Unlock All Free</button>`
              : ''
          }
        </div>
        <div class="boosters-row">
          <button class="booster-chip ${this.boosters.extraWeapon ? 'active' : ''}" data-toggle-booster="extraWeapon">
            <span>🗡️ +1 Weapon</span>
            <small style="color:${freeBoosters ? 'var(--green)' : '#fbbf24'};">${freeBoosters ? 'FREE' : `🪙 ${BOOSTER_COSTS.extraWeapon}`}</small>
          </button>
          <button class="booster-chip ${this.boosters.overdriveAtk ? 'active' : ''}" data-toggle-booster="overdriveAtk">
            <span>⚡ +25% ATK</span>
            <small style="color:${freeBoosters ? 'var(--green)' : '#fbbf24'};">${freeBoosters ? 'FREE' : `🪙 ${BOOSTER_COSTS.overdriveAtk}`}</small>
          </button>
          <button class="booster-chip ${this.boosters.doubleLuck ? 'active' : ''}" data-toggle-booster="doubleLuck">
            <span>🍀 2x Luck</span>
            <small style="color:${freeBoosters ? 'var(--green)' : '#fbbf24'};">${freeBoosters ? 'FREE' : `🪙 ${BOOSTER_COSTS.doubleLuck}`}</small>
          </button>
        </div>
      </div>

      <button class="btn btn-play-mega" id="btn-start-battle">
        ▶ PLAY ${totalBoosterCost > 0 ? `(🪙 -${this.fmtNum(totalBoosterCost)})` : ''}
      </button>

      <div class="quick-actions-grid">
        <button class="quick-tile" id="btn-open-wheel" style="border-color:${freeWheelLeft > 0 ? '#fbbf24' : 'var(--border)'};">
          <div style="font-size:11px;font-weight:900;color:#fbbf24;">🎡 Spin</div>
          <div style="font-size:12px;font-weight:800;">Win 💎 300</div>
          <div style="font-size:10px;color:${freeWheelLeft > 0 ? 'var(--green)' : 'var(--muted)'};font-weight:800;">
            ${freeWheelLeft > 0 ? 'Free Spin!' : `${Math.max(0, ADMOB_CONFIG.dailyWheelAdSpinsLimit - this.save.wheelSpinsAdUsedToday)} Ad left`}
          </div>
        </button>

        <button class="quick-tile" id="btn-open-codex" style="border-color:${unclaimedCodex > 0 ? '#a855f7' : 'var(--border)'};">
          <div style="font-size:11px;font-weight:900;color:#c084fc;">📖 Codex</div>
          <div style="font-size:12px;font-weight:800;">${this.save.discoveredEvos.length}/${WEAPONS.length} Evos</div>
          <div style="font-size:10px;color:${unclaimedCodex > 0 ? '#fbbf24' : 'var(--muted)'};font-weight:800;">
            ${unclaimedCodex > 0 ? `Claim 💎${unclaimedCodex * 25}` : 'Evolutions'}
          </div>
        </button>

        <button class="quick-tile" id="btn-collect-patrol">
          <div style="font-size:11px;font-weight:900;color:var(--green);">🛸 Patrol</div>
          <div style="font-size:12px;font-weight:800;">🪙 ${this.fmtNum(patrol.coins)}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:800;">${patrol.minutes}m • +${patrol.blueprints} BP</div>
        </button>

        <button class="quick-tile" id="btn-open-streak" style="border-color:${!this.save.loginClaimedToday ? 'var(--rose)' : 'var(--border)'};">
          <div style="font-size:11px;font-weight:900;color:var(--amber);">📅 Streak</div>
          <div style="font-size:12px;font-weight:800;">Day ${this.save.loginStreak}/7</div>
          <div style="font-size:10px;color:${this.save.loginClaimedToday ? 'var(--muted)' : 'var(--rose)'};font-weight:800;">
            ${this.save.loginClaimedToday ? 'Claimed ✓' : 'Claim!'}
          </div>
        </button>

        <button class="quick-tile" data-go-tab="shop">
          <div style="font-size:11px;font-weight:900;color:#fb7185;">🐷 Vault</div>
          <div style="font-size:12px;font-weight:800;">💎 ${this.save.piggyGems}</div>
          <div class="progress-track" style="height:5px;"><div class="progress-fill" style="width:${Math.round((this.save.piggyGems / this.save.piggyMaxGems) * 100)}%;background:#f43f5e;"></div></div>
        </button>

        <button class="quick-tile" id="btn-open-leaderboard">
          <div style="font-size:11px;font-weight:900;color:var(--cyan);">🏆 Ranks</div>
          <div style="font-size:12px;font-weight:800;">${this.fmtTime(this.save.bestEndlessSec)}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:800;">${this.save.bestEndlessKills} kills</div>
        </button>
      </div>
    `;
  }

  private renderHeroesTab(): string {
    return HEROES.map((h) => {
      const unlocked = this.save.unlockedHeroes.includes(h.id);
      const selected = this.save.selectedHero === h.id;
      const lv = this.save.heroLevels[h.id] || 1;
      const upgCost = 350 + lv * 220;

      return `
        <div class="card ${selected ? 'glow-cyan' : ''}">
          <div style="display:flex;align-items:center;gap:12px;">
            <div>${heroPortraitSvg(h.id, 62)}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="font-size:16px;">${h.name}</strong>
                <span class="badge-tag" style="background:${h.accentColor}22;color:${h.accentColor};">${h.title}</span>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px;">${h.description}</div>
              <div style="font-size:11px;font-weight:800;color:#fbbf24;margin-top:3px;">
                ${weaponEmoji(h.startingWeapon)} Signature • 🔥 Ult: ${h.ultName} • ${h.perkLabel}
              </div>
            </div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:4px;">
            ${
              unlocked
                ? `
              <button class="btn ${selected ? 'btn-green' : 'btn-primary'}" style="flex:1;" data-select-hero="${h.id}">
                ${selected ? '✓ SELECTED' : 'SELECT HERO'}
              </button>
              <button class="btn btn-amber" data-upgrade-hero="${h.id}" ${this.save.coins < upgCost ? 'disabled' : ''}>
                ⬆ Lv.${lv + 1} (🪙 ${this.fmtNum(upgCost)})
              </button>
            `
                : `
              <button class="btn btn-primary" style="flex:1;" data-unlock-hero="${h.id}" ${this.save.gems < h.unlockCostGems ? 'disabled' : ''}>
                🔓 Unlock (${h.unlockCostGems} 💎)
              </button>
            `
            }
          </div>
        </div>
      `;
    }).join('');
  }

  private renderForgeTab(): string {
    return `
      <div class="subtabs">
        <button class="subtab ${this.forgeSub === 'gear' ? 'active' : ''}" data-forge-sub="gear">⚔️ Gear</button>
        <button class="subtab ${this.forgeSub === 'crates' ? 'active' : ''}" data-forge-sub="crates">📦 Chests (${this.save.basicKeys + this.save.cyberKeys})</button>
        <button class="subtab ${this.forgeSub === 'talents' ? 'active' : ''}" data-forge-sub="talents">🧬 Talents</button>
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
        return `<div class="gear-slot-box"><span style="font-size:20px;opacity:0.4;">${gearSlotEmoji(sl)}</span><small style="color:var(--muted);">${SLOT_LABELS[sl]}</small><small>Empty</small></div>`;
      }
      const rm = RARITY_META[item.rarity];
      return `
        <button class="gear-slot-box" data-gear-uid="${item.uid}" style="border-color:${rm.color};background:${rm.bg};color:var(--text);">
          <span style="font-size:20px;">${gearSlotEmoji(sl)}</span>
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
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <strong style="font-size:13px;">Equipped Gear (6 Slots)</strong>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;color:var(--cyan);font-weight:800;">📘 ${this.save.blueprints}</span>
            <button class="btn btn-ghost" id="btn-forge-codex" style="padding:4px 8px;font-size:10px;">📖 Codex</button>
          </div>
        </div>
        <div class="equip-grid">${slots.join('')}</div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
          <strong style="font-size:13px;">Backpack (${filteredItems.length}/${this.save.inventory.length})</strong>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost" id="btn-salvage-common" style="padding:5px 8px;font-size:10px;" ${commonSalvageCount === 0 ? 'disabled' : ''}>
              ♻️ Common (${commonSalvageCount})
            </button>
            <button class="btn btn-amber" id="btn-auto-merge" style="padding:5px 9px;font-size:10px;" ${mergeableCount === 0 ? 'disabled' : ''}>
              ✨ Merge 3→1
            </button>
          </div>
        </div>
        <div class="filter-row">
          <button class="filter-chip ${this.gearFilter === 'all' ? 'active' : ''}" data-gear-filter="all">All</button>
          ${(['weapon', 'armor', 'helmet', 'boots', 'ring', 'core'] as const)
            .map(
              (sl) =>
                `<button class="filter-chip ${this.gearFilter === sl ? 'active' : ''}" data-gear-filter="${sl}">${gearSlotEmoji(sl)} ${SLOT_LABELS[sl]}</button>`
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
                  <div style="font-size:18px;">${gearSlotEmoji(item.slot)}</div>
                  <div style="font-weight:800;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
                  <div style="font-size:10px;color:${rm.color};font-weight:900;">Lv.${item.level}${isEq ? ' ✓' : ''}</div>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  private renderForgeCrates(): string {
    return `
      <div class="card glow-purple">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong style="font-size:15px;">📦 Cyber Supply Chest</strong>
            <div style="font-size:11px;color:var(--muted);">Pity Guarantee: <b>${Math.max(1, 10 - this.save.pityCounter)}</b> more for guaranteed Epic+!</div>
          </div>
          <span class="badge-tag" style="background:rgba(168,85,247,0.3);color:#e9d5ff;">🔑 ${this.save.cyberKeys}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="flex:1;" id="btn-open-cyber-key" ${this.save.cyberKeys < 1 ? 'disabled' : ''}>Use Key</button>
          <button class="btn btn-primary" style="flex:1;" id="btn-open-cyber-1" ${this.save.gems < CRATE_COSTS.cyberGems ? 'disabled' : ''}>1x (💎 ${CRATE_COSTS.cyberGems})</button>
          <button class="btn btn-amber" style="flex:1;" id="btn-open-cyber-10" ${this.save.gems < CRATE_COSTS.cyberTenGems ? 'disabled' : ''}>10x (💎 ${CRATE_COSTS.cyberTenGems})</button>
        </div>
      </div>

      <div class="card glow-amber">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong style="font-size:15px;">👑 Mythic Vault Chest</strong>
            <div style="font-size:11px;color:var(--muted);">100% chance for Epic / Legendary / Mythic gear!</div>
          </div>
        </div>
        <button class="btn btn-amber" id="btn-open-mythic" ${this.save.gems < CRATE_COSTS.mythicGems ? 'disabled' : ''}>Open Mythic Vault (💎 ${CRATE_COSTS.mythicGems})</button>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong style="font-size:14px;">🧰 Basic Supply Chest</strong>
            <div style="font-size:11px;color:var(--muted);">Common to Rare gear for merging</div>
          </div>
          <span class="badge-tag" style="background:rgba(148,163,184,0.2);color:#e2e8f0;">🗝️ ${this.save.basicKeys}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" style="flex:1;" id="btn-open-basic-key" ${this.save.basicKeys < 1 ? 'disabled' : ''}>Use Key</button>
          <button class="btn btn-green" style="flex:1;" id="btn-open-basic-coin" ${this.save.coins < CRATE_COSTS.basicCoins ? 'disabled' : ''}>Open (🪙 ${this.fmtNum(CRATE_COSTS.basicCoins)})</button>
        </div>
      </div>
    `;
  }

  private renderForgeTalents(): string {
    return TALENTS.map((t) => {
      const lv = this.save.talents[t.id] || 0;
      const maxed = lv >= t.maxLevel;
      const cost = t.baseCostCoins + lv * t.costStepCoins;
      return `
        <div class="card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="font-size:24px;">${t.icon}</span>
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:900;">${t.name} <span style="color:var(--cyan);">Lv.${lv}/${t.maxLevel}</span></div>
              <div style="font-size:11px;color:var(--muted);">${t.desc}</div>
            </div>
          </div>
          <button class="btn btn-primary" data-talent-id="${t.id}" style="flex-shrink:0;" ${maxed || this.save.coins < cost ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `🪙 ${this.fmtNum(cost)}`}
          </button>
        </div>
      `;
    }).join('');
  }

  private renderPassTab(): string {
    return `
      <div class="subtabs">
        <button class="subtab ${this.passSub === 'pass' ? 'active' : ''}" data-pass-sub="pass">🎖️ Season Pass</button>
        <button class="subtab ${this.passSub === 'quests' ? 'active' : ''}" data-pass-sub="quests">📋 Quests</button>
        <button class="subtab ${this.passSub === 'achievements' ? 'active' : ''}" data-pass-sub="achievements">🏆 Achievements</button>
      </div>
      ${
        this.passSub === 'pass'
          ? this.renderSeasonPass()
          : this.passSub === 'quests'
            ? this.renderDailyQuests()
            : this.renderAchievements()
      }
    `;
  }

  private renderSeasonPass(): string {
    const passSku = SHOP_SKUS.find((s) => s.sku === 'starforge_season_pass')!;
    const passPrice = billing.getLocalizedPrice(passSku.sku, passSku.fallbackPrice);
    const curTier = Math.min(30, Math.floor(this.save.passXp / 100));
    const canClaimAny = this.hasUnclaimedPassTiers();

    return `
      <div class="card glow-purple">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>
            <strong style="font-size:15px;">Starforge Season Pass • Tier ${curTier}/30</strong>
            <div style="font-size:11px;color:var(--muted);">Pass XP: ${this.save.passXp} (play & complete quests for XP)</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${
              canClaimAny
                ? `<button class="btn btn-green" id="btn-claim-all-pass" style="padding:7px 10px;font-size:11px;">🎁 Claim All</button>`
                : ''
            }
            ${
              !this.save.passPremiumUnlocked
                ? `<button class="btn btn-amber" data-buy-sku="${passSku.sku}">Unlock ${passPrice}</button>`
                : `<span class="badge-tag" style="background:var(--green);color:#fff;">PREMIUM ACTIVE ✓</span>`
            }
          </div>
        </div>
      </div>

      ${PASS_TIERS.map((pt) => {
        const unlocked = this.save.passXp >= pt.xpRequired;
        const freeClaimed = this.save.passClaimedFree.includes(pt.tier);
        const premClaimed = this.save.passClaimedPremium.includes(pt.tier);
        return `
          <div class="card" style="padding:9px 12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;">
              <strong>Tier ${pt.tier}</strong>
              <div style="display:flex;gap:6px;">
                <button class="btn ${freeClaimed ? 'btn-ghost' : unlocked ? 'btn-green' : 'btn-ghost'}" style="padding:5px 9px;font-size:11px;" data-claim-pass-free="${pt.tier}" ${!unlocked || freeClaimed ? 'disabled' : ''}>
                  ${freeClaimed ? '✓ ' : 'Free: '}${pt.freeLabel}
                </button>
                <button class="btn ${premClaimed ? 'btn-ghost' : unlocked && this.save.passPremiumUnlocked ? 'btn-amber' : 'btn-ghost'}" style="padding:5px 9px;font-size:11px;" data-claim-pass-prem="${pt.tier}" ${!unlocked || !this.save.passPremiumUnlocked || premClaimed ? 'disabled' : ''}>
                  ${premClaimed ? '✓ ' : '👑 '}${pt.premiumLabel}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  private renderDailyQuests(): string {
    return DAILY_QUESTS.map((q) => {
      const val = Math.min(q.target, this.save.quests[q.field]);
      const claimed = this.save.quests.claimedIds.includes(q.id);
      const ready = val >= q.target && !claimed;
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="flex:1;">
              <strong style="font-size:13px;">${q.title} (${val}/${q.target})</strong>
              <div style="font-size:11px;color:var(--cyan);">Reward: 💎 ${q.gems} • 🪙 ${q.coins} • +${q.passXp} Pass XP</div>
            </div>
            <button class="btn ${ready ? 'btn-green' : 'btn-ghost'}" data-claim-quest="${q.id}" ${!ready ? 'disabled' : ''}>
              ${claimed ? '✓' : ready ? 'Claim' : `${val}/${q.target}`}
            </button>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round((val / q.target) * 100)}%;"></div></div>
        </div>
      `;
    }).join('');
  }

  private renderAchievements(): string {
    const ctx = {
      totalKills: this.save.totalKills,
      totalRuns: this.save.totalRuns,
      totalBossesKilled: this.save.totalBossesKilled,
      clearedCount: this.save.clearedChapters.length,
      bestEndlessSec: this.save.bestEndlessSec,
    };
    return ACHIEVEMENTS.map((a) => {
      const done = a.check(ctx);
      const claimed = this.save.claimedAchievements.includes(a.id);
      return `
        <div class="card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;">
          <div>
            <strong style="font-size:13px;">${a.title}</strong>
            <div style="font-size:11px;color:var(--muted);">${a.desc}</div>
            <div style="font-size:11px;color:var(--cyan);font-weight:800;">💎 ${a.gems}${a.cyberKeys ? ` • 🔑 ${a.cyberKeys}x` : ''}</div>
          </div>
          <button class="btn ${done && !claimed ? 'btn-green' : 'btn-ghost'}" data-claim-ach="${a.id}" ${!done || claimed ? 'disabled' : ''}>
            ${claimed ? '✓' : done ? 'Claim' : 'In Progress'}
          </button>
        </div>
      `;
    }).join('');
  }

  private renderShopTab(): string {
    const bStatus = billing.getBillingStatus();
    const statusText = bStatus.connected
      ? '🟢 Store Ready'
      : bStatus.nativeAvailable && !bStatus.isDebugBuild
        ? '⚪ Store Unavailable'
        : '🛍️ Preview Store';

    const gemsLeft = Math.max(0, ADMOB_CONFIG.dailyAdGemsLimit - this.save.adGemsUsedToday);
    const keysLeft = Math.max(0, ADMOB_CONFIG.dailyAdKeysLimit - this.save.adKeysUsedToday);

    return `
      <div class="card" style="padding:8px 12px;font-size:11px;color:var(--muted);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="font-weight:800;">${statusText}</span>
          <button class="btn btn-ghost" id="btn-restore-purchases" style="padding:4px 8px;font-size:10px;">Restore Purchases</button>
        </div>
      </div>

      <div class="card glow-cyan">
        <strong style="font-size:14px;">🎁 Free Daily Gifts & Bonus Rewards</strong>
        <div style="display:flex;flex-direction:column;gap:7px;">
          <button class="btn ${this.save.freeGiftClaimedToday ? 'btn-ghost' : 'btn-green'}" id="btn-free-daily-gift" ${this.save.freeGiftClaimedToday ? 'disabled' : ''}>
            ${this.save.freeGiftClaimedToday ? '✓ Daily Gift claimed today' : '🎁 Free Daily Gift: +500 Gold & +20 Gems'}
          </button>
          <button class="btn btn-primary" id="btn-ad-gems" ${gemsLeft <= 0 ? 'disabled' : ''}>
            📺 Watch Video → +${ADMOB_CONFIG.dailyAdGemsAmount} Gems (${gemsLeft}/${ADMOB_CONFIG.dailyAdGemsLimit} left today)
          </button>
          <button class="btn btn-amber" id="btn-ad-key" ${keysLeft <= 0 ? 'disabled' : ''}>
            📺 Watch Video → 1x Cyber Supply Key (${keysLeft}/${ADMOB_CONFIG.dailyAdKeysLimit} left today)
          </button>
        </div>
      </div>

      <div style="font-size:13px;font-weight:900;color:var(--amber);padding:2px 4px;">🔥 SPECIAL BUNDLES & VIP</div>
      ${SHOP_SKUS.filter((s) => s.category !== 'gems')
        .map((s) => {
          const alreadyBought =
            (s.oneTimeOnly && this.save.purchasedSkusOneTime.includes(s.sku)) ||
            (s.sku === 'starforge_no_ads' && this.save.noAdsForever) ||
            (s.sku === 'starforge_season_pass' && this.save.passPremiumUnlocked);
          const price = billing.getLocalizedPrice(s.sku, s.fallbackPrice);
          const dynamicSub =
            s.sku === 'starforge_piggy_bank'
              ? `Current stash: 💎 ${this.save.piggyGems} / ${this.save.piggyMaxGems} Gems (min 300 guaranteed)`
              : s.subtitle;

          return `
            <div class="card" style="border-color:${s.highlightColor}88;flex-direction:row;align-items:center;justify-content:space-between;gap:10px;">
              <div style="min-width:0;flex:1;">
                ${s.badge ? `<span class="badge-tag" style="background:${s.highlightColor};color:#fff;">${s.badge}</span>` : ''}
                <div style="font-size:14px;font-weight:900;margin-top:2px;">${s.title}</div>
                <div style="font-size:11px;color:var(--muted);">${dynamicSub}</div>
              </div>
              <button class="btn" style="background:${s.highlightColor};flex-shrink:0;" data-buy-sku="${s.sku}" ${alreadyBought ? 'disabled' : ''}>
                ${alreadyBought ? 'OWNED ✓' : price}
              </button>
            </div>
          `;
        })
        .join('')}

      <div style="font-size:13px;font-weight:900;color:var(--cyan);padding:2px 4px;">💎 STAR GEMS STASH (2x FIRST BUY!)</div>
      <div class="quick-grid">
        ${SHOP_SKUS.filter((s) => s.category === 'gems')
          .map((s) => {
            const firstBonusAvail = s.firstBuyBonusGems && !this.save.firstBuyUsedSkus.includes(s.sku);
            const price = billing.getLocalizedPrice(s.sku, s.fallbackPrice);
            return `
              <div class="card" style="border-color:${s.highlightColor}66;justify-content:space-between;">
                <div>
                  ${firstBonusAvail ? '<span class="badge-tag" style="background:#f59e0b;color:#000;">2x FIRST BUY!</span>' : s.badge ? `<span class="badge-tag" style="background:${s.highlightColor}33;color:${s.highlightColor};">${s.badge}</span>` : ''}
                  <div style="font-size:15px;font-weight:900;margin-top:4px;">💎 ${this.fmtNum(s.gems || 0)}</div>
                  ${firstBonusAvail ? `<div style="font-size:10px;color:#fbbf24;font-weight:800;">+${this.fmtNum(s.firstBuyBonusGems || 0)} extra free!</div>` : ''}
                </div>
                <button class="btn btn-primary" data-buy-sku="${s.sku}" style="background:${s.highlightColor};">${price}</button>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private updateBattleHudOnly(): void {
    const topEl = this.root.querySelector<HTMLElement>('#battle-hud-top');
    const s = this.hudSnap;
    if (!topEl || !s) return;

    const timerText = s.isEndless
      ? `∞ ${this.fmtTime(s.elapsedSec)}`
      : s.isBossRush
        ? `🔥 Boss ${Math.max(1, s.bossRushStage)}/5`
        : `${this.fmtTime(Math.max(0, s.durationSec - s.elapsedSec))}`;

    topEl.innerHTML = `
      <div class="xp-bar-wrap">
        <div class="xp-bar-fill" style="width:${Math.round(s.xpFrac * 100)}%;"></div>
      </div>
      <div class="battle-stats-row">
        <span>Lv.${s.level} • ❤️ ${s.hp}/${s.maxHp}</span>
        <span style="color:var(--cyan);font-size:14px;">${timerText}</span>
        <span>💀 ${s.kills} • 🪙 ${s.coins}</span>
        <button class="icon-btn" id="btn-battle-pause" aria-label="Pause">⏸</button>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
        ${s.weapons
          .map(
            (w) =>
              `<span class="badge-tag" style="background:rgba(14,22,43,0.85);border:1px solid ${w.evolved ? '#fbbf24' : 'var(--border)'};">${weaponEmoji(w.id)} ${w.evolved ? 'EVO' : `Lv${w.lv}`}</span>`
          )
          .join('')}
        <span class="badge-tag" style="background:rgba(239,68,68,0.22);border:1px solid rgba(239,68,68,0.5);color:#fca5a5;">🌊 Wave ${s.threatLevel} (${s.enemyPowerPct}%)</span>
        ${s.combo >= 3 ? `<span class="combo-pill">🔥 ${s.combo}x COMBO</span>` : ''}
      </div>
      ${
        s.bossName
          ? `
        <div class="boss-bar-card">
          ⚠️ ${this.esc(s.bossName)}
          <div class="progress-track" style="margin-top:3px;"><div class="progress-fill" style="width:${Math.round(s.bossHpFrac * 100)}%;background:#ef4444;"></div></div>
        </div>
      `
          : ''
      }
    `;

    topEl.querySelector('#btn-battle-pause')?.addEventListener('click', () => {
      this.engine?.setPaused(true);
      this.battleModal = { kind: 'pause' };
      this.renderBattleOverlays();
    });

    const ultBtn = this.root.querySelector<HTMLElement>('#btn-ult');
    const ultLbl = this.root.querySelector<HTMLElement>('#lbl-ult');
    if (ultBtn && ultLbl) {
      ultLbl.textContent = s.ultCharge >= 100 ? 'READY!' : `${s.ultCharge}%`;
      ultBtn.classList.toggle('ready-ult', s.ultCharge >= 100);
    }
    const dashBtn = this.root.querySelector<HTMLElement>('#btn-dash');
    if (dashBtn) {
      dashBtn.style.opacity = s.dashReadyFrac >= 1 ? '1' : '0.5';
    }
  }

  private renderBattleOverlays(): void {
    const slot = this.root.querySelector<HTMLElement>('#battle-overlays');
    if (!slot) return;

    let html = '';
    if (this.waveBannerText) {
      html += `<div class="wave-alert-banner">${this.esc(this.waveBannerText)}</div>`;
    }
    if (this.bossBannerText) {
      html += `<div class="boss-alert-banner">${this.esc(this.bossBannerText)}</div>`;
    }

    const m = this.battleModal;
    if (m?.kind === 'draft') {
      html += `
        <div class="modal-backdrop">
          <div class="modal-card">
            <div style="text-align:center;">
              <div style="font-size:12px;color:var(--cyan);font-weight:900;">LEVEL UP • DRAFT</div>
              <div style="font-size:18px;font-weight:900;">Level ${this.hudSnap?.level || 2}</div>
            </div>
            ${m.options
              .map(
                (o, i) => `
              <button class="draft-card ${o.isEvo ? 'evo' : ''}" data-pick-draft="${i}">
                <div style="font-size:24px;">${o.kind === 'weapon' || o.kind === 'evo' ? weaponEmoji(o.id as WeaponId) : o.kind === 'passive' ? '💠' : '❤️'}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:900;color:${o.isEvo ? '#fbbf24' : 'var(--text)'};">
                    ${this.esc(o.name)} ${o.isEvo ? '★ EVO' : o.nextLv > 0 ? `(Lv.${o.nextLv})` : ''}
                  </div>
                  <div style="font-size:11px;color:var(--muted);">${this.esc(o.subtitle)}</div>
                </div>
              </button>
            `
              )
              .join('')}
            ${
              !m.rerolled
                ? `
              <button class="btn btn-ghost" id="btn-draft-reroll">
                🎲 Reroll Choices (${this.save.rerollTokens > 0 ? `1x Token (${this.save.rerollTokens})` : '📺 Watch Video'})
              </button>
            `
                : ''
            }
          </div>
        </div>
      `;
    } else if (m?.kind === 'chest') {
      html += `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:#fbbf24;text-align:center;">
            <div style="font-size:32px;">🎁✨</div>
            <div style="font-size:18px;font-weight:900;color:#fbbf24;">ELITE JACKPOT CHEST!</div>
            <div style="font-size:13px;color:var(--green);font-weight:800;">+🪙 ${m.coins} Bonus Gold</div>
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
            <button class="btn btn-amber" id="btn-close-chest">KEEP FIGHTING!</button>
          </div>
        </div>
      `;
    } else if (m?.kind === 'revive') {
      html += `
        <div class="modal-backdrop">
          <div class="modal-card" style="border-color:var(--rose);text-align:center;">
            <div style="font-size:34px;">💀⚡</div>
            <div style="font-size:20px;font-weight:900;">DEFEATED!</div>
            <div style="font-size:12px;color:var(--muted);">Get right back up with 100% HP & a shockwave!</div>
            ${
              m.canFreeAd
                ? `<button class="btn btn-green" id="btn-revive-ad">📺 Free Revive (Watch Video)</button>`
                : ''
            }
            <button class="btn btn-primary" id="btn-revive-token" ${this.save.reviveTokens < 1 && this.save.gems < 40 ? 'disabled' : ''}>
              ${this.save.reviveTokens > 0 ? `🔥 Use Revive Token (${this.save.reviveTokens}x)` : '💎 Revive (40 Gems)'}
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
            <div style="font-size:18px;font-weight:900;">⏸️ PAUSED</div>
            ${
              loadout
                ? `
              <div class="card" style="text-align:left;background:var(--bg-card-2);gap:6px;">
                <div style="font-size:11px;font-weight:900;color:var(--cyan);">ACTIVE WEAPONS & EVOLUTION HINTS</div>
                ${loadout.weapons
                  .map((w) => {
                    const def = WEAPONS.find((x) => x.id === w.id)!;
                    const pDef = PASSIVES.find((p) => p.id === def.evoPassive)!;
                    const hasReq = passiveIds.has(def.evoPassive);
                    return `
                      <div style="font-size:11px;display:flex;justify-content:space-between;gap:6px;">
                        <span>${weaponEmoji(w.id)} <b>${w.evolved ? def.evoName : def.name}</b> (${w.evolved ? '★ EVO' : `Lv.${w.lv}/5`})</span>
                        <span style="color:${w.evolved ? '#fbbf24' : hasReq ? 'var(--green)' : 'var(--muted)'};font-weight:800;">
                          ${w.evolved ? 'MAX' : `Evo: ${pDef.name}${hasReq ? ' ✓' : ''}`}
                        </span>
                      </div>
                    `;
                  })
                  .join('')}
                ${
                  loadout.passives.length > 0
                    ? `<div style="font-size:11px;color:var(--muted);margin-top:3px;">Passives: ${loadout.passives
                        .map((p) => `${PASSIVES.find((x) => x.id === p.id)?.name || p.id} Lv.${p.lv}`)
                        .join(' • ')}</div>`
                    : ''
                }
              </div>
            `
                : ''
            }
            <button class="btn btn-primary" id="btn-resume-battle">▶ Resume</button>
            <button class="btn btn-rose" id="btn-quit-battle">🏳️ End Run (Keep Loot)</button>
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

    slot.querySelector('#btn-draft-reroll')?.addEventListener('click', () => {
      if (this.battleModal?.kind !== 'draft' || !this.engine) return;
      const doReroll = () => {
        if (!this.engine) return;
        this.battleModal = { kind: 'draft', options: this.engine.buildDraftOptions(), rerolled: true };
        this.renderBattleOverlays();
      };
      if (this.save.rerollTokens > 0) {
        this.save.rerollTokens -= 1;
        saveGame(this.save);
        doReroll();
      } else {
        void this.watchRewardedAd('draft_reroll', doReroll);
      }
    });

    slot.querySelector('#btn-close-chest')?.addEventListener('click', () => {
      this.battleModal = null;
      this.renderBattleOverlays();
      this.engine?.setPaused(false);
    });

    slot.querySelector('#btn-revive-ad')?.addEventListener('click', () => {
      void this.watchRewardedAd('battle_revive', () => {
        this.battleModal = null;
        this.renderBattleOverlays();
        this.engine?.revivePlayer();
      });
    });

    slot.querySelector('#btn-revive-token')?.addEventListener('click', () => {
      if (this.save.reviveTokens > 0) {
        this.save.reviveTokens -= 1;
      } else if (this.save.gems >= 40) {
        this.save.gems -= 40;
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
  }

  private renderModalHtml(): string {
    const m = this.modal;
    if (!m) return '';

    if (m.kind === 'ad_preview') {
      const placementLabel = AD_PLACEMENT_LABELS[m.placement] || 'Bonus Reward';
      return `
        <div class="modal-backdrop">
          <div class="modal-card" style="text-align:center;">
            <div style="font-size:28px;">📺</div>
            <div style="font-size:16px;font-weight:900;">${this.esc(placementLabel)}</div>
            <div style="font-size:12px;color:var(--muted);">Sponsored reward unlocks in <b>${m.secondsLeft}s</b>...</div>
            <button class="btn btn-ghost" id="btn-ad-cancel">Cancel</button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'chapters') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;">🗺️ Select Arena / Chapter</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
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
                    <small style="color:var(--muted);">⚡ ${c.recommendedPower}</small>
                  </div>
                  <div style="font-size:11px;color:var(--muted);">${c.subtitle}</div>
                  <div style="font-size:10px;color:#fbbf24;">Boss: ${c.bossName} • Reward: 🪙 ${c.rewardCoins} & 💎 ${c.rewardGems} ${extraMeta}</div>
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
              <strong style="font-size:16px;color:var(--green);">🛸 Patrol Loot (${p.minutes}m / max 12h)</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
            </div>
            <div class="card" style="background:var(--bg-card-2);">
              <div style="font-size:18px;font-weight:900;">🪙 +${this.fmtNum(p.coins)} Gold</div>
              <div style="font-size:14px;font-weight:800;color:var(--cyan);">📘 +${p.blueprints} Blueprints</div>
              <div style="font-size:11px;color:var(--muted);">Watch a short video to claim 2x loot instantly!</div>
            </div>
            <button class="btn btn-amber" id="btn-patrol-2x">📺 2x Loot via Video! (🪙 +${this.fmtNum(p.coins * 2)})</button>
            <button class="btn btn-green" id="btn-patrol-1x">Claim 1x Free</button>
          </div>
        </div>
      `;
    }

    if (m.kind === 'lucky_wheel') {
      const freeLeft = Math.max(0, ADMOB_CONFIG.dailyWheelFreeLimit - this.save.wheelSpinsFreeUsedToday);
      const adLeft = Math.max(0, ADMOB_CONFIG.dailyWheelAdSpinsLimit - this.save.wheelSpinsAdUsedToday);
      const sliceDeg = 360 / WHEEL_REWARDS.length;
      const gradientStops = WHEEL_REWARDS.map(
        (s, i) => `${s.color} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`
      ).join(', ');

      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card" style="text-align:center;border-color:#fbbf24;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;color:#fbbf24;">🎡 Starforge Lucky Wheel</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close" ${m.spinning ? 'disabled' : ''}>✕</button>
            </div>

            <div class="wheel-stage">
              <div class="wheel-pointer"></div>
              <div class="wheel-disc" id="wheel-disc" style="background:conic-gradient(${gradientStops});transform:rotate(${m.rotation}deg);">
                ${WHEEL_REWARDS.map((s, i) => {
                  const angle = i * sliceDeg + sliceDeg / 2;
                  return `<div style="position:absolute;left:50%;top:50%;width:92px;transform-origin:0 0;transform:rotate(${angle - 90}deg) translate(24px,-50%);font-size:9px;font-weight:900;color:#fff;text-shadow:0 1px 3px #000;text-align:right;padding-right:6px;pointer-events:none;">${s.label}</div>`;
                }).join('')}
              </div>
              <div class="wheel-center">⚡</div>
            </div>

            ${
              m.lastResult
                ? `<div class="card glow-amber" style="padding:8px;font-size:13px;font-weight:900;color:#fbbf24;">🎉 Won: ${m.lastResult.label}!</div>`
                : `<div style="font-size:11px;color:var(--muted);">Spin for Gold, Gems, Cyber Keys & the 300 Gems Jackpot!</div>`
            }

            <div style="display:flex;flex-direction:column;gap:7px;">
              ${
                freeLeft > 0
                  ? `<button class="btn btn-green" id="btn-wheel-free" ${m.spinning ? 'disabled' : ''}>🎁 Free Daily Spin (${freeLeft} left)</button>`
                  : `<button class="btn btn-amber" id="btn-wheel-ad" ${m.spinning || adLeft <= 0 ? 'disabled' : ''}>📺 Free Spin via Video (${adLeft}/${ADMOB_CONFIG.dailyWheelAdSpinsLimit} left)</button>`
              }
              <button class="btn btn-primary" id="btn-wheel-gems" ${m.spinning || this.save.gems < ADMOB_CONFIG.wheelGemCost ? 'disabled' : ''}>
                💎 Spin Now (${ADMOB_CONFIG.wheelGemCost} Gems)
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (m.kind === 'codex') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;color:#c084fc;">📖 Weapon & Evolution Codex</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
            </div>
            <div style="font-size:11px;color:var(--muted);">
              Level a weapon to Lv.5 alongside its matching Passive during a run to unlock its Evolution (+25 💎 per discovery!).
            </div>
            ${WEAPONS.map((w) => {
              const pDef = PASSIVES.find((p) => p.id === w.evoPassive)!;
              const disc = this.save.discoveredEvos.includes(w.id);
              const claimed = this.save.claimedEvoCodex.includes(w.id);
              return `
                <div class="codex-row ${disc ? 'discovered' : ''}">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <strong style="font-size:13px;color:${w.color};">${weaponEmoji(w.id)} ${w.name} → ${w.evoName}</strong>
                    ${
                      disc && !claimed
                        ? `<button class="btn btn-amber" data-claim-codex="${w.id}" style="padding:4px 8px;font-size:10px;">Claim +25 💎</button>`
                        : `<span class="badge-tag" style="background:${disc ? 'var(--green)' : 'rgba(148,163,184,0.2)'};color:#fff;">${claimed ? 'Claimed ✓' : disc ? 'Discovered' : 'Locked'}</span>`
                    }
                  </div>
                  <div style="font-size:11px;color:var(--text);">Required Passive: <b style="color:${pDef.color};">${pDef.name}</b></div>
                  <div style="font-size:10px;color:var(--muted);">${w.evoDesc}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (m.kind === 'daily_streak') {
      return `
        <div class="modal-backdrop" id="modal-bg">
          <div class="modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:16px;">📅 7-Day Login Streak</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
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
              ${this.save.loginClaimedToday ? 'Claimed today ✓' : '🎁 Claim Daily Reward!'}
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
              <strong style="font-size:16px;">🏆 Endless Void Leaderboard</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
            </div>
            ${this.save.leaderboard
              .map(
                (e, idx) => `
              <div class="card" style="padding:8px 10px;flex-direction:row;align-items:center;justify-content:space-between;border-color:${e.isPlayer ? 'var(--cyan)' : 'var(--border)'};">
                <div>
                  <strong>#${idx + 1} ${this.esc(e.name)} ${e.isPlayer ? '(YOU)' : ''}</strong>
                  <div style="font-size:11px;color:var(--muted);">⏱️ ${this.fmtTime(e.wave)} • ⚡ ${e.power}</div>
                </div>
                <strong style="color:var(--amber);">${this.fmtNum(e.score)} pts</strong>
              </div>
            `
              )
              .join('')}
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
              <strong style="font-size:16px;color:${rm.color};">${gearSlotEmoji(item.slot)} ${item.name}</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
            </div>
            <div style="font-size:12px;">
              Rarity: <b style="color:${rm.color};">${rm.label}</b> • Level <b>${item.level}/${rm.maxLv}</b> • ⚡ <b>${itemPower}</b>
              ${
                !isEq && eqItem
                  ? `<span style="color:${powerDelta >= 0 ? 'var(--green)' : 'var(--rose)'};font-weight:900;"> (${powerDelta >= 0 ? `+${powerDelta}` : powerDelta} vs equipped)</span>`
                  : ''
              }
            </div>
            <div style="font-size:13px;font-weight:800;">⚔️ +${gs.atk} ATK • ❤️ +${gs.hp} HP</div>
            ${item.perkText ? `<div style="font-size:12px;color:var(--cyan);">✨ Perk: ${item.perkText}</div>` : ''}
            <div style="display:flex;gap:8px;">
              <button class="btn ${isEq ? 'btn-ghost' : 'btn-green'}" style="flex:1;" id="btn-gear-equip" ${isEq ? 'disabled' : ''}>
                ${isEq ? '✓ Equipped' : 'Equip'}
              </button>
              <button class="btn btn-primary" style="flex:1;" id="btn-gear-upgrade" ${item.level >= rm.maxLv || this.save.coins < cost.coins || this.save.blueprints < cost.blueprints ? 'disabled' : ''}>
                ⬆ Upgrade (🪙 ${this.fmtNum(cost.coins)} • 📘 ${cost.blueprints})
              </button>
            </div>
            ${
              mergeCount >= 3
                ? `<button class="btn btn-amber" id="btn-gear-merge">✨ Merge 3x → Next Rarity!</button>`
                : `<div style="font-size:11px;color:var(--muted);">Collect 3 identical items (${mergeCount}/3) to merge!</div>`
            }
            ${
              !isEq
                ? `<button class="btn btn-rose" id="btn-gear-salvage" style="font-size:12px;">♻️ Salvage (+🪙 ${this.fmtNum(salvage.coins)} • +📘 ${salvage.blueprints})</button>`
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
            <strong style="font-size:18px;color:#fbbf24;">✨ ${this.esc(m.title)}</strong>
            <div class="inv-grid">
              ${m.drops
                .map((d) => {
                  const rm = RARITY_META[d.rarity];
                  return `
                    <div class="inv-item" style="border-color:${rm.color};background:${rm.bg};">
                      <div style="font-size:20px;">${gearSlotEmoji(d.slot)}</div>
                      <div style="font-size:10px;font-weight:800;">${d.name}</div>
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
      return `
        <div class="modal-backdrop">
          <div class="modal-card" style="text-align:center;border-color:${s.victory ? 'var(--green)' : 'var(--cyan)'};">
            <div style="font-size:32px;">${s.victory ? '🏆✨' : '⚔️🔥'}</div>
            <div style="font-size:20px;font-weight:900;">${s.victory ? 'VICTORY!' : 'RUN COMPLETE'}</div>
            <div style="font-size:12px;color:var(--muted);">
              Survived: <b>${this.fmtTime(s.survivedSec)}</b> • Defeated: <b>${s.kills}</b> • Bosses: <b>${s.bossesKilled}</b>
              ${s.maxCombo >= 5 ? ` • Max Combo: <b style="color:#fbbf24;">${s.maxCombo}x</b>` : ''}
            </div>
            <div class="card" style="background:var(--bg-card-2);">
              <div style="font-size:14px;font-weight:900;">🪙 +${this.fmtNum(s.coinsEarned)} Gold • 💎 +${s.gemsEarned} Gems</div>
              <div style="font-size:12px;color:var(--cyan);">📘 +${s.blueprintsEarned} Blueprints • +${s.passXpEarned} Pass XP</div>
              ${s.evolutionsUnlocked.length > 0 ? `<div style="font-size:11px;color:#fbbf24;font-weight:800;">★ Evolutions: ${s.evolutionsUnlocked.map((e) => this.esc(e)).join(', ')}</div>` : ''}
              ${s.newGearDrop ? `<div style="font-size:12px;color:${RARITY_META[s.newGearDrop.rarity].color};font-weight:800;">🎁 New Gear: ${s.newGearDrop.name} (${RARITY_META[s.newGearDrop.rarity].label})</div>` : ''}
            </div>
            ${
              !s.doubledByAd
                ? `<button class="btn btn-amber" id="btn-double-loot">📺 Watch Video → 2x Gold & Gems!</button>`
                : `<div style="font-size:12px;color:var(--green);font-weight:800;">✓ 2x Loot Claimed!</div>`
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
              <strong style="font-size:16px;">⚙️ Settings & Profile</strong>
              <button class="icon-btn" id="modal-close" aria-label="Close">✕</button>
            </div>
            <label style="font-size:12px;font-weight:800;">Player Name
              <input id="in-player-name" value="${this.esc(this.save.playerName)}" style="width:100%;margin-top:4px;padding:8px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card-2);color:#fff;font-weight:700;">
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;">
              <span>🔊 Sound Effects</span>
              <input type="checkbox" id="chk-sound" ${this.save.soundEnabled ? 'checked' : ''}>
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;">
              <span>🎵 Synth Music</span>
              <input type="checkbox" id="chk-music" ${this.save.musicEnabled ? 'checked' : ''}>
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;">
              <span>📳 Vibration</span>
              <input type="checkbox" id="chk-vibe" ${this.save.vibrationEnabled ? 'checked' : ''}>
            </label>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;">
              <span>💥 Arena Damage Numbers</span>
              <input type="checkbox" id="chk-dmg" ${this.save.damageNumbersEnabled ? 'checked' : ''}>
            </label>
            <button class="btn btn-primary" id="btn-save-settings">Save</button>
            <button class="btn btn-rose" id="btn-reset-save" style="font-size:11px;">Reset Progress</button>
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
        this.forgeSub = el.dataset.forgeSub as ForgeSubTab;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-pass-sub]').forEach((el) => {
      el.addEventListener('click', () => {
        this.passSub = el.dataset.passSub as PassSubTab;
        this.render();
      });
    });

    this.root.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.modal = { kind: 'settings' };
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

    this.root.querySelector('#btn-start-battle')?.addEventListener('click', () => {
      audio.unlock();
      this.startBattle(this.selectedChapterId);
    });

    this.root.querySelector('#btn-collect-patrol')?.addEventListener('click', () => {
      const p = computePatrolEarnings(this.save);
      if (p.coins <= 0 && p.blueprints <= 0) {
        this.showToast('Patrol automatically collects offline Gold!');
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

    this.root.querySelector('#btn-boosters-ad')?.addEventListener('click', () => {
      void this.watchRewardedAd('free_boosters', () => {
        this.boosterAdGranted = true;
        this.boosters = { extraWeapon: true, overdriveAtk: true, doubleLuck: true };
        this.showToast('⚡ All 3 Boosters active for free on your next run!');
        this.render();
      });
    });

    this.root.querySelector('#btn-open-wheel')?.addEventListener('click', () => {
      this.modal = { kind: 'lucky_wheel', rotation: 0, spinning: false, lastResult: null };
      this.render();
    });

    this.root.querySelector('#btn-open-codex')?.addEventListener('click', () => {
      this.modal = { kind: 'codex' };
      this.render();
    });

    this.root.querySelector('#btn-forge-codex')?.addEventListener('click', () => {
      this.modal = { kind: 'codex' };
      this.render();
    });

    this.root.querySelector('#btn-open-streak')?.addEventListener('click', () => {
      this.modal = { kind: 'daily_streak' };
      this.render();
    });

    this.root.querySelector('#btn-open-leaderboard')?.addEventListener('click', () => {
      this.modal = { kind: 'leaderboard' };
      this.render();
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
        this.showToast(`🦸 ${h.name} unlocked!`);
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
        this.showToast(`♻️ Salvaged ${res.count}x Common: +${this.fmtNum(res.coins)} 🪙 & +${res.blueprints} 📘`);
        this.render();
      }
    });

    this.root.querySelector('#btn-auto-merge')?.addEventListener('click', () => {
      const count = autoMergeAllGear(this.save);
      if (count > 0) {
        audio.playEvoUnlock();
        this.showToast(`✨ Merged ${count}x Gear to higher Rarity!`);
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
    this.root.querySelector('#btn-open-cyber-10')?.addEventListener('click', () => handleCrate('cyber', 10, false, '10x Cyber Mega Pull!'));
    this.root.querySelector('#btn-open-mythic')?.addEventListener('click', () => handleCrate('mythic', 1, false, 'Mythic Vault Chest!'));
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

    // Pass & Quests & Achievements
    this.root.querySelector('#btn-claim-all-pass')?.addEventListener('click', () => {
      let claimed = 0;
      for (const pt of PASS_TIERS) {
        if (this.save.passXp < pt.xpRequired) continue;
        if (!this.save.passClaimedFree.includes(pt.tier)) {
          this.save.passClaimedFree.push(pt.tier);
          this.save.coins += pt.freeReward.coins || 0;
          this.save.gems += pt.freeReward.gems || 0;
          this.save.blueprints += pt.freeReward.blueprints || 0;
          this.save.cyberKeys += pt.freeReward.cyberKeys || 0;
          claimed += 1;
        }
        if (this.save.passPremiumUnlocked && !this.save.passClaimedPremium.includes(pt.tier)) {
          this.save.passClaimedPremium.push(pt.tier);
          this.save.coins += pt.premiumReward.coins || 0;
          this.save.gems += pt.premiumReward.gems || 0;
          this.save.cyberKeys += pt.premiumReward.cyberKeys || 0;
          claimed += 1;
        }
      }
      if (claimed > 0) {
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`🎁 Claimed ${claimed} Pass rewards!`);
        this.render();
      }
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-pass-free]').forEach((b) => {
      b.addEventListener('click', () => {
        const tier = Number(b.dataset.claimPassFree);
        const pt = PASS_TIERS.find((x) => x.tier === tier);
        if (!pt || this.save.passXp < pt.xpRequired || this.save.passClaimedFree.includes(tier)) return;
        this.save.passClaimedFree.push(tier);
        this.save.coins += pt.freeReward.coins || 0;
        this.save.gems += pt.freeReward.gems || 0;
        this.save.blueprints += pt.freeReward.blueprints || 0;
        this.save.cyberKeys += pt.freeReward.cyberKeys || 0;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`Pass Tier ${tier}: ${pt.freeLabel}`);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-pass-prem]').forEach((b) => {
      b.addEventListener('click', () => {
        const tier = Number(b.dataset.claimPassPrem);
        const pt = PASS_TIERS.find((x) => x.tier === tier);
        if (!pt || !this.save.passPremiumUnlocked || this.save.passXp < pt.xpRequired || this.save.passClaimedPremium.includes(tier)) return;
        this.save.passClaimedPremium.push(tier);
        this.save.coins += pt.premiumReward.coins || 0;
        this.save.gems += pt.premiumReward.gems || 0;
        this.save.cyberKeys += pt.premiumReward.cyberKeys || 0;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast(`👑 Premium Tier ${tier}: ${pt.premiumLabel}`);
        this.render();
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
        this.showToast(`Quest complete: +${q.gems} 💎 & +${q.coins} 🪙`);
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
        this.showToast(`🏆 ${a.title}: +${a.gems} 💎`);
        this.render();
      });
    });

    // Shop & Monetization
    this.root.querySelectorAll<HTMLElement>('[data-buy-sku]').forEach((b) => {
      b.addEventListener('click', () => {
        void this.handlePurchaseSku(b.dataset.buySku!);
      });
    });

    this.root.querySelector('#btn-restore-purchases')?.addEventListener('click', () => {
      void billing.restorePurchases().then((owned) => {
        const restored = applyOwnedEntitledSkus(this.save, owned);
        this.showToast(restored.length > 0 ? `Restored: ${restored.join(', ')}` : 'All purchases are up to date');
        this.render();
      });
    });

    this.root.querySelector('#btn-free-daily-gift')?.addEventListener('click', () => {
      if (this.save.freeGiftClaimedToday) return;
      this.save.freeGiftClaimedToday = true;
      this.save.coins += 500;
      this.save.gems += 20;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      this.showToast('🎁 +500 Gold & +20 Gems!');
      this.render();
    });

    this.root.querySelector('#btn-ad-gems')?.addEventListener('click', () => {
      if (this.save.adGemsUsedToday >= ADMOB_CONFIG.dailyAdGemsLimit) return;
      void this.watchRewardedAd('shop_gems', () => {
        this.save.adGemsUsedToday += 1;
        this.save.gems += ADMOB_CONFIG.dailyAdGemsAmount;
        saveGame(this.save);
        this.showToast(`💎 +${ADMOB_CONFIG.dailyAdGemsAmount} Gems received!`);
        this.render();
      });
    });

    this.root.querySelector('#btn-ad-key')?.addEventListener('click', () => {
      if (this.save.adKeysUsedToday >= ADMOB_CONFIG.dailyAdKeysLimit) return;
      void this.watchRewardedAd('shop_cyber_key', () => {
        this.save.adKeysUsedToday += 1;
        this.save.cyberKeys += 1;
        saveGame(this.save);
        this.showToast('🔑 +1 Cyber Supply Key received!');
        this.render();
      });
    });

    this.bindModalEvents();
  }

  private spinWheel(mode: 'free' | 'ad' | 'gems'): void {
    if (this.modal?.kind !== 'lucky_wheel' || this.modal.spinning) return;
    if (mode === 'free') {
      if (this.save.wheelSpinsFreeUsedToday >= ADMOB_CONFIG.dailyWheelFreeLimit) return;
      this.save.wheelSpinsFreeUsedToday += 1;
    } else if (mode === 'ad') {
      if (this.save.wheelSpinsAdUsedToday >= ADMOB_CONFIG.dailyWheelAdSpinsLimit) return;
      this.save.wheelSpinsAdUsedToday += 1;
    } else {
      if (this.save.gems < ADMOB_CONFIG.wheelGemCost) return;
      this.save.gems -= ADMOB_CONFIG.wheelGemCost;
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
        this.showToast(`🎡 Won: ${slice.label}!`);
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

    this.root.querySelector('#btn-ad-cancel')?.addEventListener('click', () => {
      if (this.modal?.kind === 'ad_preview') {
        this.modal.onDone(false);
      }
    });

    this.root.querySelectorAll<HTMLElement>('[data-pick-chapter]').forEach((b) => {
      b.addEventListener('click', () => {
        this.selectedChapterId = Number(b.dataset.pickChapter);
        this.modal = null;
        this.render();
      });
    });

    this.root.querySelector('#btn-patrol-1x')?.addEventListener('click', () => {
      const got = collectPatrolEarnings(this.save, 1);
      audio.playPurchaseSuccess();
      this.showToast(`🛸 Collected: +${this.fmtNum(got.coins)} Gold & +${got.blueprints} Blueprints!`);
      this.modal = null;
      this.render();
    });

    this.root.querySelector('#btn-patrol-2x')?.addEventListener('click', () => {
      void this.watchRewardedAd('patrol_2x', () => {
        const got = collectPatrolEarnings(this.save, 2);
        this.showToast(`🛸 2x Collected: +${this.fmtNum(got.coins)} Gold & +${got.blueprints} Blueprints!`);
        this.modal = null;
        this.render();
      });
    });

    this.root.querySelector('#btn-wheel-free')?.addEventListener('click', () => {
      this.spinWheel('free');
    });

    this.root.querySelector('#btn-wheel-ad')?.addEventListener('click', () => {
      if (this.save.wheelSpinsAdUsedToday >= ADMOB_CONFIG.dailyWheelAdSpinsLimit) return;
      void this.watchRewardedAd('lucky_wheel', () => {
        this.modal = { kind: 'lucky_wheel', rotation: 0, spinning: false, lastResult: null };
        this.spinWheel('ad');
      });
    });

    this.root.querySelector('#btn-wheel-gems')?.addEventListener('click', () => {
      this.spinWheel('gems');
    });

    this.root.querySelectorAll<HTMLElement>('[data-claim-codex]').forEach((b) => {
      b.addEventListener('click', () => {
        const wId = b.dataset.claimCodex as WeaponId;
        if (!this.save.discoveredEvos.includes(wId) || this.save.claimedEvoCodex.includes(wId)) return;
        this.save.claimedEvoCodex.push(wId);
        this.save.gems += 25;
        saveGame(this.save);
        audio.playPurchaseSuccess();
        this.showToast('📖 Codex Bonus: +25 💎 claimed!');
        this.render();
      });
    });

    this.root.querySelector('#btn-claim-streak')?.addEventListener('click', () => {
      if (this.save.loginClaimedToday) return;
      const r = LOGIN_STREAK_REWARDS[(this.save.loginStreak - 1) % LOGIN_STREAK_REWARDS.length];
      this.save.loginClaimedToday = true;
      this.save.coins += r.coins;
      this.save.gems += r.gems;
      this.save.cyberKeys += r.cyberKeys;
      saveGame(this.save);
      audio.playPurchaseSuccess();
      this.showToast(`📅 Day ${r.day} claimed: ${r.label}`);
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
        this.showToast(`✨ Merged to ${RARITY_META[merged.rarity].label}!`);
        this.modal = { kind: 'gear_detail', uid: merged.uid };
        this.render();
      }
    });

    this.root.querySelector('#btn-gear-salvage')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'gear_detail') return;
      const payout = salvageGearItem(this.save, this.modal.uid);
      if (payout) {
        audio.playPurchaseSuccess();
        this.showToast(`♻️ Salvaged: +${this.fmtNum(payout.coins)} 🪙 & +${payout.blueprints} 📘`);
        this.modal = null;
        this.render();
      }
    });

    this.root.querySelector('#btn-double-loot')?.addEventListener('click', () => {
      if (this.modal?.kind !== 'run_summary' || this.modal.summary.doubledByAd) return;
      const sum = this.modal.summary;
      void this.watchRewardedAd('double_run_loot', () => {
        this.save.coins += sum.coinsEarned;
        this.save.gems += sum.gemsEarned;
        sum.coinsEarned *= 2;
        sum.gemsEarned *= 2;
        sum.doubledByAd = true;
        saveGame(this.save);
        this.modal = { kind: 'run_summary', summary: sum };
        this.render();
      });
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
      this.showToast('Settings saved ✓');
      this.render();
    });

    this.root.querySelector('#btn-reset-save')?.addEventListener('click', () => {
      this.save = createDefaultSave();
      saveGame(this.save);
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
