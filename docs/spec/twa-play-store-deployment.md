# TWA Play Store Deployment Guide

Phase 1 (PWA prerequisites) is complete and deployed. Follow these steps to finish the Android TWA and publish to the Play Store.

---

## Phase 2: Generate & Build the TWA

### 2.1 Generate TWA project via PWABuilder
1. Go to https://pwabuilder.com
2. Enter `https://in-context-flashcards.vercel.app`
3. Configure:
   - Package name: `com.incontext.flashcards`
   - App name: `In Context Flashcards`
   - Theme color: `#09090b`
   - Use the generated icons from `/public/icons/`
4. Download the Android project ZIP

### 2.2 Generate signing keystore
```bash
keytool -genkeypair -alias in-context-flashcards -keyalg RSA -keysize 2048 \
  -validity 10000 -keystore in-context-flashcards.keystore
```
**CRITICAL:** Store the keystore and password securely (e.g., 1Password). Loss = can never update the app. Never commit to git.

### 2.3 Build signed AAB
Either use PWABuilder's cloud build, or locally:
```bash
./gradlew bundleRelease
```
The `.aab` file is what gets uploaded to Play Store.

### 2.4 Get SHA-256 fingerprint for asset links
```bash
keytool -list -v -keystore in-context-flashcards.keystore -alias in-context-flashcards
```
Copy the `SHA256:` fingerprint value.

---

## Phase 3: Digital Asset Links

### 3.1 Update `/public/.well-known/assetlinks.json`
Replace `UPLOAD_KEY_SHA256_PLACEHOLDER` with the actual fingerprint from step 2.4.

After enrolling in Play App Signing (Play Console > Setup > App signing), add Google's signing key fingerprint too:
```json
"sha256_cert_fingerprints": [
  "YOUR_UPLOAD_KEY_SHA256",
  "PLAY_SIGNING_KEY_SHA256"
]
```

### 3.2 Deploy and validate
- Push the updated assetlinks.json to Vercel
- Verify: `curl https://in-context-flashcards.vercel.app/.well-known/assetlinks.json`
- Validate with https://developers.google.com/digital-asset-links/tools/generator
- This makes the TWA run full-screen (no Chrome URL bar)

---

## Phase 4: Play Store Submission

### 4.1 Google Play Developer account
- https://play.google.com/console — $25 one-time fee
- Identity verification may take 1-2 days

### 4.2 Store listing assets needed

| Asset | Spec |
|-------|------|
| App icon | 512x512 PNG, 32-bit, no alpha |
| Feature graphic | 1024x500 PNG/JPG |
| Phone screenshots | Min 2, 1080x1920 recommended |
| Short description | "Learn Mandarin with AI flashcards and spaced repetition." |
| Full description | Feature details (4000 char max) |
| Privacy policy URL | `https://in-context-flashcards.vercel.app/privacy` |
| Category | Education |

### 4.3 Required declarations
- **Content rating:** IARC questionnaire — expected: Everyone / PEGI 3
- **Data safety:** Email + name (auth), app activity (flashcards), payment via Stripe. Encrypted in transit, not shared for ads, deletion available.

### 4.4 Upload AAB and submit for review
Review typically takes 1-7 days.

---

## Important Notes

- **Stripe vs Play Billing:** Google requires Play Billing for digital goods, but TWAs (browser-based) currently operate in a gray area. Monitor policy. Fallback: link out to browser for billing.
- **Google OAuth:** Works as-is — TWA loads the real web domain, so redirect URIs are unchanged.
- **Updates:** Web changes deploy instantly via Vercel. Only icon/manifest/package changes require a Play Store update.
