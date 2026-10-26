# Jamendo setup for Pulse

Pulse uses Jamendo's public catalogue API for independent-music search and
streams returned audio in the shared Pulse player. Jamendo is not a complete
replacement for every major-label catalogue; availability and playback rights
vary by track.

## Enable search

1. Open the [Jamendo developer portal](https://devportal.jamendo.com/) and
   create/register an API application.
2. Copy the application's **client ID**. This is a public API identifier, not a
   secret token.
3. In `apps/pulse-music-workspace/config.js`, set:

   ```js
   jamendoClientId: "YOUR_PUBLIC_JAMENDO_CLIENT_ID",
   ```

4. Reload Pulse and search for an artist, title, or mood in **Search Jamendo
   tracks**.

Do not put a private client secret, access token, Convex deploy key, or Clerk
secret in browser configuration.

## Playback and cloud library

Jamendo results use the same HTML audio element and queue as Pulse's built-in
tracks and direct audio links, so Pulse can control play/pause, previous/next,
progress, and volume for those streams. YouTube and SoundCloud embeds remain
provider-controlled where their APIs do not expose shared playback controls.

Favourites and listening history use the existing Convex library mutations.
Cloud sync requires the existing Clerk/Convex setup and a backend deployment
containing `library:listRecent`. The development backend sync workflow runs
after backend changes merge to `feature/pulse-dev-clerk-convex-config`; verify
its run succeeds before assuming the live preview is synced.

Follow the [Jamendo API documentation](https://developer.jamendo.com/v3.0/docs)
and the applicable track licence. Pulse does not bypass provider restrictions
or add a download flow.
