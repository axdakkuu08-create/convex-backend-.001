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
- `config.js` remains public client configuration. Never put Clerk secret keys,
  Convex deploy keys, signing passwords, or private credentials in it.
- Playlist and catalogue content can update online. Native application code
  changes still require a new Android release through the chosen distribution
  channel.

## Build locally

Use Node.js 22, Android Studio, and an Android SDK installation. This project
pins Capacitor 8.5.0 for a stable first native build.

From this directory:

```bash
npm install
npm run android:add
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

The Android project is generated during CI so the repository does not acquire an
unreviewed generated Gradle project. Native playback sources are stored in
`android-native/` and installed into the generated project by
`scripts/install-native-android.mjs`. The integration uses Media3 ExoPlayer and
MediaSessionService, registered through a Capacitor plugin. Direct HTTP(S) audio
URLs use the native bridge; local `blob:` audio files continue to use the
browser audio element.

## GitHub Actions

The `Pulse Android build` workflow runs on pull requests that change the Pulse
workspace and can also be started manually. It builds a debug APK and uploads it
as a workflow artifact for device testing.

A signed release APK and Play Store AAB are a separate release step. They must
use an authorized release keystore stored in GitHub Actions secrets; do not
commit the keystore or passwords. The same signing identity must be preserved
for future updates to the same Play app.

## Distribution

- Direct installation: use a signed release APK. The CI debug APK is for testing
  only and is not the public release build.
- Google Play: upload a signed AAB through the Play Console after completing the
  store listing, privacy disclosures, content declarations, testing track, and
  applicable review requirements. An eligible adult account holder must manage
  Play Console registration and publishing.
- Keep the website available at its existing URL throughout Android testing and
  release.

## Current limitations to verify before release

The native Media3 service and Capacitor control bridge are present in source.
`MediaSessionService` manages its default MediaStyle notification and
foreground-service transitions automatically. Pulse supplies a session activity
so tapping the media notification can reopen the app. The notification exposes
the standard playback actions supported by the current native ExoPlayer queue;
next/previous availability depends on whether that queue has adjacent items.

Only direct HTTP(S) audio tracks are placed in the native Media3 queue. Local
`blob:` tracks remain in the WebView audio element, so system notification and
Bluetooth queue navigation does not represent a mixed HTTP(S)/blob playlist as
one continuous queue. The in-app queue controls remain responsible for mixed
playback. Offline downloads and full mixed-queue background navigation are not
implemented.

The source configures ExoPlayer audio-focus handling and pauses on audio
becoming noisy (for example, when a wired headset is disconnected). These
source-level integrations still require physical-device verification. A
successful CI build proves packaging only; it does not prove background
playback, audio-focus behavior, headphone removal, notification controls, queue
transitions, Clerk sign-in, or Convex cloud sync on a physical Android phone.
Test those on the target device before a public release. Official Spotify,
YouTube, and SoundCloud embeds continue to follow provider restrictions inside
Android WebView.
