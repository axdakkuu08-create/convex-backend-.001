/* Microphone song-recognition adapter. Provider credentials stay server-side. */
(() => {
  const button = document.getElementById("songRecognize");
  const status = document.getElementById("recognitionStatus");
  const result = document.getElementById("recognitionResult");
  if (!button || !status || !result) return;

  const rawEndpoint = String(window.PULSE_RECOGNITION_ENDPOINT || "").trim();
  let endpoint = "";
  try {
    const parsed = new URL(rawEndpoint, window.location.href);
    if (parsed.protocol === "https:" || parsed.origin === window.location.origin)
      endpoint = parsed.href;
  } catch (_) {}

  let busy = false;
  const safeUrl = (value) => {
    try {
      const parsed = new URL(String(value || ""), window.location.href);
      return parsed.protocol === "https:" || parsed.origin === window.location.origin
        ? parsed.href
        : "";
    } catch (_) { return ""; }
  };
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("is-error", error);
  }
  function renderSong(song) {
    const title = String(song.title || "Unknown song");
    const artist = String(song.artist || "Unknown artist");
    const artwork = safeUrl(song.artwork || song.artworkUrl);
    const audioUrl = safeUrl(song.previewUrl || song.streamUrl);
    const sourceUrl = safeUrl(song.sourceUrl || song.url);
    result.replaceChildren();

    if (artwork) {
      const image = document.createElement("img");
      image.src = artwork; image.alt = ""; image.loading = "lazy";
      result.append(image);
    } else {
      const icon = document.createElement("span");
      icon.className = "recognition-art"; icon.textContent = "♫";
      result.append(icon);
    }
    const copy = document.createElement("div");
    copy.className = "recognition-song-copy";
    const heading = document.createElement("strong"); heading.textContent = title;
    const subtitle = document.createElement("small"); subtitle.textContent = artist;
    copy.append(heading, subtitle); result.append(copy);

    const actions = document.createElement("div");
    actions.className = "recognition-actions";
    const play = document.createElement("button");
    play.type = "button"; play.textContent = "Play"; play.disabled = !audioUrl;
    const save = document.createElement("button");
    save.type = "button"; save.textContent = "Save single";
    actions.append(play, save);
    if (sourceUrl) {
      const source = document.createElement("a");
      source.href = sourceUrl; source.target = "_blank";
      source.rel = "noopener noreferrer"; source.textContent = "Source ↗";
      actions.append(source);
    }
    result.append(actions);

    const detail = {
      title, artist, src: audioUrl, url: sourceUrl, artwork,
      source: String(song.source || "Recognition catalogue"),
      catalogId: String(song.catalogId || song.id || ""),
      verificationStatus: song.verificationStatus || "VERIFYING",
      rightsReviewStatus: song.rightsReviewStatus || "REVIEW_REQUIRED",
      license: String(song.license || ""),
    };
    play.addEventListener("click", () => {
      if (detail.src) window.dispatchEvent(new CustomEvent("pulse:play-catalog-track", { detail }));
    });
    save.addEventListener("click", () => {
      if (!detail.src) { message("This match has no playable preview to save.", true); return; }
      window.dispatchEvent(new CustomEvent("pulse:add-track-to-playlist", { detail }));
    });
    result.hidden = false;
  }

  async function identify() {
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      message("This browser does not support microphone recording.", true);
      return;
    }
    if (!endpoint) {
      message("Recognition is not configured with a secure endpoint. No audio was recorded or sent.", true);
      return;
    }
    if (!window.confirm(
      "Pulse will record a short 7-second microphone sample and send it to the configured recognition service. Continue?"
    )) return;

    busy = true; button.disabled = true; result.hidden = true;
    let stream;
    try {
      message("Requesting microphone permission…");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener("error", reject, { once: true });
      });
      recorder.start();
      message("Recording a short sample…");
      await new Promise((resolve) => window.setTimeout(resolve, 7000));
      recorder.stop();
      await stopped;
      const form = new FormData();
      form.append("audio", new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), "pulse-recognition.webm");
      message("Sending the sample to the configured recognition service…");
      const options = { method: "POST", body: form, headers: { Accept: "application/json" } };
      if (window.AbortSignal?.timeout) options.signal = window.AbortSignal.timeout(15000);
      const response = await fetch(endpoint, options);
      if (!response.ok) throw new Error("Recognition service returned HTTP " + response.status);
      const payload = await response.json();
      const song = payload.song || payload.result || payload;
      if (!song.title) throw new Error(payload.message || "No matching song was identified.");
      renderSong(song);
      message("Match found. Playback and source rights are shown separately.");
    } catch (error) {
      message(error?.message || "Song recognition failed. Try again.", true);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      busy = false; button.disabled = false;
    }
  }
  button.addEventListener("click", identify);
})();
