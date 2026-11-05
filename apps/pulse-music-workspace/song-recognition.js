/* Microphone song-recognition adapter. Provider credentials stay server-side. */
(() => {
  const button = document.getElementById("songRecognize");
  const status = document.getElementById("recognitionStatus");
  const result = document.getElementById("recognitionResult");
  if (!button || !status || !result) return;
  const endpoint = String(window.PULSE_RECOGNITION_ENDPOINT || "").trim();
  let busy = false;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("is-error", error);
  }
  function renderSong(song) {
    const title = String(song.title || "Unknown song");
    const artist = String(song.artist || "Unknown artist");
    const artwork = String(song.artwork || song.artworkUrl || "");
    const audioUrl = String(song.previewUrl || song.streamUrl || "");
    const sourceUrl = String(song.sourceUrl || song.url || "");
    result.hidden = false;
    result.innerHTML =
      (artwork
        ? '<img src="' +
          artwork.replace(/["<>]/g, "") +
          '" alt="" loading="lazy">'
        : '<span class="recognition-art">♫</span>') +
      '<div class="recognition-song-copy"><strong></strong><small></small></div><div class="recognition-actions"><button type="button" data-recognition-play ' +
      (audioUrl ? "" : "disabled") +
      '>Play</button><button type="button" data-recognition-save>Save single</button>' +
      (sourceUrl
        ? '<a href="' +
          sourceUrl.replace(/["<>]/g, "") +
          '" target="_blank" rel="noopener noreferrer">Source ↗</a>'
        : "") +
      "</div>";
    result.querySelector("strong").textContent = title;
    result.querySelector("small").textContent = artist;
    const detail = {
      title,
      artist,
      src: audioUrl,
      url: sourceUrl,
      artwork,
      source: String(song.source || "Recognition catalogue"),
      catalogId: String(song.catalogId || song.id || ""),
      verificationStatus: song.verificationStatus || "VERIFYING",
      rightsReviewStatus: song.rightsReviewStatus || "REVIEW_REQUIRED",
      license: song.license || "",
    };
    result
      .querySelector("[data-recognition-play]")
      ?.addEventListener("click", () =>
        window.dispatchEvent(
          new CustomEvent("pulse:play-catalog-track", { detail }),
        ),
      );
    result
      .querySelector("[data-recognition-save]")
      ?.addEventListener("click", () =>
        window.dispatchEvent(
          new CustomEvent("pulse:add-track-to-playlist", { detail }),
        ),
      );
  }
  async function identify() {
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      message("This browser does not support microphone recording.", true);
      return;
    }
    if (!endpoint) {
      message(
        "Microphone recognition UI is ready, but a recognition provider endpoint is not configured. No audio was sent.",
        true,
      );
      return;
    }
    busy = true;
    button.disabled = true;
    result.hidden = true;
    let stream;
    try {
      message("Requesting microphone permission…");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream),
        chunks = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener("error", reject, { once: true });
      });
      recorder.start();
      message("Listening for a short sample…");
      await new Promise((resolve) => window.setTimeout(resolve, 7000));
      recorder.stop();
      await stopped;
      const form = new FormData();
      form.append(
        "audio",
        new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
        "pulse-recognition.webm",
      );
      message("Checking the sample with the recognition service…");
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      });
      if (!response.ok)
        throw new Error("Recognition service returned HTTP " + response.status);
      const payload = await response.json(),
        song = payload.song || payload.result || payload;
      if (!song.title)
        throw new Error(payload.message || "No matching song was identified.");
      renderSong(song);
      message(
        "Match found. Playback and rights availability are shown separately.",
      );
    } catch (error) {
      message(error?.message || "Song recognition failed. Try again.", true);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      busy = false;
      button.disabled = false;
    }
  }
  button.addEventListener("click", identify);
})();
