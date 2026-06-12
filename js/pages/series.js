const SeriesPage = (() => {
  let _genres = [];
  let _activeGenre = null;
  let _activeSort = 'popularity.desc';
  let _activeTab = 'popular';
  let _activeSearch = '';
  let _page = 1;
  let _loading = false;
  let _scrollHandler = null;
  let _scrollObserver = null;
  let _keyHandler = null;

  const TABS = [
    { id: 'popular',     label: 'Popular' },
    { id: 'trending',    label: 'Trending' },
    { id: 'top_rated',   label: 'Top Rated' },
    { id: 'airing',      label: 'Airing Today' },
    { id: 'on_air',      label: 'On The Air' },
  ];

  const SORT_OPTIONS = [
    { value: 'popularity.desc',    label: 'Most Popular' },
    { value: 'vote_average.desc',  label: 'Highest Rated' },
    { value: 'first_air_date.desc',label: 'Newest First' },
    { value: 'first_air_date.asc', label: 'Oldest First' },
    { value: 'name.asc',           label: 'A – Z' },
  ];

  // ── Card ────────────────────────────────────────────────
  function showCard(show) {
    const poster = show.poster_path ? TMDB.img(show.poster_path, Config.IMG.POSTER_MD) : '';
    const rating = show.vote_average ? show.vote_average.toFixed(1) : '';
    return `
      <div class="card" data-nav data-show-id="${show.id}"
           data-show-title="${(show.name || '').replace(/"/g, '&quot;')}"
           data-show-poster="${poster}"
           tabindex="0">
        <div class="card-poster">
          ${poster
            ? `<img src="${poster}" alt="${show.name}" loading="lazy">`
            : `<div class="no-img">📺</div>`}
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
          <div class="card-badges card-badges--below" id="badges-${show.id}">
            ${UX.badgesHTML(show.id, 'tv')}
          </div>
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="card-mobile-actions">
            <button class="card-action-btn" data-action="info" title="More Info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></button>
            <button class="card-action-btn${typeof NexPlayDB!=='undefined'&&NexPlayDB.isFavourite(show.id,'tv')?' fav-active':''}" data-action="fav" title="Favourite">${typeof NexPlayDB!=='undefined'&&NexPlayDB.isFavourite(show.id,'tv')?'♥':'♡'}</button>
            <button class="card-action-btn${typeof NexPlayDB!=='undefined'&&NexPlayDB.isInWatchlist(show.id,'tv')?' wl-active':''}" data-action="wl" title="Watchlist"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
          </div>
          <div class="card-ia-rating card-ia-na" id="ia-${show.id}" title="No NexPlay ratings yet">N/A</div>
          <div class="card-prog" id="cprog-${show.id}" data-type="tv"></div>
        </div>
      </div>`;
  }

  function updateCardBadge(showId) {
    const el = document.getElementById('badges-' + showId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(showId, 'tv');
  }

  function bindRemoteKeys() {
    _keyHandler = function(e) {
      // TV Back: if search active, re-focus input first press; clear on second press
      if (e.keyCode === Config.KEYS.BACK || e.keyCode === 10009) {
        var wrap = document.getElementById('series-search-wrap');
        var inp  = document.getElementById('series-search-input');
        if (wrap && wrap.style.display !== 'none' && document.activeElement !== inp) {
          e.preventDefault(); e.stopPropagation();
          inp.focus();
          return;
        }
      }

      if (typeof NexPlayDB === 'undefined') return;
      const focused = Nav.current() ||
        document.querySelector('[data-nav].nav-focused[data-show-id]');
      if (!focused || !focused.dataset.showId) return;
      const showId = focused.dataset.showId;
      const title  = focused.dataset.showTitle  || '';
      const poster = focused.dataset.showPoster || '';
      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        const added = NexPlayDB.toggleFavourite(showId, 'tv', title, poster);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(showId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        const added = NexPlayDB.toggleWatchlist(showId, 'tv', title, poster);
        App.showToast(added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        updateCardBadge(showId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      } else if (e.keyCode === Config.KEYS.YELLOW) {
        e.preventDefault();
        App.navigate('detail', { id: showId, type: 'tv' });
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }

  function unbindRemoteKeys() {
    if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }

  function setupScrollPaging() {
    teardownScrollPaging();
    var grid = document.getElementById('series-grid');
    if (!grid) return;

    var sentinel = document.createElement('div');
    sentinel.id = 'nexplay-pg-sentinel';
    sentinel.style.height = '4px';
    grid.insertAdjacentElement('afterend', sentinel);

    if (typeof IntersectionObserver !== 'undefined') {
      var isMobile = window.innerWidth < 1024;
      _scrollObserver = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting && !_loading) {
          _page++;
          loadShows(false);
        }
      }, {
        root: isMobile ? null : document.getElementById('main-content'),
        rootMargin: '0px 0px 600px 0px',
      });
      _scrollObserver.observe(sentinel);
    } else {
      var mc = document.getElementById('main-content');
      if (!mc) return;
      _scrollHandler = function() {
        if (_loading) return;
        if (mc.scrollHeight - mc.scrollTop - mc.clientHeight < 400) {
          _page++;
          loadShows(false);
        }
      };
      mc.addEventListener('scroll', _scrollHandler);
    }
  }

  function teardownScrollPaging() {
    if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
    if (_scrollHandler) {
      var mc = document.getElementById('main-content');
      if (mc) mc.removeEventListener('scroll', _scrollHandler);
      window.removeEventListener('scroll', _scrollHandler);
      _scrollHandler = null;
    }
    var s = document.getElementById('nexplay-pg-sentinel');
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }

  // ── Fetch based on active tab ────────────────────────────
  async function fetchShows(page = 1) {
    if (_activeSearch) {
      const searchData = await TMDB.searchTv(_activeSearch, page);
      if (_activeGenre) {
        searchData.results = searchData.results.filter(function(r) { return r.genre_ids && r.genre_ids.indexOf(_activeGenre) !== -1; });
      }
      return searchData;
    }
    if (_activeGenre || _activeSort !== 'popularity.desc') {
      return TMDB.tvDiscover({
        with_genres: _activeGenre || undefined,
        sort_by: _activeSort,
        page,
      });
    }
    switch (_activeTab) {
      case 'trending':  return TMDB.tvTrending('week', page);
      case 'top_rated': return TMDB.tvTopRated(page);
      case 'airing':    return TMDB.tvAiringToday(page);
      case 'on_air':    return TMDB.tvOnTheAir(page);
      default:          return TMDB.tvPopular(page);
    }
  }

  async function loadShows(replace = true) {
    if (_loading) return;
    _loading = true;
    const grid = document.getElementById('series-grid');
    if (!grid) { _loading = false; return; }

    if (replace) {
      _page = 1;
      grid.innerHTML = UX.skeletonCards(12);
    }

    try {
      const data = await fetchShows(_page);
      const cards = data.results.map(showCard).join('');
      if (replace) { grid.innerHTML = cards; } else { grid.insertAdjacentHTML('beforeend', cards); }
      bindCardClicks(grid);
      UX.fillProgressBars(grid);
      UX.fetchInAppRatings(data.results.map(function(s) { return String(s.id); }));
      if (replace) {
        var _si  = document.getElementById('series-search-input');
        var _sw  = document.getElementById('series-search-wrap');
        if (document.activeElement !== _si) {
          Nav.reset(document.getElementById('series-page'));
          var _tvSearchActive = !document.body.classList.contains('is-web') &&
                                !document.body.classList.contains('is-mobile') &&
                                _sw && _sw.style.display !== 'none';
          if (_tvSearchActive) {
            var firstCard = document.querySelector('#series-grid [data-nav]');
            if (firstCard) Nav.focusEl(firstCard);
          }
        }
      }
    } catch (err) {
      console.error('Series load error:', err);
    }
    _loading = false;
  }

  function bindCardClicks(container) {
    container.querySelectorAll('[data-show-id]').forEach(el => {
      el.addEventListener('click', () => {
        App.navigate('player', { id: el.dataset.showId, type: 'tv', season: 1, episode: 1 });
      });
    });
  }


  // ── Genre pills ─────────────────────────────────────────
  function genrePills() {
    const allActive = _activeGenre === null ? 'active' : '';
    const pills = _genres.map(g => {
      const active = _activeGenre === g.id ? 'active' : '';
      return `<div class="pill ${active}" data-nav data-genre-id="${g.id}" tabindex="0">${g.name}</div>`;
    }).join('');
    return `<div class="pill ${allActive}" data-nav data-genre-id="" tabindex="0" data-nav-default>All</div>${pills}`;
  }

  // ── Tabs ────────────────────────────────────────────────
  function tabsHTML() {
    return TABS.map(t =>
      `<div class="pill ${_activeTab === t.id && !_activeGenre ? 'active' : ''}"
        data-nav data-tab="${t.id}" tabindex="0">${t.label}</div>`
    ).join('');
  }

  async function render(container) {
    container.innerHTML = `
      <div id="series-page">
        <div class="page-header">
          <h1 class="page-title">TV Series</h1>
          <p class="page-subtitle">Discover popular shows, trending series, and more</p>
        </div>

        <div style="padding:${window.innerWidth < 1024 ? '12px 16px 8px' : '20px 72px 8px'};display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:12px;${window.innerWidth >= 1024 ? 'max-width:520px;' : ''}min-width:0;">
          <button id="series-search-btn" class="search-pill-btn" data-nav tabindex="0" style="-webkit-flex:1;flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Search series...</span>
          </button>
          <div id="series-search-wrap" style="display:none;-webkit-align-items:center;align-items:center;gap:8px;-webkit-flex:1;flex:1;min-width:0;">
            <input type="text" id="series-search-input" class="search-active-input"
                   placeholder="Type to search..." autocomplete="off">
            <button id="series-search-close" class="search-close-btn" data-nav tabindex="0">&#x2715;</button>
          </div>
        </div>

        <div style="padding:${window.innerWidth < 1024 ? '4px 16px 0' : '0 72px 0'};display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:${window.innerWidth < 1024 ? '6px' : '16px'};">
          <span class="filter-label" style="${window.innerWidth < 1024 ? 'display:none' : ''}">Sort</span>
          ${TVDropdown.html('series-sort', SORT_OPTIONS, _activeSort)}
        </div>

        <div style="padding:12px 0 4px;">
          <div class="filter-bar" data-scroll id="series-tabs">${tabsHTML()}</div>
        </div>

        <div style="padding:0 0 4px;">
          <div class="filter-bar" data-scroll id="series-genres">
            ${_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8)}
          </div>
        </div>

        <div class="movie-grid" id="series-grid"></div>
      </div>`;

    // Load genres
    if (!_genres.length) {
      try {
        const gData = await TMDB.tvGenres();
        _genres = gData.genres;
        const el = document.getElementById('series-genres');
        if (el) { el.innerHTML = genrePills(); bindGenrePills(el); }
      } catch (_) {}
    } else {
      bindGenrePills(document.getElementById('series-genres'));
    }

    // Tabs
    const seriesTabs = document.getElementById('series-tabs');
    if (seriesTabs) seriesTabs.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', () => {
        _activeTab = el.dataset.tab;
        _activeGenre = null;
        document.querySelectorAll('#series-tabs [data-tab]').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#series-genres [data-genre-id]').forEach(t => t.classList.remove('active'));
        const defaultGenre = document.querySelector('#series-genres [data-genre-id=""]');
        if (defaultGenre) defaultGenre.classList.add('active');
        el.classList.add('active');
        loadShows(true);
      });
    });

    TVDropdown.mount('series-sort', v => { _activeSort = v; loadShows(true); });

    const searchBtn = document.getElementById('series-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        searchBtn.style.display = 'none';
        document.getElementById('series-search-wrap').style.display = 'flex';
        document.getElementById('series-search-input').focus();
      });
    }

    var _isTv = !document.body.classList.contains('is-web') && !document.body.classList.contains('is-mobile');
    const seriesSearchInput = document.getElementById('series-search-input');
    let _searchTimer = null;
    if (seriesSearchInput) {
      seriesSearchInput.addEventListener('keydown', function(e) {
        e.stopPropagation();
        if (e.keyCode === 13) {
          clearTimeout(_searchTimer);
          _activeSearch = seriesSearchInput.value.trim();
          _page = 1;
          if (!_activeSearch) {
            seriesSearchInput.value = '';
            document.getElementById('series-search-wrap').style.display = 'none';
            searchBtn.style.display = '';
            Nav.focusEl(searchBtn);
            return;
          }
          loadShows(true);
          // TV: blur so D-pad can navigate results without clearing search
          if (_isTv) seriesSearchInput.blur();
        } else if (e.keyCode === 40 && _isTv) {
          // TV: Down arrow → move focus to results
          e.preventDefault();
          seriesSearchInput.blur();
        } else if (e.keyCode === 27 || e.keyCode === Config.KEYS.BACK) {
          seriesSearchInput.value = '';
          _activeSearch = '';
          document.getElementById('series-search-wrap').style.display = 'none';
          searchBtn.style.display = '';
          Nav.focusEl(searchBtn);
          _page = 1;
          loadShows(true);
        }
      });
      seriesSearchInput.addEventListener('input', function() {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(function() {
          _activeSearch = seriesSearchInput.value.trim();
          _page = 1;
          loadShows(true);
        }, 500);
      });
    }

    const seriesClose = document.getElementById('series-search-close');
    if (seriesClose) {
      seriesClose.addEventListener('click', function() {
        seriesSearchInput.value = '';
        _activeSearch = '';
        document.getElementById('series-search-wrap').style.display = 'none';
        searchBtn.style.display = '';
        Nav.focusEl(searchBtn);
        _page = 1;
        loadShows(true);
      });
    }

    await loadShows(true);
    setupScrollPaging();
    bindRemoteKeys();
  }

  function bindGenrePills(container) {
    container.querySelectorAll('[data-genre-id]').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('[data-genre-id]').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        _activeGenre = el.dataset.genreId ? parseInt(el.dataset.genreId) : null;
        // Clear tab active state when genre is selected
        document.querySelectorAll('#series-tabs [data-tab]').forEach(t => t.classList.remove('active'));
        loadShows(true);
      });
    });
  }

  function onLeave() {
    teardownScrollPaging();
    unbindRemoteKeys();
  }

  return { render, onLeave };
})();
