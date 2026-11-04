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
  assert.match(discovery, /createFromTracks/);
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


const playlistPlaybackSource = fs.readFileSync(
  path.join(__dirname, "..", "playlist-playback.js"),
  "utf8",
);
const playlistPlaybackEvents = [];
class PlaylistPlaybackCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
}
const playlistPlaybackSandbox = {
  window: {
    dispatchEvent(event) {
      playlistPlaybackEvents.push(event);
    },
  },
  CustomEvent: PlaylistPlaybackCustomEvent,
};
vm.runInNewContext(playlistPlaybackSource, playlistPlaybackSandbox);

test("playlist queue rejects empty and non-playable playlists", () => {
  const playback = playlistPlaybackSandbox.window.PulsePlaylistPlayback;
  assert.equal(playback.start({ name: "Empty", tracks: [] }), false);
  assert.equal(
    playback.start({
      name: "Unsupported",
      tracks: [{ title: "Page link", src: "javascript:alert(1)" }],
    }),
    false,
  );
  assert.equal(playlistPlaybackEvents.length, 0);
  assert.equal(playback.nextIndex(0, 0), null);
});

test("one-track playlist starts once and stops at the end unless repeat is enabled", () => {
  const playback = playlistPlaybackSandbox.window.PulsePlaylistPlayback;
  assert.equal(
    playback.start({
      name: "Single",
      tracks: [{ title: "Only track", src: "https://audio.example/one.mp3" }],
    }),
    true,
  );
  const event = playlistPlaybackEvents.at(-1);
  assert.equal(event.type, "pulse:play-playlist");
  assert.equal(event.detail.tracks.length, 1);
  assert.equal(playback.nextIndex(0, 1), null);
  assert.equal(playback.nextIndex(0, 1, { repeat: true }), 0);
});

test("multi-track playlist preserves saved order and advances to the next track", () => {
  const playback = playlistPlaybackSandbox.window.PulsePlaylistPlayback;
  assert.equal(
    playback.start({
      name: "Ordered",
      tracks: [
        { title: "First", src: "https://audio.example/1.mp3" },
        { title: "Second", src: "https://audio.example/2.mp3" },
        { title: "Third", src: "https://audio.example/3.mp3" },
      ],
    }),
    true,
  );
  const queue = playlistPlaybackEvents.at(-1).detail.tracks;
  assert.deepEqual(
    Array.from(queue, (track) => track.title),
    ["First", "Second", "Third"],
  );
  assert.equal(playback.nextIndex(0, 3), 1);
  assert.equal(playback.nextIndex(1, 3), 2);
  assert.equal(playback.nextIndex(2, 3), null);
  assert.match(newApp, /audio\.onended = .*next\(\)/);
});

test("playlist play action starts the full saved queue rather than prompting for a track", () => {
  assert.match(newStore, /PulsePlaylistPlayback\?\.start\?\.\(playlist\)/);
  assert.doesNotMatch(newStore, /Choose a song number to play/);
});
