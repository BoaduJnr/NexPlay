/*
 * NexPlay — Main App Controller
 * Handles routing, sidebar, genre cache, and back navigation.
 */
const App = (() => {
  let _currentPage = '';
  let _pageParams = {};
  let _sidebarExpanded = false;

  const PAGES = {
    home:       { module: () => HomePage,       label: 'Home',       nav: 'home' },
    movies:     { module: () => MoviesPage,     label: 'Movies',     nav: 'movies' },
    series:     { module: () => SeriesPage,     label: 'Series',     nav: 'series' },
    iptv:       { module: () => IPTVPage,       label: 'Live TV',    nav: 'iptv' },
    favourites: { module: () => FavouritesPage, label: 'Favourites', nav: 'favourites' },
    watchlist:  { module: () => WatchlistPage,  label: 'Watchlist',  nav: 'watchlist' },
    detail:     { module: () => DetailPage,     label: 'Detail',     nav: 'detail' },
  };

  // ── Genre map (id → name) used by HomePage hero ────────
  const genreMap = {};

  // ── Theme management ────────────────────────────────────
  const THEMES = ['theme-calm', 'theme-bright', 'theme-night'];
  const THEME_LABELS = { 'theme-calm': 'Calm', 'theme-bright': 'Bright', 'theme-night': 'Night' };
  let _currentTheme = localStorage.getItem('nexplay-theme') || 'theme-calm';

  const THEME_COLORS = {
    'theme-calm':   { bg: '#0d1117', text: '#c9d1d9' },
    'theme-bright': { bg: '#f0f0fa', text: '#0a0a20' },
    'theme-night':  { bg: '#0a0a0f', text: '#e8e8f0' },
  };

  // setProperty() unsupported on some Tizen 3.0 firmware — always in try/catch.
  const THEME_PALETTE = {
    'theme-calm': {
      '--accent': '#7c3aed', '--accent-light': '#a78bfa',
      '--accent-glow': 'rgba(124,58,237,0.45)', '--accent-dim': 'rgba(124,58,237,0.15)',
      '--cyan': '#06b6d4', '--cyan-glow': 'rgba(6,182,212,0.35)',
      '--green': '#4ade80', '--yellow': '#facc15',
      '--card-bg': 'linear-gradient(135deg,#131322 0%,#1a1a2e 100%)',
      '--card-border': '1px solid rgba(167,139,250,0.15)',
      '--surface': '#0f0f1c', '--surface2': '#171728', '--surface3': '#1f1f35',
    },
    'theme-bright': {
      '--accent': '#6d28d9', '--accent-light': '#7c3aed',
      '--accent-glow': 'rgba(109,40,217,0.28)', '--accent-dim': 'rgba(109,40,217,0.12)',
      '--cyan': '#d97706', '--cyan-glow': 'rgba(217,119,6,0.30)',
      '--green': '#059669', '--yellow': '#dc2626',
      '--card-bg': '#ffffff', '--card-border': '1px solid rgba(10,10,32,0.12)',
      '--surface': '#eaeaf5', '--surface2': '#f0f0fa', '--surface3': '#e4e4f2',
    },
    'theme-night': {
      '--accent': '#a78bfa', '--accent-light': '#c4b5fd',
      '--accent-glow': 'rgba(167,139,250,0.55)', '--accent-dim': 'rgba(167,139,250,0.18)',
      '--cyan': '#38bdf8', '--cyan-glow': 'rgba(56,189,248,0.38)',
      '--green': '#34d399', '--yellow': '#fbbf24',
      '--card-bg': 'linear-gradient(135deg,#0d0d18 0%,#111120 100%)',
      '--card-border': '1px solid rgba(167,139,250,0.12)',
      '--surface': '#0c0c16', '--surface2': '#121220', '--surface3': '#18182c',
    },
  };

  function applyTheme(theme) {
    THEMES.forEach(t => document.body.classList.remove(t));
    document.body.classList.add(theme);
    _currentTheme = theme;
    try { localStorage.setItem('nexplay-theme', theme); } catch(e) {}

    var p = THEME_PALETTE[theme] || THEME_PALETTE['theme-calm'];
    try {
      Object.keys(p).forEach(function(k) {
        document.documentElement.style.setProperty(k, p[k]);
      });
    } catch(e) {}

    var c = THEME_COLORS[theme] || THEME_COLORS['theme-calm'];
    document.documentElement.style.background = c.bg;
    document.body.style.background = c.bg;
    document.body.style.color = c.text;

    // AVPlay renders behind the HTML layer and requires transparent backgrounds
    // to show through. Restore for both movie player and IPTV AVPlay.
    if (document.body.classList.contains('movie-avplay-on') ||
        document.body.classList.contains('avplay-on')) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    }
  }

  function cycleTheme() {
    const idx = THEMES.indexOf(_currentTheme);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
    // Show brief toast
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Theme: ' + THEME_LABELS[next];
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2000);
    }
  }

  // Apply saved theme on init
  applyTheme(_currentTheme);

  // ── Navigation icons (SVG inline) ──────────────────────
  const ICONS = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
    movies: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
    </svg>`,
    collections: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
      <polyline points="3 9 21 9"/><polyline points="3 15 21 15"/>
      <line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/>
    </svg>`,
    series: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <circle cx="12" cy="12" r="3"/><path d="M2 10h4M18 10h4M2 14h4M18 14h4"/>
    </svg>`,
    iptv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M8 19v2M16 19v2M2 10h20"/>
    </svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`,
    favourites: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>`,
    watchlist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>`,
  };

  // ── Sidebar ─────────────────────────────────────────────
  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-mark">N</div>
        <span class="logo-text">exPlay</span>
      </div>
      <ul class="sidebar-nav">
        <li>
          <div class="nav-item" data-nav data-nav-page="home" tabindex="0">
            ${ICONS.home}<span class="nav-label">Home</span>
          </div>
        </li>
        <li>
          <div class="nav-item" data-nav data-nav-page="movies" tabindex="0">
            ${ICONS.movies}<span class="nav-label">Movies</span>
          </div>
        </li>
        <li>
          <div class="nav-item" data-nav data-nav-page="series" tabindex="0">
            ${ICONS.series}<span class="nav-label">Series</span>
          </div>
        </li>
        <li>
          <div class="nav-item" data-nav data-nav-page="favourites" tabindex="0">
            ${ICONS.favourites}<span class="nav-label">Favourites</span>
          </div>
        </li>
        <li>
          <div class="nav-item" data-nav data-nav-page="watchlist" tabindex="0">
            ${ICONS.watchlist}<span class="nav-label">Watchlist</span>
          </div>
        </li>
        <li>
          <div class="nav-item" data-nav data-nav-page="iptv" tabindex="0">
            ${ICONS.iptv}<span class="nav-label">Live TV</span>
          </div>
        </li>
      </ul>`;

    sidebar.querySelectorAll('[data-nav-page]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.navPage));
      el.addEventListener('nav:focus', () => expandSidebar(true));
    });
  }

  function expandSidebar(on) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    _sidebarExpanded = on;
    sidebar.classList.toggle('expanded', on);
  }

  function updateSidebarActive(page) {
    document.querySelectorAll('[data-nav-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.navPage === page);
    });
  }

  // ── Navigation ──────────────────────────────────────────
  function navigate(page, params = {}) {
    const def = PAGES[page];
    if (!def) return;

    // Close player if open
    const modal = document.getElementById('player-modal');
    if (page !== 'player' && modal && !modal.classList.contains('hidden')) {
      PlayerPage.closePlayer();
    }

    // Leave current page
    if (_currentPage && PAGES[_currentPage]) {
      const _leaveMod = PAGES[_currentPage].module();
      if (_leaveMod.onLeave) _leaveMod.onLeave();
    }

    _currentPage = page;
    _pageParams = params;

    updateSidebarActive(page);
    expandSidebar(false);

    const content = document.getElementById('main-content');
    if (content) {
      content.scrollTop = 0;
      def.module().render(content, params);
    }

    document.title = `NexPlay — ${def.label}`;
  }

  // Special case: player opens as a modal overlay
  function navigatePlayer(params) {
    PlayerPage.render(document.getElementById('main-content'), params);
  }

  // Override navigate to handle player specially
  const _origNavigate = navigate;
  function navigateFull(page, params = {}) {
    if (page === 'player') {
      navigatePlayer(params);
    } else {
      _origNavigate(page, params);
    }
  }

  // ── Back handler ────────────────────────────────────────
  function handleBack() {
    // Close any open dropdown first (prevents Escape navigating away mid-dropdown)
    const openDD = document.querySelector('.tdd-wrapper.open');
    if (openDD) {
      const ddId = openDD.id.replace('tdd-wrap-', '');
      const ddList = document.getElementById('tdd-list-' + ddId);
      const ddTrigger = openDD.querySelector('[data-tdd-trigger]');
      if (ddList) ddList.classList.add('hidden');
      openDD.classList.remove('open');
      if (ddTrigger) Nav.focusEl(ddTrigger);
      return;
    }

    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      PlayerPage.closePlayer();
      return;
    }

    if (_sidebarExpanded) {
      expandSidebar(false);
      Nav.reset(document.getElementById('main-content'));
      return;
    }

    if (_currentPage !== 'home') {
      navigateFull('home');
    }
  }

  // ── Viewport scaling — keeps 1920×1080 layout on any screen ──
  function scaleApp() {
    const scale = Math.min(
      window.innerWidth  / 1920,
      window.innerHeight / 1080
    );
    const app = document.getElementById('app');
    if (!app) return;
    app.style.transform = `scale(${scale})`;
    // Centre the scaled canvas when letterboxing occurs
    app.style.left = Math.max(0, (window.innerWidth  - 1920 * scale) / 2) + 'px';
    app.style.top  = Math.max(0, (window.innerHeight - 1080 * scale) / 2) + 'px';
  }

  // ── Init ────────────────────────────────────────────────
  async function init() {
    scaleApp();
    window.addEventListener('resize', scaleApp);

    buildSidebar();
    Nav.init();

    // Pre-load genres into the map for HomePage hero
    try {
      const gData = await TMDB.genres();
      gData.genres.forEach(g => { genreMap[g.id] = g.name; });
    } catch (_) {}

    // Back navigation
    document.addEventListener('nav:back', handleBack);

    // Button ripple — fires on any .btn click (including nav Enter → .click())
    document.addEventListener('click', function(e) {
      var btn = e.target && e.target.closest && e.target.closest('.btn');
      if (!btn) return;
      btn.classList.remove('btn-pressed');
      // Force reflow so re-adding the class restarts the animation
      void btn.offsetWidth;
      btn.classList.add('btn-pressed');
      setTimeout(function() { btn.classList.remove('btn-pressed'); }, 420);
    });

    // Collapse sidebar when main content gets focus
    const _mc = document.getElementById('main-content');
    if (_mc) _mc.addEventListener('nav:focus', () => {
      expandSidebar(false);
    }, true);

    // Start on Home
    navigateFull('home');
  }

  function showToast(msg, duration) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function() { toast.classList.remove('visible'); }, duration || 2500);
  }

  return { init, navigate: navigateFull, genreMap, cycleTheme, showToast };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
