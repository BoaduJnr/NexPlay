const HomePage = (() => {
  let _heroMovies = [];
  let _heroIdx = 0;
  let _heroTimer = null;

  // ── Helpers ────────────────────────────────────────────
  function movieCard(movie, extraClass = '') {
    const poster = movie.poster_path
      ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD)
      : '';
    const year = (movie.release_date || '').slice(0, 4);
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return `
      <div class="card ${extraClass}" data-nav data-movie-id="${movie.id}" tabindex="0">
        <div class="card-poster">
          ${poster
            ? `<img src="${poster}" alt="${movie.title}" loading="lazy">`
            : `<div class="no-img">🎬</div>`}
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <div class="card-prog" id="cprog-${movie.id}"></div>
        </div>
        <div class="card-info">
          <div class="card-title">${movie.title || ''}</div>
          <div class="card-year">${year}</div>
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
    el.innerHTML = Array.from({ length: total }, (_, i) =>
      `<div style="width:${i === current ? 24 : 8}px;height:8px;border-radius:4px;
        background:${i === current ? '#7c3aed' : 'rgba(255,255,255,0.3)'};
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
    fillProgressBars(el);
    Nav.reset(el.closest('.section'));
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
    const moreBtn = container && container.querySelector('[data-more-info]');
    if (moreBtn) {
      moreBtn.addEventListener('click', function() {
        App.navigate('detail', { id: moreBtn.dataset.moreInfo, type: moreBtn.dataset.type || 'movie' });
      });
    }
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

  // ── Public API ──────────────────────────────────────────
  async function render(container) {
    container.innerHTML = `
      <div id="home-page">
        <div id="hero-wrapper">
          <div class="hero">
            <div class="hero-backdrop skeleton" style="height:100%"></div>
          </div>
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

      await fillRow('trending', trendingData.results.slice(0, 12));
      await fillRow('popular', popularData.results.slice(0, 12));
      await fillRow('top-rated', topRatedData.results.slice(0, 12));
      await fillRow('now-playing', nowPlayingData.results.slice(0, 12));

      Nav.reset(container);
    } catch (err) {
      console.error('Home load error:', err);
    }
  }

  function onLeave() {
    clearInterval(_heroTimer);
  }

  return { render, onLeave };
})();
