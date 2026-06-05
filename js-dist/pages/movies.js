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
        if (searchInput) {
          searchInput.addEventListener('keydown', function (e) {
            e.stopPropagation(); // prevent D-pad nav while typing
            if (e.keyCode === 13) {
              clearTimeout(_searchTimer);
              _activeSearch = searchInput.value.trim();
              _page = 1;
              loadMovies(true);
              if (!_activeSearch) deactivateSearch(false);
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
      container.innerHTML = "\n      <div id=\"movies-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">Movies</h1>\n          <p class=\"page-subtitle\">Explore thousands of movies by genre, year, and more</p>\n        </div>\n\n        <div style=\"padding:20px 72px 8px;display:-webkit-flex;display:flex;align-items:center;gap:16px;\">\n          <!-- Search trigger button \u2014 sits in the nav flow -->\n          <button id=\"movie-search-btn\" class=\"search-pill-btn\" data-nav tabindex=\"0\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"\n                 stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"20\" height=\"20\">\n              <circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>\n            </svg>\n            <span>Search movies...</span>\n          </button>\n          <!-- Active search input \u2014 hidden until button is pressed -->\n          <div id=\"movie-search-wrap\" style=\"display:none;-webkit-align-items:center;align-items:center;gap:8px;\">\n            <input type=\"text\" id=\"movie-search-input\" class=\"search-active-input\"\n                   placeholder=\"Type to search...\" autocomplete=\"off\">\n            <button id=\"movie-search-close\" class=\"search-close-btn\" tabindex=\"-1\">&#x2715;</button>\n          </div>\n        </div>\n\n        <div style=\"padding:0 72px 0;display:-webkit-flex;display:flex;align-items:center;gap:16px;flex-wrap:wrap;\">\n          <span class=\"filter-label\">Sort by</span>\n          ".concat(sortSelect(), "\n          <span class=\"filter-label\" style=\"margin-left:8px;\">Year</span>\n          ").concat(yearSelect(), "\n        </div>\n\n        <div style=\"padding:16px 0 8px;\">\n          <div class=\"filter-bar\" data-scroll id=\"genre-bar\">\n            ").concat(_genres.length ? genrePills() : '<div class="pill skeleton" style="width:60px;"></div>'.repeat(8), "\n          </div>\n        </div>\n\n        <div class=\"movie-grid\" id=\"movies-grid\"></div>\n      </div>");

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
          if (replace) Nav.reset(document.getElementById('movies-page'));
        }
        var data;
        var _temp = function () {
          if (_activeSearch) {
            return Promise.resolve(TMDB.search(_activeSearch, _page)).then(function (_TMDB$search) {
              data = _TMDB$search;
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
    return "\n      <div class=\"card\" data-nav data-movie-id=\"".concat(movie.id, "\"\n           data-movie-title=\"").concat((movie.title || '').replace(/"/g, '&quot;'), "\"\n           data-movie-poster=\"").concat(poster, "\"\n           tabindex=\"0\" style=\"width:220px\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(movie.title, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83C\uDFAC</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div class=\"card-badges\" id=\"badges-").concat(movie.id, "\">\n            ").concat(UX.badgesHTML(movie.id, 'movie'), "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n          <div class=\"card-prog\" id=\"cprog-").concat(movie.id, "\"></div>\n        </div>\n      </div>");
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
    var content = document.getElementById('main-content');
    if (!content) return;
    if (_scrollHandler) content.removeEventListener('scroll', _scrollHandler);
    _scrollHandler = function _scrollHandler() {
      if (_loading) return;
      var nearBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 500;
      if (nearBottom) {
        _page++;
        loadMovies(false);
      }
    };
    content.addEventListener('scroll', _scrollHandler);
  }
  function teardownScrollPaging() {
    var content = document.getElementById('main-content');
    if (content && _scrollHandler) content.removeEventListener('scroll', _scrollHandler);
    _scrollHandler = null;
  }

  // ── Remote key handler (GREEN = fav, INFO = watchlist) ──
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      if (typeof NexPlayDB === 'undefined') return;
      // Fallback to CSS-class in case Samsung INFO key briefly clears Nav focus
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused[data-movie-id]');
      if (!focused || !focused.dataset.movieId) return;
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