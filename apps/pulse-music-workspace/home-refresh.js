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
    const card=document.createElement("article"); card.className="home-grid-card";
    const open=document.createElement("button"); open.type="button"; open.className="home-art-open";
    open.dataset.homeDetailKind=kind; open.dataset.homeDetailIndex=String(index);
    const img=document.createElement("img"); img.className="home-grid-artwork"; img.alt=""; img.loading="lazy"; img.src=item.artwork||"";
    img.addEventListener("error",()=>{img.removeAttribute("src");img.classList.add("artwork-missing");},{once:true});
    const title=document.createElement("strong"); title.textContent=item.title||"Untitled";
    const sub=document.createElement("small"); sub.textContent=item.artist||item.subtitle||"";
    open.append(img,title,sub); card.append(open); return card;
  }
  function renderHomePlaylists() {
    const grid=$("#homePlaylistsGrid"); if(!grid)return;
    let lists=[]; try{const value=JSON.parse(localStorage.getItem(PLAYLIST_KEY)||"[]");lists=Array.isArray(value)?value:[];}catch(_){}
    grid.replaceChildren();
    if(!lists.length){const empty=document.createElement("p");empty.className="home-grid-empty";empty.textContent="Your playlists will appear here. Create a playlist or save a song to get started.";grid.append(empty);return;}
    lists.forEach((list,index)=>{
      const card=makeArtworkCard({title:list.name,artist:(list.tracks||[]).length+" songs",artwork:list.tracks?.find(t=>t.artwork)?.artwork||""},"playlist",index);
      const play=document.createElement("button");play.type="button";play.className="home-grid-play";play.textContent="▶";play.setAttribute("aria-label","Play "+list.name);
      play.addEventListener("click",()=>window.PulsePlaylistStore?.play?.(list.id));card.append(play);grid.append(card);
    });
  }
  function showHomeDetails(item,kind) {
    const dialog=$("#homeTrackDetails"),content=$("#homeDetailContent");if(!dialog||!content||!item)return;
    content.replaceChildren();
    const img=document.createElement("img");img.className="home-detail-artwork";img.src=item.artwork||"";img.alt="";
    const title=document.createElement("h2");title.id="homeDetailTitle";title.textContent=item.title||"Untitled";
    const artist=document.createElement("p");artist.textContent=item.artist||"";
    content.append(img,title,artist);
    if(kind==="song"&&item.preview){const play=document.createElement("button");play.type="button";play.textContent="▶ Play preview";play.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("pulse:play-catalog-track",{detail:{title:item.title,artist:item.artist,src:item.preview,url:item.url,artwork:item.artwork,source:"Apple/iTunes Top Songs"}})));content.append(play);}
    if(item.url){const link=document.createElement("a");link.href=item.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=kind==="album"?"Open album":"Open source";content.append(link);}
    if(kind==="song"){const save=document.createElement("button");save.type="button";save.textContent="＋ Add to playlist";save.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("pulse:add-track-to-playlist",{detail:{title:item.title,artist:item.artist,src:item.preview,url:item.url,artwork:item.artwork,source:"Apple/iTunes Top Songs"}})));content.append(save);}
    if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
  }
  async function loadHomeArtwork() {
    let prefs={};try{prefs=JSON.parse(localStorage.getItem("pulse.prefs")||"{}");}catch(_){}
    const country=String(prefs.country||"IN").toLowerCase();
    try{
      const response=await fetch("https://itunes.apple.com/"+country+"/rss/topsongs/limit=24/json",{headers:{Accept:"application/json"}});
      if(!response.ok)throw Error("Country chart unavailable");
      const payload=await response.json(),entries=payload.feed?.entry||[];
      const results=await Promise.all(entries.map(async entry=>{
        const title=entry["im:name"]?.label||"",artist=entry["im:artist"]?.label||"Unknown artist",artwork=(entry["im:image"]||[]).slice(-1)[0]?.label||"",url=entry.link?.attributes?.href||"https://music.apple.com/";
        if(!title)return null;
        try{
          const response=await fetch("https://itunes.apple.com/search?term="+encodeURIComponent(title+" "+artist)+"&country="+encodeURIComponent(country)+"&entity=song&limit=5&media=music",{headers:{Accept:"application/json"}});
          if(!response.ok)throw Error("Lookup unavailable");
          const data=await response.json(),exact=(data.results||[]).find(x=>(x.trackName||"").toLowerCase()===title.toLowerCase()&&(x.artistName||"").toLowerCase()===artist.toLowerCase())||(data.results||[])[0];
          return {title,artist,artwork:exact?.artworkUrl100?.replace("100x100bb","600x600bb")||artwork,preview:exact?.previewUrl||"",url:exact?.trackViewUrl||url,album:exact?.collectionName||"",albumUrl:exact?.collectionViewUrl||url,albumId:exact?.collectionId||exact?.collectionName||title};
        }catch(_){return {title,artist,artwork,preview:"",url,album:"",albumUrl:url,albumId:title};}
      }));
      homeTracks=results.filter(Boolean);
      const songs=$("#homeSongsGrid");if(songs){songs.replaceChildren();homeTracks.slice(0,12).forEach((item,i)=>{const card=makeArtworkCard(item,"song",i),play=document.createElement("button");play.type="button";play.className="home-grid-play";play.textContent="▶";play.setAttribute("aria-label","Play "+item.title);play.dataset.homeSongPlay=String(i);card.append(play);songs.append(card);});}
      const seen=new Set();homeAlbums=[];homeTracks.forEach(track=>{const key=String(track.albumId);if(!seen.has(key)){seen.add(key);homeAlbums.push({title:track.album||track.title,artist:track.artist,artwork:track.artwork,url:track.albumUrl});}});
      const albums=$("#homeAlbumsGrid");if(albums){albums.replaceChildren();homeAlbums.slice(0,8).forEach((item,i)=>albums.append(makeArtworkCard(item,"album",i)));}
    }catch(_){const songs=$("#homeSongsGrid");if(songs&&!songs.children.length){const empty=document.createElement("p");empty.className="home-grid-empty";empty.textContent="Music discovery is temporarily unavailable. Your saved playlists remain available.";songs.append(empty);}}
    renderHomePlaylists();
  }
  document.addEventListener("click",event=>{
    const detail=event.target.closest("[data-home-detail-index]");
    if(detail){const kind=detail.dataset.homeDetailKind,index=Number(detail.dataset.homeDetailIndex);
      if(kind==="song")showHomeDetails(homeTracks[index],kind);
      if(kind==="album")showHomeDetails(homeAlbums[index],kind);
      if(kind==="playlist"){let lists=[];try{lists=JSON.parse(localStorage.getItem(PLAYLIST_KEY)||"[]");}catch(_){}const list=lists[index];if(list)showHomeDetails({title:list.name,artist:(list.tracks||[]).length+" songs",artwork:list.tracks?.find(t=>t.artwork)?.artwork||""},kind);}
    }
    const play=event.target.closest("[data-home-song-play]");if(play){const item=homeTracks[Number(play.dataset.homeSongPlay)];if(item?.preview)window.dispatchEvent(new CustomEvent("pulse:play-catalog-track",{detail:{title:item.title,artist:item.artist,src:item.preview,url:item.url,artwork:item.artwork,source:"Apple/iTunes Top Songs"}}));else if(item?.url)window.open(item.url,"_blank","noopener,noreferrer");}
  });
  $("#homeDetailClose")?.addEventListener("click",()=>$("#homeTrackDetails")?.close?.());
  window.addEventListener("pulse:playlists-updated",renderHomePlaylists);
  renderHomePlaylists();void loadHomeArtwork();

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
