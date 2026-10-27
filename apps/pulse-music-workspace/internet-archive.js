(function (global) {
  "use strict";

  const SEARCH_URL = "https://archive.org/advancedsearch.php";
  const META_URL = "https://archive.org/metadata/";
  const AUDIO_EXTENSIONS = /\.(mp3|m4a|ogg|oga|opus|wav|flac)$/i;

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
        ),
    );
    return (
      candidates.find((file) => /\.mp3$/i.test(file.name)) ||
      candidates.find((file) =>
        /\.(m4a|ogg|oga|opus|wav|flac)$/i.test(file.name),
      ) ||
      null
    );
  }

  async function search(query, limit) {
    const term = safeQuery(query);
    if (term.length < 2) {
      throw new Error(
        "Enter at least two characters to search the Internet Archive.",
      );
    }

    const quoted = '"' + term.replace(/"/g, "") + '"';
    const params = new URLSearchParams({
      q:
        "mediatype:audio AND (title:" +
        quoted +
        " OR creator:" +
        quoted +
        " OR subject:" +
        quoted +
        ")",
      fl: "identifier,title,creator,date,year,licenseurl,rights,description",
      rows: String(Math.min(Math.max(Number(limit) || 8, 1), 12)),
      page: "1",
      output: "json",
      sort: "downloads desc",
    });
    const response = await fetch(SEARCH_URL + "?" + params.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(
        "Internet Archive search is temporarily unavailable (" +
          response.status +
          ").",
      );
    }

    const payload = await response.json();
    const docs =
      payload && payload.response && Array.isArray(payload.response.docs)
        ? payload.response.docs
        : [];
    const items = await Promise.all(
      docs.slice(0, 8).map(async (doc) => {
        if (!doc || !/^[A-Za-z0-9_-]{1,100}$/.test(doc.identifier || "")) {
          return null;
        }
        try {
          const metaResponse = await fetch(
            META_URL + encodeURIComponent(doc.identifier),
            { headers: { Accept: "application/json" } },
          );
          if (!metaResponse.ok) return null;
          const meta = await metaResponse.json();
          const file = pickAudioFile(meta.files);
          if (!file) return null;

          const license =
            (meta.metadata &&
              (meta.metadata.licenseurl || meta.metadata.rights)) ||
            doc.licenseurl ||
            doc.rights ||
            "";
          return {
            id: doc.identifier,
            title: String(
              (meta.metadata && meta.metadata.title) ||
                doc.title ||
                doc.identifier,
            ),
            artist: String(
              (meta.metadata &&
                (meta.metadata.creator || meta.metadata.artist)) ||
                doc.creator ||
                "Internet Archive contributor",
            ),
            year: String(
              (meta.metadata && (meta.metadata.year || meta.metadata.date)) ||
                doc.year ||
                doc.date ||
                "",
            ),
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
          return null;
        }
      }),
    );
    return items.filter(Boolean);
  }

  global.PulseArchive = { search, pickAudioFile, safeQuery };
})(window);
