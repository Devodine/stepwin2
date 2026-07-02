# StepWin Mobile

React Native app that syncs step counts from Apple Health (iOS) and
Health Connect (Android), and reuses the same backend as the website.

This is source code only — you'll need a Mac with Xcode for iOS and
Android Studio for Android to actually build and run it. I can't compile
or publish mobile apps from this environment.

## 1. Install

```
cd mobile
npm install
cd ios && pod install && cd ..     # iOS only
```

## 2. Point it at your backend

Edit `src/services/api.js` → `API_BASE` to your deployed backend URL
(the same one the website uses).

## 3. iOS — HealthKit setup

1. In Xcode, select your target → **Signing & Capabilities** → add the
   **HealthKit** capability.
2. Add to `ios/StepWinMobile/Info.plist`:
   ```xml
   <key>NSHealthShareUsageDescription</key>
   <string>StepWin reads your step count to track challenge progress.</string>
   ```
3. HealthKit is iOS-only and **does not work in the iOS Simulator for real
   step data** — test on a physical device with the Health app populated
   (Health app → Browse → Activity → Steps, or wear an Apple Watch).

## 4. Android — Health Connect setup

1. Health Connect must be installed on the device (Android 14+ ships it
   built in; older devices install it from the Play Store).
2. Add to `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.health.READ_STEPS" />
   <queries>
     <package android:name="com.google.android.apps.healthdata" />
   </queries>
   ```
3. Declare the Health Connect permissions rationale activity as required by
   `react-native-health-connect`'s setup docs — this changes between library
   versions, so check the installed version's README before release.

## 4. Razorpay in-app checkout

`react-native-razorpay` needs the same `RAZORPAY_KEY_ID` your backend uses
(it's returned by `/join/create-order`, not hardcoded in the app). No
extra native setup is required beyond linking the library.

## What auto-syncs and what doesn't

- **Works now**: user taps "Connect health app" → grants permission →
  taps "Sync today's steps" (or does it right after connecting) → today's
  step count is read from HealthKit/Health Connect and posted to the
  backend.
- **Not included yet**: true background sync while the app is closed. That
  needs a native background task (iOS Background Fetch / BGTaskScheduler,
  Android WorkManager) registered separately per platform. Worth adding
  once the foreground flow above is tested and working — it's a bigger
  lift and easy to get wrong (battery usage, OS-imposed run limits), so
  it's better as a second pass than bundled into the first release.

## Before you publish

- Apple App Review scrutinizes HealthKit usage — be precise in your
  `NSHealthShareUsageDescription` about what you read and why.
- Both app stores require a real privacy policy covering health data if
  you read HealthKit/Health Connect data — this is not optional, and
  incomplete disclosures are a common rejection reason.
- Same Razorpay KYC/category caveat as the backend README: confirm your
  account is cleared for real-money step-challenges before submitting
  for review.
