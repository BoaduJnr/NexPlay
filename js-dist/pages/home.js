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
      container.innerHTML = "\n      <div id=\"home-page\">\n        <div id=\"hero-wrapper\">\n          <div class=\"hero\">\n            <div class=\"hero-backdrop skeleton\" style=\"height:100%\"></div>\n          </div>\n        </div>\n        ".concat(renderRow('trending', 'Trending', 'This Week'), "\n        ").concat(renderRow('popular', 'Popular', 'Movies'), "\n        ").concat(renderRow('top-rated', 'Top Rated'), "\n        ").concat(renderRow('now-playing', 'Now Playing', 'In Theaters'), "\n      </div>");
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
      fillProgressBars(el);
      Nav.reset(el.closest('.section'));
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
    var year = (movie.release_date || '').slice(0, 4);
    var rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    var isFav = typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(movie.id, 'movie');
    var isWL = typeof NexPlayDB !== 'undefined' && NexPlayDB.isInWatchlist(movie.id, 'movie');
    return "\n      <div class=\"card ".concat(extraClass, "\" data-nav data-movie-id=\"").concat(movie.id, "\"\n           data-movie-title=\"").concat((movie.title || '').replace(/"/g, '&quot;'), "\"\n           data-movie-poster=\"").concat(poster, "\"\n           tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(movie.title, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83C\uDFAC</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div class=\"card-badges\" id=\"badges-").concat(movie.id, "\">\n            ").concat(isFav ? '<span class="card-badge card-badge-fav">&#9829;</span>' : '', "\n            ").concat(isWL ? '<span class="card-badge card-badge-wl">&#128278;</span>' : '', "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\">\n              <path d=\"M8 5v14l11-7z\"/>\n            </svg>\n          </div>\n          <div class=\"card-prog\" id=\"cprog-").concat(movie.id, "\"></div>\n        </div>\n        <div class=\"card-info\">\n          <div class=\"card-title\">").concat(movie.title || '', "</div>\n          <div class=\"card-year\">").concat(year, "</div>\n        </div>\n      </div>");
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
    el.innerHTML = Array.from({
      length: total
    }, function (_, i) {
      return "<div style=\"width:".concat(i === current ? 24 : 8, "px;height:8px;border-radius:4px;\n        background:").concat(i === current ? '#7c3aed' : 'rgba(255,255,255,0.3)', ";\n        transition:all 300ms ease;\"></div>");
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
    var moreBtn = container && container.querySelector('[data-more-info]');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        App.navigate('detail', {
          id: moreBtn.dataset.moreInfo,
          type: moreBtn.dataset.type || 'movie'
        });
      });
    }
  }
  function fillProgressBars(container) {
    if (typeof NexPlayDB === 'undefined') return;
    (container || document).querySelectorAll('[id^="cprog-"]').forEach(function (el) {
      var id = el.id.replace('cprog-', '');
      var saved = NexPlayDB.getProgress(id, 'movie') || NexPlayDB.getProgress(id, 'tv');
      if (saved && saved.position > 5000 && saved.duration > 0) {
        var pct = Math.min(98, saved.position / saved.duration * 100).toFixed(0);
        el.innerHTML = '<div style="width:' + pct + '%;height:100%;background:#7c3aed;border-radius:0 2px 0 0;"></div>';
      }
    });
  }
  function updateCardBadge(movieId) {
    var el = document.getElementById('badges-' + movieId);
    if (!el || typeof NexPlayDB === 'undefined') return;
    var isFav = NexPlayDB.isFavourite(movieId, 'movie');
    var isWL = NexPlayDB.isInWatchlist(movieId, 'movie');
    el.innerHTML = (isFav ? '<span class="card-badge card-badge-fav">&#9829;</span>' : '') + (isWL ? '<span class="card-badge card-badge-wl">&#128278;</span>' : '');
  }
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      if (typeof NexPlayDB === 'undefined') return;
      var focused = Nav.current();
      if (!focused || !focused.classList.contains('card') || !focused.dataset.movieId) return;
      var movieId = focused.dataset.movieId;
      var title = focused.dataset.movieTitle || '';
      var poster = focused.dataset.moviePoster || '';
      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        var added = NexPlayDB.toggleFavourite(movieId, 'movie', title, poster);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(movieId);
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        var _added = NexPlayDB.toggleWatchlist(movieId, 'movie', title, poster);
        App.showToast(_added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        updateCardBadge(movieId);
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