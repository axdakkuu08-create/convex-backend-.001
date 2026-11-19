const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const audit = path.join(root, "scripts", "audit-android-manifest.py");

function runAudit(manifest) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-android-audit-"));
  const manifestPath = path.join(directory, "AndroidManifest.xml");
  const networkPath = path.join(directory, "network_security_config.xml");
  fs.writeFileSync(manifestPath, manifest);
  fs.writeFileSync(
    networkPath,
    '<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system" /></trust-anchors></base-config></network-security-config>',
  );
  const result = spawnSync("python3", [audit, manifestPath, networkPath], {
    encoding: "utf8",
  });
  fs.rmSync(directory, { recursive: true, force: true });
  return result;
}

const validManifest = (provider = "") => `<?xml version="1.0"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <application android:usesCleartextTraffic="false" android:allowBackup="false" android:networkSecurityConfig="@xml/network_security_config">
    ${provider}
    <service android:name="com.pulse.music.PulseAudioService" android:exported="true" android:permission="android.permission.MEDIA_CONTENT_CONTROL" />
    <service android:name="com.pulse.music.InternalService" android:exported="false" />
    <receiver android:name="com.pulse.music.InternalReceiver" android:exported="false" />
  </application>
</manifest>`;

test("Android manifest audit accepts the intended protected MediaSessionService", () => {
  const result = runAudit(validManifest());
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS:/);
});

test("Android manifest audit rejects exported content providers", () => {
  const result = runAudit(
    validManifest('<provider android:name="com.pulse.music.LeakyProvider" android:exported="true" />'),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Exported ContentProvider/);
});

test("Android manifest audit rejects cleartext traffic and missing app hardening", () => {
  const result = runAudit(
    validManifest().replace('android:usesCleartextTraffic="false"', 'android:usesCleartextTraffic="true"'),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /usesCleartextTraffic/);
});
