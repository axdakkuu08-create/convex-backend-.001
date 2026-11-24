import test from "node:test";
import assert from "node:assert/strict";
import { createTrack, isEligibleDuration, MIN_TRACK_DURATION_MS } from "../core/track.js";

test("duration policy excludes tracks strictly below 60 seconds", () => {
  assert.equal(MIN_TRACK_DURATION_MS, 60_000);
  assert.equal(isEligibleDuration(59_999), false);
  assert.equal(isEligibleDuration(60_000), true);
  assert.equal(isEligibleDuration(60_001), true);
  assert.equal(isEligibleDuration(undefined), false);
});

test("canonical track model rejects ineligible durations", () => {
  assert.equal(createTrack({ id:"short", title:"Short", durationMs:59_999 }), null);
  const track = createTrack({ id:"long", title:"Long", durationMs:60_000, provider:"local" });
  assert.equal(track.id, "long");
  assert.equal(track.durationMs, 60_000);
  assert.equal(track.sources[0].provider, "local");
  assert.equal(Object.isFrozen(track), true);
});

test("canonical track model requires a stable identity", () => {
  assert.throws(() => createTrack({ title:"No identity", durationMs:60_000 }), /stable track identity/);
});
