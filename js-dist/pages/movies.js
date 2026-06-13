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
var MoviesPage = function () {
  // ── Render ──────────────────────────────────────────────
  var render = function render(container) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    try {
      function _temp7() {
        TVDropdown.mount('movies-sort', function (v) {
          _activeSort = v;
          loadMovies(true);
        });
        TVDropdown.mount('movies-year', function (v) {
          _activeYear = v;
          loadMovies(true);
        });

        // Search button activates on click or Enter
        // Search input — captures all keystrokes while active
        var searchBtn = document.getElementById('movie-search-btn');
        if (searchBtn) {
          searchBtn.addEventListener('click', activateSearch);
        }
        var searchInput = document.getElementById('movie-search-input');
        var _searchTimer = null;
        var _isTv = !document.body.classList.contains('is-web') && !document.body.classList.contains('is-mobile');
        if (searchInput) {
          searchInput.addEventListener('keydown', function (e) {
            e.stopPropagation(); // prevent D-pad nav while typing
            if (e.keyCode === 13) {
              clearTimeout(_searchTimer);
              _activeSearch = searchInput.value.trim();
              _page = 1;
              if (!_activeSearch) {
                deactivateSearch(false);
                return;
              }
              loadMovies(true);
              // TV: blur input after Enter so D-pad can navigate results without clearing search
              if (_isTv) searchInput.blur();
            } else if (e.keyCode === 40 && _isTv) {
              // TV: Down arrow while in search → move focus to results
              e.preventDefault();
              searchInput.blur();
            } else if (e.keyCode === 27 || e.keyCode === Config.KEYS.BACK) {
              deactivateSearch(true);
            }
          });
          searchInput.addEventListener('input', function () {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(function () {
              _activeSearch = searchInput.value.trim();
              _page = 1;
              loadMovies(true);
            }, 500);
          });
        }
        var closeBtn = document.getElementById('movie-search-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function () {
            deactivateSearch(true);
          });
        }
        return Promise.resolve(loadMovies(true)).then(function () {
          setupScrollPaging();
          bindRemoteKeys();
        });
      }
      _activeGenre = params.genre ? parseInt(params.genre) : null;
      container.innerHTML = "\n      <div id=\"movies-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">Movies</h1>\n          <p class=\"page-subtitle\">Explore thousands of movies by genre, year, and more</p>\n        </div>\n\n        <div style=\"padding:".concat(window.innerWidth < 1024 ? '12px 16px 8px' : '20px 72px 8px', ";display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:12px;").concat(window.innerWidth >= 1024 ? 'max-width:520px;' : '', "min-width:0;\">\n          <!-- Search trigger button \u2014 sits in the nav flow -->\n          <button id=\"movie-search-btn\" class=\"search-pill-btn\" data-nav tabindex=\"0\" style=\"-webkit-flex:1;flex:1;\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"\n                 stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"20\" height=\"20\">\n              <circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>\n            </svg>\n            <span>Search movies...</span>\n          </button>\n          <!-- Active search input \u2014 hidden until button is pressed -->\n          <div id=\"movie-search-wrap\" style=\"display:none;-webkit-align-items:center;align-items:center;gap:8px;-webkit-flex:1;flex:1;min-width:0;\">\n            <input type=\"text\" id=\"movie-search-input\" class=\"search-active-input\"\n                   placeholder=\"Type to search...\" autocomplete=\"off\">\n            <button id=\"movie-search-close\" class=\"search-close-btn\" data-nav tabindex=\"0\">&#x2715;</button>\n          </div>\n        </div>\n\n        <div style=\"padding:").concat(window.innerWidth < 1024 ? '4px 16px 0' : '0 72px 0', ";display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:").concat(window.innerWidth < 1024 ? '6px' : '16px', ";flex-wrap:").concat(window.innerWidth < 1024 ? 'nowrap' : 'wrap', ";\">\n          <span class=\"filter-label\" style=\"").concat(window.innerWidth < 1024 ? 'display:none' : '', "\">Sort by</span>\n          ").concat(sortSelect(), "\n          <span class=\"filter-label\" style=\"margin-left:").concat(window.innerWidth < 1024 ? '0' : '8px', ";").concat(window.innerWidth < 1024 ? 'display:none' : '', "\">Year</span>\n          ").concat(yearSelect(), "\n        </div>\n\n        <div style=\"padding:16px 0 8px;\">\n          <div class=\"filter-bar\" data-scroll id=\"genre-bar\">\n            ").concat(_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8), "\n          </div>\n        </div>\n\n        <div class=\"movie-grid\" id=\"movies-grid\"></div>\n      </div>");

      // Genres
      var _temp6 = function () {
        if (!_genres.length) {
          var _temp5 = _catch(function () {
            return Promise.resolve(TMDB.genres()).then(function (gData) {
              _genres = gData.genres;
              var bar = document.getElementById('genre-bar');
              if (bar) bar.innerHTML = genrePills();
              bindGenrePills(bar);
            });
          }, function () {});
          if (_temp5 && _temp5.then) return _temp5.then(function () {});
        } else {
          bindGenrePills(document.getElementById('genre-bar'));
        }
      }();
      return Promise.resolve(_temp6 && _temp6.then ? _temp6.then(_temp7) : _temp7(_temp6));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Load movies ─────────────────────────────────────────
  var loadMovies = function loadMovies() {
    var replace = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    try {
      function _temp4() {
        _loading = false;
      }
      if (_loading) return Promise.resolve();
      _loading = true;
      var grid = document.getElementById('movies-grid');
      if (!grid) {
        _loading = false;
        return Promise.resolve();
      }
      if (replace) {
        grid.innerHTML = UX.skeletonCards(12);
        _page = 1;
      }
      var _temp3 = _catch(function () {
        function _temp2() {
          var cards = data.results.map(movieCard).join('');
          if (replace) {
            grid.innerHTML = cards;
          } else {
            grid.insertAdjacentHTML('beforeend', cards);
          }
          bindCardClicks(grid);
          UX.fillProgressBars(grid);
          UX.fetchInAppRatings(data.results.map(function (m) {
            return String(m.id);
          }));
          if (replace) {
            var _si = document.getElementById('movie-search-input');
            var _sw = document.getElementById('movie-search-wrap');
            if (document.activeElement !== _si) {
              Nav.reset(document.getElementById('movies-page'));
              var _tvSearchActive = !document.body.classList.contains('is-web') && !document.body.classList.contains('is-mobile') && _sw && _sw.style.display !== 'none';
              if (_tvSearchActive) {
                var firstCard = document.querySelector('#movies-grid [data-nav]');
                if (firstCard) Nav.focusEl(firstCard);
              }
            }
          }
        }
        var data;
        var _temp = function () {
          if (_activeSearch) {
            return Promise.resolve(TMDB.search(_activeSearch, _page)).then(function (_TMDB$search) {
              data = _TMDB$search;
              if (_activeGenre) {
                data = {
                  results: data.results.filter(function (r) {
                    return r.genre_ids && r.genre_ids.indexOf(_activeGenre) !== -1;
                  }),
                  total_results: data.total_results
                };
              }
            });
          } else {
            var params = {
              sort_by: _activeSort,
              page: _page
            };
            if (_activeGenre) params.with_genres = _activeGenre;
            if (_activeYear) {
              var y = parseInt(_activeYear);
              if (y < 2000) {
                params['primary_release_date.gte'] = "".concat(y, "-01-01");
                params['primary_release_date.lte'] = "".concat(y + 9, "-12-31");
              } else {
                params.primary_release_year = _activeYear;
              }
            }
            return Promise.resolve(TMDB.discover(params)).then(function (_TMDB$discover) {
              data = _TMDB$discover;
            });
          }
        }();
        return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
      }, function (err) {
        console.error('Movies load error:', err);
      });
      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
    } catch (e) {
      return Promise.reject(e);
    }
  }; // ── Scroll-based pagination ─────────────────────────────
  var _genres = [];
  var _activeGenre = null;
  var _activeSort = 'popularity.desc';
  var _activeYear = '';
  var _activeSearch = '';
  var _page = 1;
  var _loading = false;
  var _scrollHandler = null;
  var _scrollObserver = null;
  var _keyHandler = null;
  var SORT_OPTIONS = [{
    value: 'popularity.desc',
    label: 'Most Popular'
  }, {
    value: 'vote_average.desc',
    label: 'Highest Rated'
  }, {
    value: 'release_date.desc',
    label: 'Newest First'
  }, {
    value: 'release_date.asc',
    label: 'Oldest First'
  }, {
    value: 'revenue.desc',
    label: 'Highest Grossing'
  }, {
    value: 'original_title.asc',
    label: 'A – Z'
  }];
  var YEAR_OPTIONS = [{
    value: '',
    label: 'All Years'
  }, {
    value: '2024',
    label: '2024'
  }, {
    value: '2023',
    label: '2023'
  }, {
    value: '2022',
    label: '2022'
  }, {
    value: '2021',
    label: '2021'
  }, {
    value: '2020',
    label: '2020'
  }, {
    value: '2010',
    label: '2010s'
  }, {
    value: '2000',
    label: '2000s'
  }, {
    value: '1990',
    label: '90s'
  }, {
    value: '1980',
    label: '80s'
  }];

  // ── Card rendering ──────────────────────────────────────
  function movieCard(movie) {
    var poster = movie.poster_path ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD) : '';
    var rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return "\n      <div class=\"card\" data-nav data-movie-id=\"".concat(movie.id, "\"\n           data-movie-title=\"").concat((movie.title || '').replace(/"/g, '&quot;'), "\"\n           data-movie-poster=\"").concat(poster, "\"\n           data-movie-rating=\"").concat(rating, "\"\n           tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(movie.title, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83C\uDFAC</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div class=\"card-badges\" id=\"badges-").concat(movie.id, "\">\n            ").concat(UX.badgesHTML(movie.id, 'movie'), "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n          <div class=\"card-mobile-actions\">\n            <button class=\"card-action-btn\" data-action=\"info\" title=\"More Info\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"12\" height=\"12\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\"/></svg></button>\n            <button class=\"card-action-btn").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(movie.id, 'movie') ? ' fav-active' : '', "\" data-action=\"fav\" title=\"Favourite\">").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(movie.id, 'movie') ? '♥' : '♡', "</button>\n            <button class=\"card-action-btn").concat(typeof NexPlayDB !== 'undefined' && NexPlayDB.isInWatchlist(movie.id, 'movie') ? ' wl-active' : '', "\" data-action=\"wl\" title=\"Watchlist\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"11\" height=\"11\"><path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/></svg></button>\n          </div>\n          <div class=\"card-ia-rating card-ia-na\" id=\"ia-").concat(movie.id, "\" title=\"No NexPlay ratings yet\">N/A</div>\n          <div class=\"card-prog\" id=\"cprog-").concat(movie.id, "\" data-type=\"movie\"></div>\n        </div>\n      </div>");
  }
  function updateCardBadge(movieId) {
    var el = document.getElementById('badges-' + movieId);
    if (!el) return;
    el.innerHTML = UX.badgesHTML(movieId, 'movie');
  }

  // ── Genre pills ─────────────────────────────────────────
  function genrePills() {
    var allActive = _activeGenre === null ? 'active' : '';
    var pills = _genres.map(function (g) {
      var active = _activeGenre === g.id ? 'active' : '';
      return "<div class=\"pill ".concat(active, "\" data-nav data-genre-id=\"").concat(g.id, "\" tabindex=\"0\">").concat(g.name, "</div>");
    }).join('');
    return "\n      <div class=\"pill ".concat(allActive, "\" data-nav data-genre-id=\"\" tabindex=\"0\" data-nav-default>All</div>\n      ").concat(pills);
  }
  function sortSelect() {
    return TVDropdown.html('movies-sort', SORT_OPTIONS, _activeSort);
  }
  function yearSelect() {
    return TVDropdown.html('movies-year', YEAR_OPTIONS, _activeYear);
  }
  function setupScrollPaging() {
    teardownScrollPaging();
    var grid = document.getElementById('movies-grid');
    if (!grid) return;

    // Sentinel sits AFTER the grid so card appends don't push it around
    var sentinel = document.createElement('div');
    sentinel.id = 'nexplay-pg-sentinel';
    sentinel.style.height = '4px';
    grid.insertAdjacentElement('afterend', sentinel);
    if (typeof IntersectionObserver !== 'undefined') {
      // Mobile / modern browser: observe sentinel against the viewport.
      // TV with IntersectionObserver: observe against #main-content container.
      var isMobile = window.innerWidth < 1024;
      _scrollObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !_loading) {
          _page++;
          loadMovies(false);
        }
      }, {
        root: isMobile ? null : document.getElementById('main-content'),
        rootMargin: '0px 0px 600px 0px'
      });
      _scrollObserver.observe(sentinel);
    } else {
      // Tizen / old browser: scroll event on #main-content
      var mc = document.getElementById('main-content');
      if (!mc) return;
      _scrollHandler = function _scrollHandler() {
        if (_loading) return;
        if (mc.scrollHeight - mc.scrollTop - mc.clientHeight < 400) {
          _page++;
          loadMovies(false);
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

  // ── Remote key handler ─────────────────────────────────
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      // TV Back key: if search is active, re-focus input (first Back) or clear (second Back)
      if (e.keyCode === Config.KEYS.BACK || e.keyCode === 10009) {
        var wrap = document.getElementById('movie-search-wrap');
        var inp = document.getElementById('movie-search-input');
        if (wrap && wrap.style.display !== 'none' && document.activeElement !== inp) {
          e.preventDefault();
          e.stopPropagation();
          inp.focus();
          return;
        }
      }
      if (typeof NexPlayDB === 'undefined') return;
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused[data-movie-id]');
      if (!focused || !focused.dataset.movieId) return;
      var movieId = focused.dataset.movieId;
      var title = focused.dataset.movieTitle || '';
      var poster = focused.dataset.moviePoster || '';
      var rating = focused.dataset.movieRating || '0';
      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        var added = NexPlayDB.toggleFavourite(movieId, 'movie', title, poster, rating);
        App.showToast(added ? '♥ Added to Favourites' : 'Removed from Favourites');
        updateCardBadge(movieId);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      } else if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        var _added = NexPlayDB.toggleWatchlist(movieId, 'movie', title, poster, rating);
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

  // ── Card clicks ─────────────────────────────────────────
  function bindCardClicks(container) {
    container.querySelectorAll('[data-movie-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        App.navigate('player', {
          id: el.dataset.movieId,
          type: 'movie'
        });
      });
    });
  }

  // ── Genre pills ─────────────────────────────────────────
  function bindGenrePills(container) {
    container.querySelectorAll('[data-genre-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        container.querySelectorAll('[data-genre-id]').forEach(function (p) {
          return p.classList.remove('active');
        });
        el.classList.add('active');
        _activeGenre = el.dataset.genreId ? parseInt(el.dataset.genreId) : null;
        loadMovies(true);
      });
    });
  }

  // ── Search activation ───────────────────────────────────
  function activateSearch() {
    document.getElementById('movie-search-btn').style.display = 'none';
    document.getElementById('movie-search-wrap').style.display = 'flex';
    document.getElementById('movie-search-input').focus();
  }
  function deactivateSearch(clearResults) {
    var input = document.getElementById('movie-search-input');
    if (input) input.value = '';
    document.getElementById('movie-search-wrap').style.display = 'none';
    document.getElementById('movie-search-btn').style.display = '';
    Nav.focusEl(document.getElementById('movie-search-btn'));
    if (clearResults && _activeSearch) {
      _activeSearch = '';
      loadMovies(true);
    }
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