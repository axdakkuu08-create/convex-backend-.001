# Pulse — UI, Full-Length Music, Background Playback & Android Update Plan

**Status:** Proposal / implementation specification  
**Target repository:** `axdakkuu08-create/convex-backend-.001`  
**Android test device:** iQOO Z10x  
**Current Android work:** PR #32 (`feature/pulse-android-capacitor`) remains a draft. Its debug APK build succeeded, but physical-device testing is pending.  
**Branch safety:** This document is being added on a separate documentation branch. It does not change `main`, production, or PR #32.

---

## 1. Product direction

Pulse should feel like a premium music player, not merely a music catalogue. The primary experience should focus on:

1. Finding music quickly.
2. Playing complete recordings when legitimately available.
3. Keeping music playing while the user uses other apps or locks the phone.
4. Managing a persistent queue.
5. Discovering more music across supported sources.

The home screen should prioritize listening and discovery. Albums should be moved toward the bottom because they are less important to the primary listening workflow.

## 2. Proposed home-screen UI

### Layout order

1. Greeting / compact app header.
2. Prominent search bar.
3. **Continue Listening** — recently played tracks and quick resume.
4. Recently played songs.
5. Discover music / regional charts.
6. Generated mixes based on mood, country and genre.
7. Saved playlists and quick filters.
8. Albums near the bottom, preferably in a smaller or collapsible section.

### Interaction principles

- Keep search easy to reach.
- Use compact song rows with artwork, title, artist, source and an obvious play action.
- Provide a visible **Load More** action for discovery results.
- Keep a mini-player visible while browsing.
- Avoid making album browsing dominate the home screen.
- Make loading, empty, unavailable and error states clear.
- Use pagination or incremental loading rather than loading huge catalogues at once.

## 3. Full-screen player

The full-screen player should include:

- Large album / track artwork.
- Track title and artist.
- Source/provider label.
- Clear track availability label: full track, preview, or unavailable.
- Elapsed time and remaining time.
- Seekable progress bar.
- Previous, play/pause and next controls.
- Queue access.
- Favourite / save action.
- Repeat and shuffle controls.
- Clear buffering and network-error states.

The UI must not imply that a track is full-length merely because metadata or a preview is available.

## 4. Queue and listening screen

The queue screen should include:

- Current track at the top.
- Upcoming tracks below it.
- Reorder by dragging.
- Remove individual queued tracks.
- Add more tracks from search or discovery.
- Clear indication of the active track.
- Persistent queue state when the app is reopened, where technically supported.

The queue panel should be accessible from both the mini-player and full-screen player.

## 5. Visual design and textures

### Suggested visual direction

Use a dark, premium, glass-inspired interface with colourful artwork and restrained motion.

| Design token | Suggested treatment | Purpose |
|---|---|---|
| Midnight | Deep navy / near-black background (`#10131D`) | Main app background |
| Neon violet | Violet highlight (`#875BFF`) | Primary accents and selected states |
| Aqua glass | Aqua / teal highlight (`#27CDB8`) | Player controls and secondary accents |
| Soft surfaces | Raised charcoal surfaces (`#393342`) | Cards, sheets and panels |
| Text | High-contrast white with muted secondary text | Readability |

### Texture and surface guidance

- Subtle gradients rather than loud multicolour backgrounds.
- Translucent glass-like panels where they improve hierarchy.
- Soft shadows and clear separation between surfaces.
- Rounded artwork and consistent corner radii.
- Smooth, short transitions.
- Restrained glow effects around important controls.
- Avoid excessive blur, heavy animation or large effects that could slow budget Android phones.
- Maintain readable contrast and accessible touch targets.

### Performance guidance

- Prefer CSS gradients and lightweight effects over large texture assets.
- Compress artwork and use appropriately sized thumbnails in lists.
- Lazy-load images below the fold.
- Respect reduced-motion preferences where possible.
- Test scrolling and player responsiveness on the target Android device.

## 6. Full-length songs and a growing catalogue

### Multi-source approach

Pulse should use multiple sources rather than depending on a single provider.

| Source type | Intended use | Important limitation |
|---|---|---|
| Internet Archive | Discover and play eligible full-length recordings | Availability does not itself prove that a recording is licensed for unrestricted use |
| Direct audio URLs | Play complete audio files where access and rights permit | URLs can expire, become unavailable or be blocked |
| Other authorized catalogues | Expand the available music catalogue | Provider terms and playback restrictions must be checked |
| iTunes Search | Metadata and artwork discovery | Preview clips must not be represented as full-length tracks |

### Track availability labels

Every result should communicate its actual playback status:

- **Full track** — a complete playable recording has been confirmed.
- **Preview** — only a short preview is available.
- **Unavailable** — no playable audio is currently available.

Do not infer full-length availability from a title, duration field, metadata record or artwork.

### Discovery scale and reliability

- Add pagination / **Load More**.
- Fetch results incrementally.
- Deduplicate tracks using stable catalogue identifiers where available.
- Preserve provider and source identifiers.
- Handle missing metadata and artwork gracefully.
- Distinguish metadata search from playable-audio resolution.
- Cache metadata and artwork carefully; do not assume cached audio remains available.
- Handle rate limits, provider errors, expired links and network interruptions.
- Do not download or redistribute recordings unless the relevant rights and provider terms permit it.

