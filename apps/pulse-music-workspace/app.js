const tracks = [];
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
let archiveItems = [];
let nativeLoadPromise = Promise.resolve(true);
let nativePlaybackActive = false;
let nativeDurationSeconds = 0;
let nativePositionSeconds = 0;
let nativeEndedHandled = false;
let nativeHandoffPromise = Promise.resolve();

function canUseNativeQueue() {
  return Boolean(
    window.PulseMedia3?.isNative &&
    tracks.length > 0 &&
    tracks.every((track) =>
      window.PulseMediaPolicy?.isHttpsAudioUrl(track.src) ||
      /^https:\/\//i.test(String(track.src || "")),
    ),
  );
}
function nativeQueueItems() {
  return tracks.map((track) => ({
    id: String(track.id),
    url: String(track.src),
    title: String(track.title || "Pulse audio"),
    artist: String(track.artist || "Unknown artist"),
  }));
}
function refreshNativeQueue(shouldResume = playing) {
  if (!nativePlaybackActive || !window.PulseMedia3)
    return Promise.resolve(false);
  const position = Math.max(0, nativePositionSeconds);
  nativeLoadPromise = window.PulseMedia3.setQueue(
    nativeQueueItems(),
    index,
    position,
    shuffleOn,
    repeatOn,
  )
    .then(() => (shouldResume ? window.PulseMedia3.play() : true))
    .catch((error) => {
      reportPlayback(
        "error",
        error?.message || "Android playback queue could not be updated.",
      );
      return false;
    });
  return nativeLoadPromise;
}
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
function fmt(n) {
  return Number.isFinite(n)
    ? Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0")
    : "0:00";
}
function list() {
  let a = [...tracks];
  if (view === "downloads") {
    a = (window.PulseOfflineMedia?.records?.() || []).map((record) => ({
      ...record,
      id: Number(record.id) || record.id,
      src: record.url,
      source: "Internet Archive",
      mood: "Offline",
      time: record.duration || "—",
      cover: "blue",
      symbol: "♫",
      customUrl: true,
    }));
  }
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
        (tracks[index] && tracks[index].id === t.id ? "playing" : "") +
        '" data-id="' +
        t.id +
        '"><div class="num"><button class="rowplay" aria-label="Play">' +
        (tracks[index] && tracks[index].id === t.id && playing
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
        "</span>" +
        (t.source
          ? '<small class="source-label">' +
            escapeHTML(
              t.source === "Apple/iTunes catalogue"
                ? "30-SEC PREVIEW"
                : String(t.source).includes("Internet Archive")
                  ? "OPEN AUDIO"
                  : t.source,
            ) +
            "</small>"
          : "") +
        '</div><div class="time">' +
        t.time +
        '</div><button class="rowlike ' +
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
  if (host === "open.spotify.com") {
    const spotifyPath = u.pathname.replace(
      /^\/intl-[a-z]{2}(?:-[a-z]{2})?\//i,
      "/",
    );
    const m = spotifyPath.match(
      /^\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)\/?$/,
    );
    if (!m)
      throw new Error(
        "Open a Spotify track, album, playlist, artist, or episode link.",
      );
    return {
      title: "Spotify · " + m[1],
      url:
        "https://open.spotify.com/embed/" +
        m[1] +
        "/" +
        m[2] +
        "?utm_source=generator",
      ratio: m[1] === "track" || m[1] === "episode" ? "compact" : "tall",
    };
  }
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
    "Supported sources: Spotify, YouTube / YouTube Music, and SoundCloud. For other audio, use ＋ File or ↗ Link.",
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

const queueStorage = window.PulseQueueStorage;
let queueReady = false;
let queueDirty = false;
function makeQueueSnapshot() {
  const stableTracks = tracks
    .filter((track) => track && /^https?:\/\//i.test(String(track.src || "")))
    .map((track) => ({
      id: track.id,
      catalogId: String(track.catalogId || ""),
      source: String(track.source || "Saved audio"),
      title: String(track.title || "Untitled track"),
      artist: String(track.artist || "Unknown artist"),
      mood: String(track.mood || "Playlist"),
      time: String(track.time || "—"),
      cover: String(track.cover || "violet"),
      symbol: String(track.symbol || "♫"),
      src: String(track.src),
      customUrl: true,
      artwork: String(track.artwork || ""),
      sourcePage: String(track.sourcePage || track.url || ""),
      archivePage: String(track.archivePage || ""),
      archiveLicense: String(track.archiveLicense || track.license || ""),
      sourceType:
        track.sourceType ||
        window.PulseMediaPolicy?.sourceType(track) ||
        "user_audio",
      licenseLabel:
        window.PulseMediaPolicy?.licenseLabel(track) ||
        String(track.archiveLicense || track.license || ""),
      sourcePage: String(track.sourcePage || track.archivePage || track.url || ""),
      verificationStatus: String(track.verificationStatus || "UNAVAILABLE"),
      rightsReviewStatus: String(track.rightsReviewStatus || "REVIEW_REQUIRED"),
      bytesTotal: Number(track.bytesTotal) || 0,
    }));
  const currentId = tracks[index]?.id ?? null;
  return {
    schemaVersion: 2,
    tracks: stableTracks,
    currentTrackId: stableTracks.some(
      (track) => String(track.id) === String(currentId),
    )
      ? currentId
      : null,
    currentIndex: stableTracks.findIndex(
      (track) => String(track.id) === String(currentId),
    ),
    repeatOn,
    shuffleOn,
    updatedAt: Date.now(),
  };
}
function persistQueue() {
  if (!queueReady) {
    queueDirty = true;
    return;
  }
  void queueStorage.save(makeQueueSnapshot()).catch(() => {
    if (typeof reportPlayback === "function")
      reportPlayback(
        "storage-error",
        "Queue could not be saved. Check browser storage.",
      );
  });
}
async function restoreQueue() {
  let snapshot = null;
  try {
    snapshot = await queueStorage.load();
  } catch (_) {}
  const changedBeforeRestore = queueDirty;
  const normalized = queueStorage.normalizeSnapshot(
    snapshot,
    (track) =>
      track &&
      (/^https?:\/\//i.test(String(track.src || "")) ||
        String(track.src || "").startsWith("blob:")),
  );
  if (!changedBeforeRestore && normalized) {
    const restored = normalized.tracks.map((track, queueIndex) => ({
      ...track,
      id: track.id ?? Date.now() + queueIndex,
      mood: track.mood || "Playlist",
      time: track.time || "—",
      cover: track.cover || "violet",
      symbol: track.symbol || "♫",
      customUrl: true,
      sourceType:
        track.sourceType ||
        window.PulseMediaPolicy?.sourceType(track) ||
        "user_audio",
      licenseLabel: String(track.licenseLabel || track.archiveLicense || ""),
      sourcePage: String(track.sourcePage || track.archivePage || ""),
    }));
    tracks.splice(0, tracks.length, ...restored);
    index = normalized.currentIndex;
    repeatOn = Boolean(normalized.repeatOn);
    shuffleOn = Boolean(normalized.shuffleOn);
  }
  queueReady = true;
  queueDirty = false;
  setTrack(tracks.length ? index : 0, false);
  renderQueuePanel();
  if (changedBeforeRestore) persistQueue();
}
function setTrack(i, autoplay = false) {
  if (!tracks.length) {
    if (nativePlaybackActive && window.PulseMedia3)
      window.PulseMedia3.pause().catch(() => {});
    nativePlaybackActive = false;
    nativeLoadPromise = Promise.resolve(false);
    index = 0;
    audio.removeAttribute("src");
    audio.load();
    $("nowTitle").textContent = "Choose a song";
    $("nowArtist").textContent = "Search or recognise a song";
    $("cover").className = "cover violet";
    $("cover").style.backgroundImage = "";
    $("cover").textContent = "♫";
    $("audioStatus").textContent = "Ready when you are · search for a single";
    $("duration").textContent = "0:00";
    $("time").textContent = "0:00";
    $("progress").value = 0;
    $("like").disabled = true;
    render();
    persistQueue();
    return;
  }
  $("like").disabled = false;
  index = (i + tracks.length) % tracks.length;
  let t = tracks[index];
  const wasNativePlayback = nativePlaybackActive;
  nativePlaybackActive = canUseNativeQueue();
  nativePositionSeconds = 0;
  nativeDurationSeconds = 0;
  nativeEndedHandled = false;
  if (nativePlaybackActive) {
    nativeHandoffPromise = Promise.resolve();
    audio.pause();
    nativeLoadPromise = window.PulseMedia3.setQueue(
      nativeQueueItems(),
      index,
      0,
      shuffleOn,
      repeatOn,
    ).catch((error) => {
      nativePlaybackActive = false;
      audio.src = t.src;
      audio.load();
      reportPlayback(
        "error",
        error?.message || "Android audio service could not load this track.",
      );
      return false;
    });
  } else if (wasNativePlayback && window.PulseMedia3) {
    const requestedSource = t.src;
    nativeHandoffPromise = window.PulseMedia3
      .pause()
      .catch(() => false)
      .then(() => {
        if (tracks[index]?.src !== requestedSource) return false;
        audio.src = requestedSource;
        audio.load();
        return true;
      });
  } else {
    nativeHandoffPromise = Promise.resolve();
    audio.src = t.src;
    audio.load();
  }
  $("audioStatus").textContent = t.archivePage
    ? "Open-audio source · rights review required; availability is not permission."
    : t.localFile
      ? "Playing a file selected from this device."
      : t.customUrl
        ? "Using your direct audio link."
        : "Ready to play.";
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
  persistQueue();
  if (autoplay) play();
}
function reportPlayback(state, message) {
  const current = tracks[index] || null;
  if (message) $("audioStatus").textContent = message;
  window.dispatchEvent(
    new CustomEvent("pulse:playback-report", {
      detail: {
        state,
        trackId: current?.id ?? null,
        title: current?.title || null,
        positionMs: Math.round(
          Math.max(
            0,
            nativePlaybackActive ? nativePositionSeconds : audio.currentTime,
          ) * 1000,
        ),
        durationMs: Math.round(
          Math.max(
            0,
            nativePlaybackActive ? nativeDurationSeconds : audio.duration,
          ) * 1000,
        ),
        updatedAt: Date.now(),
      },
    }),
  );
}

async function play() {
  if (!tracks.length || !tracks[index]) {
    playing = false;
    $("play").textContent = "▶";
    $("audioStatus").textContent =
      "Choose a song from search or your playlists.";
    return false;
  }
  try {
    if (nativePlaybackActive) {
      await nativeLoadPromise;
      if (nativePlaybackActive) await window.PulseMedia3.play();
      else await audio.play();
    } else {
      await nativeHandoffPromise;
      await audio.play();
    }
    playing = true;
    reportPlayback("playing", "Playing · " + (tracks[index]?.title || "Audio"));
    $("audioStatus").textContent = tracks[index].archivePage
      ? "Playing · " +
        tracks[index].title +
        " · rights status: " +
        (tracks[index].verificationStatus || "VERIFYING")
      : "Playing · " + tracks[index].title;
    $("play").textContent = "Ⅱ";
    if (!recent.includes(tracks[index].id)) recent.unshift(tracks[index].id);
    recent = recent.slice(0, 6);
    save();
    render();
    return true;
  } catch (e) {
    playing = false;
    $("play").textContent = "▶";
    const msg =
      e && e.name === "NotAllowedError"
        ? "Tap Play again to allow audio playback."
        : "Could not start this audio. Check the link or try another file.";
    reportPlayback("error", msg);
    toast(msg);
    return false;
  }
}
function pause() {
  if (nativePlaybackActive)
    window.PulseMedia3.pause().catch(() =>
      toast("Could not pause Android playback."),
    );
  else audio.pause();
  playing = false;
  $("play").textContent = "▶";
  reportPlayback(
    "paused",
    "Paused · " + (tracks[index]?.title || "No track selected"),
  );
  render();
}
function toggle() {
  playing ? pause() : play();
}
function next() {
  if (nativePlaybackActive) {
    window.PulseMedia3.next().catch(() =>
      toast("Could not skip to the next track."),
    );
    return;
  }
  const nextIndex = window.PulsePlaylistPlayback?.nextIndex?.(
    index,
    tracks.length,
    { shuffle: shuffleOn, repeat: repeatOn },
  );
  if (!Number.isInteger(nextIndex)) {
    audio.pause();
    playing = false;
    $("play").textContent = "▶";
    if (Number.isFinite(audio.duration)) audio.currentTime = 0;
    reportPlayback("ended", "Playlist finished.");
    render();
    return;
  }
  setTrack(nextIndex, true);
}
function like(id) {
  if (!tracks[index] || id == null) return;
  liked.has(id) ? liked.delete(id) : liked.add(id);
  save();
  $("like").textContent = liked.has(tracks[index].id) ? "♥" : "♡";
  $("like").classList.toggle("liked", liked.has(tracks[index].id));
  render();
}
function setView(v) {
  view = v;
  mood = "";
  $("crumb").textContent =
    v === "library"
      ? "Your library"
      : v === "recent"
        ? "Recently played"
        : v === "downloads"
          ? "Offline downloads"
          : "Discover";
  $("trackHeading").textContent =
    v === "library"
      ? "Saved tracks"
      : v === "recent"
        ? "Recently played"
        : v === "downloads"
          ? "Saved offline audio"
          : "Made for the moment";
  $("heading").innerHTML =
    v === "library"
      ? "Your music, <span>your rules.</span>"
      : v === "recent"
        ? "Pick up <span>where you left off.</span>"
        : "Find your <span>next favorite.</span>";
  document
    .querySelectorAll(".nav")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  render();
  $("sidebar").classList.remove("open");
}
$("rows").addEventListener("click", (e) => {
  let r = e.target.closest(".row");
  if (!r) return;
  const id = r.dataset.id;
  if (e.target.closest("[data-like]")) {
    like(id);
    return;
  }
  let targetIndex = tracks.findIndex((track) => String(track.id) === String(id));
  if (targetIndex < 0 && view === "downloads") {
    const saved = (window.PulseOfflineMedia?.records?.() || []).find(
      (record) => String(record.id) === String(id),
    );
    if (saved) {
      tracks.push({
        ...saved,
        id: Number(saved.id) || Date.now(),
        src: saved.url,
        source: "Internet Archive",
        mood: "Offline",
        time: saved.duration || "—",
        cover: "blue",
        symbol: "♫",
        customUrl: true,
      });
      targetIndex = tracks.length - 1;
    }
  }
  if (targetIndex >= 0) setTrack(targetIndex, true);
});
document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document.querySelectorAll("[data-mood]").forEach(
  (b) =>
    (b.onclick = () => {
      mood = b.dataset.mood;
      view = "discover";
      $("crumb").textContent = mood;
      $("trackHeading").textContent = mood + " selection";
      render();
      $("rows").scrollIntoView({ behavior: "smooth", block: "center" });
    }),
);
$("search").oninput = (e) => {
  query = e.target.value.trim();
  render();
};
$("play").onclick = toggle;
$("heroPlay").onclick = () => setTrack(0, true);
$("shuffleAll").onclick = () => {
  if (!tracks.length) {
    toast("Add a song before starting shuffle.");
    return;
  }
  shuffleOn = true;
  if (nativePlaybackActive) window.PulseMedia3.setShuffle(true).catch(() => {});
  toast("Shuffle is on");
  setTrack(Math.floor(Math.random() * tracks.length), true);
};
$("shuffle").onclick = () => {
  shuffleOn = !shuffleOn;
  if (nativePlaybackActive)
    window.PulseMedia3.setShuffle(shuffleOn).catch(() => {});
  toast(shuffleOn ? "Shuffle is on" : "Shuffle is off");
};
$("next").onclick = next;
$("prev").onclick = () => {
  const currentPosition = nativePlaybackActive
    ? nativePositionSeconds
    : audio.currentTime;
  if (currentPosition > 3) {
    if (nativePlaybackActive) window.PulseMedia3.seekTo(0).catch(() => {});
    else audio.currentTime = 0;
    return;
  }
  if (nativePlaybackActive) {
    window.PulseMedia3.previous().catch(() =>
      toast("Could not return to the previous track."),
    );
    return;
  }
  const previous = window.PulsePlaylistPlayback?.previousIndex?.(
    index,
    tracks.length,
    { repeat: repeatOn },
  );
  if (!Number.isInteger(previous)) return;
  setTrack(previous, true);
};
$("repeat").onclick = () => {
  repeatOn = !repeatOn;
  audio.loop = false;
  if (nativePlaybackActive)
    window.PulseMedia3.setRepeat(repeatOn).catch(() => {});
  toast(repeatOn ? "Repeat is on" : "Repeat is off");
};
$("like").onclick = () => like(tracks[index]?.id);
$("volume").oninput = (e) => {
  const volume = Number(e.target.value);
  if (nativePlaybackActive)
    window.PulseMedia3.setVolume(volume).catch(() => {});
  else audio.volume = volume;
};
audio.volume = 0.75;
audio.ontimeupdate = () => {
  if (
    !nativePlaybackActive &&
    Number.isFinite(audio.duration) &&
    audio.duration > 0
  ) {
    $("progress").value = (audio.currentTime / audio.duration) * 100;
    $("time").textContent = fmt(audio.currentTime);
    $("duration").textContent = fmt(audio.duration);
  }
};
$("progress").oninput = (e) => {
  if (nativePlaybackActive && nativeDurationSeconds > 0) {
    window.PulseMedia3.seekTo(
      (Number(e.target.value) / 100) * nativeDurationSeconds,
    ).catch(() => {});
  } else if (Number.isFinite(audio.duration)) {
    audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
  }
};
audio.onended = () => {
  if (!nativePlaybackActive) next();
};
audio.onwaiting = () => {
  reportPlayback(
    "buffering",
    "Loading audio… If it stays here, the link may not be a direct audio file.",
  );
};
audio.oncanplay = () => {
  if (!playing)
    reportPlayback("ready", "Audio ready · press Play if it has not started.");
};
audio.onerror = () => {
  if (nativePlaybackActive) return;
  playing = false;
  $("play").textContent = "▶";
  const msg =
    "Audio failed to load. Try a local file or a direct .mp3/.m4a/.ogg link; Spotify/YouTube page links will not work here.";
  reportPlayback("error", msg);
  toast("Audio could not load. Try another source.");
  render();
};
$("allMoods").onclick = () => {
  mood = "";
  query = "";
  $("search").value = "";
  render();
  toast("Showing all singles");
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
function renderQueuePanel() {
  const list = $("queueItems");
  if (!list) return;
  list.replaceChildren();
  tracks.forEach((track, queueIndex) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "queue-item-button";
    button.dataset.queueIndex = String(queueIndex);
    button.textContent =
      (queueIndex === index ? "▶ " : "") +
      String(track.title || "Untitled track") +
      " — " +
      String(track.artist || "Unknown artist");
    const actions = document.createElement("span");
    actions.className = "queue-item-controls";
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.disabled = queueIndex === 0;
    up.dataset.queueIndex = String(queueIndex);
    up.dataset.queueMove = String(queueIndex - 1);
    up.setAttribute("aria-label", "Move " + track.title + " up");
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.disabled = queueIndex === tracks.length - 1;
    down.dataset.queueIndex = String(queueIndex);
    down.dataset.queueMove = String(queueIndex + 1);
    down.setAttribute("aria-label", "Move " + track.title + " down");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.dataset.queueRemove = String(queueIndex);
    remove.setAttribute("aria-label", "Remove " + track.title + " from queue");
    actions.append(up, down, remove);
    item.append(button, actions);
    list.append(item);
  });
}
$("queue").onclick = () => {
  const panel = $("queuePanel");
  if (!panel) return;
  renderQueuePanel();
  panel.hidden = !panel.hidden;
};
$("queueClose")?.addEventListener("click", () => {
  $("queuePanel").hidden = true;
});
$("queueItems")?.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-queue-remove]");
  if (remove) {
    window.PulsePlayerBridge?.remove?.(Number(remove.dataset.queueRemove));
    return;
  }
  const move = event.target.closest("[data-queue-move]");
  if (move) {
    window.PulsePlayerBridge?.reorder?.(
      Number(move.dataset.queueIndex),
      Number(move.dataset.queueMove),
    );
    return;
  }
  const button = event.target.closest("[data-queue-index]");
  if (!button) return;
  const target = Number(button.dataset.queueIndex);
  if (!Number.isInteger(target) || !tracks[target]) return;
  setTrack(target, true);
  renderQueuePanel();
});
$("queuePrev")?.addEventListener("click", () => $("prev").click());
$("queueNext")?.addEventListener("click", () => $("next").click());
$("queueClear")?.addEventListener("click", () => {
  const current = tracks[index];
  if (!current) return;
  const wasPlaying = playing;
  tracks.splice(0, tracks.length, current);
  index = 0;
  if (nativePlaybackActive) setTrack(0, wasPlaying);
  render();
  renderQueuePanel();
  persistQueue();
  toast("Queue cleared");
});
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
    "Paste a direct audio file URL, such as an MP3 or M4A link. Spotify and YouTube page links are not direct audio files.",
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

