# Pulse Stages 4–7 Execution Checkpoint

**Created:** 2026-11-19

**Repository:** axdakkuu08-create/convex-backend-.001

**Checkpoint branch:** checkpoint/pulse-stage4-7-2026-11-19

**Checkpoint base:** fix/pulse-b01-b17-core-storage at
86b73375ead726a23ceece227828b3c06235738e

**Upstream integration base:** integration/pulse-pr33-37-consolidated at PR #39
base SHA 45ac2164e4c4bb74cda47ffb0d25b9db3d40d9fa

**Governance:** isolated work only; do not merge, deploy, change provider
settings, or modify main.

## Baseline evidence

- PR #39 is open and Draft. Its head is fix/pulse-b01-b17-core-storage.
- PR #39 reports 46 Pulse workspace tests passing. The current GitHub Actions
  run records success for Pulse Workspace Tests, Prettier, Build Convex Backend,
  Pulse Cloudflare Discovery Gateway, CLA check, and Vercel status.
- PR #39 changes the shared web player, playlist playback/storage, and tests. It
  does not add Android Media3 service code, a PWA manifest/service worker, or
  offline audio downloads.
- PR #32 contains an earlier Capacitor/Media3 implementation on a branch based
  on main; it is not integrated into PR #39's current integration line. It must
  be audited and ported selectively, not merged wholesale.
- PR #32's own documentation states that native playback requires
  physical-device testing and that offline downloads are not implemented.
- Tempus reference analysis is static-only. It is a design/compatibility
  reference, not proof of Pulse runtime behavior.

## Execution register

Status vocabulary: NOT STARTED, IN PROGRESS, PASS, FAIL, BLOCKED, NOT TESTABLE
HERE. A CI build or static test is not a substitute for device/browser evidence.

### Stage 4 — Android playback (B13–B18)

| ID  | Required verification / work                                                                 | Acceptance evidence                       | Status            |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------- |
| B13 | Audit and integrate native Media3 playback service against the current Pulse player contract | reviewed source diff + Android build      | IN PROGRESS       |
| B14 | Verify background playback after app is backgrounded and screen is locked                    | physical Android test log/video           | NOT TESTABLE HERE |
| B15 | Verify notification / lock-screen play, pause, next, previous controls                       | physical Android test log/video           | NOT TESTABLE HERE |
| B16 | Verify audio focus, interruptions, headset/Bluetooth disconnect behavior                     | physical Android test log/video           | NOT TESTABLE HERE |
| B17 | Verify supported audio formats, stream errors, seek and queue transitions                    | automated tests + physical device results | IN PROGRESS       |
| B18 | Verify Android lifecycle recovery and web/native playback handoff without duplicate audio    | automated tests + physical device results | IN PROGRESS       |

### Stage 5 — Offline reliability (B19–B23)

| ID  | Required verification / work                                                     | Acceptance evidence                           | Status            |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------- | ----------------- |
| B19 | Add/verify PWA manifest, icons, installability metadata                          | manifest audit + browser installability check | IN PROGRESS       |
| B20 | Add/verify service worker lifecycle and versioned app-shell caching              | service-worker tests + browser evidence       | IN PROGRESS       |
| B21 | Define offline media storage and rights/attribution metadata policy              | design review + storage tests                 | IN PROGRESS       |
| B22 | Implement resilient offline queue/library restoration and cache failure handling | automated storage tests                       | IN PROGRESS       |
| B23 | Verify install, offline reopen, cached navigation and recovery after update      | browser + physical device evidence            | NOT TESTABLE HERE |

### Stage 6 — Architecture improvements (B24–B29)

| ID  | Required verification / work                                         | Acceptance evidence                    | Status      |
| --- | -------------------------------------------------------------------- | -------------------------------------- | ----------- |
| B24 | Document current web/native playback ownership and bridge contract   | architecture decision + contract tests | IN PROGRESS |
| B25 | Separate platform adapters without replacing working web playback    | focused diff + regression tests        | IN PROGRESS |
| B26 | Harden media lifecycle, error, permission and storage boundaries     | security review + tests                | IN PROGRESS |
| B27 | Preserve source attribution, rights status and provider restrictions | regression tests + data-flow review    | IN PROGRESS |
| B28 | Remove duplication only where tests prove behavior is preserved      | before/after test evidence             | IN PROGRESS |
| B29 | Verify migration/backward compatibility and document rollback        | migration tests + rollback notes       | IN PROGRESS |

### Stage 7 — Final acceptance

