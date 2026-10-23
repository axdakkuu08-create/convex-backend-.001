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
function setTrack(i, autoplay = false) {
  index = (i + tracks.length) % tracks.length;
  let t = tracks[index];
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
  let n = shuffleOn ? Math.floor(Math.random() * tracks.length) : index + 1;
  if (n >= tracks.length && !repeatOn) {
    pause();
    audio.currentTime = 0;
    return;
  }
  setTrack(n, true);
}
function like(id) {
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
  let id = Number(r.dataset.id);
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
  setTrack(index - 1, true);
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
audio.onerror = () => {
  playing = false;
  $("play").textContent = "▶";
  const msg =
    "Audio failed to load. Try a local file or a direct .mp3/.m4a/.ogg link; Spotify/YouTube page links will not work here.";
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
$("queue").onclick = () =>
  toast("Queue: " + tracks.map((t) => t.title).join(" · "));
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
setTrack(0);
