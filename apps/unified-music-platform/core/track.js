export const MIN_TRACK_DURATION_MS = 60_000;

/**
 * One library item may have multiple source references. A source URL is not a
 * durable track identity; providers can rotate or expire playable URLs.
 */
export function isEligibleDuration(durationMs) {
  return Number.isFinite(durationMs) && durationMs >= MIN_TRACK_DURATION_MS;
}

export function createTrack(input) {
  const durationMs = Number(input.durationMs);
  if (!isEligibleDuration(durationMs)) return null;

  const source = {
    provider: String(input.provider || "local"),
    sourceId: String(input.sourceId || input.id || ""),
    locator: String(input.locator || ""),
    mimeType: String(input.mimeType || "audio/*"),
    availability: input.availability || "session",
  };

  const identity = String(input.trackId || source.sourceId || input.id || "");
  if (!identity) throw new TypeError("A stable track identity is required.");

  return Object.freeze({
    id: identity,
    title: String(input.title || "Unknown title"),
    artist: String(input.artist || "Unknown artist"),
    album: String(input.album || "Unknown album"),
    artwork: String(input.artwork || ""),
    durationMs,
    addedAt: Number(input.addedAt) || Date.now(),
    playCount: Math.max(0, Number(input.playCount) || 0),
    favorite: Boolean(input.favorite),
    sources: Object.freeze([Object.freeze(source)]),
  });
}
