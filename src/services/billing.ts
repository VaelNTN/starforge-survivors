import { Capacitor, registerPlugin } from '@capacitor/core';
import { ADMOB_CONFIG, SHOP_SKUS } from '../config/monetization';

export interface PlayProductInfo {
  productId: string;
  price: string;
  title?: string;
}

export interface PlayBillingInitResult {
  connected: boolean;
  isDebugBuild: boolean;
  nativeAvailable: boolean;
  products: Record<string, PlayProductInfo>;
}

export interface PurchaseResult {
  purchased: boolean;
  cancelled?: boolean;
  pending?: boolean;
  isSandbox?: boolean;
  productId: string;
  purchaseToken?: string;
  orderId?: string;
  error?: string;
}

interface PlayBillingNativePlugin {
  initialize(opts: { inappIds: string[]; subIds: string[] }): Promise<{
    connected: boolean;
    isDebugBuild: boolean;
    products?: PlayProductInfo[];
  }>;
  purchase(opts: { productId: string; productType: 'inapp' | 'subs'; isConsumable: boolean }): Promise<PurchaseResult>;
  purchaseDebugSandbox(opts: { productId: string }): Promise<PurchaseResult>;
  restorePurchases(): Promise<{ ownedIds: string[]; isDebugBuild: boolean }>;
}

interface AdMobNativePlugin {
  initialize(opts: { rewardedUnitId: string; interstitialUnitId: string; testMode: boolean }): Promise<{ ready: boolean }>;
  showRewarded(opts: { placement: string }): Promise<{ rewarded: boolean; simulated?: boolean; error?: string }>;
  showInterstitial(): Promise<{ shown: boolean }>;
}

const PlayBillingNative = registerPlugin<PlayBillingNativePlugin>('PlayBilling');
const AdMobNative = registerPlugin<AdMobNativePlugin>('AdMobNative');

class MonetizationBridge {
  private initResult: PlayBillingInitResult = {
    connected: false,
    isDebugBuild: !Capacitor.isNativePlatform(),
    nativeAvailable: false,
    products: {},
  };
  private adInitialized = false;

  async initAll(): Promise<PlayBillingInitResult> {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      this.initResult = {
        connected: false,
        isDebugBuild: true,
        nativeAvailable: false,
        products: {},
      };
      return this.initResult;
    }

    const inappIds = SHOP_SKUS.filter((s) => s.productType === 'inapp').map((s) => s.sku);
    const subIds = SHOP_SKUS.filter((s) => s.productType === 'subs').map((s) => s.sku);

    try {
      const res = await PlayBillingNative.initialize({ inappIds, subIds });
      const map: Record<string, PlayProductInfo> = {};
      for (const p of res.products || []) {
        map[p.productId] = p;
      }
      this.initResult = {
        connected: res.connected,
        isDebugBuild: res.isDebugBuild,
        nativeAvailable: true,
        products: map,
      };
    } catch {
      this.initResult = {
        connected: false,
        isDebugBuild: false,
        nativeAvailable: false,
        products: {},
      };
    }

    try {
      await AdMobNative.initialize({
        rewardedUnitId: ADMOB_CONFIG.rewardedUnitId,
        interstitialUnitId: ADMOB_CONFIG.interstitialUnitId,
        testMode: ADMOB_CONFIG.testMode,
      });
      this.adInitialized = true;
    } catch {
      this.adInitialized = false;
    }

    return this.initResult;
  }

  getBillingStatus(): PlayBillingInitResult {
    return this.initResult;
  }

  getLocalizedPrice(sku: string, fallbackPrice: string): string {
    return this.initResult.products[sku]?.price || fallbackPrice;
  }

  async purchaseSku(sku: string): Promise<PurchaseResult> {
    const def = SHOP_SKUS.find((s) => s.sku === sku);
    if (!def) {
      return { purchased: false, productId: sku, error: 'Unknown product' };
    }

    if (!Capacitor.isNativePlatform()) {
      // Web / Browser preview simulation
      return {
        purchased: true,
        isSandbox: true,
        productId: sku,
        orderId: `WEB-PREVIEW-${Date.now()}`,
      };
    }

    try {
      const res = await PlayBillingNative.purchase({
        productId: def.sku,
        productType: def.productType,
        isConsumable: def.isConsumable,
      });
      if (res.purchased) return res;

      // Only in Android DEBUG builds: allow local sideload fallback if Play Console products are not live yet
      if (this.initResult.isDebugBuild && !res.cancelled && res.error?.includes('UNAVAILABLE')) {
        return await PlayBillingNative.purchaseDebugSandbox({ productId: def.sku });
      }
      return res;
    } catch (err) {
      if (this.initResult.isDebugBuild) {
        return await PlayBillingNative.purchaseDebugSandbox({ productId: def.sku }).catch(() => ({
          purchased: false,
          productId: sku,
          error: err instanceof Error ? err.message : 'Purchase failed',
        }));
      }
      return {
        purchased: false,
        productId: sku,
        error: err instanceof Error ? err.message : 'Google Play purchase cancelled or unavailable',
      };
    }
  }

  async restorePurchases(): Promise<string[]> {
    if (!Capacitor.isNativePlatform()) return [];
    try {
      const res = await PlayBillingNative.restorePurchases();
      return res.ownedIds || [];
    } catch {
      return [];
    }
  }

  async showRewardedAd(
    placement: string,
    onDebugPreview?: () => Promise<boolean>
  ): Promise<{ rewarded: boolean; simulated?: boolean; error?: string }> {
    if (Capacitor.isNativePlatform() && this.adInitialized) {
      try {
        const res = await AdMobNative.showRewarded({ placement });
        if (res.rewarded) return res;
        if (!this.initResult.isDebugBuild) return res;
      } catch {
        if (!this.initResult.isDebugBuild) {
          return { rewarded: false, error: 'Reward video is still loading, please try again shortly.' };
        }
      }
    }

    // In browser preview or debug APK without network fill: run interactive 3s preview modal
    if (onDebugPreview) {
      const ok = await onDebugPreview();
      return { rewarded: ok, simulated: true };
    }
    return { rewarded: false, error: 'No reward video available right now' };
  }

  async maybeShowPostRunInterstitial(hasNoAds: boolean, totalRuns: number, lastShownAt: number): Promise<boolean> {
    if (hasNoAds) return false;
    if (totalRuns <= ADMOB_CONFIG.skipInterstitialFirstRuns) return false;
    if (Date.now() - lastShownAt < ADMOB_CONFIG.interstitialMinCooldownMs) return false;

    if (Capacitor.isNativePlatform() && this.adInitialized) {
      try {
        const res = await AdMobNative.showInterstitial();
        return Boolean(res.shown);
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const billing = new MonetizationBridge();
