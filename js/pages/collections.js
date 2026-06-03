const CollectionsPage = (() => {
  // Curated list of well-known collection IDs to seed the page
  const SEED_COLLECTION_IDS = [
    10, 119, 131292, 86311, 528,    // Star Wars, LotR, Avengers, Toy Story, Spider-Man
    9485, 295130, 645, 87359,        // Fast & Furious, Jurassic World, James Bond, Mission Impossible
    263,  1241, 748, 304378,         // Dark Knight, Harry Potter, Indiana Jones, IT
    556, 87096, 9767, 284433,        // Pirates, X-Men, Alien, Thor
    131295, 1570, 8945, 121938,      // Hunger Games, John Wick, Terminator, Shrek
  ];

  let _collectionDetail = null; // when browsing a specific collection

  // ── Collection card ────────────────────────────────────
  function collectionCard(col) {
    const backdrop = col.backdrop_path
      ? TMDB.img(col.backdrop_path, Config.IMG.BACKDROP_MD)
      : (col.poster_path ? TMDB.img(col.poster_path, Config.IMG.POSTER_LG) : '');
    const count = col.parts ? col.parts.length : '';
    return `
      <div class="collection-card" data-nav data-collection-id="${col.id}" tabindex="0">
        ${backdrop
          ? `<img class="collection-backdrop" src="${backdrop}" alt="${col.name}" loading="lazy">`
          : `<div class="collection-backdrop skeleton"></div>`}
        <div class="collection-info">
          <div class="collection-name">${col.name || ''}</div>
          ${count ? `<div class="collection-count">${count} ${count === 1 ? 'film' : 'films'}</div>` : ''}
        </div>
      </div>`;
  }

  // ── Movie card inside a collection ─────────────────────
  function movieCard(movie, index) {
    const poster = movie.poster_path ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD) : '';
    const year = (movie.release_date || '').slice(0, 4);
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return `
      <div class="card" data-nav data-movie-id="${movie.id}" tabindex="0">
        <div class="card-poster">
          ${poster
            ? `<img src="${poster}" alt="${movie.title}" loading="lazy">`
            : `<div class="no-img">🎬</div>`}
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
          <div style="position:absolute;top:10px;left:10px;background:#7c3aed;
            color:#fff;font-size:11px;font-weight:800;padding:4px 8px;border-radius:6px;">
            #${index + 1}
          </div>
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="card-info">
          <div class="card-title">${movie.title || ''}</div>
          <div class="card-year">${year}</div>
        </div>
      </div>`;
  }

  // ── Render collection detail (all movies in a franchise) ─
  async function renderDetail(container, collectionId) {
    container.innerHTML = `
      <div id="collection-detail">
        <div class="page-header" style="display:flex;align-items:center;gap:16px;">
          <button class="btn btn-secondary" id="col-back" data-nav data-nav-default tabindex="0" style="padding:10px 18px;">
            ← Back
          </button>
          <div>
            <h1 class="page-title" id="col-title">Loading...</h1>
            <p class="page-subtitle" id="col-subtitle"></p>
          </div>
        </div>
        <div id="col-hero" style="position:relative;height:300px;overflow:hidden;background:#0f0f1c;">
          <div class="skeleton" style="width:100%;height:100%;"></div>
        </div>
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Films in this Collection</h2>
          </div>
          <div class="card-row" data-scroll id="col-movies">
            ${Array.from({length:6}, () =>
              `<div class="card"><div class="card-poster skeleton"></div></div>`).join('')}
          </div>
        </section>
      </div>`;

    document.getElementById('col-back').addEventListener('click', () => {
      render(container);
    });

    Nav.reset(container);

    try {
      const col = await TMDB.collection(collectionId);
      document.getElementById('col-title').textContent = col.name;
      document.getElementById('col-subtitle').textContent =
        `${col.parts.length} films · ${col.overview ? col.overview.slice(0, 120) + '...' : ''}`;

      const hero = document.getElementById('col-hero');
      if (col.backdrop_path) {
        hero.innerHTML = `
          <img src="${TMDB.backdrop(col.backdrop_path)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(9,9,15,1) 0%,transparent 60%);"></div>`;
      }

      const sorted = [...col.parts].sort((a, b) =>
        (a.release_date || '').localeCompare(b.release_date || '')
      );

      const moviesRow = document.getElementById('col-movies');
      moviesRow.innerHTML = sorted.map((m, i) => movieCard(m, i)).join('');
      moviesRow.querySelectorAll('[data-movie-id]').forEach(el => {
        el.addEventListener('click', () => {
          App.navigate('player', { id: el.dataset.movieId, type: 'movie' });
        });
      });

      Nav.reset(container);
    } catch (err) {
      console.error('Collection detail error:', err);
    }
  }

  // ── Main page (grid of collections) ────────────────────
  async function render(container) {
    container.innerHTML = `
      <div id="collections-page">
        <div class="page-header">
          <h1 class="page-title">Collections &amp; Sequels</h1>
          <p class="page-subtitle">Browse movie franchises and film series</p>
        </div>

        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Popular <span>Franchises</span></h2>
          </div>
          <div class="card-row" data-scroll id="col-seeded">
            ${Array.from({length:8}, () =>
              `<div class="collection-card"><div class="collection-backdrop skeleton"></div>
               <div class="collection-info"><div class="skeleton" style="height:14px;width:70%;border-radius:4px;"></div></div>
              </div>`).join('')}
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Discovered from <span>Popular Movies</span></h2>
          </div>
          <div class="card-row" data-scroll id="col-discovered">
            ${Array.from({length:8}, () =>
              `<div class="collection-card"><div class="collection-backdrop skeleton"></div>
               <div class="collection-info"><div class="skeleton" style="height:14px;width:70%;border-radius:4px;"></div></div>
              </div>`).join('')}
          </div>
        </section>
      </div>`;

    Nav.reset(container);

    function bindCollectionClicks(el) {
      el.addEventListener('click', () => {
        const id = el.dataset.collectionId;
        if (id) renderDetail(container, parseInt(id));
      });
    }

    // Load seeded collections
    try {
      const seeded = await Promise.all(
        SEED_COLLECTION_IDS.slice(0, 12).map(id =>
          TMDB.collection(id).catch(() => null)
        )
      );
      const valid = seeded.filter(Boolean);
      const row = document.getElementById('col-seeded');
      if (row) {
        row.innerHTML = valid.map(collectionCard).join('');
        row.querySelectorAll('[data-collection-id]').forEach(bindCollectionClicks);
      }
    } catch (err) {
      console.error('Seeded collections error:', err);
    }

    // Discover collections from popular movies
    try {
      const discovered = await TMDB.popularCollections(2);
      const row = document.getElementById('col-discovered');
      if (row) {
        const enriched = await Promise.all(
          discovered.slice(0, 10).map(c =>
            TMDB.collection(c.id).catch(() => ({ ...c, parts: [] }))
          )
        );
        row.innerHTML = enriched.map(collectionCard).join('');
        row.querySelectorAll('[data-collection-id]').forEach(bindCollectionClicks);
      }
    } catch (err) {
      console.error('Discovered collections error:', err);
    }

    Nav.reset(container);
  }

  function onLeave() {}

  return { render, onLeave };
})();

