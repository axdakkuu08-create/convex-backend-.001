/* Shared source, transport and offline-rights policy for Pulse. */
(() => {
  "use strict";
  const ALLOWED_SOURCE_TYPES = new Set([
    "internet_archive",
    "itunes_preview",
    "user_audio",
  ]);
  function isHttpsAudioUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && Boolean(url.hostname);
    } catch (_) {
      return false;
    }
  }
  function isWebAudioUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
    } catch (_) {
      return false;
    }
  }
  function sourceType(track) {
    const explicit = String(track?.sourceType || "");
    if (ALLOWED_SOURCE_TYPES.has(explicit)) return explicit;
    const source = String(track?.source || "");
    if (/internet\s*archive/i.test(source)) return "internet_archive";
    if (/apple|itunes/i.test(source)) return "itunes_preview";
    return "user_audio";
  }
  function licenseLabel(track) {
    return String(
      track?.licenseLabel || track?.archiveLicense || track?.license || "",
    ).trim();
  }
  function canDownloadOffline(track) {
    return Boolean(
      track &&
        sourceType(track) === "internet_archive" &&
        isHttpsAudioUrl(track.src || track.audioUrl) &&
        licenseLabel(track) &&
        String(track.verificationStatus || "") === "VERIFIED_FULL" &&
        String(track.rightsReviewStatus || "") === "APPROVED",
    );
  }
  function normalizeAttribution(track) {
    return {
      sourceType: sourceType(track),
      licenseLabel: licenseLabel(track),
      sourcePage: String(track?.sourcePage || track?.archivePage || track?.url || ""),
      rightsReviewStatus: String(track?.rightsReviewStatus || "REVIEW_REQUIRED"),
      verificationStatus: String(track?.verificationStatus || "UNAVAILABLE"),
    };
  }
  window.PulseMediaPolicy = {
    isHttpsAudioUrl,
    isWebAudioUrl,
    sourceType,
    licenseLabel,
    canDownloadOffline,
    normalizeAttribution,
  };
})();
