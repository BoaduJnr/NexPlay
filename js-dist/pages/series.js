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
      function _temp7() {
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
        var _isTv = !document.body.classList.contains('is-web') && !document.body.classList.contains('is-mobile');
        var seriesSearchInput = document.getElementById('series-search-input');
        var _searchTimer = null;
        if (seriesSearchInput) {
          seriesSearchInput.addEventListener('keydown', function (e) {
            e.stopPropagation();
            if (e.keyCode === 13) {
              clearTimeout(_searchTimer);
              _activeSearch = seriesSearchInput.value.trim();
              _page = 1;
              if (!_activeSearch) {
                seriesSearchInput.value = '';
                document.getElementById('series-search-wrap').style.display = 'none';
                searchBtn.style.display = '';
                Nav.focusEl(searchBtn);
                return;
              }
              loadShows(true);
              // TV: blur so D-pad can navigate results without clearing search
              if (_isTv) seriesSearchInput.blur();
            } else if (e.keyCode === 40 && _isTv) {
              // TV: Down arrow → move focus to results
              e.preventDefault();
              seriesSearchInput.blur();
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
      container.innerHTML = "\n      <div id=\"series-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">TV Series</h1>\n          <p class=\"page-subtitle\">Discover popular shows, trending series, and more</p>\n        </div>\n\n        <div style=\"padding:".concat(window.innerWidth < 1024 ? '12px 16px 8px' : '20px 72px 8px', ";display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:12px;").concat(window.innerWidth >= 1024 ? 'max-width:520px;' : '', "min-width:0;\">\n          <button id=\"series-search-btn\" class=\"search-pill-btn\" data-nav tabindex=\"0\" style=\"-webkit-flex:1;flex:1;\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"\n                 stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"20\" height=\"20\">\n              <circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>\n            </svg>\n            <span>Search series...</span>\n          </button>\n          <div id=\"series-search-wrap\" style=\"display:none;-webkit-align-items:center;align-items:center;gap:8px;-webkit-flex:1;flex:1;min-width:0;\">\n            <input type=\"text\" id=\"series-search-input\" class=\"search-active-input\"\n                   placeholder=\"Type to search...\" autocomplete=\"off\">\n            <button id=\"series-search-close\" class=\"search-close-btn\" data-nav tabindex=\"0\">&#x2715;</button>\n          </div>\n        </div>\n\n        <div style=\"padding:").concat(window.innerWidth < 1024 ? '4px 16px 0' : '0 72px 0', ";display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:").concat(window.innerWidth < 1024 ? '6px' : '16px', ";\">\n          <span class=\"filter-label\" style=\"").concat(window.innerWidth < 1024 ? 'display:none' : '', "\">Sort</span>\n          ").concat(TVDropdown.html('series-sort', SORT_OPTIONS, _activeSort), "\n        </div>\n\n        <div style=\"padding:12px 0 4px;\">\n          <div class=\"filter-bar\" data-scroll id=\"series-tabs\">").concat(tabsHTML(), "</div>\n        </div>\n\n        <div style=\"padding:0 0 4px;\">\n          <div class=\"filter-bar\" data-scroll id=\"series-genres\">\n            ").concat(_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8), "\n          </div>\n        </div>\n\n        <div class=\"movie-grid\" id=\"series-grid\"></div>\n      </div>");

      // Load genres
      var _temp6 = function () {
        if (!_genres.length) {
          var _temp5 = _catch(function () {
            return Promise.resolve(TMDB.tvGenres()).then(function (gData) {
              _genres = gData.genres;
              var el = document.getElementById('series-genres');
              if (el) {
                el.innerHTML = genrePills();
                bindGenrePills(el);
              }
            });
          }, function () {});
          if (_temp5 && _temp5.then) return _temp5.then(function () {});
        } else {
          bindGenrePills(document.getElementById('series-genres'));
        }
      }();
      return Promise.resolve(_temp6 && _temp6.then ? _temp6.then(_temp7) : _temp7(_temp6));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var loadShows = function loadShows() {
    var replace = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    try {
      function _temp4() {
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
      var _temp3 = _catch(function () {
        return Promise.resolve(fetchShows(_page)).then(function (data) {
          var cards = data.results.map(showCard).join('');
          if (replace) {
            grid.innerHTML = cards;
          } else {
            grid.insertAdjacentHTML('beforeend', cards);
          }
          bindCardClicks(grid);
          UX.fillProgressBars(grid);
          if (replace) {
            var _si = document.getElementById('series-search-input');
            var _sw = document.getElementById('series-search-wrap');
            if (document.activeElement !== _si) {
              Nav.reset(document.getElementById('series-page'));
              var _tvSearchActive = !document.body.classList.contains('is-web') && !document.body.classList.contains('is-mobile') && _sw && _sw.style.display !== 'none';
              if (_tvSearchActive) {
                var firstCard = document.querySelector('#series-grid [data-nav]');
                if (firstCard) Nav.focusEl(firstCard);
              }
            }
          }
        });
      }, function (err) {
        console.error('Series load error:', err);
      });
      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Fetch based on active tab ────────────────────────────
  var fetchShows = function fetchShows() {
    var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    try {
      var _exit = false;
      function _temp2(_result) {
        if (_exit) return _result;
        if (_activeGenre || _activeSort !== 'popularity.desc') {
          return TMDB.tvDiscover({
            with_genres: _activeGenre || undefined,
            sort_by: _activeSort,
            page: page
          });
        }
        switch (_activeTab) {
          case 'trending':
            return TMDB.tvTrending('week', page);
          case 'top_rated':
            return TMDB.tvTopRated(page);
          case 'airing':
            return TMDB.tvAiringToday(page);
          case 'on_air':
            return TMDB.tvOnTheAir(page);
          default:
            return TMDB.tvPopular(page);
        }
      }
      var _temp = function () {
        if (_activeSearch) {
          return Promise.resolve(TMDB.searchTv(_activeSearch, page)).then(function (searchData) {
            if (_activeGenre) {
              searchData.results = searchData.results.filter(function (r) {
                return r.genre_ids && r.genre_ids.indexOf(_activeGenre) !== -1;
              });
            }
            _exit = true;
            return searchData;
          });
        }
      }();
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
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
  var _scrollObserver = null;
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
    return "\n      <div class=\"card\" data-nav data-show-id=\"".concat(show.id, "\"\n           data-show-title=\"").concat((show.name || '').replace(/"/g, '&quot;'), "\"\n           data-show-poster=\"").concat(poster, "\"\n           tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(show.name, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83D\uDCFA</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div class=\"card-badges card-badges--below\" id=\"badges-").concat(show.id, "\">\n            ").concat(UX.badgesHTML(show.id, 'tv'), "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n          <div class=\"card-mobile-actions\">\n            <button class=\"card-action-btn").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(show.id, 'tv') ? ' fav-active' : '', "\" data-action=\"fav\" title=\"Favourite\">").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(show.id, 'tv') ? '♥' : '♡', "</button>\n            <button class=\"card-action-btn").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isInWatchlist(show.id, 'tv') ? ' wl-active' : '', "\" data-action=\"wl\" title=\"Watchlist\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"11\" height=\"11\"><path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/></svg></button>\n          </div>\n          <div class=\"card-prog\" id=\"cprog-").concat(show.id, "\" data-type=\"tv\"></div>\n        </div>\n      </div>");
  }
  function updateCardBadge(showId) {
    var el = document.getElementById('badges-' + showId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(showId, 'tv');
  }
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      // TV Back: if search active, re-focus input first press; clear on second press
      if (e.keyCode === Config.KEYS.BACK || e.keyCode === 10009) {
        var wrap = document.getElementById('series-search-wrap');
        var inp = document.getElementById('series-search-input');
        if (wrap && wrap.style.display !== 'none' && document.activeElement !== inp) {
          e.preventDefault();
          e.stopPropagation();
          inp.focus();
          return;
        }
      }
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
    teardownScrollPaging();
    var grid = document.getElementById('series-grid');
    if (!grid) return;
    var sentinel = document.createElement('div');
    sentinel.id = 'nexplay-pg-sentinel';
    sentinel.style.height = '4px';
    grid.insertAdjacentElement('afterend', sentinel);
    if (typeof IntersectionObserver !== 'undefined') {
      var isMobile = window.innerWidth < 1024;
      _scrollObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !_loading) {
          _page++;
          loadShows(false);
        }
      }, {
        root: isMobile ? null : document.getElementById('main-content'),
        rootMargin: '0px 0px 600px 0px'
      });
      _scrollObserver.observe(sentinel);
    } else {
      var mc = document.getElementById('main-content');
      if (!mc) return;
      _scrollHandler = function _scrollHandler() {
        if (_loading) return;
        if (mc.scrollHeight - mc.scrollTop - mc.clientHeight < 400) {
          _page++;
          loadShows(false);
        }
      };
      mc.addEventListener('scroll', _scrollHandler);
    }
  }
  function teardownScrollPaging() {
    if (_scrollObserver) {
      _scrollObserver.disconnect();
      _scrollObserver = null;
    }
    if (_scrollHandler) {
      var mc = document.getElementById('main-content');
      if (mc) mc.removeEventListener('scroll', _scrollHandler);
      window.removeEventListener('scroll', _scrollHandler);
      _scrollHandler = null;
    }
    var s = document.getElementById('nexplay-pg-sentinel');
    if (s && s.parentNode) s.parentNode.removeChild(s);
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