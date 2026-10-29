import "./jamendo.css";

const root = document.getElementById("jamendoApp");
const clientId = String(import.meta.env.VITE_JAMENDO_CLIENT_ID || "").trim();
const API = "https://api.jamendo.com/v3.0";
let activeTab = "tracks";
let lastQuery = "";
let busy = false;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function status(message, kind = "") {
  root.innerHTML = '<p class="jamendo-status ' + kind + '" role="status">' + escapeHTML(message) + "</p>";
}

function shell() {
  root.innerHTML = `
    <div class="jamendo-controls">
      <div class="jamendo-tabs" role="tablist" aria-label="Jamendo catalogue">
        <button type="button" role="tab" data-jamendo-tab="tracks" aria-selected="true">Tracks</button>
        <button type="button" role="tab" data-jamendo-tab="playlists" aria-selected="false">Playlists</button>
        <button type="button" role="tab" data-jamendo-tab="artists" aria-selected="false">Artists</button>
      </div>
      <form id="jamendoSearchForm" class="jamendo-search">
        <label class="sr-only" for="jamendoQuery">Search Jamendo</label>
        <input id="jamendoQuery" type="search" maxlength="120" placeholder="Search tracks, artists, genres…" autocomplete="off">
        <button type="submit">Search</button>
      </form>
    </div>
    <div id="jamendoResults" class="jamendo-results" aria-live="polite"></div>
  `;
  root.querySelectorAll("[data-jamendo-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.jamendoTab;
      root.querySelectorAll("[data-jamendo-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
      const input = root.querySelector("#jamendoQuery");
      input.placeholder = activeTab === "tracks" ? "Search tracks, artists, genres…" : activeTab === "playlists" ? "Search public playlists…" : "Search artists…";
      runSearch(input.value.trim());
    });
  });
  root.querySelector("#jamendoSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(root.querySelector("#jamendoQuery").value.trim());
  });
}

async function request(entity, params = {}) {
  const url = new URL(API + "/" + entity + "/");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "12");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length) url.searchParams.set(key, String(value));
  });
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(response.status === 429 ? "Jamendo is rate-limiting requests. Please wait and retry." : "Jamendo request failed (" + response.status + ").");
  const data = await response.json();
  if (data?.headers?.status === "failed" || data?.headers?.error_message) {
    throw new Error(data.headers.error_message || "Jamendo could not complete that search.");
  }
  return Array.isArray(data?.results) ? data.results : [];
}

function artwork(url, label) {
  if (!url || !/^https:\/\//i.test(url)) return '<div class="jamendo-art jamendo-art--fallback" aria-hidden="true">♫</div>';
  return '<img class="jamendo-art" loading="lazy" src="' + escapeHTML(url) + '" alt="" referrerpolicy="no-referrer">';
}

function renderTracks(tracks) {
  const results = root.querySelector("#jamendoResults");
  if (!tracks.length) {
    results.innerHTML = '<p class="jamendo-status">No playable tracks matched. Try another search.</p>';
    return;
  }
  results.innerHTML = '<div class="jamendo-grid">' + tracks.map((track) => {
    const playable = typeof track.audio === "string" && /^https:\/\//i.test(track.audio);
    const license = track.license_ccurl ? '<a class="jamendo-license" href="' + escapeHTML(track.license_ccurl) + '" target="_blank" rel="noopener noreferrer">License ↗</a>' : "";
    return `<article class="jamendo-card">
      ${artwork(track.album_image || track.image, track.album_name || track.name)}
      <div class="jamendo-card-body">
        <strong title="${escapeHTML(track.name)}">${escapeHTML(track.name || "Untitled track")}</strong>
        <span>${escapeHTML(track.artist_name || "Unknown artist")}</span>
        <small>${escapeHTML(track.album_name || "Single")} · ${Math.max(0, Math.floor((Number(track.duration) || 0) / 60))} min</small>
        <div class="jamendo-card-actions">
          <button type="button" data-play-track="${escapeHTML(track.id)}" ${playable ? "" : "disabled"}>${playable ? "▶ Play in Pulse" : "Stream unavailable"}</button>
          ${license}
          <button type="button" class="jamendo-artist-link" data-artist-id="${escapeHTML(track.artist_id)}" data-artist-name="${escapeHTML(track.artist_name)}">Artist</button>
        </div>
      </div>
    </article>`;
  }).join("") + "</div>";
  results.querySelectorAll("[data-play-track]").forEach((button) => {
    button.addEventListener("click", () => {
      const track = tracks.find((item) => String(item.id) === button.dataset.playTrack);
      try {
        if (typeof window.pulsePlayExternalTrack !== "function") throw new Error("Pulse player bridge did not load. Refresh the page and try again.");
        window.pulsePlayExternalTrack(track);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start this track.";
        const note = document.createElement("p");
        note.className = "jamendo-status jamendo-status--error";
        note.textContent = message;
        results.prepend(note);
      }
    });
  });
  results.querySelectorAll("[data-artist-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = "artists";
      const input = root.querySelector("#jamendoQuery");
      input.value = button.dataset.artistName || "";
      root.querySelectorAll("[data-jamendo-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.jamendoTab === "artists")));
      runSearch(input.value.trim(), button.dataset.artistId);
    });
  });
}

