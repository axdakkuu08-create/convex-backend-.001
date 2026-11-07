/* Approved Pulse interface finish: move open-audio discovery into Search and add the expandable bottom search. */
(() => {
  const $ = (id) => document.getElementById(id);
  const searchView = $("pulseSearchView");
  const searchMount = $("pulseSearchMount");
  const homeArchiveShelf = $("homeArchiveShelf");
  const sourceHub = $("sourceHub");

  // Open-audio discovery belongs in Search, not on the Home landing screen.
  if (homeArchiveShelf && searchMount) searchMount.append(homeArchiveShelf);

  const searchHeading = searchView?.querySelector(
    ".pulse-view-heading p:last-child",
  );
  if (searchHeading) {
    searchHeading.textContent =
      "Find tracks, albums and open-audio selections, with source and rights details kept available.";
  }

  // Keep rights/provenance in results and player status, but remove provider branding
  // from the primary navigation and discovery headings.
  const homeArchiveHeading = $("homeArchiveHeading");
  if (homeArchiveHeading) homeArchiveHeading.textContent = "Open audio picks";
  const homeArchiveKicker = document.querySelector(".home-archive-kicker");
  if (homeArchiveKicker) homeArchiveKicker.textContent = "OPEN AUDIO DISCOVERY";
  const homeArchiveQuery = $("homeArchiveQuery");
  if (homeArchiveQuery) {
    homeArchiveQuery.placeholder = "Search recordings, artists or moods";
    homeArchiveQuery.setAttribute("aria-label", "Search open audio recordings");
  }
  const archivePanel = document.querySelector(".archive-search-panel");
  if (archivePanel) {
    const title = archivePanel.querySelector("h3");
    const kicker = archivePanel.querySelector(".sectionhead small");
    const badge = archivePanel.querySelector(".source-badge");
    const submit = archivePanel.querySelector('button[type="submit"]');
    if (title) title.textContent = "Open audio";
    if (kicker) kicker.textContent = "OPEN AUDIO CATALOGUE";
    if (badge) badge.textContent = "SOURCE & RIGHTS";
    if (submit) submit.textContent = "Search open audio";
  }

  // Search dock: collapsed until Search is selected, then expands from the bottom.
  if (!document.getElementById("pulseQuickSearch")) {
    const dock = document.createElement("form");
    dock.id = "pulseQuickSearch";
    dock.className = "pulse-quick-search";
    dock.setAttribute("role", "search");
    dock.setAttribute("aria-label", "Quick music search");
    dock.innerHTML =
      '<button class="pulse-quick-search-trigger" type="button" aria-expanded="false" aria-controls="pulseQuickSearchInput"><span aria-hidden="true">⌕</span><span class="pulse-quick-search-label">Search music</span><span class="pulse-quick-search-hint">Tap to expand</span></button>' +
      '<input id="pulseQuickSearchInput" type="search" placeholder="Song, artist or album…" autocomplete="off" aria-label="Search song, artist or album" />' +
      '<button class="pulse-quick-search-submit" type="submit" aria-label="Search">↗</button>';
    document.body.append(dock);

    const trigger = dock.querySelector(".pulse-quick-search-trigger");
    const input = $("pulseQuickSearchInput");
    const unifiedInput = $("unifiedQuery");
    const unifiedForm = $("unifiedSearchForm");
    const setExpanded = (expanded, focus = false) => {
      dock.classList.toggle("expanded", expanded);
      trigger.setAttribute("aria-expanded", String(expanded));
      trigger.querySelector(".pulse-quick-search-hint").textContent = expanded
        ? "Close"
        : "Tap to expand";
      if (focus) input.focus({ preventScroll: true });
    };

    trigger.addEventListener("click", () => {
      const expanded = !dock.classList.contains("expanded");
      setExpanded(expanded, expanded);
    });
    input.addEventListener("input", () => {
      if (unifiedInput) unifiedInput.value = input.value;
    });
    if (unifiedInput) {
      unifiedInput.addEventListener("input", () => {
        input.value = unifiedInput.value;
      });
    }
    dock.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (!query || !unifiedInput || !unifiedForm) return;
      unifiedInput.value = query;
      unifiedForm.requestSubmit();
      const results = $("unifiedSearchResults");
      if (results)
        results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dock.classList.contains("expanded")) {
        setExpanded(false);
        trigger.focus({ preventScroll: true });
      }
    });

    document
      .querySelectorAll('[data-pulse-view="search"]')
      .forEach((button) => {
        button.addEventListener("click", () => {
          window.setTimeout(() => setExpanded(true, true), 80);
        });
      });
    const viewObserver = new MutationObserver(() => {
      const onSearch = document.body.dataset.pulseView === "search";
      dock.classList.toggle("search-active", onSearch);
      if (!onSearch) setExpanded(false);
    });
    viewObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-pulse-view"],
    });
    dock.classList.toggle(
      "search-active",
      document.body.dataset.pulseView === "search",
    );
  }

  // Keep all navigation destinations consistent with the current view.
  document.querySelectorAll('[data-pulse-view="search"]').forEach((button) => {
    button.setAttribute("aria-label", "Open Search and expand music search");
  });
})();
