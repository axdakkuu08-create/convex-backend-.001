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
  assert.match(read("pwa-runtime.js"), /serviceWorker\s*\.register\("\.\/sw\.js"/);
  assert.match(read("pwa-runtime.js"), /updatefound/);
});

test("service worker app-shell precache list contains real workspace assets", () => {
  const worker = read("sw.js");
  const block = worker.match(/const SHELL_FILES = \[([\s\S]*?)\];/);
  assert.ok(block);
  const assets = [...block[1].matchAll(/"\.\/([^"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.length > 10);
  for (const asset of assets) {
    assert.ok(fs.existsSync(path.join(root, asset)), "missing precache asset: " + asset);
  }
  const html = read("index.html");
  const localAssets = [
    ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
    ...html.matchAll(/<link[^>]+(?:href)="([^"]+)"/g),
  ]
    .map((match) => match[1])
    .filter((value) => !/^(https?:|#|data:)/i.test(value));
  for (const asset of localAssets) {
    assert.ok(
      assets.includes(asset) || assets.includes(asset.replace(/^\.\//, "")),
      "local app-shell resource is not precached: " + asset,
    );
  }
});

test("service worker returns correct partial and suffix byte ranges", async () => {
  const handlers = {};
  const context = {
    self: {
      location: { origin: "https://pulse.example" },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    },
    caches: { open: () => Promise.resolve({ addAll: () => Promise.resolve() }), keys: () => Promise.resolve([]) },
    URL,
    Response,
    Promise,
    fetch,
  };
  vm.runInNewContext(read("sw.js"), context);
  const partial = await context.rangeResponse(
    new Response("abcdefgh", { headers: { "Content-Type": "audio/mpeg" } }),
    "bytes=2-4",
  );
  assert.equal(partial.status, 206);
  assert.equal(await partial.text(), "cde");
  assert.equal(partial.headers.get("content-range"), "bytes 2-4/8");
  const suffix = await context.rangeResponse(
    new Response("abcdefgh", { headers: { "Content-Type": "audio/mpeg" } }),
    "bytes=-3",
  );
  assert.equal(suffix.status, 206);
  assert.equal(await suffix.text(), "fgh");
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
