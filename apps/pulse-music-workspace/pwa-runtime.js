/* Progressive Web App registration is isolated from player boot. */
(() => {
  "use strict";
  const status = (message) => {
    const node = document.getElementById("pwaStatus");
    if (node) node.textContent = message;
  };
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    status("Offline app-shell support is unavailable in this browser context.");
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((registration) => {
        status("Offline app shell ready.");
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              status(
                "Pulse update available. Reload to use the latest version.",
              );
            }
          });
        });
      })
      .catch(() =>
        status(
          "Offline app-shell setup failed; online playback remains available.",
        ),
      );
  });
})();
