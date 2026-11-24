# Unified Music — Native Android

This is the primary native application foundation. It is intentionally separate from the existing browser preview in the parent directory.

## Current foundation
- Kotlin + Jetpack Compose app shell with Home, Library, Albums and Settings destinations.
- MediaStore audio discovery behind Android's runtime audio-library permission.
- One canonical local track row persisted in Room, keyed by its MediaStore content URI.
- Strict eligibility rule: duration >= 60,000 ms. 59,999 ms is excluded; 60,000 ms and 60,001 ms are eligible. Unknown/zero duration is not admitted.
- Media3 ExoPlayer hosted by MediaSessionService for system media controls and background playback.
- Selecting a library item queues the scanned library and starts at the selected track.
- MediaStore query and Room upsert run off the main thread.

## Product architecture
The navigation and data foundation are intended to grow into Home, Library, Search, Albums, Artists, Playlists, Favorites, Recently Added, Most Played, History, Now Playing, Queue, Lyrics, Equalizer and Settings. Levyra's public feature/audit material informs the feature roadmap, while this application uses its own implementation, visual identity and assets.

## Build
Open this directory as an Android Gradle project in Android Studio with JDK 17 and Android SDK 35 installed. The project currently does not include a Gradle wrapper. Build/device verification has not yet been recorded.

## Current limitations
- This is the first native foundation, not a release-ready player.
- Search, favorites, playlists, lyrics, equalizer, sleep timer and full player screen are roadmap items.
- Playback queue currently uses the scanned library order.
- Permission denial, empty MediaStore, removable storage, metadata edge cases, audio focus, Bluetooth controls, process recreation and Android-version behavior still require device testing.
- Convex/Clerk integration is deliberately not connected until deployment, auth and user isolation are verified.
- No APK, preview deployment, production change, merge or PR was created as part of this milestone.
