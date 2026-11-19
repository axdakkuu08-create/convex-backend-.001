/* Shared playlist queue contract. The main audio player owns playback. */
(() => {
  function buildQueue(playlist) {
    const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
    return tracks
      .filter(
        (track) =>
          track &&
          typeof track.src === "string" &&
          /^(https?:|blob:)/i.test(track.src),
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
        verificationStatus: String(track.verificationStatus || "UNAVAILABLE"),
        rightsReviewStatus: String(
          track.rightsReviewStatus || "REVIEW_REQUIRED",
        ),
        bytesTotal: Number(track.bytesTotal) || 0,
      }));
  }

  function nextIndex(current, length, options = {}) {
    if (!Number.isInteger(length) || length <= 0) return null;
    if (!Number.isInteger(current) || current < 0 || current >= length)
      return null;
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

  function previousIndex(current, length, options = {}) {
    if (!Number.isInteger(length) || length <= 0) return null;
    if (!Number.isInteger(current) || current < 0 || current >= length)
      return null;
    if (current > 0) return current - 1;
    return options.repeat ? length - 1 : null;
  }
  function removeTrackAt(queue, currentIndex, removeIndex) {
    if (
      !Array.isArray(queue) ||
      !Number.isInteger(removeIndex) ||
      removeIndex < 0 ||
      removeIndex >= queue.length
    )
      return null;
    const tracks = queue.filter((_, index) => index !== removeIndex);
    if (!tracks.length) return { tracks, currentIndex: 0 };
    let nextCurrentIndex = currentIndex;
    if (removeIndex < currentIndex) nextCurrentIndex -= 1;
    else if (removeIndex === currentIndex)
      nextCurrentIndex = Math.min(removeIndex, tracks.length - 1);
    nextCurrentIndex = Math.max(
      0,
      Math.min(nextCurrentIndex, tracks.length - 1),
    );
    return { tracks, currentIndex: nextCurrentIndex };
  }

  function start(playlist) {
    const tracks = buildQueue(playlist);
    if (!tracks.length) return Promise.resolve(false);
    const player = window.PulsePlayerBridge;
    if (typeof player?.playPlaylist !== "function")
      return Promise.resolve(false);
    return Promise.resolve()
      .then(() =>
        player.playPlaylist(String(playlist?.name || "Playlist"), tracks),
      )
      .then(
        (started) => started === true,
        () => false,
      );
  }

  window.PulsePlaylistPlayback = {
    buildQueue,
    nextIndex,
    previousIndex,
    removeTrackAt,
    start,
  };
})();
