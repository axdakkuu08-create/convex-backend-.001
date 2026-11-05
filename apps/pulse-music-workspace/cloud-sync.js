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
    const addToPlaylist = makeFunctionReference("library:addToPlaylist");
    const listPlaylistTracks = makeFunctionReference(
      "library:listPlaylistTracks",
    );
    const removeFromPlaylist = makeFunctionReference(
      "library:removeFromPlaylist",
    );
    let currentPlaylists = [];
    let stopPlaylistUpdates = null;
    let authenticated = false;

    const renderPlaylists = (playlists) => {
      currentPlaylists = Array.isArray(playlists) ? playlists : [];
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
        const tracksButton = document.createElement("button");
        tracksButton.type = "button";
        tracksButton.className = "cloud-delete";
        tracksButton.textContent = "Tracks";
        tracksButton.addEventListener("click", async () => {
          try {
            const tracks = await convex.query(listPlaylistTracks, {
              playlistId: playlist._id,
            });
            if (!tracks.length) {
              status('"' + playlist.name + '" is empty.');
              return;
            }
            const listing = tracks
              .map(
                (track, index) =>
                  index +
                  1 +
                  ". " +
                  track.title +
                  " — " +
                  (track.artist || "Unknown artist"),
              )
              .join("\\n");
            const choice = prompt(
              'Tracks in "' +
                playlist.name +
                '". Enter a number to remove it, or Cancel to close:\\n' +
                listing,
            );
            if (!choice) return;
            const selected = tracks[Number(choice) - 1];
            if (!selected) return;
            await convex.mutation(removeFromPlaylist, {
              trackId: selected._id,
            });
            status("Track removed from cloud playlist.");
          } catch (error) {
            status(
              "Could not load cloud tracks: " +
                (error?.message || "unknown error"),
            );
          }
        });
        row.append(name, tracksButton, remove);
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
        if (stopPlaylistUpdates) stopPlaylistUpdates();
        stopPlaylistUpdates = null;
        cloudList.replaceChildren();
        status("Signed out · local mode remains available.");
        return;
      }
      status("Signed in · connecting cloud playlists…");
      if (stopPlaylistUpdates) stopPlaylistUpdates();
      stopPlaylistUpdates = convex.onUpdate(
        listMine,
        {},
        renderPlaylists,
        (error) =>
          status(
            "Cloud playlist error: " +
              (error?.message || "check configuration"),
          ),
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

    signInButton.addEventListener("click", () => clerk.openSignIn());
    signOutButton.addEventListener("click", async () => {
      await clerk.signOut();
      await updateAuth();
    });
    document.addEventListener("pulse:add-track-to-playlist", async (event) => {
      const track = event.detail || {};
      if (!authenticated || !track.src || !currentPlaylists.length) return;
      const choices = currentPlaylists
        .map((item, index) => index + 1 + ". " + item.name)
        .join("\\n");
      const answer = prompt(
        "Also save this track to a cloud playlist? Enter a number:\\n" +
          choices,
      );
      if (!answer) return;
      const playlist = currentPlaylists[Number(answer) - 1];
      if (!playlist) return;
      try {
        await convex.mutation(addToPlaylist, {
          playlistId: playlist._id,
          title: String(track.title || "Untitled track").slice(0, 200),
          artist: String(track.artist || "Unknown artist").slice(0, 200),
          source: "direct",
          sourceUrl: track.src,
          artworkUrl: track.artwork || undefined,
        });
        status("Track added to cloud playlist: " + playlist.name);
      } catch (error) {
        status("Cloud save failed: " + (error?.message || "unknown error"));
      }
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
