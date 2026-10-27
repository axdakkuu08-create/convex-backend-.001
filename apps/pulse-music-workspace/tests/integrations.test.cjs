const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = path.join(__dirname, "..", "app.js");
const source = fs.readFileSync(appPath, "utf8");
const start = source.indexOf("function resolveMusicEmbed(raw)");
const end = source.indexOf("function loadMusicEmbed(", start);
assert.ok(start >= 0 && end > start, "embed resolver function must exist");
const sandbox = { URL };
vm.runInNewContext(
  source.slice(start, end) +
    "\nthis.resolveMusicEmbed = resolveMusicEmbed;\nthis.embedLayoutClass = embedLayoutClass;",
  sandbox,
);
const resolveMusicEmbed = sandbox.resolveMusicEmbed;
const embedLayoutClass = sandbox.embedLayoutClass;

test("Spotify track and localized links become official Spotify embeds", () => {
  const track = resolveMusicEmbed("https://open.spotify.com/track/abc123XYZ");
  assert.equal(
    track.url,
    "https://open.spotify.com/embed/track/abc123XYZ?utm_source=generator",
  );
  const localized = resolveMusicEmbed(
    "https://open.spotify.com/intl-en/album/abc123XYZ",
  );
  assert.match(localized.url, /open\.spotify\.com\/embed\/album\/abc123XYZ/);
});

test("tall Spotify embeds never produce an empty class token", () => {
  for (const kind of ["album", "playlist", "artist", "show"]) {
    const result = resolveMusicEmbed(
      "https://open.spotify.com/" + kind + "/abc123XYZ",
    );
    assert.equal(result.ratio, "tall");
    assert.equal(embedLayoutClass(result.ratio), "");
  }
  assert.equal(
    embedLayoutClass(
      resolveMusicEmbed("https://open.spotify.com/track/abc123XYZ").ratio,
    ),
    "compact",
  );
  assert.equal(
    embedLayoutClass(resolveMusicEmbed("https://youtu.be/abcdefghijk").ratio),
    "video",
  );
  assert.equal(
    embedLayoutClass(
      resolveMusicEmbed("https://soundcloud.com/artist/track-name").ratio,
    ),
    "soundcloud",
  );
});

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

test("unsupported domains and invalid links fail with a helpful error", () => {
  assert.throws(
    () => resolveMusicEmbed("https://example.com/song"),
    /Supported sources/,
  );
  assert.throws(() => resolveMusicEmbed("not a URL"), /valid music link/);
  assert.throws(
    () => resolveMusicEmbed("javascript:alert(1)"),
    /Only http and https/,
  );
});

const cloudSource = fs.readFileSync(
  path.join(__dirname, "..", "cloud-sync.js"),
  "utf8",
);
const configSource = fs.readFileSync(
  path.join(__dirname, "..", "config.js"),
  "utf8",
);

test("cloud playlists are opt-in and use owner-scoped backend functions", () => {
  assert.match(
    cloudSource,
    /if \(!config\.convexUrl \|\| !config\.clerkPublishableKey\)/,
  );
  assert.match(cloudSource, /playlists:listMine/);
  assert.match(cloudSource, /playlists:create/);
  assert.match(cloudSource, /playlists:remove/);
  assert.match(cloudSource, /template: "convex"/);
  assert.match(configSource, /convexUrl: ""/);
  assert.match(configSource, /clerkPublishableKey: ""/);
  assert.doesNotMatch(configSource, /sk_test_|sk_live_|convex deploy key/i);
});


const archiveSource = fs.readFileSync(
  path.join(__dirname, "..", "internet-archive.js"),
  "utf8",
);
const archiveSandbox = { window: {}, URLSearchParams, fetch: async () => { throw new Error("network disabled in unit test"); } };
vm.runInNewContext(archiveSource, archiveSandbox);
test("Internet Archive provider sanitizes query text and selects playable audio files", () => {
  const api = archiveSandbox.window.PulseArchive;
  assert.equal(api.safeQuery('A/B: "test"'), "A B test");
  assert.equal(api.pickAudioFile([
    { name: "cover.jpg" }, { name: "item.xml" }, { name: "recording.mp3" }
  ]).name, "recording.mp3");
  assert.equal(api.pickAudioFile([{ name: "poster.png" }]), null);
});
test("Internet Archive search rejects too-short queries without making a request", async () => {
  await assert.rejects(
    () => archiveSandbox.window.PulseArchive.search("x", 8),
    /at least two characters/
  );
});
test("Internet Archive UI is included without replacing existing providers or cloud sync", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /internet-archive\\.js/);
  assert.match(html, /archiveSearchForm/);
  assert.match(html, /cloud-sync\\.js/);
  assert.match(html, /sourceFrame/);
});
