const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "jamendo.js"), "utf8");
const bridge = fs.readFileSync(path.join(root, "jamendo-bridge.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Jamendo API uses a public frontend client ID and official API endpoint", () => {
  assert.match(source, /VITE_JAMENDO_CLIENT_ID/);
  assert.match(source, /https:\/\/api\.jamendo\.com\/v3\.0/);
  assert.match(source, /developer\.jamendo\.com/);
});

test("Jamendo source supports track, playlist, and artist discovery", () => {
  assert.match(source, /data-jamendo-tab="tracks"/);
  assert.match(source, /data-jamendo-tab="playlists"/);
  assert.match(source, /data-jamendo-tab="artists"/);
  assert.match(source, /playlists\/tracks/);
  assert.match(source, /artists\/tracks/);
});

test("Jamendo streams connect to the existing Pulse player bridge", () => {
  assert.match(source, /pulsePlayExternalTrack/);
  assert.match(bridge, /setTrack\(targetIndex, true\)/);
  assert.match(bridge, /tracks\.push/);
  assert.match(html, /jamendo-bridge\.js/);
  assert.match(html, /src="\/src\/jamendo\.js"/);
});

test("Jamendo UI escapes returned metadata and links only HTTPS artwork and streams", () => {
  assert.match(source, /function escapeHTML/);
  assert.ok(source.includes("!/^https:"));
  assert.ok(source.includes("function artwork"));
});
