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
| B17 | Verify supported audio formats, stream errors, seek and queue transitions                    | automated tests + physical device results | NOT STARTED       |
| B18 | Verify Android lifecycle recovery and web/native playback handoff without duplicate audio    | automated tests + physical device results | NOT STARTED       |

### Stage 5 — Offline reliability (B19–B23)

| ID  | Required verification / work                                                     | Acceptance evidence                           | Status            |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------- | ----------------- |
| B19 | Add/verify PWA manifest, icons, installability metadata                          | manifest audit + browser installability check | NOT STARTED       |
| B20 | Add/verify service worker lifecycle and versioned app-shell caching              | service-worker tests + browser evidence       | NOT STARTED       |
| B21 | Define offline media storage and rights/attribution metadata policy              | design review + storage tests                 | NOT STARTED       |
| B22 | Implement resilient offline queue/library restoration and cache failure handling | automated storage tests                       | NOT STARTED       |
| B23 | Verify install, offline reopen, cached navigation and recovery after update      | browser + physical device evidence            | NOT TESTABLE HERE |

### Stage 6 — Architecture improvements (B24–B29)

| ID  | Required verification / work                                         | Acceptance evidence                    | Status      |
| --- | -------------------------------------------------------------------- | -------------------------------------- | ----------- |
| B24 | Document current web/native playback ownership and bridge contract   | architecture decision + contract tests | NOT STARTED |
| B25 | Separate platform adapters without replacing working web playback    | focused diff + regression tests        | NOT STARTED |
| B26 | Harden media lifecycle, error, permission and storage boundaries     | security review + tests                | NOT STARTED |
| B27 | Preserve source attribution, rights status and provider restrictions | regression tests + data-flow review    | NOT STARTED |
| B28 | Remove duplication only where tests prove behavior is preserved      | before/after test evidence             | NOT STARTED |
| B29 | Verify migration/backward compatibility and document rollback        | migration tests + rollback notes       | NOT STARTED |

### Stage 7 — Final acceptance

| Gate                    | Required evidence                                                                 | Status            |
| ----------------------- | --------------------------------------------------------------------------------- | ----------------- |
| Regression suite        | all relevant Pulse tests green on final branch head                               | NOT STARTED       |
| Production build        | reproducible build succeeds; no production deployment implied                     | NOT STARTED       |
| Browser tests           | installability, responsive layout, playback, queue and offline flows              | NOT STARTED       |
| Android build           | debug APK artifact from the final branch                                          | NOT STARTED       |
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

- Pulse Workspace Tests run #80 passed on the initial checkpoint commit
  5b31a8badf0bb7a0de8ac74e8ce0f3e8a1081fd3. Later shuffle/repeat changes and the
  final queue predicate correction were made after that run; they still need a
  fresh run.
- Android build run #161 failed during the Android SDK setup step, before Node
  validation, Capacitor generation, Gradle compilation, or APK creation. The
  setup action requested the obsolete SDK package named "tools". Both Android
  workflow definitions have since been changed to request platform-tools and
  explicitly install Android 36 / Build Tools 36. A rerun against the latest
  branch head has not been observed.
- Prettier run #418 reported eight files needing dprint formatting. Formatting
  updates have been applied to those files; a fresh formatting result has not
  been observed.
- CLA check run #457 failed because PR #40 does not contain the repository's
  required contribution declaration. No legal attestation has been inserted
  on the user's behalf. PR description confirmation remains a human action.
- Vercel status was pending on the latest observed PR head. No production
  deployment was requested or performed.

## Current checkpoint decision

**Overall: IN PROGRESS — Stage 4 is not accepted.**

B13 source integration has begun on this checkpoint branch: the PR #32 Media3
service/plugin and Capacitor build foundation were selectively ported; native
mode is restricted to all-HTTPS queues so mixed local-file queues stay on the
existing web player. The installer now disables cleartext traffic and adds media
foreground-service, wake-lock and notification permissions. A dedicated Android
build workflow and bridge contract tests have been added. These changes remain
unverified until fresh CI completes. B14–B18 require real Android hardware
verification. Stage 5 and Stage 6 must follow in order; Stage 7 remains blocked
until all evidence is collected.