function renderPlaylists(playlists) {
  const results = root.querySelector("#jamendoResults");
  if (!playlists.length) {
    results.innerHTML = '<p class="jamendo-status">No public playlists matched. Try a broader name.</p>';
    return;
  }
  results.innerHTML = '<div class="jamendo-grid">' + playlists.map((playlist) => `
    <article class="jamendo-card">
      ${artwork(playlist.image, playlist.name)}
      <div class="jamendo-card-body">
        <strong>${escapeHTML(playlist.name || "Untitled playlist")}</strong>
        <span>By ${escapeHTML(playlist.user_name || "Jamendo community")}</span>
        <small>Public playlist · ${Number(playlist.track_count) || "—"} tracks</small>
        <div class="jamendo-card-actions"><button type="button" data-open-playlist="${escapeHTML(playlist.id)}">Load tracks</button></div>
      </div>
    </article>`).join("") + "</div>";
  results.querySelectorAll("[data-open-playlist]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadPlaylist(button.dataset.openPlaylist);
    });
  });
}

function renderArtists(artists) {
  const results = root.querySelector("#jamendoResults");
  if (!artists.length) {
    results.innerHTML = '<p class="jamendo-status">No artists matched. Try a different name.</p>';
    return;
  }
  results.innerHTML = '<div class="jamendo-grid">' + artists.map((artist) => `
    <article class="jamendo-card jamendo-artist-card">
      ${artwork(artist.image, artist.name)}
      <div class="jamendo-card-body">
        <strong>${escapeHTML(artist.name || "Artist")}</strong>
        <span>Independent artist on Jamendo</span>
        ${artist.website && /^https:\/\//i.test(artist.website) ? '<a class="jamendo-license" href="' + escapeHTML(artist.website) + '" target="_blank" rel="noopener noreferrer">Official website ↗</a>' : ""}
        <div class="jamendo-card-actions"><button type="button" data-artist-tracks="${escapeHTML(artist.id)}">Explore tracks</button></div>
      </div>
    </article>`).join("") + "</div>";
  results.querySelectorAll("[data-artist-tracks]").forEach((button) => {
    button.addEventListener("click", async () => {
      activeTab = "tracks";
      root.querySelectorAll("[data-jamendo-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.jamendoTab === "tracks")));
      const resultsNode = root.querySelector("#jamendoResults");
      resultsNode.innerHTML = '<p class="jamendo-status">Loading artist tracks…</p>';
      try {
        const rows = await request("artists/tracks", { id: button.dataset.artistTracks, audioformat: "mp32", include: "licenses,musicinfo", limit: 12 });
        const tracks = rows.flatMap((row) => Array.isArray(row.tracks) ? row.tracks : []);
        renderTracks(tracks);
      } catch (error) {
        resultsNode.innerHTML = '<p class="jamendo-status jamendo-status--error">' + escapeHTML(error.message || "Could not load artist tracks.") + "</p>";
      }
    });
  });
}

async function loadPlaylist(id) {
  const results = root.querySelector("#jamendoResults");
  results.innerHTML = '<p class="jamendo-status">Loading playlist tracks…</p>';
  try {
    const rows = await request("playlists/tracks", { id, audioformat: "mp32", include: "licenses,musicinfo", limit: 30 });
    const tracks = rows.flatMap((row) => Array.isArray(row.tracks) ? row.tracks : []);
    if (tracks.length) {
      results.innerHTML = '<div class="jamendo-playlist-heading"><strong>' + escapeHTML(rows[0]?.name || "Playlist tracks") + '</strong><button type="button" id="jamendoBackToPlaylists">← Back to playlists</button></div><div id="jamendoPlaylistTracks"></div>';
      const host = results.querySelector("#jamendoPlaylistTracks");
      host.id = "jamendoResults";
      renderTracks(tracks);
      const back = root.querySelector("#jamendoBackToPlaylists");
      if (back) back.addEventListener("click", () => runSearch(lastQuery));
    } else {
      results.innerHTML = '<p class="jamendo-status">This playlist has no tracks available through the API.</p>';
    }
  } catch (error) {
    results.innerHTML = '<p class="jamendo-status jamendo-status--error">' + escapeHTML(error.message || "Could not load this playlist.") + "</p>";
  }
}

async function runSearch(query = "", artistId = "") {
  if (busy) return;
  lastQuery = query;
  busy = true;
  const results = root.querySelector("#jamendoResults");
  results.innerHTML = '<p class="jamendo-status">Searching Jamendo…</p>';
  try {
    if (activeTab === "tracks") {
      const params = { audioformat: "mp32", include: "licenses,musicinfo", limit: 12 };
      if (query) params.search = query;
      else params.featured = 1;
      renderTracks(await request("tracks", params));
    } else if (activeTab === "playlists") {
      const params = { limit: 12, order: "creationdate_desc" };
      if (query) params.namesearch = query;
      renderPlaylists(await request("playlists", params));
    } else {
      const params = { limit: 12 };
      if (artistId) params.id = artistId;
      else if (query) params.namesearch = query;
      renderArtists(await request("artists", params));
    }
  } catch (error) {
    results.innerHTML = '<p class="jamendo-status jamendo-status--error">' + escapeHTML(error instanceof Error ? error.message : "Jamendo is temporarily unavailable.") + '</p><button type="button" id="jamendoRetry">Try again</button>';
    root.querySelector("#jamendoRetry")?.addEventListener("click", () => runSearch(lastQuery, artistId));
  } finally {
    busy = false;
  }
}

if (!root) {
  // The source is optional on pages that do not include its mount point.
} else if (!clientId) {
  status("Jamendo is ready to configure. Add VITE_JAMENDO_CLIENT_ID to the Pulse frontend environment, then rebuild/redeploy. The ID is issued by Jamendo’s developer portal; no music or AI secret key belongs in the browser.", "jamendo-status--setup");
  const link = document.createElement("a");
  link.href = "https://developer.jamendo.com/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open Jamendo Developer Portal ↗";
  link.className = "jamendo-setup-link";
  root.append(link);
} else {
  shell();
  runSearch("");
}
