const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'convex');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Convex schema defines playlists, playlist tracks, and saved tracks', () => {
  const schema = read('schema.ts');
  for (const table of ['playlists', 'playlistTracks', 'savedTracks']) {
    assert.match(schema, new RegExp(table + ':\\s*defineTable'));
  }
  for (const source of ['spotify', 'youtube', 'soundcloud', 'direct']) {
    assert.ok(schema.includes('v.literal("' + source + '")'));
  }
});

test('every backend module derives ownership from authenticated identity', () => {
  for (const file of ['playlists.ts', 'playlistTracks.ts', 'savedTracks.ts']) {
    const source = read(file);
    assert.match(source, /ctx\.auth\.getUserIdentity\(\)/, file + ' must read auth identity');
    assert.match(source, /if \(!identity\) throw new Error\("Sign in is required\."\)/, file + ' must reject anonymous callers');
    assert.match(source, /identity\.subject/, file + ' must derive owner from identity');
  }
});

test('playlist operations verify ownership before editing or deleting', () => {
  const source = read('playlists.ts');
  assert.match(source, /playlist\.ownerId !== ownerId/);
  assert.match(source, /for \(const track of tracks\) await ctx\.db\.delete\(track\._id\)/);
});

test('track mutations validate title and HTTP(S) URL and check ownership', () => {
  for (const file of ['playlistTracks.ts', 'savedTracks.ts']) {
    const source = read(file);
    assert.match(source, /Track title must be 1–200 characters/);
    assert.match(source, /Track URL must use http or https/);
    assert.match(source, /track\.ownerId !== ownerId/);
  }
});

test('browser entrypoint wires saved-track operations into the music player', () => {
  const entry = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.jsx'), 'utf8');
  const player = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(entry, /savedTracks:list/);
  assert.match(entry, /savedTracks:save/);
  assert.match(entry, /savedTracks:remove/);
  assert.match(entry, /pulse:library-toggle/);
  assert.match(player, /pulseGetLikedTracks/);
  assert.match(player, /pulse:library-toggle/);
});

test('passkey authentication is configured on both backend and browser entrypoint', () => {
  const auth = fs.readFileSync(path.join(root, 'auth.ts'), 'utf8');
  const authConfig = fs.readFileSync(path.join(root, 'auth.config.ts'), 'utf8');
  const http = fs.readFileSync(path.join(root, 'http.ts'), 'utf8');
  const schema = read('schema.ts');
  assert.match(auth, /convexAuth/);
  assert.match(auth, /Passkey/);
  assert.match(authConfig, /CONVEX_SITE_URL/);
  assert.match(http, /auth\.addHttpRoutes/);
  assert.match(schema, /authTables/);
});
