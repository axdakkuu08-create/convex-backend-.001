/* Pulse four-destination UI adapter. Existing playback, catalog, auth and storage modules remain authoritative. */
(() => {
  const $ = (id) => document.getElementById(id);
  const main = document.querySelector("main");
  const home = $("homeFront");
  const searchView = $("pulseSearchView");
  const libraryView = $("pulseLibraryView");
  const profileView = $("pulseProfileView");
  const searchMount = $("pulseSearchMount");
  const libraryTracksMount = $("pulseLibraryTracksMount");
  const playlistMount = $("pulseLibraryPlaylistMount");
  const cloudMount = $("pulseCloudMount");
  const sourceHub = $("sourceHub");
  const tracks = document.querySelector(".tracks");
  const savedPlaylists = $("savedPlaylists");
  const cloudAccount = document.querySelector(".cloud-account");
  const createPlaylist = $("newPlaylist");
  const player = document.querySelector(".player");
  if (!main || !home || !searchView || !libraryView || !profileView) return;

  if (sourceHub && searchMount) searchMount.append(sourceHub);
  if (tracks && libraryTracksMount) libraryTracksMount.append(tracks);
  if (savedPlaylists && playlistMount) playlistMount.append(savedPlaylists);
  if (cloudAccount && cloudMount) cloudMount.append(cloudAccount);
  const createButton = $("pulseCreatePlaylist");
  if (createButton && createPlaylist) {
    createButton.addEventListener("click", () => createPlaylist.click());
  }

  const legacyChrome = Array.from(main.children).filter((node) => {
    if (node.tagName === "HEADER" || node.tagName === "FOOTER") return true;
    if (node.tagName !== "SECTION") return false;
    return !["homeFront", "pulseSearchView", "pulseLibraryView", "pulseProfileView"].includes(node.id);
  });

  function show(view) {
    const isHome = view === "home";
    home.hidden = !isHome;
    searchView.hidden = view !== "search";
    libraryView.hidden = view !== "library";
    profileView.hidden = view !== "profile";
    legacyChrome.forEach((node) => { node.hidden = true; });
    const legacyView = document.querySelector(
      '.sidebar > .nav[data-view="' + (view === "library" ? "library" : "discover") + '"]',
    );
    if (legacyView) legacyView.click();
    document.querySelectorAll("[data-pulse-view]").forEach((button) => {
      const active = button.dataset.pulseView === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.body.dataset.pulseView = view;
    if (view === "library" && window.PulsePlaylistStore) {
      window.PulsePlaylistStore.render();
    }
  }

  document.querySelectorAll("[data-pulse-view]").forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.pulseView));
  });
  const profileShortcut = $("homeProfile");
  if (profileShortcut) profileShortcut.addEventListener("click", () => show("profile"));

  const expandTrigger = $("pulseExpandPlayer");
  if (expandTrigger && player) {
    const toggleExpanded = (event) => {
      if (event.target.closest("#like")) return;
      player.classList.toggle("expanded");
      player.setAttribute("aria-expanded", String(player.classList.contains("expanded")));
    };
    expandTrigger.addEventListener("click", toggleExpanded);
    expandTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleExpanded(event);
      }
    });
  }
  const miniQueue = $("queue");
  if (miniQueue) miniQueue.addEventListener("click", () => player?.classList.add("expanded"));
  const queueClose = $("queueClose");
  if (queueClose) queueClose.addEventListener("click", () => player?.classList.remove("expanded"));

  show("home");
})();
