const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'app.js');
const source = fs.readFileSync(appPath, 'utf8');
const start = source.indexOf('function resolveMusicEmbed(raw)');
const end = source.indexOf('function loadMusicEmbed(', start);
assert.ok(start >= 0 && end > start, 'embed resolver function must exist');
const sandbox = { URL };
vm.runInNewContext(source.slice(start, end) + '\nthis.resolveMusicEmbed = resolveMusicEmbed;', sandbox);
const resolveMusicEmbed = sandbox.resolveMusicEmbed;

test('Spotify track and localized links become official Spotify embeds', () => {
  const track = resolveMusicEmbed('https://open.spotify.com/track/abc123XYZ');
  assert.equal(track.url, 'https://open.spotify.com/embed/track/abc123XYZ?utm_source=generator');
  const localized = resolveMusicEmbed('https://open.spotify.com/intl-en/album/abc123XYZ');
  assert.match(localized.url, /open\.spotify\.com\/embed\/album\/abc123XYZ/);
});

test('YouTube video and playlist links become privacy-enhanced embeds', () => {
  assert.equal(resolveMusicEmbed('https://youtu.be/abcdefghijk').url, 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.match(resolveMusicEmbed('https://music.youtube.com/watch?v=abcdefghijk&list=PL12345').url, /youtube-nocookie\.com\/embed\/abcdefghijk\?list=PL12345/);
  assert.match(resolveMusicEmbed('https://www.youtube.com/playlist?list=PL12345').url, /videoseries\?list=PL12345/);
});

test('SoundCloud links become official widget embeds', () => {
  const result = resolveMusicEmbed('https://soundcloud.com/artist/track-name');
  assert.match(result.url, /^https:\/\/w\.soundcloud\.com\/player\/\?url=/);
  assert.equal(result.ratio, 'soundcloud');
});

test('unsupported domains and invalid links fail with a helpful error', () => {
  assert.throws(() => resolveMusicEmbed('https://example.com/song'), /Supported sources/);
  assert.throws(() => resolveMusicEmbed('not a URL'), /valid music link/);
  assert.throws(() => resolveMusicEmbed('javascript:alert(1)'), /valid music link/);
});
