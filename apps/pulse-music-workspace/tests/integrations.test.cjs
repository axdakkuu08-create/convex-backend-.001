const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const configSource = fs.readFileSync(path.join(root, "config.js"), "utf8");
const cloudSource = fs.readFileSync(path.join(root, "cloud-sync.js"), "utf8");
const playlistSource = fs.readFileSync(
  path.join(root, "playlist-manager.js"),
  "utf8",
);
const catalogSource = fs.readFileSync(
  path.join(root, "itunes-source.js"),
  "utf8",
);
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
  assert.equal(
    adapter.chooseAudioFile([
      { name: "preview.mp3", format: "VBR MP3", duration: "30" },
    ]),
    null,
    "preview-only Archive items must not be returned as full tracks",
  );
  assert.equal(
    adapter.chooseAudioFile([
      { name: "short-sample.mp3", format: "VBR MP3", duration: "22" },
      { name: "full-recording.mp3", format: "VBR MP3", duration: "245" },
    ]).name,
    "full-recording.mp3",
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
          {
            name: "recording.mp3",
            format: "VBR MP3",
            mimetype: "audio/mpeg",
            duration: "245.8",
          },
        ],
      }),
    };
  };
  const results = await adapter.search("sample recording", mockFetch);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Sample Recording");
  assert.equal(results[0].artist, "Archive Artist");
  assert.equal(results[0].time, "4:05");
  assert.equal(results[0].source, "internet-archive");
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
  assert.match(appSource, /searchArchiveForDiscovery\(term\)/);
  assert.match(appSource, /source: "internet-archive"/);
  assert.match(appSource, /window\.PULSE_QUEUE\?\.add\(track\)/);
  assert.match(appSource, /track\?\.sourceUrl \|\| track\?\.src/);
  assert.match(
    appSource,
    /emitPulseLibraryEvent\("pulse:track-played", tracks\[index\]\)/,
  );
});

