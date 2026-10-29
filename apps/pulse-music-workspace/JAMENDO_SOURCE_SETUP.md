# Jamendo source for Pulse

This source adds Jamendo track discovery, public playlist lookup, artist lookup, artwork, license links when returned, and playback through Pulse's existing shared audio player.

## Configure the API

1. Create or sign in to a Jamendo developer account at https://developer.jamendo.com/.
2. Register the Pulse application and obtain its API `client_id`.
3. Add `VITE_JAMENDO_CLIENT_ID` to the frontend build environment (for local development, add it to `.env.local` in this workspace; for the hosted frontend, add it as a Vercel project environment variable and redeploy).
4. Rebuild the frontend. This is a public API client ID, not a private server secret. Never put passwords, Convex deployment keys, or unrelated provider secrets in a `VITE_*` variable.

## What it provides

- Track search and featured track discovery, including artwork, artist/album metadata, duration, and license link when returned by the API.
- Search for public Jamendo playlists and load their track lists.
- Artist search, artist artwork/official website when available, and artist track lists.
- Plays returned HTTPS audio streams in the existing Pulse player controls.
- Responsive cards and a small source UI suited to phone screens.

Jamendo's API requires an approved/valid client ID and is subject to its API rules, rate limits, and licensing terms. Availability of stream URLs, playlist metadata, artist details, and license fields varies by record. Pulse must not imply that Jamendo music is universally available or unrestricted. Check the license and Jamendo's terms before downloading, redistributing, or monetizing music.

## Verification status

Automated regression tests cover source wiring and safety-oriented rendering checks. They do not verify live API responses, account approval, CORS behavior in the deployed site, or playback on a phone. Those require a valid Jamendo client ID and a real browser/device test.
