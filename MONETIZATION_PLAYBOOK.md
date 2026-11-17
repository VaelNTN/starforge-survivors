# Starforge Survivors — Verdienmodel & Google Play Live Checklist

Alles in de app is al voorbereid op **echte omzet** via zowel **In-App Aankopen (Google Play Billing)** als **Google AdMob Video Ads**.

---

## 1. Google Play Console Product-ID's (Exact overnemen!)

Maak in **Google Play Console -> Monetize -> Products** exact deze SKU-ID's aan (status: **Active**):

### In-App Products (One-time / Consumables)
| Product ID (`sku`) | Type in Play Console | Voorgestelde Prijs | Wat de speler krijgt |
|---|---|---|---|
| `starforge_starter_pack` | In-app product (Consumable / 1x in game) | €1,99 | 500 Gems + Epic Katana + 20.000 Gold + 2 Cyber Keys |
| `starforge_no_ads` | In-app product (Non-consumable) | €4,99 | Verwijdert alle verplichte ads + +20% Gold + 300 Gems |
| `starforge_season_pass` | In-app product (Non-consumable) | €6,99 | Ontgrendelt 30 Premium Season Pass Tiers + 400 Gems |
| `starforge_piggy_bank` | In-app product (Consumable) | €2,99 | Kraakt gevulde spaarpot (tot 1.500 Gems) |
| `gems_100` | In-app product (Consumable) | €0,99 | 100 Gems (+100 bonus 1e keer) |
| `gems_500` | In-app product (Consumable) | €4,49 | 550 Gems (+550 bonus 1e keer) |
| `gems_1200` | In-app product (Consumable) | €9,99 | 1.350 Gems (+1.350 bonus 1e keer) |
| `gems_2600` | In-app product (Consumable) | €19,99 | 3.000 Gems (+3.000 bonus 1e keer) |
| `gems_6500` | In-app product (Consumable) | €44,99 | 7.500 Gems (+7.500 bonus 1e keer) |
| `gems_14000` | In-app product (Consumable) | €89,99 | 16.500 Gems (+16.500 bonus 1e keer) |

### Subscriptions (Abonnementen)
| Product ID (`sku`) | Base Plan | Voorgestelde Prijs | Voordelen |
|---|---|---|---|
| `starforge_vip_monthly` | 1 Month Auto-renew | €4,99/maand | 80 Gems/dag + +25% XP & Gold + Auto-Magnet + Ad-Free |

> De app haalt de echte gelokaliseerde prijzen (`€`, `$`, etc.) automatisch live uit Play Console via [`PlayBillingPlugin.java`](file:///home/antigravity/VaelNTN/starforge-survivors/android/app/src/main/java/com/vaelntn/starforgesurvivors/PlayBillingPlugin.java).

---

## 2. Google AdMob Live zetten (voor echte advertentie-omzet)

Momenteel staan de **officiële Google AdMob Test ID's** ingesteld zodat je tijdens testen nooit een policy-ban krijgt. Zodra je app in Google Play staat:
1. Maak in [AdMob](https://admob.google.com) de Android-app **Starforge Survivors** aan.
2. Maak **1 Rewarded Unit** en **1 Interstitial Unit** aan.
3. Vervang:
   - `admob_app_id` in `android/app/src/main/res/values/strings.xml`
   - `rewardedUnitId`, `interstitialUnitId` en zet `testMode: false` in `src/config/monetization.ts`
4. `git push` -> GitHub Actions bouwt direct een nieuwe gesigneerde `.aab`!

---

## 3. Play Console Instellingen voor Goedkeuring
- **Privacy Policy URL:** `https://github.com/VaelNTN/starforge-survivors/blob/main/PRIVACY_POLICY.md`
- **Contains Ads:** **Yes**
- **In-App Purchases:** **Yes**
- **Target Audience / Age:** **12+ / Teen** (Sci-fi cartoon combat)
- **GitHub Secrets (zelfde 5 als je andere apps):** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