test("playlist library supports local persistence, add/remove, and shared-player playback", () => {
  assert.match(indexSource, /id="playlistNameInput"/);
  assert.match(indexSource, /id="playlistCreateButton"/);
  assert.match(indexSource, /id="playlistTarget"/);
  assert.match(indexSource, /id="playlistCards"/);
  assert.match(indexSource, /src="playlist-manager\.js"/);
  assert.match(playlistSource, /pulse-playlists-v1/);
  assert.match(playlistSource, /window\.PULSE_PLAYLISTS/);
  assert.match(playlistSource, /pulse:playlist-play/);
  assert.match(playlistSource, /playlist\.tracks\.splice\(index, 1\)/);
  assert.match(appSource, /window\.PULSE_PLAYLISTS\?\.add\(tracks\.find/);
  assert.match(appSource, /window\.addEventListener\("pulse:playlist-play"/);
  assert.match(appSource, /data-playlist-add/);
  assert.match(appSource, /＋ Playlist/);
});

test("discovery preferences and latest-added search are wired to the Archive adapter", () => {
  assert.match(indexSource, /id="discoveryCountry"/);
  assert.match(indexSource, /id="discoveryGenre"/);
  assert.match(indexSource, /id="discoveryLatest"/);
  assert.match(indexSource, /id="saveDiscoveryPreferences"/);
  assert.match(appSource, /pulse-discovery-preferences-v1/);
  assert.match(appSource, /discoverySearchTerm/);
  assert.match(appSource, /searchArchiveForDiscovery/);
  assert.match(appSource, /async function searchOnlineCatalog\(term\)/);
  assert.match(
    appSource,
    /const onlineTracks = tracks\.filter\(\(track\) => onlineSearchIds\.has\(track\.id\)\)/,
  );
  assert.match(appSource, /renderMobileListeningHome\(\);/);
  assert.match(archiveSource, /previewPenalty/);
  assert.match(archiveSource, /addeddate desc/);
  assert.match(archiveSource, /addedDate:/);
});

test("playlist playback is sequential and advances automatically when a track ends", () => {
  assert.match(appSource, /window\.addEventListener\("pulse:playlist-start"/);
  assert.match(appSource, /playlistQueue = ids;/);
  assert.match(appSource, /playlistQueueIndex = 0;/);
  assert.match(appSource, /playlistQueueIndex \+= 1;/);
  assert.match(appSource, /audio\.onended = .*next\(\)/);
  assert.match(appSource, /pulse:playlist-play/);
  assert.match(
    playlistSource,
    /window\.dispatchEvent\(\s*new CustomEvent\("pulse:playlist-start"/,
  );
});

test("country-aware catalog returns recent song previews ordered by release date", async () => {
  const sandbox = { URL, URLSearchParams, window: {} };
  vm.runInNewContext(catalogSource, sandbox);
  const calls = [];
  const mockFetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        results: [
          {
            trackId: 1,
            trackName: "Older",
            artistName: "Artist",
            previewUrl: "https://audio.example/old.mp3",
            trackViewUrl: "https://music.example/old",
            releaseDate: "2020-01-01T00:00:00Z",
            primaryGenreName: "Pop",
          },
          {
            trackId: 2,
            trackName: "Newer",
            artistName: "Artist",
            previewUrl: "https://audio.example/new.mp3",
            trackViewUrl: "https://music.example/new",
            releaseDate: "2025-01-01T00:00:00Z",
            primaryGenreName: "Pop",
          },
          {
            trackId: 3,
            trackName: "Unknown date",
            artistName: "Artist",
            previewUrl: "https://audio.example/unknown.mp3",
            releaseDate: "not-a-date",
            primaryGenreName: "Pop",
          },
        ],
      }),
    };
  };
  const results = await sandbox.window.PULSE_CATALOG.search(
    { country: "India", genre: "pop" },
    mockFetch,
  );
  assert.equal(results[0].title, "Newer");
  assert.equal(results[1].title, "Older");
  assert.equal(results[2].title, "Unknown date");
  assert.equal(results[0].time, "0:30");
  assert.match(calls[0], /country=in/);
  assert.match(calls[0], /entity=song/);
  assert.match(calls[0], /explicit=No/);
  assert.equal(results[0].source, "itunes-preview");
});

test("main search returns only full-length Archive recordings, not catalogue previews", () => {
  assert.match(appSource, /async function searchOnlineCatalog/);
  assert.match(appSource, /PULSE_ARCHIVE\?\.search/);
  assert.match(appSource, /Short previews are hidden/);
  assert.doesNotMatch(appSource, /searchRegionalCatalog\(prefs, cleanTerm\)/);
  assert.match(appSource, /onlineSearchIds\.add\(track\.id\)/);
  assert.match(appSource, /onlineSearchIds\.has\(t\.id\)/);
  assert.match(appSource, /String\(t\.id\) === id/);
  assert.match(appSource, /escapeHTML\(t\.id\)/);
  assert.match(indexSource, /press Enter for online results/);
});

test("home discovery and generated mixes use Archive recordings instead of 30-second previews", () => {
  assert.match(appSource, /async function loadArchiveDiscovery/);
  assert.match(
    appSource,
    /items = items\.filter\(\(item\) => item\?\.src && item\.source === "internet-archive"/,
  );
  assert.doesNotMatch(
    appSource,
    /if \(items\.length < 3 && window\.PULSE_CATALOG/,
  );
  assert.match(archiveSource, /clearlyPreview/);
  assert.match(archiveSource, /tooShort/);
});

test("Worldwide discovery combines regional catalogs", () => {
  assert.match(appSource, /async function searchRegionalCatalog/);
  assert.match(
    appSource,
    /United States.*India.*United Kingdom.*Japan.*South Korea/s,
  );
  assert.match(indexSource, /FRESH FINDS/);
});

test("playlist manager creates, persists, and emits songs in order", () => {
  const elements = new Map();
  const events = [];
  const storage = new Map();
  class Element {
    constructor(id = "") {
      this.id = id;
      this.children = [];
      this.listeners = {};
      this.classList = { add() {} };
      this.value = "";
      this.textContent = "";
      this.disabled = false;
      this.hidden = false;
    }
    addEventListener(type, callback) {
      (this.listeners[type] ||= []).push(callback);
    }
    dispatch(type, event = {}) {
      for (const callback of this.listeners[type] || []) callback(event);
    }
    click() {
      this.dispatch("click", { preventDefault() {} });
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = [...children];
    }
    setAttribute() {}
    scrollIntoView() {}
  }
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element(id));
      return elements.get(id);
    },
    createElement(tag) {
      return new Element(tag);
    },
  };
  const sandbox = {
    document,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    window: {
      dispatchEvent: (event) => events.push(event),
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    prompt: () => "",
    confirm: () => true,
    Date,
    Math,
  };
  vm.runInNewContext(playlistSource, sandbox);
  const manager = sandbox.window.PULSE_PLAYLISTS;
  manager.create("Latest Pop");
  manager.add({
    id: "t1",
    title: "First",
    artist: "A",
    src: "https://audio.example/1.mp3",
    source: "itunes-preview",
  });
  manager.add({
    id: "t2",
    title: "Second",
    artist: "B",
    src: "https://audio.example/2.mp3",
    source: "itunes-preview",
  });
  manager.add({
    id: "catalog-a",
    catalogId: "42",
    title: "Catalog song",
    src: "https://audio.example/catalog-a.mp3",
    source: "itunes-preview",
  });
  manager.add({
    id: "catalog-b",
    catalogId: "42",
    title: "Catalog song duplicate",
    src: "https://audio.example/catalog-b.mp3",
    source: "itunes-preview",
  });
  const playlist = manager.list()[0];
  assert.equal(playlist.name, "Latest Pop");
  assert.deepEqual(
    Array.from(playlist.tracks, (track) => track.title),
    ["First", "Second", "Catalog song"],
  );
  assert.equal(
    JSON.parse(storage.get("pulse-playlists-v1"))[0].tracks.length,
    3,
  );
  document.getElementById("playlistPlayAll").click();
  assert.equal(events.at(-1).type, "pulse:playlist-start");
  assert.deepEqual(
    Array.from(events.at(-1).detail, (track) => track.title),
    ["First", "Second", "Catalog song"],
  );
});
