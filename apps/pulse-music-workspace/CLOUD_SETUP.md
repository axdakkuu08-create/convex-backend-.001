# Pulse cloud playlists setup (Clerk + Convex)

This cloud integration supports sign-in, cloud playlist create/list/delete, and saved-track favourites through the existing Convex backend. Playback remains local/official-embed based, and the cloud client stays disabled until both public frontend settings are filled.

## 1. Create a Clerk development application

1. Open the [Clerk Dashboard](https://dashboard.clerk.com/) and create a
   development application.
2. In Clerk's integrations, activate the **Convex** integration.
3. Copy the Clerk **Frontend API URL** and **publishable key**. The URL is the
   issuer domain; the publishable key is safe for browser use. Never copy a
   Clerk secret key into this repository or frontend.
4. Enable the sign-in methods you want to support and allow your Pulse site's
   deployed origin in Clerk's allowed origins / redirect configuration if Clerk
   requests it.

Clerk's Convex integration provides the `convex` session-token template used by
the browser client.

## 2. Configure the Convex development deployment

1. Open the [Convex Dashboard](https://dashboard.convex.dev/) and create or
   select a **development** deployment for this repository's backend.
2. In that deployment's environment variables, set `CLERK_JWT_ISSUER_DOMAIN` to
   the exact Clerk Frontend API URL from step 1.
3. In a trusted Node.js environment, open `apps/pulse-backend/`, install
   dependencies with `npm install`, authenticate with `npx convex login`, then
   run `npx convex dev` to sync the backend and auth configuration.
4. Confirm the Convex dashboard's Authentication settings show the Clerk issuer
   and application ID `convex`. Do not proceed if they do not match the Clerk
   integration.

Keep development and production deployments separate. Configure a production
issuer only when the development flow is verified and you're intentionally
setting up production.

## 3. Configure the static frontend

Edit `apps/pulse-music-workspace/config.js`:

- `convexUrl`: the development deployment's public Convex URL, usually
  `https://<deployment-name>.convex.cloud`.
- `clerkPublishableKey`: the Clerk **publishable** key only.

Both values are public client configuration. Never put a Clerk secret key,
Convex deploy key, admin key, private key, or access token in `config.js`, HTML,
JavaScript, or GitHub Pages.

Deploy the frontend from `apps/pulse-music-workspace/` using your existing
static hosting workflow. If the site is served from GitHub Pages, confirm the
configured origin is allowed by Clerk.

## 4. Verify safely

- With blank values in `config.js`, the player must remain in local mode.
- With valid development settings, sign in and create a cloud playlist.
- Refresh the page and confirm the playlist remains.
- Like an online direct-audio track and confirm it appears under Cloud Favourites; unlike it and confirm it is removed.
- Sign out and confirm cloud playlists and favourites are no longer displayed.
- Use a second test account and verify it cannot see, rename, or delete the
  first account's playlists.
- Confirm local playback still works when cloud configuration is blank or
  network access is unavailable.

## Current scope and limitations

- Online direct-audio favourites sync to Convex when signed in. Device-local files and blob URLs remain local-only. Recently played history is not cloud-synced.
- Music playback still uses the current local audio player and official embeds.
  It does not upload or proxy audio files.
- The frontend loads pinned Convex and major-version Clerk browser modules from
  a public ESM CDN. A later production-hardening step should vendor/bundle these
  dependencies if the app adopts a build pipeline.
- GitHub checks only validate source syntax and repository checks; they do not
  prove a real Clerk login or Convex deployment works.
