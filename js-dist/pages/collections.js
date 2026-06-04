"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
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
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
var CollectionsPage = function () {
  // ── Main page (grid of collections) ────────────────────
  var render = function render(container) {
    try {
      function _temp6() {
        function _temp4() {
          Nav.reset(container);
        }
        var _temp3 = _catch(function () {
          return Promise.resolve(TMDB.popularCollections(2)).then(function (discovered) {
            var row = document.getElementById('col-discovered');
            var _temp2 = function () {
              if (row) {
                return Promise.resolve(Promise.all(discovered.slice(0, 10).map(function (c) {
                  return TMDB.collection(c.id).catch(function () {
                    return _objectSpread(_objectSpread({}, c), {}, {
                      parts: []
                    });
                  });
                }))).then(function (enriched) {
                  row.innerHTML = enriched.map(collectionCard).join('');
                  row.querySelectorAll('[data-collection-id]').forEach(bindCollectionClicks);
                });
              }
            }();
            if (_temp2 && _temp2.then) return _temp2.then(function () {});
          });
        }, function (err) {
          console.error('Discovered collections error:', err);
        });
        // Discover collections from popular movies
        return _temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3);
      }
      container.innerHTML = "\n      <div id=\"collections-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">Collections &amp; Sequels</h1>\n          <p class=\"page-subtitle\">Browse movie franchises and film series</p>\n        </div>\n\n        <section class=\"section\">\n          <div class=\"section-header\">\n            <h2 class=\"section-title\">Popular <span>Franchises</span></h2>\n          </div>\n          <div class=\"card-row\" data-scroll id=\"col-seeded\">\n            ".concat(Array.from({
        length: 8
      }, function () {
        return "<div class=\"collection-card\"><div class=\"collection-backdrop skeleton\"></div>\n               <div class=\"collection-info\"><div class=\"skeleton\" style=\"height:14px;width:70%;border-radius:4px;\"></div></div>\n              </div>";
      }).join(''), "\n          </div>\n        </section>\n\n        <section class=\"section\">\n          <div class=\"section-header\">\n            <h2 class=\"section-title\">Discovered from <span>Popular Movies</span></h2>\n          </div>\n          <div class=\"card-row\" data-scroll id=\"col-discovered\">\n            ").concat(Array.from({
        length: 8
      }, function () {
        return "<div class=\"collection-card\"><div class=\"collection-backdrop skeleton\"></div>\n               <div class=\"collection-info\"><div class=\"skeleton\" style=\"height:14px;width:70%;border-radius:4px;\"></div></div>\n              </div>";
      }).join(''), "\n          </div>\n        </section>\n      </div>");
      function bindCollectionClicks(el) {
        el.addEventListener('click', function () {
          var id = el.dataset.collectionId;
          if (id) renderDetail(container, parseInt(id));
        });
      }

      // Load seeded collections
      Nav.reset(container);
      var _temp5 = _catch(function () {
        return Promise.resolve(Promise.all(SEED_COLLECTION_IDS.slice(0, 12).map(function (id) {
          return TMDB.collection(id).catch(function () {
            return null;
          });
        }))).then(function (seeded) {
          var valid = seeded.filter(Boolean);
          var row = document.getElementById('col-seeded');
          if (row) {
            row.innerHTML = valid.map(collectionCard).join('');
            row.querySelectorAll('[data-collection-id]').forEach(bindCollectionClicks);
          }
        });
      }, function (err) {
        console.error('Seeded collections error:', err);
      });
      return Promise.resolve(_temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Render collection detail (all movies in a franchise) ─
  var renderDetail = function renderDetail(container, collectionId) {
    try {
      container.innerHTML = "\n      <div id=\"collection-detail\">\n        <div class=\"page-header\" style=\"display:flex;align-items:center;gap:16px;\">\n          <button class=\"btn btn-secondary\" id=\"col-back\" data-nav data-nav-default tabindex=\"0\" style=\"padding:10px 18px;\">\n            \u2190 Back\n          </button>\n          <div>\n            <h1 class=\"page-title\" id=\"col-title\">Loading...</h1>\n            <p class=\"page-subtitle\" id=\"col-subtitle\"></p>\n          </div>\n        </div>\n        <div id=\"col-hero\" style=\"position:relative;height:300px;overflow:hidden;background:#0f0f1c;\">\n          <div class=\"skeleton\" style=\"width:100%;height:100%;\"></div>\n        </div>\n        <section class=\"section\">\n          <div class=\"section-header\">\n            <h2 class=\"section-title\">Films in this Collection</h2>\n          </div>\n          <div class=\"card-row\" data-scroll id=\"col-movies\">\n            ".concat(Array.from({
        length: 6
      }, function () {
        return "<div class=\"card\"><div class=\"card-poster skeleton\"></div></div>";
      }).join(''), "\n          </div>\n        </section>\n      </div>");
      document.getElementById('col-back').addEventListener('click', function () {
        render(container);
      });
      Nav.reset(container);
      var _temp = _catch(function () {
        return Promise.resolve(TMDB.collection(collectionId)).then(function (col) {
          document.getElementById('col-title').textContent = col.name;
          document.getElementById('col-subtitle').textContent = "".concat(col.parts.length, " films \xB7 ").concat(col.overview ? col.overview.slice(0, 120) + '...' : '');
          var hero = document.getElementById('col-hero');
          if (col.backdrop_path) {
            hero.innerHTML = "\n          <img src=\"".concat(TMDB.backdrop(col.backdrop_path), "\" style=\"width:100%;height:100%;object-fit:cover;\" loading=\"lazy\">\n          <div style=\"position:absolute;inset:0;background:linear-gradient(to top,rgba(9,9,15,1) 0%,transparent 60%);\"></div>");
          }
          var sorted = _toConsumableArray(col.parts).sort(function (a, b) {
            return (a.release_date || '').localeCompare(b.release_date || '');
          });
          var moviesRow = document.getElementById('col-movies');
          moviesRow.innerHTML = sorted.map(function (m, i) {
            return movieCard(m, i);
          }).join('');
          moviesRow.querySelectorAll('[data-movie-id]').forEach(function (el) {
            el.addEventListener('click', function () {
              App.navigate('player', {
                id: el.dataset.movieId,
                type: 'movie'
              });
            });
          });
          Nav.reset(container);
        });
      }, function (err) {
        console.error('Collection detail error:', err);
      });
      return Promise.resolve(_temp && _temp.then ? _temp.then(function () {}) : void 0);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // Curated list of well-known collection IDs to seed the page
  var SEED_COLLECTION_IDS = [10, 119, 131292, 86311, 528,
  // Star Wars, LotR, Avengers, Toy Story, Spider-Man
  9485, 295130, 645, 87359,
  // Fast & Furious, Jurassic World, James Bond, Mission Impossible
  263, 1241, 748, 304378,
  // Dark Knight, Harry Potter, Indiana Jones, IT
  556, 87096, 9767, 284433,
  // Pirates, X-Men, Alien, Thor
  131295, 1570, 8945, 121938 // Hunger Games, John Wick, Terminator, Shrek
  ];
  var _collectionDetail = null; // when browsing a specific collection

  // ── Collection card ────────────────────────────────────
  function collectionCard(col) {
    var backdrop = col.backdrop_path ? TMDB.img(col.backdrop_path, Config.IMG.BACKDROP_MD) : col.poster_path ? TMDB.img(col.poster_path, Config.IMG.POSTER_LG) : '';
    var count = col.parts ? col.parts.length : '';
    return "\n      <div class=\"collection-card\" data-nav data-collection-id=\"".concat(col.id, "\" tabindex=\"0\">\n        ").concat(backdrop ? "<img class=\"collection-backdrop\" src=\"".concat(backdrop, "\" alt=\"").concat(col.name, "\" loading=\"lazy\">") : "<div class=\"collection-backdrop skeleton\"></div>", "\n        <div class=\"collection-info\">\n          <div class=\"collection-name\">").concat(col.name || '', "</div>\n          ").concat(count ? "<div class=\"collection-count\">".concat(count, " ").concat(count === 1 ? 'film' : 'films', "</div>") : '', "\n        </div>\n      </div>");
  }

  // ── Movie card inside a collection ─────────────────────
  function movieCard(movie, index) {
    var poster = movie.poster_path ? TMDB.img(movie.poster_path, Config.IMG.POSTER_MD) : '';
    var rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    return "\n      <div class=\"card\" data-nav data-movie-id=\"".concat(movie.id, "\" tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster ? "<img src=\"".concat(poster, "\" alt=\"").concat(movie.title, "\" loading=\"lazy\">") : "<div class=\"no-img\">\uD83C\uDFAC</div>", "\n          ").concat(rating ? "<div class=\"card-rating\">\u2605 ".concat(rating, "</div>") : '', "\n          <div style=\"position:absolute;top:10px;left:10px;background:#7c3aed;\n            color:#fff;font-size:11px;font-weight:800;padding:4px 8px;\">\n            #").concat(index + 1, "\n          </div>\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n        </div>\n      </div>");
  }
  function onLeave() {}
  return {
    render: render,
    onLeave: onLeave
  };
}();