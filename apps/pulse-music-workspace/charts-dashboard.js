/* Source-attributed music charts: Apple's public RSS feed and Internet Archive metrics. */
(() => {
  const $ = (id) => document.getElementById(id),
    world = $("appleChartList"),
    archive = $("archiveChartList");
  if (!world) return;
  const esc = (v) =>
    String(v ?? "").replace(
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
  const prefs = () => {
    try {
      return JSON.parse(localStorage.getItem("pulse.prefs") || "{}");
    } catch (_) {
      return {};
    }
  };
  const country = () =>
    String(prefs().country || "IN")
      .toLowerCase()
      .slice(0, 2);
  const duration = (v) => {
    const n = Number(v || 0);
    return n > 0
      ? Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0")
      : "";
  };
  const status = (node, msg, error = false) => {
    node.innerHTML =
      '<p class="' +
      (error ? "charts-error" : "charts-loading") +
      '">' +
      esc(msg) +
      "</p>";
  };
  const formatTime = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? "time unavailable"
      : d.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        });
  };
  let lastAppleRefreshAt = 0,
    appleBusy = false;
  function renderApple(items, code) {
    if (!items.length)
      throw new Error("The official feed returned no chart entries.");
    world.replaceChildren();
    items.forEach((song, i) => {
      const row = document.createElement("article");
      row.className = "chart-track";
      const art = String(song.artworkUrl100 || "").replace(
          "100x100bb",
          "200x200bb",
        ),
        href = song.url || "https://music.apple.com/" + code + "/";
      row.innerHTML =
        '<span class="chart-rank">' +
        (i + 1) +
        '</span><img class="chart-cover" loading="lazy" src="' +
        esc(art) +
        '" alt=""><div class="chart-copy"><strong>' +
        esc(song.name || "Untitled") +
        "</strong><small>" +
        esc(song.artistName || "Unknown artist") +
        '</small></div><div class="chart-actions"><a href="' +
        esc(href) +
        '" target="_blank" rel="noopener noreferrer">Apple Music ↗</a></div>';
      world.append(row);
    });
    $("appleChartLink").href = "https://music.apple.com/" + code + "/new";
  }
  async function loadApple() {
    if (appleBusy) return;
    appleBusy = true;
    const code = country(),
      refresh = $("appleChartRefresh");
    if (refresh) {
      refresh.disabled = true;
      refresh.textContent = "Refreshing…";
    }
    status(world, "Refreshing the official Apple Music chart…");
    try {
      const response = await fetch(
        "/api/apple-charts?country=" + encodeURIComponent(code),
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Chart service returned HTTP " + response.status + ".");
      const payload = await response.json();
      if (!Array.isArray(payload.results))
        throw new Error("The chart provider returned an unexpected response.");
      renderApple(payload.results, code);
      const stamp = payload.refreshedAt || payload.updatedAt;
      $("appleChartMeta").textContent =
        "Apple official chart · " +
        code.toUpperCase() +
        " · refreshed " +
        formatTime(stamp);
      $("appleChartLink").href = "https://music.apple.com/" + code + "/new";
      lastAppleRefreshAt = Date.now();
    } catch (error) {
      let recovered = false;
      if (code === "in") {
        try {
          const backup = await fetch("/apple-charts-in.json", {
            cache: "no-store",
          });
          if (backup.ok) {
            const payload = await backup.json();
            renderApple(payload.results || [], code);
            $("appleChartMeta").textContent =
              "Saved India chart · source snapshot " +
              formatTime(payload.updated) +
              " · live refresh unavailable";
            recovered = true;
          }
        } catch (_) {}
      }
      if (!recovered) {
        status(
          world,
          (error?.message || "Apple chart data unavailable.") +
            " Use the official chart link to view current rankings.",
          true,
        );
        $("appleChartMeta").textContent = "Live chart refresh unavailable";
      }
    } finally {
      appleBusy = false;
      if (refresh) {
        refresh.disabled = false;
        refresh.textContent = "Refresh ↻";
      }
    }
  }
  async function archiveDocs(period) {
    const params = new URLSearchParams();
    params.set(
      "q",
      period === "week"
        ? "mediatype:audio AND subject:music AND week:[1 TO *]"
        : "mediatype:audio AND subject:music AND downloads:[1 TO *]",
    );
    [
      "identifier",
      "title",
      "creator",
      "year",
      "downloads",
      "week",
      "month",
    ].forEach((f) => params.append("fl[]", f));
    params.set("rows", "18");
    params.set("page", "1");
    params.set("output", "json");
    params.append("sort[]", period === "week" ? "week desc" : "downloads desc");
    const response = await fetch(
      "https://archive.org/advancedsearch.php?" + params.toString(),
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok)
      throw new Error(
        "Internet Archive search returned HTTP " + response.status,
      );
    const payload = await response.json();
    return payload.response?.docs || [];
  }
  async function limited(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
          const i = cursor++;
          try {
            out[i] = await fn(items[i]);
          } catch (_) {
            out[i] = null;
          }
        }
      }),
    );
    return out.filter(Boolean);
  }
  function dispatchTrack(item, save) {
    const detail = {
      title: item.title,
      artist: item.artist,
      src: item.audioUrl,
      url: item.pageUrl,
      artwork: item.artwork,
      license: item.license || "",
      source: "Internet Archive",
      catalogId: "archive:" + item.id,
      duration: duration(item.durationSeconds),
      verificationStatus: "VERIFYING",
      rightsReviewStatus: "REVIEW_REQUIRED",
      bytesTotal: item.fileSize || 0,
    };
    window.dispatchEvent(
      new CustomEvent(
        save ? "pulse:add-track-to-playlist" : "pulse:play-catalog-track",
        { detail },
      ),
    );
  }
  async function loadArchive(period = "downloads") {
    status(archive, "Loading real Internet Archive download rankings…");
    $("archiveChartMeta").textContent =
      period === "week"
        ? "Ranked by Archive downloads this week"
        : "Ranked by all-time Archive downloads";
    try {
      const docs = await archiveDocs(period);
      const tracks = await limited(docs, 5, async (doc) => {
        if (!doc.identifier) return null;
        const response = await fetch(
          "https://archive.org/metadata/" + encodeURIComponent(doc.identifier),
        );
        if (!response.ok) return null;
        const meta = await response.json(),
          file = window.PulseArchive?.pickAudioFile(meta.files);
        if (!file) return null;
        const m = meta.metadata || {},
          id = doc.identifier;
        return {
          id,
          title: String(m.title || doc.title || id),
          artist: String(
            m.creator || doc.creator || "Internet Archive contributor",
          ),
          year: String(m.year || doc.year || ""),
          downloads: Number(doc.downloads) || 0,
          week: Number(doc.week) || 0,
          durationSeconds:
            window.PulseArchive?.parseDuration(
              m.runtime || m.length || file.length || file.duration,
            ) || 0,
          fileSize: Number(file.size) || 0,
          license: String(m.licenseurl || m.rights || ""),
          audioUrl:
            "https://archive.org/download/" +
            encodeURIComponent(id) +
            "/" +
            encodeURIComponent(file.name),
          pageUrl: "https://archive.org/details/" + encodeURIComponent(id),
          artwork: "https://archive.org/services/img/" + encodeURIComponent(id),
        };
      });
      if (!tracks.length) {
        status(
          archive,
          "No playable audio items with popularity metadata were returned.",
          true,
        );
        return;
      }
      archive.replaceChildren();
      tracks.slice(0, 10).forEach((item, i) => {
        const metric = period === "week" ? item.week : item.downloads,
          label = period === "week" ? "7-day downloads" : "total downloads";
        const row = document.createElement("article");
        row.className = "chart-track";
        row.innerHTML =
          '<span class="chart-rank">' +
          (i + 1) +
          '</span><img class="chart-cover" loading="lazy" src="' +
          esc(item.artwork) +
          '" alt=""><div class="chart-copy"><strong>' +
          esc(item.title) +
          "</strong><small>" +
          esc(item.artist) +
          (item.year ? " · " + esc(item.year) : "") +
          '</small></div><div class="chart-metric">' +
          Number(metric).toLocaleString() +
          "<br>" +
          label +
          '</div><div class="chart-actions"><button type="button" data-action="play">Play</button><button type="button" data-action="save">Save</button><a href="' +
          esc(item.pageUrl) +
          '" target="_blank" rel="noopener noreferrer">Source ↗</a></div>';
        row
          .querySelector('[data-action="play"]')
          .addEventListener("click", () => dispatchTrack(item, false));
        row
          .querySelector('[data-action="save"]')
          .addEventListener("click", () => dispatchTrack(item, true));
        archive.append(row);
      });
    } catch (error) {
      status(
        archive,
        "Could not load Archive popularity rankings. " + (error?.message || ""),
        true,
      );
    }
  }
  document.querySelectorAll("[data-chart-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      const worldActive = button.dataset.chartTab === "world";
      document.querySelectorAll("[data-chart-tab]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      $("worldChartPane").hidden = !worldActive;
      $("archiveChartPane").hidden = worldActive;
      if (!worldActive && !archive.dataset.loaded) {
        archive.dataset.loaded = "1";
        void loadArchive("downloads");
      }
    }),
  );
  document.querySelectorAll("[data-archive-period]").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-archive-period]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
      });
      void loadArchive(button.dataset.archivePeriod);
    }),
  );
  $("appleChartRefresh")?.addEventListener("click", () => void loadApple());
  void loadApple();
  window.setInterval(
    () => {
      if (document.visibilityState === "visible") void loadApple();
    },
    15 * 60 * 1000,
  );
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      Date.now() - lastAppleRefreshAt > 15 * 60 * 1000
    )
      void loadApple();
  });
  window.addEventListener("pulse:preferences-changed", () => void loadApple());
})();
