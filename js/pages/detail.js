const DetailPage = (() => {
  function render(container, params) {
    const id   = params.id;
    const type = params.type || 'movie';

    container.innerHTML = `
      <div id="detail-page" style="min-height:1080px;position:relative;">
        <div id="detail-backdrop" style="position:absolute;top:0;left:0;right:0;height:540px;background:#111;z-index:0;">
          <div id="detail-backdrop-img" style="width:100%;height:100%;background-size:cover;background-position:center top;"></div>
          <div class="detail-grad-overlay" style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,#09090f 100%);"></div>
        </div>
        <div style="position:relative;z-index:1;padding:320px 72px 60px;">
          <div id="detail-content" style="max-width:700px;">
            <div id="detail-genres" style="font-size:14px;color:#a78bfa;margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;"></div>
            <h1 id="detail-title" style="font-size:52px;font-weight:900;margin-bottom:16px;color:#f0f0f8;"></h1>
            <div id="detail-meta" style="font-size:18px;color:rgba(240,240,248,0.65);margin-bottom:24px;"></div>
            <p id="detail-overview" style="font-size:20px;line-height:1.7;color:rgba(240,240,248,0.80);margin-bottom:36px;max-width:620px;"></p>
            <div style="display:-webkit-flex;display:flex;gap:14px;flex-wrap:wrap;margin-bottom:48px;">
              <button class="btn btn-primary" id="detail-play" data-nav data-nav-default tabindex="0"
                style="padding:16px 40px;font-size:20px;">
                &#9654; Play
              </button>
              <button class="btn btn-secondary" id="detail-fav" data-nav tabindex="0"
                style="padding:16px 28px;font-size:20px;">
                &#9825; Favourite
              </button>
              <button class="btn btn-secondary" id="detail-wl" data-nav tabindex="0"
                style="padding:16px 28px;font-size:20px;">
                + Watchlist
              </button>
            </div>
            <div id="detail-cast" style="margin-bottom:40px;"></div>
          </div>
        </div>
      </div>`;

    Nav.reset(container);

    document.getElementById('detail-play').addEventListener('click', function() {
      App.navigate('player', { id: id, type: type, season: 1, episode: 1 });
    });

    // Fav / Watchlist buttons — update once data is available
    function refreshListBtns(title, poster) {
      const favBtn = document.getElementById('detail-fav');
      const wlBtn  = document.getElementById('detail-wl');
      if (!favBtn || !wlBtn || typeof NexPlayDB === 'undefined') return;

      const isFav = NexPlayDB.isFavourite(id, type);
      const isWL  = NexPlayDB.isInWatchlist(id, type);

      favBtn.innerHTML = isFav ? '&#9829; In Favourites' : '&#9825; Favourite';
      favBtn.style.color = isFav ? '#f87171' : '';
      wlBtn.innerHTML  = isWL  ? '&#10003; In Watchlist' : '+ Watchlist';
      wlBtn.style.color = isWL ? '#4ade80' : '';

      favBtn.onclick = function() {
        const added = NexPlayDB.toggleFavourite(id, type, title, poster);
        App.showToast(added ? 'Added to Favourites' : 'Removed from Favourites');
        refreshListBtns(title, poster);
      };
      wlBtn.onclick = function() {
        const added = NexPlayDB.toggleWatchlist(id, type, title, poster);
        App.showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist');
        refreshListBtns(title, poster);
      };
    }

    // Wire up placeholders immediately so buttons are focusable
    refreshListBtns('', '');

    // Load data
    const fetchFn = type === 'tv'
      ? TMDB.tvDetails(parseInt(id))
      : TMDB.details(parseInt(id));

    fetchFn.then(function(d) {
      const title   = d.title || d.name || '';
      const year    = (d.release_date || d.first_air_date || '').slice(0, 4);
      const rating  = d.vote_average ? ('★ ' + d.vote_average.toFixed(1)) : '';
      const runtime = d.runtime ? TMDB.formatRuntime(d.runtime) : (d.number_of_seasons ? d.number_of_seasons + ' seasons' : '');
      const genres  = (d.genres || []).slice(0, 4).map(function(g) { return g.name; }).join('  |  ');
      const backdrop = d.backdrop_path ? TMDB.backdrop(d.backdrop_path, Config.IMG.BACKDROP_FULL) : '';
      const poster   = d.poster_path   ? TMDB.img(d.poster_path, Config.IMG.POSTER_MD) : '';

      const titleEl    = document.getElementById('detail-title');
      const genresEl   = document.getElementById('detail-genres');
      const metaEl     = document.getElementById('detail-meta');
      const overviewEl = document.getElementById('detail-overview');
      const bdImg      = document.getElementById('detail-backdrop-img');

      if (titleEl)    titleEl.textContent    = title;
      if (genresEl)   genresEl.textContent   = genres;
      if (metaEl)     metaEl.textContent     = [year, runtime, rating].filter(Boolean).join('   |   ');
      if (overviewEl) overviewEl.textContent = d.overview || '';
      if (bdImg && backdrop) bdImg.style.backgroundImage = 'url(' + backdrop + ')';

      // Refresh list buttons with real title + poster
      refreshListBtns(title, poster);

      // Cast
      const credits = d.credits || d.aggregate_credits;
      if (credits && credits.cast && credits.cast.length) {
        const castEl = document.getElementById('detail-cast');
        if (castEl) {
          castEl.innerHTML = '<div style="font-size:16px;color:rgba(240,240,248,0.55);margin-bottom:16px;letter-spacing:1px;text-transform:uppercase;">Cast</div>'
            + '<div style="display:-webkit-flex;display:flex;flex-wrap:wrap;">'
            + credits.cast.slice(0, 8).map(function(p) {
                const img = p.profile_path ? TMDB.img(p.profile_path, Config.IMG.POSTER_SM) : '';
                return '<div style="margin-right:28px;margin-bottom:16px;text-align:center;width:80px;">'
                  + (img
                    ? '<img src="' + img + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.15);">'
                    : '<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;">?</div>')
                  + '<div style="margin-top:8px;font-size:14px;color:rgba(240,240,248,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;" title="' + p.name + '">' + p.name + '</div>'
                  + '</div>';
              }).join('')
            + '</div>';
        }
      }

      Nav.reset(container);
    }).catch(function() {});
  }

  return { render: render };
})();
