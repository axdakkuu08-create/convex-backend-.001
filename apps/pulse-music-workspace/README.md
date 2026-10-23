# Pulse — Music Workspace

A responsive music-player prototype with a clean, dark dashboard aesthetic inspired by modern developer tools such as Convex. This is an independent demo and is not affiliated with Convex.

## Features
- Responsive desktop sidebar and mobile drawer
- Search tracks by title, artist, or mood
- Mood cards, curated track list, and saved library
- Play/pause, previous/next, shuffle, repeat, volume, and seeking
- Like/save tracks and recently played history via localStorage
- Create a simple local playlist label
- Keyboard shortcut / to focus search; Space toggles playback
- PWA install metadata
- Initial Convex backend source for user-owned playlists, playlist tracks, and saved tracks

## Run the frontend
Open index.html in a browser or serve this folder from any static web server. The frontend still works as a standalone prototype and currently uses localStorage for its library; Convex is not yet connected to the UI.

## Music integrations
The **Connect a music source** panel supports official embedded players for:
- **Spotify** tracks, albums, playlists, artists, shows, and episodes using Spotify Embed.
- **YouTube / YouTube Music** videos and playlists using YouTube's privacy-enhanced embed host.
- **SoundCloud** tracks and playlists using the SoundCloud widget.

Paste a public share URL into **Music link** and tap **Load player**. These are official web embeds, not a bypass of provider playback rules. Sign-in, availability, ads, regional restrictions, and account limits remain controlled by each provider. Some content cannot be embedded. Spotify embeds may preview rather than play full tracks depending on provider policy and account status.

## Play your own audio
- Tap **＋ File** beside the track count to choose an audio file stored on your phone. The file plays for the current session; reselect it after refreshing.
- Tap **↗ Link** to paste a direct HTTPS or HTTP audio-file URL. Spotify and YouTube webpage URLs are not direct audio streams.
- Read the status message below the track list for playback errors.

The built-in demo uses sample MP3 URLs from SoundHelix and requires internet access. No Spotify credentials or secret API keys are stored in the browser. A full Spotify Web Playback SDK integration would require Spotify developer configuration, OAuth, and plan/eligibility checks; this prototype deliberately uses official embeds instead.

## Convex backend MVP (source added, deployment not yet configured)
The `convex/` directory contains:
- `schema.ts` — playlists, playlist tracks, and saved tracks with indexes
- `playlists.ts` — list, create, rename, and delete playlists
- `playlistTracks.ts` — list, add, and remove playlist tracks
- `savedTracks.ts` — list, save, and remove saved tracks

Ownership is derived from the authenticated Convex identity; client-provided owner IDs are not accepted. Mutations check record ownership and validate track titles and HTTP(S) URLs. The backend stores track metadata and links; it does **not** host or stream music files.

Before deployment, initialize Convex in this workspace, install the Convex npm package, generate `convex/_generated/`, configure an auth provider, and deploy to a development deployment. Do not put deployment keys in source control. Then connect the frontend with `ConvexProvider` and authenticated queries/mutations. The current browser UI remains unchanged until that integration is implemented.

## Checks
GitHub Actions checks JavaScript syntax, provider URL resolver tests, backend source safety smoke tests, and required HTML interface elements. The backend smoke tests are static checks, not a substitute for Convex typechecking or a live deployment test.

## Files
- index.html — layout and controls
- styles.css — theme and responsive styling
- app.js — playback, search, library state, and interactions
- manifest.webmanifest — install metadata
- convex/ — initial backend schema and functions

## Run checks locally
From the repository root, run `node --check apps/pulse-music-workspace/app.js` and `node --test apps/pulse-music-workspace/tests/*.test.cjs`.


## Backend development setup

From the repository root, enter `apps/pulse-music-workspace` and run:

```sh
npm install
npm run convex:dev
```

Complete the Convex CLI sign-in and create/select a **development** deployment when prompted. This step requires an authorized browser session and cannot be completed by CI without a configured deployment. Keep generated `convex/_generated/` files local/ignored for now; the CI job regenerates them from the schema and checks TypeScript.

The package includes `npm run typecheck` (Convex code generation followed by TypeScript checking) and `npm test`. GitHub Actions runs both checks on workspace changes.

Before deploying for real users:
1. Configure a supported authentication provider in the Convex dashboard and add its issuer/domain configuration in `convex/auth.config.ts`.
2. Verify the provider's identity subject is stable and unique per user.
3. Test ownership boundaries against a development deployment.
4. Only then connect the frontend and deploy the production backend.

Do not create fake owner IDs or expose server/deployment keys in the browser. Until authentication is configured, backend queries and mutations intentionally reject unauthenticated requests.
