/* Public iTunes Search API adapter. Returns track previews, not full commercial streams. */
(function () {
  "use strict";
  const COUNTRIES = {
    Worldwide: "us",
    India: "in",
    "United States": "us",
    "United Kingdom": "gb",
    "South Korea": "kr",
    Japan: "jp",
    France: "fr",
    Brazil: "br",
  };
  async function search(options = {}, fetchImpl) {
    const request = fetchImpl || fetch;
    const country = COUNTRIES[options.country] || "us";
    const genre = String(options.genre || "").trim();
    const term = String(options.term || genre || "new music").trim();
    const url = new URL("https://itunes.apple.com/search");
    url.search = new URLSearchParams({
      term,
      country,
      entity: "song",
      media: "music",
      limit: String(Math.min(50, Math.max(1, Number(options.limit) || 40))),
      explicit: "No",
    }).toString();
    const response = await request(url.href, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error("Music catalog returned HTTP " + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload?.results))
      throw new Error("Music catalog returned an unexpected response.");
    const results = payload.results
      .filter((item) => item?.trackId && item?.trackName && item?.previewUrl)
      .map((item) => ({
        id: String(item.trackId),
        catalogId: String(item.trackId),
        title: String(item.trackName),
        artist: String(item.artistName || "Unknown artist"),
        genre: String(item.primaryGenreName || genre || "Music"),
        releaseDate: String(item.releaseDate || ""),
        year: String(item.releaseDate || "").slice(0, 4),
        time: "0:30",
        format: "30-second preview",
        src: String(item.previewUrl),
        sourceUrl: String(item.previewUrl),
        sourcePage: String(item.trackViewUrl || ""),
        source: "itunes-preview",
        artworkUrl: String(item.artworkUrl100 || ""),
        mood: String(item.primaryGenreName || genre || "Music"),
        cover: "green",
        symbol: "♫",
      }));
    if (options.latest === false) return results;
    const timestamp = (value) => {
      const parsed = Date.parse(value || "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return results.sort(
      (a, b) =>
        timestamp(b.releaseDate) - timestamp(a.releaseDate) ||
        a.title.localeCompare(b.title),
    );
  }
  window.PULSE_CATALOG = Object.freeze({ search });
})();
