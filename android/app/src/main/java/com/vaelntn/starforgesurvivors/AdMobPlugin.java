package com.vaelntn.starforgesurvivors;

import android.app.Activity;
import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

@CapacitorPlugin(name = "AdMobNative")
public class AdMobPlugin extends Plugin {

    private String rewardedUnitId = "ca-app-pub-3940256099942544/5224354917";
    private String interstitialUnitId = "ca-app-pub-3940256099942544/1033173712";

    private RewardedAd rewardedAd = null;
    private InterstitialAd interstitialAd = null;
    private boolean isLoadingRewarded = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        rewardedUnitId = call.getString("rewardedUnitId", rewardedUnitId);
        interstitialUnitId = call.getString("interstitialUnitId", interstitialUnitId);

        Activity activity = getActivity();
        if (activity == null) {
            JSObject out = new JSObject();
            out.put("ready", false);
            call.resolve(out);
            return;
        }

        activity.runOnUiThread(() -> {
            MobileAds.initialize(getContext(), status -> {
                preloadRewarded();
                preloadInterstitial();
            });
            JSObject out = new JSObject();
            out.put("ready", true);
            call.resolve(out);
        });
    }

    private void preloadRewarded() {
        Activity activity = getActivity();
        if (activity == null || isLoadingRewarded || rewardedAd != null) return;
        isLoadingRewarded = true;
        AdRequest req = new AdRequest.Builder().build();
        RewardedAd.load(activity, rewardedUnitId, req, new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                isLoadingRewarded = false;
                rewardedAd = ad;
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                isLoadingRewarded = false;
                rewardedAd = null;
            }
        });
    }

    private void preloadInterstitial() {
        Activity activity = getActivity();
        if (activity == null) return;
        AdRequest req = new AdRequest.Builder().build();
        InterstitialAd.load(activity, interstitialUnitId, req, new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull InterstitialAd ad) {
                interstitialAd = ad;
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                interstitialAd = null;
            }
        });
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            JSObject out = new JSObject();
            out.put("rewarded", false);
            call.resolve(out);
            return;
        }

        activity.runOnUiThread(() -> {
            if (rewardedAd != null) {
                RewardedAd ad = rewardedAd;
                rewardedAd = null;
                presentRewardedAd(activity, ad, call);
                return;
            }

            // Load on demand so the user doesn't hit an immediate AD_NOT_READY
            AdRequest req = new AdRequest.Builder().build();
            RewardedAd.load(activity, rewardedUnitId, req, new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    presentRewardedAd(activity, ad, call);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError err) {
                    JSObject out = new JSObject();
                    out.put("rewarded", false);
                    out.put("error", "AD_NOT_READY");
                    call.resolve(out);
                }
            });
        });
    }

    private void presentRewardedAd(Activity activity, RewardedAd ad, PluginCall call) {
        final boolean[] earned = { false };
        final boolean[] resolved = { false };

        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                preloadRewarded();
                if (!resolved[0]) {
                    resolved[0] = true;
                    JSObject out = new JSObject();
                    out.put("rewarded", earned[0]);
                    call.resolve(out);
                }
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                preloadRewarded();
                if (!resolved[0]) {
                    resolved[0] = true;
                    JSObject out = new JSObject();
                    out.put("rewarded", false);
                    out.put("error", adError.getMessage());
                    call.resolve(out);
                }
            }
        });

        ad.show(activity, rewardItem -> earned[0] = true);
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            JSObject out = new JSObject();
            out.put("shown", false);
            call.resolve(out);
            return;
        }

        activity.runOnUiThread(() -> {
            if (interstitialAd == null) {
                preloadInterstitial();
                JSObject out = new JSObject();
                out.put("shown", false);
                call.resolve(out);
                return;
            }

            InterstitialAd ad = interstitialAd;
            interstitialAd = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    preloadInterstitial();
                    JSObject out = new JSObject();
                    out.put("shown", true);
                    call.resolve(out);
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    preloadInterstitial();
                    JSObject out = new JSObject();
                    out.put("shown", false);
                    call.resolve(out);
                }
            });
            ad.show(activity);
        });
    }
}
