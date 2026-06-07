const MoviesPage = (() => {
  let _genres = [];
  let _activeGenre = null;
  let _activeSort = 'popularity.desc';
  let _activeYear = '';
  let _activeSearch = '';
  let _page = 1;
  let _loading = false;
  let _scrollHandler = null;
  let _scrollObserver = null;
  let _keyHandler = null;

  const SORT_OPTIONS = [
    { value: 'popularity.desc',       label: 'Most Popular' },
    { value: 'vote_average.desc',     label: 'Highest Rated' },
    { value: 'release_date.desc',     label: 'Newest First' },
    { value: 'release_date.asc',      label: 'Oldest First' },
    { value: 'revenue.desc',          label: 'Highest Grossing' },
    { value: 'original_title.asc',    label: 'A – Z' },
  ];

  const YEAR_OPTIONS = [
    { value: '',     label: 'All Years' },
    { value: '2024', label: '2024' },
    { value: '2023', label: '2023' },
    { value: '2022', label: '2022' },
    { value: '2021', label: '2021' },
    { value: '2020', label: '2020' },
    { value: '2010', label: '2010s' },
    { value: '2000', label: '2000s' },
    { value: '1990', label: '90s' },
    { value: '1980', label: '80s' },
  ];

  // ── Card rendering ──────────────────────────────────────
  function movieCard(movie) {
    const poster = movie.poster_path ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD) : '';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return `
      <div class="card" data-nav data-movie-id="${movie.id}"
           data-movie-title="${(movie.title || '').replace(/"/g, '&quot;')}"
           data-movie-poster="${poster}"
           tabindex="0">
        <div class="card-poster">
          ${poster
            ? `<img src="${poster}" alt="${movie.title}" loading="lazy">`
            : `<div class="no-img">🎬</div>`}
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
          <div class="card-badges" id="badges-${movie.id}">
            ${UX.badgesHTML(movie.id, 'movie')}
          </div>
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="card-mobile-actions">
            <button class="card-action-btn${typeof NexPlayDB!=='undefined'&&NexPlayDB.isFavourite(movie.id,'movie')?' fav-active':''}" data-action="fav" title="Favourite">${typeof NexPlayDB!=='undefined'&&NexPlayDB.isFavourite(movie.id,'movie')?'♥':'♡'}</button>
            <button class="card-action-btn${typeof NexPlayDB!=='undefined'&&NexPlayDB.isInWatchlist(movie.id,'movie')?' wl-active':''}" data-action="wl" title="Watchlist"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
          </div>
          <div class="card-prog" id="cprog-${movie.id}" data-type="movie"></div>
        </div>
      </div>`;
  }

  function updateCardBadge(movieId) {
    const el = document.getElementById('badges-' + movieId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(movieId, 'movie');
  }

  // ── Genre pills ─────────────────────────────────────────
  function genrePills() {
    const allActive = _activeGenre === null ? 'active' : '';
    const pills = _genres.map(g => {
      const active = _activeGenre === g.id ? 'active' : '';
      return `<div class="pill ${active}" data-nav data-genre-id="${g.id}" tabindex="0">${g.name}</div>`;
    }).join('');
    return `
      <div class="pill ${allActive}" data-nav data-genre-id="" tabindex="0" data-nav-default>All</div>
      ${pills}`;
  }

  function sortSelect() { return TVDropdown.html('movies-sort', SORT_OPTIONS, _activeSort); }
  function yearSelect() { return TVDropdown.html('movies-year', YEAR_OPTIONS, _activeYear); }

  // ── Load movies ─────────────────────────────────────────
  async function loadMovies(replace = true) {
    if (_loading) return;
    _loading = true;
    const grid = document.getElementById('movies-grid');
    if (!grid) { _loading = false; return; }

    if (replace) {
      grid.innerHTML = UX.skeletonCards(12);
      _page = 1;
    }

    try {
      let data;
      if (_activeSearch) {
        data = await TMDB.search(_activeSearch, _page);
        if (_activeGenre) {
          data = { results: data.results.filter(function(r) { return r.genre_ids && r.genre_ids.indexOf(_activeGenre) !== -1; }), total_results: data.total_results };
        }
      } else {
        const params = { sort_by: _activeSort, page: _page };
        if (_activeGenre) params.with_genres = _activeGenre;
        if (_activeYear) {
          const y = parseInt(_activeYear);
          if (y < 2000) {
            params['primary_release_date.gte'] = `${y}-01-01`;
            params['primary_release_date.lte'] = `${y + 9}-12-31`;
          } else {
            params.primary_release_year = _activeYear;
          }
        }
        data = await TMDB.discover(params);
      }
      const cards = data.results.map(movieCard).join('');
      if (replace) {
        grid.innerHTML = cards;
      } else {
        grid.insertAdjacentHTML('beforeend', cards);
      }
      bindCardClicks(grid);
      UX.fillProgressBars(grid);
      if (replace) {
        var _si  = document.getElementById('movie-search-input');
        var _sw  = document.getElementById('movie-search-wrap');
        if (document.activeElement !== _si) {
          Nav.reset(document.getElementById('movies-page'));
          var _tvSearchActive = !document.body.classList.contains('is-web') &&
                                !document.body.classList.contains('is-mobile') &&
                                _sw && _sw.style.display !== 'none';
          if (_tvSearchActive) {
            var firstCard = document.querySelector('#movies-grid [data-nav]');
            if (firstCard) Nav.focusEl(firstCard);
          }
        }
      }
    } catch (err) {
      console.error('Movies load error:', err);
    }
    _loading = false;
  }

  // ── Scroll-based pagination ─────────────────────────────
  function setupScrollPaging() {
    teardownScrollPaging();
    var grid = document.getElementById('movies-grid');
    if (!grid) return;

    // Sentinel sits AFTER the grid so card appends don't push it around
    var sentinel = document.createElement('div');
    sentinel.id = 'nexplay-pg-sentinel';
    sentinel.style.height = '4px';
    grid.insertAdjacentElement('afterend', sentinel);

    if (typeof IntersectionObserver !== 'undefined') {
      // Mobile / modern browser: observe sentinel against the viewport.
      // TV with IntersectionObserver: observe against #main-content container.
      var isMobile = window.innerWidth < 1024;
      _scrollObserver = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting && !_loading) {
          _page++;
          loadMovies(false);
        }
      }, {
        root: isMobile ? null : document.getElementById('main-content'),
        rootMargin: '0px 0px 600px 0px',
      });
      _scrollObserver.observe(sentinel);
    } else {
      // Tizen / old browser: scroll event on #main-content
      var mc = document.getElementById('main-content');
      if (!mc) return;
      _scrollHandler = function() {
        if (_loading) return;
        if (mc.scrollHeight - mc.scrollTop - mc.clientHeight < 400) {
          _page++;
          loadMovies(false);
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

  // ── Remote key handler ─────────────────────────────────
  function bindRemoteKeys() {
    _keyHandler = function(e) {
      // TV Back key: if search is active, re-focus input (first Back) or clear (second Back)
      if (e.keyCode === Config.KEYS.BACK || e.keyCode === 10009) {
        var wrap = document.getElementById('movie-search-wrap');
        var inp  = document.getElementById('movie-search-input');
        if (wrap && wrap.style.display !== 'none' && document.activeElement !== inp) {
          e.preventDefault(); e.stopPropagation();
          inp.focus();
          return;
        }
      }

      if (typeof NexPlayDB === 'undefined') return;
      const focused = Nav.current() ||
        document.querySelector('[data-nav].nav-focused[data-movie-id]');
      if (!focused || !focused.dataset.movieId) return;
      const movieId = focused.dataset.movieId;
      const title   = focused.dataset.movieTitle || '';
      const poster  = focused.dataset.moviePoster || '';

      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        const added = NexPlayDB.toggleFavourite(movieId, 'movie', title, poster);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(movieId);
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        const added = NexPlayDB.toggleWatchlist(movieId, 'movie', title, poster);
        App.showToast(added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        updateCardBadge(movieId);
      } else if (e.keyCode === Config.KEYS.YELLOW) {
        e.preventDefault();
        App.navigate('detail', { id: movieId, type: 'movie' });
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }

  function unbindRemoteKeys() {
    if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }

  // ── Card clicks ─────────────────────────────────────────
  function bindCardClicks(container) {
    container.querySelectorAll('[data-movie-id]').forEach(el => {
      el.addEventListener('click', () => {
        App.navigate('player', { id: el.dataset.movieId, type: 'movie' });
      });
    });
  }


  // ── Genre pills ─────────────────────────────────────────
  function bindGenrePills(container) {
    container.querySelectorAll('[data-genre-id]').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('[data-genre-id]').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        _activeGenre = el.dataset.genreId ? parseInt(el.dataset.genreId) : null;
        loadMovies(true);
      });
    });
  }

  // ── Search activation ───────────────────────────────────
  function activateSearch() {
    document.getElementById('movie-search-btn').style.display = 'none';
    document.getElementById('movie-search-wrap').style.display = 'flex';
    document.getElementById('movie-search-input').focus();
  }

  function deactivateSearch(clearResults) {
    const input = document.getElementById('movie-search-input');
    if (input) input.value = '';
    document.getElementById('movie-search-wrap').style.display = 'none';
    document.getElementById('movie-search-btn').style.display = '';
    Nav.focusEl(document.getElementById('movie-search-btn'));
    if (clearResults && _activeSearch) {
      _activeSearch = '';
      loadMovies(true);
    }
  }

  // ── Render ──────────────────────────────────────────────
  async function render(container, params = {}) {
    _activeGenre = params.genre ? parseInt(params.genre) : null;

    container.innerHTML = `
      <div id="movies-page">
        <div class="page-header">
          <h1 class="page-title">Movies</h1>
          <p class="page-subtitle">Explore thousands of movies by genre, year, and more</p>
        </div>

        <div style="padding:${window.innerWidth < 1024 ? '12px 16px 8px' : '20px 72px 8px'};display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:12px;${window.innerWidth >= 1024 ? 'max-width:520px;' : ''}min-width:0;">
          <!-- Search trigger button — sits in the nav flow -->
          <button id="movie-search-btn" class="search-pill-btn" data-nav tabindex="0" style="-webkit-flex:1;flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Search movies...</span>
          </button>
          <!-- Active search input — hidden until button is pressed -->
          <div id="movie-search-wrap" style="display:none;-webkit-align-items:center;align-items:center;gap:8px;-webkit-flex:1;flex:1;min-width:0;">
            <input type="text" id="movie-search-input" class="search-active-input"
                   placeholder="Type to search..." autocomplete="off">
            <button id="movie-search-close" class="search-close-btn">&#x2715;</button>
          </div>
        </div>

        <div style="padding:${window.innerWidth < 1024 ? '4px 16px 0' : '0 72px 0'};display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:${window.innerWidth < 1024 ? '6px' : '16px'};flex-wrap:${window.innerWidth < 1024 ? 'nowrap' : 'wrap'};">
          <span class="filter-label" style="${window.innerWidth < 1024 ? 'display:none' : ''}">Sort by</span>
          ${sortSelect()}
          <span class="filter-label" style="margin-left:${window.innerWidth < 1024 ? '0' : '8px'};${window.innerWidth < 1024 ? 'display:none' : ''}">Year</span>
          ${yearSelect()}
        </div>

        <div style="padding:16px 0 8px;">
          <div class="filter-bar" data-scroll id="genre-bar">
            ${_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8)}
          </div>
        </div>

        <div class="movie-grid" id="movies-grid"></div>
      </div>`;

    // Genres
    if (!_genres.length) {
      try {
        const gData = await TMDB.genres();
        _genres = gData.genres;
        const bar = document.getElementById('genre-bar');
        if (bar) bar.innerHTML = genrePills();
        bindGenrePills(bar);
      } catch (_) {}
    } else {
      bindGenrePills(document.getElementById('genre-bar'));
    }

    TVDropdown.mount('movies-sort', v => { _activeSort = v; loadMovies(true); });
    TVDropdown.mount('movies-year', v => { _activeYear = v; loadMovies(true); });

    // Search button activates on click or Enter
    const searchBtn = document.getElementById('movie-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', activateSearch);
    }

    // Search input — captures all keystrokes while active
    const searchInput = document.getElementById('movie-search-input');
    let _searchTimer = null;
    var _isTv = !document.body.classList.contains('is-web') && !document.body.classList.contains('is-mobile');
    if (searchInput) {
      searchInput.addEventListener('keydown', function(e) {
        e.stopPropagation(); // prevent D-pad nav while typing
        if (e.keyCode === 13) {
          clearTimeout(_searchTimer);
          _activeSearch = searchInput.value.trim();
          _page = 1;
          if (!_activeSearch) { deactivateSearch(false); return; }
          loadMovies(true);
          // TV: blur input after Enter so D-pad can navigate results without clearing search
          if (_isTv) searchInput.blur();
        } else if (e.keyCode === 40 && _isTv) {
          // TV: Down arrow while in search → move focus to results
          e.preventDefault();
          searchInput.blur();
        } else if (e.keyCode === 27 || e.keyCode === Config.KEYS.BACK) {
          deactivateSearch(true);
        }
      });
      searchInput.addEventListener('input', function() {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(function() {
          _activeSearch = searchInput.value.trim();
          _page = 1;
          loadMovies(true);
        }, 500);
      });
    }

    const closeBtn = document.getElementById('movie-search-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() { deactivateSearch(true); });
    }

    await loadMovies(true);
    setupScrollPaging();
    bindRemoteKeys();
  }

  function onLeave() {
    teardownScrollPaging();
    unbindRemoteKeys();
  }

  return { render, onLeave };
})();
