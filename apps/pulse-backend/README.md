# Pulse Music Backend (Convex)

This is a **separate backend workspace** for the existing Pulse music frontend. It does not replace or modify `apps/pulse-music-workspace/`. The frontend remains usable without this backend until a later integration change is reviewed.

## MVP included

- Convex schema for playlists, playlist tracks, and saved tracks.
- Authenticated, owner-scoped playlist create/list/rename/delete operations.
- Authenticated saved-track add/list/remove operations.
- Authenticated playlist-track add/list/remove operations.
- Basic title and HTTP(S) URL validation.
- Metadata and provider links only; no audio files or provider secrets are stored.

## Current limitation

Functions require a valid Convex authentication identity. **An authentication provider is not configured yet**, so signed-out calls will not work. Configure an auth provider before connecting the frontend. Never trust a user ID supplied by the browser; functions use the verified identity from Convex.

## Android-friendly setup

Review/edit on Android through GitHub. Deployment needs a supported Node.js environment (such as a cloud development environment) and a Convex account.

1. Open `apps/pulse-backend/` in a cloud development environment.
2. In its terminal, run `cd apps/pulse-backend`.
3. Run `npm install`.
4. Run `npx convex dev` and follow the official prompts to sign in and create/select a development deployment.
5. Run `npm run typecheck`.
6. Never commit deployment secrets, admin keys, or tokens.

The Convex CLI generates `convex/_generated/`; those generated files are not hand-written in this scaffold.

## Frontend integration is a separate milestone

The existing frontend still uses browser-local state and official music-provider embeds. This MVP does not change playback code or bypass Spotify, YouTube, or SoundCloud rules. After authentication is configured, integrate cloud playlists first, then favourites and recent history. Keep local storage as a fallback until sync is tested.

## Security model

- Every query/mutation checks the signed-in identity.
- Playlist and track operations check ownership.
- URLs are stored as metadata and never fetched by the backend.
- No passwords, provider access tokens, or audio binaries are stored.