$("archiveSearchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("archiveStatus");
  const results = $("archiveResults");
  const query = $("archiveQuery").value.trim();
  status.textContent = "Searching open audio and checking available files…";
  results.innerHTML = "";
  try {
    archiveItems = await window.PulseArchive.search(query, 24);
    window.PulseArchiveResults = archiveItems;
    if (!archiveItems.length) {
      status.textContent =
        "No playable audio files were found for that search. Try a broader title or artist.";
      return;
    }
    status.textContent =
      archiveItems.length +
      " playable audio item(s) found. Check each item's rights before reuse.";
    results.innerHTML = archiveItems
      .map(
        (item, i) =>
          '<article class="archive-result"><div><strong>' +
          escapeHTML(item.title) +
          "</strong><small>" +
          escapeHTML(item.artist) +
          (item.year ? " · " + escapeHTML(item.year) : "") +
          (item.durationSeconds ? " · " + fmt(item.durationSeconds) : "") +
          '</small><small class="archive-rights">' +
          (item.license
            ? "Rights/licence: " + escapeHTML(item.license)
            : "No licence statement found in metadata; check item page") +
          '</small><a href="' +
          escapeHTML(item.pageUrl) +
          '" target="_blank" rel="noopener noreferrer">View item & rights ↗</a></div>' +
          '<div class="archive-actions"><button class="primary archive-play" type="button" data-archive-index="' +
          i +
          '">▶ Play</button><button class="catalog-add" type="button" data-add-archive-index="' +
          i +
          '">＋ Playlist</button><button class="catalog-add" type="button" data-offline-archive-index="' +
          i +
          '">↓ Save offline</button></div></article>',
      )
      .join("");
  } catch (error) {
    status.textContent =
      error && error.message
        ? error.message
        : "Archive search failed. Please try again.";
  }
});
$("archiveResults").addEventListener("click", async (e) => {
  const offlineButton = e.target.closest("[data-offline-archive-index]");
  if (offlineButton) {
    const status = $("archiveStatus");
    const item = archiveItems[Number(offlineButton.dataset.offlineArchiveIndex)];
    if (!item) return;
    status.textContent = "Checking rights approval and saving audio…";
    try {
      await window.PulseOfflineMedia.download({
        id: Date.now(),
        title: item.title,
        artist: item.artist,
        src: item.audioUrl,
        source: "Internet Archive",
        sourceType: "internet_archive",
        catalogId: item.id,
        sourcePage: item.pageUrl,
        license: item.license,
        verificationStatus: item.verificationStatus || "VERIFYING",
        rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
        duration: item.durationSeconds ? fmt(item.durationSeconds) : "",
      });
      status.textContent = "Saved offline: " + item.title;
    } catch (error) {
      status.textContent = error?.message || "Offline save failed.";
    }
    return;
  }
  const button = e.target.closest("[data-archive-index]");
  if (!button) return;
  const item = archiveItems[Number(button.dataset.archiveIndex)];
  if (!item) return;
  const track = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title: item.title,
    artist: item.artist,
    mood: "Internet Archive",
    time: item.durationSeconds ? fmt(item.durationSeconds) : "—",
    cover: "blue",
    symbol: "♫",
    src: item.audioUrl,
    customUrl: true,
    archivePage: item.pageUrl,
    archiveLicense: item.license,
    licenseLabel: item.license || "",
    sourceType: "internet_archive",
    sourcePage: item.pageUrl,
    source: "Internet Archive",
    verificationStatus: item.verificationStatus || "VERIFYING",
    rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
    bytesTotal: Number(item.fileSize) || 0,
  };
  tracks.splice(index + 1, 0, track);
  setTrack(index + 1, true);
  toast("Playing selected single · next track stays in sequence");
});

