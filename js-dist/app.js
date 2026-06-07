"use strict";

function _catch(body, recover) {
  try {
    var result = body();
  } catch (e) {
    return recover(e);
  }
  if (result && result.then) {
    return result.then(void 0, recover);
  }
  return result;
}
/*
* NexPlay — Main App Controller
* Handles routing, sidebar, genre cache, and back navigation.
*/
var App = function () {
  // ── Init ────────────────────────────────────────────────
  var init = function init() {
    try {
      function _temp2() {
        // Back navigation
        document.addEventListener('nav:back', handleBack);

        // Button ripple — fires on any .btn click (including nav Enter → .click())
        document.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest && e.target.closest('.btn');
          if (!btn) return;
          btn.classList.remove('btn-pressed');
          // Force reflow so re-adding the class restarts the animation
          void btn.offsetWidth;
          btn.classList.add('btn-pressed');
          setTimeout(function () {
            btn.classList.remove('btn-pressed');
          }, 420);
        });

        // Collapse sidebar when main content gets focus
        var _mc = document.getElementById('main-content');
        if (_mc) _mc.addEventListener('nav:focus', function () {
          expandSidebar(false);
        }, true);

        // Start on Home
        navigateFull('home');

        // Dismiss splash screen once the first page has rendered
        var splash = document.getElementById('nexplay-splash');
        if (splash) {
          splash.style.transition = 'opacity 0.35s ease';
          splash.style.opacity = '0';
          setTimeout(function () {
            if (splash.parentNode) splash.parentNode.removeChild(splash);
          }, 380);
        }
      }
      scaleApp();
      window.addEventListener('resize', scaleApp);
      buildSidebar();
      Nav.init();

      // Long-press on logo cycles theme — works on both mobile (touch) and web (mouse)
      // 600ms hold triggers one theme cycle; releasing early cancels it.
      (function wireLongPressLogo() {
        var _lpTimer = null;
        var _lpFired = false;
        var logo = document.querySelector('.sidebar-logo, .logo-mark');
        if (!logo) return;
        function startHold(e) {
          _lpFired = false;
          _lpTimer = setTimeout(function () {
            _lpFired = true;
            cycleTheme();
            // Visual pulse feedback
            var lm = document.querySelector('.logo-mark');
            if (lm) {
              lm.style.transform = 'scale(1.2)';
              setTimeout(function () {
                lm.style.transform = '';
              }, 300);
            }
          }, 600);
        }
        function cancelHold() {
          if (_lpTimer) {
            clearTimeout(_lpTimer);
            _lpTimer = null;
          }
        }
        function endHold(e) {
          cancelHold();
          // Prevent click from also firing on touch if hold was triggered
          if (_lpFired) {
            e.preventDefault && e.preventDefault();
          }
        }
        logo.addEventListener('mousedown', startHold, {
          passive: false
        });
        logo.addEventListener('touchstart', startHold, {
          passive: false
        });
        logo.addEventListener('mouseup', endHold);
        logo.addEventListener('mouseleave', cancelHold);
        logo.addEventListener('touchend', endHold, {
          passive: false
        });
        logo.addEventListener('touchcancel', cancelHold);
      })();

      // Long-press the ACTIVE nav tab (mobile) — cycles theme.
      // Only fires on the tab that is already selected, so browsing tabs works normally.
      // Uses touch events so it only runs on touch-capable devices (not desktop web).
      (function wireLongPressNavTab() {
        var _tabTimer = null;
        var _tabFired = false;
        document.addEventListener('touchstart', function (e) {
          var navItem = e.target.closest('.nav-item[data-nav-page]');
          if (!navItem || !navItem.classList.contains('active')) return;
          _tabFired = false;
          _tabTimer = setTimeout(function () {
            _tabFired = true;
            cycleTheme();
            navItem.style.transform = 'scale(0.88)';
            setTimeout(function () {
              navItem.style.transform = '';
            }, 200);
          }, 600);
        }, {
          passive: true
        });
        document.addEventListener('touchend', function () {
          if (_tabTimer) {
            clearTimeout(_tabTimer);
            _tabTimer = null;
          }
        }, {
          passive: true
        });
        document.addEventListener('touchcancel', function () {
          if (_tabTimer) {
            clearTimeout(_tabTimer);
            _tabTimer = null;
          }
        }, {
          passive: true
        });
      })();

      // Pre-load genres into the map for HomePage hero
      var _temp = _catch(function () {
        return Promise.resolve(TMDB.genres()).then(function (gData) {
          gData.genres.forEach(function (g) {
            genreMap[g.id] = g.name;
          });
        });
      }, function () {});
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var _currentPage = '';
  var _pageParams = {};
  var _sidebarExpanded = false;
  var PAGES = {
    home: {
      module: function module() {
        return HomePage;
      },
      label: 'Home',
      nav: 'home'
    },
    movies: {
      module: function module() {
        return MoviesPage;
      },
      label: 'Movies',
      nav: 'movies'
    },
    series: {
      module: function module() {
        return SeriesPage;
      },
      label: 'Series',
      nav: 'series'
    },
    iptv: {
      module: function module() {
        return IPTVPage;
      },
      label: 'Live TV',
      nav: 'iptv'
    },
    favourites: {
      module: function module() {
        return FavouritesPage;
      },
      label: 'Favourites',
      nav: 'favourites'
    },
    watchlist: {
      module: function module() {
        return WatchlistPage;
      },
      label: 'Watchlist',
      nav: 'watchlist'
    },
    detail: {
      module: function module() {
        return DetailPage;
      },
      label: 'Detail',
      nav: 'detail'
    }
  };

  // ── Genre map (id → name) used by HomePage hero ────────
  var genreMap = {};

  // ── Theme management ────────────────────────────────────
  var THEMES = ['theme-calm', 'theme-bright', 'theme-night'];
  var THEME_LABELS = {
    'theme-calm': 'Calm',
    'theme-bright': 'Bright',
    'theme-night': 'Night'
  };
  var _currentTheme = localStorage.getItem('nexplay-theme') || 'theme-calm';
  var THEME_COLORS = {
    'theme-calm': {
      bg: '#0d1117',
      text: '#c9d1d9'
    },
    'theme-bright': {
      bg: '#f0f0fa',
      text: '#0a0a20'
    },
    'theme-night': {
      bg: '#0a0a0f',
      text: '#e8e8f0'
    }
  };

  // setProperty() unsupported on some Tizen 3.0 firmware — always in try/catch.
  var THEME_PALETTE = {
    'theme-calm': {
      '--accent': '#7c3aed',
      '--accent-light': '#a78bfa',
      '--accent-glow': 'rgba(124,58,237,0.45)',
      '--accent-dim': 'rgba(124,58,237,0.15)',
      '--cyan': '#06b6d4',
      '--cyan-glow': 'rgba(6,182,212,0.35)',
      '--green': '#4ade80',
      '--yellow': '#facc15',
      '--card-bg': 'linear-gradient(135deg,#131322 0%,#1a1a2e 100%)',
      '--card-border': '1px solid rgba(167,139,250,0.15)',
      '--surface': '#0f0f1c',
      '--surface2': '#171728',
      '--surface3': '#1f1f35'
    },
    'theme-bright': {
      '--accent': '#6d28d9',
      '--accent-light': '#7c3aed',
      '--accent-glow': 'rgba(109,40,217,0.28)',
      '--accent-dim': 'rgba(109,40,217,0.12)',
      '--cyan': '#d97706',
      '--cyan-glow': 'rgba(217,119,6,0.30)',
      '--green': '#059669',
      '--yellow': '#dc2626',
      '--card-bg': '#ffffff',
      '--card-border': '1px solid rgba(10,10,32,0.12)',
      '--surface': '#eaeaf5',
      '--surface2': '#f0f0fa',
      '--surface3': '#e4e4f2'
    },
    'theme-night': {
      '--accent': '#a78bfa',
      '--accent-light': '#c4b5fd',
      '--accent-glow': 'rgba(167,139,250,0.55)',
      '--accent-dim': 'rgba(167,139,250,0.18)',
      '--cyan': '#38bdf8',
      '--cyan-glow': 'rgba(56,189,248,0.38)',
      '--green': '#34d399',
      '--yellow': '#fbbf24',
      '--card-bg': 'linear-gradient(135deg,#0d0d18 0%,#111120 100%)',
      '--card-border': '1px solid rgba(167,139,250,0.12)',
      '--surface': '#0c0c16',
      '--surface2': '#121220',
      '--surface3': '#18182c'
    }
  };
  function applyTheme(theme) {
    THEMES.forEach(function (t) {
      return document.body.classList.remove(t);
    });
    document.body.classList.add(theme);
    _currentTheme = theme;
    try {
      localStorage.setItem('nexplay-theme', theme);
    } catch (e) {}
    var p = THEME_PALETTE[theme] || THEME_PALETTE['theme-calm'];
    try {
      Object.keys(p).forEach(function (k) {
        document.documentElement.style.setProperty(k, p[k]);
      });
    } catch (e) {}
    var c = THEME_COLORS[theme] || THEME_COLORS['theme-calm'];
    document.documentElement.style.background = c.bg;
    document.body.style.background = c.bg;
    document.body.style.color = c.text;

    // AVPlay renders behind the HTML layer and requires transparent backgrounds
    // to show through. Restore for both movie player and IPTV AVPlay.
    if (document.body.classList.contains('movie-avplay-on') || document.body.classList.contains('avplay-on')) {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    }
  }
  function cycleTheme() {
    var idx = THEMES.indexOf(_currentTheme);
    var next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
    // Show brief toast
    var toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Theme: ' + THEME_LABELS[next];
      toast.classList.add('visible');
      setTimeout(function () {
        return toast.classList.remove('visible');
      }, 2000);
    }
  }

  // Apply saved theme on init
  applyTheme(_currentTheme);

  // ── Navigation icons (SVG inline) ──────────────────────
  var ICONS = {
    home: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>\n      <polyline points=\"9 22 9 12 15 12 15 22\"/>\n    </svg>",
    movies: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"2.18\"/>\n      <line x1=\"7\" y1=\"2\" x2=\"7\" y2=\"22\"/><line x1=\"17\" y1=\"2\" x2=\"17\" y2=\"22\"/>\n      <line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"/><line x1=\"2\" y1=\"7\" x2=\"7\" y2=\"7\"/>\n      <line x1=\"2\" y1=\"17\" x2=\"7\" y2=\"17\"/><line x1=\"17\" y1=\"7\" x2=\"22\" y2=\"7\"/>\n      <line x1=\"17\" y1=\"17\" x2=\"22\" y2=\"17\"/>\n    </svg>",
    collections: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z\"/>\n      <polyline points=\"3 9 21 9\"/><polyline points=\"3 15 21 15\"/>\n      <line x1=\"9\" y1=\"9\" x2=\"9\" y2=\"21\"/><line x1=\"15\" y1=\"9\" x2=\"15\" y2=\"21\"/>\n    </svg>",
    series: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n      <circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M2 10h4M18 10h4M2 14h4M18 14h4\"/>\n    </svg>",
    iptv: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n      <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n    </svg>",
    search: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <circle cx=\"11\" cy=\"11\" r=\"8\"/>\n      <line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>\n    </svg>",
    favourites: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z\"/>\n    </svg>",
    watchlist: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/>\n    </svg>"
  };

  // ── Sidebar ─────────────────────────────────────────────
  function buildSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = "\n      <div class=\"sidebar-logo\">\n        <div class=\"logo-mark\">N</div>\n        <span class=\"logo-text\">exPlay</span>\n      </div>\n      <ul class=\"sidebar-nav\">\n        <li>\n          <div class=\"nav-item\" data-nav data-nav-page=\"home\" tabindex=\"0\">\n            ".concat(ICONS.home, "<span class=\"nav-label\">Home</span>\n          </div>\n        </li>\n        <li>\n          <div class=\"nav-item\" data-nav data-nav-page=\"movies\" tabindex=\"0\">\n            ").concat(ICONS.movies, "<span class=\"nav-label\">Movies</span>\n          </div>\n        </li>\n        <li>\n          <div class=\"nav-item\" data-nav data-nav-page=\"series\" tabindex=\"0\">\n            ").concat(ICONS.series, "<span class=\"nav-label\">Series</span>\n          </div>\n        </li>\n        <li>\n          <div class=\"nav-item\" data-nav data-nav-page=\"favourites\" tabindex=\"0\">\n            ").concat(ICONS.favourites, "<span class=\"nav-label\">Favourites</span>\n          </div>\n        </li>\n        <li>\n          <div class=\"nav-item\" data-nav data-nav-page=\"watchlist\" tabindex=\"0\">\n            ").concat(ICONS.watchlist, "<span class=\"nav-label\">Watchlist</span>\n          </div>\n        </li>\n        <li>\n          <div class=\"nav-item\" data-nav data-nav-page=\"iptv\" tabindex=\"0\">\n            ").concat(ICONS.iptv, "<span class=\"nav-label\">Live TV</span>\n          </div>\n        </li>\n      </ul>");
    sidebar.querySelectorAll('[data-nav-page]').forEach(function (el) {
      el.addEventListener('click', function () {
        return navigate(el.dataset.navPage);
      });
      el.addEventListener('nav:focus', function () {
        return expandSidebar(true);
      });
    });
  }
  function expandSidebar(on) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    _sidebarExpanded = on;
    sidebar.classList.toggle('expanded', on);
  }
  function updateSidebarActive(page) {
    document.querySelectorAll('[data-nav-page]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.navPage === page);
    });
  }

  // ── Navigation ──────────────────────────────────────────
  function navigate(page) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var def = PAGES[page];
    if (!def) return;

    // Close player if open
    var modal = document.getElementById('player-modal');
    if (page !== 'player' && modal && !modal.classList.contains('hidden')) {
      PlayerPage.closePlayer();
    }

    // Leave current page
    if (_currentPage && PAGES[_currentPage]) {
      var _leaveMod = PAGES[_currentPage].module();
      if (_leaveMod.onLeave) _leaveMod.onLeave();
    }
    _currentPage = page;
    _pageParams = params;
    updateSidebarActive(page);
    expandSidebar(false);
    var content = document.getElementById('main-content');
    if (content) {
      content.scrollTop = 0;
      def.module().render(content, params);
    }
    document.title = "NexPlay \u2014 ".concat(def.label);
  }

  // Special case: player opens as a modal overlay.
  // Still call onLeave for the current page so IPTV audio stops, scan halts, etc.
  function navigatePlayer(params) {
    if (_currentPage && PAGES[_currentPage]) {
      var mod = PAGES[_currentPage].module();
      if (mod.onLeave) mod.onLeave();
    }
    PlayerPage.render(document.getElementById('main-content'), params);
  }

  // Override navigate to handle player specially
  var _origNavigate = navigate;
  function navigateFull(page) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    if (page === 'player') {
      navigatePlayer(params);
    } else {
      _origNavigate(page, params);
    }
  }

  // ── Back handler ────────────────────────────────────────
  function handleBack() {
    // Close any open dropdown first (prevents Escape navigating away mid-dropdown)
    var openDD = document.querySelector('.tdd-wrapper.open');
    if (openDD) {
      var ddId = openDD.id.replace('tdd-wrap-', '');
      var ddList = document.getElementById('tdd-list-' + ddId);
      var ddTrigger = openDD.querySelector('[data-tdd-trigger]');
      if (ddList) ddList.classList.add('hidden');
      openDD.classList.remove('open');
      if (ddTrigger) Nav.focusEl(ddTrigger);
      return;
    }
    var modal = document.getElementById('player-modal');
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

  // ── Viewport scaling — keeps 1920×1080 layout on TV/desktop ──
  // Below 1024px (mobile/tablet) CSS responsive layout takes over instead.
  function scaleApp() {
    var app = document.getElementById('app');
    if (!app) return;
    if (window.innerWidth < 1024) {
      // Mobile — disable canvas scaling, let CSS handle layout
      app.style.transform = 'none';
      app.style.left = '0';
      app.style.top = '0';
      app.style.width = '';
      app.style.height = '';
      document.body.classList.add('is-mobile');
    } else {
      document.body.classList.remove('is-mobile');
      var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      app.style.transform = "scale(".concat(scale, ")");
      app.style.left = Math.max(0, (window.innerWidth - 1920 * scale) / 2) + 'px';
      app.style.top = Math.max(0, (window.innerHeight - 1080 * scale) / 2) + 'px';
      app.style.width = '1920px';
      app.style.height = '1080px';
    }
  }
  function showToast(msg, duration) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove('visible');
    }, duration || 2500);
  }
  return {
    init: init,
    navigate: navigateFull,
    genreMap: genreMap,
    cycleTheme: cycleTheme,
    showToast: showToast
  };
}();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  return App.init();
});