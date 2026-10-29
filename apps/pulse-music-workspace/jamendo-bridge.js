/* Shared-player bridge for the Jamendo source. Loaded after app.js. */
window.pulsePlayExternalTrack = function (track) {
  if (!track || !track.id || !track.audio) {
    throw new Error("This Jamendo track does not have a playable stream.");
  }
  const existingIndex = tracks.findIndex((item) => item.sourceUrl === track.audio || item.externalId === "jamendo:" + track.id);
  let targetIndex = existingIndex;
  if (targetIndex < 0) {
    const nextId = tracks.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    tracks.push({
      id: nextId,
      externalId: "jamendo:" + track.id,
      sourceUrl: track.audio,
      title: String(track.name || "Untitled track"),
      artist: String(track.artist_name || "Unknown artist"),
      mood: "Jamendo",
      time: Number.isFinite(Number(track.duration)) ? Math.floor(Number(track.duration) / 60) + ":" + String(Math.floor(Number(track.duration) % 60)).padStart(2, "0") : "0:00",
      cover: "green",
      symbol: "♫",
      src: track.audio,
      customUrl: true
    });
    targetIndex = tracks.length - 1;
  }
  setTrack(targetIndex, true);
  const status = document.getElementById("audioStatus");
  if (status) status.textContent = "Playing a Jamendo stream · " + String(track.name || "Untitled track");
};
