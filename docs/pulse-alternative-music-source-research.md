# Pulse alternative music source investigation

## Context

Jamendo integration remains in the app, but the configured Jamendo application
was suspended (API response code 11). Do not ship or depend on the
temporary/test Client ID. A missing, rejected, or suspended Jamendo ID must
produce a clear provider-specific status and must not break the shared player,
queue, other sources, or Convex library.

Keep all three alternatives below in scope: Audius, Internet Archive, and
YouTube. This branch is research only until adapters and live playback checks
are implemented. Do not merge automatically.

## Candidate 1: Audius — first API integration to prototype

- Official API docs: https://docs.audius.co/api/
- REST API base: https://api.audius.co/v1
- Developer getting started: https://docs.audius.co/developers/rest-api
- API plans / key registration: https://api.audius.co/plans
- Capabilities documented by Audius include track search, track streaming,
  artists/users, playlists, trending, and resolving Audius URLs.
- Most read-only endpoints work without credentials; an API key may be needed
  for higher rate limits. Mutations require credentials. Confirm current
  endpoint requirements and terms before release.
- Prototype search and streaming using the official API/SDK. Do not assume all
  tracks have the same playback availability or rights; preserve source links
  and attribution.

## Candidate 2: Internet Archive — public search and metadata API

- Advanced Search API: https://archive.org/advancedsearch.php
- Search API documentation: https://archive.org/help/aboutsearch.htm
- Item metadata API: https://archive.org/metadata/{identifier}
- Metadata read documentation: https://archive.org/developers/md-read.html
- Basic public search and metadata reads do not require a Jamendo-style client
  ID. Metadata identifies available files; discover the exact filename and
  format rather than guessing a direct audio URL.
- Item files may be audio, video, text, or other formats. Filter carefully for
  supported audio files and confirm browser CORS, byte-range seeking, mobile
  playback, and service policies before release.
- Do not label all items public domain or freely reusable. Display item/source
  links and rights metadata where available, and skip items with unclear rights
  or unsupported formats.

## Candidate 3: YouTube — embedded playback, not extracted audio

- YouTube Data API getting started:
  https://developers.google.com/youtube/v3/getting-started
- Search endpoint documentation:
  https://developers.google.com/youtube/v3/docs/search/list
- Official embedded player API:
  https://developers.google.com/youtube/iframe_api_reference
- Search through the Data API requires a Google Cloud project, enabling the
  YouTube Data API v3, and an API key (or supported OAuth flow for methods that
  need user authorization). The documented default quota includes 100 search
  calls per day; check the current console quota and policies before launch.
- Playback must use the official embedded player. Do not extract audio streams,
  download content, bypass ads, or circumvent YouTube restrictions. YouTube
  video playback is not identical to a direct-audio track, so queue controls
  must handle embed-specific limitations.

## Credential status

No private API keys have been obtained or created by this investigation.

- Audius: try the documented read-only API first; create a key only if required
  by the selected endpoints or rate limits. Use the official portal above.
- Internet Archive: public search/metadata endpoints can be prototyped without
  a key. Account credentials are not needed for basic public metadata reads.
- YouTube: the user (or an authorized account holder) must create/select a
  Google Cloud project, enable YouTube Data API v3, and create an API key.
  Restrict the key to the intended APIs and web origins where practical. Never
  commit private credentials. Browser-visible API keys are not secret; use
  server-side mediation if a secret or stronger abuse controls are needed.

## Proposed implementation plan

1. Keep this work on `pulse-alternative-source-research`, based on
   `feature/pulse-dev-clerk-convex-config`; do not modify the merged Jamendo
   work or merge this branch automatically.
2. Implement Audius search/playback first, then Internet Archive search and
   eligible direct-audio playback, then YouTube search with official embedded
   playback. Keep each provider isolated behind the existing source interface.
3. Reuse the existing shared queue/player and Convex library where the provider
   playback model supports them. Do not create a second queue or change cloud
   schemas without review.
4. Keep Jamendo available when a valid ID is supplied; if not configured or
   rejected, show an actionable error and leave other providers working.
5. Add deterministic tests for response parsing, missing fields, unsupported
   files, duplicate URLs, provider errors, and embed-specific limitations.
6. Verify real API responses and playback separately. CI alone cannot establish
   live playback, mobile behavior, rights compliance, or end-to-end cloud sync.
7. Keep the PR draft until adapters and tests are implemented and the user
   approves the scope. Do not merge without user approval.

## Current status

- Official API/documentation links and credential requirements researched for
  all three candidates.
- No user-specific API keys were created or obtained.
- No live provider search/playback test, mobile-device test, rights audit, or
  cloud-sync end-to-end test is claimed yet.
