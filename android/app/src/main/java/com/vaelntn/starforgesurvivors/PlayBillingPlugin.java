package com.vaelntn.starforgesurvivors;

import android.app.Activity;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private boolean isConnected = false;
    private final Map<String, ProductDetails> productCache = new HashMap<>();

    private PluginCall pendingPurchaseCall = null;
    private boolean pendingIsConsumable = true;
    private String pendingSku = "";

    @Override
    public void load() {
        super.load();
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
                )
                .build();
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        JSArray inappArr = call.getArray("inappIds");
        JSArray subArr = call.getArray("subIds");
        List<String> inappIds = toStringList(inappArr);
        List<String> subIds = toStringList(subArr);

        if (isConnected && billingClient.isReady()) {
            queryAllProductsAndResolve(call, inappIds, subIds);
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    isConnected = true;
                    queryAllProductsAndResolve(call, inappIds, subIds);
                } else {
                    isConnected = false;
                    JSObject res = new JSObject();
                    res.put("connected", false);
                    res.put("isDebugBuild", BuildConfig.DEBUG);
                    res.put("products", new JSArray());
                    call.resolve(res);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                isConnected = false;
            }
        });
    }

    private void queryAllProductsAndResolve(PluginCall call, List<String> inappIds, List<String> subIds) {
        JSArray outProducts = new JSArray();

        queryType(inappIds, BillingClient.ProductType.INAPP, outProducts, () -> {
            queryType(subIds, BillingClient.ProductType.SUBS, outProducts, () -> {
                JSObject res = new JSObject();
                res.put("connected", true);
                res.put("isDebugBuild", BuildConfig.DEBUG);
                res.put("products", outProducts);
                call.resolve(res);
            });
        });
    }

    private void queryType(List<String> ids, String type, JSArray outProducts, Runnable onDone) {
        if (ids.isEmpty()) {
            onDone.run();
            return;
        }
        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        for (String id : ids) {
            productList.add(
                    QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(id)
                            .setProductType(type)
                            .build()
            );
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

        billingClient.queryProductDetailsAsync(params, (result, detailsList) -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && detailsList != null) {
                for (ProductDetails pd : detailsList) {
                    productCache.put(pd.getProductId(), pd);
                    JSObject obj = new JSObject();
                    obj.put("productId", pd.getProductId());
                    obj.put("title", pd.getName());
                    if (BillingClient.ProductType.INAPP.equals(type) && pd.getOneTimePurchaseOfferDetails() != null) {
                        obj.put("price", pd.getOneTimePurchaseOfferDetails().getFormattedPrice());
                    } else if (pd.getSubscriptionOfferDetails() != null && !pd.getSubscriptionOfferDetails().isEmpty()) {
                        ProductDetails.SubscriptionOfferDetails offer = pd.getSubscriptionOfferDetails().get(0);
                        if (!offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                            obj.put("price", offer.getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice());
                        }
                    }
                    outProducts.put(obj);
                }
            }
            onDone.run();
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String sku = call.getString("productId", "");
        String type = call.getString("productType", "inapp");
        boolean isConsumable = Boolean.TRUE.equals(call.getBoolean("isConsumable", true));

        if (!isConnected || !billingClient.isReady()) {
            JSObject err = new JSObject();
            err.put("purchased", false);
            err.put("productId", sku);
            err.put("error", "BILLING_UNAVAILABLE");
            call.resolve(err);
            return;
        }

        ProductDetails pd = productCache.get(sku);
        if (pd == null) {
            List<QueryProductDetailsParams.Product> one = Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(sku)
                            .setProductType("subs".equals(type) ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP)
                            .build()
            );
            billingClient.queryProductDetailsAsync(
                    QueryProductDetailsParams.newBuilder().setProductList(one).build(),
                    (result, list) -> {
                        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null && !list.isEmpty()) {
                            ProductDetails fetched = list.get(0);
                            productCache.put(sku, fetched);
                            launchFlow(call, fetched, sku, isConsumable);
                        } else {
                            JSObject err = new JSObject();
                            err.put("purchased", false);
                            err.put("productId", sku);
                            err.put("error", "ITEM_UNAVAILABLE");
                            call.resolve(err);
                        }
                    }
            );
            return;
        }

        launchFlow(call, pd, sku, isConsumable);
    }

    private void launchFlow(PluginCall call, ProductDetails pd, String sku, boolean isConsumable) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        BillingFlowParams.ProductDetailsParams.Builder pdp =
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
        if (BillingClient.ProductType.SUBS.equals(pd.getProductType())
                && pd.getSubscriptionOfferDetails() != null
                && !pd.getSubscriptionOfferDetails().isEmpty()) {
            pdp.setOfferToken(pd.getSubscriptionOfferDetails().get(0).getOfferToken());
        }

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(pdp.build()))
                .build();

        pendingPurchaseCall = call;
        pendingIsConsumable = isConsumable;
        pendingSku = sku;

        activity.runOnUiThread(() -> {
            BillingResult launchRes = billingClient.launchBillingFlow(activity, flowParams);
            if (launchRes.getResponseCode() != BillingClient.BillingResponseCode.OK && pendingPurchaseCall != null) {
                JSObject err = new JSObject();
                err.put("purchased", false);
                err.put("productId", sku);
                err.put("error", "LAUNCH_FAILED_" + launchRes.getResponseCode());
                PluginCall c = pendingPurchaseCall;
                pendingPurchaseCall = null;
                c.resolve(err);
            }
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        if (pendingPurchaseCall == null) return;
        PluginCall call = pendingPurchaseCall;
        String sku = pendingSku;
        boolean consumable = pendingIsConsumable;
        pendingPurchaseCall = null;

        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject res = new JSObject();
            res.put("purchased", false);
            res.put("cancelled", true);
            res.put("productId", sku);
            call.resolve(res);
            return;
        }

        if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            JSObject res = new JSObject();
            res.put("purchased", false);
            res.put("productId", sku);
            res.put("error", "BILLING_ERROR_" + code);
            call.resolve(res);
            return;
        }

        Purchase purchase = purchases.get(0);
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            JSObject res = new JSObject();
            res.put("purchased", false);
            res.put("pending", true);
            res.put("productId", sku);
            call.resolve(res);
            return;
        }

        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            if (consumable) {
                ConsumeParams cp = ConsumeParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();
                billingClient.consumeAsync(cp, (consumeRes, token) -> {
                    JSObject res = new JSObject();
                    res.put("purchased", consumeRes.getResponseCode() == BillingClient.BillingResponseCode.OK);
                    res.put("productId", sku);
                    res.put("purchaseToken", token);
                    res.put("orderId", purchase.getOrderId());
                    res.put("isSandbox", false);
                    call.resolve(res);
                });
            } else if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams ap = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();
                billingClient.acknowledgePurchase(ap, ackRes -> {
                    JSObject res = new JSObject();
                    res.put("purchased", ackRes.getResponseCode() == BillingClient.BillingResponseCode.OK);
                    res.put("productId", sku);
                    res.put("purchaseToken", purchase.getPurchaseToken());
                    res.put("orderId", purchase.getOrderId());
                    res.put("isSandbox", false);
                    call.resolve(res);
                });
            } else {
                JSObject res = new JSObject();
                res.put("purchased", true);
                res.put("productId", sku);
                res.put("orderId", purchase.getOrderId());
                res.put("isSandbox", false);
                call.resolve(res);
            }
        }
    }

    @PluginMethod
    public void purchaseDebugSandbox(PluginCall call) {
        if (!BuildConfig.DEBUG) {
            call.reject("Sandbox purchases are disabled in Release builds");
            return;
        }
        String sku = call.getString("productId", "");
        JSObject res = new JSObject();
        res.put("purchased", true);
        res.put("isSandbox", true);
        res.put("productId", sku);
        res.put("orderId", "DEBUG-SANDBOX-" + System.currentTimeMillis());
        call.resolve(res);
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        if (!isConnected || !billingClient.isReady()) {
            JSObject res = new JSObject();
            res.put("ownedIds", new JSArray());
            res.put("isDebugBuild", BuildConfig.DEBUG);
            call.resolve(res);
            return;
        }

        JSArray ownedIds = new JSArray();
        QueryPurchasesParams inappParams = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        QueryPurchasesParams subParams = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();

        billingClient.queryPurchasesAsync(inappParams, (r1, p1) -> {
            collectOwned(p1, ownedIds);
            billingClient.queryPurchasesAsync(subParams, (r2, p2) -> {
                collectOwned(p2, ownedIds);
                JSObject res = new JSObject();
                res.put("ownedIds", ownedIds);
                res.put("isDebugBuild", BuildConfig.DEBUG);
                call.resolve(res);
            });
        });
    }

    private void collectOwned(@Nullable List<Purchase> purchases, JSArray out) {
        if (purchases == null) return;
        for (Purchase p : purchases) {
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                if (!p.isAcknowledged()) {
                    AcknowledgePurchaseParams ap = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(p.getPurchaseToken())
                            .build();
                    billingClient.acknowledgePurchase(ap, r -> {});
                }
                for (String prodId : p.getProducts()) {
                    out.put(prodId);
                }
            }
        }
    }

    private List<String> toStringList(@Nullable JSArray arr) {
        List<String> list = new ArrayList<>();
        if (arr == null) return list;
        for (int i = 0; i < arr.length(); i++) {
            try {
                list.add(arr.getString(i));
            } catch (JSONException ignored) {
            }
        }
        return list;
    }
}
