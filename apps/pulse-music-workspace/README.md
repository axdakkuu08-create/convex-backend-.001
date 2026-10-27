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

## Cloud playlist integration (optional)

The frontend now contains an **opt-in** Clerk + Convex cloud-playlist client. It
remains disabled until both public values in `config.js` are filled in. Without
those values, the existing local player continues to work and no cloud requests
are made.

Follow [the cloud setup guide](CLOUD_SETUP.md) before enabling it. The guide
covers the Clerk Convex integration, the Convex development deployment, and
account-isolation checks. Cloud playlists are a first milestone; local
favourites and recently played history still use `localStorage` and are not
synced yet. A passing GitHub workflow does not prove that a real deployment or
sign-in works.

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

## Internet Archive audio search

The optional Internet Archive provider searches the public Advanced Search API
for audio items, then checks each item's metadata for a direct playable audio
file. It does not require an API key and is separate from the Easy Song
Licensing API. Easy Song is a licensing workflow, not a song catalogue or
streaming source.

Search results link back to the Internet Archive item page. Rights/licence
metadata can be missing or vary by file, so users should inspect the item's page
and stated terms before reuse. Search/playback success depends on the Archive
being reachable and the item retaining a compatible audio file. This provider is
not a guarantee that every commercial song is available.

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
- app.js — playback, search, local library state, and interactions
- internet-archive.js — public audio search and playable-file resolution
- config.js — public Convex URL and Clerk publishable-key placeholders
- cloud-sync.js — optional cloud playlist sign-in and CRUD
- manifest.webmanifest — install metadata

## Run checks locally

From the repository root, run `node --check apps/pulse-music-workspace/app.js`
and `node --test apps/pulse-music-workspace/tests/integrations.test.cjs`.
