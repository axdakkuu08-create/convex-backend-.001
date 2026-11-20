# Pulse local-data migration and rollback

## Compatibility baseline

- Queue snapshots remain at schemaVersion 2. The new attribution properties
  (`sourceType`, `licenseLabel`, and `sourcePage`) are additive and optional.
- Existing queue snapshots without those properties continue to load. Missing
  attribution is normalized conservatively to `user_audio`, `REVIEW_REQUIRED`,
  and an empty licence label.
- The new offline index uses the independent key `pulse.offlineMedia.v1`; no
  existing queue or playlist key is rewritten.
- Existing local playlist records keep their current key and shape. New
  attribution fields are additive.
- Existing iTunes preview records remain preview-only and are not migrated into
  the offline-media cache.

## Rollback procedure

1. Stop publishing the new web shell and restore the previous application
   artifact from the isolated feature branch.
2. Revert the code commit(s) that introduced `media-policy.js`,
   `offline-media.js`, `pwa-runtime.js`, and `sw.js`.
3. If a deployed PWA shell needs cache cleanup, unregister the Pulse service
   worker and delete only caches whose names begin with `pulse-shell-` or the
   Pulse-owned `pulse-media-v1` cache. Do not clear unrelated origin caches.
4. The `pulse.offlineMedia.v1` metadata key is additive and can remain dormant
   during rollback. Do not delete the user's saved audio automatically.
5. Queue schemaVersion 2 and playlist records remain readable by the previous
   player. No destructive database migration is part of this change.

## Acceptance checks

- Old queue fixtures without attribution still normalize and restore.
- New queue fixtures preserve source type, licence label and source page.
- Failed offline metadata writes delete the just-cached media object.
- Removing an offline item deletes its Cache Storage object and index entry.
- Main remains unchanged; rollback is performed only on the isolated branch.
