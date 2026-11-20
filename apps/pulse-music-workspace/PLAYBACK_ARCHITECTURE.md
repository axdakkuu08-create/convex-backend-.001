# Pulse playback and offline architecture

## Ownership

- The vanilla HTML/CSS/JavaScript application owns discovery, source
  attribution, playlist presentation, and the ordered web queue.
- `PulsePlaylistPlayback` owns playlist normalization and queue navigation.
- `PulseQueueStorage` owns queue snapshots and recovery (IndexedDB primary,
  localStorage fallback). It stores references and attribution, not audio bytes.
- `PulseMediaPolicy` is the shared source/transport/rights boundary.
- `PulseOfflineMedia` owns explicit offline media downloads, cache metadata,
  quota checks, and deletion. It never downloads automatically.
- `PulseMedia3` is the platform adapter for Android Media3. The native service
  owns Android background playback and MediaSession controls.
- `sw.js` owns PWA app-shell caching and cache-first lookup of media that the
  user explicitly saved through PulseOfflineMedia.

## Source and rights contract

Every persisted or cached track retains sourceType, sourcePage, licenseLabel,
verificationStatus, and rightsReviewStatus. iTunes catalogue items are previews
and are never eligible for offline media saving. Internet Archive discovery is
not a licence grant: a track is eligible only when it is a verified full track,
has a non-empty licence label, and has the explicit status
`rightsReviewStatus === "APPROVED"`. The current discovery default is
REVIEW_REQUIRED, so unreviewed items remain stream-only.

## Transport contract

- Native Media3 playback accepts HTTPS URLs only.
- Web playback may continue to support user-provided HTTP URLs, with a visible
  security caveat; offline downloads require HTTPS.
- Local blob URLs remain browser-only and are not persisted as reusable offline
  media references.
- The service worker serves saved media from Cache Storage, including byte range
  requests, and does not cache arbitrary streaming URLs.
- A cached offline item is marked `offlineCached` and deliberately bypasses
  Media3 so the WebView service worker can satisfy the request. Android-native
  background playback of cached files still requires a separate Filesystem to
  Media3 local-URI adapter; it is not claimed complete here.

## Storage and failure behavior

- App-shell assets use a versioned service-worker cache and are refreshed on
  version change.
- Audio bytes are cached only after explicit user action and rights approval.
- A download is rejected on non-audio responses, opaque responses, empty files,
  files over 100 MiB, or insufficient reported quota.
- Browser Cache Storage is browser-managed, not an app-level encrypted Android
  file vault. It is a PWA offline layer, not completion of the blueprint's
  encrypted/scoped Capacitor Filesystem requirement.
- Cache metadata preserves attribution and is rolled back if metadata storage
  fails.
- Queue restoration filters invalid URLs and preserves the selected track by ID.
- Cache eviction or storage denial must be treated as a recoverable offline
  failure; online playback remains available.

## Deliberate non-goals

Pulse does not implement Subsonic server accounts, credential storage, podcast
subscriptions, radio management, Cast, UPnP/DLNA, or LAN remote playback from
the Tempus reference. The reference APK's static inventory is a comparison
source, not a requirement to copy its server-dependent features.
