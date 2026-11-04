/* One unified Internet Archive mix: genuine catalogue metadata, artwork, and playlist. */
(() => {
  const form = document.getElementById("homeArchiveForm");
  const queryInput = document.getElementById("homeArchiveQuery");
  const resultsNode = document.getElementById("homeArchiveResults");
  const statusNode = document.getElementById("homeArchiveStatus");
  const mixButton = document.getElementById("homeArchiveMix");
  if (!form || !queryInput || !resultsNode || !statusNode || !mixButton) return;

  const MIX_NAME = "Internet Archive Mix";
  const preferences = () => {
    try { return JSON.parse(localStorage.getItem("pulse.prefs") || "{}"); }
    catch (_) { return {}; }
  };
  const duration = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return "Duration unavailable";
    return Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0");
  };
  const archiveIdentifier = (item) =>
    String(item.id || "").replace(/^archive:/, "").replace(/[^a-zA-Z0-9._-]/g, "");
  const artworkFor = (item) =>
    item.artwork || (archiveIdentifier(item)
      ? "https://archive.org/services/img/" + encodeURIComponent(archiveIdentifier(item))
      : "");
  let latest = [];

  function button(label, className, action) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    node.addEventListener("click", action);
    return node;
  }

  function makeTrackCard(item, index) {
    const card = document.createElement("article");
    card.className = "archive-mix-card";
    const art = document.createElement("div");
    art.className = "archive-mix-art";
    const image = document.createElement("img");
    image.loading = "lazy";
    image.alt = "";
    image.src = artworkFor(item);
    image.addEventListener("error", () => {
      image.remove();
      art.classList.add("archive-art-fallback");
      art.textContent = "♫";
    }, { once: true });
    art.append(image);

    const details = document.createElement("div");
    details.className = "archive-mix-copy";
    const title = document.createElement("strong");
    title.textContent = item.title || "Untitled Archive recording";
    const artist = document.createElement("span");
    artist.textContent = item.artist || "Creator not listed";
    const meta = document.createElement("small");
    meta.textContent = [item.year, duration(item.durationSeconds)]
      .filter(Boolean).join(" · ");
    const rights = document.createElement("span");
    rights.className = "archive-rights-state";
    rights.textContent = item.license
      ? "Rights statement found · review required"
      : "Rights not stated · review required";
    details.append(title, artist, meta, rights);

    const actions = document.createElement("div");
    actions.className = "archive-mix-card-actions";
    actions.append(
      button("▶", "archive-card-play", () => playTrack(item)),
      button("＋", "archive-card-save", () => saveTrack(item)),
    );
    const source = document.createElement("a");
    source.href = item.pageUrl || "https://archive.org/";
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "Archive item ↗";
    source.className = "archive-card-source";
    card.append(art, details, actions, source);
    return card;
  }

  function render(items, heading) {
    latest = items;
    resultsNode.replaceChildren();
    if (heading) {
      const label = document.createElement("p");
      label.className = "archive-mix-results-label";
      label.textContent = heading;
      resultsNode.append(label);
    }
    if (!items.length) return;
    const grid = document.createElement("div");
    grid.className = "archive-mix-grid";
    items.forEach((item, index) => grid.append(makeTrackCard(item, index)));
    resultsNode.append(grid);
  }

  function trackPayload(item) {
    return {
      title: item.title || "Untitled recording",
      artist: item.artist || "Unknown creator",
      src: item.audioUrl,
      url: item.pageUrl,
      artwork: artworkFor(item),
      license: item.license || "",
      source: "Internet Archive",
      catalogId: "archive:" + archiveIdentifier(item),
      duration: duration(item.durationSeconds),
      verificationStatus: item.verificationStatus || "VERIFYING",
      rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
      bytesTotal: Number(item.fileSize) || 0,
    };
  }

  function playTrack(item) {
    window.dispatchEvent(new CustomEvent("pulse:play-catalog-track", {
      detail: trackPayload(item),
    }));
  }
  function saveTrack(item) {
    window.dispatchEvent(new CustomEvent("pulse:add-track-to-playlist", {
      detail: trackPayload(item),
    }));
  }

  async function search(query, limit = 12) {
    const term = String(query || "").trim();
    if (term.length < 2) {
      statusNode.textContent = "Enter at least two characters.";
      return [];
    }
    if (!window.PulseArchive?.search) {
      statusNode.textContent = "Internet Archive search is unavailable in this build.";
      return [];
    }
    const prefs = preferences();
    statusNode.textContent = "Finding real Internet Archive recordings…";
    resultsNode.replaceChildren();
    try {
      const items = await window.PulseArchive.search(term, limit, {
        genre: prefs.genre || "",
        countryName: prefs.country === "IN" ? "India" : "",
        minDurationSeconds: 90,
      });
      render(items, "REAL INTERNET ARCHIVE RESULTS");
      statusNode.textContent = items.length
        ? items.length + " playable Archive candidates. Metadata is from the Archive; rights still need item-level review."
        : "No playable recordings found. Try another title, creator or genre.";
      return items;
    } catch (error) {
      statusNode.textContent = error?.message || "Archive search failed. Please try again.";
      return [];
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void search(queryInput.value);
  });

  mixButton.addEventListener("click", async () => {
    const prefs = preferences();
    const base = queryInput.value.trim() || prefs.genre || "ambient instrumental";
    const terms = [...new Set([
      base,
      prefs.genre ? prefs.genre + " instrumental" : "ambient instrumental",
      base + " live recording",
    ])];
    statusNode.textContent = "Curating one Internet Archive Mix from real recordings…";
    mixButton.disabled = true;
    try {
      const batches = await Promise.allSettled(terms.map((term) =>
        window.PulseArchive.search(term, 8, {
          genre: prefs.genre || "",
          countryName: prefs.country === "IN" ? "India" : "",
          minDurationSeconds: 120,
        }),
      ));
      const unique = new Map();
      batches.forEach((batch) => {
        if (batch.status !== "fulfilled") return;
        batch.value.forEach((item) => {
          if (item?.id && item.audioUrl && item.pageUrl && !unique.has(item.id))
            unique.set(item.id, item);
        });
      });
      const tracks = [...unique.values()].slice(0, 18);
      if (!tracks.length) {
        statusNode.textContent = "No suitable Archive recordings were found. Try a broader search.";
        return;
      }
      const playlist = window.PulsePlaylistStore?.createOrUpdateFromTracks?.(
        MIX_NAME,
        tracks.map(trackPayload),
      );
      if (!playlist) {
        statusNode.textContent = "Could not save the mix. Check local playlist storage and try again.";
        return;
      }
      render(tracks, "YOUR SINGLE, SAVED ARCHIVE MIX");
      const controls = document.createElement("div");
      controls.className = "archive-mix-playbar";
      const summary = document.createElement("span");
      summary.textContent = tracks.length + " real recordings · saved as one playlist";
      const play = button("▶ Play full mix", "archive-mix-play", () =>
        window.PulsePlaylistStore?.play?.(playlist.id),
      );
      controls.append(summary, play);
      resultsNode.prepend(controls);
      statusNode.textContent = "Updated your one Internet Archive Mix. Every track links back to its original Archive item; rights remain under review.";
      window.dispatchEvent(new CustomEvent("pulse:playlists-updated"));
    } catch (error) {
      statusNode.textContent = error?.message || "Could not build the Archive mix.";
    } finally {
      mixButton.disabled = false;
    }
  });

  window.addEventListener("pulse:preferences-changed", () => {
    if (queryInput.value.trim().length >= 2) void search(queryInput.value);
  });
})();