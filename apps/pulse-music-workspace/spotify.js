(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const CLIENT_KEY = "pulse-spotify-client-id";
  const TOKEN_KEY = "pulse-spotify-token";
  const VERIFIER_KEY = "pulse-spotify-pkce-verifier";
  const STATE_KEY = "pulse-spotify-oauth-state";
  const REDIRECT_URI = window.location.origin + window.location.pathname;
  const SCOPES = [
    "streaming",
    "user-read-private",
    "user-read-email",
    "user-library-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");
  let token = null;
  let player = null;
  let deviceId = null;
  let currentUri = null;
  let busy = false;

  const setStatus = (message) => {
    $("spotifyStatus").textContent = message;
  };
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  const randomString = (length = 64) => {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(
      bytes,
      (x) =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[
          x % 66
        ],
    ).join("");
  };
  async function challengeFor(verifier) {
    return b64url(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    );
  }
  function getClientId() {
    return (
      $("spotifyClientId").value ||
      localStorage.getItem(CLIENT_KEY) ||
      ""
    ).trim();
  }
  function setBusy(value) {
    busy = value;
    $("spotifyConnect").disabled = value;
    $("spotifyRefresh").disabled = value;
  }
  function readToken() {
    try {
      const stored = sessionStorage.getItem(TOKEN_KEY);
      token = stored ? JSON.parse(stored) : null;
      if (token && token.expires_at <= Date.now() + 30000) token = null;
    } catch (_) {
      token = null;
    }
    return token;
  }
  async function spotifyFetch(path, options = {}) {
    if (!token || token.expires_at <= Date.now())
      throw new Error("Spotify session expired. Please connect again.");
    const response = await fetch("https://api.spotify.com/v1" + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token.access_token,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      token = null;
      throw new Error("Spotify authorization expired. Please connect again.");
    }
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json()).error?.message || "";
      } catch (_) {}
      throw new Error(
        "Spotify API returned " +
          response.status +
          (detail ? ": " + detail : "") +
          ".",
      );
    }
    if (response.status === 204) return null;
    return response.json();
  }
  async function authorize() {
    const clientId = getClientId();
    if (!clientId) {
      setStatus(
        "Add your Spotify app Client ID first. This is public configuration, not a secret.",
      );
      $("spotifyClientId").focus();
      return;
    }
    if (!window.isSecureContext) {
      setStatus(
        "Spotify connection requires HTTPS (or localhost). Open the secure Pulse Preview URL.",
      );
      return;
    }
    const verifier = randomString(64);
    const state = randomString(32);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state,
      code_challenge_method: "S256",
      code_challenge: await challengeFor(verifier),
    });
    window.location.assign(
      "https://accounts.spotify.com/authorize?" + params.toString(),
    );
  }
  async function handleCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const authError = url.searchParams.get("error");
    if (!code && !authError) return false;
    history.replaceState({}, document.title, REDIRECT_URI);
    if (authError) {
      setStatus(
        "Spotify connection was cancelled or denied: " + authError + ".",
      );
      return true;
    }
    const expectedState = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    if (!expectedState || returnedState !== expectedState || !verifier) {
      setStatus("Spotify sign-in could not be verified. Please connect again.");
      return true;
    }
    const clientId = getClientId();
    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error_description || data.error || "Token exchange failed",
        );
      token = {
        ...data,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      };
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
      setStatus("Spotify connected. Loading playlists and saved tracks…");
    } catch (error) {
      setStatus(
        "Spotify sign-in failed: " +
          error.message +
          ". Check the exact redirect URI in your Spotify app settings.",
      );
    }
    return true;
  }
  function loadSdk() {
    if (window.Spotify) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const previous = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        if (typeof previous === "function") previous();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () =>
        reject(
          new Error(
            "Spotify player SDK could not load. Check your connection or content blockers.",
          ),
        );
      document.head.appendChild(script);
    });
  }
  async function startPlayer() {
    if (player || !token) return;
    $("spotifyPlayerWrap").hidden = false;
    $("spotifyDeviceStatus").textContent = "Loading official player…";
    try {
      await loadSdk();
      player = new Spotify.Player({
        name: "Pulse Web Player",
        getOAuthToken: (callback) => callback(token?.access_token || ""),
        volume: 0.75,
      });
      player.addListener("ready", ({ device_id }) => {
        deviceId = device_id;
        $("spotifyDeviceStatus").textContent = "Ready · Pulse Web Player";
      });
      player.addListener("not_ready", () => {
        deviceId = null;
        $("spotifyDeviceStatus").textContent = "Player temporarily offline";
      });
      player.addListener(
        "initialization_error",
        ({ message }) =>
          ($("spotifyDeviceStatus").textContent = "Player setup: " + message),
      );
      player.addListener(
        "authentication_error",
        ({ message }) =>
          ($("spotifyDeviceStatus").textContent = "Auth error: " + message),
      );
      player.addListener(
        "account_error",
        () =>
          ($("spotifyDeviceStatus").textContent =
            "Spotify Premium is required for full-track browser playback."),
      );
      player.addListener(
        "playback_error",
        ({ message }) =>
          ($("spotifyDeviceStatus").textContent = "Playback error: " + message),
      );
      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        const t = state.track_window.current_track;
        $("spotifyCurrent").textContent = t
          ? t.name + " — " + t.artists.map((a) => a.name).join(", ")
          : "Nothing playing";
        $("spotifyPlayPause").textContent = state.paused ? "Play" : "Pause";
        currentUri = t?.uri || currentUri;
      });
      await player.connect();
      $("spotifyDeviceStatus").textContent = "Connecting…";
    } catch (error) {
      $("spotifyDeviceStatus").textContent = error.message;
    }
  }
  function renderItems(target, items, emptyMessage, onClick) {
    const node = $(target);
    if (!items.length) {
      node.innerHTML =
        '<p class="spotify-empty">' + safe(emptyMessage) + "</p>";
      return;
    }
    node.innerHTML = items
      .map(
        (item, i) =>
          '<button class="spotify-item" type="button" data-index="' +
          i +
          '">' +
          "<span>" +
          safe(item.title) +
          "<small>" +
          safe(item.subtitle || "") +
          "</small></span><b>›</b></button>",
      )
      .join("");
    node
      .querySelectorAll("button")
      .forEach((button, i) =>
        button.addEventListener("click", () => onClick(items[i])),
      );
  }
  async function loadLibrary() {
    setBusy(true);
    try {
      const [playlists, saved] = await Promise.all([
        spotifyFetch("/me/playlists?limit=50"),
        spotifyFetch("/me/tracks?limit=50"),
      ]);
      const playlistItems = (playlists.items || []).map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: (p.tracks?.total ?? 0) + " tracks · playlist",
        type: "playlist",
      }));
      const savedItems = (saved.items || [])
        .map((row) => row.track)
        .filter(Boolean)
        .map((t) => ({
          id: t.id,
          uri: t.uri,
          title: t.name,
          subtitle: (t.artists || []).map((a) => a.name).join(", "),
          type: "track",
        }));
      $("spotifyLibrary").hidden = false;
      renderItems(
        "spotifyPlaylists",
        playlistItems,
        "No playlists were returned for this account.",
        openPlaylist,
      );
      renderItems(
        "spotifySavedTracks",
        savedItems,
        "No saved tracks were returned for this account.",
        playTrack,
      );
      $("spotifyDisconnect").hidden = false;
      $("spotifyRefresh").hidden = false;
      setStatus(
        "Connected · loaded " +
          playlistItems.length +
          " playlists and " +
          savedItems.length +
          " saved tracks. Refresh to load the next page if needed.",
      );
      await startPlayer();
    } catch (error) {
      setStatus(error.message);
      if (!token) disconnect(false);
    } finally {
      setBusy(false);
    }
  }
  async function openPlaylist(playlist) {
    setStatus("Loading playlist: " + playlist.title + "…");
    try {
      const data = await spotifyFetch(
        "/playlists/" + encodeURIComponent(playlist.id) + "/items?limit=50",
      );
      const tracks = (data.items || [])
        .map((row) => row.item)
        .filter((t) => t && t.uri && t.type === "track")
        .map((t) => ({
          id: t.id,
          uri: t.uri,
          title: t.name,
          subtitle: (t.artists || []).map((a) => a.name).join(", "),
          type: "track",
        }));
      renderItems(
        "spotifySavedTracks",
        tracks,
        "No playable tracks were returned. Some playlist items may not be available through the API.",
        playTrack,
      );
      setStatus(
        "Playlist: " +
          playlist.title +
          " · " +
          tracks.length +
          " tracks shown. Select a track to play.",
      );
    } catch (error) {
      setStatus(
        error.message +
          " Spotify may provide playlist metadata without its contents for some playlists.",
      );
    }
  }
  async function playTrack(track) {
    if (!track.uri) return;
    if (!player || !deviceId) {
      setStatus(
        "The Spotify player is still starting. Wait a moment, then select the track again.",
      );
      return;
    }
    try {
      await player.activateElement();
      const response = await fetch(
        "https://api.spotify.com/v1/me/player/play?device_id=" +
          encodeURIComponent(deviceId),
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + token.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [track.uri] }),
        },
      );
      if (!response.ok && response.status !== 204) {
        let message = "";
        try {
          message = (await response.json()).error?.message || "";
        } catch (_) {}
        throw new Error(
          response.status === 403
            ? "Playback unavailable. Check Premium eligibility and your Spotify app settings."
            : "Playback request failed (" +
                response.status +
                ")" +
                (message ? ": " + message : "") +
                ".",
        );
      }
      $("spotifyCurrent").textContent = track.title + " — " + track.subtitle;
      $("spotifyPlayerWrap").hidden = false;
      setStatus("Playback requested for " + track.title + ".");
    } catch (error) {
      setStatus(error.message);
    }
  }
  function disconnect(showMessage = true) {
    if (player) {
      player.disconnect();
      player = null;
    }
    deviceId = null;
    token = null;
    currentUri = null;
    sessionStorage.removeItem(TOKEN_KEY);
    $("spotifyLibrary").hidden = true;
    $("spotifyPlayerWrap").hidden = true;
    $("spotifyDisconnect").hidden = true;
    $("spotifyRefresh").hidden = true;
    $("spotifyPlayPause").textContent = "Play";
    if (showMessage)
      setStatus(
        "Disconnected from Spotify. Your Pulse local playback is unchanged.",
      );
  }
  async function init() {
    $("spotifyRedirectUri").textContent = REDIRECT_URI;
    $("spotifyClientId").value = localStorage.getItem(CLIENT_KEY) || "";
    $("spotifySaveClient").addEventListener("click", () => {
      const id = $("spotifyClientId").value.trim();
      if (!id) {
        setStatus("Paste your Spotify Client ID first.");
        return;
      }
      localStorage.setItem(CLIENT_KEY, id);
      setStatus(
        "Client ID saved on this device. Redirect URI must match exactly in Spotify Developer settings.",
      );
    });
    $("spotifyConnect").addEventListener("click", authorize);
    $("spotifyDisconnect").addEventListener("click", () => disconnect(true));
    $("spotifyRefresh").addEventListener("click", loadLibrary);
    $("spotifyPrev").addEventListener("click", () => player?.previousTrack());
    $("spotifyNext").addEventListener("click", () => player?.nextTrack());
    $("spotifyPlayPause").addEventListener("click", () => player?.togglePlay());
    const callback = await handleCallback();
    if (callback && !token) return;
    if (readToken()) await loadLibrary();
  }
  init().catch((error) => setStatus("Spotify setup error: " + error.message));
})();
