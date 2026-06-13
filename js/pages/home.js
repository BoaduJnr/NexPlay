const HomePage = (() => {
  let _heroMovies = [];
  let _heroIdx = 0;
  let _heroTimer = null;
  let _keyHandler = null;

  // ── Helpers ────────────────────────────────────────────
  function movieCard(movie, extraClass = '') {
    const poster = movie.poster_path
      ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD)
      : '';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return `
      <div class="card ${extraClass}" data-nav data-movie-id="${movie.id}"
           data-movie-title="${(movie.title || '').replace(/"/g, '&quot;')}"
           data-movie-poster="${poster}"
           data-movie-rating="${rating}"
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
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <div class="card-mobile-actions">
            <button class="card-action-btn" data-action="info" title="More Info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></button>
            <button class="card-action-btn${typeof NexPlayDB!=='undefined'&&NexPlayDB.isFavourite(movie.id,'movie')?' fav-active':''}" data-action="fav" title="Favourite">${typeof NexPlayDB!=='undefined'&&NexPlayDB.isFavourite(movie.id,'movie')?'♥':'♡'}</button>
            <button class="card-action-btn${typeof NexPlayDB!=='undefined'&&NexPlayDB.isInWatchlist(movie.id,'movie')?' wl-active':''}" data-action="wl" title="Watchlist"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
          </div>
          <div class="card-ia-rating card-ia-na" id="ia-${movie.id}" title="No NexPlay ratings yet">N/A</div>
          <div class="card-prog" id="cprog-${movie.id}" data-type="movie"></div>
        </div>
      </div>`;
  }

  function skeletonRow(count = 6) {
    return Array.from({ length: count }, () =>
      `<div class="card">
        <div class="card-poster skeleton"></div>
        <div class="card-info">
          <div class="skeleton" style="height:14px;width:80%;margin-bottom:6px;border-radius:4px;"></div>
          <div class="skeleton" style="height:12px;width:40%;border-radius:4px;"></div>
        </div>
      </div>`
    ).join('');
  }

  function renderRow(id, title, subtitle = '') {
    return `
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">${title} ${subtitle ? `<span>${subtitle}</span>` : ''}</h2>
        </div>
        <div class="card-row" data-scroll id="row-${id}">
          ${skeletonRow()}
        </div>
      </section>`;
  }

  // ── Hero ────────────────────────────────────────────────
  function renderHero(movie) {
    if (!movie) return '';
    const backdrop = TMDB.backdrop(movie.backdrop_path);
    const year = (movie.release_date || '').slice(0, 4);
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    const genres = (movie.genre_ids || []).slice(0, 3)
      .map(id => App.genreMap[id] || '')
      .filter(Boolean)
      .join(' · ');

    return `
      <div class="hero">
        <div class="hero-backdrop" style="background-image:url('${backdrop}')"></div>
        <div class="hero-gradient"></div>
        <div class="hero-content">
          <div class="hero-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Featured
          </div>
          <h1 class="hero-title">${movie.title}</h1>
          <div class="hero-meta">
            ${rating ? `<span class="rating">★ ${rating}</span><span class="dot"></span>` : ''}
            ${year ? `<span>${year}</span>` : ''}
            ${genres ? `<span class="dot"></span><span>${genres}</span>` : ''}
          </div>
          <p class="hero-overview">${movie.overview || ''}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-nav data-nav-default data-movie-id="${movie.id}" data-action="play" tabindex="0">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Play Now
            </button>
            <button class="btn btn-secondary" data-nav data-more-info="${movie.id}" data-type="movie" tabindex="0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              More Info
            </button>
          </div>
        </div>
        <div class="hero-dots" id="hero-dots"></div>
      </div>`;
  }

  function populateHeroDots(total, current) {
    const el = document.getElementById('hero-dots');
    if (!el) return;
    el.style.cssText = 'position:absolute;bottom:20px;right:40px;display:flex;gap:6px;';
    const accentDot = document.body.classList.contains('theme-calm') ? '#58a6ff' : '#7c3aed';
    el.innerHTML = Array.from({ length: total }, (_, i) =>
      `<div style="width:${i === current ? 24 : 8}px;height:8px;border-radius:4px;
        background:${i === current ? accentDot : 'rgba(255,255,255,0.3)'};
        transition:all 300ms ease;"></div>`
    ).join('');
  }

  function rotateHero() {
    _heroIdx = (_heroIdx + 1) % _heroMovies.length;
    const backdrop = document.querySelector('.hero-backdrop');
    if (backdrop && _heroMovies[_heroIdx]) {
      backdrop.style.backgroundImage = `url('${TMDB.backdrop(_heroMovies[_heroIdx].backdrop_path)}')`;
      populateHeroDots(_heroMovies.length, _heroIdx);
    }
  }

  // ── Fill rows with real data ────────────────────────────
  async function fillRow(rowId, movies) {
    const el = document.getElementById(`row-${rowId}`);
    if (!el) return;
    el.innerHTML = movies.map(m => movieCard(m)).join('');
    bindCardClicks(el);
    UX.fillProgressBars(el);
    Nav.reset(el.closest('.section'));
    UX.fetchInAppRatings(movies.map(function(m) { return String(m.id); }));
  }

  function bindCardClicks(container) {
    container.querySelectorAll('[data-movie-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.movieId;
        const action = el.dataset.action;
        if (action === 'play') {
          App.navigate('player', { id, type: 'movie' });
        } else if (action === 'info') {
          App.navigate('detail', { id, type: 'movie' });
        } else {
          App.navigate('player', { id, type: 'movie' });
        }
      });
    });
  }

  function bindHeroButtons(container) {
    // More Info
    const moreBtn = container && container.querySelector('[data-more-info]');
    if (moreBtn) {
      moreBtn.addEventListener('click', function() {
        App.navigate('detail', { id: moreBtn.dataset.moreInfo, type: moreBtn.dataset.type || 'movie' });
      });
    }
    // Icon-hint action buttons (web/mobile only — wired here so they know the current hero movie)
    const heroId    = container && container.querySelector('[data-movie-id]') ? container.querySelector('[data-movie-id]').dataset.movieId : null;
    const heroTitle = container && container.querySelector('.hero-title')      ? container.querySelector('.hero-title').textContent : '';

    const hibFav   = document.getElementById('hib-fav');
    const hibWL    = document.getElementById('hib-wl');

    if (hibFav && heroId && typeof NexPlayDB !== 'undefined') {
      var isFavNow = NexPlayDB.isFavourite(heroId, 'movie');
      var favIcon  = hibFav.querySelector('.hib-fav-icon');
      if (favIcon) favIcon.textContent = isFavNow ? '♥' : '♡';
      hibFav.classList.toggle('hib-active', isFavNow);
      hibFav.addEventListener('click', function() {
        var added = NexPlayDB.toggleFavourite(heroId, 'movie', heroTitle, '');
        if (favIcon) favIcon.textContent = added ? '♥' : '♡';
        hibFav.classList.toggle('hib-active', added);
        App.showToast(added ? '♥ Added to Favourites' : '♡ Removed from Favourites');
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      });
    }

    if (hibWL && heroId && typeof NexPlayDB !== 'undefined') {
      hibWL.classList.toggle('hib-active', NexPlayDB.isInWatchlist(heroId, 'movie'));
      hibWL.addEventListener('click', function() {
        var added = NexPlayDB.toggleWatchlist(heroId, 'movie', heroTitle, '');
        hibWL.classList.toggle('hib-active', added);
        App.showToast(added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      });
    }

  }

  function updateCardBadge(movieId) {
    const el = document.getElementById('badges-' + movieId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(movieId, 'movie');
  }

  function bindRemoteKeys() {
    _keyHandler = function(e) {
      if (typeof NexPlayDB === 'undefined') return;
      const focused = Nav.current() ||
        document.querySelector('[data-nav].nav-focused.card[data-movie-id]');
      if (!focused || !focused.classList.contains('card') || !focused.dataset.movieId) return;
      const movieId = focused.dataset.movieId;
      const title   = focused.dataset.movieTitle || '';
      const poster  = focused.dataset.moviePoster || '';
      const rating  = focused.dataset.movieRating || '0';
      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        const added = NexPlayDB.toggleFavourite(movieId, 'movie', title, poster, rating);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(movieId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        const added = NexPlayDB.toggleWatchlist(movieId, 'movie', title, poster, rating);
        App.showToast(added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        updateCardBadge(movieId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
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

  // ── Public API ──────────────────────────────────────────
  async function render(container) {
    container.innerHTML = `
      <div id="home-page">
        <div id="hero-wrapper">
          <div class="hero">
            <div class="hero-backdrop skeleton" style="height:100%"></div>
          </div>
        </div>

        <!-- TV: colour-key hints (remote buttons) -->
        <div class="home-key-hints">
          <span class="home-hint-item"><span class="home-color-btn home-color-green"></span><span class="home-hint-label">Change Theme</span></span>
          <span class="home-hint-item"><span class="home-color-btn home-color-red"></span><span class="home-hint-label">Add to Favourite</span></span>
          <span class="home-hint-item"><span class="home-color-btn home-color-blue"></span><span class="home-hint-label">Add to Watchlist</span></span>
          <span class="home-hint-item"><span class="home-color-btn home-color-yellow"></span><span class="home-hint-label">More Info</span></span>
        </div>
        <!-- Web/mobile: icon + label hints (same style as TV colour hints, but tappable) -->
        <div class="home-icon-hints" id="home-icon-hints">
          <span class="home-hint-item home-icon-hint" id="hib-info" style="cursor:default;">
            <svg class="home-icon-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span class="home-hint-label">More Info</span>
          </span>
          <span class="home-hint-item home-icon-hint" id="hib-fav">
            <span class="hib-fav-icon home-icon-glyph">♡</span>
            <span class="home-hint-label">Add to Favourite</span>
          </span>
          <span class="home-hint-item home-icon-hint" id="hib-wl">
            <svg class="home-icon-glyph" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span class="home-hint-label">Add to Watchlist</span>
          </span>
        </div>

        ${renderRow('trending', 'Trending', 'This Week')}
        ${renderRow('popular', 'Popular', 'Movies')}
        ${renderRow('top-rated', 'Top Rated')}
        ${renderRow('now-playing', 'Now Playing', 'In Theaters')}
      </div>`;

    Nav.reset(container);

    // Load all data in parallel
    try {
      const [trendingData, popularData, topRatedData, nowPlayingData] = await Promise.all([
        TMDB.trending('week'),
        TMDB.popular(),
        TMDB.topRated(),
        TMDB.nowPlaying(),
      ]);

      // Sort hero movies: those with trailers first (newer + higher vote count)
      const heroMovies = (trendingData.results || []).slice(0, 10);
      // Fetch details for first 5 to check for trailers (quick parallel fetch)
      const heroWithTrailers = heroMovies.slice().sort(function(a, b) {
        // Prefer movies that look like they'd have trailers (newer, higher vote count)
        var aScore = (a.vote_count || 0) + (a.release_date ? 1000 : 0);
        var bScore = (b.vote_count || 0) + (b.release_date ? 1000 : 0);
        return bScore - aScore;
      });
      _heroMovies = heroWithTrailers.filter(m => m.backdrop_path).slice(0, 8);
      _heroIdx = 0;

      if (_heroMovies.length) {
        const heroEl = document.getElementById('hero-wrapper');
        if (heroEl) {
          heroEl.innerHTML = renderHero(_heroMovies[0]);
          populateHeroDots(_heroMovies.length, 0);
          bindCardClicks(heroEl);
          bindHeroButtons(heroEl);
          clearInterval(_heroTimer);
          _heroTimer = setInterval(rotateHero, 7000);
        }
      }

      await fillRow('trending',    trendingData.results.slice(0, 12));
      await fillRow('popular',     popularData.results.slice(0, 12));
      await fillRow('top-rated',   topRatedData.results.slice(0, 12));
      await fillRow('now-playing', nowPlayingData.results.slice(0, 12));

      Nav.reset(container);
    } catch (err) {
      console.error('Home load error:', err);
    }

    bindRemoteKeys();
  }

  function onLeave() {
    clearInterval(_heroTimer);
    unbindRemoteKeys();
  }

  return { render, onLeave };
})();