window.addEventListener("pulse:play-catalog-track", (event) => {
  const item = event.detail || {};
  if (!item.src || !/^https?:/.test(item.src)) return;
  const track = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    catalogId: String(item.catalogId || item.id || ""),
    source: String(item.source || "Catalogue"),
    title: String(item.title || "Catalogue track"),
    artist: String(item.artist || "Unknown artist"),
    mood: item.source || "Catalogue",
    time:
      item.duration ||
      (item.source === "Apple/iTunes catalogue" ? "Preview" : "—"),
    cover: "violet",
    symbol: "♫",
    src: item.src,
    customUrl: true,
    artwork: item.artwork || "",
    sourcePage: item.url || "",
    archivePage: String(item.source || "").includes("Internet Archive")
      ? item.url || ""
      : "",
    archiveLicense: item.license || "",
    licenseLabel: item.license || "",
    sourceType:
      item.sourceType ||
      (String(item.source || "").includes("Internet Archive")
        ? "internet_archive"
        : String(item.source || "").includes("Apple/iTunes")
          ? "itunes_preview"
          : "user_audio"),
    sourcePage: String(item.url || ""),
    verificationStatus: item.verificationStatus || "UNAVAILABLE",
    rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
    bytesTotal: Number(item.bytesTotal) || 0,
  };
  tracks.splice(index + 1, 0, track);
  setTrack(index + 1, true);
  if (item.artwork) {
    $("cover").style.backgroundImage =
      'url("' + item.artwork.replace(/["\\]/g, "") + '")';
    $("cover").style.backgroundSize = "cover";
    $("cover").textContent = "";
  }
  $("audioStatus").textContent =
    item.source === "Apple/iTunes catalogue"
      ? "Playing the available catalogue preview. Open the provider page for full-track options."
      : "Open-audio status: " +
        track.verificationStatus +
        ". Rights review is separate; check the source page and licence.";
  toast("Loading " + track.title);
});

