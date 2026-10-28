// Optional cloud playlists for the static Pulse frontend.
// Local playback and localStorage remain available when cloud config is absent.
const cloudStatus = document.getElementById("cloudStatus");
const signInButton = document.getElementById("cloudSignIn");
const signOutButton = document.getElementById("cloudSignOut");
const createButton = document.getElementById("cloudNewPlaylist");
const cloudList = document.getElementById("cloudPlaylists");
const cloudSavedList = document.getElementById("cloudSavedTracks");
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
    let savedByUrl = new Map();
    let stopSavedUpdates = null;
    let stopPlaylistUpdates = null;
    let authenticated = false;

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
        row.append(name, remove);
        cloudList.append(row);
      }
      if (!playlists.length) {
        const empty = document.createElement("p");
        empty.className = "cloud-empty";
        empty.textContent = "No cloud playlists yet.";
        cloudList.append(empty);
      }
    };

    const renderSavedTracks = (savedTracks) => {
      savedByUrl = new Map(savedTracks.map((track) => [track.sourceUrl, track]));
      window.dispatchEvent(new CustomEvent("pulse:cloud-favourites", {
        detail: { urls: savedTracks.map((track) => track.sourceUrl) },
      }));
      if (!cloudSavedList) return;
      cloudSavedList.replaceChildren();
      for (const track of savedTracks) {
        const row = document.createElement("div");
        row.className = "cloud-playlist-row";
        const name = document.createElement("span");
        name.textContent = track.title + (track.artist ? " · " + track.artist : "");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "cloud-delete";
        remove.textContent = "♥";
        remove.setAttribute("aria-label", "Remove favourite " + track.title);
        remove.addEventListener("click", async () => {
          try {
            await convex.mutation(unsaveTrack, { trackId: track._id });
            status("Favourite removed from your cloud library.");
          } catch (error) {
            status("Could not remove favourite: " + (error?.message || "unknown error"));
          }
        });
        row.append(name, remove);
        cloudSavedList.append(row);
      }
      if (!savedTracks.length) {
        const empty = document.createElement("p");
        empty.className = "cloud-empty";
        empty.textContent = "No cloud favourites yet. Like an online track to save it here.";
        cloudSavedList.append(empty);
      }
    };

    const updateAuth = async () => {
      const user = clerk.user;
      authenticated = Boolean(user && clerk.session);
      signInButton.hidden = authenticated;
      signOutButton.hidden = !authenticated;
      createButton.hidden = !authenticated;
      if (!authenticated) {
        if (stopPlaylistUpdates) stopPlaylistUpdates();
        if (stopSavedUpdates) stopSavedUpdates();
        stopPlaylistUpdates = null;
        stopSavedUpdates = null;
        savedByUrl.clear();
        cloudList.replaceChildren();
        if (cloudSavedList) cloudSavedList.replaceChildren();
        status("Signed out · local mode remains available.");
        return;
      }
      status("Signed in · connecting cloud playlists…");
      if (stopPlaylistUpdates) stopPlaylistUpdates();
      stopPlaylistUpdates = convex.onUpdate(
        listMine,
        {},
        renderPlaylists,
        (error) => status("Cloud playlist error: " + (error?.message || "check configuration")),
      );
      if (stopSavedUpdates) stopSavedUpdates();
      stopSavedUpdates = convex.onUpdate(
        listSaved,
        {},
        renderSavedTracks,
        (error) => status("Cloud favourites error: " + (error?.message || "check configuration")),
      );
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

    window.addEventListener("pulse:favourite-change", async (event) => {
      if (!authenticated) return;
      const detail = event.detail || {};
      const track = detail.track || {};
      const sourceUrl = track.src || "";
      if (!/^https?:\/\//i.test(sourceUrl)) {
        status("This favourite is device-only. Cloud favourites need an online audio URL.");
        return;
      }
      try {
        if (detail.saved) {
          const trackId = await convex.mutation(saveTrack, {
            title: String(track.title || "Untitled track").slice(0, 200),
            artist: String(track.artist || "").slice(0, 200),
            source: "direct",
            sourceUrl,
            ...(track.artwork ? { artworkUrl: track.artwork } : {}),
          });
          savedByUrl.set(sourceUrl, { _id: trackId, title: track.title, artist: track.artist, sourceUrl });
          status("Favourite saved to your cloud library.");
        } else {
          let saved = savedByUrl.get(sourceUrl);
          if (!saved) {
            const current = await convex.query(listSaved, {});
            saved = current.find((item) => item.sourceUrl === sourceUrl);
          }
          if (saved) await convex.mutation(unsaveTrack, { trackId: saved._id });
          savedByUrl.delete(sourceUrl);
          status("Favourite removed from your cloud library.");
        }
      } catch (error) {
        status("Cloud favourite could not sync: " + (error?.message || "check configuration"));
      }
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
