# Pulse frontend → Convex integration plan

## Current state

The music workspace at `apps/pulse-music-workspace/` is a plain
HTML/CSS/JavaScript app. Its saved tracks and recently played list are stored in
browser `localStorage`; its playlist button currently creates a session-only
label. The Convex workspace at `apps/pulse-backend/` has authenticated,
owner-scoped functions, but it is not deployed or connected to the frontend yet.

**Do not enable cloud calls until authentication and a development deployment
are configured.** A green GitHub Actions run validates repository code; it does
not prove a live Convex deployment or a working sign-in flow.

## Required decisions / inputs

1. Select an OIDC provider supported by Convex and create its application.
2. Configure `PULSE_AUTH_DOMAIN` and `PULSE_AUTH_APPLICATION_ID` on a Convex
   **development** deployment, using the provider's exact issuer and
   application/audience values.
3. Choose the browser sign-in implementation for that provider. It must return a
   short-lived, verified OIDC access/ID token whose issuer and audience match
   `convex/auth.config.ts`. Never put a client secret or private key in browser
   code.
4. Provide the development deployment URL as `VITE_CONVEX_URL` (or the
   equivalent build-time config) without committing secrets.

## Backend API contract

Use the generated Convex API references; do not hard-code function paths or send
a client-supplied owner ID.

- Saved tracks: `library.listSaved`, `library.saveTrack`, `library.unsaveTrack`.
- Playlists: `playlists.listMine`, `playlists.create`, `playlists.rename`,
  `playlists.remove`.
- Playlist tracks: `library.listPlaylistTracks`, `library.addToPlaylist`,
  `library.removeFromPlaylist`.

The backend derives ownership from the verified identity. On sign-out, clear
account-specific UI state and stop showing cloud results. If a request fails
because the user is signed out or the service is unavailable, keep the existing
local-only player usable and explain that cloud sync is unavailable.

## Safe implementation order

1. Add the selected provider's sign-in flow and configure Convex's client
   authentication callback.
2. Test signed-out behavior, sign-in, token refresh, and sign-out before
   displaying any cloud data.
3. Connect playlist create/list/rename/delete first; verify each mutation
   appears after a reload.
4. Connect saved tracks, preserving existing local favourites and asking before
   any destructive migration.
5. Keep local storage as a fallback; do not silently delete local data if cloud
   sync fails.
6. Test cross-account isolation with two test accounts. Account B must never see
   or mutate Account A's playlists or saved tracks.
7. Run the frontend syntax/integration tests and backend typecheck/codegen
   checks, review the PR, then deploy only after all checks pass.

## Acceptance checklist

- [ ] OIDC issuer and application/audience values verified against the
      provider's official settings.
- [ ] Development Convex deployment configured; no deployment secrets committed.
- [ ] Sign-in, token refresh, and sign-out verified.
- [ ] Cloud playlists survive reload and remain owner-scoped.
- [ ] Cloud saved tracks survive reload and remain owner-scoped.
- [ ] Local-only playback still works when offline or signed out.
- [ ] Cross-account isolation tested.
- [ ] GitHub Actions passes; live deployment status is reported separately from
      CI status.
- [ ] Android browser smoke test completed.

Until the first three setup items are supplied and tested, the repository should
describe cloud sync as **prepared / not yet connected**, not as a live feature.
