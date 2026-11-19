const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("playback ownership and platform boundaries are documented", () => {
  const doc = read("PLAYBACK_ARCHITECTURE.md");
  for (const term of ["PulsePlaylistPlayback", "PulseQueueStorage", "PulseMediaPolicy", "PulseOfflineMedia", "PulseMedia3", "sw.js"]) {
    assert.ok(doc.includes(term), "missing architecture owner: " + term);
  }
});

test("native bridge has no runtime CDN import", () => {
  const bridge = read("media3-bridge.js");
  assert.doesNotMatch(bridge, /https:\/\/esm\.sh/);
  assert.match(bridge, /\.\/capacitor-core\/index\.js/);
  const prepare = read("scripts/prepare-web.mjs");
  assert.match(prepare, /@capacitor/);
  assert.match(prepare, /capacitor-core/);
  assert.match(read("scripts/install-native-android.mjs"), /bundledCapacitorCore/);
});

test("Android installer attaches strict network policy", () => {
  const installer = read("scripts/install-native-android.mjs");
  const policy = read("android-native/src/main/res/xml/network_security_config.xml");
  assert.match(installer, /networkSecurityConfig/);
  assert.match(installer, /usesCleartextTraffic="false"/);
  assert.match(installer, /allowBackup="false"/);
  assert.match(policy, /cleartextTrafficPermitted="false"/);
  assert.match(policy, /certificates src="system"/);
  assert.match(read("scripts/audit-android-manifest.py"), /MEDIA_CONTENT_CONTROL/);
  assert.match(read("scripts/audit-android-manifest.py"), /usesCleartextTraffic/);
});

test("offline download metadata never includes credentials or provider session fields", () => {
  const offline = read("offline-media.js");
  assert.doesNotMatch(offline, /password|accessToken|refreshToken|authorization/i);
  assert.match(offline, /credentials: "omit"/);
  assert.match(offline, /rightsReviewStatus/);
  assert.match(offline, /licenseLabel/);
});
