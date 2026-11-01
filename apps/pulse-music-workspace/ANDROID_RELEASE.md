# Pulse Android app and release track

Pulse remains a web app hosted by the existing Vercel project. This separate
Capacitor project packages the same frontend into an Android application; it
does not replace the website or change the Convex deployment.

## Architecture

- The website continues to deploy from this directory through the existing
  Vercel project.
- Capacitor copies the static frontend into the generated `www/` directory.
- The Android application loads that bundled frontend and uses the same public
  service endpoints as the website.
- `config.js` remains public client configuration. Never put Clerk secret
  keys, Convex deploy keys, signing passwords, or private credentials in it.
- Playlist and catalogue content can update online. Native application code
  changes still require a new Android release through the chosen distribution
  channel.

## Build locally

Use Node.js 24, Android Studio, and an Android SDK installation.

From this directory:

```bash
npm install
npm run build:web
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is created at
`android/app/build/outputs/apk/debug/app-debug.apk`.

The Android project is generated during CI so the repository does not acquire
an unreviewed generated Gradle project. Native customizations should be added
as deliberate source changes in a later reviewed PR.

## GitHub Actions

The `Pulse Android build` workflow runs on pull requests that change the Pulse
workspace and can also be started manually. It always attempts a debug APK and
uploads it as a workflow artifact.

A signed release APK and Play Store AAB are built only when all four repository
Actions secrets are configured:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The keystore must be an authorized release key, backed up securely, and reused
for future updates to the same Play app. Never commit the keystore or passwords.
Without signing secrets, CI deliberately skips release artifacts rather than
creating an upload that cannot be used for Play distribution.

## Distribution

- Direct installation: use the signed release APK after signing is configured.
  The CI debug APK is for testing only and is not the public release build.
- Google Play: upload the signed AAB through the Play Console after completing
  the store listing, privacy disclosures, content declarations, testing track,
  and applicable review requirements. An eligible adult account holder must
  manage Play Console registration and publishing.
- Keep the website available at its existing URL throughout Android testing
  and release.

## Current limitations to verify before release

This first wrapper does not yet implement a native background audio service,
media notification/session controls, offline audio downloads, or a full native
audio focus lifecycle. Existing web playback and official provider embeds may
behave differently inside Android WebView. These must be implemented or tested
before describing them as supported.

A successful CI build proves packaging only. It does not prove playback,
Clerk sign-in, Convex cloud sync, queue controls, or background playback on a
physical Android phone. Test those on the target device before a public release.
