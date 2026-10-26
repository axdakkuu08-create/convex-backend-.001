# Pulse alternative music source investigation

## Context
Jamendo integration remains in the app, but the configured Jamendo application was suspended (API response code 11). Do not ship or depend on the temporary/test Client ID. A missing, rejected, or suspended Jamendo ID must produce a clear provider-specific status and must not break the shared player, queue, other sources, or Convex library.

## Candidate: Internet Archive audio metadata/search API
- Search endpoint: `https://archive.org/advancedsearch.php`
- Item metadata endpoint: `https://archive.org/metadata/{identifier}`
- Potential direct audio URLs use the item download path, but the actual file name and format must be discovered from item metadata rather than guessed.
- The API is documented publicly and does not require a Jamendo-style client ID for basic metadata search.
- Reference: https://doc-tools.readthedocs.io/en/ia-test-gsod/item-search-apis.html
- Reference: https://archivesupport.zendesk.com/hc/en-us/articles/360001495812-Developer-Resources

### Important caveats
Internet Archive is a candidate to prototype, not yet a verified drop-in replacement. Catalog entries have different rights and upload quality; the app must show item/license/source information and must not label every result as public domain or freely reusable. Prefer items with clear rights metadata, retain a link to the archive item, and skip entries with unclear/unsupported audio files. Confirm browser CORS, byte-range seeking, mobile playback, metadata quality, and the archive's current API policies before calling this production-ready.

## Proposed implementation plan
1. Keep this work on `pulse-alternative-source-research`, based on `feature/pulse-dev-clerk-convex-config`; do not modify the merged Jamendo work or merge this branch automatically.
2. Prototype a separate Internet Archive search adapter that returns the existing normalized track shape (title, creator/artist, duration if present, artwork if available, source, playable URL, item URL, and rights/license metadata).
3. Reuse the existing shared audio player and queue. Do not create a second queue or change Convex favourite/playlist/recent-history schemas unless necessary and reviewed.
4. Keep Jamendo available when a valid ID is supplied; if not configured or rejected, show an actionable error and leave all other providers working.
5. Add deterministic tests for response parsing, missing fields, unusable files, duplicate URLs, and API failures. Verify real API responses and actual playback separately; CI alone cannot establish playback or licensing correctness.
6. Open a draft PR for review only after the adapter and tests are implemented. Do not merge without user approval.

## Status
- Research started; Internet Archive is the first candidate because its documented search and metadata APIs are public.
- No live Internet Archive search/playback test, mobile-device test, licensing audit, or cloud-sync end-to-end test is claimed yet.
