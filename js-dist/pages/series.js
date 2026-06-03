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
var SeriesPage = function () {
  var render = function render(container) {
    try {
      function _temp5() {
        // Tabs
        var seriesTabs = document.getElementById('series-tabs');
        if (seriesTabs) seriesTabs.querySelectorAll('[data-tab]').forEach(function (el) {
          el.addEventListener('click', function () {
            _activeTab = el.dataset.tab;
            _activeGenre = null;
            document.querySelectorAll('#series-tabs [data-tab]').forEach(function (t) {
              return t.classList.remove('active');
            });
            document.querySelectorAll('#series-genres [data-genre-id]').forEach(function (t) {
              return t.classList.remove('active');
            });
            var defaultGenre = document.querySelector('#series-genres [data-genre-id=""]');
            if (defaultGenre) defaultGenre.classList.add('active');
            el.classList.add('active');
            loadShows(true);
          });
        });
        TVDropdown.mount('series-sort', function (v) {
          _activeSort = v;
          loadShows(true);
        });
        var seriesSearchInput = document.getElementById('series-search-input');
        var _searchTimer = null;
        if (seriesSearchInput) {
          seriesSearchInput.addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(function () {
              _activeSearch = seriesSearchInput.value.trim();
              _page = 1;
              loadShows(true);
            }, 500);
          });
          seriesSearchInput.addEventListener('keydown', function (e) {
            if (e.keyCode === 13) {
              e.stopPropagation();
              clearTimeout(_searchTimer);
              _activeSearch = seriesSearchInput.value.trim();
              _page = 1;
              loadShows(true);
            }
          });
        }
        return Promise.resolve(loadShows(true)).then(function () {});
      }
      container.innerHTML = "\n      <div id=\"series-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">TV Series</h1>\n          <p class=\"page-subtitle\">Discover popular shows, trending series, and more</p>\n        </div>\n\n        <div style=\"padding:20px 72px 8px;display:-webkit-flex;display:flex;align-items:center;\">\n          <input type=\"text\" id=\"series-search-input\" placeholder=\"Search series...\" data-nav tabindex=\"0\"\n            style=\"background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);\n                   color:#f0f0f8;font-size:18px;padding:10px 18px;border-radius:8px;\n                   width:360px;outline:none;\">\n        </div>\n\n        <div style=\"padding:0 72px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px;\">\n          <span style=\"font-size:16px;font-weight:700;color:rgba(240,240,248,0.45);letter-spacing:1px;text-transform:uppercase;\">Sort</span>\n          ".concat(TVDropdown.html('series-sort', SORT_OPTIONS, _activeSort), "\n        </div>\n\n        <div style=\"padding:12px 0 4px;\">\n          <div class=\"filter-bar\" data-scroll id=\"series-tabs\">").concat(tabsHTML(), "</div>\n        </div>\n\n        <div style=\"padding:0 0 4px;\">\n          <div class=\"filter-bar\" data-scroll id=\"series-genres\">\n            ").concat(_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8), "\n          </div>\n        </div>\n\n        <div class=\"movie-grid\" id=\"series-grid\"></div>\n      </div>");

      // Load genres
      var _temp4 = function () {
        if (!_genres.length) {
          var _temp3 = _catch(function () {
            return Promise.resolve(TMDB.tvGenres()).then(function (gData) {
              _genres = gData.genres;
              var el = document.getElementById('series-genres');
              if (el) {
                el.innerHTML = genrePills();
                bindGenrePills(el);
              }
            });
          }, function () {});
          if (_temp3 && _temp3.then) return _temp3.then(function () {});
        } else {
          bindGenrePills(document.getElementById('series-genres'));
        }
      }();
      return Promise.resolve(_temp4 && _temp4.then ? _temp4.then(_temp5) : _temp5(_temp4));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var loadShows = function loadShows() {
    var replace = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    try {
      function _temp2() {
        _loading = false;
      }
      if (_loading) return Promise.resolve();
      _loading = true;
      var grid = document.getElementById('series-grid');
      if (!grid) {
        _loading = false;
        return Promise.resolve();
      }
      if (replace) {
        _page = 1;
        grid.innerHTML = Array.from({
          length: 12
        }, function () {
          return "<div class=\"card\">\n          <div class=\"card-poster skeleton\"></div>\n          <div class=\"card-info\">\n            <div class=\"skeleton\" style=\"height:14px;width:80%;margin-bottom:6px;border-radius:4px;\"></div>\n            <div class=\"skeleton\" style=\"height:12px;width:40%;border-radius:4px;\"></div>\n          </div>\n        </div>";
        }).join('');
      }
      var _temp = _catch(function () {
        return Promise.resolve(fetchShows(_page)).then(function (data) {
          var cards = data.results.map(showCard).join('');
          if (replace) {
            grid.innerHTML = cards;
          } else {
            grid.insertAdjacentHTML('beforeend', cards);
          }
          bindCardClicks(grid);
          fillProgressBars(grid);
          setupAutoPaging(grid);
          if (replace) Nav.reset(document.getElementById('series-page'));
        });
      }, function (err) {
        console.error('Series load error:', err);
      });
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Fetch based on active tab ────────────────────────────
  var fetchShows = function fetchShows() {
    var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    try {
      if (_activeSearch) {
        return Promise.resolve(TMDB.searchTv(_activeSearch, page));
      }
      if (_activeGenre || _activeSort !== 'popularity.desc') {
        return Promise.resolve(TMDB.tvDiscover({
          with_genres: _activeGenre || undefined,
          sort_by: _activeSort,
          page: page
        }));
      }
      switch (_activeTab) {
        case 'trending':
          return Promise.resolve(TMDB.tvTrending('week', page));
        case 'top_rated':
          return Promise.resolve(TMDB.tvTopRated(page));
        case 'airing':
          return Promise.resolve(TMDB.tvAiringToday(page));
        case 'on_air':
          return Promise.resolve(TMDB.tvOnTheAir(page));
        default:
          return Promise.resolve(TMDB.tvPopular(page));
      }
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var _genres = [];
  var _activeGenre = null;
  var _activeSort = 'popularity.desc';
  var _activeTab = 'popular';
  var _activeSearch = '';
  var _page = 1;
  var _loading = false;
  var TABS = [{
    id: 'popular',
    label: 'Popular'
  }, {
    id: 'trending',
    label: 'Trending'
  }, {
    id: 'top_rated',
    label: 'Top Rated'
  }, {
    id: 'airing',
    label: 'Airing Today'
  }, {
    id: 'on_air',
    label: 'On The Air'
  }];
  var SORT_OPTIONS = [{
    value: 'popularity.desc',
    label: 'Most Popular'
  }, {
    value: 'vote_average.desc',
    label: 'Highest Rated'
  }, {
    value: 'first_air_date.desc',
    label: 'Newest First'
  }, {
    value: 'first_air_date.asc',
    label: 'Oldest First'
  }, {
    value: 'name.asc',
    label: 'A – Z'
  }];

  // ── Card ────────────────────────────────────────────────
  function showCard(show) {
    var poster = show.poster_path ? TMDB.img(show.poster_path, Config.IMG.POSTER_MD) : '';
    var year = (show.first_air_date || '').slice(0, 4);
    var rating = show.vote_average ? show.vote_average.toFixed(1) : '';
    return "\n      <div class=\"card\" data-nav data-show-id=\"".concat(show.id, "\" tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(show.name, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83D\uDCFA</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div style=\"position:absolute;top:10px;left:10px;background:#22d3ee;\n            color:#000;font-size:10px;font-weight:800;padding:3px 7px;border-radius:4px;\n            letter-spacing:0.5px;\">SERIES</div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n          <div class=\"card-prog\" id=\"cprog-").concat(show.id, "\"></div>\n        </div>\n        <div class=\"card-info\">\n          <div class=\"card-title\">").concat(show.name || '', "</div>\n          <div class=\"card-year\">").concat(year, "</div>\n        </div>\n      </div>");
  }
  function setupAutoPaging(grid) {
    var cards = grid.querySelectorAll('.card');
    if (!cards.length) return;
    var lastCard = cards[cards.length - 1];
    lastCard.addEventListener('nav:focus', function () {
      if (!_loading) {
        _page++;
        loadShows(false);
      }
    });
  }
  function bindCardClicks(container) {
    container.querySelectorAll('[data-show-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        App.navigate('player', {
          id: el.dataset.showId,
          type: 'tv',
          season: 1,
          episode: 1
        });
      });
    });
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

  // ── Genre pills ─────────────────────────────────────────
  function genrePills() {
    var allActive = _activeGenre === null ? 'active' : '';
    var pills = _genres.map(function (g) {
      var active = _activeGenre === g.id ? 'active' : '';
      return "<div class=\"pill ".concat(active, "\" data-nav data-genre-id=\"").concat(g.id, "\" tabindex=\"0\">").concat(g.name, "</div>");
    }).join('');
    return "<div class=\"pill ".concat(allActive, "\" data-nav data-genre-id=\"\" tabindex=\"0\" data-nav-default>All</div>").concat(pills);
  }

  // ── Tabs ────────────────────────────────────────────────
  function tabsHTML() {
    return TABS.map(function (t) {
      return "<div class=\"pill ".concat(_activeTab === t.id && !_activeGenre ? 'active' : '', "\"\n        data-nav data-tab=\"").concat(t.id, "\" tabindex=\"0\">").concat(t.label, "</div>");
    }).join('');
  }
  function bindGenrePills(container) {
    container.querySelectorAll('[data-genre-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        container.querySelectorAll('[data-genre-id]').forEach(function (p) {
          return p.classList.remove('active');
        });
        el.classList.add('active');
        _activeGenre = el.dataset.genreId ? parseInt(el.dataset.genreId) : null;
        // Clear tab active state when genre is selected
        document.querySelectorAll('#series-tabs [data-tab]').forEach(function (t) {
          return t.classList.remove('active');
        });
        loadShows(true);
      });
    });
  }
  function onLeave() {}
  return {
    render: render,
    onLeave: onLeave
  };
}();