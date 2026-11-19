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
  assert.match(cloudSource, /library:addToPlaylist/);
  assert.match(cloudSource, /library:listPlaylistTracks/);
  assert.match(cloudSource, /library:removeFromPlaylist/);
  assert.match(cloudSource, /template: "convex"/);
  assert.match(configSource, /convexUrl: ""/);
  assert.match(configSource, /clerkPublishableKey: ""/);
  assert.doesNotMatch(configSource, /sk_test_|sk_live_|convex deploy key/i);
});

const archiveSource = fs.readFileSync(
  path.join(__dirname, "..", "internet-archive.js"),
  "utf8",
);
const archiveSandbox = {
  window: {},
  URLSearchParams,
  fetch: async () => {
    throw new Error("network disabled in unit test");
  },
};
vm.runInNewContext(archiveSource, archiveSandbox);

test("Internet Archive provider sanitizes query text and selects playable audio files", () => {
  const api = archiveSandbox.window.PulseArchive;
  assert.equal(api.safeQuery('A/B: "test"'), "A B test");
  assert.equal(
    api.pickAudioFile([
      { name: "cover.jpg" },
      { name: "item.xml" },
      { name: "recording.mp3" },
    ]).name,
    "recording.mp3",
  );
  assert.equal(api.pickAudioFile([{ name: "poster.png" }]), null);
  assert.equal(api.parseDuration("3:25"), 205);
  assert.equal(api.pickAudioFile([{ name: "tiny.mp3", size: 1200 }]), null);
  assert.equal(
    api.pickAudioFile([{ name: "full.mp3", size: 800000 }]).name,
    "full.mp3",
  );
});

test("Internet Archive search rejects too-short queries without making a request", async () => {
  await assert.rejects(
    () => archiveSandbox.window.PulseArchive.search("x", 8),
    /at least two characters/,
  );
});

test("Internet Archive UI is included without replacing existing providers or cloud sync", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  assert.match(html, /internet-archive\.js/);
  assert.match(html, /archiveSearchForm/);
  assert.match(html, /cloud-sync\.js/);
  assert.match(html, /playlist-store\.js/);
  assert.match(html, /musicCountry/);
  assert.match(html, /musicGenre/);
  assert.match(html, /savedPlaylists/);
  assert.match(html, /sourceFrame/);
});

test("Cloudflare catalogue adapters enforce clean iTunes previews and deduplicate normalized tracks", () => {
  const catalog = fs.readFileSync(
    path.join(__dirname, "..", "catalog-search.js"),
    "utf8",
  );
  const worker = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "cloudflare",
      "pulse-discovery-gateway",
      "src",
      "index.js",
    ),
    "utf8",
  );
  assert.match(catalog, /discoveryGatewayUrl/);
  assert.match(catalog, /verificationStatus/);
  assert.match(worker, /explicit:\s*"No"/);
  assert.match(worker, /dedupeTracks/);
  assert.match(worker, /PREVIEW_ONLY/);
  assert.match(worker, /VERIFYING/);
  assert.match(worker, /REVIEW_REQUIRED/);
});

test("local playlists deduplicate catalogue IDs and can save generated mixes", () => {
  const playlists = fs.readFileSync(
    path.join(__dirname, "..", "playlist-store.js"),
    "utf8",
  );
  assert.match(playlists, /String\(track\.catalogId \|\| ""\)/);
  assert.match(playlists, /createFromTracks/);
  assert.match(playlists, /catalogId,/);
});

test("home Archive discovery creates a multi-search local mix with rights links", () => {
  const discovery = fs.readFileSync(
    path.join(__dirname, "..", "home-archive-discovery.js"),
    "utf8",
  );
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  assert.match(discovery, /Promise\.allSettled/);
  assert.match(discovery, /upsertFromTracks/);
  assert.match(discovery, /check each item's rights/i);
  assert.match(html, /homeArchiveForm/);
  assert.match(html, /homeArchiveMix/);
  assert.match(html, /home-archive-discovery\.js/);
});

test("mobile home speed dial uses country-chart metadata and queue controls are reachable", () => {
  const home = fs.readFileSync(
    path.join(__dirname, "..", "home-refresh.js"),
    "utf8",
  );
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  assert.match(home, /speedList\.replaceChildren/);
  assert.match(home, /catalogId: exact\?\.trackId/);
  assert.match(app, /30-SEC PREVIEW/);
  assert.match(app, /source-label/);
  assert.match(app, /function renderQueuePanel/);
  assert.match(app, /queueClear/);
  assert.match(html, /id="queue"/);
  assert.match(html, /id="queuePanel"/);
});

test("saved playlist playback queues every playable song in saved order", () => {
  const playlists = fs.readFileSync(
    path.join(__dirname, "..", "playlist-store.js"),
    "utf8",
  );
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(playlists, /PulsePlaylistPlayback\?\.start/);
  const playback = fs.readFileSync(
    path.join(__dirname, "..", "playlist-playback.js"),
    "utf8",
  );
  assert.match(playback, /player\.playPlaylist/);
  assert.match(playlists, /Array\.isArray\(tracks\)/);
  assert.match(playlists, /\.filter\(\(track\) => track && track\.src\)/);
  assert.match(app, /playPlaylist: playPlaylistQueue/);
  assert.match(app, /tracks\.splice\(0, tracks\.length, \.\.\.queue\)/);
  assert.match(app, /audio\.onended/);
});

test("empty player and queue actions do not dereference a missing current track", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(app, /if \(!tracks\.length \|\| !tracks\[index\]\)/);
  assert.match(app, /if \(!tracks\.length\) \{/);
});

test("shared app integration persists stable queues and exposes reorder controls", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  const store = fs.readFileSync(
    path.join(__dirname, "..", "playlist-store.js"),
    "utf8",
  );
  const storage = fs.readFileSync(path.join(__dirname, "..", "queue-storage.js"), "utf8");
  assert.match(storage, /indexedDB\.open/);
  assert.match(app, /PulseQueueStorage/);
  assert.match(app, /function restoreQueue/);
  assert.match(app, /audio\.onended = \(\) => next\(\)/);
  assert.match(app, /PulsePlaylistPlayback\?\.nextIndex/);
  assert.match(app, /window\.PulsePlayerBridge =/);
  assert.match(app, /data-queue-move/);
  assert.match(store, /createOrUpdateFromTracks/);
  assert.match(store, /upsertFromTracks/);
  assert.match(store, /PulsePlaylistPlayback\?\.start/);
  assert.ok(html.indexOf("playlist-playback.js") < html.indexOf("app.js"));
  assert.match(html, /tempus-player\.js/);
});

