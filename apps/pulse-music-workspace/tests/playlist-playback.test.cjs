const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "playlist-playback.js"), "utf8");
let calls = [];
let playResult = true;
const window = { PulsePlayerBridge: { playPlaylist(name, tracks) { calls.push({ name, tracks }); return playResult; } } };
vm.runInNewContext(source, { window, Promise, Math: Object.assign(Object.create(Math), { random: () => 0 }) });
const playback = window.PulsePlaylistPlayback;

test("empty playlists do not start", async () => {
  calls = [];
  assert.equal(await playback.start({ name: "Empty", tracks: [] }), false);
  assert.equal(calls.length, 0);
  assert.equal(playback.nextIndex(0, 0), null);
});
test("single-track playlist starts and only repeats when repeat-all is enabled", async () => {
  calls = [];
  playResult = true;
  const playlist = { name: "Single", tracks: [{ title: "Only", src: "https://audio.example/only.mp3" }] };
  assert.equal(await playback.start(playlist), true);
  assert.equal(calls[0].tracks.length, 1);
  assert.equal(playback.nextIndex(0, 1), null);
  assert.equal(playback.nextIndex(0, 1, { repeat: true }), 0);
});
test("multi-track playlist retains saved order and advances through every item", async () => {
  calls = [];
  const items = ["A", "B", "C"].map((title) => ({ title, src: "https://audio.example/" + title + ".mp3" }));
  assert.equal(await playback.start({ name: "Ordered", tracks: items }), true);
  assert.deepEqual(Array.from(calls[0].tracks, (item) => item.title), ["A", "B", "C"]);
  assert.deepEqual([playback.nextIndex(0, 3), playback.nextIndex(1, 3), playback.nextIndex(2, 3)], [1, 2, null]);
});
test("playlist start reports autoplay failure instead of claiming success", async () => {
  playResult = false;
  assert.equal(await playback.start({ name: "Blocked", tracks: [{ title: "Track", src: "https://audio.example/a.mp3" }] }), false);
  playResult = Promise.reject(new Error("autoplay blocked"));
  assert.equal(await playback.start({ name: "Rejected", tracks: [{ title: "Track", src: "https://audio.example/a.mp3" }] }), false);
  playResult = true;
});
test("invalid tracks are excluded without changing playable relative order", () => {
  const queue = playback.buildQueue({ tracks: [
    { title: "first", src: "https://audio.example/1.mp3" },
    { title: "unsafe", src: "javascript:alert(1)" },
    { title: "second", src: "blob:https://pulse.example/local" },
    { title: "third", src: "https://audio.example/3.mp3" },
  ] });
  assert.deepEqual(Array.from(queue, (item) => item.title), ["first", "second", "third"]);
});
test("previous and next navigation respect queue boundaries and repeat-all", () => {
  assert.equal(playback.previousIndex(0, 3), null);
  assert.equal(playback.previousIndex(1, 3), 0);
  assert.equal(playback.previousIndex(2, 3), 1);
  assert.equal(playback.previousIndex(0, 3, { repeat: true }), 2);
  assert.equal(playback.previousIndex(-1, 3, { repeat: true }), null);
  assert.equal(playback.nextIndex(2, 3), null);
  assert.equal(playback.nextIndex(2, 3, { repeat: true }), 0);
});
test("removing a queued track adjusts current index and cleans the deleted item", () => {
  const queue = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const beforeCurrent = playback.removeTrackAt(queue, 2, 0);
  assert.deepEqual(Array.from(beforeCurrent.tracks, (item) => item.id), ["b", "c"]);
  assert.equal(beforeCurrent.currentIndex, 1);
  const current = playback.removeTrackAt(queue, 1, 1);
  assert.deepEqual(Array.from(current.tracks, (item) => item.id), ["a", "c"]);
  assert.equal(current.currentIndex, 1);
  const last = playback.removeTrackAt([{ id: "only" }], 0, 0);
  assert.deepEqual(Array.from(last.tracks), []);
  assert.equal(last.currentIndex, 0);
  assert.equal(playback.removeTrackAt(queue, 1, 9), null);
});
