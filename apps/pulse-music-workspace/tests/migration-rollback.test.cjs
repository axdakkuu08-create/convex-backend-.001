const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "queue-storage.js"), "utf8");

function createStorage() {
  const values = new Map();
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const window = { indexedDB: null, localStorage };
  vm.runInNewContext(source, { window, Promise, JSON, Error, TypeError });
  return window.PulseQueueStorage;
}

test("legacy schemaVersion 2 queues without attribution remain readable", () => {
  const storage = createStorage();
  const legacy = {
    schemaVersion: 2,
    tracks: [
      { id: 1, title: "Legacy", src: "https://audio.example/legacy.mp3" },
    ],
    currentTrackId: 1,
    currentIndex: 0,
    repeatOn: false,
    shuffleOn: false,
  };
  const normalized = storage.normalizeSnapshot(legacy, (track) =>
    /^https:\/\//.test(track.src),
  );
  assert.equal(normalized.currentTrackId, 1);
  assert.equal(normalized.tracks[0].title, "Legacy");
  assert.equal(normalized.tracks[0].licenseLabel, undefined);
});

test("new attribution fields survive queue snapshot normalization", () => {
  const storage = createStorage();
  const snapshot = {
    schemaVersion: 2,
    tracks: [
      {
        id: 7,
        title: "Approved Archive item",
        src: "https://archive.org/download/item/audio.mp3",
        sourceType: "internet_archive",
        licenseLabel: "CC BY 4.0",
        sourcePage: "https://archive.org/details/item",
        rightsReviewStatus: "APPROVED",
        verificationStatus: "VERIFIED_FULL",
      },
    ],
    currentTrackId: 7,
    currentIndex: 0,
  };
  const normalized = storage.normalizeSnapshot(snapshot, () => true);
  assert.equal(normalized.tracks[0].sourceType, "internet_archive");
  assert.equal(normalized.tracks[0].licenseLabel, "CC BY 4.0");
  assert.equal(
    normalized.tracks[0].sourcePage,
    "https://archive.org/details/item",
  );
});

test("rollback instructions preserve existing queue and playlist keys", () => {
  const doc = fs.readFileSync(path.join(root, "MIGRATION_ROLLBACK.md"), "utf8");
  assert.match(doc, /pulse\.offlineMedia\.v1/);
  assert.match(doc, /schemaVersion 2/);
  assert.match(doc, /Do not delete the user's saved audio automatically/);
  assert.match(doc, /main remains unchanged/i);
});