if (window.PulseMedia3?.isNative) {
  window.PulseMedia3.setVolume(0.75).catch(() => {});
  window.PulseMedia3.addStateListener((state) => {
    if (!state || !nativePlaybackActive) return;
    const mediaId = String(state.mediaId || "");
    const transitionedIndex = mediaId
      ? tracks.findIndex((track) => String(track.id) === mediaId)
      : -1;
    if (transitionedIndex >= 0 && transitionedIndex !== index) {
      index = transitionedIndex;
      const currentTrack = tracks[index];
      $("nowTitle").textContent = currentTrack.title;
      $("nowArtist").textContent = currentTrack.artist;
      $("cover").className = "cover " + currentTrack.cover;
      $("cover").textContent = currentTrack.symbol;
      $("like").textContent = liked.has(currentTrack.id) ? "♥" : "♡";
      $("like").classList.toggle("liked", liked.has(currentTrack.id));
      $("duration").textContent = currentTrack.time;
      $("time").textContent = "0:00";
      render();
      renderQueuePanel();
      persistQueue();
    }
    nativePositionSeconds = Math.max(0, Number(state.positionSeconds) || 0);
    nativeDurationSeconds = Math.max(0, Number(state.durationSeconds) || 0);
    if (nativeDurationSeconds > 0) {
      $("progress").value =
        (nativePositionSeconds / nativeDurationSeconds) * 100;
      $("time").textContent = fmt(nativePositionSeconds);
      $("duration").textContent = fmt(nativeDurationSeconds);
    }
    const isNowPlaying = Boolean(state.isPlaying);
    if (playing !== isNowPlaying) {
      playing = isNowPlaying;
      $("play").textContent = playing ? "Ⅱ" : "▶";
      render();
    }
    if (state.playbackState === 4 && !nativeEndedHandled) {
      nativeEndedHandled = true;
      playing = false;
      $("play").textContent = "▶";
      reportPlayback("ended", "Playlist finished.");
      render();
    } else if (state.playbackState !== 4) {
      nativeEndedHandled = false;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !nativePlaybackActive) return;
    window.PulseMedia3.getState()
      .then((state) => {
        if (!state) return;
        nativePositionSeconds = Math.max(0, Number(state.positionSeconds) || 0);
        nativeDurationSeconds = Math.max(0, Number(state.durationSeconds) || 0);
        playing = Boolean(state.isPlaying);
        $("play").textContent = playing ? "Ⅱ" : "▶";
        if (nativeDurationSeconds > 0) {
          $("progress").value =
            (nativePositionSeconds / nativeDurationSeconds) * 100;
          $("time").textContent = fmt(nativePositionSeconds);
          $("duration").textContent = fmt(nativeDurationSeconds);
        }
        render();
      })
      .catch(() => {});
  });
}

