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
        var searchBtn = document.getElementById('series-search-btn');
        if (searchBtn) {
          searchBtn.addEventListener('click', function () {
            searchBtn.style.display = 'none';
            document.getElementById('series-search-wrap').style.display = 'flex';
            document.getElementById('series-search-input').focus();
          });
        }
        var seriesSearchInput = document.getElementById('series-search-input');
        var _searchTimer = null;
        if (seriesSearchInput) {
          seriesSearchInput.addEventListener('keydown', function (e) {
            e.stopPropagation();
            if (e.keyCode === 13) {
              clearTimeout(_searchTimer);
              _activeSearch = seriesSearchInput.value.trim();
              _page = 1;
              loadShows(true);
              if (!_activeSearch) {
                seriesSearchInput.value = '';
                document.getElementById('series-search-wrap').style.display = 'none';
                searchBtn.style.display = '';
                Nav.focusEl(searchBtn);
              }
            } else if (e.keyCode === 27 || e.keyCode === Config.KEYS.BACK) {
              seriesSearchInput.value = '';
              _activeSearch = '';
              document.getElementById('series-search-wrap').style.display = 'none';
              searchBtn.style.display = '';
              Nav.focusEl(searchBtn);
              _page = 1;
              loadShows(true);
            }
          });
          seriesSearchInput.addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(function () {
              _activeSearch = seriesSearchInput.value.trim();
              _page = 1;
              loadShows(true);
            }, 500);
          });
        }
        var seriesClose = document.getElementById('series-search-close');
        if (seriesClose) {
          seriesClose.addEventListener('click', function () {
            seriesSearchInput.value = '';
            _activeSearch = '';
            document.getElementById('series-search-wrap').style.display = 'none';
            searchBtn.style.display = '';
            Nav.focusEl(searchBtn);
            _page = 1;
            loadShows(true);
          });
        }
        return Promise.resolve(loadShows(true)).then(function () {
          setupScrollPaging();
          bindRemoteKeys();
        });
      }
      container.innerHTML = "\n      <div id=\"series-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">TV Series</h1>\n          <p class=\"page-subtitle\">Discover popular shows, trending series, and more</p>\n        </div>\n\n        <div style=\"padding:20px 72px 8px;display:-webkit-flex;display:flex;align-items:center;gap:16px;\">\n          <button id=\"series-search-btn\" class=\"search-pill-btn\" data-nav tabindex=\"0\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"\n                 stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"20\" height=\"20\">\n              <circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>\n            </svg>\n            <span>Search series...</span>\n          </button>\n          <div id=\"series-search-wrap\" style=\"display:none;-webkit-align-items:center;align-items:center;gap:8px;\">\n            <input type=\"text\" id=\"series-search-input\" class=\"search-active-input\"\n                   placeholder=\"Type to search...\" autocomplete=\"off\">\n            <button id=\"series-search-close\" class=\"search-close-btn\" tabindex=\"-1\">&#x2715;</button>\n          </div>\n        </div>\n\n        <div style=\"padding:0 72px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px;\">\n          <span style=\"font-size:16px;font-weight:700;color:rgba(240,240,248,0.45);letter-spacing:1px;text-transform:uppercase;\">Sort</span>\n          ".concat(TVDropdown.html('series-sort', SORT_OPTIONS, _activeSort), "\n        </div>\n\n        <div style=\"padding:12px 0 4px;\">\n          <div class=\"filter-bar\" data-scroll id=\"series-tabs\">").concat(tabsHTML(), "</div>\n        </div>\n\n        <div style=\"padding:0 0 4px;\">\n          <div class=\"filter-bar\" data-scroll id=\"series-genres\">\n            ").concat(_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8), "\n          </div>\n        </div>\n\n        <div class=\"movie-grid\" id=\"series-grid\"></div>\n      </div>");

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
        grid.innerHTML = UX.skeletonCards(12);
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
          UX.fillProgressBars(grid);
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
  var _scrollHandler = null;
  var _keyHandler = null;
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
    var rating = show.vote_average ? show.vote_average.toFixed(1) : '';
    return "\n      <div class=\"card\" data-nav data-show-id=\"".concat(show.id, "\"\n           data-show-title=\"").concat((show.name || '').replace(/"/g, '&quot;'), "\"\n           data-show-poster=\"").concat(poster, "\"\n           tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(show.name, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83D\uDCFA</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div style=\"position:absolute;top:10px;left:10px;background:#22d3ee;\n            color:#000;font-size:10px;font-weight:800;padding:3px 7px;border-radius:4px;\n            letter-spacing:0.5px;\">SERIES</div>\n          <div class=\"card-badges card-badges--below\" id=\"badges-").concat(show.id, "\">\n            ").concat(UX.badgesHTML(show.id, 'tv'), "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n          <div class=\"card-prog\" id=\"cprog-").concat(show.id, "\"></div>\n        </div>\n      </div>");
  }
  function updateCardBadge(showId) {
    var el = document.getElementById('badges-' + showId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(showId, 'tv');
  }
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      if (typeof NexPlayDB === 'undefined') return;
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused[data-show-id]');
      if (!focused || !focused.dataset.showId) return;
      var showId = focused.dataset.showId;
      var title = focused.dataset.showTitle || '';
      var poster = focused.dataset.showPoster || '';
      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        var added = NexPlayDB.toggleFavourite(showId, 'tv', title, poster);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(showId);
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        var _added = NexPlayDB.toggleWatchlist(showId, 'tv', title, poster);
        App.showToast(_added ? '+ Added to Watchlist' : 'Removed from Watchlist');
        updateCardBadge(showId);
      } else if (e.keyCode === Config.KEYS.YELLOW) {
        e.preventDefault();
        App.navigate('detail', {
          id: showId,
          type: 'tv'
        });
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }
  function unbindRemoteKeys() {
    if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
  function setupScrollPaging() {
    var content = document.getElementById('main-content');
    if (!content) return;
    if (_scrollHandler) content.removeEventListener('scroll', _scrollHandler);
    _scrollHandler = function _scrollHandler() {
      if (_loading) return;
      if (content.scrollHeight - content.scrollTop - content.clientHeight < 500) {
        _page++;
        loadShows(false);
      }
    };
    content.addEventListener('scroll', _scrollHandler);
  }
  function teardownScrollPaging() {
    var content = document.getElementById('main-content');
    if (content && _scrollHandler) content.removeEventListener('scroll', _scrollHandler);
    _scrollHandler = null;
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
  function onLeave() {
    teardownScrollPaging();
    unbindRemoteKeys();
  }
  return {
    render: render,
    onLeave: onLeave
  };
}();