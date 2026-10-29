const tracks = [
  {
    id: 1,
    title: "Quiet Signals",
    artist: "Pulse Sessions",
    mood: "Focus",
    time: "5:42",
    cover: "violet",
    symbol: "✳",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: 2,
    title: "Blue Hour",
    artist: "Northbound",
    mood: "Ambient",
    time: "6:18",
    cover: "blue",
    symbol: "◌",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: 3,
    title: "Little By Little",
    artist: "Sunday Club",
    mood: "Energy",
    time: "4:36",
    cover: "orange",
    symbol: "ϟ",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: 4,
    title: "Soft Geometry",
    artist: "Mira Vale",
    mood: "Focus",
    time: "5:09",
    cover: "green",
    symbol: "◈",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    id: 5,
    title: "Afterimage",
    artist: "Low Season",
    mood: "Night",
    time: "4:58",
    cover: "pink",
    symbol: "☾",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    id: 6,
    title: "Open Water",
    artist: "Still Forms",
    mood: "Ambient",
    time: "6:01",
    cover: "blue",
    symbol: "≈",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
];
const $ = (id) => document.getElementById(id),
  audio = $("audio");
let index = 0,
  playing = false,
  shuffleOn = false,
  repeatOn = false,
  az = false,
  view = "discover",
  mood = "",
  query = "",
  liked = new Set(JSON.parse(localStorage.getItem("pulse-liked") || "[]")),
  recent = JSON.parse(localStorage.getItem("pulse-recent") || "[]"),
  timer;
let playlistQueue = [],
  playlistQueueIndex = -1,
  onlineSearchIds = new Set(),
  onlineSearchBusy = false;
function toast(s) {
  $("toast").textContent = s;
  $("toast").classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => $("toast").classList.remove("show"), 2100);
}
function save() {
  localStorage.setItem("pulse-liked", JSON.stringify([...liked]));
  localStorage.setItem("pulse-recent", JSON.stringify(recent));
}
function pulseTrackPayload(track) {
  const sourceUrl = track?.sourceUrl || track?.src || track?.customUrl || "";
  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  let source = track?.source || "direct";
  try {
    const host = new URL(sourceUrl).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    if (!track?.source) {
      if (
        host === "youtube.com" ||
        host === "youtu.be" ||
        host === "music.youtube.com" ||
        host === "m.youtube.com"
      )
        source = "youtube";
      else if (host === "soundcloud.com") source = "soundcloud";
    }
  } catch (_) {
    return null;
  }
  return {
    id: track.id,
    title: track.title || "Untitled track",
    artist: track.artist || "",
    source,
    sourceUrl,
    artworkUrl: track.artworkUrl || undefined,
  };
}
function emitPulseLibraryEvent(name, track) {
  const payload = pulseTrackPayload(track);
  if (payload) window.dispatchEvent(new CustomEvent(name, { detail: payload }));
}
window.PULSE_EXPORT_LOCAL_LIBRARY = () => ({
  liked: [...liked]
    .map((id) => tracks.find((track) => track.id === id))
    .filter(Boolean)
    .map(pulseTrackPayload)
    .filter(Boolean),
  recent: recent
    .map((id) => tracks.find((track) => track.id === id))
    .filter(Boolean)
    .map(pulseTrackPayload)
    .filter(Boolean),
});
function fmt(n) {
  return Number.isFinite(n)
    ? Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0")
    : "0:00";
}
function list() {
  let a = [...tracks];
  if (view === "library") a = a.filter((t) => liked.has(t.id));
  if (view === "recent")
    a = a
      .filter((t) => recent.includes(t.id))
      .sort((x, y) => recent.indexOf(x.id) - recent.indexOf(y.id));
  if (mood) a = a.filter((t) => t.mood.toLowerCase() === mood.toLowerCase());
  if (query)
    a = a.filter((t) =>
      (t.title + " " + t.artist + " " + t.mood)
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  if (az) a.sort((x, y) => x.title.localeCompare(y.title));
  return a;
}
function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch],
  );
}
function render() {
  let a = list();
  $("count").textContent = String(a.length).padStart(2, "0") + " TRACKS";
  $("empty").hidden = !!a.length;
  $("rows").innerHTML = a
    .map(
      (t, i) =>
        '<div class="row ' +
        (tracks[index].id === t.id ? "playing" : "") +
        '" data-id="' +
        t.id +
        '"><div class="num"><button class="rowplay" aria-label="Play">' +
        (tracks[index].id === t.id && playing
          ? "Ⅱ"
          : String(i + 1).padStart(2, "0")) +
        '</button></div><div class="info"><div class="cover ' +
        t.cover +
        '">' +
        t.symbol +
        "</div><div><strong>" +
        escapeHTML(t.title) +
        "</strong><small>" +
        escapeHTML(t.artist) +
        '</small></div></div><div class="moodcell"><span class="chip">' +
        escapeHTML(t.mood) +
        '</span></div><div class="time">' +
        t.time +
        '</div><button class="rowadd" data-playlist-add="1" aria-label="Add to playlist">＋</button><button class="rowlike ' +
        (liked.has(t.id) ? "liked" : "") +
        '" data-like="1">' +
        (liked.has(t.id) ? "♥" : "♡") +
        "</button></div>",
    )
    .join("");
}
function resolveMusicEmbed(raw) {
  let u;
  try {
    u = new URL(raw.trim());
  } catch (_) {
    throw new Error("Paste a valid music link first.");
  }
  if (!["https:", "http:"].includes(u.protocol))
    throw new Error("Only http and https links are supported.");
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    let id = "",
      list = u.searchParams.get("list");
    if (host === "youtu.be")
      id = u.pathname.split("/").filter(Boolean)[0] || "";
    else if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)/);
      if (m) id = m[1];
    }
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id))
      return {
        title: "YouTube player",
        url:
          "https://www.youtube-nocookie.com/embed/" +
          id +
          (list ? "?list=" + encodeURIComponent(list) : ""),
        ratio: "video",
      };
    if (list && /^[A-Za-z0-9_-]+$/.test(list))
      return {
        title: "YouTube playlist",
        url:
          "https://www.youtube-nocookie.com/embed/videoseries?list=" +
          encodeURIComponent(list),
        ratio: "video",
      };
    throw new Error(
      "Paste a YouTube video or playlist URL, not a channel or search page.",
    );
  }
  if (host === "soundcloud.com") {
    const parts = u.pathname.split("/").filter(Boolean),
      isNavigation = ["discover", "search", "you"].includes(parts[0]),
      isTrack = parts.length === 2 && !isNavigation,
      isPlaylist = parts.length === 3 && parts[1] === "sets" && !isNavigation;
    if (!isTrack && !isPlaylist)
      throw new Error("Paste a SoundCloud track or playlist link.");
    return {
      title: "SoundCloud player",
      url:
        "https://w.soundcloud.com/player/?url=" +
        encodeURIComponent(u.href) +
        "&color=%23b8f36b&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=true",
      ratio: "soundcloud",
    };
  }
  throw new Error(
    "Supported links: YouTube / YouTube Music and SoundCloud. Search Jamendo above, or use ＋ File / ↗ Link for audio.",
  );
}
function embedLayoutClass(ratio) {
  return ["compact", "video", "soundcloud"].includes(ratio) ? ratio : "";
}
function loadMusicEmbed(raw) {
  const error = $("sourceError"),
    wrap = $("embedWrap"),
    frame = $("sourceFrame");
  try {
    const result = resolveMusicEmbed(raw);
    const sourceUrl = new URL(raw.trim());
    const host = sourceUrl.hostname.toLowerCase().replace(/^www\./, "");
    const source = [
      "youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ].includes(host)
      ? "youtube"
      : host === "soundcloud.com"
        ? "soundcloud"
        : "direct";
    window.PULSE_CURRENT_TRACK = {
      title: result.title,
      artist: "",
      source,
      sourceUrl: sourceUrl.href,
    };
    frame.src = result.url;
    frame.title = result.title;
    wrap.classList.remove("compact", "video", "soundcloud");
    const layout = embedLayoutClass(result.ratio);
    if (layout) wrap.classList.add(layout);
    $("embedTitle").textContent = result.title;
    wrap.hidden = false;
    error.textContent = "";
    $("sourceUrl").setAttribute("aria-invalid", "false");
    wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    frame.src = "about:blank";
    wrap.hidden = true;
    error.textContent = e.message;
    $("sourceUrl").setAttribute("aria-invalid", "true");
  }
}

let jamendoTrackCounter = 0;
async function searchJamendo(searchText) {
  const statusNode = $("jamendoStatus");
  const resultsNode = $("jamendoResults");
  const clientId = String(
    (window.PULSE_CONFIG || {}).jamendoClientId || "",
  ).trim();
  resultsNode.replaceChildren();
  if (!clientId) {
    statusNode.textContent =
      "Jamendo search needs a public API client ID. Create an app in the Jamendo developer portal, then add jamendoClientId to config.js.";
    return;
  }
  const term = String(searchText || "").trim();
  if (term.length < 2) {
    statusNode.textContent = "Enter at least two characters to search Jamendo.";
    return;
  }
  statusNode.textContent = "Searching Jamendo…";
  try {
    const url = new URL("https://api.jamendo.com/v3.0/tracks/");
    url.search = new URLSearchParams({
      client_id: clientId,
      format: "json",
      limit: "20",
      namesearch: term,
      audioformat: "mp31",
      include: "musicinfo",
      order: "popularity_total",
    }).toString();
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error("Jamendo API returned HTTP " + response.status);
    const data = await response.json();
    if (data.headers?.status !== "success" || !Array.isArray(data.results)) {
      throw new Error(
        data.headers?.error_message ||
          "Jamendo returned an unexpected response.",
      );
    }
    if (!data.results.length) {
      statusNode.textContent =
        "No matching tracks found. Try another artist or title.";
      return;
    }
    statusNode.textContent =
      data.results.length +
      " Jamendo tracks found. Select Play to add one to Pulse's shared player.";
    for (const item of data.results) {
      if (!item.audio || !item.id || !item.name) continue;
      const row = document.createElement("article");
      row.className = "jamendo-result";
      const artwork = document.createElement("img");
      artwork.loading = "lazy";
      artwork.alt = "";
      artwork.src = item.album_image || "";
      artwork.onerror = () => artwork.removeAttribute("src");
      const details = document.createElement("div");
      details.className = "jamendo-result-info";
      const title = document.createElement("strong");
      title.textContent = item.name;
      const artist = document.createElement("small");
      artist.textContent = item.artist_name || "Unknown artist";
      const license = document.createElement("small");
      license.textContent =
        "Jamendo · " +
        fmt(Number(item.duration) || 0) +
        (item.license_ccurl ? " · licence details available" : "");
      details.append(title, artist, license);
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "secondary";
      playButton.textContent = "▶ Play";
      playButton.addEventListener("click", () => {
        let track = tracks.find(
          (candidate) => candidate.jamendoId === String(item.id),
        );
        if (!track) {
          track = {
            id: Date.now() + jamendoTrackCounter++,
            jamendoId: String(item.id),
            title: item.name,
            artist: item.artist_name || "Unknown artist",
            mood: "Jamendo",
            time: fmt(Number(item.duration) || 0),
            cover: "green",
            symbol: "♫",
            src: item.audio,
            source: "jamendo",
            artworkUrl: item.album_image || undefined,
            licenseUrl: item.license_ccurl || undefined,
          };
          tracks.push(track);
        }
        setTrack(
          tracks.findIndex((candidate) => candidate.id === track.id),
          true,
        );
        window.PULSE_QUEUE?.add(track);
        statusNode.textContent =
          "Playing " + track.title + " in Pulse's shared player.";
      });
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "secondary";
      addButton.textContent = "＋ Playlist";
      addButton.addEventListener("click", () =>
        window.PULSE_PLAYLISTS?.add({
          id: "jamendo:" + item.id,
          jamendoId: String(item.id),
          title: item.name,
          artist: item.artist_name || "Unknown artist",
          mood: "Jamendo",
          time: fmt(Number(item.duration) || 0),
          cover: "green",
          symbol: "♫",
          src: item.audio,
          sourceUrl: item.audio,
          source: "Jamendo",
          artworkUrl: item.album_image || undefined,
          licenseUrl: item.license_ccurl || undefined,
        }),
      );
      row.append(artwork, details, playButton, addButton);
      resultsNode.append(row);
    }
  } catch (error) {
    statusNode.textContent =
      "Jamendo search failed: " +
      (error?.message || "check your connection and client ID.");
  }
}
$("jamendoForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  void searchJamendo($("jamendoQuery").value);
});

