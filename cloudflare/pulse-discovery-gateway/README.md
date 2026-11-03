# Pulse Cloudflare Discovery Gateway

Read-only Worker for Internet Archive and Apple/iTunes search. It does not own
accounts, playlists, favourites, queue state, playback state, or audio files;
those remain in Pulse and Convex.

## API

- GET /health
- GET
  /api/search?q=ambient&country=IN&genre=Ambient&limit=18&provider=all|archive|itunes

Results normalize to Pulse track fields including id, title, artist, album,
genre, country, duration, streamUrl, previewUrl, license, explicit,
verificationStatus and bytesTotal.

## Verification and rights

- iTunes preview URL: PREVIEW_ONLY; no preview: UNAVAILABLE.
- Internet Archive candidate file URL: VERIFYING, never VERIFIED_FULL based on
  URL presence.
- VERIFIED_FULL is reserved for a later actual player verification step.
- Archive rightsReviewStatus remains REVIEW_REQUIRED even if a rights/license
  string is supplied. The statement is evidence to inspect, not a legal
  conclusion.

KV caches normalized search payloads for five minutes. Cache failures are
fail-open. Run tests with npm test and deploy with npx wrangler deploy after
Cloudflare authentication.
