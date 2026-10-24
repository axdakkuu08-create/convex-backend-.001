# Pulse — Music Workspace

A responsive music-player prototype with a clean, dark dashboard aesthetic
inspired by modern developer tools such as Convex. This is an independent demo
and is not affiliated with Convex.

## Features

- Responsive desktop sidebar and mobile drawer
- Search tracks by title, artist, or mood
- Mood cards, curated track list, and saved library
- Play/pause, previous/next, shuffle, repeat, volume, and seeking
- Like/save tracks and recently played history via localStorage
- Create a simple local playlist label
- Keyboard shortcut / to focus search; Space toggles playback
- PWA install metadata

## Cloud library status

Cloud playlists and saved-track sync are **not connected yet**. The current
player remains local-first: favourites and recently played history use
`localStorage`, and playlist labels are session-only. The Convex backend is a
separate workspace and requires a configured OIDC provider and development
deployment before it can safely be connected.

See [the integration contract and acceptance checklist](../../docs/pulse-convex-frontend-integration.md).
Do not treat passing CI as proof of a live deployment or sign-in. The planned
integration must preserve local playback and local data as a fallback.

## Run

Open index.html in a browser or serve this folder from any static web server. No
build step or package installation is required.

## Music integrations

The **Connect a music source** panel supports official embedded players for:

- **Spotify** tracks, albums, playlists, artists, shows, and episodes using
  Spotify Embed.
- **YouTube / YouTube Music** videos and playlists using YouTube's
  privacy-enhanced embed host.
- **SoundCloud** tracks and playlists using the SoundCloud widget.

Paste a public share URL into **Music link** and tap **Load player**. These are
official web embeds, not a bypass of provider playback rules. Sign-in,
availability, ads, regional restrictions, and account limits remain controlled
by each provider. Some content cannot be embedded. Spotify embeds may preview
rather than play full tracks depending on provider policy and account status.

## Play your own audio

- Tap **＋ File** beside the track count to choose an audio file stored on your
  phone. The file plays for the current session; reselect it after refreshing.
- Tap **↗ Link** to paste a direct `https://` or `http://` audio-file URL.
  Spotify and YouTube webpage URLs are not direct audio streams.
- Read the status message below the track list for playback errors.

The built-in demo uses sample MP3 URLs from SoundHelix and requires internet
access. No Spotify credentials or secret API keys are stored in the browser. A
full Spotify Web Playback SDK integration would require Spotify developer
configuration, OAuth, and plan/eligibility checks; this prototype deliberately
uses official embeds instead.

## Checks

GitHub Actions runs a JavaScript syntax check, URL resolver tests for the three
music providers, and an HTML interface smoke test.

## Files

- index.html — layout and controls
- styles.css — theme and responsive styling
- app.js — playback, search, library state, and interactions
- manifest.webmanifest — install metadata

## Run checks locally

From the repository root, run `node --check apps/pulse-music-workspace/app.js`
and `node --test apps/pulse-music-workspace/tests/integrations.test.cjs`.
