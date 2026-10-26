const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");
const cloudSource = fs.readFileSync(path.join(root, "cloud-sync.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = appSource.indexOf("function resolveMusicEmbed(raw)");
const end = appSource.indexOf("function loadMusicEmbed(", start);
assert.ok(start >= 0 && end > start, "embed resolver function must exist");
const sandbox = { URL };
vm.runInNewContext(
  appSource.slice(start, end) +
    "\nthis.resolveMusicEmbed = resolveMusicEmbed;\nthis.embedLayoutClass = embedLayoutClass;",
  sandbox,
);
const resolveMusicEmbed = sandbox.resolveMusicEmbed;
const embedLayoutClass = sandbox.embedLayoutClass;

test("YouTube video and playlist links become privacy-enhanced embeds", () => {
  assert.equal(
    resolveMusicEmbed("https://youtu.be/abcdefghijk").url,
    "https://www.youtube-nocookie.com/embed/abcdefghijk",
  );
  assert.match(
    resolveMusicEmbed(
      "https://music.youtube.com/watch?v=abcdefghijk&list=PL12345",
    ).url,
    /youtube-nocookie\.com\/embed\/abcdefghijk\?list=PL12345/,
  );
  assert.match(
    resolveMusicEmbed("https://www.youtube.com/playlist?list=PL12345").url,
    /videoseries\?list=PL12345/,
  );
});

test("SoundCloud links become official widget embeds", () => {
  const result = resolveMusicEmbed("https://soundcloud.com/artist/track-name");
  assert.match(result.url, /^https:\/\/w\.soundcloud\.com\/player\/\?url=/);
  assert.equal(result.ratio, "soundcloud");
});

test("unsupported links fail with a helpful error and no Spotify dependency", () => {
  assert.throws(
    () => resolveMusicEmbed("https://example.com/song"),
    /Supported links/,
  );
  assert.throws(() => resolveMusicEmbed("not a URL"), /valid music link/);
  assert.throws(
    () => resolveMusicEmbed("javascript:alert(1)"),
    /Only http and https/,
  );
  assert.doesNotMatch(appSource, /open\.spotify\.com|Spotify/);
  assert.doesNotMatch(indexSource, /open\.spotify\.com|Spotify/);
});

test("Jamendo search uses a public client ID and shared audio queue", () => {
  assert.match(appSource, /api\.jamendo\.com\/v3\.0\/tracks\//);
  assert.match(appSource, /namesearch: term/);
  assert.match(appSource, /source: "jamendo"/);
  assert.match(appSource, /window\.PULSE_QUEUE\?\.add\(track\)/);
  assert.match(indexSource, /id="jamendoForm"/);
  assert.match(indexSource, /id="jamendoResults"/);
  assert.match(configSource, /jamendoClientId:\s*""/);
});

test("cloud playlists, favourites and history use owner-scoped Convex functions", () => {
  assert.match(
    cloudSource,
    /if \(!config\.convexUrl \|\| !config\.clerkPublishableKey\)/,
  );
  assert.match(cloudSource, /playlists:listMine/);
  assert.match(cloudSource, /playlists:create/);
  assert.match(cloudSource, /playlists:remove/);
  assert.match(cloudSource, /library:listSaved/);
  assert.match(cloudSource, /library:listRecent/);
  assert.match(cloudSource, /library:recordPlayed/);
  assert.match(cloudSource, /library:addToPlaylist/);
  assert.match(cloudSource, /template: "convex"/);
  assert.doesNotMatch(configSource, /sk_test_|sk_live_|convex deploy key/i);
});
