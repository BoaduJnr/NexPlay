const SeriesPage = (() => {
  let _genres = [];
  let _activeGenre = null;
  let _activeSort = 'popularity.desc';
  let _activeTab = 'popular';
  let _activeSearch = '';
  let _page = 1;
  let _loading = false;

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
    const year   = (show.first_air_date || '').slice(0, 4);
    const rating = show.vote_average ? show.vote_average.toFixed(1) : '';
    return `
      <div class="card" data-nav data-show-id="${show.id}" tabindex="0">
        <div class="card-poster">
          ${poster
            ? `<img src="${poster}" alt="${show.name}" loading="lazy">`
            : `<div class="no-img">📺</div>`}
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
          <div style="position:absolute;top:10px;left:10px;background:#22d3ee;
            color:#000;font-size:10px;font-weight:800;padding:3px 7px;border-radius:4px;
            letter-spacing:0.5px;">SERIES</div>
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="card-prog" id="cprog-${show.id}"></div>
        </div>
        <div class="card-info">
          <div class="card-title">${show.name || ''}</div>
          <div class="card-year">${year}</div>
        </div>
      </div>`;
  }

  // ── Fetch based on active tab ────────────────────────────
  async function fetchShows(page = 1) {
    if (_activeSearch) {
      return TMDB.searchTv(_activeSearch, page);
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
      grid.innerHTML = Array.from({ length: 12 }, () =>
        `<div class="card">
          <div class="card-poster skeleton"></div>
          <div class="card-info">
            <div class="skeleton" style="height:14px;width:80%;margin-bottom:6px;border-radius:4px;"></div>
            <div class="skeleton" style="height:12px;width:40%;border-radius:4px;"></div>
          </div>
        </div>`
      ).join('');
    }

    try {
      const data = await fetchShows(_page);
      const cards = data.results.map(showCard).join('');
      if (replace) { grid.innerHTML = cards; } else { grid.insertAdjacentHTML('beforeend', cards); }
      bindCardClicks(grid);
      fillProgressBars(grid);
      setupAutoPaging(grid);
      if (replace) Nav.reset(document.getElementById('series-page'));
    } catch (err) {
      console.error('Series load error:', err);
    }
    _loading = false;
  }

  function setupAutoPaging(grid) {
    var cards = grid.querySelectorAll('.card');
    if (!cards.length) return;
    var lastCard = cards[cards.length - 1];
    lastCard.addEventListener('nav:focus', function() {
      if (!_loading) {
        _page++;
        loadShows(false);
      }
    });
  }

  function bindCardClicks(container) {
    container.querySelectorAll('[data-show-id]').forEach(el => {
      el.addEventListener('click', () => {
        App.navigate('player', { id: el.dataset.showId, type: 'tv', season: 1, episode: 1 });
      });
    });
  }

  function fillProgressBars(container) {
    if (typeof NexPlayDB === 'undefined') return;
    (container || document).querySelectorAll('[id^="cprog-"]').forEach(function(el) {
      var id = el.id.replace('cprog-', '');
      var saved = NexPlayDB.getProgress(id, 'movie') || NexPlayDB.getProgress(id, 'tv');
      if (saved && saved.position > 5000 && saved.duration > 0) {
        var pct = Math.min(98, (saved.position / saved.duration) * 100).toFixed(0);
        el.innerHTML = '<div style="width:' + pct + '%;height:100%;background:#7c3aed;border-radius:0 2px 0 0;"></div>';
      }
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

        <div style="padding:20px 72px 8px;display:-webkit-flex;display:flex;align-items:center;">
          <input type="text" id="series-search-input" placeholder="Search series..." data-nav tabindex="0"
            style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                   color:#f0f0f8;font-size:18px;padding:10px 18px;border-radius:8px;
                   width:360px;outline:none;">
        </div>

        <div style="padding:0 72px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px;">
          <span style="font-size:16px;font-weight:700;color:rgba(240,240,248,0.45);letter-spacing:1px;text-transform:uppercase;">Sort</span>
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

    var seriesSearchInput = document.getElementById('series-search-input');
    var _searchTimer = null;
    if (seriesSearchInput) {
      seriesSearchInput.addEventListener('input', function() {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(function() {
          _activeSearch = seriesSearchInput.value.trim();
          _page = 1;
          loadShows(true);
        }, 500);
      });
      seriesSearchInput.addEventListener('keydown', function(e) {
        if (e.keyCode === 13) {
          e.stopPropagation();
          clearTimeout(_searchTimer);
          _activeSearch = seriesSearchInput.value.trim();
          _page = 1;
          loadShows(true);
        }
      });
    }

    await loadShows(true);
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

  function onLeave() {}

  return { render, onLeave };
})();
