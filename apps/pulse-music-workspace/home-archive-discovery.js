/* Home discovery shelf: curated Internet Archive searches and local auto-mixes. */
(() => {
  const form = document.getElementById("homeArchiveForm");
  const queryInput = document.getElementById("homeArchiveQuery");
  const resultsNode = document.getElementById("homeArchiveResults");
  const statusNode = document.getElementById("homeArchiveStatus");
  const mixButton = document.getElementById("homeArchiveMix");
  if (!form || !queryInput || !resultsNode || !statusNode || !mixButton) return;

  const preferences = () => {
    try {
      return JSON.parse(localStorage.getItem("pulse.prefs") || "{}");
    } catch (_) {
      return {};
    }
  };
  const duration = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return "";
    return (
      Math.floor(value / 60) +
      ":" +
      String(Math.floor(value % 60)).padStart(2, "0")
    );
  };
  let latest = [];

  function makeButton(label, action, item) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => action(item));
    return button;
  }

  function render(items) {
    latest = items;
    resultsNode.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("article");
      row.className = "home-archive-result";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.title || "Untitled recording";
      const metadata = document.createElement("small");
      metadata.textContent = [
        item.artist || "Unknown artist",
        item.year,
        duration(item.durationSeconds),
      ]
        .filter(Boolean)
        .join(" · ");
      const rights = document.createElement("small");
      rights.textContent = item.license
        ? "Rights statement: " + item.license
        : "No licence statement found in metadata; check the item page.";
      const link = document.createElement("a");
      link.href = item.pageUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Item & rights ↗";
      copy.append(title, metadata, rights, link);

      const actions = document.createElement("div");
      actions.className = "home-archive-actions";
      actions.append(
        makeButton(
          "▶ Play",
          (track) => {
            window.dispatchEvent(
              new CustomEvent("pulse:play-catalog-track", {
                detail: {
                  title: track.title,
                  artist: track.artist,
                  src: track.audioUrl,
                  url: track.pageUrl,
                  license: track.license || "",
                  source: "Internet Archive",
                  catalogId: "archive:" + track.id,
                  duration: duration(track.durationSeconds),
                },
              }),
            );
          },
          item,
        ),
        makeButton(
          "＋ Save",
          (track) => {
            window.dispatchEvent(
              new CustomEvent("pulse:add-track-to-playlist", {
                detail: {
                  title: track.title,
                  artist: track.artist,
                  src: track.audioUrl,
                  url: track.pageUrl,
                  license: track.license || "",
                  source: "Internet Archive",
                  catalogId: "archive:" + track.id,
                },
              }),
            );
          },
          item,
        ),
      );
      row.append(copy, actions);
      resultsNode.append(row);
    });
    if (!items.length)
      statusNode.textContent =
        "No playable recordings found. Try another artist, title or genre.";
  }

  async function search(query, limit = 12) {
    const term = String(query || "").trim();
    if (term.length < 2) {
      statusNode.textContent = "Enter at least two characters.";
      return [];
    }
    if (!window.PulseArchive?.search) {
      statusNode.textContent =
        "Internet Archive search is not available in this build.";
      return [];
    }
    const prefs = preferences();
    statusNode.textContent =
      "Searching Internet Archive for playable recordings…";
    resultsNode.replaceChildren();
    try {
      const items = await window.PulseArchive.search(term, limit, {
        genre: prefs.genre || "",
        countryName: prefs.country === "IN" ? "India" : "",
        minDurationSeconds: 90,
      });
      render(items);
      statusNode.textContent = items.length
        ? items.length +
          " playable result(s). Audio availability does not establish reuse rights; check each item page."
        : "No playable recordings found. Try another search.";
      return items;
    } catch (error) {
      statusNode.textContent =
        error?.message || "Archive search failed. Please try again.";
      return [];
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void search(queryInput.value);
  });

  mixButton.addEventListener("click", async () => {
    const prefs = preferences();
    const base =
      queryInput.value.trim() || prefs.genre || "ambient instrumental";
    const terms = [
      ...new Set([
        base,
        prefs.genre ? prefs.genre + " instrumental" : "ambient instrumental",
        base + " live recording",
      ]),
    ];
    statusNode.textContent =
      "Building a varied Archive mix from multiple searches…";
    mixButton.disabled = true;
    try {
      const batches = await Promise.allSettled(
        terms.map((term) =>
          window.PulseArchive.search(term, 8, {
            genre: prefs.genre || "",
            countryName: prefs.country === "IN" ? "India" : "",
            minDurationSeconds: 120,
          }),
        ),
      );
      const unique = new Map();
      batches.forEach((batch) => {
        if (batch.status !== "fulfilled") return;
        batch.value.forEach((item) => {
          if (item?.id && item.audioUrl && !unique.has(item.id))
            unique.set(item.id, item);
        });
      });
      const tracks = [...unique.values()].slice(0, 24);
      if (!tracks.length) {
        statusNode.textContent =
          "No suitable recordings were found for an automatic mix. Try a broader search.";
        return;
      }
      const playlistName = "Archive Mix · " + base.slice(0, 32);
      const playlist = window.PulsePlaylistStore?.createFromTracks(
        playlistName,
        tracks.map((item) => ({
          title: item.title,
          artist: item.artist,
          src: item.audioUrl,
          catalogId: "archive:" + item.id,
          url: item.pageUrl,
          license: item.license || "",
          source: "Internet Archive",
        })),
      );
      if (!playlist) {
        statusNode.textContent =
          "The mix could not be saved. Check browser storage and try again.";
        return;
      }
      render(tracks);
      statusNode.textContent =
        'Created "' +
        playlist.name +
        '" with ' +
        tracks.length +
        " recordings in local storage. Check each item's rights before reuse.";
    } catch (error) {
      statusNode.textContent =
        error?.message || "Could not create the Archive mix.";
    } finally {
      mixButton.disabled = false;
    }
  });

  window.addEventListener("pulse:preferences-changed", () => {
    if (queryInput.value.trim().length >= 2) void search(queryInput.value);
  });
})();
