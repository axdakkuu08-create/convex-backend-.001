const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("PWA, media and player scripts parse as JavaScript", () => {
  for (const file of [
    "sw.js",
    "pwa-runtime.js",
    "offline-media.js",
    "media-policy.js",
    "internet-archive.js",
    "catalog-search.js",
    "app.js",
  ]) {
    assert.doesNotThrow(() => new vm.Script(read(file)), file);
  }
});

test("PWA manifest has standalone scope, start URL and declared icons", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./index.html");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("PWA registration is isolated from player startup and has an update signal", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('src="pwa-runtime.js"') > html.indexOf('src="app.js"'));
  assert.match(read("pwa-runtime.js"), /serviceWorker\.register\("\.\/sw\.js"/);
  assert.match(read("pwa-runtime.js"), /updatefound/);
});

test("service worker versions the app shell and preserves the separate media cache", () => {
  const worker = read("sw.js");
  assert.match(worker, /pulse-shell-v1/);
  assert.match(worker, /pulse-media-v1/);
  assert.match(worker, /cache\.addAll\(SHELL_FILES\)/);
  assert.match(worker, /self\.clients\.claim/);
  assert.match(worker, /rangeResponse/);
  assert.match(worker, /status: 206/);
  assert.match(worker, /request\.mode === "navigate"/);
});

test("offline media and attribution adapters are loaded before the app", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('src="media-policy.js"') < html.indexOf('src="app.js"'));
  assert.ok(html.indexOf('src="offline-media.js"') < html.indexOf('src="app.js"'));
  assert.match(read("app.js"), /view === "downloads"/);
  assert.match(read("app.js"), /licenseLabel/);
});
