# Unified Music Platform — M1 web preview

This is an isolated, local-first experience inside the existing Pulse repository. It does not replace or modify Pulse.

## M1 scope
- Responsive mobile-first application shell.
- Canonical track and media-source contracts.
- Local audio file import for preview; no upload or backend dependency.
- Shared in-page playback queue, search, sort, favorites, recently added, most played and album grouping.
- Strict library duration policy: tracks under 60,000 ms are excluded; exactly 60,000 ms and longer are eligible.
- Pagination and empty/loading/error states.

## Boundaries
- The web preview uses browser file selection and object URLs. It is not an Android MediaStore scanner and does not claim background playback.
- No audio is uploaded. Selected files remain in the current browser session.
- No Convex schema, auth, provider credentials, or deployment configuration is changed.
- External catalogue sources are not enabled until rights, terms, territory, playback and attribution are reviewed.
- Pulse and Sonora source repositories remain unchanged. Levyra is a feature reference only; no code, assets, APK, branding or protected expression is copied.

## Run
Open `index.html` in a modern browser or serve this directory with any static web server. The unit test is written for Node's built-in test runner:

```sh
node --test tests/track.test.mjs
```

## Next integration gates
1. Verify the existing Convex development deployment, Clerk issuer and account isolation before adding cloud sync.
2. Review Pulse playback and provider adapters individually before reusing them.
3. Implement native Android MediaStore scanning and Media3 playback in a separate native module, preserving the 60-second policy.
4. Keep preview deployment on the existing Vercel staging project only after a separate deployment approval.
