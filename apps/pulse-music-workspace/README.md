# Pulse — Music Workspace

A responsive music-player prototype with a clean, dark dashboard aesthetic
inspired by modern developer tools such as Convex. This is an independent demo
and is not affiliated with Convex.

## Features

- Responsive desktop sidebar and mobile drawer
- Search tracks by title, artist, or mood
- Search Internet Archive audio metadata without a client ID and play supported
  direct audio files
- Mood cards, curated track list, and saved library
- Play/pause, previous/next, shuffle, repeat, volume, and seeking
- Like/save tracks and recently played history via localStorage
- Create, open, and delete device-local playlists with saved track lists
- Add demo, Jamendo, and Internet Archive tracks to playlists; play playlist
  tracks through the shared audio player
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

The **Connect a music source** panel supports these sources:

- **Internet Archive** public audio search and direct audio files discovered
  from each item's metadata. Search results link back to the original item; file
  formats and streaming/seek behavior vary.
- **YouTube / YouTube Music** videos and playlists using YouTube's
  privacy-enhanced embed host.
- **SoundCloud** tracks and playlists using the SoundCloud widget.

Create a playlist in the **Playlists** section, choose it in **Add songs to**,
then use **＋ Playlist** beside an Internet Archive result or the **＋** action
beside a track. Playlist records persist in this browser on this device; they
are not cloud-synced unless a separate cloud-playlist feature is configured.
Search for audio in the Internet Archive panel, or paste a public share URL into
**Music link** and tap **Load player**. These are official web embeds, not a
bypass of provider playback rules. Sign-in, availability, ads, regional
restrictions, and account limits remain controlled by each provider. Some
content cannot be embedded. Spotify embeds may preview rather than play full
tracks depending on provider policy and account status.

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

GitHub Actions runs a JavaScript syntax check, URL resolver tests, Internet
Archive adapter tests using mocked API responses, and an HTML interface smoke
test. Mocked tests validate parsing and integration contracts but do not prove
the live Internet Archive API or every item's playback will work.

## Files

- index.html — layout and controls
- styles.css — theme and responsive styling
- app.js — playback, search, local library state, and interactions
- archive-source.js — Internet Archive search, metadata lookup, and supported
  audio-file selection
- playlist-manager.js — device-local playlist creation, saved track lists, and
  playback integration
- config.js — public Convex URL and Clerk publishable-key placeholders
- cloud-sync.js — optional cloud playlist sign-in and CRUD
- manifest.webmanifest — install metadata

## Run checks locally

From the repository root, run `node --check apps/pulse-music-workspace/app.js`
and `node --test apps/pulse-music-workspace/tests/integrations.test.cjs`.

## Regional discovery and latest-release mixes

- Choose a country/region and a preferred genre in **Discover something new**.
- Worldwide discovery combines catalog results from the US, India, UK, Japan,
  and South Korea, then deduplicates tracks.
- Catalog results are ordered by release date when **Latest additions first** is
  enabled. The public iTunes Search API supplies short previews, not full
  tracks.
- If the catalog is unavailable or returns no matches, Pulse falls back to
  Internet Archive audio. Archive items are sorted by their added date; this is
  not a commercial new-release chart, and rights/streaming availability vary.
- Use **＋ Playlist** on a result or **Generate my mix** to save a discovery
  mix. Playlist persistence remains browser-local unless cloud library sync is
  set up.
