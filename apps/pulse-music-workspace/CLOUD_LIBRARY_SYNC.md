# Pulse cloud library sync

This extends the existing Pulse workspace and Convex backend; it does not create
a second app or deployment.

## Included in this change

- Owner-scoped Convex functions for saved tracks, recently played metadata, and
  playlist track contents.
- The schema adds a bounded recent-history table with owner/time and
  owner/source indexes.
- The frontend emits events when a supported web audio track is played or
  favorited, syncs those events after sign-in, and offers an action to add the
  current supported track to a cloud playlist.
- Existing local favorites/history are offered for migration after sign-in.
  Local playback and localStorage remain the fallback when cloud auth/network is
  unavailable.
- Cloud library panels are cleared and subscriptions stopped on sign-out.

## Security and data limits

- Every function derives its owner from Convex's verified Clerk identity; the
  client never supplies an owner ID.
- Playlist operations check playlist ownership; saved tracks and history are
  owner-indexed.
- Only track metadata and HTTP(S) provider links are stored. Local file bytes,
  credentials, and provider access tokens are not uploaded.
- Provider iframe playback remains controlled by Spotify, YouTube, or
  SoundCloud. A unified cloud queue does not override provider restrictions;
  external embeds still use their official player controls.

## Required verification before release

1. In a trusted Node.js environment, run 'npm install' and 'npm run typecheck'
   from apps/pulse-backend/; run 'npx convex dev' only against the existing
   intended development deployment after checking Clerk's convex template and
   CLERK_JWT_ISSUER_DOMAIN.
2. Run 'node --check' on the workspace JavaScript files.
3. Sign in, favorite a track, play a track, create a playlist, add the current
   track, refresh, then repeat on a second device.
4. Sign out and confirm cloud playlist/saved/recent panels clear. Test with a
   second account to verify isolation.
5. Confirm Spotify HTTP 403 does not stop YouTube/SoundCloud embeds or local
   audio.

A green source check is not proof of a live Convex deployment or cross-device
sign-in. Do not merge or claim the live cloud flow complete until those manual
checks pass.
