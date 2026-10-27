// Local custom playlists and albums for Pulse. Kept independent from provider playback and optional cloud sync.
(() => {
  const key = "pulse-custom-collections-v1";
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{"playlists":[],"albums":[]}');
      return { playlists: Array.isArray(value.playlists) ? value.playlists : [], albums: Array.isArray(value.albums) ? value.albums : [] };
    } catch (_) { return { playlists: [], albums: [] }; }
  };
  const save = (data) => localStorage.setItem(key, JSON.stringify(data));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const style = document.createElement("style");
  style.textContent = `
    .pulse-collections{margin:20px 0;padding:18px;border:1px solid #2b2c34;border-radius:16px;background:#191a20}
    .pulse-collections h3{margin:0 0 10px;font-size:18px}.pulse-collection-actions{display:flex;gap:8px;flex-wrap:wrap}
    .pulse-collection-actions button,.pulse-collection-item button{border:1px solid #3a3b44;background:#24262d;color:#f4f4f6;border-radius:9px;padding:9px 12px}
    .pulse-collection-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #2b2c34}
    .pulse-collection-item small{display:block;color:#8b8d99;margin-top:3px}.pulse-collection-list{margin-top:10px}
  `;
  document.head.append(style);
  const panel = document.createElement("section");
  panel.className = "pulse-collections";
  panel.innerHTML = '<h3>Your playlists & albums</h3><p style="color:#8b8d99;margin:0 0 14px">Create personal collections, including an album with just one song.</p><div class="pulse-collection-actions"><button id="pulseMakePlaylist">＋ New playlist</button><button id="pulseMakeAlbum">＋ Single-song album</button></div><div id="pulseCollectionList" class="pulse-collection-list"></div><p style="color:#8b8d99;font-size:12px;margin:12px 0 0">Saved on this device. Cloud sync for these custom collections is not connected yet.</p>';
  const anchor = document.querySelector(".tracks");
  if (anchor) anchor.insertAdjacentElement("beforebegin", panel);
  const list = panel.querySelector("#pulseCollectionList");
  function render() {
    const data = read();
    const rows = [
      ...data.playlists.map((item, i) => ({...item, kind:"Playlist", key:"playlists", index:i})),
      ...data.albums.map((item, i) => ({...item, kind:"Album", key:"albums", index:i}))
    ];
    list.innerHTML = rows.length ? rows.map(item => '<div class="pulse-collection-item"><div><strong>'+esc(item.name)+'</strong><small>'+item.kind+' · '+(item.tracks?.length || 0)+' track(s)'+(item.tracks?.length ? ' · '+esc(item.tracks.map(t=>t.title).join(", ")) : '')+'</small></div><button type="button" data-remove="'+item.key+'" data-index="'+item.index+'">Delete</button></div>').join("") : '<p style="color:#8b8d99">No custom collections yet.</p>';
  }
  function currentTrack() {
    const title = document.getElementById("nowTitle")?.textContent?.trim();
    const artist = document.getElementById("nowArtist")?.textContent?.trim();
    if (!title) return null;
    return { title, artist: artist || "Unknown artist" };
  }
  panel.querySelector("#pulseMakePlaylist").addEventListener("click", () => {
    const name = prompt("Name your playlist");
    if (!name?.trim()) return;
    const data = read(); data.playlists.push({ id: Date.now(), name: name.trim().slice(0,80), tracks: [] }); save(data); render();
  });
  panel.querySelector("#pulseMakeAlbum").addEventListener("click", () => {
    const track = currentTrack();
    if (!track) { alert("Choose a track first."); return; }
    const name = prompt("Name your single-song album", track.title);
    if (!name?.trim()) return;
    const data = read(); data.albums.push({ id: Date.now(), name: name.trim().slice(0,80), tracks: [track] }); save(data); render();
  });
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    const data = read(); data[button.dataset.remove].splice(Number(button.dataset.index),1); save(data); render();
  });
  // Add an explicit action to the currently selected track's collection.
  const addCurrent = document.createElement("button");
  addCurrent.type = "button"; addCurrent.textContent = "＋ Add current track";
  addCurrent.addEventListener("click", () => {
    const track = currentTrack(); if (!track) return;
    const data = read();
    if (!data.playlists.length) {
      const name = prompt("No playlist exists yet. Name a new playlist");
      if (!name?.trim()) return;
      data.playlists.push({ id: Date.now(), name: name.trim().slice(0,80), tracks: [] });
    }
    const choices = data.playlists.map((p,i)=>i+" — "+p.name).join("\n");
    const choice = prompt("Choose playlist number:\n"+choices, "0");
    if (choice === null) return;
    const target = data.playlists[Number(choice)];
    if (!target) { alert("That playlist number is not valid."); return; }
    if (!target.tracks.some(t=>t.title===track.title && t.artist===track.artist)) target.tracks.push(track);
    save(data); render();
  });
  panel.querySelector(".pulse-collection-actions").append(addCurrent);
  render();
})();