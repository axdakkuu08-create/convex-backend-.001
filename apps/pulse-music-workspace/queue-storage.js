/* Resilient local queue persistence: IndexedDB primary, localStorage recovery. */
(() => {
  const DB_NAME = "pulse-player-state", STORE_NAME = "player-state";
  const STORAGE_KEY = "pulse.playerQueue.v1", DB_VERSION = 2;
  function createQueueStorage(environment) {
    const env = environment || window;
    let databasePromise = null, writeTail = Promise.resolve();
    function validSnapshot(value) { return Boolean(value && typeof value === "object" && Array.isArray(value.tracks)); }
    function readFallback() {
      try { const value = JSON.parse(env.localStorage.getItem(STORAGE_KEY) || "null"); return validSnapshot(value) ? value : null; }
      catch (_) { return null; }
    }
    function writeFallback(value) { env.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return "localStorage"; }
    function openDatabase() {
      if (!env.indexedDB) return Promise.reject(new Error("IndexedDB unavailable"));
      if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
        let settled = false;
        const fail = (error) => { if (settled) return; settled = true; databasePromise = null; reject(error || new Error("IndexedDB open failed")); };
        let request;
        try { request = env.indexedDB.open(DB_NAME, DB_VERSION); } catch (error) { fail(error); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
          if (settled) return;
          settled = true;
          const db = request.result;
          db.onversionchange = () => { try { db.close(); } catch (_) {} databasePromise = null; };
          resolve(db);
        };
        request.onerror = () => fail(request.error);
        request.onblocked = () => fail(new Error("IndexedDB upgrade blocked"));
      });
      return databasePromise;
    }
    function transact(mode, operation) {
      return openDatabase().then((db) => new Promise((resolve, reject) => {
        let result, settled = false;
        const fail = (error) => { if (settled) return; settled = true; reject(error || new Error("IndexedDB transaction failed")); };
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const request = operation(tx.objectStore(STORE_NAME));
          if (request) { request.onsuccess = () => { result = request.result; }; request.onerror = () => fail(request.error); }
          tx.oncomplete = () => { if (settled) return; settled = true; resolve(result); };
          tx.onerror = () => fail(tx.error);
          tx.onabort = () => fail(tx.error);
        } catch (error) { fail(error); }
      }));
    }
    function save(snapshot) {
      if (!validSnapshot(snapshot)) return Promise.reject(new TypeError("Invalid queue snapshot"));
      const copy = JSON.parse(JSON.stringify(snapshot));
      const operation = writeTail.then(async () => {
        try {
          await transact("readwrite", (store) => store.put(copy, "queue"));
          try { env.localStorage.setItem(STORAGE_KEY, JSON.stringify(copy)); } catch (_) {}
          return "indexedDB";
        } catch (_) { return writeFallback(copy); }
      });
      writeTail = operation.catch(() => {});
      return operation;
    }
    async function load() {
      try {
        const stored = await transact("readonly", (store) => store.get("queue"));
        if (validSnapshot(stored)) return stored;
      } catch (_) { return readFallback(); }
      const fallback = readFallback();
      if (fallback) { try { await transact("readwrite", (store) => store.put(fallback, "queue")); } catch (_) {} }
      return fallback;
    }
    function normalizeSnapshot(snapshot, isPlayable) {
      if (!validSnapshot(snapshot)) return null;
      const predicate = typeof isPlayable === "function" ? isPlayable : () => true;
      const tracks = snapshot.tracks.filter((track) => predicate(track));
      let currentIndex = tracks.findIndex((track) => String(track.id) === String(snapshot.currentTrackId));
      if (currentIndex < 0 && tracks.length) {
        const requested = Number(snapshot.currentIndex);
        currentIndex = Math.min(Math.max(Number.isInteger(requested) ? requested : 0, 0), tracks.length - 1);
      }
      return { ...snapshot, tracks, currentIndex, currentTrackId: tracks[currentIndex]?.id ?? null };
    }
    return { load, save, normalizeSnapshot };
  }
  window.PulseQueueStorage = createQueueStorage(window);
  window.PulseQueueStorage.create = createQueueStorage;
})();
