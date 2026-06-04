"use strict";

var DetailPage = function () {
  function render(container, params) {
    var id = params.id;
    var type = params.type || 'movie';
    container.innerHTML = "\n      <div id=\"detail-page\" style=\"min-height:1080px;position:relative;\">\n        <div id=\"detail-backdrop\" style=\"position:absolute;top:0;left:0;right:0;height:540px;background:#111;z-index:0;\">\n          <div id=\"detail-backdrop-img\" style=\"width:100%;height:100%;background-size:cover;background-position:center top;\"></div>\n          <div style=\"position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,#09090f 100%);\"></div>\n        </div>\n        <div style=\"position:relative;z-index:1;padding:320px 72px 60px;\">\n          <div id=\"detail-content\" style=\"max-width:700px;\">\n            <div id=\"detail-genres\" style=\"font-size:14px;color:#a78bfa;margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;\"></div>\n            <h1 id=\"detail-title\" style=\"font-size:52px;font-weight:900;margin-bottom:16px;color:#f0f0f8;\"></h1>\n            <div id=\"detail-meta\" style=\"font-size:18px;color:rgba(240,240,248,0.65);margin-bottom:24px;\"></div>\n            <p id=\"detail-overview\" style=\"font-size:20px;line-height:1.7;color:rgba(240,240,248,0.80);margin-bottom:36px;max-width:620px;\"></p>\n            <div style=\"display:-webkit-flex;display:flex;gap:14px;flex-wrap:wrap;margin-bottom:48px;\">\n              <button class=\"btn btn-primary\" id=\"detail-play\" data-nav data-nav-default tabindex=\"0\"\n                style=\"padding:16px 40px;font-size:20px;\">\n                &#9654; Play\n              </button>\n              <button class=\"btn btn-secondary\" id=\"detail-fav\" data-nav tabindex=\"0\"\n                style=\"padding:16px 28px;font-size:20px;\">\n                &#9825; Favourite\n              </button>\n              <button class=\"btn btn-secondary\" id=\"detail-wl\" data-nav tabindex=\"0\"\n                style=\"padding:16px 28px;font-size:20px;\">\n                + Watchlist\n              </button>\n            </div>\n            <div id=\"detail-cast\" style=\"margin-bottom:40px;\"></div>\n          </div>\n        </div>\n      </div>";
    Nav.reset(container);
    document.getElementById('detail-play').addEventListener('click', function () {
      App.navigate('player', {
        id: id,
        type: type,
        season: 1,
        episode: 1
      });
    });

    // Fav / Watchlist buttons — update once data is available
    function refreshListBtns(title, poster) {
      var favBtn = document.getElementById('detail-fav');
      var wlBtn = document.getElementById('detail-wl');
      if (!favBtn || !wlBtn || typeof NexPlayDB === 'undefined') return;
      var isFav = NexPlayDB.isFavourite(id, type);
      var isWL = NexPlayDB.isInWatchlist(id, type);
      favBtn.innerHTML = isFav ? '&#9829; Favourited' : '&#9825; Favourite';
      favBtn.style.color = isFav ? '#f87171' : '';
      wlBtn.innerHTML = isWL ? '&#10003; In Watchlist' : '+ Watchlist';
      wlBtn.style.color = isWL ? '#4ade80' : '';
      favBtn.onclick = function () {
        var added = NexPlayDB.toggleFavourite(id, type, title, poster);
        App.showToast(added ? 'Added to Favourites' : 'Removed from Favourites');
        refreshListBtns(title, poster);
      };
      wlBtn.onclick = function () {
        var added = NexPlayDB.toggleWatchlist(id, type, title, poster);
        App.showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist');
        refreshListBtns(title, poster);
      };
    }

    // Wire up placeholders immediately so buttons are focusable
    refreshListBtns('', '');

    // Load data
    var fetchFn = type === 'tv' ? TMDB.tvDetails(parseInt(id)) : TMDB.details(parseInt(id));
    fetchFn.then(function (d) {
      var title = d.title || d.name || '';
      var year = (d.release_date || d.first_air_date || '').slice(0, 4);
      var rating = d.vote_average ? '★ ' + d.vote_average.toFixed(1) : '';
      var runtime = d.runtime ? TMDB.formatRuntime(d.runtime) : d.number_of_seasons ? d.number_of_seasons + ' seasons' : '';
      var genres = (d.genres || []).slice(0, 4).map(function (g) {
        return g.name;
      }).join('  |  ');
      var backdrop = d.backdrop_path ? TMDB.backdrop(d.backdrop_path, Config.IMG.BACKDROP_FULL) : '';
      var poster = d.poster_path ? TMDB.img(d.poster_path, Config.IMG.POSTER_MD) : '';
      var titleEl = document.getElementById('detail-title');
      var genresEl = document.getElementById('detail-genres');
      var metaEl = document.getElementById('detail-meta');
      var overviewEl = document.getElementById('detail-overview');
      var bdImg = document.getElementById('detail-backdrop-img');
      if (titleEl) titleEl.textContent = title;
      if (genresEl) genresEl.textContent = genres;
      if (metaEl) metaEl.textContent = [year, runtime, rating].filter(Boolean).join('   |   ');
      if (overviewEl) overviewEl.textContent = d.overview || '';
      if (bdImg && backdrop) bdImg.style.backgroundImage = 'url(' + backdrop + ')';

      // Refresh list buttons with real title + poster
      refreshListBtns(title, poster);

      // Cast
      var credits = d.credits || d.aggregate_credits;
      if (credits && credits.cast && credits.cast.length) {
        var castEl = document.getElementById('detail-cast');
        if (castEl) {
          castEl.innerHTML = '<div style="font-size:16px;color:rgba(240,240,248,0.55);margin-bottom:16px;letter-spacing:1px;text-transform:uppercase;">Cast</div>' + '<div style="display:-webkit-flex;display:flex;flex-wrap:wrap;">' + credits.cast.slice(0, 8).map(function (p) {
            var img = p.profile_path ? TMDB.img(p.profile_path, Config.IMG.POSTER_SM) : '';
            return '<div style="margin-right:28px;margin-bottom:16px;text-align:center;width:80px;">' + (img ? '<img src="' + img + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.15);">' : '<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;">?</div>') + '<div style="margin-top:8px;font-size:14px;color:rgba(240,240,248,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;" title="' + p.name + '">' + p.name + '</div>' + '</div>';
          }).join('') + '</div>';
        }
      }
      Nav.reset(container);
    }).catch(function () {});
  }
  return {
    render: render
  };
}();