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
var PlayerPage = function () {
  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  var _render = function render(container) {
    var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    try {
      _params = params;
      _currentSeason = parseInt(params.season || 1);
      _currentEpisode = parseInt(params.episode || 1);
      _activeSourceIdx = 0;
      _seriesDetails = null;
      _availableQualities = [];
      _qualityHeaders = null;
      _resumePos = 0;
      _streamErrorRetries = 0;
      var isTV = params.type === 'tv';
      var modal = document.getElementById('player-modal');
      if (!modal) return Promise.resolve();
      stopAvPlay();
      modal.classList.remove('hidden');
      modal.innerHTML = "\n      <div class=\"player-header\" style=\"".concat(isTV ? 'margin-right:300px;' : 'margin-right:240px;', "\">\n        <button class=\"player-back btn btn-secondary\" data-nav tabindex=\"0\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"16\" height=\"16\">\n            <path d=\"M19 12H5M12 5l-7 7 7 7\"/>\n          </svg>\n          Back\n        </button>\n      </div>\n\n      <div style=\"position:relative;display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex:1;flex:1;overflow:hidden;background:transparent;\">\n        <div id=\"avplay-area\" style=\"-webkit-flex:1;flex:1;min-width:0;background:transparent;position:relative;\">\n          <div id=\"player-status\" class=\"player-status-overlay\">Loading...</div>\n        </div>\n        ").concat(isTV ? "<div id=\"episode-panel\" class=\"episode-panel\"></div>" : "<div id=\"similar-slot\"></div>", "\n      </div>\n\n      <div class=\"player-cbar\" id=\"player-cbar\" style=\"").concat(isTV ? 'right:300px;' : 'right:240px;', "\">\n        <!-- Row 1 (top): controls centered + quality far right -->\n        <div class=\"player-cbar-row2\">\n          <div class=\"player-cbar-btns\">\n            ").concat(isTV ? "<button class=\"pcb-btn\" id=\"ctrl-prev\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M6 6h2v12H6zm3.5 6l8.5 6V6z\"/></svg>\n              <span>Prev</span></button>" : '', "\n            <button class=\"pcb-btn\" id=\"ctrl-rw\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z\"/></svg>\n              <span>-10s</span></button>\n            <button class=\"pcb-btn pcb-play\" id=\"ctrl-play\" data-nav tabindex=\"0\">\n              <svg id=\"ctrl-play-icon\" viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"26\" height=\"26\"><path d=\"M8 5v14l11-7z\"/></svg>\n            </button>\n            <button class=\"pcb-btn\" id=\"ctrl-ff\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z\"/></svg>\n              <span>+30s</span></button>\n            ").concat(isTV ? "<button class=\"pcb-btn\" id=\"ctrl-next\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M6 18l8.5-6L6 6v12zm2.5-6l8.5 6V6l-8.5 6z\"/><rect x=\"16\" y=\"6\" width=\"2\" height=\"12\"/></svg>\n              <span>Next</span></button>" : '', "\n          </div>\n          <div id=\"quality-dd-wrap\" class=\"player-cbar-quality\">\n            ").concat(TVDropdown.html('quality-dd', [{
        value: 'auto',
        label: 'Auto'
      }], 'auto'), "\n          </div>\n        </div>\n        <!-- Row 2 (bottom): progress track (seekable) + time -->\n        <div class=\"player-cbar-row1\">\n          <div class=\"player-cbar-track\" id=\"seek-track\" data-nav tabindex=\"0\" title=\"Left/Right to seek\">\n            <div id=\"progress-fill\" class=\"player-cbar-fill\"></div>\n          </div>\n          <span id=\"player-time\" class=\"player-cbar-time\">0:00 / 0:00</span>\n        </div>\n      </div>\n\n      <div class=\"player-info-bar\" style=\"").concat(isTV ? 'margin-right:300px;' : 'margin-right:240px;', "\">\n        <div style=\"-webkit-flex:1;flex:1;min-width:0;\">\n          <div class=\"player-title\" id=\"player-title\">Loading...</div>\n          <div class=\"player-meta\" id=\"player-meta\"></div>\n        </div>\n      </div>");
      modal.querySelector('.player-back').addEventListener('click', closePlayer);
      TVDropdown.mount('quality-dd', function (val) {
        var qi = parseInt(val);
        var q = _availableQualities && _availableQualities[qi];
        if (!q) return;
        try {
          localStorage.setItem('np_pref_quality', q.label);
        } catch (e) {}
        _resumePos = capturePos();
        var hdrs = (_qualityHeaders && Object.keys(_qualityHeaders).length) ? _qualityHeaders : {
          'Referer': 'https://cineby.sc/',
          'Origin': 'https://cineby.sc'
        };
        stopAvPlay();
        setPlayerStatus('Switching quality...');
        playWithUrl(q.url, hdrs);
      });
      startMediaKeys(); // active immediately on modal open

      // Wire media control buttons
      var rwBtn = document.getElementById('ctrl-rw');
      var playBtn = document.getElementById('ctrl-play');
      var ffBtn = document.getElementById('ctrl-ff');
      if (rwBtn) rwBtn.addEventListener('click', function () {
        seekRelative(-10000);
        showPlayerUI();
      });
      if (playBtn) playBtn.addEventListener('click', function () {
        togglePlayPause();
      });
      if (ffBtn) ffBtn.addEventListener('click', function () {
        seekRelative(30000);
        showPlayerUI();
      });
      var prevBtn = document.getElementById('ctrl-prev');
      var nextBtn = document.getElementById('ctrl-next');
      if (prevBtn) prevBtn.addEventListener('click', function () {
        goPrevEpisode();
        showPlayerUI();
      });
      if (nextBtn) nextBtn.addEventListener('click', function () {
        goNextEpisode();
        showPlayerUI();
      });
      Nav.reset(modal);
      loadBestSource();
      var _temp7 = function () {
        if (params.id) {
          var _temp6 = _catch(function () {
            function _temp5() {
              Nav.reset(modal);
            }
            var _temp4 = function () {
              if (isTV) {
                return Promise.resolve(Promise.all([TMDB.tvDetails(parseInt(params.id)), buildEpisodePanel(parseInt(params.id))])).then(function (_ref) {
                  var _ref2 = _slicedToArray(_ref, 1),
                    details = _ref2[0];
                  // Cache for progress tracking
                  _titleCache = details.name || '';
                  _posterCache = details.poster_path ? TMDB.img(details.poster_path, Config.IMG.POSTER_SM) : '';
                  var titleEl = document.getElementById('player-title');
                  var metaEl = document.getElementById('player-meta');
                  if (titleEl) titleEl.textContent = details.name || '';
                  if (metaEl) {
                    var year = (details.first_air_date || '').slice(0, 4);
                    var rating = details.vote_average ? "* ".concat(details.vote_average.toFixed(1)) : '';
                    var genres = (details.genres || []).slice(0, 3).map(function (g) {
                      return g.name;
                    }).join(' . ');
                    var seasons = details.number_of_seasons ? "".concat(details.number_of_seasons, " seasons") : '';
                    metaEl.textContent = [year, seasons, rating, genres].filter(Boolean).join('  |  ');
                  }
                  var similarSlot = document.getElementById('similar-slot');
                  if (similarSlot && details.similar && details.similar.results && details.similar.results.length) {
                    similarSlot.outerHTML = buildSimilarPanel(details.similar.results, 'tv');
                    document.querySelectorAll('.similar-item').forEach(function (el) {
                      el.addEventListener('click', function () {
                        return _render(container, {
                          id: el.dataset.id,
                          type: el.dataset.type,
                          season: 1,
                          episode: 1
                        });
                      });
                    });
                  }
                });
              } else {
                return Promise.resolve(TMDB.details(parseInt(params.id))).then(function (details) {
                  // Cache for progress tracking
                  _titleCache = details.title || '';
                  _posterCache = details.poster_path ? TMDB.img(details.poster_path, Config.IMG.POSTER_SM) : '';
                  var titleEl = document.getElementById('player-title');
                  var metaEl = document.getElementById('player-meta');
                  if (titleEl) titleEl.textContent = details.title || '';
                  if (metaEl) {
                    var year = (details.release_date || '').slice(0, 4);
                    var rating = details.vote_average ? "* ".concat(details.vote_average.toFixed(1)) : '';
                    var runtime = details.runtime ? TMDB.formatRuntime(details.runtime) : '';
                    var genres = (details.genres || []).slice(0, 3).map(function (g) {
                      return g.name;
                    }).join(' . ');
                    metaEl.textContent = [year, runtime, rating, genres].filter(Boolean).join('  |  ');
                  }
                  var similarSlot = document.getElementById('similar-slot');
                  if (similarSlot) {
                    if (_params.playlist === 'watchlist' && typeof NexPlayDB !== 'undefined') {
                      // Show watchlist as playlist sidebar
                      var wlItems = NexPlayDB.getWatchlist();
                      if (wlItems.length) {
                        similarSlot.outerHTML = buildWatchlistPanel(wlItems, _params.id, _params.type || 'movie');
                        document.querySelectorAll('.similar-item').forEach(function (el) {
                          el.addEventListener('click', function () {
                            _render(container, {
                              id: el.dataset.id,
                              type: el.dataset.type || 'movie',
                              season: 1,
                              episode: 1,
                              playlist: 'watchlist'
                            });
                          });
                        });
                      }
                    } else if (details.similar && details.similar.results && details.similar.results.length) {
                      similarSlot.outerHTML = buildSimilarPanel(details.similar.results, 'movie');
                      document.querySelectorAll('.similar-item').forEach(function (el) {
                        el.addEventListener('click', function () {
                          _render(container, {
                            id: el.dataset.id,
                            type: 'movie'
                          });
                        });
                      });
                    }
                  }
                });
              }
            }();
            return _temp4 && _temp4.then ? _temp4.then(_temp5) : _temp5(_temp4);
          }, function (err) {
            console.error('Player metadata error:', err);
          });
          if (_temp6 && _temp6.then) return _temp6.then(function () {});
        }
      }();
      return Promise.resolve(_temp7 && _temp7.then ? _temp7.then(function () {}) : void 0);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var loadEpisodes = function loadEpisodes(seasonNumber) {
    try {
      var list = document.getElementById('episode-list');
      if (!list) return Promise.resolve();
      var _temp3 = _catch(function () {
        return Promise.resolve(TMDB.tvSeason(_params.id, seasonNumber)).then(function (season) {
          var episodes = season.episodes || [];
          list.innerHTML = episodes.map(function (ep) {
            var still = ep.still_path ? TMDB.img(ep.still_path, Config.IMG.POSTER_SM) : '';
            var active = ep.episode_number === _currentEpisode ? 'active' : '';
            return "\n          <div class=\"episode-item ".concat(active, "\" data-nav data-ep=\"").concat(ep.episode_number, "\" tabindex=\"0\">\n            <div class=\"ep-thumb\">\n              ").concat(still ? "<img src=\"".concat(still, "\" alt=\"Ep ").concat(ep.episode_number, "\" loading=\"lazy\">") : "<div class=\"ep-thumb-placeholder\">></div>", "\n              <div class=\"ep-num-badge\">").concat(ep.episode_number, "</div>\n            </div>\n            <div class=\"ep-info\">\n              <div class=\"ep-title\">").concat(ep.name || "Episode ".concat(ep.episode_number), "</div>\n              <div class=\"ep-meta\">").concat(ep.runtime ? ep.runtime + 'm' : '', "</div>\n            </div>\n          </div>");
          }).join('');
          list.querySelectorAll('[data-ep]').forEach(function (el) {
            el.addEventListener('click', function () {
              _currentEpisode = parseInt(el.dataset.ep);
              list.querySelectorAll('[data-ep]').forEach(function (e) {
                return e.classList.remove('active');
              });
              el.classList.add('active');
              loadBestSource();
            });
          });
          Nav.reset(document.getElementById('player-modal'));
        });
      }, function () {
        list.innerHTML = "<div class=\"error-msg\" style=\"font-size:13px;\">Could not load episodes</div>";
      });
      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(function () {}) : void 0);
    } catch (e) {
      return Promise.reject(e);
    }
  }; // ── Go to next item in watchlist playlist ──────────────
  // â"€â"€ TV Episode panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  var buildEpisodePanel = function buildEpisodePanel(seriesId) {
    try {
      var _exit = false;
      function _temp2(_result) {
        if (_exit) return _result;
        var seasons = (_seriesDetails.seasons || []).filter(function (s) {
          return s.season_number > 0;
        });
        if (!seasons.length) {
          panel.innerHTML = '';
          return;
        }
        var seasonOptions = seasons.map(function (s) {
          return {
            value: String(s.season_number),
            label: "Season ".concat(s.season_number, "  (").concat(s.episode_count, " eps)")
          };
        });
        panel.innerHTML = "\n      <div class=\"ep-panel-header\">\n        ".concat(TVDropdown.html('season-dd', seasonOptions, String(_currentSeason)), "\n      </div>\n      <div class=\"episode-list\" id=\"episode-list\" data-scroll>\n        <div style=\"padding:12px;text-align:center;color:rgba(240,240,248,0.45);\">Loading...</div>\n      </div>");
        TVDropdown.mount('season-dd', function (v) {
          _currentSeason = parseInt(v);
          _currentEpisode = 1;
          loadEpisodes(_currentSeason);
          loadBestSource();
        });
        loadEpisodes(_currentSeason);
      }
      var panel = document.getElementById('episode-panel');
      if (!panel) return Promise.resolve();
      var _temp = _catch(function () {
        return Promise.resolve(TMDB.tvDetails(seriesId)).then(function (_TMDB$tvDetails) {
          _seriesDetails = _TMDB$tvDetails;
        });
      }, function () {
        panel.innerHTML = '';
        _exit = true;
      });
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var SOURCES = [{
    id: '2embed',
    label: 'Source 1',
    movieUrl: function movieUrl(id) {
      return "https://www.2embed.cc/embed/".concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "https://www.2embed.cc/embedtv/".concat(id, "&s=").concat(s, "&e=").concat(e);
    }
  }, {
    id: 'vsembed',
    label: 'Source 2',
    movieUrl: function movieUrl(id) {
      return "".concat(Config.VSEMBED_BASE, "/embed/movie?tmdb=").concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "".concat(Config.VSEMBED_BASE, "/embed/tv?tmdb=").concat(id, "&season=").concat(s, "&episode=").concat(e);
    }
  }, {
    id: 'vidsrc-me',
    label: 'Source 3',
    movieUrl: function movieUrl(id) {
      return "https://vidsrc.me/embed/movie?tmdb=".concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "https://vidsrc.me/embed/tv?tmdb=".concat(id, "&season=").concat(s, "&episode=").concat(e);
    }
  }, {
    id: 'vidsrc',
    label: 'Source 4',
    movieUrl: function movieUrl(id) {
      return "https://vidsrc.to/embed/movie/".concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "https://vidsrc.to/embed/tv/".concat(id, "/").concat(s, "/").concat(e);
    }
  }];
  var _params = {};
  var _activeSourceIdx = 0;
  var _currentSeason = 1;
  var _currentEpisode = 1;
  var _seriesDetails = null;
  var _availableQualities = [];
  var _hlsInstance = null; // active hls.js instance — must be destroyed before swapping streams

  // ── Player UI auto-hide + progress tracking ───────────
  var _hideTimer = null,
    _uiHidden = false,
    _keyListener2 = null;
  var _progressInterval = null,
    _titleCache = '',
    _posterCache = '',
    _durationMs = 0;

  // ── Quality switching state ────────────────────────────
  var _resumePos = 0; // ms to seek to after a quality switch
  var _qualityHeaders = null; // headers from the resolved stream — reused on quality change
  var _streamErrorRetries = 0; // re-resolution attempts before falling back to embed scraping

  function showPlayerUI() {
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.remove('player-ui-hidden');
    _uiHidden = false;
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
    // Focus the relevant panel: episodes for series, suggestions for movies
    setTimeout(function () {
      var ep = document.querySelector('#episode-list .episode-item');
      var sim = document.querySelector('#similar-panel .similar-item');
      var btn = document.querySelector('.player-back');
      if (ep) Nav.focusEl(ep);else if (sim) Nav.focusEl(sim);else if (btn) Nav.focusEl(btn);
    }, 80);
  }
  function hidePlayerUI() {
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('player-ui-hidden');
    _uiHidden = true;
  }
  var PLAY_PATH = 'M8 5v14l11-7z';
  var PAUSE_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
  function updatePlayIcon(playing) {
    var icon = document.getElementById('ctrl-play-icon');
    if (!icon) return;
    var path = icon.querySelector('path');
    if (path) path.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
  }
  function formatTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    var h = Math.floor(m / 60);
    m = m % 60;
    return h > 0 ? h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s : m + ':' + (s < 10 ? '0' : '') + s;
  }
  function updateProgress() {
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try {
      var pos = webapis.avplay.getCurrentTime();
      var dur = _durationMs || 1;
      var pct = Math.min(100, pos / dur * 100).toFixed(1);
      var fill = document.getElementById('progress-fill');
      var time = document.getElementById('player-time');
      if (fill) fill.style.width = pct + '%';
      if (time) time.textContent = formatTime(pos) + ' / ' + formatTime(dur);
    } catch (e) {}
  }
  function togglePlayPause() {
    // Web fallback (video element)
    var video = document.getElementById('web-video');
    if (video) {
      if (video.paused) {
        video.play();
        updatePlayIcon(true);
        setPlayerStatus('');
      } else {
        video.pause();
        updatePlayIcon(false);
        setPlayerStatus('Paused');
      }
      return;
    }
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try {
      var s = webapis.avplay.getState();
      if (s === 'PLAYING') {
        webapis.avplay.pause();
        updatePlayIcon(false);
        setPlayerStatus('Paused');
      } else if (s === 'PAUSED') {
        webapis.avplay.play();
        updatePlayIcon(true);
        setPlayerStatus('');
      }
    } catch (e) {}
  }
  function seekRelative(ms) {
    // Web fallback
    var video = document.getElementById('web-video');
    if (video) {
      video.currentTime = Math.max(0, video.currentTime + ms / 1000);
      return;
    }
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try {
      webapis.avplay.seekTo(Math.max(0, webapis.avplay.getCurrentTime() + ms));
    } catch (e) {
      setPlayerStatus('Seek not available for this stream');
      setTimeout(function () { setPlayerStatus(''); }, 2000);
    }
  }
  function goNextEpisode() {
    if (_params.type !== 'tv') return;
    // Find next episode in the list
    var list = document.getElementById('episode-list');
    if (!list) return;
    var items = list.querySelectorAll('[data-ep]');
    var found = false;
    for (var i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.ep) === _currentEpisode) {
        if (i + 1 < items.length) {
          items[i + 1].click();
        }
        found = true;
        break;
      }
    }
    if (!found && items.length > 0) items[0].click();
  }
  function goPrevEpisode() {
    if (_params.type !== 'tv') return;
    var list = document.getElementById('episode-list');
    if (!list) return;
    var items = list.querySelectorAll('[data-ep]');
    for (var i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.ep) === _currentEpisode) {
        if (i > 0) items[i - 1].click();
        break;
      }
    }
  }
  function startAutoHide() {
    stopAutoHide(); // always tear down any stale listener before creating a new one
    stopMediaKeys(); // hand off from buffering listener to full player listener
    _keyListener2 = function _keyListener(e) {
      // Self-clean if player modal is no longer visible
      var _modal = document.getElementById('player-modal');
      if (!_modal || _modal.classList.contains('hidden')) {
        document.removeEventListener('keydown', _keyListener2, true);
        _keyListener2 = null;
        return;
      }
      var k = e.keyCode;

      // ── Media keys work regardless of UI visibility ─────
      if (k === Config.KEYS.PLAY || k === Config.KEYS.PLAY_PAUSE || k === 415 || k === 10252) {
        togglePlayPause();
        e.stopPropagation();
        e.preventDefault();
        showPlayerUI();
        return;
      }
      if (k === Config.KEYS.PAUSE || k === 19) {
        togglePlayPause();
        e.stopPropagation();
        e.preventDefault();
        showPlayerUI();
        return;
      }
      if (k === Config.KEYS.FF || k === 417) {
        seekRelative(30000);
        e.stopPropagation();
        e.preventDefault();
        showPlayerUI();
        return;
      }
      if (k === Config.KEYS.RW || k === 412) {
        seekRelative(-10000);
        e.stopPropagation();
        e.preventDefault();
        showPlayerUI();
        return;
      }
      if (k === Config.KEYS.STOP || k === 413) {
        e.stopPropagation();
        e.preventDefault();
        closePlayer();
        return;
      }

      // ── Seek via LEFT/RIGHT when progress track is focused ──────
      var focusedEl = document.querySelector('.nav-focused');
      var onTrack = focusedEl && focusedEl.id === 'seek-track';
      if (onTrack && (k === 37 || k === Config.KEYS.LEFT)) {
        seekRelative(-15000);
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (onTrack && (k === 39 || k === Config.KEYS.RIGHT)) {
        seekRelative(15000);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // ── Enter: allow on Back, control buttons and dropdown elements ─
      if (k === Config.KEYS.ENTER || k === 13) {
        var focused = document.querySelector('.nav-focused');
        var isBack = focused && focused.classList.contains('player-back');
        var isCtrl = focused && focused.classList.contains('ctrl-btn');
        var isTrigger = focused && focused.hasAttribute('data-tdd-trigger');
        var isDDOpt = focused && focused.hasAttribute('data-tdd-opt');
        var isPanel = focused && (focused.classList.contains('episode-item') || focused.classList.contains('similar-item'));
        if (!isBack && !isCtrl && !isTrigger && !isDDOpt && !isPanel) {
          if (_uiHidden) showPlayerUI();
          e.stopPropagation();
          e.preventDefault();
          if (_hideTimer) clearTimeout(_hideTimer);
          _hideTimer = setTimeout(hidePlayerUI, 4000);
          return;
        }
        // let Enter propagate so the click fires
      }

      // ── All other keys: show UI if hidden ────────────────
      if (_uiHidden) {
        showPlayerUI();
        e.stopPropagation();
        return;
      }

      // UI visible — reset timer
      if (_hideTimer) clearTimeout(_hideTimer);
      _hideTimer = setTimeout(hidePlayerUI, 4000);
    };
    document.addEventListener('keydown', _keyListener2, true);
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
  }
  function stopAutoHide() {
    if (_keyListener2) {
      document.removeEventListener('keydown', _keyListener2, true);
      _keyListener2 = null;
    }
    if (_hideTimer) {
      clearTimeout(_hideTimer);
      _hideTimer = null;
    }
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.remove('player-ui-hidden');
    _uiHidden = false;
  }

  // ── Persistent media-key listener (active from modal open, not stream start) ──
  // Works even while stream is still loading / buffering
  var _mediaKeyListener2 = null;
  function startMediaKeys() {
    if (_mediaKeyListener2) return;
    _mediaKeyListener2 = function _mediaKeyListener(e) {
      var k = e.keyCode;
      var modal = document.getElementById('player-modal');
      if (!modal || modal.classList.contains('hidden')) {
        document.removeEventListener('keydown', _mediaKeyListener2, true);
        _mediaKeyListener2 = null;
        return;
      }
      if (k === 415 || k === 10252 || k === Config.KEYS.PLAY || k === Config.KEYS.PLAY_PAUSE) {
        togglePlayPause();
        showPlayerUI();
        e.stopPropagation();
        e.preventDefault();
      } else if (k === 19 || k === Config.KEYS.PAUSE) {
        togglePlayPause();
        showPlayerUI();
        e.stopPropagation();
        e.preventDefault();
      } else if (k === 417 || k === Config.KEYS.FF) {
        seekRelative(30000);
        showPlayerUI();
        e.stopPropagation();
        e.preventDefault();
      } else if (k === 412 || k === Config.KEYS.RW) {
        seekRelative(-10000);
        showPlayerUI();
        e.stopPropagation();
        e.preventDefault();
      } else if (k === 413 || k === Config.KEYS.STOP) {
        e.stopPropagation();
        e.preventDefault();
        closePlayer();
      }
    };
    document.addEventListener('keydown', _mediaKeyListener2, true);
  }
  function stopMediaKeys() {
    if (_mediaKeyListener2) {
      document.removeEventListener('keydown', _mediaKeyListener2, true);
      _mediaKeyListener2 = null;
    }
  }

  // ── AVPlay helpers ────────────────────────────────────
  function stopAvPlay() {
    // Save final position before stopping
    if (_progressInterval) {
      clearInterval(_progressInterval);
      _progressInterval = null;
    }
    // Destroy hls.js instance so segments stop loading and no stale events fire.
    if (_hlsInstance) {
      try {
        _hlsInstance.destroy();
      } catch (e) {}
      _hlsInstance = null;
    }
    if (typeof NexPlayDB !== 'undefined' && typeof webapis !== 'undefined' && webapis.avplay) {
      try {
        var pos = webapis.avplay.getCurrentTime();
        if (pos > 0) {
          NexPlayDB.saveProgress(_params.id, _params.type || 'movie', _titleCache, _posterCache, pos, _durationMs, _currentSeason, _currentEpisode);
        }
      } catch (e) {}
    }
    try {
      if (typeof webapis !== 'undefined' && webapis.avplay) {
        var state = webapis.avplay.getState();
        if (state === 'PLAYING' || state === 'PAUSED' || state === 'READY') {
          webapis.avplay.stop();
        }
        if (state !== 'NONE' && state !== 'IDLE') {
          webapis.avplay.close();
        }
      }
    } catch (e) {}
    document.documentElement.style.background = '';
    document.body.style.background = '';
    document.body.classList.remove('movie-avplay-on');
  }
  function setPlayerStatus(msg) {
    var el = document.getElementById('player-status');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  // Iframe embed state — tracks which source is active across switches
  var _embedSourceList = [];
  var _embedSourceIdx = 0;
  function showIframeEmbed(embedUrl) {
    // Web fallback only — TV uses AVPlay which cannot render iframes.
    if (typeof webapis !== 'undefined' && webapis.avplay) return;
    var area = document.getElementById('avplay-area');
    if (!area) return;
    var srcLabel = _embedSourceList[_embedSourceIdx] ? _embedSourceList[_embedSourceIdx].label : 'Embed';
    var hasNext = _embedSourceIdx < _embedSourceList.length - 1;

    // Sandbox prevents iframes from navigating the parent page.
    // 2embed/vsembed are sandbox-safe; vidsrc.me/vidsrc.to need it to not redirect.
    area.innerHTML = '<iframe id="embed-frame" src="' + embedUrl + '" allowfullscreen frameborder="0"' + ' allow="autoplay; fullscreen; encrypted-media; picture-in-picture"' + ' sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"' + ' style="width:100%;height:100%;border:none;background:#000;"></iframe>' +
    // Play overlay — click is a user gesture, enabling iframe autoplay
    '<div id="embed-play-btn" class="ctrl-btn" data-nav tabindex="0"' + ' style="position:absolute;inset:0;display:flex;flex-direction:column;' + 'align-items:center;justify-content:center;gap:16px;cursor:pointer;">' + '<div style="width:72px;height:72px;border-radius:50%;background:rgba(0,0,0,0.55);' + 'border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;">' + '<svg viewBox="0 0 24 24" fill="white" width="38" height="38"><path d="M8 5v14l11-7z"/></svg>' + '</div>' + '<span style="color:rgba(255,255,255,0.6);font-size:12px;">' + srcLabel + '</span>' + (hasNext ? '<button id="embed-next-src" class="ctrl-btn btn btn-secondary" data-nav tabindex="0"' + ' style="font-size:12px;padding:4px 14px;" onclick="event.stopPropagation()">Try next source</button>' : '') + '</div>';
    setPlayerStatus('');
    console.log('[Player] iframe embed:', embedUrl.slice(0, 80));
    var btn = document.getElementById('embed-play-btn');
    var frame = document.getElementById('embed-frame');
    var next = document.getElementById('embed-next-src');
    if (btn) btn.addEventListener('click', function () {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
      if (frame) frame.focus();
    });
    if (next) next.addEventListener('click', function (e) {
      e.stopPropagation();
      _embedSourceIdx++;
      if (_embedSourceIdx < _embedSourceList.length) {
        var src = _embedSourceList[_embedSourceIdx];
        var url = _params.type === 'tv' ? src.tvUrl(_params.id, _currentSeason, _currentEpisode) : src.movieUrl(_params.id);
        showIframeEmbed(url);
      }
    });
    startAutoHide();
    Nav.reset(document.getElementById('player-modal'));
  }
  function trySource(idx) {
    if (idx >= SOURCES.length) {
      // All direct-stream scraping failed. On web, show embed iframe fallback.
      if (typeof webapis === 'undefined' || !webapis.avplay) {
        // Order: 2embed (no redirect, sandbox-safe) → vsembed → vidsrc.me → vidsrc.to
        _embedSourceList = [SOURCES[0], SOURCES[1], SOURCES[2], SOURCES[3]].filter(Boolean);
        _embedSourceIdx = 0;
        if (_embedSourceList.length) {
          var first = _embedSourceList[0];
          showIframeEmbed(_params.type === 'tv' ? first.tvUrl(_params.id, _currentSeason, _currentEpisode) : first.movieUrl(_params.id));
        }
        return;
      }
      setPlayerStatus('Stream unavailable for this title');
      return;
    }
    _activeSourceIdx = idx;
    setPlayerStatus(idx === 0 ? 'Loading...' : 'Trying another source...');

    // Scrape the embed page to extract a direct .m3u8/.mp4 URL.
    // Falls back to iframe embed when scraping yields nothing (most dynamic players).
    var embedUrl = buildUrl(idx);
    if (typeof StreamResolver !== 'undefined' && StreamResolver.scrapeEmbed) {
      StreamResolver.scrapeEmbed(embedUrl).then(function (result) {
        if (result && result.url) {
          playWithUrl(result.url, result.headers);
        } else {
          trySource(idx + 1);
        }
      }).catch(function () {
        trySource(idx + 1);
      });
    } else {
      trySource(idx + 1);
    }
  }

  // Single proxy for both web and TV "" Cloudflare Worker handles CORS + Referer.
  var PROXY_BASE = 'https://nexplay-proxy.pielly16.workers.dev';
  function buildProxyUrl(streamUrl, headers) {
    var h = '';
    if (headers && Object.keys(headers).length) {
      try {
        h = btoa(JSON.stringify(headers));
      } catch (e) {}
    }
    return PROXY_BASE + '/?url=' + encodeURIComponent(streamUrl) + (h ? '&headers=' + encodeURIComponent(h) : '');
  }
  function playWithHlsJs(streamUrl, headers) {
    // Stream URL is already routed through the CF Worker proxy (see playWithUrl).
    // The proxy injects the correct Referer/Origin headers and rewrites all segment
    // URLs back through itself, so hls.js just loads the proxied manifest URL.
    var playUrl = streamUrl;
    console.log('[Player] playWithHlsJs via proxy:', playUrl.slice(0, 80));
    setPlayerStatus('Buffering...');

    // Destroy any existing hls.js instance so its event handlers don't fire on
    // the detached video element and spuriously call trySource() during quality switches.
    if (_hlsInstance) {
      try {
        _hlsInstance.destroy();
      } catch (e) {}
      _hlsInstance = null;
    }
    var area = document.getElementById('avplay-area');
    if (!area) return;
    area.innerHTML = '<video id="web-video" style="width:100%;height:100%;background:#000;" autoplay playsinline></video>';
    var video = document.getElementById('web-video');
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      var hls = new Hls({
        enableWorker: false,
        debug: false,
        manifestLoadingTimeOut: 120000,
        manifestLoadingMaxRetry: 3
      });
      _hlsInstance = hls;
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      var playerModal = document.getElementById('player-modal');
      if (playerModal) {
        playerModal.addEventListener('mousemove', function () {
          showPlayerUI();
        });
        playerModal.addEventListener('mouseleave', function () {
          if (_hideTimer) clearTimeout(_hideTimer);
          _hideTimer = setTimeout(hidePlayerUI, 1500);
        });
      }
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log('[Player] HLS manifest parsed, playing');
        _streamErrorRetries = 0;
        video.play().catch(function () {});
        setPlayerStatus('');
        updatePlayIcon(true);
        startAutoHide();

        // Restore position after quality switch or for continue-watching
        var hlsSeek = _resumePos;
        _resumePos = 0;
        if (!hlsSeek && typeof NexPlayDB !== 'undefined') {
          var hlsSaved = NexPlayDB.getProgress(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode);
          if (hlsSaved && hlsSaved.position > 10000) hlsSeek = hlsSaved.position;
        }
        if (hlsSeek > 10000) {
          video.currentTime = hlsSeek / 1000;
          console.log('[Player] HLS seeking to', Math.round(hlsSeek / 1000) + 's');
        }
        video.addEventListener('ended', function () {
          if (_params.playlist === 'watchlist') goNextInPlaylist();
        });
        if (_progressInterval) clearInterval(_progressInterval);
        _progressInterval = setInterval(function () {
          if (!video || video.paused) return;
          var dur = video.duration * 1000 || 1;
          var pos = video.currentTime * 1000;
          var pct = Math.min(100, pos / dur * 100).toFixed(1);
          var fill = document.getElementById('progress-fill');
          var time = document.getElementById('player-time');
          if (fill) fill.style.width = pct + '%';
          if (time) time.textContent = formatTime(pos) + ' / ' + formatTime(dur);
        }, 3000);
      });
      hls.on(Hls.Events.ERROR, function (ev, data) {
        console.error('[Player] HLS error:', data.type, data.details, data.fatal);
        if (data.fatal) {
          _streamErrorRetries++;
          if (_streamErrorRetries <= 2) {
            setPlayerStatus('Reconnecting...');
            loadBestSource();
          } else {
            _streamErrorRetries = 0;
            trySource(0);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl;
      video.play().catch(function (e) {
        console.error('[Player] Native HLS error:', e);
      });
      setPlayerStatus('');
    } else {
      setPlayerStatus('HLS not supported — try Chrome or Safari');
    }
  }
  function playWithUrl(url, headers) {
    console.log('[Player] playWithUrl:', url.slice(0, 80));
    setPlayerStatus('Loading...');

    // TV always proxies (TLS compat). Browser only proxies when headers are needed.
    // VidLink on TV uses a Deno proxy (x-via-deno flag) instead of the CF Worker
    // because VidLink CDN is on Cloudflare (CF→CF blocked) and uses TLS 1.3.
    var isTizenTV = typeof webapis !== 'undefined' && !!webapis.avplay;
    var needsProxy = isTizenTV || headers && Object.keys(headers).length > 0;
    var playUrl = needsProxy ? buildProxyUrl(url, headers) : url;
    if (typeof webapis === 'undefined' || !webapis.avplay) {
      playWithHlsJs(playUrl, headers);
      return;
    }

    // TV: AVPlay always via proxy (TLS compat)
    console.log('[Player] AVPlay via proxy:', playUrl.slice(0, 80));
    try {
      var s = webapis.avplay.getState();
      if (s === 'PLAYING' || s === 'PAUSED' || s === 'READY') webapis.avplay.stop();
      if (s !== 'NONE' && s !== 'IDLE') webapis.avplay.close();
      webapis.avplay.open(playUrl);
      webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
      // Clear html/body backgrounds so AVPlay layer shows through
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.body.classList.add('movie-avplay-on');
      webapis.avplay.setListener({
        onbufferingstart: function onbufferingstart() {
          setPlayerStatus('Buffering...');
        },
        onbufferingcomplete: function onbufferingcomplete() {
          setPlayerStatus('');
          updatePlayIcon(true);
        },
        oncompletion: function oncompletion() {
          if (_params.playlist === 'watchlist') goNextInPlaylist();
        },
        onerror: function onerror(e) {
          console.error('[Player] AVPlay error:', e);
          document.body.classList.remove('movie-avplay-on');
          _streamErrorRetries++;
          if (_streamErrorRetries <= 2) {
            setPlayerStatus('Reconnecting...');
            loadBestSource();
          } else {
            _streamErrorRetries = 0;
            trySource(0);
          }
        }
      });
      webapis.avplay.prepareAsync(function () {
        console.log('[Player] prepareAsync success');
        _streamErrorRetries = 0;
        webapis.avplay.play();
        setPlayerStatus('');
        updatePlayIcon(true);
        startAutoHide();
        // Get duration for progress tracking
        try {
          _durationMs = webapis.avplay.getDuration();
        } catch (e) {
          _durationMs = 0;
        }
        // Save to watch history
        if (typeof NexPlayDB !== 'undefined') {
          NexPlayDB.addToHistory(_params.id, _params.type || 'movie', _titleCache, _posterCache, _currentSeason, _currentEpisode);
        }
        // Restore position: quality-switch capture takes priority over DB
        var seekTarget = _resumePos;
        _resumePos = 0; // consume immediately
        if (!seekTarget && typeof NexPlayDB !== 'undefined') {
          var saved = NexPlayDB.getProgress(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode);
          if (saved && saved.position > 10000) seekTarget = saved.position;
        }
        if (seekTarget > 10000) {
          try {
            webapis.avplay.seekTo(seekTarget);
            console.log('[Player] Seeking to', Math.round(seekTarget / 1000) + 's');
          } catch (e) {}
        }
        // Update progress bar + auto-save every 3s
        if (_progressInterval) clearInterval(_progressInterval);
        _progressInterval = setInterval(function () {
          updateProgress();
          if (typeof NexPlayDB !== 'undefined') {
            try {
              var pos = webapis.avplay.getCurrentTime();
              if (pos > 0) NexPlayDB.saveProgress(_params.id, _params.type || 'movie', _titleCache, _posterCache, pos, _durationMs, _currentSeason, _currentEpisode);
            } catch (e) {}
          }
        }, 3000);
      }, function (e) {
        console.error('[Player] prepareAsync error:', e);
        document.body.classList.remove('movie-avplay-on');
        trySource(0);
      });
    } catch (e) {
      console.error('[Player] playWithUrl exception:', e.message);
      document.body.classList.remove('movie-avplay-on');
      trySource(0);
    }
  }
  function loadBestSource() {
    if (typeof StreamResolver === 'undefined') {
      trySource(0);
      return;
    }
    setPlayerStatus('Resolving stream...');
    var metaPromise = _params.type === 'tv' ? TMDB.tvDetails(parseInt(_params.id)).then(function (d) {
      return {
        title: d.name || '',
        year: parseInt((d.first_air_date || '2020').slice(0, 4))
      };
    }) : TMDB.details(parseInt(_params.id)).then(function (d) {
      return {
        title: d.title || '',
        year: parseInt((d.release_date || '2020').slice(0, 4))
      };
    });
    var outerTimeout = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('timeout'));
      }, 25000);
    });
    Promise.race([metaPromise, outerTimeout]).then(function (meta) {
      var resolvePromise = _params.type === 'tv' ? StreamResolver.resolveTVEpisode(_params.id, meta.title, _currentSeason, _currentEpisode) : StreamResolver.resolveMovie(_params.id, meta.title, meta.year);
      var innerTimeout = new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('resolve timeout'));
        }, 25000);
      });
      return Promise.race([resolvePromise, innerTimeout]);
    }).then(function (result) {
      if (result && result.url) {
        _availableQualities = result.qualities || [];
        _qualityHeaders = result.headers || null; // keep for quality switching
        console.log('[Player] stream resolved:', result.url.slice(0, 60));
        setPlayerStatus('Starting playback...');
        // Start at saved quality preference when the stream offers it
        var _savedPrefLabel = '';
        try {
          _savedPrefLabel = localStorage.getItem('np_pref_quality') || '';
        } catch (e) {}
        var _prefQ = _savedPrefLabel && _availableQualities.find(function (q) {
          return q.label === _savedPrefLabel;
        });
        playWithUrl(_prefQ ? _prefQ.url : result.url, result.headers);
        renderQualityDropdown();
      } else {
        console.log('[Player] no stream, falling back to embeds');
        trySource(0);
      }
    }).catch(function (e) {
      console.log('[Player] loadBestSource failed:', e.message);
      trySource(0);
    });
  }
  function buildUrl(sourceIdx) {
    var src = SOURCES[sourceIdx];
    var _params2 = _params,
      id = _params2.id,
      type = _params2.type;
    return type === 'tv' ? src.tvUrl(id, _currentSeason, _currentEpisode) : src.movieUrl(id);
  }
  function goNextInPlaylist() {
    if (typeof NexPlayDB === 'undefined') return;
    var list = NexPlayDB.getWatchlist();
    if (!list.length) return;
    var currentId = String(_params.id);
    var currentType = _params.type || 'movie';
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === currentId && list[i].type === currentType) {
        idx = i;
        break;
      }
    }
    if (idx >= 0 && idx < list.length - 1) {
      var next = list[idx + 1];
      var content = document.getElementById('main-content');
      _render(content, {
        id: next.id,
        type: next.type || 'movie',
        season: 1,
        episode: 1,
        playlist: 'watchlist'
      });
    } else {
      App.showToast('End of Watchlist');
    }
  }

  // ── Watchlist playlist panel ────────────────────────────
  function buildWatchlistPanel(items, currentId, currentType) {
    if (!items || !items.length) return '';
    var curId = String(currentId);
    return "\n      <div id=\"similar-panel\" class=\"similar-panel\">\n        <div class=\"similar-header\">Watchlist</div>\n        <div class=\"similar-list\" data-scroll>\n          ".concat(items.map(function (item) {
      var isCurrent = item.id === curId && item.type === currentType;
      return "\n              <div class=\"similar-item".concat(isCurrent ? ' playlist-current' : '', "\" data-nav\n                data-id=\"").concat(item.id, "\" data-type=\"").concat(item.type || 'movie', "\" tabindex=\"0\">\n                <div class=\"similar-thumb\">\n                  ").concat(item.poster ? "<img src=\"".concat(item.poster, "\" loading=\"lazy\">") : '<div class="ep-thumb-placeholder">🎬</div>', "\n                </div>\n                <div class=\"ep-info\">\n                  <div class=\"ep-title\">").concat(item.title || '', "</div>\n                  <div class=\"ep-meta\" style=\"").concat(isCurrent ? 'color:var(--accent);' : '', "\">\n                    ").concat(isCurrent ? 'Now Playing' : 'Up next', "\n                  </div>\n                </div>\n              </div>");
    }).join(''), "\n        </div>\n      </div>");
  }

  // â"€â"€ Similar panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function buildSimilarPanel(items, type) {
    if (!items || !items.length) return '';
    return "\n      <div id=\"similar-panel\" class=\"similar-panel\">\n        <div class=\"similar-header\">You Might Also Like</div>\n        <div class=\"similar-list\" data-scroll>\n          ".concat(items.slice(0, 15).map(function (item) {
      var poster = item.poster_path ? TMDB.img(item.poster_path, Config.IMG.POSTER_SM) : '';
      var title = item.title || item.name || '';
      var year = (item.release_date || item.first_air_date || '').slice(0, 4);
      var rating = item.vote_average ? item.vote_average.toFixed(1) : '';
      return "\n              <div class=\"similar-item\" data-nav\n                data-id=\"".concat(item.id, "\" data-type=\"").concat(type, "\" tabindex=\"0\">\n                <div class=\"similar-thumb\">\n                  ").concat(poster ? "<img src=\"".concat(poster, "\" loading=\"lazy\">") : '<div class="ep-thumb-placeholder">[movie]</div>', "\n                </div>\n                <div class=\"ep-info\">\n                  <div class=\"ep-title\">").concat(title, "</div>\n                  <div class=\"ep-meta\">").concat(year).concat(rating ? '  * ' + rating : '', "</div>\n                </div>\n              </div>");
    }).join(''), "\n        </div>\n      </div>");
  }

  // Capture current playback position in ms before a quality switch
  function capturePos() {
    try {
      if (typeof webapis !== 'undefined' && webapis.avplay) {
        var p = webapis.avplay.getCurrentTime();
        if (p > 0) return p;
      }
    } catch (e) {}
    try {
      var vid = document.getElementById('web-video');
      if (vid && vid.currentTime > 0) return Math.floor(vid.currentTime * 1000);
    } catch (e) {}
    return 0;
  }
  function renderQualityDropdown() {
    var wrap = document.getElementById('quality-dd-wrap');
    if (!wrap || !_availableQualities || !_availableQualities.length) return;
    var opts = _availableQualities.map(function (q, i) {
      return {
        value: String(i),
        label: q.label
      };
    });
    var prefLabel = '';
    try {
      prefLabel = localStorage.getItem('np_pref_quality') || '';
    } catch (e) {}
    var prefIdx = _availableQualities.findIndex(function (q) {
      return q.label === prefLabel;
    });
    var bestIdx = _availableQualities.findIndex(function (q) {
      return q.label === '1080p';
    });
    var defaultIdx = prefIdx >= 0 ? prefIdx : bestIdx >= 0 ? bestIdx : 0;
    wrap.innerHTML = TVDropdown.html('quality-dd', opts, String(defaultIdx));
    wrap.style.display = '';
    TVDropdown.mount('quality-dd', function (val) {
      var qi = parseInt(val);
      var q = _availableQualities[qi];
      if (!q) return;
      try {
        localStorage.setItem('np_pref_quality', q.label);
      } catch (e) {}
      _resumePos = capturePos(); // save position before stopping
      var hdrs = (_qualityHeaders && Object.keys(_qualityHeaders).length) ? _qualityHeaders : {
        'Referer': 'https://cineby.sc/',
        'Origin': 'https://cineby.sc'
      };
      stopAvPlay();
      setPlayerStatus('Switching quality...');
      playWithUrl(q.url, hdrs);
    });
  }
  function closePlayer() {
    stopAutoHide();
    stopMediaKeys();
    stopAvPlay();
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('hidden');
    Nav.reset(document.getElementById('main-content'));
  }
  function onLeave() {
    closePlayer();
  }
  return {
    render: _render,
    closePlayer: closePlayer,
    onLeave: onLeave
  };
}();