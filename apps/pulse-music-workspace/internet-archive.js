(function (global) {
  "use strict";

  const SEARCH_URL = "https://archive.org/advancedsearch.php";
  const META_URL = "https://archive.org/metadata/";
  const AUDIO_EXTENSIONS = /\.(mp3|m4a|ogg|oga|opus|wav|flac)$/i;
  const MAX_RESULTS = 24;

  function safeQuery(value) {
    return String(value || "")
      .trim()
      .replace(/[\\+\-!(){}\[\]^"~*?:\/]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  function pickAudioFile(files) {
    if (!Array.isArray(files)) return null;
    const candidates = files.filter(
      (file) =>
        file &&
        typeof file.name === "string" &&
        AUDIO_EXTENSIONS.test(file.name) &&
        !/_(spectrogram|waveform|essentia)|\.(xml|json|jpg|jpeg|png|gif|txt|torrent)$/i.test(
          file.name,
        ) &&
        (!Number(file.size) || Number(file.size) >= 256000),
    );
    return (
      candidates.find((file) => /\.mp3$/i.test(file.name)) ||
      candidates.find((file) =>
        /\.(m4a|ogg|oga|opus|wav|flac)$/i.test(file.name),
      ) ||
      null
    );
  }

  function parseDuration(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value || "").trim();
    if (!text) return 0;
    if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  async function search(query, limit, options) {
    const term = safeQuery(query);
    if (term.length < 2)
      throw new Error(
        "Enter at least two characters to search the Internet Archive.",
      );
    const opts = options || {};
    const requested = Math.min(Math.max(Number(limit) || 24, 1), MAX_RESULTS);
    const quoted = '"' + term.replace(/"/g, "") + '"';
    const clauses = [
      "mediatype:audio",
      "(title:" +
        quoted +
        " OR creator:" +
        quoted +
        " OR subject:" +
        quoted +
        ")",
    ];
    if (opts.genre) clauses.push('subject:"' + safeQuery(opts.genre) + '"');
    if (opts.countryName)
      clauses.push('subject:"' + safeQuery(opts.countryName) + '"');
    const params = new URLSearchParams({
      q: clauses.join(" AND "),
      fl: "identifier,title,creator,date,year,licenseurl,rights,description",
      rows: String(requested),
      page: "1",
      output: "json",
      sort: "downloads desc",
    });
    const response = await fetch(SEARCH_URL + "?" + params.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(
        "Internet Archive search is temporarily unavailable (" +
          response.status +
          ").",
      );
    const payload = await response.json();
    const docs =
      payload && payload.response && Array.isArray(payload.response.docs)
        ? payload.response.docs
        : [];
    const items = new Array(docs.length);
    let cursor = 0;
    async function worker() {
      while (cursor < docs.length) {
        const position = cursor++;
        const doc = docs[position];
        if (!doc || !/^[A-Za-z0-9_-]{1,100}$/.test(doc.identifier || ""))
          continue;
        try {
          const metaResponse = await fetch(
            META_URL + encodeURIComponent(doc.identifier),
            { headers: { Accept: "application/json" } },
          );
          if (!metaResponse.ok) continue;
          const meta = await metaResponse.json();
          const file = pickAudioFile(meta.files);
          if (!file) continue;
          const metadata = meta.metadata || {};
          const license =
            metadata.licenseurl ||
            metadata.rights ||
            doc.licenseurl ||
            doc.rights ||
            "";
          const durationSeconds = parseDuration(
            metadata.runtime || metadata.length || file.length || file.duration,
          );
          if (
            opts.minDurationSeconds &&
            durationSeconds &&
            durationSeconds < opts.minDurationSeconds
          )
            continue;
          items[position] = {
            id: doc.identifier,
            title: String(metadata.title || doc.title || doc.identifier),
            artist: String(
              metadata.creator ||
                metadata.artist ||
                doc.creator ||
                "Internet Archive contributor",
            ),
            year: String(
              metadata.year || metadata.date || doc.year || doc.date || "",
            ),
            durationSeconds,
            fileSize: Number(file.size) || 0,
            license: String(license),
            audioUrl:
              "https://archive.org/download/" +
              encodeURIComponent(doc.identifier) +
              "/" +
              encodeURIComponent(file.name),
            pageUrl:
              "https://archive.org/details/" +
              encodeURIComponent(doc.identifier),
          };
        } catch (_) {
          // An unavailable item must not fail the rest of the catalogue search.
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, docs.length) }, worker));
    return items.filter(Boolean).slice(0, requested);
  }

  global.PulseArchive = { search, pickAudioFile, safeQuery, parseDuration };
})(window);
