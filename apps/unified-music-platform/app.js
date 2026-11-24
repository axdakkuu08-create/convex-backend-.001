import { createTrack, isEligibleDuration } from "./core/track.js";

const $ = (id) => document.getElementById(id);
const audio = $("audio");
const state = { tracks: [], queue: [], currentId: null, view: "all", page: 1, pageSize: 30, objectUrls: new Map() };
const titles = { all:"All music", recent:"Recently added", played:"Most played", albums:"Albums", favorites:"Favorites" };

function formatTime(ms) {
  const seconds = Math.floor((Number(ms) || 0) / 1000);
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}
function currentTrack() { return state.tracks.find((track) => track.id === state.currentId) || null; }
function filteredTracks() {
  const query = $("search").value.trim().toLowerCase();
  let items = [...state.tracks];
  if (state.view === "recent") items.sort((a,b) => b.addedAt-a.addedAt);
  if (state.view === "played") items.sort((a,b) => b.playCount-a.playCount);
  if (state.view === "favorites") items = items.filter((track) => track.favorite);
  if (query) items = items.filter((track) => [track.title,track.artist,track.album].some((value) => value.toLowerCase().includes(query)));
  const sort = $("sort").value;
  if (sort === "title") items.sort((a,b) => a.title.localeCompare(b.title));
  if (sort === "artist") items.sort((a,b) => a.artist.localeCompare(b.artist));
  if (sort === "duration") items.sort((a,b) => a.durationMs-b.durationMs);
  if (sort === "plays") items.sort((a,b) => b.playCount-a.playCount);
  if (sort === "added" && !["recent","played"].includes(state.view)) items.sort((a,b) => b.addedAt-a.addedAt);
  return items;
}
function render() {
  const items = filteredTracks();
  $("page-title").textContent = "Your library";
  $("section-title").textContent = titles[state.view];
  $("section-kicker").textContent = state.view === "albums" ? "GROUPED COLLECTION" : "YOUR COLLECTION";
  $("track-count").textContent = items.length + (items.length === 1 ? " track" : " tracks");
  $("empty-state").hidden = items.length > 0;
  $("track-list").hidden = state.view === "albums" || !items.length;
  $("album-grid").hidden = state.view !== "albums" || !items.length;
  $("load-more").hidden = state.view === "albums" || items.length <= state.page * state.pageSize;
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  if (state.view === "albums") {
    const albums = new Map();
    items.forEach((track) => { const key = track.album + " — " + track.artist; albums.set(key, (albums.get(key) || 0) + 1); });
    $("album-grid").innerHTML = [...albums].map(([name,count]) => '<article class="album-card"><div class="album-art">♫</div><strong></strong><small>' + count + ' tracks</small></article>').join("");
    [...$("album-grid").children].forEach((node,index) => { node.querySelector("strong").textContent = [...albums.keys()][index]; });
    return;
  }
  const visible = items.slice(0, state.page * state.pageSize);
  $("track-list").replaceChildren(...visible.map((track) => {
    const row = document.createElement("article"); row.className = "track-row";
    const play = document.createElement("button"); play.className = "track-play"; play.textContent = track.id === state.currentId && !audio.paused ? "Ⅱ" : "▶"; play.setAttribute("aria-label","Play " + track.title); play.addEventListener("click",() => playTrack(track.id));
    const title = document.createElement("div"); const strong = document.createElement("strong"); strong.className = "track-title"; strong.textContent = track.title; const artist = document.createElement("small"); artist.className = "track-sub"; artist.textContent = track.artist; title.append(strong,artist);
    const album = document.createElement("small"); album.className = "track-album"; album.textContent = track.album;
    const duration = document.createElement("span"); duration.className = "track-duration"; duration.textContent = formatTime(track.durationMs);
    const heart = document.createElement("button"); heart.className = "heart" + (track.favorite ? " active" : ""); heart.textContent = track.favorite ? "♥" : "♡"; heart.setAttribute("aria-label",track.favorite ? "Remove favorite" : "Add favorite"); heart.addEventListener("click",() => { state.tracks = state.tracks.map((item) => item.id === track.id ? {...item,favorite:!item.favorite} : item); render(); updatePlayer(); });
    row.append(play,title,album,duration,heart); return row;
  }));
}
function updatePlayer() {
  const track = currentTrack();
  $("now-title").textContent = track?.title || "Nothing playing";
  $("now-artist").textContent = track?.artist || "Choose a track from your library";
  $("favorite-current").textContent = track?.favorite ? "♥" : "♡";
  $("favorite-current").classList.toggle("active",Boolean(track?.favorite));
  $("play").textContent = audio.paused ? "▶" : "Ⅱ";
  $("total").textContent = formatTime(track?.durationMs);
}
async function playTrack(id) {
  const track = state.tracks.find((item) => item.id === id); if (!track) return;
  const source = state.objectUrls.get(id); if (!source) return;
  if (state.currentId !== id) { state.currentId = id; audio.src = source; }
  try { await audio.play(); state.tracks = state.tracks.map((item) => item.id === id ? {...item,playCount:item.playCount+1} : item); }
  catch { $("playback-state").textContent = "PLAYBACK BLOCKED"; }
  updatePlayer(); render();
}
async function importFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("audio/")) continue;
    const url = URL.createObjectURL(file); const probe = new Audio(); probe.preload = "metadata"; probe.src = url;
    await new Promise((resolve) => {
      const done = () => { probe.removeAttribute("src"); probe.load(); resolve(); };
      probe.addEventListener("loadedmetadata", () => {
        const durationMs = Math.round(probe.duration * 1000);
        if (isEligibleDuration(durationMs)) {
          const track = createTrack({ id:"local:" + file.name + ":" + file.size + ":" + file.lastModified, title:file.name.replace(/\.[^.]+$/,""), artist:"Local audio", album:"Device files", durationMs, provider:"local", sourceId:file.name + ":" + file.size, locator:file.name, mimeType:file.type, addedAt:Date.now() });
          if (track && !state.tracks.some((item) => item.id === track.id)) { state.tracks.push(track); state.queue.push(track.id); state.objectUrls.set(track.id,url); return done(); }
        }
        URL.revokeObjectURL(url); done();
      }, {once:true});
      probe.addEventListener("error", () => { URL.revokeObjectURL(url); done(); }, {once:true});
    });
  }
  render();
}
$("file-picker").addEventListener("change",(event) => importFiles([...event.target.files]));
$("empty-file-picker").addEventListener("change",(event) => importFiles([...event.target.files]));
$("navigation").addEventListener("click",(event) => { const button = event.target.closest("[data-view]"); if (!button) return; state.view = button.dataset.view; state.page = 1; render(); });
$("search").addEventListener("input",() => { state.page = 1; render(); });
$("sort").addEventListener("change",render);
$("load-more").addEventListener("click",() => { state.page++; render(); });
$("play").addEventListener("click",() => { if (!currentTrack()) { if (state.queue.length) playTrack(state.queue[0]); return; } if (audio.paused) audio.play().catch(() => {}); else audio.pause(); updatePlayer(); });
$("next").addEventListener("click",() => { const index = state.queue.indexOf(state.currentId); const next = state.queue[(index+1+state.queue.length)%state.queue.length]; if (next) playTrack(next); });
$("previous").addEventListener("click",() => { const index = state.queue.indexOf(state.currentId); const previous = state.queue[(index-1+state.queue.length)%state.queue.length]; if (previous) playTrack(previous); });
$("favorite-current").addEventListener("click",() => { const track = currentTrack(); if (!track) return; state.tracks = state.tracks.map((item) => item.id === track.id ? {...item,favorite:!item.favorite} : item); render(); updatePlayer(); });
audio.addEventListener("play",updatePlayer); audio.addEventListener("pause",updatePlayer); audio.addEventListener("ended",() => $("next").click());
audio.addEventListener("timeupdate",() => { $("seek").value = audio.duration ? String(Math.round(audio.currentTime/audio.duration*1000)) : "0"; $("elapsed").textContent = formatTime(audio.currentTime*1000); });
$("seek").addEventListener("input",(event) => { if (audio.duration) audio.currentTime = audio.duration * Number(event.target.value)/1000; });
render(); updatePlayer();
