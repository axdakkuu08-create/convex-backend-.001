/* Shared playlist queue contract. The main audio player owns playback. */
(() => {
  function buildQueue(playlist) {
    const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
    return tracks
      .filter(
        (track) =>
          track &&
          typeof track.src === "string" &&
          /^https?:\/\//i.test(track.src),
      )
      .map((track) => ({
        title: String(track.title || "Untitled track"),
        artist: String(track.artist || "Unknown artist"),
        src: track.src,
        catalogId: String(track.catalogId || ""),
        url: String(track.url || ""),
        artwork: String(track.artwork || ""),
        license: String(track.license || ""),
        source: String(track.source || "Saved playlist"),
        duration: String(track.duration || ""),
      }));
  }

  function nextIndex(current, length, options = {}) {
    if (!Number.isInteger(length) || length <= 0) return null;
    if (options.shuffle) {
      if (length === 1) return options.repeat ? 0 : null;
      let next = Math.floor(Math.random() * (length - 1));
      if (next >= current) next += 1;
      return next;
    }
    const next = current + 1;
    if (next < length) return next;
    return options.repeat ? 0 : null;
  }

  function start(playlist) {
    const tracks = buildQueue(playlist);
    if (!tracks.length) return false;
    window.dispatchEvent(
      new CustomEvent("pulse:play-playlist", {
        detail: {
          playlistName: String(playlist.name || "Playlist"),
          tracks,
        },
      }),
    );
    return true;
  }

  window.PulsePlaylistPlayback = { buildQueue, nextIndex, start };
})();
