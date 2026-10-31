/* Mobile home interactions bridge into Pulse's existing player actions. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function playTrack(id) {
    const row = $('.row[data-id="' + String(id).replace(/[^0-9]/g, "") + '"]');
    const play = row && $(".rowplay", row);
    if (play) play.click();
  }

  document.addEventListener("click", (event) => {
    const trackButton = event.target.closest("[data-home-track]");
    if (trackButton) {
      if (trackButton.dataset.homeAudio) {
        window.dispatchEvent(new CustomEvent("pulse:play-catalog-track", { detail: {
          title: trackButton.dataset.homeTitle,
          artist: trackButton.dataset.homeArtist,
          src: trackButton.dataset.homeAudio,
          url: trackButton.dataset.homeUrl,
          artwork: trackButton.dataset.homeArtwork,
          source: "Apple/iTunes Top Songs"
        }}));
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
        if (source) source.scrollIntoView({ block: "start", behavior: "smooth" });
        const search = $("#unifiedQuery") || $("#search");
        if (search) setTimeout(() => search.focus({ preventScroll: true }), 250);
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

  // Load genuine country-chart songs into the mobile home instead of demo-only cards.
  async function loadHomeArtwork() {
    const cards = $$(".featured-card[data-home-track]");
    const speedTracks = $$(".speed-track[data-home-track]");
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem("pulse.prefs") || "{}"); } catch (_) {}
    const country = String(prefs.country || "IN").toLowerCase();
    try {
      const response = await fetch("https://itunes.apple.com/" + country + "/rss/topsongs/limit=10/json", {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Country chart unavailable");
      const payload = await response.json();
      const entries = payload.feed?.entry || [];
      const popular = entries.slice(0, Math.max(cards.length, speedTracks.length));
      const hydrated = await Promise.all(popular.map(async (entry) => {
        const title = entry["im:name"]?.label || "";
        const artist = entry["im:artist"]?.label || "Unknown artist";
        const artwork = (entry["im:image"] || []).slice(-1)[0]?.label || "";
        const url = entry.link?.attributes?.href || "https://music.apple.com/";
        if (!title) return null;
        try {
          const lookup = await fetch("https://itunes.apple.com/search?term=" +
            encodeURIComponent(title + " " + artist) + "&country=" + encodeURIComponent(country) +
            "&entity=song&limit=5&media=music", { headers: { Accept: "application/json" } });
          if (!lookup.ok) throw new Error("Track lookup unavailable");
          const data = await lookup.json();
          const exact = (data.results || []).find((item) =>
            (item.trackName || "").toLowerCase() === title.toLowerCase() &&
            (item.artistName || "").toLowerCase() === artist.toLowerCase()
          ) || (data.results || [])[0];
          return {
            title, artist, artwork: exact?.artworkUrl100?.replace("100x100bb", "600x600bb") || artwork,
            preview: exact?.previewUrl || "", url: exact?.trackViewUrl || url
          };
        } catch (_) {
          return { title, artist, artwork, preview: "", url };
        }
      }));
      const tracks = hydrated.filter(Boolean);
      function applyTrack(element, item, isFeatured) {
        if (!element || !item) return;
        element.dataset.homeTitle = item.title;
        element.dataset.homeArtist = item.artist;
        element.dataset.homeAudio = item.preview;
        element.dataset.homeUrl = item.url;
        element.dataset.homeArtwork = item.artwork;
        if (isFeatured) {
          const title = $(".featured-caption b", element);
          const artist = $(".featured-caption small", element);
          const artTitle = $(".art-title", element);
          if (title) title.textContent = item.title;
          if (artist) artist.textContent = item.artist;
          if (artTitle) artTitle.textContent = item.title.toUpperCase();
          if (item.artwork) {
            const image = document.createElement("img");
            image.className = "home-real-artwork";
            image.src = item.artwork;
            image.alt = "";
            image.loading = "lazy";
            image.addEventListener("error", () => image.remove(), { once: true });
            $(".home-real-artwork", element)?.remove();
            element.prepend(image);
          }
        } else {
          const title = $(".speed-copy b", element);
          const artist = $(".speed-copy small", element);
          if (title) title.textContent = item.title;
          if (artist) artist.textContent = item.artist;
        }
      }
      cards.forEach((card, index) => applyTrack(card, tracks[index], true));
      speedTracks.forEach((row, index) => applyTrack(row, tracks[index + cards.length], false));
    } catch (_) {
      // Keep the existing offline/demo home if the public chart endpoint is unavailable.
    }
  }

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
    document.addEventListener("DOMContentLoaded", loadHomeArtwork, { once: true });
  } else {
    void loadHomeArtwork();
  }
})();
