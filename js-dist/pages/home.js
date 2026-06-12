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
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var HomePage = function () {
  // ── Public API ──────────────────────────────────────────
  var render = function render(container) {
    try {
      function _temp2() {
        bindRemoteKeys();
      }
      container.innerHTML = "\n      <div id=\"home-page\">\n        <div id=\"hero-wrapper\">\n          <div class=\"hero\">\n            <div class=\"hero-backdrop skeleton\" style=\"height:100%\"></div>\n          </div>\n        </div>\n\n        <!-- TV: colour-key hints (remote buttons) -->\n        <div class=\"home-key-hints\">\n          <span class=\"home-hint-item\"><span class=\"home-color-btn home-color-green\"></span><span class=\"home-hint-label\">Change Theme</span></span>\n          <span class=\"home-hint-item\"><span class=\"home-color-btn home-color-red\"></span><span class=\"home-hint-label\">Add to Favourite</span></span>\n          <span class=\"home-hint-item\"><span class=\"home-color-btn home-color-blue\"></span><span class=\"home-hint-label\">Add to Watchlist</span></span>\n          <span class=\"home-hint-item\"><span class=\"home-color-btn home-color-yellow\"></span><span class=\"home-hint-label\">More Info</span></span>\n        </div>\n        <!-- Web/mobile: icon + label hints (same style as TV colour hints, but tappable) -->\n        <div class=\"home-icon-hints\" id=\"home-icon-hints\">\n          <span class=\"home-hint-item home-icon-hint\" id=\"hib-info\" style=\"cursor:default;\">\n            <svg class=\"home-icon-glyph\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"14\" height=\"14\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg>\n            <span class=\"home-hint-label\">More Info</span>\n          </span>\n          <span class=\"home-hint-item home-icon-hint\" id=\"hib-fav\">\n            <span class=\"hib-fav-icon home-icon-glyph\">\u2661</span>\n            <span class=\"home-hint-label\">Add to Favourite</span>\n          </span>\n          <span class=\"home-hint-item home-icon-hint\" id=\"hib-wl\">\n            <svg class=\"home-icon-glyph\" viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"14\" height=\"14\"><path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/></svg>\n            <span class=\"home-hint-label\">Add to Watchlist</span>\n          </span>\n        </div>\n\n        ".concat(renderRow('trending', 'Trending', 'This Week'), "\n        ").concat(renderRow('popular', 'Popular', 'Movies'), "\n        ").concat(renderRow('top-rated', 'Top Rated'), "\n        ").concat(renderRow('now-playing', 'Now Playing', 'In Theaters'), "\n      </div>");
      Nav.reset(container);

      // Load all data in parallel
      var _temp = _catch(function () {
        return Promise.resolve(Promise.all([TMDB.trending('week'), TMDB.popular(), TMDB.topRated(), TMDB.nowPlaying()])).then(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 4),
            trendingData = _ref2[0],
            popularData = _ref2[1],
            topRatedData = _ref2[2],
            nowPlayingData = _ref2[3];
          // Sort hero movies: those with trailers first (newer + higher vote count)
          var heroMovies = (trendingData.results || []).slice(0, 10);
          // Fetch details for first 5 to check for trailers (quick parallel fetch)
          var heroWithTrailers = heroMovies.slice().sort(function (a, b) {
            // Prefer movies that look like they'd have trailers (newer, higher vote count)
            var aScore = (a.vote_count || 0) + (a.release_date ? 1000 : 0);
            var bScore = (b.vote_count || 0) + (b.release_date ? 1000 : 0);
            return bScore - aScore;
          });
          _heroMovies = heroWithTrailers.filter(function (m) {
            return m.backdrop_path;
          }).slice(0, 8);
          _heroIdx = 0;
          if (_heroMovies.length) {
            var heroEl = document.getElementById('hero-wrapper');
            if (heroEl) {
              heroEl.innerHTML = renderHero(_heroMovies[0]);
              populateHeroDots(_heroMovies.length, 0);
              bindCardClicks(heroEl);
              bindHeroButtons(heroEl);
              clearInterval(_heroTimer);
              _heroTimer = setInterval(rotateHero, 7000);
            }
          }
          return Promise.resolve(fillRow('trending', trendingData.results.slice(0, 12))).then(function () {
            return Promise.resolve(fillRow('popular', popularData.results.slice(0, 12))).then(function () {
              return Promise.resolve(fillRow('top-rated', topRatedData.results.slice(0, 12))).then(function () {
                return Promise.resolve(fillRow('now-playing', nowPlayingData.results.slice(0, 12))).then(function () {
                  Nav.reset(container);
                });
              });
            });
          });
        });
      }, function (err) {
        console.error('Home load error:', err);
      });
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Fill rows with real data ────────────────────────────
  var fillRow = function fillRow(rowId, movies) {
    try {
      var el = document.getElementById("row-".concat(rowId));
      if (!el) return Promise.resolve();
      el.innerHTML = movies.map(function (m) {
        return movieCard(m);
      }).join('');
      bindCardClicks(el);
      UX.fillProgressBars(el);
      Nav.reset(el.closest('.section'));
      UX.fetchInAppRatings(movies.map(function (m) {
        return String(m.id);
      }));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var _heroMovies = [];
  var _heroIdx = 0;
  var _heroTimer = null;
  var _keyHandler = null;

  // ── Helpers ────────────────────────────────────────────
  function movieCard(movie) {
    var extraClass = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    var poster = movie.poster_path ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD) : '';
    var rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return "\n      <div class=\"card ".concat(extraClass, "\" data-nav data-movie-id=\"").concat(movie.id, "\"\n           data-movie-title=\"").concat((movie.title || '').replace(/"/g, '&quot;'), "\"\n           data-movie-poster=\"").concat(poster, "\"\n           tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(movie.title, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83C\uDFAC</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div class=\"card-badges\" id=\"badges-").concat(movie.id, "\">\n            ").concat(UX.badgesHTML(movie.id, 'movie'), "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\">\n              <path d=\"M8 5v14l11-7z\"/>\n            </svg>\n          </div>\n          <div class=\"card-mobile-actions\">\n            <button class=\"card-action-btn\" data-action=\"info\" title=\"More Info\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"12\" height=\"12\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg></button>\n            <button class=\"card-action-btn").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(movie.id, 'movie') ? ' fav-active' : '', "\" data-action=\"fav\" title=\"Favourite\">").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(movie.id, 'movie') ? '♥' : '♡', "</button>\n            <button class=\"card-action-btn").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isInWatchlist(movie.id, 'movie') ? ' wl-active' : '', "\" data-action=\"wl\" title=\"Watchlist\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"11\" height=\"11\"><path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/></svg></button>\n          </div>\n          <div class=\"card-ia-rating card-ia-na\" id=\"ia-").concat(movie.id, "\" title=\"No NexPlay ratings yet\">N/A</div>\n          <div class=\"card-prog\" id=\"cprog-").concat(movie.id, "\" data-type=\"movie\"></div>\n        </div>\n      </div>");
  }
  function skeletonRow() {
    var count = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 6;
    return Array.from({
      length: count
    }, function () {
      return "<div class=\"card\">\n        <div class=\"card-poster skeleton\"></div>\n        <div class=\"card-info\">\n          <div class=\"skeleton\" style=\"height:14px;width:80%;margin-bottom:6px;border-radius:4px;\"></div>\n          <div class=\"skeleton\" style=\"height:12px;width:40%;border-radius:4px;\"></div>\n        </div>\n      </div>";
    }).join('');
  }
  function renderRow(id, title) {
    var subtitle = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
    return "\n      <section class=\"section\">\n        <div class=\"section-header\">\n          <h2 class=\"section-title\">".concat(title, " ").concat(subtitle ? "<span>".concat(subtitle, "</span>") : '', "</h2>\n        </div>\n        <div class=\"card-row\" data-scroll id=\"row-").concat(id, "\">\n          ").concat(skeletonRow(), "\n        </div>\n      </section>");
  }

  // ── Hero ────────────────────────────────────────────────
  function renderHero(movie) {
    if (!movie) return '';
    var backdrop = TMDB.backdrop(movie.backdrop_path);
    var year = (movie.release_date || '').slice(0, 4);
    var rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    var genres = (movie.genre_ids || []).slice(0, 3).map(function (id) {
      return App.genreMap[id] || '';
    }).filter(Boolean).join(' · ');
    return "\n      <div class=\"hero\">\n        <div class=\"hero-backdrop\" style=\"background-image:url('".concat(backdrop, "')\"></div>\n        <div class=\"hero-gradient\"></div>\n        <div class=\"hero-content\">\n          <div class=\"hero-badge\">\n            <svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n              <path d=\"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z\"/>\n            </svg>\n            Featured\n          </div>\n          <h1 class=\"hero-title\">").concat(movie.title, "</h1>\n          <div class=\"hero-meta\">\n            ").concat(rating ? "<span class=\"rating\">\u2605 ".concat(rating, "</span><span class=\"dot\"></span>") : '', "\n            ").concat(year ? "<span>".concat(year, "</span>") : '', "\n            ").concat(genres ? "<span class=\"dot\"></span><span>".concat(genres, "</span>") : '', "\n          </div>\n          <p class=\"hero-overview\">").concat(movie.overview || '', "</p>\n          <div class=\"hero-actions\">\n            <button class=\"btn btn-primary\" data-nav data-nav-default data-movie-id=\"").concat(movie.id, "\" data-action=\"play\" tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M8 5v14l11-7z\"/></svg>\n              Play Now\n            </button>\n            <button class=\"btn btn-secondary\" data-nav data-more-info=\"").concat(movie.id, "\" data-type=\"movie\" tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n                <circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/>\n                <line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/>\n              </svg>\n              More Info\n            </button>\n          </div>\n        </div>\n        <div class=\"hero-dots\" id=\"hero-dots\"></div>\n      </div>");
  }
  function populateHeroDots(total, current) {
    var el = document.getElementById('hero-dots');
    if (!el) return;
    el.style.cssText = 'position:absolute;bottom:20px;right:40px;display:flex;gap:6px;';
    var accentDot = document.body.classList.contains('theme-calm') ? '#58a6ff' : '#7c3aed';
    el.innerHTML = Array.from({
      length: total
    }, function (_, i) {
      return "<div style=\"width:".concat(i === current ? 24 : 8, "px;height:8px;border-radius:4px;\n        background:").concat(i === current ? accentDot : 'rgba(255,255,255,0.3)', ";\n        transition:all 300ms ease;\"></div>");
    }).join('');
  }
  function rotateHero() {
    _heroIdx = (_heroIdx + 1) % _heroMovies.length;
    var backdrop = document.querySelector('.hero-backdrop');
    if (backdrop && _heroMovies[_heroIdx]) {
      backdrop.style.backgroundImage = "url('".concat(TMDB.backdrop(_heroMovies[_heroIdx].backdrop_path), "')");
      populateHeroDots(_heroMovies.length, _heroIdx);
    }
  }
  function bindCardClicks(container) {
    container.querySelectorAll('[data-movie-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.movieId;
        var action = el.dataset.action;
        if (action === 'play') {
          App.navigate('player', {
            id: id,
            type: 'movie'
          });
        } else if (action === 'info') {
          App.navigate('detail', {
            id: id,
            type: 'movie'
          });
        } else {
          App.navigate('player', {
            id: id,
            type: 'movie'
          });
        }
      });
    });
  }
  function bindHeroButtons(container) {
    // More Info
    var moreBtn = container && container.querySelector('[data-more-info]');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        App.navigate('detail', {
          id: moreBtn.dataset.moreInfo,
          type: moreBtn.dataset.type || 'movie'
        });
      });
    }
    // Icon-hint action buttons (web/mobile only — wired here so they know the current hero movie)
    var heroId = container && container.querySelector('[data-movie-id]') ? container.querySelector('[data-movie-id]').dataset.movieId : null;
    var heroTitle = container && container.querySelector('.hero-title') ? container.querySelector('.hero-title').textContent : '';
    var hibFav = document.getElementById('hib-fav');
    var hibWL = document.getElementById('hib-wl');
    if (hibFav && heroId && typeof NexPlayDB !== 'undefined') {
      var isFavNow = NexPlayDB.isFavourite(heroId, 'movie');
      var favIcon = hibFav.querySelector('.hib-fav-icon');
      if (favIcon) favIcon.textContent = isFavNow ? '♥' : '♡';
      hibFav.classList.toggle('hib-active', isFavNow);
      hibFav.addEventListener('click', function () {
        var added = NexPlayDB.toggleFavourite(heroId, 'movie', heroTitle, '');
        if (favIcon) favIcon.textContent = added ? '♥' : '♡';
        hibFav.classList.toggle('hib-active', added);
        App.showToast(added ? '♥ Added to Favourites' : '♡ Removed from Favourites');
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      });
    }
    if (hibWL && heroId && typeof NexPlayDB !== 'undefined') {
      hibWL.classList.toggle('hib-active', NexPlayDB.isInWatchlist(heroId, 'movie'));
      hibWL.addEventListener('click', function () {
        var added = NexPlayDB.toggleWatchlist(heroId, 'movie', heroTitle, '');
        hibWL.classList.toggle('hib-active', added);
        App.showToast(added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      });
    }
  }
  function updateCardBadge(movieId) {
    var el = document.getElementById('badges-' + movieId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(movieId, 'movie');
  }
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      if (typeof NexPlayDB === 'undefined') return;
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused.card[data-movie-id]');
      if (!focused || !focused.classList.contains('card') || !focused.dataset.movieId) return;
      var movieId = focused.dataset.movieId;
      var title = focused.dataset.movieTitle || '';
      var poster = focused.dataset.moviePoster || '';
      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        var added = NexPlayDB.toggleFavourite(movieId, 'movie', title, poster);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(movieId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        var _added = NexPlayDB.toggleWatchlist(movieId, 'movie', title, poster);
        App.showToast(_added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        updateCardBadge(movieId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      } else if (e.keyCode === Config.KEYS.YELLOW) {
        e.preventDefault();
        App.navigate('detail', {
          id: movieId,
          type: 'movie'
        });
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }
  function unbindRemoteKeys() {
    if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
  function onLeave() {
    clearInterval(_heroTimer);
    unbindRemoteKeys();
  }
  return {
    render: render,
    onLeave: onLeave
  };
}();