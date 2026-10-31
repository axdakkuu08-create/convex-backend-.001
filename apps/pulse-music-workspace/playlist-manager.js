/* Device-local playlist library for Internet Archive and other playable tracks. */
(function () {
  "use strict";

  const KEY = "pulse-playlists-v1";
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"]/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
        })[ch],
    );
  let activeId = "";

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value)
        ? value.filter((p) => p && typeof p.id === "string" && Array.isArray(p.tracks))
        : [];
    } catch (_) {
      return [];
    }
  }

  let playlists = load();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(playlists));
  }

  function active() {
    return playlists.find((p) => p.id === activeId) || null;
  }

  function render() {
    const sidebar = $("playlists");
    const cards = $("playlistCards");
    const target = $("playlistTarget");
    const detail = $("playlistDetail");
    if (!sidebar || !cards || !target || !detail) return;

    sidebar.replaceChildren();
    cards.replaceChildren();
    target.replaceChildren();

    if (!playlists.length) {
      const empty = document.createElement("p");
      empty.className = "playlist-hint";
      empty.textContent =
        "Create a playlist, then add songs from Archive search or the track list.";
      cards.append(empty);

      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Create a playlist first";
      target.append(option);
      target.disabled = true;
      detail.hidden = true;
      return;
    }

    target.disabled = false;
    for (const playlist of playlists) {
      const side = document.createElement("button");
      side.className = "playlist";
      side.type = "button";
      side.textContent = "♫  " + playlist.name;
      side.addEventListener("click", () => open(playlist.id));
      sidebar.append(side);

      const option = document.createElement("option");
      option.value = playlist.id;
      option.textContent = playlist.name;
      target.append(option);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "playlist-card";
      card.innerHTML =
        '<span class="playlist-art">♫</span><strong>' +
        esc(playlist.name) +
        "</strong><small>" +
        playlist.tracks.length +
        " song" +
        (playlist.tracks.length === 1 ? "" : "s") +
        "</small>";
      card.addEventListener("click", () => open(playlist.id));
      cards.append(card);
    }

    target.value =
      activeId && playlists.some((p) => p.id === activeId)
        ? activeId
        : playlists[0].id;
    if (activeId && !active()) activeId = "";
    if (active()) renderDetail();
    else detail.hidden = true;
  }

  function renderDetail() {
    const playlist = active();
    const detail = $("playlistDetail");
    if (!playlist || !detail) {
      if (detail) detail.hidden = true;
      return;
    }

    detail.hidden = false;
    $("playlistDetailTitle").textContent = playlist.name;
    $("playlistDetailCount").textContent = playlist.tracks.length + " SONGS";
    const rows = $("playlistSongRows");
    rows.replaceChildren();

    if (!playlist.tracks.length) {
      const p = document.createElement("p");
      p.className = "playlist-hint";
      p.textContent =
        "No songs yet. Search Internet Archive and tap ＋ Playlist.";
      rows.append(p);
      return;
    }

    playlist.tracks.forEach((track, index) => {
      const row = document.createElement("div");
      row.className = "playlist-song";

      const info = document.createElement("div");
      info.className = "playlist-song-info";
      const title = document.createElement("strong");
      title.textContent = track.title || "Untitled track";
      const artist = document.createElement("small");
      artist.textContent =
        (track.artist || "Unknown artist") +
        (track.source ? " · " + track.source : "");
      info.append(title, artist);

      const play = document.createElement("button");
      play.type = "button";
      play.className = "secondary";
      play.textContent = "▶";
      play.setAttribute("aria-label", "Play " + (track.title || "track"));
      play.addEventListener("click", () =>
        window.dispatchEvent(
          new CustomEvent("pulse:playlist-play", { detail: track }),
        ),
      );

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "textbutton";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        playlist.tracks.splice(index, 1);
        save();
        render();
      });

      row.append(info, play, remove);
      rows.append(row);
    });
  }

  function create(name) {
    const clean = String(name || "")
      .trim()
      .slice(0, 40);
    if (!clean) return;

    const playlist = {
      id:
        "pl-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 7),
      name: clean,
      tracks: [],
    };
    playlists.unshift(playlist);
    activeId = playlist.id;
    save();
    render();
    $("playlistTarget").value = playlist.id;
    toast("Created playlist: " + clean);
  }

  function add(track) {
    if (!track || !track.src || !/^https?:\/\//i.test(track.src)) {
      toast("This item has no reusable web audio URL.");
      return;
    }

    if (!playlists.length) {
      const name = prompt("Create a playlist for this song");
      if (!name || !name.trim()) return;
      create(name);
    }

    const selected = $("playlistTarget")?.value;
    const playlist =
      playlists.find((p) => p.id === selected) || active() || playlists[0];
    const identity = track.archiveId
      ? "archive:" + track.archiveId
      : track.jamendoId
        ? "jamendo:" + track.jamendoId
        : track.src;
    if (
      playlist.tracks.some(
        (t) =>
          (t.archiveId
            ? "archive:" + t.archiveId
            : t.jamendoId
              ? "jamendo:" + t.jamendoId
              : t.src) === identity,
      )
    ) {
      toast("That song is already in " + playlist.name + ".");
      return;
    }

    const stored = {};
    [
      "id",
      "title",
      "artist",
      "mood",
      "time",
      "cover",
      "symbol",
      "src",
      "sourceUrl",
      "source",
      "archiveId",
      "jamendoId",
      "artworkUrl",
      "licenseUrl",
      "rights",
      "year",
      "format",
    ].forEach((key) => {
      if (track[key] !== undefined && track[key] !== null) {
        stored[key] = track[key];
      }
    });
    playlist.tracks.push(stored);
    activeId = playlist.id;
    save();
    render();
    toast("Added to " + playlist.name);
  }

  function open(id) {
    activeId = id;
    render();
    $("playlistDetail")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  $("newPlaylist").onclick = () => {
    const name = prompt("Name your playlist");
    if (name) create(name);
  };
  $("playlistCreateButton").addEventListener("click", () => {
    const input = $("playlistNameInput");
    create(input.value);
    input.value = "";
  });
  $("playlistNameInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("playlistCreateButton").click();
    }
  });
  $("playlistPlayAll").addEventListener("click", () => {
    const playlist = active();
    if (playlist?.tracks.length) {
      window.dispatchEvent(
        new CustomEvent("pulse:playlist-start", { detail: playlist.tracks }),
      );
    } else {
      toast("Add songs to this playlist first.");
    }
  });
  $("playlistDelete").addEventListener("click", () => {
    const playlist = active();
    if (!playlist || !confirm('Delete playlist "' + playlist.name + '"?')) {
      return;
    }
    playlists = playlists.filter((p) => p.id !== playlist.id);
    activeId = "";
    save();
    render();
    toast("Playlist deleted.");
  });

  window.PULSE_PLAYLISTS = Object.freeze({
    add,
    create,
    list: () =>
      playlists.map((p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({ ...t })),
      })),
    open,
  });
  render();

  function toast(message) {
    const node = $("toast");
    if (node) {
      node.textContent = message;
      node.classList.add("show");
    }
  }
})();
