/* Unified discovery: iTunes metadata/artwork + open-audio results. */
(() => {
  const $ = (id) => document.getElementById(id),
    form = $("unifiedSearchForm"),
    input = $("unifiedQuery"),
    status = $("unifiedSearchStatus"),
    results = $("unifiedSearchResults");
  if (!form || !input || !status || !results) return;
  let token = 0;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const render = (item, i) => {
    const art = item.artwork
      ? '<img class="catalog-artwork" loading="lazy" src="' +
        esc(item.artwork) +
        '" alt="" />'
      : '<span class="catalog-artwork catalog-placeholder" aria-hidden="true">♫</span>';
    const action = item.preview
      ? '<button class="primary catalog-preview" type="button" data-catalog-index="' +
        i +
        '">▶ Preview</button>'
      : '<a class="catalog-open" href="' +
        esc(item.url) +
        '" target="_blank" rel="noopener noreferrer">Open source ↗</a>';
    return (
      '<article class="catalog-result">' +
      art +
      '<div class="catalog-copy"><strong>' +
      esc(item.title) +
      "</strong><small>" +
      esc(item.artist) +
      (item.album ? " · " + esc(item.album) : "") +
      '</small><small class="catalog-source">' +
      esc(item.source) +
      "</small></div>" +
      action +
      "</article>"
    );
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q.length < 2) {
      status.textContent = "Enter at least two characters to search.";
      return;
    }
    const current = ++token;
    status.textContent = "Searching music catalogues…";
    results.innerHTML = "";
    const jobs = [
      fetch(
        "https://itunes.apple.com/search?term=" +
          encodeURIComponent(q) +
          "&entity=song&limit=12&media=music",
        { headers: { Accept: "application/json" } },
      )
        .then((r) => {
          if (!r.ok) throw Error("metadata search unavailable");
          return r.json();
        })
        .then((d) =>
          (d.results || []).map((t) => ({
            title: t.trackName || "Untitled track",
            artist: t.artistName || "Unknown artist",
            album: t.collectionName || "",
            artwork: t.artworkUrl100
              ? t.artworkUrl100.replace("100x100bb", "300x300bb")
              : "",
            preview: t.previewUrl || "",
            url:
              t.trackViewUrl ||
              t.collectionViewUrl ||
              "https://music.apple.com/",
            source: "Apple/iTunes catalogue",
            kind: "preview",
          })),
        ),
      window.PulseArchive.search(q, 8).then((items) =>
        items.map((x) => ({
          title: x.title,
          artist: x.artist,
          album: x.year || "",
          artwork: "",
          preview: "",
          url: x.pageUrl,
          audioUrl: x.audioUrl,
          license: x.license,
          source: "Internet Archive · open audio",
          kind: "archive",
        })),
      ),
    ];
    const settled = await Promise.allSettled(jobs);
    if (current !== token) return;
    const found = settled.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );
    if (!found.length) {
      status.textContent =
        "No results found, or music search is temporarily unavailable. Try another query.";
      return;
    }
    window.PulseCatalogResults = found;
    results.innerHTML = found.map(render).join("");
    status.textContent =
      found.length +
      " results from " +
      (settled.every((r) => r.status === "fulfilled")
        ? "music metadata and open-audio catalogues."
        : "available catalogues. Some sources did not respond.");
  });
  results.addEventListener("click", (e) => {
    const b = e.target.closest("[data-catalog-index]");
    if (!b) return;
    const item = window.PulseCatalogResults?.[Number(b.dataset.catalogIndex)];
    if (!item) return;
    if (item.preview || item.audioUrl)
      window.dispatchEvent(
        new CustomEvent("pulse:play-catalog-track", {
          detail: {
            title: item.title,
            artist: item.artist,
            src: item.preview || item.audioUrl,
            url: item.url,
            source: item.source,
            artwork: item.artwork || "",
            license: item.license || "",
          },
        }),
      );
  });
})();
