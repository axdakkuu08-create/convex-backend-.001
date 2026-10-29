# Easy Song Licensing integration plan

## Repository fit

Pulse is a static HTML/JavaScript music workspace in `apps/pulse-music-workspace/`
with optional Clerk + Convex cloud playlists in `apps/pulse-backend/convex/`.
Its discovery providers return catalogue metadata or playable audio; the README
explicitly distinguishes Easy Song Licensing from a catalogue or streaming
source. Keep licensing as a separate workflow and do not route licensed-song
requests through the playback player.

The uploaded C# sample is a legacy .NET Core 2.0 console example. It demonstrates
authenticated `GET /api/licensees`, `POST /api/licensees`, and
`PATCH /api/licensees/{id}` calls against a configured API URL. It does not
demonstrate song search, quote/pricing, licence purchase, order status, or
licence-document retrieval. Its sample configuration points at a staging
hostname using plain HTTP. Those details are not sufficient to implement a
production song-licensing flow.

## Integration boundary

1. Keep the current Pulse player, music embeds, catalogue search, local
   favourites, and cloud playlists unchanged.
2. Add a separate licensing UI only after the provider confirms the production
   base URL, authentication format, supported song/licence endpoints, request
   schemas, and account permissions.
3. Make provider requests from a server-side Convex action (or a dedicated
   trusted backend), never from browser JavaScript. Store the provider API key
   only in server-side environment configuration; do not put it in
   `config.js`, HTML, localStorage, a public ZIP, or Git.
4. Use HTTPS and a configured production endpoint. Do not make calls to the
   sample staging endpoint as part of app startup or automated checks.
5. Treat licensee CRUD as account/contact administration, not as proof that a
   song has been licensed. Do not claim a licence is valid until the provider
   returns a documented, verifiable result.
6. Keep UI states explicit: not configured, loading, provider error, and
   confirmed provider result. Never show a fake quote or successful purchase.

## Required provider details before implementation

- Production HTTPS API base URL and version.
- Authentication header/token format and credential provisioning procedure.
- Endpoints and schemas for song/work lookup, licence types, territory/use
  restrictions, quote/price, order or purchase, status, and licence receipt.
- Rate limits, error response format, idempotency requirements, and sandbox
  test credentials.
- Confirmation that this account is entitled to use the required endpoints.

## Safe verification plan

- Unit-test request construction and response validation with mocked responses.
- Verify missing configuration fails closed without network access.
- Verify credentials are never returned to browser clients or logged.
- Test provider errors, timeouts, invalid JSON, and rate limiting.
- Use only provider-approved sandbox credentials for any write/purchase flow.
- Run the repository's existing JavaScript syntax and integration checks to
  ensure the existing music providers remain unaffected.
- Manually verify the provider's licensing result before describing the feature
  as live.

## Current status

This branch records the architecture boundary and integration prerequisites.
No Easy Song Licensing API calls have been made, no licence has been ordered,
and no provider credentials are configured. Implementation of provider
requests is intentionally blocked until the production API contract and
authorized test access are confirmed.
