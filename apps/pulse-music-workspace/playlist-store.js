/* Local-first playlist creation, track saving and playback. */
(() => {
  const $ = (id) => document.getElementById(id);
  const container = $("savedPlaylists");
  const createButton = $("newPlaylist");
  const KEY = "pulse.localPlaylists.v1";
  if (!container || !createButton) return;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function write(playlists) {
    try { localStorage.setItem(KEY, JSON.stringify(playlists)); }
    catch (_) { alert("This device could not save the playlist. Check available browser storage."); }
    render();
  }
  function create(name) {
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean) return null;
    const playlists = read();
    const playlist = { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), name: clean, tracks: [], createdAt: Date.now() };
    playlists.push(playlist);
    write(playlists);
    return playlist;
  }
  function render() {
    container.replaceChildren();
    for (const playlist of read()) {
      const row = document.createElement("div");
      row.className = "local-playlist-row";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "local-playlist-open";
      open.textContent = playlist.name + " · " + (playlist.tracks || []).length;
      open.addEventListener("click", () => playFromPlaylist(playlist.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "local-playlist-delete";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Delete " + playlist.name);
      remove.addEventListener("click", () => {
        if (confirm('Delete local playlist "' + playlist.name + '"?')) {
          write(read().filter((item) => item.id !== playlist.id));
        }
      });
      row.append(open, remove);
      container.append(row);
    }
  }
  function choosePlaylist(track) {
    if (!track.src) {
      alert("This catalogue item has no browser-playable audio preview. Open its source page instead.");
      return;
    }
    let playlists = read();
    if (!playlists.length) {
      const name = prompt("Create your first playlist");
      if (!name) return;
      const created = create(name);
      if (!created) return;
      playlists = read();
    } else {
      const choices = playlists.map((item, index) => (index + 1) + ". " + item.name).join("\n");
      const answer = prompt("Add to which playlist? Enter a number, or type a new playlist name:\n" + choices);
      if (!answer) return;
      const number = Number(answer);
      if (Number.isInteger(number) && number >= 1 && number <= playlists.length) {
        // Use the selected existing playlist.
      } else {
        const created = create(answer);
        if (!created) return;
        playlists = read();
      }
    }
    playlists = read();
    const selectedNumber = Number(window.__pulsePlaylistChoice);
    const target = selectedNumber >= 1 && selectedNumber <= playlists.length
      ? playlists[selectedNumber - 1]
      : playlists[playlists.length - 1];
    const duplicate = target.tracks.some((item) => item.src === track.src);
    if (!duplicate) target.tracks.push({
      title: String(track.title || "Untitled track"),
      artist: String(track.artist || "Unknown artist"),
      src: track.src,
      url: track.url || "",
      artwork: track.artwork || "",
      license: track.license || "",
      source: track.source || "Saved audio"
    });
    write(playlists);
    const status = $("unifiedSearchStatus");
    if (status) status.textContent = (duplicate ? "Already saved in " : "Added to ") + target.name + ".";
  }
  function playFromPlaylist(id) {
    const playlist = read().find((item) => item.id === id);
    if (!playlist || !playlist.tracks.length) {
      alert("This playlist is empty. Add songs from search results.");
      return;
    }
    const choices = playlist.tracks.map((track, index) => (index + 1) + ". " + track.title + " — " + track.artist).join("\n");
    const answer = prompt("Choose a song number to play from " + playlist.name + ":\n" + choices);
    const index = Number(answer) - 1;
    const track = playlist.tracks[index];
    if (!track) return;
    window.dispatchEvent(new CustomEvent("pulse:play-catalog-track", { detail: {
      title: track.title, artist: track.artist, src: track.src, url: track.url,
      artwork: track.artwork, license: track.license, source: track.source
    }}));
  }

  createButton.onclick = () => {
    const name = prompt("Name your local playlist");
    if (name) create(name);
  };
  document.addEventListener("pulse:add-track-to-playlist", (event) => choosePlaylist(event.detail || {}));
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-archive-index]");
    if (!button) return;
    const item = window.PulseArchiveResults?.[Number(button.dataset.addArchiveIndex)];
    if (item) choosePlaylist({
      title: item.title, artist: item.artist, src: item.audioUrl, url: item.pageUrl,
      license: item.license, source: "Internet Archive"
    });
  });
  render();
  window.PulsePlaylistStore = { read, create, render };
})();
