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

## Audio
The demo references sample MP3 URLs hosted by SoundHelix, so audio playback requires internet access and the external streams to be reachable. This is not a Spotify integration and does not include licensed music. Replace the src URLs in app.js with audio you have permission to use for production.

## Files
- index.html — layout and controls
- styles.css — theme and responsive styling
- app.js — playback, search, library state, and interactions
- manifest.webmanifest — install metadata
