const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const policySource = fs.readFileSync(path.join(root, "media-policy.js"), "utf8");
const offlineSource = fs.readFileSync(path.join(root, "offline-media.js"), "utf8");

function makeEnvironment(options = {}) {
  const values = new Map();
  const records = new Map();
  let fetchCalls = 0;
  let fetchOptions = null;
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (options.storageFailure) throw new Error("storage full");
      values.set(key, String(value));
    },
  };
  const cache = {
    async match(key) { return records.get(String(key))?.clone() || undefined; },
    async put(key, response) { records.set(String(key), response.clone()); },
    async delete(key) { return records.delete(String(key)); },
  };
  const caches = { async open() { return cache; } };
  const navigator = { storage: { async estimate() { return options.estimate || { quota: 1e9, usage: 0 }; }, async persist() { return true; } } };
  const window = {};
  const fetch = async (_url, requestOptions) => {
    fetchCalls += 1;
    fetchOptions = requestOptions;
    return options.response || new Response(new Blob(["audio bytes"], { type: "audio/mpeg" }), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  };
  const context = { window, localStorage, caches, navigator, fetch, Response, URL, Promise, Date, String, Number, Boolean, Error, JSON };
  vm.runInNewContext(policySource, context);
  vm.runInNewContext(offlineSource, context);
  return { api: window.PulseOfflineMedia, values, records, get fetchCalls() { return fetchCalls; }, get fetchOptions() { return fetchOptions; } };
}

const approved = {
  id: 42,
  title: "Verified audio",
  artist: "Archive artist",
  src: "https://archive.org/download/example/audio.mp3",
  source: "Internet Archive",
  sourceType: "internet_archive",
  license: "CC BY 4.0",
  sourcePage: "https://archive.org/details/example",
  verificationStatus: "VERIFIED_FULL",
  rightsReviewStatus: "APPROVED",
};

test("unreviewed or preview-only audio is blocked before network access", async () => {
  const env = makeEnvironment();
  await assert.rejects(env.api.download({ ...approved, rightsReviewStatus: "REVIEW_REQUIRED" }), /rights review/i);
  await assert.rejects(env.api.download({ ...approved, sourceType: "itunes_preview" }), /rights review/i);
  assert.equal(env.fetchCalls, 0);
});

test("approved full-track audio is cached with attribution metadata", async () => {
  const env = makeEnvironment();
  const result = await env.api.download(approved);
  assert.equal(result.saved, true);
  assert.equal(result.record.sourceType, "internet_archive");
  assert.equal(result.record.licenseLabel, "CC BY 4.0");
  assert.equal(result.record.sourcePage, approved.sourcePage);
  assert.equal(env.api.isSaved(approved.src), true);
  assert.equal((await env.api.list()).length, 1);
  assert.equal(env.fetchCalls, 1);
  assert.equal(env.fetchOptions.credentials, "omit");
  assert.equal(env.fetchOptions.mode, "cors");
});

test("non-audio response is rejected and not recorded", async () => {
  const env = makeEnvironment({
    response: new Response("<html>not audio</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }),
  });
  await assert.rejects(env.api.download(approved), /did not return an audio file/i);
  assert.equal(env.api.isSaved(approved.src), false);
});

test("insufficient reported quota rejects a download before cache write", async () => {
  const env = makeEnvironment({ estimate: { quota: 5, usage: 0 } });
  await assert.rejects(env.api.download(approved), /Not enough available browser storage/i);
  assert.equal(env.records.has(approved.src), false);
});

test("metadata storage failure rolls back cached audio", async () => {
  const env = makeEnvironment({ storageFailure: true });
  await assert.rejects(env.api.download(approved), /metadata could not be saved/i);
  assert.equal(env.records.has(approved.src), false);
});

test("saved audio can be removed from cache and offline index", async () => {
  const env = makeEnvironment();
  await env.api.download(approved);
  assert.equal(await env.api.remove(approved.src), true);
  assert.equal(env.api.isSaved(approved.src), false);
  assert.equal((await env.api.list()).length, 0);
});
