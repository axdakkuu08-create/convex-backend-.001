const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "media-policy.js"), "utf8");
const window = {};
vm.runInNewContext(source, { window, URL, Set, Boolean, String });
const policy = window.PulseMediaPolicy;

test("native transport accepts HTTPS only", () => {
  assert.equal(policy.isHttpsAudioUrl("https://audio.example/song.mp3"), true);
  assert.equal(policy.isHttpsAudioUrl("http://audio.example/song.mp3"), false);
  assert.equal(policy.isHttpsAudioUrl("javascript:alert(1)"), false);
  assert.equal(policy.isHttpsAudioUrl("https:///missing-host"), false);
});

test("offline approval requires a verified full Internet Archive track", () => {
  const base = {
    src: "https://archive.org/download/item/song.mp3",
    source: "Internet Archive",
    license: "https://creativecommons.org/licenses/by/4.0/",
    verificationStatus: "VERIFIED_FULL",
    rightsReviewStatus: "APPROVED",
  };
  assert.equal(policy.canDownloadOffline(base), true);
  assert.equal(policy.canDownloadOffline({ ...base, rightsReviewStatus: "REVIEW_REQUIRED" }), false);
  assert.equal(policy.canDownloadOffline({ ...base, verificationStatus: "VERIFYING" }), false);
  assert.equal(policy.canDownloadOffline({ ...base, license: "" }), false);
  assert.equal(policy.canDownloadOffline({ ...base, src: "http://archive.org/song.mp3" }), false);
});

test("iTunes previews and generic user URLs never qualify for offline saving", () => {
  const base = {
    src: "https://audio.example/preview.mp3",
    license: "preview only",
    verificationStatus: "VERIFIED_FULL",
    rightsReviewStatus: "APPROVED",
  };
  assert.equal(policy.canDownloadOffline({ ...base, sourceType: "itunes_preview" }), false);
  assert.equal(policy.canDownloadOffline({ ...base, sourceType: "user_audio" }), false);
});

test("attribution normalization preserves source, licence and review status", () => {
  const normalized = policy.normalizeAttribution({
    source: "Internet Archive",
    license: "CC BY 4.0",
    sourcePage: "https://archive.org/details/example",
    rightsReviewStatus: "APPROVED",
    verificationStatus: "VERIFIED_FULL",
  });
  assert.equal(normalized.sourceType, "internet_archive");
  assert.equal(normalized.licenseLabel, "CC BY 4.0");
  assert.equal(normalized.rightsReviewStatus, "APPROVED");
  assert.equal(normalized.sourcePage, "https://archive.org/details/example");
});