let archiveTrackCounter = 0;
async function searchInternetArchive(searchText) {
  const statusNode = $("archiveStatus");
  const resultsNode = $("archiveResults");
  resultsNode.replaceChildren();
  const term = String(searchText || "").trim();
  if (term.length < 2) {
    statusNode.textContent =
      "Enter at least two characters to search Internet Archive.";
    return;
  }
  if (!window.PULSE_ARCHIVE?.search) {
    statusNode.textContent =
      "Internet Archive search module did not load. Refresh and try again.";
    return;
  }
  statusNode.textContent =
    "Searching Internet Archive and checking playable audio files…";
  try {
    const items = await window.PULSE_ARCHIVE.search(discoverySearchTerm(term), {
      latest: discoveryPreferences().latest,
    });
    if (!items.length) {
      statusNode.textContent =
        "No items with a supported audio file were found. Try another search.";
      return;
    }
    statusNode.textContent =
      items.length +
      " items with supported audio found. Rights and availability vary by item.";
    for (const item of items) {
      const row = document.createElement("article");
      row.className = "jamendo-result";
      const details = document.createElement("div");
      details.className = "jamendo-result-info";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const artist = document.createElement("small");
      artist.textContent = item.artist + (item.year ? " · " + item.year : "");
      const rights = document.createElement("small");
      rights.textContent = item.licenseUrl
        ? "Internet Archive · " + item.format + " · licence details available"
        : "Internet Archive · " +
          item.format +
          " · check item rights before reuse";
      const sourceLink = document.createElement("a");
      sourceLink.href = item.sourceUrl;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "View item ↗";
      details.append(title, artist, rights, sourceLink);
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "secondary";
      playButton.textContent = "▶ Play";
      playButton.addEventListener("click", () => {
        let track = tracks.find((candidate) => candidate.archiveId === item.id);
        if (!track) {
          track = {
            id: Date.now() + archiveTrackCounter++,
            archiveId: item.id,
            title: item.title,
            artist: item.artist,
            mood: "Archive",
            time: "—",
            cover: "blue",
            symbol: "♫",
            src: item.src,
            sourceUrl: item.sourceUrl,
            source: "internet-archive",
            artworkUrl: undefined,
            licenseUrl: item.licenseUrl || undefined,
            rights: item.rights || undefined,
          };
          tracks.push(track);
        }
        setTrack(
          tracks.findIndex((candidate) => candidate.id === track.id),
          true,
        );
        window.PULSE_QUEUE?.add(track);
        statusNode.textContent =
          "Selected " +
          track.title +
          ". If playback fails, the item may restrict streaming or seeking.";
      });
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "secondary";
      addButton.textContent = "＋ Playlist";
      addButton.addEventListener("click", () =>
        window.PULSE_PLAYLISTS?.add({
          id: "archive:" + item.id,
          archiveId: item.id,
          title: item.title,
          artist: item.artist,
          mood: "Archive",
          time: "—",
          cover: "blue",
          symbol: "♫",
          src: item.src,
          sourceUrl: item.sourceUrl,
          source: "Internet Archive",
          licenseUrl: item.licenseUrl || undefined,
          rights: item.rights || undefined,
          year: item.year || "",
          format: item.format || "",
        }),
      );
      row.append(details, playButton, addButton);
      resultsNode.append(row);
    }
  } catch (error) {
    statusNode.textContent =
      "Internet Archive search failed: " +
      (error?.message || "check your connection and try again.");
  }
}
$("archiveForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  void searchInternetArchive($("archiveQuery").value);
});

