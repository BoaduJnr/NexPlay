/*
 * NexPlay — Main App Controller
 * Handles routing, sidebar, genre cache, and back navigation.
 */
const App = (() => {
  let _currentPage = '';
  let _pageParams = {};
  let _sidebarExpanded = false;
  let _genres = [];

  const PAGES = {
    home:   { module: () => HomePage,   label: 'Home',     nav: 'home' },
    movies: { module: () => MoviesPage, label: 'Movies',   nav: 'movies' },
    series: { module: () => SeriesPage, label: 'Series',   nav: 'series' },
    iptv:   { module: () => IPTVPage,   label: 'Live TV',  nav: 'iptv' },
    detail: { module: () => DetailPage, label: 'Detail',   nav: 'detail' },
  };

  // ── Genre map (id → name) used by HomePage hero ────────
  const genreMap = {};

  // ── Theme management ────────────────────────────────────
  const THEMES = ['theme-default', 'theme-bright', 'theme-calm'];
  const THEME_LABELS = { 'theme-default': 'Default', 'theme-bright': 'Bright', 'theme-calm': 'Calm' };
  let _currentTheme = localStorage.getItem('nexplay-theme') || 'theme-default';

  function applyTheme(theme) {
    THEMES.forEach(t => document.body.classList.remove(t));
    if (theme !== 'theme-default') document.body.classList.add(theme);
    _currentTheme = theme;
    try { localStorage.setItem('nexplay-theme', theme); } catch(e) {}
    // Also set inline styles for old Chromium (no CSS variable support)
    var colors = {
      'theme-default': { bg: '#09090f', text: '#f0f0f8' },
      'theme-bright':  { bg: '#f0f0fa', text: '#0a0a20' },
      'theme-calm':    { bg: '#0d1117', text: '#c9d1d9' },
    };
    var c = colors[theme] || colors['theme-default'];
    document.documentElement.style.background = c.bg;
    document.body.style.background = c.bg;
    document.body.style.color = c.text;
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
  };

  // ── Sidebar ─────────────────────────────────────────────
  function buildSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-mark">N</div>
        <span class="logo-text">NexPlay</span>
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