function playPlaylistQueue(playlistName, incomingTracks) {
  const normalized =
    window.PulsePlaylistPlayback?.buildQueue?.({ tracks: incomingTracks }) ||
    [];
  const queue = normalized.map((item, queueIndex) => {
    const source = String(item.source || "Saved audio");
    const isLocal = String(item.src || "").startsWith("blob:");
    return {
      id: Date.now() + queueIndex,
      catalogId: String(item.catalogId || ""),
      source,
      title: String(item.title || "Untitled track"),
      artist: String(item.artist || "Unknown artist"),
      mood: "Playlist",
      time: String(item.duration || "—"),
      cover: "violet",
      symbol: "♫",
      src: String(item.src),
      customUrl: !isLocal,
      localFile: isLocal,
      artwork: String(item.artwork || ""),
      sourcePage: String(item.url || ""),
      archivePage: source.includes("Internet Archive")
        ? String(item.url || "")
        : "",
      archiveLicense: String(item.license || ""),
      licenseLabel: String(item.license || ""),
      sourceType:
        item.sourceType ||
        (source.includes("Internet Archive")
          ? "internet_archive"
          : source.includes("Apple/iTunes")
            ? "itunes_preview"
            : "user_audio"),
      sourcePage: String(item.url || ""),
      verificationStatus: item.verificationStatus || "UNAVAILABLE",
      rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
      bytesTotal: Number(item.bytesTotal) || 0,
    };
  });
  if (!queue.length) {
    toast("This playlist has no playable songs.");
    return Promise.resolve(false);
  }
  tracks.splice(0, tracks.length, ...queue);
  index = 0;
  shuffleOn = false;
  setTrack(0, false);
  renderQueuePanel();
  toast(
    "Playing playlist · " +
      queue.length +
      " tracks in saved order · " +
      String(playlistName || "Singles Mix"),
  );
  return play();
}

