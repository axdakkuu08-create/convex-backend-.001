// Optional cloud playlists for the static Pulse frontend.
// Local playback and localStorage remain available when cloud config is absent.
const cloudStatus = document.getElementById("cloudStatus");
const signInButton = document.getElementById("cloudSignIn");
const signOutButton = document.getElementById("cloudSignOut");
const createButton = document.getElementById("cloudNewPlaylist");
const cloudList = document.getElementById("cloudPlaylists");
const config = window.PULSE_CONFIG || {};

function status(message) {
  if (cloudStatus) cloudStatus.textContent = message;
}
function escapeText(value) {
  return String(value ?? "").replace(
    /[&<>"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[char],
  );
}

if (!config.convexUrl || !config.clerkPublishableKey) {
  status("Cloud sync not configured · local mode is ready.");
  signInButton.hidden = true;
  signOutButton.hidden = true;
  createButton.hidden = true;
} else {
  startCloud();
}

async function startCloud() {
  try {
    const [{ Clerk }, { ConvexClient }, { makeFunctionReference }] =
      await Promise.all([
        import("https://esm.sh/@clerk/clerk-js@5"),
        import("https://esm.sh/convex@1.31.5/browser"),
        import("https://esm.sh/convex@1.31.5/server"),
      ]);
    const clerk = new Clerk(config.clerkPublishableKey);
    const convex = new ConvexClient(config.convexUrl);
    const listMine = makeFunctionReference("playlists:listMine");
    const createPlaylist = makeFunctionReference("playlists:create");
    const removePlaylist = makeFunctionReference("playlists:remove");
    const listSaved = makeFunctionReference("library:listSaved");
    const saveTrack = makeFunctionReference("library:saveTrack");
    const unsaveTrack = makeFunctionReference("library:unsaveTrack");
    const listRecent = makeFunctionReference("library:listRecent");
    const recordPlayed = makeFunctionReference("library:recordPlayed");
    const addPlaylistTrack = makeFunctionReference("library:addToPlaylist");
    let stopPlaylistUpdates = null;
    let authenticated = false;
    let migratedLocalLibrary = false;

    const renderPlaylists = (playlists) => {
      cloudList.replaceChildren();
      for (const playlist of playlists) {
        const row = document.createElement("div");
        row.className = "cloud-playlist-row";
        const name = document.createElement("span");
        name.textContent = playlist.name;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "cloud-delete";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Delete playlist " + playlist.name);
        remove.addEventListener("click", async () => {
          if (!confirm('Delete cloud playlist "' + playlist.name + '"?'))
            return;
          try {
            await convex.mutation(removePlaylist, { playlistId: playlist._id });
          } catch (error) {
            status(
              "Could not delete playlist: " +
                (error?.message || "unknown error"),
            );
          }
        });
        const addCurrent = document.createElement("button");
        addCurrent.type = "button";
        addCurrent.className = "cloud-delete";
        addCurrent.textContent = "+ current";
        addCurrent.setAttribute("aria-label", "Add current track to " + playlist.name);
        addCurrent.addEventListener("click", async () => {
          const track = window.PULSE_CURRENT_TRACK;
          if (!track) { status("Play a web audio track first to add it."); return; }
          try {
            await convex.mutation(addPlaylistTrack, { playlistId: playlist._id, title: track.title, artist: track.artist || undefined, source: track.source, sourceUrl: track.sourceUrl });
            status("Track added to " + playlist.name + ".");
          } catch (error) { status("Could not add track: " + (error?.message || "unknown error")); }
        });
        row.append(name, addCurrent, remove);
        cloudList.append(row);
      }
      if (!playlists.length) {
        const empty = document.createElement("p");
        empty.className = "cloud-empty";
        empty.textContent = "No cloud playlists yet.";
        cloudList.append(empty);
      }
    };

    const updateAuth = async () => {
      const user = clerk.user;
      authenticated = Boolean(user && clerk.session);
      signInButton.hidden = authenticated;
      signOutButton.hidden = !authenticated;
      createButton.hidden = !authenticated;
      if (!authenticated) {
        migratedLocalLibrary = false;
        if (stopPlaylistUpdates) stopPlaylistUpdates();
        stopPlaylistUpdates = null;
        cloudList.replaceChildren();
        status("Signed out · local mode remains available.");
        return;
      }
      status("Signed in · connecting cloud library…");
      if (!migratedLocalLibrary && typeof window.PULSE_EXPORT_LOCAL_LIBRARY === "function") {
        migratedLocalLibrary = true;
        const local = window.PULSE_EXPORT_LOCAL_LIBRARY();
        for (const track of local.liked) {
          try { await convex.mutation(saveTrack, track); } catch (error) { status("Some local favorites could not sync: " + (error?.message || "check connection")); }
        }
        for (const track of local.recent) {
          try { await convex.mutation(recordPlayed, track); } catch (error) { status("Some listening history could not sync: " + (error?.message || "check connection")); }
        }
      }
      if (stopPlaylistUpdates) stopPlaylistUpdates();
      stopPlaylistUpdates = convex.onUpdate(listMine, {}, renderPlaylists, (error) => status("Cloud playlist error: " + (error?.message || "check configuration")));
      const savedNode = document.getElementById("cloudSavedTracks");
      const recentNode = document.getElementById("cloudRecentTracks");
      const renderTrackLinks = (node, rows, emptyText) => {
        node.replaceChildren();
        if (!rows.length) { const p = document.createElement("p"); p.className = "cloud-empty"; p.textContent = emptyText; node.append(p); return; }
        for (const track of rows) {
          const a = document.createElement("a");
          a.href = track.sourceUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
          a.textContent = track.title + (track.artist ? " — " + track.artist : "");
          node.append(a);
        }
      };
      convex.onUpdate(listSaved, {}, rows => renderTrackLinks(savedNode, rows, "No saved tracks yet."), error => status("Saved library unavailable: " + (error?.message || "check setup")));
      convex.onUpdate(listRecent, {}, rows => renderTrackLinks(recentNode, rows, "No listening history yet."), error => status("Recent history unavailable: " + (error?.message || "check setup")));
    };

    const fetchToken = async ({ forceRefreshToken }) => {
      if (!clerk.session) return null;
      return clerk.session.getToken({
        template: "convex",
        skipCache: Boolean(forceRefreshToken),
      });
    };

    await clerk.load();
    convex.setAuth(fetchToken, (isAuthenticated) => {
      status(
        isAuthenticated
          ? "Signed in · cloud playlists are live."
          : "Sign in to enable cloud playlists.",
      );
    });
    clerk.addListener(() => {
      void updateAuth();
      convex.setAuth(fetchToken, (isAuthenticated) => {
        status(
          isAuthenticated
            ? "Signed in · cloud playlists are live."
            : "Sign in to enable cloud playlists.",
        );
      });
    });
    await updateAuth();

    window.addEventListener("pulse:track-liked", async (event) => {
      try { await convex.mutation(saveTrack, event.detail); status("Saved to your cloud library."); }
      catch (error) { status("Could not sync favorite: " + (error?.message || "local favorite is still saved")); }
    });
    window.addEventListener("pulse:track-unliked", async (event) => {
      try { const saved = await convex.query(listSaved, {}); const match = saved.find((item) => item.sourceUrl === event.detail.sourceUrl); if (match) await convex.mutation(unsaveTrack, { trackId: match._id }); }
      catch (error) { status("Could not remove cloud favorite: " + (error?.message || "unknown error")); }
    });
    window.addEventListener("pulse:track-played", async (event) => {
      try { await convex.mutation(recordPlayed, event.detail); }
      catch (error) { status("Listening history did not sync: " + (error?.message || "local playback continues")); }
    });
    signInButton.addEventListener("click", () => clerk.openSignIn());
    signOutButton.addEventListener("click", async () => {
      await clerk.signOut();
      await updateAuth();
    });
    createButton.addEventListener("click", async () => {
      const name = prompt("Name your cloud playlist");
      if (!name || !name.trim()) return;
      try {
        await convex.mutation(createPlaylist, {
          name: name.trim().slice(0, 80),
        });
        status("Cloud playlist created.");
      } catch (error) {
        status(
          "Could not create playlist: " +
            (error?.message || "check configuration"),
        );
      }
    });
  } catch (error) {
    console.error("Pulse cloud setup failed", error);
    status("Cloud setup unavailable · local mode still works.");
  }
}
