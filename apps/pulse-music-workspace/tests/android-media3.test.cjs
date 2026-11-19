const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("native media bridge is loaded before the Pulse player", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('src="media3-bridge.js"') >= 0);
  assert.ok(
    html.indexOf('src="media3-bridge.js"') < html.indexOf('src="app.js"'),
  );
});

test("native playback is restricted to all-HTTPS queues", () => {
  const app = read("app.js");
  assert.match(app, /function canUseNativeQueue\(\)/);
  assert.match(app, /tracks\.every\(\(track\) => \/\^https:/);
  assert.match(app, /if \(nativePlaybackActive\) \{[\s\S]*PulseMedia3\.play/);
  assert.match(app, /PulseMedia3\.next\(\)/);
  assert.match(app, /PulseMedia3\.previous\(\)/);
});

test("native plugin rejects non-HTTPS URLs and exposes transport controls", () => {
  const plugin = fs.readFileSync(
    path.join(
      root,
      "android-native/src/main/java/com/pulse/music/PulseMedia3Plugin.java",
    ),
    "utf8",
  );
  assert.match(plugin, /url\.startsWith\("https:\/\/"/);
  assert.doesNotMatch(plugin, /url\.startsWith\("http:\/\/"\)/);
  assert.match(plugin, /public void next\(PluginCall call\)/);
  assert.match(plugin, /public void previous\(PluginCall call\)/);
  assert.match(plugin, /public void setShuffle\(PluginCall call\)/);
  assert.match(plugin, /public void setRepeat\(PluginCall call\)/);
  assert.match(plugin, /setShuffleModeEnabled/);
  assert.match(plugin, /setRepeatMode/);
  assert.match(plugin, /setMediaItems\(\s*items,\s*startIndex/);
});

test("full-screen player routes native seeking and progress through Media3", () => {
  const player = read("tempus-player.js");
  assert.match(player, /nativeStateForCurrentTrack/);
  assert.match(player, /PulseMedia3\.seekTo/);
  assert.match(player, /addStateListener/);
  assert.match(player, /tempusPlayerElapsed/);
});

test("native service enables audio focus and headset-disconnect handling", () => {
  const service = fs.readFileSync(
    path.join(
      root,
      "android-native/src/main/java/com/pulse/music/PulseAudioService.java",
    ),
    "utf8",
  );
  assert.match(service, /setAudioAttributes\(attributes, true\)/);
  assert.match(service, /setHandleAudioBecomingNoisy\(true\)/);
  assert.match(service, /extends MediaSessionService/);
});

test("native installer applies secure transport and media foreground permissions", () => {
  const installer = read("scripts/install-native-android.mjs");
  assert.match(installer, /usesCleartextTraffic="false"/);
  assert.match(installer, /FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
  assert.match(installer, /WAKE_LOCK/);
  assert.match(installer, /PulseAudioService/);
});
