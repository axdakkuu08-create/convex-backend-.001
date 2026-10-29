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
    const getEasySongRequestStatus = makeFunctionReference(
      "easySong:getRequestStatus",
    );
    const licensingPanel = document.getElementById("licensingPanel");
    const licensingForm = document.getElementById("licensingStatusForm");
    const licensingInput = document.getElementById("licensingRequestId");
    const licensingStatus = document.getElementById("licensingStatus");
    const licensingButton = document.getElementById("licensingStatusButton");
    if (licensingPanel) licensingPanel.hidden = false;
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

    const updateAuth = async () => {
      const user = clerk.user;
      authenticated = Boolean(user && clerk.session);
      signInButton.hidden = authenticated;
      signOutButton.hidden = !authenticated;
      createButton.hidden = !authenticated;
      if (!authenticated) {
        if (licensingStatus)
          licensingStatus.textContent =
            "Sign in to check existing licensing request statuses.";
        if (licensingForm) licensingForm.hidden = true;
        if (stopPlaylistUpdates) stopPlaylistUpdates();
        stopPlaylistUpdates = null;
        cloudList.replaceChildren();
        status("Signed out · local mode remains available.");
        return;
      }
      status("Signed in · connecting cloud playlists…");
      if (licensingForm) licensingForm.hidden = false;
      if (licensingStatus)
        licensingStatus.textContent =
          "Ready to check an existing request. Server credentials are never sent to this browser.";
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

    if (licensingForm) {
      licensingForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const requestId = licensingInput?.value.trim() || "";
        if (!requestId) return;
        if (!clerk.session) {
          licensingStatus.textContent =
            "Sign in before checking a licensing request.";
          return;
        }
        licensingButton.disabled = true;
        licensingStatus.textContent = "Checking request status…";
        try {
          const result = await convex.action(getEasySongRequestStatus, {
            requestId,
          });
          licensingStatus.textContent =
            "Request " + result.requestId + " status: " + result.status;
        } catch (error) {
          licensingStatus.textContent =
            error?.message || "Could not check the request status.";
        } finally {
          licensingButton.disabled = false;
        }
      });
    }

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
