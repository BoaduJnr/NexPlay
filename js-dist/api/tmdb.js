"use strict";

function _finallyRethrows(body, finalizer) {
  try {
    var result = body();
  } catch (e) {
    return finalizer(true, e);
  }
  if (result && result.then) {
    return result.then(finalizer.bind(null, false), finalizer.bind(null, true));
  }
  return finalizer(false, result);
}
function _settle(pact, state, value) {
  if (!pact.s) {
    if (value instanceof _Pact) {
      if (value.s) {
        if (state & 1) {
          state = value.s;
        }
        value = value.v;
      } else {
        value.o = _settle.bind(null, pact, state);
        return;
      }
    }
    if (value && value.then) {
      value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
      return;
    }
    pact.s = state;
    pact.v = value;
    var observer = pact.o;
    if (observer) {
      observer(pact);
    }
  }
}
var _Pact = /*#__PURE__*/function () {
  function _Pact() {}
  _Pact.prototype.then = function (onFulfilled, onRejected) {
    var result = new _Pact();
    var state = this.s;
    if (state) {
      var callback = state & 1 ? onFulfilled : onRejected;
      if (callback) {
        try {
          _settle(result, 1, callback(this.v));
        } catch (e) {
          _settle(result, 2, e);
        }
        return result;
      } else {
        return this;
      }
    }
    this.o = function (_this) {
      try {
        var value = _this.v;
        if (_this.s & 1) {
          _settle(result, 1, onFulfilled ? onFulfilled(value) : value);
        } else if (onRejected) {
          _settle(result, 1, onRejected(value));
        } else {
          _settle(result, 2, value);
        }
      } catch (e) {
        _settle(result, 2, e);
      }
    };
    return result;
  };
  return _Pact;
}();
function _isSettledPact(thenable) {
  return thenable instanceof _Pact && thenable.s & 1;
}
function _for(test, update, body) {
  var stage;
  for (;;) {
    var shouldContinue = test();
    if (_isSettledPact(shouldContinue)) {
      shouldContinue = shouldContinue.v;
    }
    if (!shouldContinue) {
      return result;
    }
    if (shouldContinue.then) {
      stage = 0;
      break;
    }
    var result = body();
    if (result && result.then) {
      if (_isSettledPact(result)) {
        result = result.s;
      } else {
        stage = 1;
        break;
      }
    }
    if (update) {
      var updateValue = update();
      if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
        stage = 2;
        break;
      }
    }
  }
  var pact = new _Pact();
  var reject = _settle.bind(null, pact, 2);
  (stage === 0 ? shouldContinue.then(_resumeAfterTest) : stage === 1 ? result.then(_resumeAfterBody) : updateValue.then(_resumeAfterUpdate)).then(void 0, reject);
  return pact;
  function _resumeAfterBody(value) {
    result = value;
    do {
      if (update) {
        updateValue = update();
        if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
          updateValue.then(_resumeAfterUpdate).then(void 0, reject);
          return;
        }
      }
      shouldContinue = test();
      if (!shouldContinue || _isSettledPact(shouldContinue) && !shouldContinue.v) {
        _settle(pact, 1, result);
        return;
      }
      if (shouldContinue.then) {
        shouldContinue.then(_resumeAfterTest).then(void 0, reject);
        return;
      }
      result = body();
      if (_isSettledPact(result)) {
        result = result.v;
      }
    } while (!result || !result.then);
    result.then(_resumeAfterBody).then(void 0, reject);
  }
  function _resumeAfterTest(shouldContinue) {
    if (shouldContinue) {
      result = body();
      if (result && result.then) {
        result.then(_resumeAfterBody).then(void 0, reject);
      } else {
        _resumeAfterBody(result);
      }
    } else {
      _settle(pact, 1, result);
    }
  }
  function _resumeAfterUpdate() {
    if (shouldContinue = test()) {
      if (shouldContinue.then) {
        shouldContinue.then(_resumeAfterTest).then(void 0, reject);
      } else {
        _resumeAfterTest(shouldContinue);
      }
    } else {
      _settle(pact, 1, result);
    }
  }
}
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var TMDBClient = /*#__PURE__*/function () {
  function TMDBClient() {
    _classCallCheck(this, TMDBClient);
    this._cache = {};
  }
  return _createClass(TMDBClient, [{
    key: "_get",
    value: function _get(endpoint) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      try {
        var _this = this;
        function _temp2() {
          if (!res.ok) throw new Error('TMDB ' + res.status + ' on ' + endpoint);
          return Promise.resolve(res.json()).then(function (data) {
            _this._cache[url] = data;
            return data;
          });
        }
        var url = Config.TMDB_BASE + endpoint + '?api_key=' + Config.TMDB_KEY + '&language=en-US';
        var keys = Object.keys(params);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var v = params[k];
          if (v !== undefined && v !== null && v !== '') {
            url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(v));
          }
        }
        if (_this._cache[url]) return Promise.resolve(_this._cache[url]);
        var ctrl = new AbortController();
        var timer = setTimeout(function () {
          return ctrl.abort();
        }, 10000);
        var res;
        var _temp = _finallyRethrows(function () {
          return Promise.resolve(fetch(url, {
            signal: ctrl.signal
          })).then(function (_fetch) {
            res = _fetch;
          });
        }, function (_wasThrown, _result) {
          clearTimeout(timer);
          if (_wasThrown) throw _result;
          return _result;
        });
        return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
      } catch (e) {
        return Promise.reject(e);
      }
    } // ── Movies ───────────────────────────────────────────────
  }, {
    key: "trending",
    value: function trending() {
      var window = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'week';
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get("/trending/movie/".concat(window), {
        page: page
      });
    }
  }, {
    key: "popular",
    value: function popular() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/movie/popular', {
        page: page
      });
    }
  }, {
    key: "topRated",
    value: function topRated() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/movie/top_rated', {
        page: page
      });
    }
  }, {
    key: "nowPlaying",
    value: function nowPlaying() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/movie/now_playing', {
        page: page
      });
    }
  }, {
    key: "upcoming",
    value: function upcoming() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/movie/upcoming', {
        page: page
      });
    }
  }, {
    key: "details",
    value: function details(id) {
      return this._get("/movie/".concat(id), {
        append_to_response: 'credits,videos,similar,belongs_to_collection'
      });
    }
  }, {
    key: "recommendations",
    value: function recommendations(id) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get("/movie/".concat(id, "/recommendations"), {
        page: page
      });
    }

    // ── Genres ───────────────────────────────────────────────
  }, {
    key: "genres",
    value: function genres() {
      return this._get('/genre/movie/list');
    }

    // ── Discover (by genre, year, sort, etc.) ────────────────
  }, {
    key: "discover",
    value: function discover() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      return this._get('/discover/movie', _objectSpread({
        sort_by: 'popularity.desc'
      }, opts));
    }
  }, {
    key: "byGenre",
    value: function byGenre(genreId) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      var extra = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      return this.discover(_objectSpread({
        with_genres: genreId,
        page: page
      }, extra));
    }
  }, {
    key: "byYear",
    value: function byYear(year) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this.discover({
        primary_release_year: year,
        page: page
      });
    }

    // ── Collections / Franchises ─────────────────────────────
  }, {
    key: "collection",
    value: function collection(id) {
      return this._get("/collection/".concat(id));
    }

    // Fetch popular movies and extract unique collections from them
  }, {
    key: "popularCollections",
    value: function popularCollections() {
      var pages = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 3;
      try {
        var _this2 = this;
        var seen = new Set();
        var collections = [];
        var _p = 1;
        var _temp3 = _for(function () {
          return _p <= pages;
        }, function () {
          return _p++;
        }, function () {
          return Promise.resolve(_this2.popular(_p)).then(function (data) {
            var _iterator = _createForOfIteratorHelper(data.results),
              _step;
            try {
              for (_iterator.s(); !(_step = _iterator.n()).done;) {
                var movie = _step.value;
                if (movie.belongs_to_collection && !seen.has(movie.belongs_to_collection.id)) {
                  seen.add(movie.belongs_to_collection.id);
                  collections.push(movie.belongs_to_collection);
                }
              }
            } catch (err) {
              _iterator.e(err);
            } finally {
              _iterator.f();
            }
          });
        });
        return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(function () {
          return collections;
        }) : collections);
      } catch (e) {
        return Promise.reject(e);
      }
    } // ── TV Series ────────────────────────────────────────────
  }, {
    key: "tvTrending",
    value: function tvTrending() {
      var window = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'week';
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get("/trending/tv/".concat(window), {
        page: page
      });
    }
  }, {
    key: "tvPopular",
    value: function tvPopular() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/tv/popular', {
        page: page
      });
    }
  }, {
    key: "tvTopRated",
    value: function tvTopRated() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/tv/top_rated', {
        page: page
      });
    }
  }, {
    key: "tvAiringToday",
    value: function tvAiringToday() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/tv/airing_today', {
        page: page
      });
    }
  }, {
    key: "tvOnTheAir",
    value: function tvOnTheAir() {
      var page = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
      return this._get('/tv/on_the_air', {
        page: page
      });
    }
  }, {
    key: "tvGenres",
    value: function tvGenres() {
      return this._get('/genre/tv/list');
    }
  }, {
    key: "tvDiscover",
    value: function tvDiscover() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      return this._get('/discover/tv', _objectSpread({
        sort_by: 'popularity.desc'
      }, opts));
    }
  }, {
    key: "tvDetails",
    value: function tvDetails(id) {
      return this._get("/tv/".concat(id), {
        append_to_response: 'credits,videos,similar'
      });
    }
  }, {
    key: "tvSeason",
    value: function tvSeason(id, seasonNumber) {
      return this._get("/tv/".concat(id, "/season/").concat(seasonNumber));
    }
  }, {
    key: "tvRecommendations",
    value: function tvRecommendations(id) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get("/tv/".concat(id, "/recommendations"), {
        page: page
      });
    }

    // ── Search ───────────────────────────────────────────────
  }, {
    key: "search",
    value: function search(query) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get('/search/movie', {
        query: query,
        page: page
      });
    }
  }, {
    key: "searchTv",
    value: function searchTv(query) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get('/search/tv', {
        query: query,
        page: page
      });
    }
  }, {
    key: "searchMulti",
    value: function searchMulti(query) {
      var page = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      return this._get('/search/multi', {
        query: query,
        page: page
      });
    }

    // ── Images ───────────────────────────────────────────────
  }, {
    key: "img",
    value: function img(path) {
      var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Config.IMG.POSTER_MD;
      if (!path) return '';
      return "".concat(Config.TMDB_IMG, "/").concat(size).concat(path);
    }
  }, {
    key: "backdrop",
    value: function backdrop(path) {
      var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Config.IMG.BACKDROP_LG;
      if (!path) return '';
      return "".concat(Config.TMDB_IMG, "/").concat(size).concat(path);
    }

    // ── Helpers ──────────────────────────────────────────────
  }, {
    key: "ratingColor",
    value: function ratingColor(vote) {
      if (vote >= 7.5) return '#4ade80';
      if (vote >= 6) return '#facc15';
      return '#f87171';
    }
  }, {
    key: "formatRuntime",
    value: function formatRuntime(min) {
      if (!min) return '';
      var h = Math.floor(min / 60);
      var m = min % 60;
      return h > 0 ? "".concat(h, "h ").concat(m, "m") : "".concat(m, "m");
    }
  }]);
}();
var TMDB = new TMDBClient();