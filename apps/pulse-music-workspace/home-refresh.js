/* Mobile home interactions bridge into Pulse's existing player actions. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];

  function playTrack(id) {
    const row = $('.row[data-id="' + String(id).replace(/[^0-9]/g, "") + '"]');
    const play = row && $(".rowplay", row);
    if (play) play.click();
  }

  document.addEventListener("click", (event) => {
    const trackButton = event.target.closest("[data-home-track]");
    if (trackButton) {
      if (trackButton.dataset.homeAudio) {
        window.dispatchEvent(
          new CustomEvent("pulse:play-catalog-track", {
            detail: {
              title: trackButton.dataset.homeTitle,
              artist: trackButton.dataset.homeArtist,
              src: trackButton.dataset.homeAudio,
              url: trackButton.dataset.homeUrl,
              artwork: trackButton.dataset.homeArtwork,
              source: "Apple/iTunes Top Songs",
            },
          }),
        );
      } else if (trackButton.dataset.homeUrl) {
        window.open(
          trackButton.dataset.homeUrl,
          "_blank",
          "noopener,noreferrer",
        );
      } else {
        playTrack(trackButton.dataset.homeTrack);
      }
      return;
    }

    const moodButton = event.target.closest("[data-home-mood]");
    if (moodButton) {
      $$(".genre-chip").forEach((chip) =>
        chip.classList.toggle("selected", chip === moodButton),
      );
      const mood = moodButton.dataset.homeMood;
      const targetMood =
        mood === "Ambient" ? "Ambient" : mood === "Night" ? "Night" : mood;
      const existingMood = $('.mood[data-mood="' + targetMood + '"]');
      if (mood && existingMood) existingMood.click();
      else if (!mood) {
        const all = $("#allMoods");
        if (all) all.click();
      }
      return;
    }

    if (event.target.closest("#homeShuffle")) {
      const shuffle = $("#shuffleAll");
      if (shuffle) shuffle.click();
      return;
    }
    if (event.target.closest("#homeProfile")) {
      const signIn = $("#cloudSignIn");
      if (signIn && !signIn.hidden) signIn.click();
      else {
        document.body.classList.add("show-sourcehub");
        document.body.classList.remove("show-library");
      }
      return;
    }
    const mobileNav = event.target.closest("[data-mobile-view]");
    if (mobileNav) {
      const view = mobileNav.dataset.mobileView;
      document.body.classList.toggle("show-sourcehub", view === "search");
      document.body.classList.toggle("show-library", view === "library");
      $$(".mobile-bottom-nav button").forEach((button) =>
        button.classList.toggle("active", button === mobileNav),
      );
      if (view === "search") {
        const source = $("#sourceHub");
        if (source)
          source.scrollIntoView({ block: "start", behavior: "smooth" });
        const search = $("#unifiedQuery") || $("#search");
        if (search)
          setTimeout(() => search.focus({ preventScroll: true }), 250);
      }
      if (view === "library") {
        const library = $('.nav[data-view="library"]');
        if (library) library.click();
      }
      if (view === "home") {
        const discover = $('.nav[data-view="discover"]');
        if (discover) discover.click();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  });

  if (!$(".mobile-bottom-nav")) {
    const nav = document.createElement("nav");
    nav.className = "mobile-bottom-nav";
    nav.setAttribute("aria-label", "Main navigation");
    nav.innerHTML =
      '<button class="active" data-mobile-view="home"><span>⌂</span>Home</button><button data-mobile-view="search"><span>⌕</span>Search</button><button data-mobile-view="library"><span>▤</span>Library</button>';
    document.body.appendChild(nav);
  }

  const PLAYLIST_KEY = "pulse.localPlaylists.v1";
  let homeTracks = [];
  let homeAlbums = [];

  function makeArtworkCard(item, kind, index) {
    const card = document.createElement("article");
    card.className = "home-grid-card";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "home-art-open";
    open.dataset.homeDetailKind = kind;
    open.dataset.homeDetailIndex = String(index);

    const image = document.createElement("img");
    image.className = "home-grid-artwork";
    image.alt = "";
    image.loading = "lazy";
    image.src = item.artwork || "";
    image.addEventListener(
      "error",
      () => {
        image.removeAttribute("src");
        image.classList.add("artwork-missing");
      },
      { once: true },
    );

    const title = document.createElement("strong");
    title.textContent = item.title || "Untitled";
    const subtitle = document.createElement("small");
    subtitle.textContent = item.artist || item.subtitle || "";

    open.append(image, title, subtitle);
    card.append(open);
    return card;
  }

  function renderHomePlaylists() {
    const grid = $("#homePlaylistsGrid");
    if (!grid) return;

    let playlists = [];
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || "[]");
      playlists = Array.isArray(value) ? value : [];
    } catch (_) {}

    grid.replaceChildren();
    if (!playlists.length) {
      const empty = document.createElement("p");
      empty.className = "home-grid-empty";
      empty.textContent =
        "Your playlists will appear here. Create a playlist or save a song to get started.";
      grid.append(empty);
      return;
    }

    playlists.forEach((playlist, index) => {
      const card = makeArtworkCard(
        {
          title: playlist.name,
          artist: (playlist.tracks || []).length + " songs",
          artwork:
            playlist.tracks?.find((track) => track.artwork)?.artwork || "",
        },
        "playlist",
        index,
      );
      const play = document.createElement("button");
      play.type = "button";
      play.className = "home-grid-play";
      play.textContent = "▶";
      play.setAttribute("aria-label", "Play " + playlist.name);
      play.addEventListener("click", () =>
        window.PulsePlaylistStore?.play?.(playlist.id),
      );
      card.append(play);
      grid.append(card);
    });
  }

  function showHomeDetails(item, kind) {
    const dialog = $("#homeTrackDetails");
    const content = $("#homeDetailContent");
    if (!dialog || !content || !item) return;

    content.replaceChildren();
    const image = document.createElement("img");
    image.className = "home-detail-artwork";
    image.src = item.artwork || "";
    image.alt = "";

    const title = document.createElement("h2");
    title.id = "homeDetailTitle";
    title.textContent = item.title || "Untitled";

    const artist = document.createElement("p");
    artist.textContent = item.artist || "";
    content.append(image, title, artist);

    if (kind === "song" && item.preview) {
      const play = document.createElement("button");
      play.type = "button";
      play.textContent = "▶ Play preview";
      play.addEventListener("click", () =>
        window.dispatchEvent(
          new CustomEvent("pulse:play-catalog-track", {
            detail: {
              title: item.title,
              artist: item.artist,
              src: item.preview,
              url: item.url,
              artwork: item.artwork,
              source: "Apple/iTunes Top Songs",
            },
          }),
        ),
      );
      content.append(play);
    }

    if (item.url) {
      const source = document.createElement("a");
      source.href = item.url;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = kind === "album" ? "Open album" : "Open source";
      content.append(source);
    }

    if (kind === "song") {
      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "＋ Add to playlist";
      save.addEventListener("click", () =>
        window.dispatchEvent(
          new CustomEvent("pulse:add-track-to-playlist", {
            detail: {
              title: item.title,
              artist: item.artist,
              src: item.preview,
              url: item.url,
              artwork: item.artwork,
              source: "Apple/iTunes Top Songs",
            },
          }),
        ),
      );
      content.append(save);
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  async function loadHomeArtwork() {
    let preferences = {};
    try {
      preferences = JSON.parse(localStorage.getItem("pulse.prefs") || "{}");
    } catch (_) {}

    const country = String(preferences.country || "IN").toLowerCase();
    try {
      const response = await fetch(
        "https://itunes.apple.com/" + country + "/rss/topsongs/limit=24/json",
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Country chart unavailable");

      const payload = await response.json();
      const entries = payload.feed?.entry || [];
      const results = await Promise.all(
        entries.map(async (entry) => {
          const title = entry["im:name"]?.label || "";
          const artist = entry["im:artist"]?.label || "Unknown artist";
          const artwork = (entry["im:image"] || []).slice(-1)[0]?.label || "";
          const url =
            entry.link?.attributes?.href || "https://music.apple.com/";
          if (!title) return null;

          try {
            const lookup = await fetch(
              "https://itunes.apple.com/search?term=" +
                encodeURIComponent(title + " " + artist) +
                "&country=" +
                encodeURIComponent(country) +
                "&entity=song&limit=5&media=music",
              { headers: { Accept: "application/json" } },
            );
            if (!lookup.ok) throw new Error("Track lookup unavailable");

            const data = await lookup.json();
            const exact =
              (data.results || []).find(
                (item) =>
                  (item.trackName || "").toLowerCase() ===
                    title.toLowerCase() &&
                  (item.artistName || "").toLowerCase() ===
                    artist.toLowerCase(),
              ) || (data.results || [])[0];

            return {
              title,
              artist,
              artwork:
                exact?.artworkUrl100?.replace("100x100bb", "600x600bb") ||
                artwork,
              preview: exact?.previewUrl || "",
              url: exact?.trackViewUrl || url,
              album: exact?.collectionName || "",
              albumUrl: exact?.collectionViewUrl || url,
              albumId: exact?.collectionId || exact?.collectionName || title,
            };
          } catch (_) {
            return {
              title,
              artist,
              artwork,
              preview: "",
              url,
              album: "",
              albumUrl: url,
              albumId: title,
            };
          }
        }),
      );

      homeTracks = results.filter(Boolean);
      const songsGrid = $("#homeSongsGrid");
      if (songsGrid) {
        songsGrid.replaceChildren();
        homeTracks.slice(0, 12).forEach((item, index) => {
          const card = makeArtworkCard(item, "song", index);
          const play = document.createElement("button");
          play.type = "button";
          play.className = "home-grid-play";
          play.textContent = "▶";
          play.setAttribute("aria-label", "Play " + item.title);
          play.dataset.homeSongPlay = String(index);
          card.append(play);
          songsGrid.append(card);
        });
      }

      const seenAlbums = new Set();
      homeAlbums = [];
      homeTracks.forEach((track) => {
        const key = String(track.albumId);
        if (!seenAlbums.has(key)) {
          seenAlbums.add(key);
          homeAlbums.push({
            title: track.album || track.title,
            artist: track.artist,
            artwork: track.artwork,
            url: track.albumUrl,
          });
        }
      });

      const albumsGrid = $("#homeAlbumsGrid");
      if (albumsGrid) {
        albumsGrid.replaceChildren();
        homeAlbums.slice(0, 8).forEach((item, index) => {
          albumsGrid.append(makeArtworkCard(item, "album", index));
        });
      }
    } catch (_) {
      const songsGrid = $("#homeSongsGrid");
      if (songsGrid && !songsGrid.children.length) {
        const empty = document.createElement("p");
        empty.className = "home-grid-empty";
        empty.textContent =
          "Music discovery is temporarily unavailable. Your saved playlists remain available.";
        songsGrid.append(empty);
      }
    }

    renderHomePlaylists();
  }

  document.addEventListener("click", (event) => {
    const detailButton = event.target.closest("[data-home-detail-index]");
    if (detailButton) {
      const kind = detailButton.dataset.homeDetailKind;
      const index = Number(detailButton.dataset.homeDetailIndex);

      if (kind === "song") showHomeDetails(homeTracks[index], kind);
      if (kind === "album") showHomeDetails(homeAlbums[index], kind);
      if (kind === "playlist") {
        let playlists = [];
        try {
          playlists = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || "[]");
        } catch (_) {}
        const playlist = playlists[index];
        if (playlist) {
          showHomeDetails(
            {
              title: playlist.name,
              artist: (playlist.tracks || []).length + " songs",
              artwork:
                playlist.tracks?.find((track) => track.artwork)?.artwork || "",
            },
            kind,
          );
        }
      }
    }

    const playButton = event.target.closest("[data-home-song-play]");
    if (playButton) {
      const item = homeTracks[Number(playButton.dataset.homeSongPlay)];
      if (item?.preview) {
        window.dispatchEvent(
          new CustomEvent("pulse:play-catalog-track", {
            detail: {
              title: item.title,
              artist: item.artist,
              src: item.preview,
              url: item.url,
              artwork: item.artwork,
              source: "Apple/iTunes Top Songs",
            },
          }),
        );
      } else if (item?.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    }
  });

  $("#homeDetailClose")?.addEventListener("click", () =>
    $("#homeTrackDetails")?.close?.(),
  );
  window.addEventListener("pulse:playlists-updated", renderHomePlaylists);
  renderHomePlaylists();

  window.addEventListener("pulse:preferences-changed", () => {
    void loadHomeArtwork();
  });

  const artworkStyle = document.createElement("style");
  artworkStyle.textContent = `
    .featured-card { position: relative; overflow: hidden; isolation: isolate; }
    .featured-card .home-real-artwork { position:absolute; inset:0; z-index:-1; width:100%; height:100%; object-fit:cover; opacity:.82; }
    .featured-card:has(.home-real-artwork)::after { content:""; position:absolute; inset:0; z-index:-1; background:linear-gradient(180deg,rgba(9,10,15,.08),rgba(9,10,15,.86)); pointer-events:none; }
    .featured-card:has(.home-real-artwork) .art-label,
    .featured-card:has(.home-real-artwork) .art-title,
    .featured-card:has(.home-real-artwork) .featured-caption { position:relative; z-index:1; text-shadow:0 1px 8px rgba(0,0,0,.65); }
    @media(max-width:760px) {
      body { padding-bottom: calc(78px + env(safe-area-inset-bottom)); }
      .mobile-bottom-nav { padding-bottom: env(safe-area-inset-bottom); }
      .mobile-bottom-nav button { min-height:54px; touch-action:manipulation; }
      .player { padding-bottom: max(10px, env(safe-area-inset-bottom)); }
      button, input, a { touch-action:manipulation; }
      .source-input-row { gap:8px; }
      .source-input-row input { min-width:0; }
      .source-input-row button { min-height:44px; }
      .catalog-result { grid-template-columns:56px minmax(0,1fr); }
      .catalog-result .catalog-preview, .catalog-result .catalog-open { grid-column:2; justify-self:start; }
    }
    @media(prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; transition:none!important; } }
  `;
  document.head.append(artworkStyle);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHomeArtwork, {
      once: true,
    });
  } else {
    void loadHomeArtwork();
  }
})();
