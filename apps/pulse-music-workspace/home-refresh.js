/* Mobile home interactions bridge into Pulse's existing tested player actions. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function playTrack(id) {
    const row = $('.row[data-id="' + String(id).replace(/[^0-9]/g, '') + '"]');
    const play = row && $('.rowplay', row);
    if (play) play.click();
  }

  document.addEventListener('click', (event) => {
    const trackButton = event.target.closest('[data-home-track]');
    if (trackButton) {
      playTrack(trackButton.dataset.homeTrack);
      return;
    }

    const moodButton = event.target.closest('[data-home-mood]');
    if (moodButton) {
      $$('.genre-chip').forEach((chip) => chip.classList.toggle('selected', chip === moodButton));
      const mood = moodButton.dataset.homeMood;
      const targetMood = mood === 'Ambient' ? 'Ambient' : mood === 'Night' ? 'Night' : mood;
      const existingMood = $('.mood[data-mood="' + targetMood + '"]');
      if (mood && existingMood) existingMood.click();
      else if (!mood) {
        const all = $('#allMoods');
        if (all) all.click();
      }
      return;
    }

    if (event.target.closest('#homeShuffle')) {
      const shuffle = $('#shuffleAll');
      if (shuffle) shuffle.click();
      return;
    }
    if (event.target.closest('#homeProfile')) {
      const signIn = $('#cloudSignIn');
      if (signIn && !signIn.hidden) signIn.click();
      else {
        document.body.classList.add('show-sourcehub');
        document.body.classList.remove('show-library');
      }
      return;
    }
    const mobileNav = event.target.closest('[data-mobile-view]');
    if (mobileNav) {
      const view = mobileNav.dataset.mobileView;
      document.body.classList.toggle('show-sourcehub', view === 'search');
      document.body.classList.toggle('show-library', view === 'library');
      $$('.mobile-bottom-nav button').forEach((button) => button.classList.toggle('active', button === mobileNav));
      if (view === 'search') {
        const source = $('#sourceHub');
        if (source) source.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      if (view === 'library') {
        const library = $('.nav[data-view="library"]');
        if (library) library.click();
      }
      if (view === 'home') {
        const discover = $('.nav[data-view="discover"]');
        if (discover) discover.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  });

  const nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.innerHTML = '<button class="active" data-mobile-view="home"><span>⌂</span>Home</button><button data-mobile-view="search"><span>⌕</span>Search</button><button data-mobile-view="library"><span>▤</span>Library</button>';
  document.body.appendChild(nav);
})();
