/* Unified discovery: country-aware iTunes metadata + full-length open-audio results. */
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("unifiedSearchForm");
  const input = $("unifiedQuery");
  const status = $("unifiedSearchStatus");
  const results = $("unifiedSearchResults");
  const countrySelect = $("musicCountry");
  const genreSelect = $("musicGenre");
  if (!form || !input || !status || !results) return;

  const defaults = { country: "IN", genre: "" };
  let preferences = defaults;
  try {
    preferences = { ...defaults, ...(JSON.parse(localStorage.getItem("pulse.prefs") || "{}")) };
  } catch (_) {}
  if (countrySelect) countrySelect.value = preferences.country;
  if (genreSelect) genreSelect.value = preferences.genre;

  let token = 0;
  let debounceTimer;
  let lastQuery = "";
  const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[char]));
  const duration = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) && value > 0
      ? Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0")
      : "";
  };
  const render = (item, index) => {
    const art = item.artwork
      ? '<img class="catalog-artwork" loading="lazy" src="' + esc(item.artwork) + '" alt="" />'
      : '<span class="catalog-artwork catalog-placeholder" aria-hidden="true">♫</span>';
    const action = item.audioUrl || item.preview
      ? '<button class="primary catalog-preview" type="button" data-catalog-index="' + index + '">' +
        (item.audioUrl ? "▶ Full track" : "▶ Preview") + "</button>"
      : '<a class="catalog-open" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">Open source ↗</a>';
    const rights = item.audioUrl
      ? '<small class="catalog-rights">' + esc(item.license || "No licence statement found; check the item page") +
        ' · <a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">Item & rights ↗</a></small>'
      : "";
    return '<article class="catalog-result">' + art +
      '<div class="catalog-copy"><strong>' + esc(item.title) + "</strong><small>" +
      esc(item.artist) + (item.album ? " · " + esc(item.album) : "") +
      (item.duration ? " · " + esc(item.duration) : "") +
      '</small><small class="catalog-source">' + esc(item.source) + "</small>" + rights +
      "</div>" + action + "</article>";
  };

  function savePreferences() {
    preferences = {
      country: countrySelect?.value || preferences.country || "IN",
      genre: genreSelect?.value || ""
    };
    try { localStorage.setItem("pulse.prefs", JSON.stringify(preferences)); } catch (_) {}
  }

  async function search(query) {
    const q = String(query || "").trim();
    if (q.length < 2) {
      status.textContent = "Enter at least two characters to search.";
      return;
    }
    lastQuery = q;
    const current = ++token;
    savePreferences();
    status.textContent = "Searching popular catalogue results and full-length open audio…";
    results.innerHTML = "";
    const country = encodeURIComponent(preferences.country || "IN");
    const genreTerm = preferences.genre ? " " + preferences.genre : "";
    const term = encodeURIComponent(q + genreTerm);
    const jobs = [
      fetch("https://itunes.apple.com/search?term=" + term +
        "&country=" + country + "&entity=song&limit=18&media=music", {
          headers: { Accept: "application/json" }
        }).then((response) => {
          if (!response.ok) throw new Error("Music metadata search unavailable");
          return response.json();
        }).then((data) => (data.results || []).map((track) => ({
          title: track.trackName || "Untitled track",
          artist: track.artistName || "Unknown artist",
          album: track.collectionName || "",
          artwork: track.artworkUrl100 ? track.artworkUrl100.replace("100x100bb", "300x300bb") : "",
          preview: track.previewUrl || "",
          url: track.trackViewUrl || track.collectionViewUrl || "https://music.apple.com/",
          source: "Apple/iTunes catalogue",
          duration: duration((track.trackTimeMillis || 0) / 1000),
          kind: "preview",
          genre: track.primaryGenreName || ""
        })).filter((track) => !preferences.genre ||
          track.genre.toLowerCase().includes(preferences.genre.toLowerCase()))),
      window.PulseArchive.search(q, 24, {
        genre: preferences.genre,
        countryName: preferences.country === "IN" ? "India" : ""
      }).then((items) => items.map((item) => ({
        title: item.title,
        artist: item.artist,
        album: item.year || "",
        artwork: "",
        preview: "",
        audioUrl: item.audioUrl,
        url: item.pageUrl,
        license: item.license,
        duration: duration(item.durationSeconds),
        source: "Internet Archive · direct open audio",
        kind: "archive"
      })))
    ];
    const settled = await Promise.allSettled(jobs);
    if (current !== token) return;
    const found = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    if (!found.length) {
      status.textContent = "No matching tracks were found, or the catalogues are temporarily unavailable. Try a broader title or change the genre.";
      return;
    }
    window.PulseCatalogResults = found;
    results.innerHTML = found.map(render).join("");
    const failed = settled.filter((result) => result.status === "rejected").length;
    status.textContent = found.length + " results · " +
      (failed ? "Some catalogues did not respond." : "Search completed across metadata and open-audio catalogues.") +
      " Commercial previews remain provider-limited; Archive audio is played directly when available.";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(debounceTimer);
    void search(input.value);
  });
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    if (input.value.trim().length < 2) return;
    debounceTimer = setTimeout(() => void search(input.value), 550);
  });
  [countrySelect, genreSelect].filter(Boolean).forEach((control) => {
    control.addEventListener("change", () => {
      savePreferences();
      if (lastQuery) void search(lastQuery);
    });
  });
  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-catalog-index]");
    if (!button) return;
    const item = window.PulseCatalogResults?.[Number(button.dataset.catalogIndex)];
    if (!item) return;
    const src = item.audioUrl || item.preview;
    if (src) window.dispatchEvent(new CustomEvent("pulse:play-catalog-track", {
      detail: {
        title: item.title, artist: item.artist, src, url: item.url,
        source: item.source, artwork: item.artwork || "", license: item.license || ""
      }
    }));
  });
})();