### Rights and source transparency

A result appearing in a catalogue does not automatically establish permission for unrestricted streaming or redistribution. Keep source attribution and relevant rights context visible in the player, especially for Internet Archive items. Do not remove or hide provider rights notices.

## 7. Reliable Android background playback

Background playback is a core requirement. A web player alone should not be assumed to provide reliable Android background playback.

The Android implementation should use an appropriate native media playback layer and support:

1. Android media session integration.
2. Foreground playback service with the required notification.
3. Persistent notification playback controls.
4. Lock-screen controls.
5. Audio focus handling when other apps request audio.
6. Correct pause/resume behaviour for calls and audio interruptions.
7. Queue persistence across navigation and app restarts, where supported.
8. Recovery from temporary network interruptions.
9. Correct handling of app lifecycle changes.
10. Clear user-visible playback errors when a source stops working.

The implementation should be tested on the actual Android device. Do not claim background playback is verified based only on a successful web build or APK build.

## 8. Updateable Android APK and Google Play package

The Android app should support future updates without requiring users to uninstall the previous version.

### Version and identity requirements

- Keep the same Android application ID / package name.
- Preserve the same release signing key for future updates.
- Increase `versionCode` for each release.
- Set an appropriate user-facing version name.
- Preserve app data during normal updates.
- Test installing a newer build over the existing app.

### Distribution outputs

- **Signed APK:** for direct distribution and installation.
- **Android App Bundle (AAB):** for Google Play distribution.

### Signing and release safety

- A debug APK is for testing; it is not a public release package.
- A release APK/AAB must be signed using a managed release key.
- Store signing credentials securely, for example in protected CI secrets.
- Never commit keystore files, passwords or signing credentials to the repository.
- Do not change the signing key between releases unless a supported key-rotation process is deliberately planned.
- Google Play publishing requires a properly configured Play Console account and completion of applicable Play requirements.

### Update delivery

A manually downloaded APK does not automatically update itself. Updates can be distributed through Google Play or through a deliberately implemented and securely managed update mechanism. The initial recommendation is to use Google Play for normal consumer updates and retain signed APKs for controlled testing.

## 9. Recommended implementation order

Work in small, reviewable steps. Keep the current production `main` branch unchanged while implementation and testing happen on isolated feature branches / PRs.

| Priority | Work item | Acceptance evidence |
|---:|---|---|
| 1 | Redesign home screen and move albums down | Mobile preview; home navigation and scrolling work |
| 2 | Improve search and incremental discovery | Search tests, pagination, deduplication and error states |
| 3 | Validate full-length playback by source | Test records proving complete playback, not just metadata or preview |
| 4 | Implement reliable Android background playback | Device tests with screen locked and another app in foreground |
| 5 | Redesign full-screen player and queue | Seek, next/previous, queue reorder and persistent controls tested |
| 6 | Prepare signed APK and AAB release pipeline | Release artifacts verified; signing secrets protected |
| 7 | Test update installation on iQOO Z10x | New version installs over prior version without losing app data |

### Recommended priority principle

Prioritize **full-length playback and reliable background playback** as core product capabilities. Build the visual polish around those working capabilities rather than finishing cosmetic work while playback remains incomplete.

## 10. Device test checklist

On the iQOO Z10x, test:

- [ ] APK installs successfully.
- [ ] App opens without crashing.
- [ ] Sign-in works, if enabled in the test build.
- [ ] Search returns results.
- [ ] Load More retrieves additional results.
- [ ] Full-track and preview labels are accurate.
- [ ] A confirmed full-length track plays to completion.
- [ ] Seeking works.
- [ ] Next / previous controls work.
- [ ] Queue add, remove and reorder work.
- [ ] Playback continues after locking the screen.
- [ ] Playback continues while another app is open.
- [ ] Notification controls work.
- [ ] Lock-screen controls work.
- [ ] Temporary network interruption is handled clearly.
- [ ] Closing and reopening the app restores the expected queue / playback state.
- [ ] A newer signed build installs over the previous build without data loss.

Only mark an item complete after it has actually been tested.

## 11. Current project safeguards and known status

- Existing Pulse production `main` must remain untouched unless the user explicitly approves a merge.
- PR #32 (`feature/pulse-android-capacitor`) is a draft and must remain a draft until the debug APK is tested on the user's phone and the user authorizes the next step.
- A debug APK build succeeded, but that does not prove physical-device installation, playback, background playback or update installation.
- The assistant cannot physically operate the user's phone; the user must perform the device checks and report the results.
- Do not claim that complete Internet Archive streaming, rights clearance, background playback or Play Store readiness is verified until there is evidence.

## 12. Immediate next step

First, collect the user's results from installing and testing the current debug APK. Then implement the home-screen redesign on an isolated branch, followed by source/playback validation and the native background playback work. Keep PR #32 in draft and keep `main` unchanged until the relevant checks pass and the user explicitly approves.

---

**Decision summary:** Move albums down; make search, discovery, Continue Listening and playlists prominent; clearly distinguish full tracks from previews; build reliable native Android background playback; and preserve the app identity and signing key so future APK/AAB releases can update the installed app.