test("Android home navigation styles all four destinations", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "home-refresh.css"),
    "utf8",
  );
  const home = fs.readFileSync(
    path.join(__dirname, "..", "home-refresh.js"),
    "utf8",
  );
  assert.match(home, /data-mobile-view="downloads"/);
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*1fr\)/);
});

test("recognition requires explicit consent and uses a secure endpoint", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "song-recognition.js"),
    "utf8",
  );
  assert.match(source, /window\.confirm/);
  assert.match(source, /if \(rawEndpoint\)/);
  assert.match(source, /if \(!raw\) return ""/);
  assert.match(source, /parsed\.protocol === "https:"/);
  assert.match(source, /stream\?\.getTracks\(\)\.forEach/);
  assert.doesNotMatch(source, /result\.innerHTML\s*=/);
});

test("Tempus player validates provider links and artwork before opening or rendering", () => {
  const player = fs.readFileSync(
    path.join(__dirname, "..", "tempus-player.js"),
    "utf8",
  );
  assert.match(player, /const safeExternalUrl/);
  assert.match(player, /const link = safeExternalUrl/);
  assert.match(player, /const artwork = safeExternalUrl/);
  assert.match(player, /window\.open\(url/);
});

test("Apple chart renderer only uses HTTPS artwork and provider links", () => {
  const charts = fs.readFileSync(
    path.join(__dirname, "..", "charts-dashboard.js"),
    "utf8",
  );
  assert.match(charts, /const safeHttpsUrl/);
  assert.match(charts, /safeHttpsUrl\(song\.artworkUrl100\)/);
  assert.match(charts, /safeHttpsUrl\(song\.url\)/);
});

test("Apple charts API rejects non-GET methods and invalid storefront codes", async () => {
  const handler = require(path.join(__dirname, "..", "api", "apple-charts.js"));
  const makeResponse = () => ({
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  });
  const methodResponse = makeResponse();
  await handler({ method: "POST", query: {} }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.Allow, "GET");

  const countryResponse = makeResponse();
  await handler({ method: "GET", query: { country: "usa" } }, countryResponse);
  assert.equal(countryResponse.statusCode, 400);
  assert.match(countryResponse.body.error, /two-letter/i);
});

test("mobile home navigation validates external provider links", () => {
  const home = fs.readFileSync(
    path.join(__dirname, "..", "home-refresh.js"),
    "utf8",
  );
  assert.match(home, /const safeExternalUrl/);
  assert.match(home, /safeExternalUrl\(trackButton\.dataset\.homeUrl\)/);
  assert.match(home, /const queryAll =/);
  assert.match(home, /safeExternalUrl\(item\.url\)/);
});

test("playback reporting is explicit and canplay does not overwrite active playback", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(app, /function reportPlayback\(state, message\)/);
  assert.match(app, /pulse:playback-report/);
  assert.match(app, /if \(!playing\) reportPlayback\("ready"/);
});
test("queue storage loads before player initialization", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf("queue-storage.js") >= 0);
  assert.ok(html.indexOf("queue-storage.js") < html.indexOf('src="app.js"'));
});

test("playlist start reports autoplay failure instead of claiming success", () => {
  const playbackSource = fs.readFileSync(path.join(__dirname, "..", "playlist-playback.js"), "utf8");
  assert.match(playbackSource, /then\(\(started\) => started === true, \(\) => false\)/);
  const store = fs.readFileSync(path.join(__dirname, "..", "playlist-store.js"), "utf8");
  assert.match(store, /started = await window\.PulsePlaylistPlayback/);
});

test("queue removal controls are available and wired to the player bridge", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(app, /data-queue-remove/);
  assert.match(app, /remove: \(queueIndex\)/);
  assert.match(app, /removeTrackAt/);
});
test("previous navigation uses explicit queue boundary helper", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(app, /previousIndex\?\.\(index, tracks\.length/);
});
