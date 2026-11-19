(function () {
  const capacitor = window.Capacitor;
  const nativePlatform =
    !!capacitor &&
    typeof capacitor.isNativePlatform === "function" &&
    capacitor.isNativePlatform();

  const pluginPromise = !nativePlatform
    ? Promise.resolve(null)
    : Promise.resolve().then(async () => {
        const legacyPlugin = capacitor.Plugins?.PulseMedia3;
        if (legacyPlugin) return legacyPlugin;
        const core = await import("./capacitor-core/index.js");
        if (typeof core.registerPlugin !== "function") {
          throw new Error("Bundled Capacitor registerPlugin API is unavailable");
        }
        return core.registerPlugin("PulseMedia3");
      });

  async function getPlugin() {
    const plugin = await pluginPromise;
    if (!plugin) {
      throw new Error(
        "PulseMedia3 native plugin is unavailable on this platform",
      );
    }
    return plugin;
  }

  const bridge = {
    available: nativePlatform,
    isNative: nativePlatform,
    async loadTrack(track) {
      const plugin = await getPlugin();
      await plugin.loadTrack({
        url: track.url,
        title: track.title || "Pulse audio",
        artist: track.artist || "Unknown artist",
      });
      return true;
    },
    async setQueue(
      tracks,
      startIndex = 0,
      startPositionSeconds = 0,
      shuffle = false,
      repeat = false,
    ) {
      const plugin = await getPlugin();
      await plugin.setQueue({
        tracks,
        startIndex,
        startPositionSeconds,
        shuffle,
        repeat,
      });
      return true;
    },
    async setShuffle(enabled) {
      const plugin = await getPlugin();
      await plugin.setShuffle({ enabled });
      return true;
    },
    async setRepeat(enabled) {
      const plugin = await getPlugin();
      await plugin.setRepeat({ enabled });
      return true;
    },
    async next() {
      const plugin = await getPlugin();
      await plugin.next();
      return true;
    },
    async previous() {
      const plugin = await getPlugin();
      await plugin.previous();
      return true;
    },
    async play() {
      const plugin = await getPlugin();
      await plugin.play();
      return true;
    },
    async pause() {
      const plugin = await getPlugin();
      await plugin.pause();
      return true;
    },
    async seekTo(positionSeconds) {
      const plugin = await getPlugin();
      await plugin.seekTo({ positionSeconds });
      return true;
    },
    async setVolume(volume) {
      const plugin = await getPlugin();
      await plugin.setVolume({ volume });
      return true;
    },
    async getState() {
      const plugin = await getPlugin();
      return plugin.getState();
    },
    addStateListener(listener) {
      if (!nativePlatform || typeof listener !== "function") return null;
      pluginPromise
        .then((plugin) => {
          if (plugin && typeof plugin.addListener === "function") {
            return plugin.addListener("playbackState", listener);
          }
          return null;
        })
        .catch((error) => {
          console.error("PulseMedia3 state listener unavailable", error);
        });
      return null;
    },
  };

  window.PulseMedia3 = bridge;
})();
