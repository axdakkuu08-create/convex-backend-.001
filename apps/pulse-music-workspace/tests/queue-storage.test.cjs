const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "queue-storage.js"), "utf8");

function localStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values,
  };
}

function fakeIDB(options = {}) {
  const records = new Map();
  let openCount = 0;
  const database = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const tx = {};
      const store = {
        get(key) {
          const request = {};
          queueMicrotask(() => {
            request.result = records.get(key);
            request.onsuccess?.();
            tx.oncomplete?.();
          });
          return request;
        },
        put(value, key) {
          const request = {};
          queueMicrotask(() => {
            if (options.writeFailure) {
              tx.error = new Error("write failed");
              tx.onerror?.();
              tx.onabort?.();
              return;
            }
            records.set(key, JSON.parse(JSON.stringify(value)));
            request.result = key;
            request.onsuccess?.();
            tx.oncomplete?.();
          });
          return request;
        },
      };
      tx.objectStore = () => store;
      return tx;
    },
  };
  return {
    records,
    database,
    get openCount() { return openCount; },
    setOpenFailure(value) { options.openFailure = value; },
    setBlocked(value) { options.blocked = value; },
    open() {
      openCount += 1;
      const request = {};
      queueMicrotask(() => {
        if (options.openFailure) {
          request.error = new Error("open failed");
          request.onerror?.();
        } else if (options.blocked) {
          request.onblocked?.();
        } else {
          request.result = database;
          request.onsuccess?.();
        }
      });
      return request;
    },
  };
}

function instance(indexedDB, localStorage = localStore()) {
  const window = { indexedDB, localStorage };
  vm.runInNewContext(source, { window, Promise, JSON, Error, TypeError });
  return { storage: window.PulseQueueStorage, localStorage };
}

const snapshot = (prefix, ids = [1, 2]) => ({
  schemaVersion: 2,
  tracks: ids.map((id) => ({
    id,
    title: prefix + id,
    src: "https://audio.example/" + id + ".mp3",
  })),
  currentTrackId: ids[0] ?? null,
  currentIndex: 0,
  repeatOn: false,
  shuffleOn: false,
  updatedAt: 123,
});

test("IndexedDB round-trips ordered queue and mirrors recovery copy", async () => {
  const x = instance(fakeIDB());
  const value = snapshot("idb-");
  assert.equal(await x.storage.save(value), "indexedDB");
  assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())), value);
  assert.equal(JSON.parse(x.localStorage.getItem("pulse.playerQueue.v1")).tracks[1].id, 2);
});

test("localStorage fallback works without IndexedDB", async () => {
  const x = instance(null);
  const value = snapshot("fallback-");
  assert.equal(await x.storage.save(value), "localStorage");
  assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())), value);
});

test("IndexedDB open failure falls back to localStorage", async () => {
  const x = instance(fakeIDB({ openFailure: true }));
  const value = snapshot("open-");
  assert.equal(await x.storage.save(value), "localStorage");
  assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())), value);
});

test("IndexedDB transaction failure falls back to localStorage", async () => {
  const x = instance(fakeIDB({ writeFailure: true }));
  const value = snapshot("write-");
  assert.equal(await x.storage.save(value), "localStorage");
  assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())), value);
});

test("localStorage recovery copy migrates into empty IndexedDB", async () => {
  const value = snapshot("legacy-");
  const idb = fakeIDB();
  const x = instance(idb, localStore({ "pulse.playerQueue.v1": JSON.stringify(value) }));
  assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())), value);
  assert.deepEqual(JSON.parse(JSON.stringify(idb.records.get("queue"))), value);
});

test("overlapping saves serialize and retain latest queue", async () => {
  const x = instance(fakeIDB());
  const first = snapshot("first-", [1]);
  const second = snapshot("second-", [7, 8, 9]);
  await Promise.all([x.storage.save(first), x.storage.save(second)]);
  assert.deepEqual(JSON.parse(JSON.stringify(await x.storage.load())), second);
});

test("corrupt localStorage recovery data is ignored", async () => {
  const x = instance(null, localStore({ "pulse.playerQueue.v1": "{broken" }));
  assert.equal(await x.storage.load(), null);
});

test("reload restoration removes invalid tracks and preserves current track by ID", () => {
  const x = instance(null);
  const input = { ...snapshot("restore-", [10, 11, 12]), currentTrackId: 12, currentIndex: 2 };
  input.tracks[1].src = "javascript:alert(1)";
  const normalized = x.storage.normalizeSnapshot(input, (track) => /^https?:\/\//i.test(track.src));
  assert.deepEqual(Array.from(normalized.tracks, (track) => track.id), [10, 12]);
  assert.equal(normalized.currentTrackId, 12);
  assert.equal(normalized.currentIndex, 1);
});

test("failed IndexedDB initialization is retried on a later save", async () => {
  const idb = fakeIDB({ openFailure: true });
  const x = instance(idb);
  assert.equal(await x.storage.save(snapshot("fallback-", [1])), "localStorage");
  idb.setOpenFailure(false);
  assert.equal(await x.storage.save(snapshot("recovered-", [2])), "indexedDB");
  assert.equal(idb.openCount, 2);
  assert.equal((await x.storage.load()).tracks[0].id, 2);
});

test("blocked IndexedDB upgrade falls back and can recover on retry", async () => {
  const idb = fakeIDB({ blocked: true });
  const x = instance(idb);
  assert.equal(await x.storage.save(snapshot("blocked-", [1])), "localStorage");
  idb.setBlocked(false);
  assert.equal(await x.storage.save(snapshot("unblocked-", [2])), "indexedDB");
  assert.equal(idb.openCount, 2);
});

test("version changes close the old connection and allow a fresh open", async () => {
  const idb = fakeIDB();
  const x = instance(idb);
  assert.equal(await x.storage.save(snapshot("first-", [1])), "indexedDB");
  idb.database.onversionchange();
  assert.equal(await x.storage.save(snapshot("second-", [2])), "indexedDB");
  assert.equal(idb.openCount, 2);
});

test("partial or malformed queue imports keep valid tracks in their original order", () => {
  const x = instance(null);
  const input = {
    ...snapshot("partial-", [1, 2, 3]),
    tracks: [
      { id: 1, title: "one", src: "https://audio.example/1.mp3" },
      null,
      { id: 2, title: "invalid", src: "data:audio/mp3;base64,AAAA" },
      { id: 3, title: "three", src: "https://audio.example/3.mp3" },
    ],
    currentTrackId: 3,
    currentIndex: 3,
  };
  const normalized = x.storage.normalizeSnapshot(input, (track) => track && /^https?:\/\//i.test(track.src || ""));
  assert.deepEqual(Array.from(normalized.tracks, (track) => track.id), [1, 3]);
  assert.equal(normalized.currentTrackId, 3);
  assert.equal(normalized.currentIndex, 1);
});