window.PulsePlayerBridge = {
  playPlaylist: playPlaylistQueue,
  remove: (queueIndex) => {
    const oldCurrentIndex = index;
    const wasPlaying = playing;
    const result = window.PulsePlaylistPlayback?.removeTrackAt?.(
      tracks,
      index,
      queueIndex,
    );
    if (!result) return false;
    tracks.splice(0, tracks.length, ...result.tracks);
    index = result.currentIndex;
    if (!tracks.length || queueIndex === oldCurrentIndex) {
      setTrack(tracks.length ? index : 0, tracks.length > 0 && wasPlaying);
    } else {
      render();
      renderQueuePanel();
      persistQueue();
      if (nativePlaybackActive) void refreshNativeQueue(wasPlaying);
    }
    return true;
  },
  currentTrack: () => tracks[index] || null,
  isLiked: (id) => liked.has(id),
  reorder: (from, to) => {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= tracks.length ||
      to >= tracks.length ||
      from === to
    )
      return false;
    const [moved] = tracks.splice(from, 1);
    tracks.splice(to, 0, moved);
    if (index === from) index = to;
    else if (from < index && to >= index) index--;
    else if (from > index && to <= index) index++;
    render();
    renderQueuePanel();
    persistQueue();
    if (nativePlaybackActive) void refreshNativeQueue(playing);
    window.dispatchEvent(
      new CustomEvent("pulse:queue-reordered", { detail: { from, to } }),
    );
    return true;
  },
};

void restoreQueue();