/* Automatic Archive discovery for the home page. This is opt-in playback: nothing autoplays. */
let archiveDiscoveryItems = [];
const DISCOVERY_PREFS_KEY = "pulse-discovery-preferences-v1";
function discoveryPreferences() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(DISCOVERY_PREFS_KEY) || "{}");
  } catch (_) {}
  const countryNode = $("discoveryCountry"),
    genreNode = $("discoveryGenre"),
    latestNode = $("discoveryLatest");
  if (
    countryNode &&
    saved.country &&
    [...countryNode.options].some((o) => o.value === saved.country)
  )
    countryNode.value = saved.country;
  if (
    genreNode &&
    saved.genre &&
    [...genreNode.options].some((o) => o.value === saved.genre)
  )
    genreNode.value = saved.genre;
  if (latestNode && typeof saved.latest === "boolean")
    latestNode.checked = saved.latest;
  return {
    country: countryNode?.value || saved.country || "Worldwide",
    genre: genreNode?.value || saved.genre || "ambient",
    latest: latestNode ? latestNode.checked : saved.latest !== false,
  };
}
function saveDiscoveryPreferences() {
  const prefs = discoveryPreferences();
  try {
    localStorage.setItem(DISCOVERY_PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
  return prefs;
}
function discoverySearchTerm(base = "") {
  const prefs = discoveryPreferences();
  return [
    base.trim(),
    prefs.genre,
    prefs.country !== "Worldwide" ? prefs.country : "",
  ]
    .filter(Boolean)
    .join(" ");
}
function searchArchiveForDiscovery(base = "") {
  const prefs = discoveryPreferences();
  return window.PULSE_ARCHIVE.search(discoverySearchTerm(base), {
    latest: prefs.latest,
  });
}
$("saveDiscoveryPreferences")?.addEventListener("click", () => {
  saveDiscoveryPreferences();
  void loadArchiveDiscovery();
  toast("Discovery preferences applied.");
});
["discoveryCountry", "discoveryGenre", "discoveryLatest"].forEach((id) => {
  $(id)?.addEventListener("change", () => saveDiscoveryPreferences());
});
function renderArchiveDiscovery(items) {
  const host = $("archiveDiscoveryResults");
  if (!host) return;
  host.replaceChildren();
  archiveDiscoveryItems = items.slice(0, 8);
  for (const item of archiveDiscoveryItems) {
    const isCatalog = Boolean(item.catalogId);
    const card = document.createElement("article");
    card.className = "archive-discovery-card";
    const glyph = document.createElement("span");
    glyph.className = "archive-glyph";
    glyph.textContent = "♫";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title || "Untitled recording";
    const meta = document.createElement("small");
    meta.textContent = isCatalog
      ? (item.artist || "Unknown artist") +
        " · " +
        (item.genre || "Music") +
        " · " +
        (item.year || "Release date unavailable") +
        " · 30-sec preview"
      : (item.artist || "Unknown artist") +
        " · Internet Archive · " +
        (item.format || "audio");
    info.append(title, meta);
    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "secondary";
    playButton.textContent = "▶";
    playButton.setAttribute(
      "aria-label",
      "Play " + (item.title || "recording"),
    );
    playButton.addEventListener("click", () => {
      let track = tracks.find(
        (candidate) =>
          (isCatalog && candidate.catalogId === item.catalogId) ||
          (!isCatalog && candidate.archiveId === item.id),
      );
      if (!track) {
        track = {
          id: isCatalog
            ? "itunes:" + item.catalogId
            : Date.now() + archiveTrackCounter++,
          archiveId: isCatalog ? undefined : item.id,
          catalogId: item.catalogId,
          title: item.title || "Untitled recording",
          artist: item.artist || "Unknown artist",
          mood: item.genre || "Archive",
          time: item.time || "—",
          cover: item.cover || "blue",
          symbol: item.symbol || "♫",
          src: item.src,
          sourceUrl: item.src,
          sourcePage: item.sourcePage || item.sourceUrl || "",
          source: item.source || "internet-archive",
          artworkUrl: item.artworkUrl || undefined,
          releaseDate: item.releaseDate || "",
          licenseUrl: item.licenseUrl || undefined,
          rights: item.rights || undefined,
        };
        tracks.push(track);
      }
      setTrack(
        tracks.findIndex((candidate) => candidate.id === track.id),
        true,
      );
      window.PULSE_QUEUE?.add(track);
    });
    card.append(glyph, info, playButton);
    if (item.sourcePage) {
      const sourceLink = document.createElement("a");
      sourceLink.href = item.sourcePage;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "View source ↗";
      card.append(sourceLink);
    }
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "secondary";
    addButton.textContent = "＋ Playlist";
    addButton.addEventListener("click", () => {
      window.PULSE_PLAYLISTS?.add({
        id: isCatalog ? "itunes:" + item.catalogId : "archive:" + item.id,
        catalogId: item.catalogId,
        archiveId: isCatalog ? undefined : item.id,
        title: item.title || "Untitled recording",
        artist: item.artist || "Unknown artist",
        mood: item.genre || "Archive",
        time: item.time || "—",
        cover: item.cover || "blue",
        symbol: item.symbol || "♫",
        src: item.src,
        sourceUrl: item.src,
        sourcePage: item.sourcePage || item.sourceUrl || "",
        source: item.source || "Internet Archive",
        artworkUrl: item.artworkUrl || undefined,
        releaseDate: item.releaseDate || "",
        licenseUrl: item.licenseUrl || undefined,
        rights: item.rights || undefined,
        year: item.year || "",
        format: item.format || "",
      });
    });
    card.append(addButton);
    host.append(card);
  }
}
async function searchRegionalCatalog(prefs, term = prefs.genre) {
  if (!window.PULSE_CATALOG?.search) return [];
  const regions =
    prefs.country === "Worldwide"
      ? ["United States", "India", "United Kingdom", "Japan", "South Korea"]
      : [prefs.country];
  const batches = await Promise.all(
    regions.map((country) =>
      window.PULSE_CATALOG.search({
        country,
        genre: prefs.genre,
        term: term || prefs.genre,
        latest: prefs.latest,
        limit: 30,
      }).catch(() => []),
    ),
  );
  const seen = new Set();
  const results = batches.flat().filter((item) => {
    const key = item.catalogId || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (prefs.latest)
    results.sort(
      (a, b) =>
        Date.parse(b.releaseDate || "") - Date.parse(a.releaseDate || ""),
    );
  return results.slice(0, 50);
}
async function loadArchiveDiscovery() {
  const status = $("archiveDiscoveryStatus");
  if (!status) return;
  status.textContent = "Finding recent releases for your region and genre…";
  const prefs = discoveryPreferences();
  let items = [];
  if (window.PULSE_CATALOG?.search) items = await searchRegionalCatalog(prefs);
  if (!items.length && window.PULSE_ARCHIVE?.search) {
    try {
      items = await searchArchiveForDiscovery("");
    } catch (_) {
      items = [];
    }
  }
  if (!items.length) {
    status.textContent =
      "No catalog matches right now. Try another genre or search Archive from Sources.";
    return;
  }
  renderArchiveDiscovery(items);
  status.textContent = items.some((item) => item.catalogId)
    ? "Latest matching catalog releases, sorted by release date. Play uses short previews; full-track availability depends on the provider."
    : "Archive fallback: recently added recordings matched to your preferences. Check item rights and streaming availability.";
}
$("generateArchiveMix")?.addEventListener("click", async () => {
  const button = $("generateArchiveMix");
  const status = $("archiveDiscoveryStatus");
  button.disabled = true;
  button.textContent = "Building mix…";
  const prefs = discoveryPreferences();
  try {
    if (!window.PULSE_PLAYLISTS?.create || !window.PULSE_PLAYLISTS?.add) {
      throw new Error("Playlist storage did not load. Refresh and try again.");
    }
    let items = archiveDiscoveryItems.filter((item) => item.src);
    if (items.length < 3 && window.PULSE_CATALOG?.search)
      items = await searchRegionalCatalog(prefs);
    if (items.length < 3 && window.PULSE_ARCHIVE?.search) {
      const terms = [
        prefs.genre,
        prefs.genre + " music",
        "field recordings " + prefs.genre,
      ];
      const batches = await Promise.all(
        terms.map((term) => searchArchiveForDiscovery(term).catch(() => [])),
      );
      const seen = new Set(items.map((item) => item.catalogId || item.id));
      items = items.concat(
        batches.flat().filter((item) => {
          const key = item.catalogId || item.id || item.src;
          if (!key || !item.src || seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      );
    }
    items = items.filter((item) => item.src).slice(0, 12);
    if (!items.length)
      throw new Error(
        "No playable previews or Archive audio were found. Try again later.",
      );
    const hasCatalog = items.some((item) => item.catalogId);
    const name =
      (prefs.genre || "Discovery") +
      " Mix · " +
      (hasCatalog ? "Latest releases" : "Archive") +
      " · " +
      new Date().toLocaleDateString();
    window.PULSE_PLAYLISTS.create(name);
    for (const item of items) {
      window.PULSE_PLAYLISTS.add({
        id: item.catalogId ? "itunes:" + item.catalogId : "archive:" + item.id,
        catalogId: item.catalogId,
        archiveId: item.catalogId ? undefined : item.id,
        title: item.title || "Untitled recording",
        artist: item.artist || "Unknown artist",
        mood: item.genre || "Archive",
        time: item.time || "—",
        cover: item.cover || "blue",
        symbol: item.symbol || "♫",
        src: item.src,
        sourceUrl: item.src,
        sourcePage: item.sourcePage || item.sourceUrl || "",
        source: item.source || "Internet Archive",
        artworkUrl: item.artworkUrl || undefined,
        releaseDate: item.releaseDate || "",
        licenseUrl: item.licenseUrl || undefined,
        rights: item.rights || undefined,
        year: item.year || "",
        format: item.format || "",
      });
    }
    status.textContent =
      "Created " +
      name +
      " with " +
      items.length +
      " tracks. Catalog entries use short previews; Archive rights and streaming vary by item.";
    toast("Your mix is ready.");
  } catch (error) {
    status.textContent = error.message || "Could not build a mix right now.";
  } finally {
    button.disabled = false;
    button.textContent = "✦ Generate my mix";
  }
});
void loadArchiveDiscovery();

window.addEventListener("pulse:playlist-play", (event) => {
  playlistQueue = [];
  playlistQueueIndex = -1;
  const item = event.detail;
  if (!item?.src || !/^https?:\/\//i.test(item.src)) return;
  let track = tracks.find(
    (candidate) =>
      (item.archiveId && candidate.archiveId === item.archiveId) ||
      (item.jamendoId && candidate.jamendoId === item.jamendoId) ||
      candidate.src === item.src,
  );
  if (!track) {
    track = {
      id: Date.now(),
      title: item.title || "Untitled track",
      artist: item.artist || "Unknown artist",
      mood: item.mood || "Playlist",
      time: item.time || "—",
      cover: item.cover || "blue",
      symbol: item.symbol || "♫",
      src: item.src,
      sourceUrl: item.sourceUrl || item.src,
      source: item.source || "Internet Archive",
      archiveId: item.archiveId,
      jamendoId: item.jamendoId,
      artworkUrl: item.artworkUrl,
      licenseUrl: item.licenseUrl,
      rights: item.rights,
    };
    tracks.push(track);
  }
  setTrack(
    tracks.findIndex((candidate) => candidate.id === track.id),
    true,
  );
});
window.addEventListener("pulse:playlist-start", (event) => {
  const items = Array.isArray(event.detail) ? event.detail : [];
  const ids = [];
  for (const item of items) {
    if (!item?.src || !/^https?:\/\//i.test(item.src)) continue;
    let track = tracks.find(
      (candidate) =>
        (item.archiveId && candidate.archiveId === item.archiveId) ||
        (item.jamendoId && candidate.jamendoId === item.jamendoId) ||
        candidate.src === item.src,
    );
    if (!track) {
      track = {
        id: Date.now() + ids.length,
        title: item.title || "Untitled track",
        artist: item.artist || "Unknown artist",
        mood: item.mood || "Playlist",
        time: item.time || "—",
        cover: item.cover || "blue",
        symbol: item.symbol || "♫",
        src: item.src,
        sourceUrl: item.sourceUrl || item.src,
        source: item.source || "Internet Archive",
        archiveId: item.archiveId,
        jamendoId: item.jamendoId,
        artworkUrl: item.artworkUrl,
        licenseUrl: item.licenseUrl,
        rights: item.rights,
      };
      tracks.push(track);
    }
    ids.push(tracks.findIndex((candidate) => candidate.id === track.id));
  }
  playlistQueue = ids;
  playlistQueueIndex = 0;
  if (playlistQueue.length) setTrack(playlistQueue[0], true);
  else toast("This playlist has no playable web audio tracks.");
});
function setTrack(i, autoplay = false) {
  index = (i + tracks.length) % tracks.length;
  let t = tracks[index];
  window.PULSE_CURRENT_TRACK = pulseTrackPayload(t);
  audio.src = t.src;
  audio.load();
  $("audioStatus").textContent = t.localFile
    ? "Playing a file selected from this device."
    : t.customUrl
      ? "Using your direct audio link."
      : "Demo preview · internet connection required.";
  $("nowTitle").textContent = t.title;
  $("nowArtist").textContent = t.artist;
  $("cover").className = "cover " + t.cover;
  $("cover").textContent = t.symbol;
  $("like").textContent = liked.has(t.id) ? "♥" : "♡";
  $("like").classList.toggle("liked", liked.has(t.id));
  $("duration").textContent = t.time;
  $("time").textContent = "0:00";
  $("progress").value = 0;
  render();
  if (autoplay) play();
}
async function play() {
  try {
    await audio.play();
    playing = true;
    $("audioStatus").textContent = "Playing · " + tracks[index].title;
    $("play").textContent = "Ⅱ";
    if (!recent.includes(tracks[index].id)) recent.unshift(tracks[index].id);
    recent = recent.slice(0, 6);
    save();
    emitPulseLibraryEvent("pulse:track-played", tracks[index]);
    render();
  } catch (e) {
    playing = false;
    $("play").textContent = "▶";
    const msg =
      e && e.name === "NotAllowedError"
        ? "Tap Play again to allow audio playback."
        : "Could not start this audio. Check the link or try another file.";
    $("audioStatus").textContent = msg;
    toast(msg);
  }
}
function pause() {
  audio.pause();
  playing = false;
  $("play").textContent = "▶";
  render();
}
function toggle() {
  playing ? pause() : play();
}
function next() {
  if (playlistQueue.length) {
    if (playlistQueueIndex + 1 < playlistQueue.length) {
      playlistQueueIndex += 1;
      setTrack(playlistQueue[playlistQueueIndex], true);
    } else {
      pause();
      audio.currentTime = 0;
      playlistQueue = [];
      playlistQueueIndex = -1;
    }
    return;
  }
  let n = shuffleOn ? Math.floor(Math.random() * tracks.length) : index + 1;
  if (n >= tracks.length && !repeatOn) {
    pause();
    audio.currentTime = 0;
    return;
  }
  setTrack(n, true);
}
function like(id) {
  const track = tracks.find((item) => item.id === id);
  const wasLiked = liked.has(id);
  liked.has(id) ? liked.delete(id) : liked.add(id);
  if (track)
    emitPulseLibraryEvent(
      wasLiked ? "pulse:track-unliked" : "pulse:track-liked",
      track,
    );
  save();
  $("like").textContent = liked.has(tracks[index].id) ? "♥" : "♡";
  $("like").classList.toggle("liked", liked.has(tracks[index].id));
  render();
}
function setView(v) {
  view = v;
  document.body.dataset.view = v;
  mood = "";
  $("crumb").textContent =
    v === "library"
      ? "Your library"
      : v === "recent"
        ? "Recently played"
        : v === "sources"
          ? "Sources"
          : "Discover";
  $("trackHeading").textContent =
    v === "library"
      ? "Saved tracks"
      : v === "recent"
        ? "Recently played"
        : "Made for the moment";
  $("heading").innerHTML =
    v === "library"
      ? "Your music, <span>your rules.</span>"
      : v === "recent"
        ? "Pick up <span>where you left off.</span>"
        : v === "sources"
          ? "Every source, <span>one place.</span>"
          : "Find your <span>next favourite.</span>";
  document
    .querySelectorAll(".nav")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  render();
  $("sidebar").classList.remove("open");
}
$("rows").addEventListener("click", (e) => {
  let r = e.target.closest(".row");
  if (!r) return;
  let id = Number(r.dataset.id);
  if (e.target.closest("[data-playlist-add]")) {
    window.PULSE_PLAYLISTS?.add(tracks.find((t) => t.id === id));
    return;
  }
  if (e.target.closest("[data-like]")) {
    like(id);
    return;
  }
  setTrack(
    tracks.findIndex((t) => t.id === id),
    true,
  );
});
document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document.querySelectorAll("[data-mood]").forEach(
  (b) =>
    (b.onclick = () => {
      mood = b.dataset.mood;
      view = "discover";
      document.querySelectorAll("[data-mood]").forEach((item) => {
        item.classList.toggle("active", item.dataset.mood === mood);
      });
      $("crumb").textContent = mood;
      $("trackHeading").textContent = mood + " selection";
      render();
      $("rows").scrollIntoView({ behavior: "smooth", block: "center" });
    }),
);
$("search").oninput = (e) => {
  query = e.target.value.trim();
  onlineSearchIds.clear();
  render();
};
$("search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void searchOnlineCatalog(query);
  }
});
async function searchOnlineCatalog(term) {
  const cleanTerm = String(term || "").trim();
  if (cleanTerm.length < 2 || onlineSearchBusy) return;
  onlineSearchBusy = true;
  $("audioStatus").textContent =
    'Searching music catalogs for "' + cleanTerm + '"…';
  try {
    const prefs = discoveryPreferences();
    let items = await searchRegionalCatalog(prefs, cleanTerm);
    if (!items.length && window.PULSE_ARCHIVE?.search) {
      items = await window.PULSE_ARCHIVE.search(cleanTerm, {
        latest: prefs.latest,
      });
    }
    if (!items.length) {
      $("audioStatus").textContent =
        "No online matches found. Try another title, artist, or genre.";
      return;
    }
    for (const item of items) {
      if (!item.src) continue;
      const existing = tracks.find(
        (track) =>
          (item.catalogId && track.catalogId === item.catalogId) ||
          (item.id && !item.catalogId && track.archiveId === item.id) ||
          track.src === item.src,
      );
      const track =
        existing ||
        {
          id: item.catalogId
            ? "itunes:" + item.catalogId
            : "archive:" + item.id,
          catalogId: item.catalogId,
          archiveId: item.catalogId ? undefined : item.id,
          title: item.title || "Untitled track",
          artist: item.artist || "Unknown artist",
          mood: item.genre || "Archive",
          time: item.time || "—",
          cover: item.cover || "blue",
          symbol: item.symbol || "♫",
          src: item.src,
          sourceUrl: item.sourceUrl || item.src,
          sourcePage: item.sourcePage || "",
          source: item.source || "internet-archive",
          artworkUrl: item.artworkUrl || undefined,
          releaseDate: item.releaseDate || "",
          licenseUrl: item.licenseUrl || undefined,
          rights: item.rights || undefined,
        };
      if (!existing) {
        tracks.push(track);
      }
      onlineSearchIds.add(track.id);
    }
    render();
    $("audioStatus").textContent =
      onlineSearchIds.size +
      " online matches added to results. Catalog entries play 30-second previews; Archive availability varies.";
  } catch (error) {
    $("audioStatus").textContent =
      "Online search failed: " + (error?.message || "check your connection.");
  } finally {
    onlineSearchBusy = false;
  }
}
$("play").onclick = toggle;
$("heroPlay").onclick = () => setTrack(0, true);
$("shuffleAll").onclick = () => {
  shuffleOn = true;
  toast("Shuffle is on");
  setTrack(Math.floor(Math.random() * tracks.length), true);
};
$("shuffle").onclick = () => {
  shuffleOn = !shuffleOn;
  toast(shuffleOn ? "Shuffle is on" : "Shuffle is off");
};
$("next").onclick = next;
$("prev").onclick = () => {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (playlistQueue.length && playlistQueueIndex > 0) {
    playlistQueueIndex -= 1;
    setTrack(playlistQueue[playlistQueueIndex], true);
  } else {
    setTrack(index - 1, true);
  }
};
$("repeat").onclick = () => {
  repeatOn = !repeatOn;
  audio.loop = repeatOn;
  toast(repeatOn ? "Repeat is on" : "Repeat is off");
};
$("like").onclick = () => like(tracks[index].id);
$("volume").oninput = (e) => (audio.volume = Number(e.target.value));
audio.volume = 0.75;
audio.ontimeupdate = () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    $("progress").value = (audio.currentTime / audio.duration) * 100;
    $("time").textContent = fmt(audio.currentTime);
    $("duration").textContent = fmt(audio.duration);
  }
};
$("progress").oninput = (e) => {
  if (Number.isFinite(audio.duration))
    audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
};
audio.onended = () => (repeatOn ? ((audio.currentTime = 0), play()) : next());
audio.onwaiting = () => {
  $("audioStatus").textContent =
    "Loading audio… If it stays here, the link may not be a direct audio file.";
};
audio.oncanplay = () => {
  $("audioStatus").textContent =
    "Audio ready · press Play if it has not started.";
};
const SAVED_FOR_LATER_KEY = "pulse-saved-for-later-v1";
let savedForLater = [];
try {
  const savedValue = JSON.parse(
    localStorage.getItem(SAVED_FOR_LATER_KEY) || "[]",
  );
  savedForLater = Array.isArray(savedValue) ? savedValue : [];
} catch (_) {
  savedForLater = [];
}
const savedForLaterHost = document.createElement("section");
savedForLaterHost.className = "saved-for-later";
savedForLaterHost.setAttribute("aria-label", "Saved for later");
savedForLaterHost.innerHTML =
  '<div class="sectionhead"><div><small>PLAYBACK RECOVERY</small><h2>Saved for later</h2></div></div><p class="embed-note">Tracks that fail to load are bookmarked on this device so you can retry them.</p><div id="savedForLaterRows"></div>';
$("audioStatus").insertAdjacentElement("afterend", savedForLaterHost);
function persistSavedForLater() {
  localStorage.setItem(SAVED_FOR_LATER_KEY, JSON.stringify(savedForLater));
}
function renderSavedForLater() {
  const host = $("savedForLaterRows");
  if (!host) return;
  host.replaceChildren();
  if (!savedForLater.length) {
    const empty = document.createElement("p");
    empty.className = "embed-note";
    empty.textContent = "Nothing saved yet.";
    host.append(empty);
    return;
  }
  for (const item of savedForLater) {
    const row = document.createElement("div");
    row.className = "saved-track-row";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title || "Untitled track";
    const artist = document.createElement("small");
    artist.textContent = item.artist || "Unknown artist";
    info.append(title, artist);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "secondary";
    retry.textContent = "↻ Retry";
    retry.addEventListener("click", () => {
      let track = tracks.find((candidate) => candidate.src === item.src);
      if (!track) {
        track = {
          ...item,
          id: Date.now(),
          cover: item.cover || "blue",
          symbol: item.symbol || "♫",
        };
        tracks.push(track);
      }
      setTrack(
        tracks.findIndex((candidate) => candidate.id === track.id),
        true,
      );
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "textbutton";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      savedForLater = savedForLater.filter((saved) => saved.src !== item.src);
      persistSavedForLater();
      renderSavedForLater();
    });
    row.append(info, retry, remove);
    host.append(row);
  }
}
function saveFailedTrack(track) {
  if (!track || !/^https?:\/\//i.test(track.src || "")) return;
  if (savedForLater.some((item) => item.src === track.src)) return;
  savedForLater.unshift({
    id: track.id,
    title: track.title || "Untitled track",
    artist: track.artist || "Unknown artist",
    mood: track.mood || "Saved",
    time: track.time || "—",
    cover: track.cover || "blue",
    symbol: track.symbol || "♫",
    src: track.src,
    sourceUrl: track.sourceUrl || track.src,
    source: track.source || "direct",
    archiveId: track.archiveId,
    jamendoId: track.jamendoId,
    licenseUrl: track.licenseUrl,
    rights: track.rights,
  });
  savedForLater = savedForLater.slice(0, 50);
  persistSavedForLater();
  renderSavedForLater();
}
renderSavedForLater();
audio.onerror = () => {
  saveFailedTrack(tracks[index]);
  playing = false;
  $("play").textContent = "▶";
  const msg =
    "Audio failed to load. Try a Jamendo result, a local file, or a direct .mp3/.m4a/.ogg link. Video page links are not direct audio.";
  $("audioStatus").textContent = msg;
  toast("Audio could not load. Try another source.");
  render();
};
$("allMoods").onclick = () => {
  mood = "";
  query = "";
  $("search").value = "";
  render();
  toast("Showing all demo tracks");
};
$("newPlaylist").onclick = () => {
  let n = prompt("Name your playlist");
  if (!n || !n.trim()) return;
  let b = document.createElement("button");
  b.className = "playlist";
  b.dataset.mood = "Focus";
  b.textContent = "●　" + n.trim().slice(0, 28);
  b.onclick = () => {
    mood = "Focus";
    render();
    toast("Demo playlist selected");
  };
  $("playlists").append(b);
  toast("Playlist created for this session");
};
$("menu").onclick = () => $("sidebar").classList.toggle("open");
document.addEventListener("click", (e) => {
  if (
    innerWidth <= 760 &&
    !e.target.closest("#sidebar") &&
    !e.target.closest("#menu")
  )
    $("sidebar").classList.remove("open");
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $("search").focus();
  }
  if (
    e.code === "Space" &&
    !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    toggle();
  }
});
$("rows").addEventListener("click", (e) => {
  if (e.target.closest(".rowplay")) e.preventDefault();
});
$("sourceForm").addEventListener("submit", (e) => {
  e.preventDefault();
  loadMusicEmbed($("sourceUrl").value);
});
$("saveEmbedSource").onclick = () => {
  if (!window.PULSE_CURRENT_TRACK) {
    toast("Load a supported music link first.");
    return;
  }
  window.dispatchEvent(
    new CustomEvent("pulse:track-liked", {
      detail: window.PULSE_CURRENT_TRACK,
    }),
  );
  toast("Source saved to your cloud library when signed in.");
};
$("closeEmbed").onclick = () => {
  $("sourceFrame").src = "about:blank";
  $("embedWrap").hidden = true;
  $("sourceError").textContent = "";
};
$("sourceUrl").addEventListener("input", () =>
  $("sourceUrl").setAttribute("aria-invalid", "false"),
);
$("addFileButton").onclick = () => $("audioFileInput").click();
$("audioFileInput").onchange = (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (
    !file.type.startsWith("audio/") &&
    !/\.(mp3|m4a|ogg|wav|flac)$/i.test(file.name)
  ) {
    toast("Choose an audio file such as MP3 or M4A.");
    return;
  }
  const track = {
    id: Date.now(),
    title: file.name.replace(/\.[^.]+$/, ""),
    artist: "From this device",
    mood: "Your audio",
    time: "—",
    cover: "blue",
    symbol: "♫",
    src: URL.createObjectURL(file),
    localFile: true,
  };
  tracks.push(track);
  $("audioFileInput").value = "";
  setTrack(tracks.length - 1, true);
  toast("Added " + track.title);
};
$("addUrlButton").onclick = () => {
  const value = prompt(
    "Paste a direct audio file URL, such as an MP3 or M4A link. YouTube page links are not direct audio files.",
  );
  if (!value || !value.trim()) return;
  let u;
  try {
    u = new URL(value.trim());
    if (!["https:", "http:"].includes(u.protocol)) throw new Error("protocol");
  } catch (_) {
    toast("Enter a valid http:// or https:// audio URL.");
    return;
  }
  const track = {
    id: Date.now(),
    title: decodeURIComponent(
      u.pathname.split("/").pop() || "Audio link",
    ).replace(/\.[^.]+$/, ""),
    artist: "Added audio link",
    mood: "Your audio",
    time: "—",
    cover: "blue",
    symbol: "♫",
    src: u.href,
    customUrl: true,
  };
  tracks.push(track);
  setTrack(tracks.length - 1, true);
  toast("Audio link added");
};
setTrack(0);

// Unified queue foundation for direct audio and provider links.
(() => {
  const queue = [];
  let queueIndex = -1;
  const currentQueueItem = () => queue[queueIndex] || null;
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
        })[c],
    );
  const panel = document.createElement("section");
  panel.id = "pulseQueuePanel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Playback queue");
  panel.style.cssText =
    "position:fixed;right:16px;bottom:104px;z-index:1000;width:min(360px,calc(100vw - 32px));max-height:55vh;overflow:auto;padding:16px;border:1px solid #34363d;border-radius:16px;background:#15161b;color:#f4f4f6;box-shadow:0 12px 40px #0008";
  panel.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><strong>Playback queue</strong><button type="button" id="pulseQueueClose" aria-label="Close queue">×</button></div><p id="pulseQueueNotice" role="status" style="font-size:12px;opacity:.8">Add tracks or source links to build your queue.</p><ol id="pulseQueueItems" style="padding-left:20px"></ol><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="pulseQueuePrev">Previous</button><button type="button" id="pulseQueuePlay">Play / Open</button><button type="button" id="pulseQueueNext">Next</button><button type="button" id="pulseQueueClear">Clear</button></div>';
  document.body.append(panel);
  const notice = (message) => {
    document.getElementById("pulseQueueNotice").textContent = message;
  };
  function renderQueue() {
    const list = document.getElementById("pulseQueueItems");
    list.replaceChildren();
    queue.forEach((item, i) => {
      const li = document.createElement("li");
      li.style.margin = "8px 0";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent =
        (i === queueIndex ? "▶ " : "") +
        item.title +
        (item.artist ? " — " + item.artist : "");
      button.style.cssText =
        "max-width:100%;text-align:left;white-space:normal";
      button.addEventListener("click", () => {
        queueIndex = i;
        playQueueItem();
      });
      li.append(button);
      list.append(li);
    });
    if (!queue.length) notice("Queue is empty. Add a track or source link.");
  }
  function normalize(item) {
    if (!item || !item.title) return null;
    const sourceUrl = item.sourceUrl || item.src || "";
    let source = item.source || "direct";
    if (sourceUrl) {
      try {
        const host = new URL(sourceUrl).hostname
          .toLowerCase()
          .replace(/^www\./, "");
        if (
          [
            "youtube.com",
            "youtu.be",
            "music.youtube.com",
            "m.youtube.com",
          ].includes(host)
        )
          source = "youtube";
        else if (host === "soundcloud.com") source = "soundcloud";
        else if (host.endsWith("jamendo.com")) source = "jamendo";
      } catch (_) {
        return null;
      }
    }
    return {
      title: String(item.title).slice(0, 200),
      artist: String(item.artist || "").slice(0, 200),
      source,
      sourceUrl,
      localId: item.id,
      localOnly: Boolean(
        item.localFile || (sourceUrl && sourceUrl.startsWith("blob:")),
      ),
    };
  }
  function add(item) {
    const normalized = normalize(item);
    if (!normalized) {
      notice("This item cannot be added to the queue.");
      return;
    }
    const duplicate = queue.findIndex(
      (q) => q.sourceUrl && q.sourceUrl === normalized.sourceUrl,
    );
    if (duplicate >= 0) {
      queueIndex = duplicate;
      notice("That source is already queued.");
    } else {
      queue.push(normalized);
      if (queueIndex < 0) queueIndex = 0;
      notice("Added to queue.");
    }
    renderQueue();
  }
  function playQueueItem() {
    const item = currentQueueItem();
    if (!item) {
      notice("Add a track first.");
      return;
    }
    if (
      item.localId !== undefined &&
      tracks.some((t) => t.id === item.localId)
    ) {
      const idx = tracks.findIndex((t) => t.id === item.localId);
      if (idx >= 0) {
        setTrack(idx, true);
        notice("Playing " + item.title);
        return;
      }
    }
    if (!item.sourceUrl || item.localOnly) {
      notice(
        "This local file is available only in the device session where it was added.",
      );
      return;
    }
    if (
      item.source === "direct" ||
      item.source === "jamendo" ||
      item.source === "itunes-preview"
    ) {
      const track = {
        id: Date.now(),
        title: item.title,
        artist: item.artist || "Queued audio",
        mood: "Queue",
        time: "—",
        cover: "blue",
        symbol: "♫",
        src: item.sourceUrl,
        customUrl: true,
      };
      tracks.push(track);
      setTrack(tracks.length - 1, true);
      notice("Playing " + item.title);
      return;
    }
    if (typeof loadMusicEmbed === "function") {
      loadMusicEmbed(item.sourceUrl);
      notice(
        item.source.toUpperCase() +
          " opened. Use the provider's embedded controls; universal play/pause is not available for every embed.",
      );
    } else {
      notice(
        "Open this provider link in its official player: " + item.sourceUrl,
      );
    }
  }
  function move(delta) {
    if (!queue.length) {
      notice("Add a track first.");
      return;
    }
    queueIndex = (queueIndex + delta + queue.length) % queue.length;
    playQueueItem();
    renderQueue();
  }
  window.PULSE_QUEUE = {
    add,
    list: () => queue.map((item) => ({ ...item })),
    play: playQueueItem,
    next: () => move(1),
    previous: () => move(-1),
    clear: () => {
      queue.length = 0;
      queueIndex = -1;
      renderQueue();
      notice("Queue cleared.");
    },
  };
  document.getElementById("queue").onclick = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      if (window.PULSE_CURRENT_TRACK) add(window.PULSE_CURRENT_TRACK);
      else renderQueue();
    }
  };
  document.getElementById("pulseQueueClose").onclick = () => {
    panel.hidden = true;
  };
  document.getElementById("pulseQueuePrev").onclick = () => move(-1);
  document.getElementById("pulseQueueNext").onclick = () => move(1);
  document.getElementById("pulseQueuePlay").onclick = playQueueItem;
  document.getElementById("pulseQueueClear").onclick = () =>
    window.PULSE_QUEUE.clear();
  document.getElementById("sourceForm").addEventListener("submit", () => {
    window.setTimeout(() => {
      if (window.PULSE_CURRENT_TRACK) add(window.PULSE_CURRENT_TRACK);
    }, 0);
  });
  document.getElementById("rows").addEventListener("click", (event) => {
    const row = event.target.closest(".row");
    if (!row || event.target.closest("[data-like]")) return;
    const track = tracks.find((t) => t.id === Number(row.dataset.id));
    if (track) add(track);
  });
})();
