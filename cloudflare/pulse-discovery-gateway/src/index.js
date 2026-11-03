const TTL = 300;
const MAX = 24;
const AUDIO = /\.(mp3|m4a|ogg|oga|opus|wav|flac)$/i;
const STATES = ["VERIFIED_FULL", "PREVIEW_ONLY", "UNAVAILABLE", "VERIFYING"];

const response = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
const text = (value, fallback = "") =>
  String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
export const safeQuery = (value) =>
  text(value)
    .replace(/[\\+\-!(){}\[\]^"~*?:/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
export function parseDuration(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw) return 0;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  return parts.some((n) => !Number.isFinite(n))
    ? 0
    : parts.reduce((a, n) => a * 60 + n, 0);
}
export function pickAudioFile(files) {
  if (!Array.isArray(files)) return null;
  const list = files.filter(
    (f) =>
      f &&
      typeof f.name === "string" &&
      AUDIO.test(f.name) &&
      !/_(spectrogram|waveform|essentia)|\.(xml|json|jpg|jpeg|png|gif|txt|torrent)$/i.test(
        f.name,
      ) &&
      (!Number(f.size) || Number(f.size) >= 256000),
  );
  return list.find((f) => /\.mp3$/i.test(f.name)) || list[0] || null;
}
export function normalizeTrack(x) {
  const provider = x.provider === "itunes" ? "itunes" : "archive";
  const previewUrl = text(x.previewUrl),
    streamUrl = text(x.streamUrl);
  let verificationStatus = STATES.includes(x.verificationStatus)
    ? x.verificationStatus
    : provider === "itunes"
      ? previewUrl
        ? "PREVIEW_ONLY"
        : "UNAVAILABLE"
      : streamUrl
        ? "VERIFYING"
        : "UNAVAILABLE";
  if (
    provider === "archive" &&
    streamUrl &&
    verificationStatus === "VERIFIED_FULL"
  )
    verificationStatus = "VERIFYING";
  if (!streamUrl && !previewUrl) verificationStatus = "UNAVAILABLE";
  const providerId = text(x.providerId || x.catalogId || x.id);
  return {
    id:
      provider +
      ":" +
      (providerId ||
        (text(x.title) + ":" + text(x.artist))
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")),
    provider,
    catalogId: providerId,
    title: text(x.title, "Untitled track"),
    artist: text(x.artist, "Unknown artist"),
    album: text(x.album),
    genre: text(x.genre),
    country: text(x.country),
    duration: Math.max(0, Number(x.duration) || 0),
    streamUrl,
    previewUrl,
    artwork: text(x.artwork),
    sourceUrl: text(x.sourceUrl),
    license: text(x.license),
    rightsReviewStatus:
      provider === "archive" ? "REVIEW_REQUIRED" : "PROVIDER_TERMS_APPLY",
    explicit: Boolean(x.explicit),
    verificationStatus,
    bytesTotal: Number(x.bytesTotal) > 0 ? Number(x.bytesTotal) : undefined,
    releaseDate: text(x.releaseDate),
  };
}
export function dedupeTracks(items) {
  const map = new Map();
  for (const item of items) {
    const key = (item.title + "::" + item.artist).toLowerCase();
    const old = map.get(key);
    const score = (t) =>
      (t.verificationStatus === "VERIFIED_FULL" ? 4 : 0) +
      (t.streamUrl ? 2 : 0) +
      (t.previewUrl ? 1 : 0) +
      (t.artwork ? 0.25 : 0);
    if (!old || score(item) > score(old)) map.set(key, item);
  }
  return [...map.values()];
}
async function getJson(url, fetcher) {
  const r = await fetcher(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("Provider request failed (" + r.status + ")");
  return r.json();
}
export async function searchITunes({
  query,
  country,
  genre,
  limit,
  fetcher = fetch,
}) {
  const p = new URLSearchParams({
    term: [query, genre].filter(Boolean).join(" "),
    country: country || "IN",
    entity: "song",
    media: "music",
    explicit: "No",
    limit: String(Math.min(limit, 50)),
  });
  const data = await getJson("https://itunes.apple.com/search?" + p, fetcher);
  return (Array.isArray(data.results) ? data.results : []).map((t) =>
    normalizeTrack({
      provider: "itunes",
      providerId: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      genre: t.primaryGenreName,
      country,
      duration: Number(t.trackTimeMillis || 0) / 1000,
      previewUrl: t.previewUrl,
      artwork: t.artworkUrl100?.replace("100x100bb", "300x300bb") || "",
      sourceUrl:
        t.trackViewUrl || t.collectionViewUrl || "https://music.apple.com/",
      explicit: t.trackExplicitness === "explicit",
      releaseDate: t.releaseDate,
      verificationStatus: t.previewUrl ? "PREVIEW_ONLY" : "UNAVAILABLE",
    }),
  );
}
export async function searchArchive({
  query,
  genre,
  countryName,
  minDurationSeconds,
  limit,
  fetcher = fetch,
}) {
  const term = safeQuery(query),
    quoted = '"' + term.replace(/"/g, "") + '"';
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
  if (genre) clauses.push('subject:"' + safeQuery(genre) + '"');
  if (countryName) clauses.push('subject:"' + safeQuery(countryName) + '"');
  const p = new URLSearchParams({
    q: clauses.join(" AND "),
    fl: "identifier,title,creator,date,year,licenseurl,rights",
    rows: String(Math.min(limit, MAX)),
    page: "1",
    output: "json",
    sort: "downloads desc",
  });
  const data = await getJson(
    "https://archive.org/advancedsearch.php?" + p,
    fetcher,
  );
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
  const tracks = await Promise.all(
    docs.map(async (d) => {
      const id = text(d?.identifier);
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null;
      try {
        const meta = await getJson(
          "https://archive.org/metadata/" + encodeURIComponent(id),
          fetcher,
        );
        const file = pickAudioFile(meta.files);
        if (!file) return null;
        const m = meta.metadata || {};
        const duration = parseDuration(
          m.runtime || m.length || file.length || file.duration,
        );
        if (minDurationSeconds && duration && duration < minDurationSeconds)
          return null;
        return normalizeTrack({
          provider: "archive",
          providerId: id,
          title: m.title || d.title || id,
          artist:
            m.creator ||
            m.artist ||
            d.creator ||
            "Internet Archive contributor",
          album: m.album || "",
          genre,
          duration,
          streamUrl:
            "https://archive.org/download/" +
            encodeURIComponent(id) +
            "/" +
            encodeURIComponent(file.name),
          sourceUrl: "https://archive.org/details/" + encodeURIComponent(id),
          license: m.licenseurl || m.rights || d.licenseurl || d.rights || "",
          releaseDate: m.year || m.date || d.year || d.date || "",
          bytesTotal: file.size,
          verificationStatus: "VERIFYING",
        });
      } catch {
        return null;
      }
    }),
  );
  return tracks.filter(Boolean);
}
export const cacheKey = ({
  query,
  country,
  genre,
  countryName = "",
  minDurationSeconds = 0,
  limit,
  provider = "all",
}) =>
  "search:v1:" +
  encodeURIComponent(
    [
      query.toLowerCase(),
      country.toUpperCase(),
      genre.toLowerCase(),
      countryName.toLowerCase(),
      minDurationSeconds,
      limit,
      provider,
    ].join("|"),
  ).slice(0, 400);

export async function handleSearch(request, env, fetcher = fetch) {
  const u = new URL(request.url),
    query = safeQuery(u.searchParams.get("q"));
  if (query.length < 2)
    return response({ error: "Enter at least two characters to search." }, 400);
  const country = text(u.searchParams.get("country") || "IN")
    .toUpperCase()
    .slice(0, 2);
  const genre = safeQuery(u.searchParams.get("genre") || "").slice(0, 40);
  const countryName = safeQuery(u.searchParams.get("countryName") || "").slice(
    0,
    40,
  );
  const minDurationSeconds = Math.max(
    0,
    Math.min(Number(u.searchParams.get("minDurationSeconds")) || 0, 3600),
  );
  const limit = Math.min(
    Math.max(Number(u.searchParams.get("limit")) || 18, 1),
    MAX,
  );
  const provider = ["all", "archive", "itunes"].includes(
    u.searchParams.get("provider"),
  )
    ? u.searchParams.get("provider")
    : "all";
  const key = cacheKey({
    query,
    country,
    genre,
    countryName,
    minDurationSeconds,
    limit,
    provider,
  });
  if (env.CATALOG_CACHE)
    try {
      const cached = await env.CATALOG_CACHE.get(key, "json");
      if (cached) return response({ ...cached, cache: "HIT" });
    } catch {}
  const names = provider === "all" ? ["itunes", "archive"] : [provider];
  const jobs = await Promise.allSettled(
    names.map((n) =>
      n === "itunes"
        ? searchITunes({ query, country, genre, limit, fetcher })
        : searchArchive({
            query,
            genre,
            countryName,
            minDurationSeconds,
            limit,
            fetcher,
          }),
    ),
  );
  const tracks = dedupeTracks(
    jobs.flatMap((j) => (j.status === "fulfilled" ? j.value : [])),
  );
  const providerStatus = Object.fromEntries(
    names.map((n, i) => [
      n,
      jobs[i].status === "fulfilled" ? "ok" : "unavailable",
    ]),
  );
  const payload = {
    query,
    tracks: tracks.slice(0, limit * 2),
    providerStatus,
    partial: Object.values(providerStatus).some((v) => v !== "ok"),
    requestedProvider: provider,
    cache: "MISS",
    licensingNotice:
      "A playable URL or provider metadata is not proof of permission to reuse a recording. Review source rights separately.",
  };
  if (env.CATALOG_CACHE)
    try {
      await env.CATALOG_CACHE.put(key, JSON.stringify(payload), {
        expirationTtl: TTL,
      });
    } catch {}
  return response(payload);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    const cors = {
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
      vary: "Origin",
    };
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    const u = new URL(request.url);
    if (request.method === "GET" && u.pathname === "/health")
      return response(
        { service: "pulse-discovery-gateway", status: "ok" },
        200,
        cors,
      );
    if (request.method !== "GET")
      return response({ error: "Method not allowed" }, 405, cors);
    if (u.pathname !== "/api/search")
      return response({ error: "Not found" }, 404, cors);
    const r = await handleSearch(request, env),
      h = new Headers(r.headers);
    Object.entries(cors).forEach(([k, v]) => h.set(k, v));
    return new Response(r.body, { status: r.status, headers: h });
  },
};
