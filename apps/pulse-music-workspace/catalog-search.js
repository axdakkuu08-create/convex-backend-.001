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
    preferences = {
      ...defaults,
      ...JSON.parse(localStorage.getItem("pulse.prefs") || "{}"),
    };
  } catch (_) {}
  if (countrySelect) countrySelect.value = preferences.country;
  if (genreSelect) genreSelect.value = preferences.genre;

  let token = 0;
  let debounceTimer;
  let lastQuery = "";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
        })[char],
    );
  const duration = (seconds) => {
    const value = Number(seconds);
    return Number.isFinite(value) && value > 0
      ? Math.floor(value / 60) +
          ":" +
          String(Math.floor(value % 60)).padStart(2, "0")
      : "";
  };
  const render = (item, index) => {
    const art = item.artwork
      ? '<img class="catalog-artwork" loading="lazy" src="' +
        esc(item.artwork) +
        '" alt="" />'
      : '<span class="catalog-artwork catalog-placeholder" aria-hidden="true">♫</span>';
    const action =
      item.audioUrl || item.preview
        ? '<button class="primary catalog-preview" type="button" data-catalog-index="' +
          index +
          '">' +
          (item.verificationStatus === "VERIFIED_FULL" ? "▶ Full track" : item.verificationStatus === "VERIFYING" ? "▶ Check stream" : "▶ Preview") +
          "</button>"
        : '<a class="catalog-open" href="' +
          esc(item.url) +
          '" target="_blank" rel="noopener noreferrer">Open source ↗</a>';
    const rights = item.audioUrl
      ? '<small class="catalog-rights">' +
        esc(item.license || "No licence statement found; check the item page") + (item.rightsReviewStatus === "REVIEW_REQUIRED" ? " · Rights review required; URL availability is not permission" : "") +
        ' · <a href="' +
        esc(item.url) +
        '" target="_blank" rel="noopener noreferrer">Item & rights ↗</a></small>'
      : "";
    const add =
      '<button class="catalog-add" type="button" data-add-catalog-index="' +
      index +
      '">＋ Playlist</button>';
    return (
      '<article class="catalog-result">' +
      art +
      '<div class="catalog-copy"><strong>' +
      esc(item.title) +
      "</strong><small>" +
      esc(item.artist) +
      (item.album ? " · " + esc(item.album) : "") +
      (item.duration ? " · " + esc(item.duration) : "") +
      '</small><small class="catalog-source">' +
      esc(item.source) +
      "</small>" +
      rights +
      "</div>" +
      action +
      add +
      "</article>"
    );
  };

  function savePreferences() {
    preferences = {
      country: countrySelect?.value || preferences.country || "IN",
      genre: genreSelect?.value || "",
    };
    try {
      localStorage.setItem("pulse.prefs", JSON.stringify(preferences));
    } catch (_) {}
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
    status.textContent =
      "Searching popular catalogue results and full-length open audio…";
    results.innerHTML = "";
    const gateway = window.PULSE_CONFIG?.discoveryGatewayUrl;
    if (!gateway) {
      status.textContent = "Cloud discovery gateway is not configured yet.";
      return;
    }
    const params = new URLSearchParams({
      q,
      country: preferences.country || "IN",
      genre: preferences.genre || "",
      limit: "18",
      provider: "all",
    });
    try {
      const response = await fetch(gateway.replace(/\\/$/, "") + "/api/search?" + params, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Discovery gateway unavailable (" + response.status + ").");
      const payload = await response.json();
      if (current !== token) return;
      const found = (payload.tracks || []).map((track) => ({
        id: track.id,
        catalogId: track.catalogId || track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.artwork,
        preview: track.previewUrl,
        audioUrl: track.streamUrl,
        url: track.sourceUrl,
        license: track.license,
        duration: duration(track.duration),
        source: track.provider === "itunes" ? "Apple/iTunes catalogue" : "Internet Archive · direct open audio",
        kind: track.provider,
        genre: track.genre,
        verificationStatus: track.verificationStatus,
        rightsReviewStatus: track.rightsReviewStatus,
        bytesTotal: track.bytesTotal,
      }));
      if (!found.length) {
        status.textContent = "No matching tracks were found, or the catalogues are temporarily unavailable. Try a broader title or change the genre.";
        return;
      }
      window.PulseCatalogResults = found;
      results.innerHTML = found.map(render).join("");
      const failed = Object.values(payload.providerStatus || {}).some((value) => value !== "ok");
      status.textContent = found.length + " results · " +
        (failed ? "Some catalogues did not respond. " : "Search completed. ") +
        "Cache: " + (payload.cache || "MISS") + ". " +
        (payload.licensingNotice || "Review source rights separately.");
    } catch (error) {
      if (current !== token) return;
      status.textContent = error?.message || "Music discovery is temporarily unavailable.";
    }
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
      window.dispatchEvent(
        new CustomEvent("pulse:preferences-changed", {
          detail: { ...preferences },
        }),
      );
      if (lastQuery) void search(lastQuery);
    });
  });
  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-catalog-index]");
    if (!button) return;
    const item =
      window.PulseCatalogResults?.[Number(button.dataset.catalogIndex)];
    if (!item) return;
    const src = item.audioUrl || item.preview;
    if (src)
      window.dispatchEvent(
        new CustomEvent("pulse:play-catalog-track", {
          detail: {
            title: item.title,
            artist: item.artist,
            src,
            url: item.url,
            source: item.source,
            artwork: item.artwork || "",
            license: item.license || "",
            duration: item.duration || "",
            catalogId: item.catalogId || item.id || "",
            verificationStatus: item.verificationStatus || "UNAVAILABLE",
            rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
            bytesTotal: item.bytesTotal || 0,
          },
        }),
      );
  });
  results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-catalog-index]");
    if (!button) return;
    const item =
      window.PulseCatalogResults?.[Number(button.dataset.addCatalogIndex)];
    if (item)
      window.dispatchEvent(
        new CustomEvent("pulse:add-track-to-playlist", {
          detail: {
            title: item.title,
            artist: item.artist,
            src: item.audioUrl || item.preview,
            url: item.url,
            artwork: item.artwork || "",
            license: item.license || "",
            source: item.source,
            catalogId: item.catalogId || item.id || "",
            verificationStatus: item.verificationStatus || "UNAVAILABLE",
            rightsReviewStatus: item.rightsReviewStatus || "REVIEW_REQUIRED",
            bytesTotal: item.bytesTotal || 0,
          },
        }),
      );
  });
})();
