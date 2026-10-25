# Pulse Music Backend (Convex)

This is a **separate backend workspace** for the existing Pulse music frontend.
It does not replace or modify `apps/pulse-music-workspace/`. The frontend
remains usable without this backend until a later integration change is
reviewed.

## MVP included

- Convex schema for playlists, playlist tracks, and saved tracks.
- Authenticated, owner-scoped playlist create/list/rename/delete operations.
- Authenticated saved-track add/list/remove operations.
- Authenticated playlist-track add/list/remove operations.
- Validation for track titles, artist metadata, provider URLs, and artwork URLs.
- Indexed duplicate lookups for saved tracks and playlist tracks.
- Metadata and provider links only; no audio files or provider secrets are
  stored.

## Authentication status

The backend now includes `convex/auth.config.ts` for an OIDC-compatible
provider, using deployment environment variables `CLERK_JWT_ISSUER_DOMAIN` and
`the fixed application ID `convex``. **These values must be configured and verified on
the Convex development deployment before syncing or deploying the auth
configuration.** The provider account and frontend sign-in flow are not
configured by this repository change.

See [docs/authentication.md](docs/authentication.md). Never trust a user ID
supplied by the browser; functions use Convex's verified `tokenIdentifier`. The
issuer and application ID must match the chosen provider's official instructions
and token claims.

## Android-friendly setup

Review and edit through GitHub on Android. Validation runs through GitHub
Actions. To sync authentication or deploy, a trusted Node.js environment and
Convex account are required.

1. Choose an OIDC-compatible identity provider and follow its official Convex
   setup guide.
2. Configure `CLERK_JWT_ISSUER_DOMAIN` and `the fixed application ID `convex`` on the Convex
   **development** deployment.
3. Open `apps/pulse-backend/` in a trusted Node.js cloud development
   environment.
4. Run `npm install`, then `npx convex dev` and follow the official prompts.
5. Run `npm run typecheck`.
6. Never commit deployment secrets, admin keys, tokens, or private signing keys.

The Convex CLI generates `convex/_generated/`; those generated files are not
hand-written in this scaffold.

## Frontend integration is a separate milestone

The existing frontend still uses browser-local state and official music-provider
embeds. This backend work does not change playback code or bypass Spotify,
YouTube, or SoundCloud rules. After authentication is configured and tested,
integrate cloud playlists first, then favourites and recent history. Keep local
storage as a fallback until sync is tested.

## Security model

- Every private query/mutation checks the signed-in identity.
- Ownership is derived from the verified identity; client-supplied owner IDs are
  not accepted.
- Playlist and track operations check ownership before reading or changing
  records.
- Provider URLs and artwork URLs are validated as HTTP(S); provider hosts must
  match the selected source.
- URLs are stored as metadata and are never fetched by the backend.
- No passwords, provider access tokens, or audio binaries are stored.

## Validation and deployment status

GitHub Actions runs Convex code generation and TypeScript checks. A passing
workflow is not proof of a live deployment or real login/playback. This change
does not deploy anything, connect the frontend, or merge a pull request.
