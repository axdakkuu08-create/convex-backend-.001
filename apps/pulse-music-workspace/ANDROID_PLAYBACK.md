# Pulse Android Playback Foundation

Pulse keeps its existing vanilla web frontend and Vercel website. The Android
package is a separate Capacitor shell that bundles the same frontend.

## Native playback boundary

- Android uses Media3 ExoPlayer inside PulseAudioService / MediaSessionService.
- The Capacitor PulseMedia3 plugin exposes a queue, play/pause, seek, volume,
  next/previous and playback-state events.
- Native mode is selected only when every item in the active Pulse queue is a
  direct HTTPS audio URL. Mixed queues (including local blob URLs) remain on the
  existing HTMLAudioElement path so Android cannot silently skip local items or
  reorder a mixed queue.
- Native service transport is HTTPS-only. The generated Android manifest
  disables cleartext traffic and declares media foreground-service, wake-lock
  and notification permissions.
- ExoPlayer handles audio focus and pauses when audio becomes noisy (such as
  headset disconnect). These are source-level integrations until physical device
  tests pass.
- MediaSessionService provides the system media notification and lock-screen
  transport actions for the native queue.

## Build

The GitHub Actions workflow creates an Android debug APK and uploads it as a
short-lived workflow artifact. It uses public Pulse cloud settings only when
both PULSE_CONVEX_URL and PULSE_CLERK_PUBLISHABLE_KEY repository variables are
supplied. If both are absent, it builds local-only mode. Never supply secret
keys or signing credentials to these variables.

## Current limits

- The PWA offline adapter can cache rights-approved Internet Archive audio in
  browser Cache Storage. This cache is available to WebView/HTML audio requests.
  It is not an encrypted native Filesystem vault and does not satisfy the
  blueprint's full Android offline-storage requirement.
- Media3 does not yet read the PWA Cache Storage or an Android Filesystem copy.
  Offline-cached items therefore stay on the web audio path and do not gain
  native background playback while offline.
- Local file blob URLs and mixed HTTP/blob queues use web playback and do not
  gain native background playback.
- A green Android build proves packaging and compilation only. It does not prove
  background execution, lock-screen actions, audio focus, Bluetooth behavior,
  format compatibility, or real playback.
- B14–B18 remain pending until tested on a physical Android device. Do not treat
  CI as device acceptance.
