/* Internet Archive public search + metadata adapter. No API key required for basic reads. */
(function () {
  "use strict";
  const SEARCH_ENDPOINT = "https://archive.org/advancedsearch.php";
  const METADATA_ENDPOINT = "https://archive.org/metadata/";

  function supportedAudio(file) {
    const name = String(file?.name || "").toLowerCase();
    const format = String(file?.format || "").toLowerCase();
    const source = String(file?.source || "").toLowerCase();
    const mime = String(file?.mimetype || file?.mime_type || "").toLowerCase();
    if (source === "original" && /^(true|1)$/i.test(String(file?.private || ""))) return false;
    if (mime.startsWith("audio/")) return true;
    if (format.includes("mp3") || format.includes("mpeg layer 3")) return /\.mp3$/i.test(name);
    if (format.includes("ogg vorbis") || format.includes("flac") || format.includes("wav")) {
      return /\.(ogg|oga|flac|wav)$/i.test(name);
    }
    return /\.(mp3|ogg|oga|flac|wav|m4a|aac)$/i.test(name);
  }

  function chooseAudioFile(files) {
    if (!Array.isArray(files)) return null;
    const candidates = files.filter((file) => file && file.name && supportedAudio(file));
    const rank = (file) => {
      const name = String(file.name).toLowerCase();
      const format = String(file.format || "").toLowerCase();
      if (/\.mp3$/.test(name) || format.includes("mp3")) return 0;
      if (/\.(ogg|oga)$/.test(name) || format.includes("ogg")) return 1;
      if (/\.m4a$/.test(name)) return 2;
      if (/\.flac$/.test(name) || format.includes("flac")) return 3;
      if (/\.wav$/.test(name) || format.includes("wav")) return 4;
      return 5;
    };
    candidates.sort((a, b) => rank(a) - rank(b));
    return candidates[0] || null;
  }

  async function search(term, fetchImpl) {
    const request = fetchImpl || fetch;
    const query = String(term || "").trim();
    if (query.length < 2) throw new Error("Enter at least two characters to search.");
    const url = new URL(SEARCH_ENDPOINT);
    url.search = new URLSearchParams({
      q: "mediatype:audio AND (" + query.replace(/[\\:*?^~]/g, " ") + ")",
      "fl[]": "identifier,title,creator,year,licenseurl,rights",
      rows: "12",
      page: "1",
      output: "json",
    }).toString();
    const response = await request(url.href, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Internet Archive search returned HTTP " + response.status);
    const payload = await response.json();
    const docs = payload?.response?.docs;
    if (!Array.isArray(docs)) throw new Error("Internet Archive returned an unexpected search response.");
    const items = await Promise.all(docs.map(async (doc) => {
      if (!doc?.identifier) return null;
      const metaResponse = await request(METADATA_ENDPOINT + encodeURIComponent(doc.identifier), {
        headers: { Accept: "application/json" },
      });
      if (!metaResponse.ok) return null;
      const metadata = await metaResponse.json();
      const file = chooseAudioFile(metadata?.files);
      if (!file) return null;
      const encodedFile = file.name.split("/").map(encodeURIComponent).join("/");
      const details = metadata?.metadata || {};
      const itemUrl = "https://archive.org/details/" + encodeURIComponent(doc.identifier);
      return {
        id: String(doc.identifier),
        title: String(details.title || doc.title || doc.identifier),
        artist: String(details.creator || doc.creator || "Internet Archive contributor"),
        year: String(details.year || doc.year || ""),
        src: "https://archive.org/download/" + encodeURIComponent(doc.identifier) + "/" + encodedFile,
        sourceUrl: itemUrl,
        licenseUrl: String(details.licenseurl || doc.licenseurl || ""),
        rights: String(details.rights || doc.rights || ""),
        format: String(file.format || file.mimetype || "Audio"),
      };
    }));
    return items.filter(Boolean);
  }

  window.PULSE_ARCHIVE = Object.freeze({ search, chooseAudioFile });
})();
