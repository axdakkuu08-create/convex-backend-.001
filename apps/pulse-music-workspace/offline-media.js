/* Explicit-rights-gated offline media storage using the browser Cache API. */
(() => {
  "use strict";
  const CACHE_NAME = "pulse-media-v1";
  const STORAGE_KEY = "pulse.offlineMedia.v1";
  const MAX_TRACK_BYTES = 100 * 1024 * 1024;
  const policy = window.PulseMediaPolicy;

  function readRecords() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }
  function writeRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  function records() {
    return readRecords();
  }
  function isSaved(url) {
    return readRecords().some((item) => item.url === String(url || ""));
  }
  async function list() {
    const records = readRecords();
    const cache = await caches.open(CACHE_NAME);
    const output = [];
    for (const record of records) {
      if (await cache.match(record.url)) output.push({ ...record });
    }
    if (output.length !== records.length) writeRecords(output);
    return output;
  }
  async function download(track) {
    if (!policy || !policy.canDownloadOffline(track)) {
      throw new Error(
        "Offline saving is blocked until the full track is verified and its Internet Archive rights review is explicitly approved.",
      );
    }
    const url = String(track.src || track.audioUrl);
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return { saved: true, alreadySaved: true };
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "audio/*,application/octet-stream;q=0.9" },
    });
    if (!response.ok || response.type === "opaque") {
      throw new Error("The audio source did not allow a safe offline download.");
    }
    const contentType = response.headers.get("content-type") || "";
    if (!/^audio\//i.test(contentType) && !/application\/octet-stream/i.test(contentType)) {
      throw new Error("The source did not return an audio file.");
    }
    const blob = await response.blob();
    if (!blob.size || blob.size > MAX_TRACK_BYTES) {
      throw new Error("The audio file is empty or exceeds the 100 MB offline limit.");
    }
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (
        Number.isFinite(estimate.quota) &&
        Number.isFinite(estimate.usage) &&
        estimate.usage + blob.size > estimate.quota * 0.85
      ) {
        throw new Error("Not enough available browser storage for this download.");
      }
    }
    if (navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch (_) {}
    }
    const cachedResponse = new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(blob.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    await cache.put(url, cachedResponse);
    const attribution = policy.normalizeAttribution(track);
    const record = {
      id: Number(track.id) || Date.now(),
      title: String(track.title || "Untitled track"),
      artist: String(track.artist || "Unknown artist"),
      url,
      src: url,
      source: "Internet Archive",
      catalogId: String(track.catalogId || ""),
      artwork: String(track.artwork || ""),
      duration: String(track.duration || track.time || ""),
      bytesTotal: blob.size,
      savedAt: Date.now(),
      ...attribution,
    };
    try {
      writeRecords([
        ...readRecords().filter((item) => item.url !== url),
        record,
      ]);
    } catch (error) {
      await cache.delete(url);
      throw new Error("Offline metadata could not be saved; cached audio was removed.");
    }
    return { saved: true, alreadySaved: false, record };
  }
  async function remove(url) {
    const key = String(url || "");
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(key);
    writeRecords(readRecords().filter((item) => item.url !== key));
    return true;
  }
  window.PulseOfflineMedia = {
    cacheName: CACHE_NAME,
    list,
    records,
    isSaved,
    download,
    remove,
    canDownload: (track) => Boolean(policy?.canDownloadOffline(track)),
  };
})();
