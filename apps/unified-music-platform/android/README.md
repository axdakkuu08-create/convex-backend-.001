# Unified Music — Native Android

This is the primary native application foundation. It is separate from the browser preview in the parent directory.

## Native product foundation
- Kotlin + Jetpack Compose navigation for Home, Library, Search, Playlists, Favorites and Settings.
- MediaStore audio discovery behind Android's runtime audio-library permission.
- Canonical local track records persisted in Room, keyed by MediaStore content URI.
- Strict eligibility rule: duration >= 60,000 ms. 59,999 ms is excluded; 60,000 ms and 60,001 ms are eligible.
- Media3 ExoPlayer hosted by MediaSessionService for background playback and system media controls.
- Full player sheet with seek, previous/next, shuffle, repeat and a selectable queue.
- Recently used library navigation, title/artist/album search, persistent favorites and local playlists.
- Local per-track lyrics notes, device equalizer effect controls and saved Emerald/Ocean/Amber accent themes.
- Room migration from the initial library schema to favorites, playlists and lyrics tables.

## Convex + Clerk integration
- Native Convex Android client and Clerk-Convex bridge are included.
- Clerk's native sign-in UI is shown in Settings when a development deployment URL and publishable key are supplied.
- Explicit playlist-name sync uses the existing authenticated `playlists:listMine` and `playlists:create` functions. It adds missing names and does not delete or overwrite cloud playlists.
- Local audio URIs are never uploaded. Playlist track contents, local favorites and listening history are not cloud-synced yet; they need a stable cross-device track identity and verified backend support.
- Local playback, favorites, playlists and lyrics continue to work without signing in.

## Build configuration
The project uses JDK 17, Android Gradle Plugin 8.13.2, Kotlin 2.3.10 and Android SDK 36.

Provide these Gradle properties in your private Gradle user properties (not in Git):
```properties
UNIFIED_CONVEX_URL=https://YOUR-DEV-DEPLOYMENT.convex.cloud
UNIFIED_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
```

The build leaves both values blank by default. Never commit Clerk secret keys, Convex deploy keys or user tokens.

## Required account/deployment setup before live sync
1. In Clerk, enable the Native API for the Android app and register package name `app.unifiedmusic`.
2. Activate Clerk's Convex integration and note its exact Frontend API URL.
3. In the existing Convex development deployment, configure `CLERK_JWT_ISSUER_DOMAIN` to that URL.
4. Sync the existing backend's auth configuration from a trusted Node.js environment and verify Clerk issuer + application ID `convex` in the Convex dashboard.
5. Supply the public Convex development URL and Clerk publishable key as the private Gradle properties above.
6. Sign in from Settings, confirm Convex reports authenticated requests, then test account isolation.

The current repository snapshot has blank public Convex/Clerk frontend configuration and does not prove that a live Convex deployment has the Clerk issuer configured. Therefore no backend schema/functions were changed and no live sync is claimed.

## Build and verification status
- Source foundation is committed on the unified feature branch.
- No Gradle wrapper is included yet; the branch build workflow provisions Gradle 8.13 on a hosted runner.
- An Android Gradle build and physical-device test have not been run in this environment.
- This is not a release APK or a verified production player.
- No production deployment, domain change, merge or PR was performed.

## Online provider integration (feature branch)

The native Search screen now includes independent provider discovery:
- Internet Archive Advanced Search + item metadata lookup. Only explicit public-domain/CC0/CC BY/CC BY-SA rights markers are accepted. The app requires item runtime metadata (never treats file byte length as duration), excludes ambiguous multi-audio-file items, and probes the selected audio URL with an HTTP byte-range request before showing it as a candidate.
- Jamendo track search is enabled only when the optional `JAMENDO_CLIENT_ID` Gradle property is configured. Its accepted license filter is limited to public-domain/CC0/CC BY/CC BY-SA markers; obtain and verify current Jamendo API permission and terms before distributing an enabled build.
- Radio Browser station search is a separate tab and plays the station stream through the existing Media3 session.

Provider IDs and permalinks are used as stable identities in Media3 queue items. Stream URLs are resolved for the current search/play session and are not written to Room or Convex. Internet Archive results remain labeled as full-track candidates until real device playback confirms the selected file duration and uninterrupted playback. A successful byte-range probe only verifies that an audio endpoint responds; it is not proof that the entire recording plays correctly. Radio station streams can change or fail independently.

To enable Jamendo, register an application with Jamendo and add `JAMENDO_CLIENT_ID=...` to private Gradle user properties; never commit account credentials. Without this value, Internet Archive and Radio Browser remain available.

SoundCloud and Audiomack are intentionally not enabled: SoundCloud's multi-service aggregation restrictions conflict with this product model absent written approval, and Audiomack production credentials/rights are not established. No scraping, private endpoints, download bypasses or offline copies are used.

This integration is an initial provider-discovery and queue-playback slice. Remote favorites, cloud playlist source records, playback URL expiry recovery, and verified provider playback tests remain follow-up work. Do not treat API metadata or a returned stream URL as proof that a provider is fully approved or every track is playable.


## Navidrome / OpenSubsonic personal library

- Navidrome is the first-priority personal-library streaming provider; Internet Archive is the first-priority public on-demand provider.
- The native provider search includes a Navidrome connection panel.
- Enter the HTTPS base URL of your Navidrome server and an API key created for the account on that server. The app checks access through `getMusicFolders` and searches tracks through OpenSubsonic `search3`.
- API keys are encrypted with an AES-GCM key held by Android Keystore. The server URL is stored separately in app-private preferences. The app does not ask for or store the account password.
- Track streams and cover art are requested through the authenticated OpenSubsonic `stream` and `getCoverArt` endpoints and are sent to the existing Media3 player. Navidrome tracks use stable `navidrome:<song-id>` queue identities.
- Only HTTPS server URLs are accepted so API keys are not sent in clear text. Tracks shorter than 60 seconds are excluded to match the app's library eligibility rule.
- This connection is local to the Android app. It does not replace Convex, upload the library, or automatically share Navidrome credentials with cloud services. The server must be reachable from the Android device.
