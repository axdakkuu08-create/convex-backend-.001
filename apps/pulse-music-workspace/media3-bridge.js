(function () {
  const capacitor = window.Capacitor;
  const nativePlatform =
    !!capacitor &&
    typeof capacitor.isNativePlatform === "function" &&
    capacitor.isNativePlatform();
  const plugin =
    nativePlatform &&
    capacitor.Plugins &&
    capacitor.Plugins.PulseMedia3;

  const bridge = {
    available: !!plugin,
    isNative: !!plugin,
    async loadTrack(track) {
      if (!plugin) return false;
      await plugin.loadTrack({
        url: track.url,
        title: track.title || "Pulse audio",
        artist: track.artist || "Unknown artist",
      });
      return true;
    },
    async play() {
      if (!plugin) return false;
      await plugin.play();
      return true;
    },
    async pause() {
      if (!plugin) return false;
      await plugin.pause();
      return true;
    },
    async seekTo(positionSeconds) {
      if (!plugin) return false;
      await plugin.seekTo({ positionSeconds });
      return true;
    },
    async setVolume(volume) {
      if (!plugin) return false;
      await plugin.setVolume({ volume });
      return true;
    },
    async getState() {
      if (!plugin) return null;
      return plugin.getState();
    },
    addStateListener(listener) {
      if (!plugin || typeof plugin.addListener !== "function") return null;
      return plugin.addListener("playbackState", listener);
    },
  };

  window.PulseMedia3 = bridge;
})();
