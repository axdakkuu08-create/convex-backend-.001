/* Tempus-inspired player surface and queue interactions over Pulse's existing player engine. */
(() => {
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  if (!audio) return;

  const overlay = document.createElement("section");
  overlay.className = "tempus-player-overlay";
  overlay.id = "tempusPlayerOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Now playing");
  overlay.innerHTML = `
    <div class="tempus-player-top"><span>NOW PLAYING</span><button type="button" id="tempusPlayerClose" aria-label="Close player">⌄</button></div>
    <div class="tempus-player-art" id="tempusPlayerArt">♫</div>
    <div class="tempus-player-meta"><h2 id="tempusPlayerTitle">Choose a track</h2><p id="tempusPlayerArtist">Pulse Music</p><span class="tempus-player-source" id="tempusPlayerSource">PULSE PLAYER</span><p class="tempus-player-rights" id="tempusPlayerRights">Provider labels and source information stay attached to the current track.</p></div>
    <div class="tempus-player-seek"><input id="tempusPlayerSeek" type="range" min="0" max="100" value="0" aria-label="Seek"><div class="tempus-player-times"><span id="tempusPlayerElapsed">0:00</span><span id="tempusPlayerDuration">0:00</span></div></div>
    <div class="tempus-player-controls"><button type="button" id="tempusPlayerShuffle" aria-label="Shuffle">⤨</button><button type="button" id="tempusPlayerPrev" aria-label="Previous">|◀</button><button type="button" class="big-play" id="tempusPlayerPlay" aria-label="Play">▶</button><button type="button" id="tempusPlayerNext" aria-label="Next">▶|</button><button type="button" id="tempusPlayerRepeat" aria-label="Repeat">↻</button></div>
    <div class="tempus-player-actions"><button type="button" id="tempusPlayerLike">♡ Like</button><button type="button" id="tempusPlayerQueue">☷ Queue</button><button type="button" id="tempusPlayerSourceLink">↗ Source</button></div>`;
  document.body.append(overlay);

  const fmt = (value) => Number.isFinite(value) && value >= 0
    ? Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0") : "0:00";
  const currentTrack = () => window.PulsePlayerBridge?.currentTrack?.() || null;
  const open = () => { overlay.classList.add("open"); update(); };
  const close = () => overlay.classList.remove("open");
  const update = () => {
    const track = currentTrack();
    if (!track) return;
    $("tempusPlayerTitle").textContent = track.title || "Untitled";
    $("tempusPlayerArtist").textContent = track.artist || "Unknown artist";
    const source = String(track.source || (track.archivePage ? "Internet Archive" : "Pulse audio"));
    $("tempusPlayerSource").textContent = source.includes("Apple") || source.includes("iTunes")
      ? "ITUNES · 30-SECOND PREVIEW"
      : source.includes("Archive") ? "INTERNET ARCHIVE · CHECK ITEM RIGHTS" : source.toUpperCase();
    const rights = $("tempusPlayerRights");
    rights.textContent = track.archivePage
      ? "Rights vary by item. Check the Internet Archive item page before reuse."
      : source.includes("Apple") || source.includes("iTunes")
        ? "This provider supplies a short preview, not a full-length track."
        : "Playback and availability are controlled by the selected source.";
    if (track.archivePage || track.sourcePage || track.url) {
      const link = track.archivePage || track.sourcePage || track.url;
      rights.innerHTML = "";
      rights.append(document.createTextNode(track.archivePage
        ? "Rights vary by item. " : "Open the provider source. "));
      const anchor = document.createElement("a");
      anchor.href = link; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
      anchor.textContent = track.archivePage ? "View item & rights ↗" : "Open source ↗";
      rights.append(anchor);
    }
    const art = $("tempusPlayerArt");
    art.replaceChildren();
    if (track.artwork) {
      const image = document.createElement("img"); image.src = track.artwork; image.alt = ""; art.append(image);
    } else { art.textContent = track.symbol || "♫"; }
    $("tempusPlayerPlay").textContent = audio.paused ? "▶" : "Ⅱ";
    $("tempusPlayerElapsed").textContent = fmt(audio.currentTime);
    $("tempusPlayerDuration").textContent = fmt(audio.duration || 0);
    $("tempusPlayerSeek").value = audio.duration ? audio.currentTime / audio.duration * 100 : 0;
    $("tempusPlayerLike").textContent = track && window.PulsePlayerBridge?.isLiked?.(track.id) ? "♥ Liked" : "♡ Like";
  };

  document.querySelector(".player .now")?.addEventListener("click", (event) => {
    if (event.target.closest("#like")) return;
    open();
  });
  $("tempusPlayerClose").onclick = close;
  $("tempusPlayerPlay").onclick = () => $("play")?.click();
  $("tempusPlayerPrev").onclick = () => $("prev")?.click();
  $("tempusPlayerNext").onclick = () => $("next")?.click();
  $("tempusPlayerShuffle").onclick = () => $("shuffle")?.click();
  $("tempusPlayerRepeat").onclick = () => $("repeat")?.click();
  $("tempusPlayerLike").onclick = () => $("like")?.click();
  $("tempusPlayerQueue").onclick = () => { close(); $("queue")?.click(); };
  $("tempusPlayerSourceLink").onclick = () => {
    const track = currentTrack();
    const url = track?.archivePage || track?.sourcePage || track?.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  $("tempusPlayerSeek").oninput = (event) => {
    if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number(event.target.value) / 100;
  };
  audio.addEventListener("timeupdate", update);
  audio.addEventListener("play", update);
  audio.addEventListener("pause", update);
  audio.addEventListener("loadedmetadata", update);
  window.addEventListener("pulse:play-catalog-track", () => setTimeout(update, 0));

  // The existing queue is the player's ordered track list. Add touch-friendly reorder affordances
  // without replacing the provider search, playlist, or cloud-sync modules.
  const queueItems = $("queueItems");
  if (queueItems) {
    let dragged = -1;
    const decorate = () => {
      [...queueItems.children].forEach((item, index) => {
        item.draggable = true;
        item.dataset.queueIndex = String(index);
      });
    };
    new MutationObserver(decorate).observe(queueItems, { childList: true });
    queueItems.addEventListener("dragstart", (event) => {
      const item = event.target.closest("li");
      if (!item) return;
      dragged = Number(item.dataset.queueIndex);
      item.classList.add("queue-dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    queueItems.addEventListener("dragend", () => {
      queueItems.querySelectorAll(".queue-dragging,.queue-drop-target").forEach((item) =>
        item.classList.remove("queue-dragging", "queue-drop-target"));
      dragged = -1;
    });
    queueItems.addEventListener("dragover", (event) => {
      const item = event.target.closest("li");
      if (!item || dragged < 0) return;
      event.preventDefault();
      queueItems.querySelectorAll(".queue-drop-target").forEach((node) => node.classList.remove("queue-drop-target"));
      item.classList.add("queue-drop-target");
    });
    queueItems.addEventListener("drop", (event) => {
      const item = event.target.closest("li");
      if (!item || dragged < 0) return;
      event.preventDefault();
      const target = Number(item.dataset.queueIndex);
      window.PulsePlayerBridge?.reorder?.(dragged, target);
      dragged = -1;
    });
  }
  update();
})();
