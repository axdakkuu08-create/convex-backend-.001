# Pulse Music Backend (Convex)

This is a **separate backend workspace** for the existing Pulse music frontend. It does not replace or modify `apps/pulse-music-workspace/`. The current frontend remains usable without this backend until a later integration change is reviewed.

## MVP included

- Convex schema for playlists, playlist tracks, and saved tracks.
- Authenticated, owner-scoped playlist creation, listing, renaming, and deletion.
- Authenticated saved-track add/list/remove operations.
- Authenticated playlist-track add/list/remove operations.
- Basic title and HTTP(S) URL validation.
- No music files are uploaded; records contain metadata and provider links only.

## Important current limitation

The functions require a valid Convex authentication identity. **An authentication provider is not configured by this scaffold yet**, so do not expect signed-out calls to work. The next milestone is to select and configure an auth provider, then connect the frontend. Never trust a user ID supplied by the browser; these functions use the verified identity returned by Convex.

## Android-friendly setup

A PC is not required to review or edit these files. Deployment does require a supported Node.js environment (for example, a cloud development environment) and a Convex account.

1. Open this folder in GitHub: `apps/pulse-backend/`.
2. In a cloud development environment, open a terminal and run:
   `cd apps/pulse-backend`
3. Install dependencies: `npm install`.
4. Sign in to Convex: `npx convex dev`. Follow the official prompts to create/select a development deployment.
5. Run type checks with `npm run typecheck`.
6. Do not copy deployment secrets into GitHub commits or public issues.

The generated `convex/_generated/` files are created by the Convex CLI; they are intentionally not hand-written in this scaffold.

## Frontend integration is a separate milestone

The existing frontend uses browser-local state and embeds official music providers. This MVP does not change its playback code or imply that Spotify/YouTube/SoundCloud playback restrictions can be bypassed. After authentication is configured, integrate Convex gradually: first saved playlists, then favourites and recent history. Keep local storage as a fallback until the cloud sync is tested.

## Safety and data model

- All read/write functions check the signed-in identity.
- Playlist and track mutations check ownership before accessing records.
- URLs must be HTTP(S); URLs are stored as metadata and are never fetched by the backend.
- The schema intentionally stores no passwords, provider access tokens, or audio binaries.
