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

## Run
Open index.html in a browser or serve this folder from any static web server. No build step or package installation is required.

## Play your own audio
- Tap **＋ File** beside the track count to choose an audio file stored on your phone. The file plays for the current session; reselect it after refreshing.
- Tap **↗ Link** to paste a direct `https://` or `http://` audio-file URL.
- Spotify and YouTube webpage URLs are not direct audio streams and will not play in the browser audio element.
- The status message under the track list explains loading and playback failures.

The built-in demo uses sample MP3 URLs from SoundHelix and requires internet access. This is not a Spotify or Spotube integration and does not include licensed music. Spotube's Flutter audio-player and stream-resolution layers are separate; they cannot simply be copied into this browser app. A production version needs an authorized music provider/API and suitable handling for expiring streams and provider errors.

## Files
- index.html — layout and controls
- styles.css — theme and responsive styling
- app.js — playback, search, library state, and interactions
- manifest.webmanifest — install metadata
