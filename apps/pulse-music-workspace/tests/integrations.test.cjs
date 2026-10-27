const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");
const cloudSource = fs.readFileSync(path.join(root, "cloud-sync.js"), "utf8");
const archiveSource = fs.readFileSync(
  path.join(root, "archive-source.js"),
  "utf8",
);
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

test("Internet Archive adapter builds public search and resolves only supported audio files", async () => {
  const sandbox = { URL, URLSearchParams, window: {} };
  vm.runInNewContext(archiveSource, sandbox);
  const adapter = sandbox.window.PULSE_ARCHIVE;
  assert.ok(adapter, "Internet Archive adapter must be exposed");
  assert.equal(
    adapter.chooseAudioFile([
      { name: "cover.jpg", format: "JPEG" },
      { name: "book.pdf", format: "PDF" },
      { name: "recording.mp3", format: "VBR MP3" },
    ]).name,
    "recording.mp3",
  );
  assert.equal(
    adapter.chooseAudioFile([{ name: "scan.pdf", format: "PDF" }]),
    null,
  );

  const requests = [];
  const mockFetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("advancedsearch.php")) {
      return {
        ok: true,
        json: async () => ({
          response: {
            docs: [
              {
                identifier: "sample-recording",
                title: "Sample Recording",
                creator: "Archive Artist",
              },
            ],
          },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        metadata: {
          title: "Sample Recording",
          creator: "Archive Artist",
          licenseurl: "https://creativecommons.org/licenses/by/4.0/",
        },
        files: [
          { name: "cover.jpg", format: "JPEG" },
          { name: "recording.mp3", format: "VBR MP3", mimetype: "audio/mpeg" },
        ],
      }),
    };
  };
  const results = await adapter.search("sample recording", mockFetch);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Sample Recording");
  assert.equal(results[0].artist, "Archive Artist");
  assert.equal(
    results[0].src,
    "https://archive.org/download/sample-recording/recording.mp3",
  );
  assert.equal(
    results[0].sourceUrl,
    "https://archive.org/details/sample-recording",
  );
  assert.match(requests[0], /^https:\/\/archive\.org\/advancedsearch\.php\?/);
  assert.match(
    requests[1],
    /^https:\/\/archive\.org\/metadata\/sample-recording$/,
  );
});

test("Internet Archive integration preserves shared queue, source attribution and cloud event payload", () => {
  assert.match(indexSource, /id="archiveForm"/);
  assert.match(indexSource, /src="archive-source\.js"/);
  assert.match(appSource, /window\.PULSE_ARCHIVE\.search\(term\)/);
  assert.match(appSource, /source: "internet-archive"/);
  assert.match(appSource, /window\.PULSE_QUEUE\?\.add\(track\)/);
  assert.match(appSource, /track\?\.sourceUrl \|\| track\?\.src/);
  assert.match(
    appSource,
    /emitPulseLibraryEvent\("pulse:track-played", tracks\[index\]\)/,
  );
});
