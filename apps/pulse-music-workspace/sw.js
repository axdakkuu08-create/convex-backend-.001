/* Versioned app-shell cache plus explicit offline-media cache lookup. */
const SHELL_CACHE = "pulse-shell-v1";
const MEDIA_CACHE = "pulse-media-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/pulse-192.svg",
  "./icons/pulse-512.svg",
  "./styles.css",
  "./home-refresh.css",
  "./charts-dashboard.css",
  "./pulse-glass-polish.css",
  "./tempus-redesign.css",
  "./config.js",
  "./internet-archive.js",
  "./catalog-search.js",
  "./playlist-playback.js",
  "./queue-storage.js",
  "./media-policy.js",
  "./offline-media.js",
  "./media3-bridge.js",
  "./app.js",
  "./home-refresh.js",
  "./playlist-store.js",
  "./home-archive-discovery.js",
  "./charts-dashboard.js",
  "./song-recognition.js",
  "./tempus-player.js",
  "./pwa-runtime.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("pulse-shell-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});
function rangeResponse(response, rangeHeader) {
  return response.arrayBuffer().then((buffer) => {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader || "");
    if (!match) return response;
    const size = buffer.byteLength;
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || end < start) {
      return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
    }
    const body = buffer.slice(start, end + 1);
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/mpeg",
        "Content-Length": String(body.byteLength),
        "Content-Range": "bytes " + start + "-" + end + "/" + size,
        "Accept-Ranges": "bytes",
      },
    });
  });
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  event.respondWith(
    (async () => {
      const media = await caches.open(MEDIA_CACHE);
      const savedMedia = await media.match(request.url);
      if (savedMedia) {
        const range = request.headers.get("range");
        return range ? rangeResponse(savedMedia, range) : savedMedia;
      }
      if (request.mode === "navigate") {
        try {
          return await fetch(request);
        } catch (_) {
          return (await caches.open(SHELL_CACHE)).match("./index.html");
        }
      }
      if (url.origin === self.location.origin) {
        const shell = await caches.open(SHELL_CACHE);
        const cached = await shell.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") {
            await shell.put(request, response.clone());
          }
          return response;
        } catch (_) {
          return new Response("Offline resource unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      }
      return fetch(request);
    })(),
  );
});
