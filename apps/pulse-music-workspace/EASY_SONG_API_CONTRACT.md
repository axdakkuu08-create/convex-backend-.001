# Easy Song API contract notes (official documentation review)

Reviewed the official Easy Song developer documentation on 2026-10-29.

## Confirmed by the provider's public documentation

- Production API origin: `https://api.easysong.com`.
- API uses JSON over HTTPS and a bearer API key in the Authorization header.
- The API is for cover-song rights clearance (compulsory mechanical licensing),
  not a general streaming catalogue.
- Main resources include Licensees, Albums, Releases, Tracks, Songs, Requests,
  and WallPosts.
- A new clearance request is created with `POST /api/requests`, containing the
  required Licensee, Album, Release, Track, and Song data.
- Existing request status can be read with `GET /api/requests/{id}`; related
  status endpoints include album/track request lookups.
- The provider asks integrators to incorporate its current Terms of Use and says
  partners should confirm their organization has partnered with Easy Song and
  obtain an API key before testing.

## Pulse implementation boundary

The current Pulse frontend is a static browser app. Provider credentials must
therefore remain in server-side configuration and never enter `config.js`,
localStorage, browser JavaScript, or client-visible action results.

The first implementation slice should be read-only and fail closed:

- require an authenticated Pulse user;
- require a server-only `EASYSONG_API_KEY` environment variable;
- call only the documented HTTPS origin;
- validate request IDs and response shape;
- return only the minimum status fields needed by the UI;
- avoid logging credentials or full licensee/contact payloads;
- show a clear unconfigured/error state when the key is absent or the provider
  fails.

Creating a license request is a consequential external action. Do not enable it
until the account is authorized, the provider contract and terms are reviewed,
the required form fields and release formats are validated, and the user sees a
review/confirmation step before the request is submitted. Do not represent a
submitted request as a granted license: request statuses distinguish
researching, payment needed, in progress, licensed, and unable-to-license
states.

## Still required from the account owner/provider

- Confirm Pulse's organization is an authorized Easy Song partner.
- Configure a valid API key in the Convex deployment's server-side environment;
  do not commit it.
- Confirm the applicable current Terms of Use and licensing scope.
- Use the provider's authenticated test interface or approved test credentials
  to validate real responses before enabling live writes.

## Sources

- Getting started:
  https://developer.easysong.com/documentation/001-getting-started-with-easy-song-licensing-api-1.aspx
- Basic integration and production HTTPS/auth example:
  https://developer.easysong.com/documentation/002-easy-song-licensing-api-basic-integration.aspx
- Posting a license request:
  https://developer.easysong.com/documentation/004-posting-a-license-request-with-the-easy-song-licensing-api.aspx
- Checking request status:
  https://developer.easysong.com/documentation/006-checking-request-statuses-with-the-easy-song-licensing-api.aspx
- Request statuses:
  https://developer.easysong.com/documentation/012-easy-song-licensing-api-request-statuses.aspx
- API reference: https://developer.easysong.com/reference/default.aspx