| Gate                    | Required evidence                                                                 | Status            |
| ----------------------- | --------------------------------------------------------------------------------- | ----------------- |
| Regression suite        | all relevant Pulse tests green on final branch head                               | IN PROGRESS       |
| Production build        | reproducible build succeeds; no production deployment implied                     | NOT STARTED       |
| Browser tests           | installability, responsive layout, playback, queue and offline flows              | NOT STARTED       |
| Android build           | debug APK artifact from the final branch                                          | IN PROGRESS       |
| Physical Android checks | background playback, controls, audio compatibility, interruptions, offline reopen | NOT TESTABLE HERE |
| Governance review       | main unchanged; no merge/deploy; all diffs and CI reviewed                        | IN PROGRESS       |

## Execution rules

1. Work only on this checkpoint branch or clearly linked isolated child
   branches.
2. Keep main untouched. Do not merge or deploy.
3. Inspect and selectively port prior PR #32 Android work; do not wholesale
   merge the old branch because it diverges from the current integration line.
4. Keep the existing vanilla web player and provider adapters working. Do not
   replace the frontend framework as part of this work.
5. Preserve Internet Archive rights-review metadata and iTunes preview-only
   labeling. Availability is not licensing clearance.
6. Keep credentials, signing keys and private tokens out of source and logs.
7. Every PASS must cite a reproducible test, workflow run, build artifact, or
   device observation. Mark unperformed hardware checks as NOT TESTABLE HERE,
   never PASS.
8. Update this register after each B-item and phase. A phase cannot pass while
   any required item is failed, blocked, or unverified.
9. Physical Android and real-browser acceptance require the user's
   device/browser; CI cannot attest to those observations.

## CI observations

- Pulse Workspace Tests run #109 passed on commit
  98ca01a4fdc510f8a2fac476784b99e6232cb1fe, and Android build run #190 produced
  a debug APK on that earlier Media3-only implementation commit.
- The current branch adds PWA/offline modules, rights-gated Cache Storage,
  Media3 handoff/error fixes, a locally bundled Capacitor runtime, Android
  manifest hardening, and additional regression tests after that APK.
- Workflow runs for Pulse Workspace Tests, Pulse Android build, Prettier, and
  the discovery gateway were created for this checkpoint line but remained
  queued in the latest observation. No completed regression or Android build for
  the current head is available. Both Pulse Workspace Tests and Pulse Android
  build include a manual dispatch trigger in the checkpoint workflow
  definitions.
- The Android manifest audit is now part of both Android build workflows. It
  checks cleartext denial, app backup disabled, internal component export
  restrictions, protected MediaSessionService export, required foreground
  permissions, and the system-only network trust configuration.
- The CLA check remains a human PR-description action. No legal attestation has
  been inserted on the user's behalf.
- Vercel's preview integration reported its daily deployment API limit. No
  production deployment was requested or performed.

## Current checkpoint decision

**Overall: IN PROGRESS — Stages 4–7 are not accepted.**

A prior Android build (#190) and Media3 integration checks passed on commit
98ca01a4fdc510f8a2fac476784b99e6232cb1fe. Subsequent changes to the local
Capacitor runtime bundle, native bridge, Android network policy, and manifest
audit require a fresh build, so B13 is IN PROGRESS on the current head. B17 and
B18 also have source-level changes and regression coverage for native playback
errors, strict HTTPS URL validation, safe seek positions, and a pause-before-web
handoff intended to prevent simultaneous native and web audio. No current-head
APK or physical-device result is yet available.

Stage 5 now has a PWA manifest with local SVG icons, a versioned service worker,
app-shell caching, byte-range support for explicitly cached audio, an Offline
Downloads view, and a Cache Storage manager. Offline saving is restricted to
Internet Archive items with a non-empty licence label, VERIFIED_FULL status, and
explicit APPROVED rights review. iTunes previews and unreviewed items are not
eligible. Automated tests cover policy, cache failure, quota, range responses,
and app-shell references, but no completed current-head test run or real browser
install/offline-reopen evidence is available.

Important storage boundary: browser Cache Storage is not an app-level encrypted
Android file vault. It does not complete the blueprint's encrypted/scoped
Capacitor Filesystem requirement. Media3 also does not read a native Filesystem
copy, so cached offline tracks do not have native background playback while
offline. A native encrypted-storage and Media3 local-URI adapter remains open.

Stage 6 now has documented playback ownership, shared media URL/source policy,
separate PWA/offline adapters, a locally bundled Capacitor runtime (no runtime
CDN dependency), Android cleartext denial, system-only trust anchors, disabled
app backup, a generated-manifest audit wired into both Android workflows,
attribution propagation, and additive migration/rollback documentation. The
network configuration does not itself prove a TLS 1.2 minimum; that remains a
separate verification gap. The tests and manifest audit have not yet completed
on the current branch head.

B23, browser installation, offline reopening, and B14–B18 physical-device checks
require browser/device evidence. The final regression suite, production build,
current-head APK, and final acceptance remain HOLD until their evidence is
available. PR #40 remains Draft; main is untouched; no merge or production
deployment has been performed.
