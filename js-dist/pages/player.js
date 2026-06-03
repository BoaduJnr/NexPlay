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
      var isTV = params.type === 'tv';
      var modal = document.getElementById('player-modal');
      if (!modal) return Promise.resolve();
      stopAvPlay();
      modal.classList.remove('hidden');
      modal.innerHTML = "\n      <div class=\"player-header\" style=\"".concat(isTV ? 'margin-right:300px;' : '', "\">\n        <button class=\"player-back btn btn-secondary\" data-nav tabindex=\"0\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"16\" height=\"16\">\n            <path d=\"M19 12H5M12 5l-7 7 7 7\"/>\n          </svg>\n          Back\n        </button>\n      </div>\n\n      <div style=\"position:relative;display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex:1;flex:1;overflow:hidden;background:transparent;\">\n        <div id=\"avplay-area\" style=\"-webkit-flex:1;flex:1;min-width:0;background:transparent;position:relative;\">\n          <div id=\"player-status\"\n            style=\"position:absolute;top:50%;left:50%;\n                   -webkit-transform:translate(-50%,-50%);transform:translate(-50%,-50%);\n                   color:#fff;font-size:24px;background:rgba(0,0,0,0.75);\n                   padding:20px 40px;border-radius:12px;text-align:center;\">\n            Loading...\n          </div>\n        </div>\n        ").concat(isTV ? "<div id=\"episode-panel\" class=\"episode-panel\"></div>" : "<div id=\"similar-slot\"></div>", "\n      </div>\n\n      <div class=\"player-cbar\" id=\"player-cbar\" style=\"").concat(isTV ? 'right:300px;' : '', "\">\n        <!-- Row 1 (top): controls centered + quality far right -->\n        <div class=\"player-cbar-row2\">\n          <div class=\"player-cbar-btns\">\n            ").concat(isTV ? "<button class=\"pcb-btn\" id=\"ctrl-prev\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M6 6h2v12H6zm3.5 6l8.5 6V6z\"/></svg>\n              <span>Prev</span></button>" : '', "\n            <button class=\"pcb-btn\" id=\"ctrl-rw\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z\"/></svg>\n              <span>-10s</span></button>\n            <button class=\"pcb-btn pcb-play\" id=\"ctrl-play\" data-nav tabindex=\"0\">\n              <svg id=\"ctrl-play-icon\" viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"26\" height=\"26\"><path d=\"M8 5v14l11-7z\"/></svg>\n            </button>\n            <button class=\"pcb-btn\" id=\"ctrl-ff\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z\"/></svg>\n              <span>+30s</span></button>\n            ").concat(isTV ? "<button class=\"pcb-btn\" id=\"ctrl-next\" data-nav tabindex=\"0\">\n              <svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"16\" height=\"16\"><path d=\"M6 18l8.5-6L6 6v12zm2.5-6l8.5 6V6l-8.5 6z\"/><rect x=\"16\" y=\"6\" width=\"2\" height=\"12\"/></svg>\n              <span>Next</span></button>" : '', "\n          </div>\n          <div id=\"quality-dd-wrap\" class=\"player-cbar-quality\">\n            ").concat(TVDropdown.html('quality-dd', [{
        value: 'auto',
        label: 'Auto'
      }], 'auto'), "\n          </div>\n        </div>\n        <!-- Row 2 (bottom): progress track (seekable) + time -->\n        <div class=\"player-cbar-row1\">\n          <div class=\"player-cbar-track\" id=\"seek-track\" data-nav tabindex=\"0\" title=\"Left/Right to seek\">\n            <div id=\"progress-fill\" class=\"player-cbar-fill\"></div>\n          </div>\n          <span id=\"player-time\" class=\"player-cbar-time\">0:00 / 0:00</span>\n        </div>\n      </div>\n\n      <div class=\"player-info-bar\" style=\"").concat(isTV ? 'margin-right:300px;' : '', "\">\n        <div style=\"-webkit-flex:1;flex:1;min-width:0;\">\n          <div class=\"player-title\" id=\"player-title\">Loading...</div>\n          <div class=\"player-meta\" id=\"player-meta\"></div>\n        </div>\n      </div>");
      modal.querySelector('.player-back').addEventListener('click', closePlayer);
      TVDropdown.mount('quality-dd', function (val) {
        var qi = parseInt(val);
        var q = _availableQualities && _availableQualities[qi];
        if (!q) return;
        var hdrs = {
          'Referer': 'https://player.videasy.net/',
          'Origin': 'https://player.videasy.net'
        };
        stopAvPlay();
        setPlayerStatus('Loading...');
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
                  if (similarSlot && details.similar && details.similar.results && details.similar.results.length) {
                    similarSlot.outerHTML = buildSimilarPanel(details.similar.results, 'movie');
                    document.querySelectorAll('.similar-item').forEach(function (el) {
                      el.addEventListener('click', function () {
                        return _render(container, {
                          id: el.dataset.id,
                          type: 'movie'
                        });
                      });
                    });
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
  }; // â"€â"€ Similar panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
    id: 'vidsrc-xyz',
    label: 'Source 1',
    movieUrl: function movieUrl(id) {
      return "https://vidsrc.xyz/embed/movie?tmdb=".concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "https://vidsrc.xyz/embed/tv?tmdb=".concat(id, "&season=").concat(s, "&episode=").concat(e);
    }
  }, {
    id: 'vidsrc',
    label: 'Source 2',
    movieUrl: function movieUrl(id) {
      return "https://vidsrc.to/embed/movie/".concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "https://vidsrc.to/embed/tv/".concat(id, "/").concat(s, "/").concat(e);
    }
  }, {
    id: 'videasy',
    label: 'Source 3',
    movieUrl: function movieUrl(id) {
      return "".concat(Config.VIDEASY_BASE, "/embed/movie/").concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "".concat(Config.VIDEASY_BASE, "/embed/tv/").concat(id, "/").concat(s, "/").concat(e);
    }
  }, {
    id: 'vsembed',
    label: 'Source 4',
    movieUrl: function movieUrl(id) {
      return "".concat(Config.VSEMBED_BASE, "/embed/movie/").concat(id);
    },
    tvUrl: function tvUrl(id, s, e) {
      return "".concat(Config.VSEMBED_BASE, "/embed/tv/").concat(id, "/").concat(s, "/").concat(e);
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
    _keyListener = null;
  var _progressInterval = null,
    _titleCache = '',
    _posterCache = '',
    _durationMs = 0;
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
  var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  function updatePlayIcon(playing) {
    var icon = document.getElementById('ctrl-play-icon');
    if (icon) icon.parentNode.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
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
    } catch (e) {}
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
    if (_keyListener) return;
    _keyListener = function _keyListener(e) {
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

      // ── Enter: allow on Back + control buttons, absorb elsewhere ─
      if (k === Config.KEYS.ENTER || k === 13) {
        var focused = document.querySelector('.nav-focused');
        var isBack = focused && focused.classList.contains('player-back');
        var isCtrl = focused && focused.classList.contains('ctrl-btn');
        if (!isBack && !isCtrl) {
          if (_uiHidden) showPlayerUI();
          e.stopPropagation();
          e.preventDefault();
          if (_hideTimer) clearTimeout(_hideTimer);
          _hideTimer = setTimeout(hidePlayerUI, 4000);
          return;
        }
        // Back or ctrl-btn — let Enter propagate so click fires
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
    document.addEventListener('keydown', _keyListener, true);
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
  }
  function stopAutoHide() {
    if (_keyListener) {
      document.removeEventListener('keydown', _keyListener, true);
      _keyListener = null;
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
  function showIframeEmbed(embedUrl) {
    // Web fallback: show the provider's own player in an iframe.
    // The embed runs in its own origin context, handles the CDN directly.
    // Only used on web (not on TV where iframes for video are unsupported).
    if (typeof webapis !== 'undefined' && webapis.avplay) return; // TV path
    var area = document.getElementById('avplay-area');
    if (!area) return;
    area.innerHTML = '<iframe src="' + embedUrl + '" allowfullscreen frameborder="0" allow="autoplay; fullscreen" style="width:100%;height:100%;border:none;background:#000;"></iframe>';
    setPlayerStatus('');
    console.log('[Player] iframe embed:', embedUrl.slice(0, 80));
    startAutoHide();
  }
  function trySource(idx) {
    if (idx >= SOURCES.length) {
      // All direct-stream scraping failed. On web, show the best embed as iframe.
      if (typeof webapis === 'undefined' || !webapis.avplay) {
        // Prefer Videasy embed (Source 3) — most compatible, then vidsrc
        var preferredSources = [SOURCES[2], SOURCES[0], SOURCES[1]];
        for (var ps = 0; ps < preferredSources.length; ps++) {
          var src = preferredSources[ps];
          if (src) {
            showIframeEmbed(_params.type === 'tv' ? src.tvUrl(_params.id, _currentSeason, _currentEpisode) : src.movieUrl(_params.id));
            return;
          }
        }
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
        video.play().catch(function () {});
        setPlayerStatus('');
        updatePlayIcon(true);
        startAutoHide();
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
          trySource(0);
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

    // Both web (hls.js) and TV (AVPlay) route through the CF Worker proxy.
    // The proxy injects the correct Referer/Origin for the CDN and rewrites
    // all HLS segment URLs back through itself.
    // For web: this fixes CDN rejection (browser can't set Referer manually).
    var proxyUrl = buildProxyUrl(url, headers);
    if (typeof webapis === 'undefined' || !webapis.avplay) {
      playWithHlsJs(proxyUrl, headers);
      return;
    }

    // TV: AVPlay via proxy (proxyUrl already built above)
    console.log('[Player] AVPlay via proxy:', proxyUrl.slice(0, 80));
    try {
      var s = webapis.avplay.getState();
      if (s === 'PLAYING' || s === 'PAUSED' || s === 'READY') webapis.avplay.stop();
      if (s !== 'NONE' && s !== 'IDLE') webapis.avplay.close();
      webapis.avplay.open(proxyUrl);
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
        onerror: function onerror(e) {
          console.error('[Player] AVPlay error:', e);
          document.body.classList.remove('movie-avplay-on');
          trySource(0);
        }
      });
      webapis.avplay.prepareAsync(function () {
        console.log('[Player] prepareAsync success');
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
        // Restore saved position (continue watching)
        if (typeof NexPlayDB !== 'undefined') {
          var saved = NexPlayDB.getProgress(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode);
          if (saved && saved.position > 10000) {
            // only restore if > 10s
            try {
              webapis.avplay.seekTo(saved.position);
              console.log('[Player] Resuming from', Math.round(saved.position / 1000) + 's');
            } catch (e) {}
          }
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
        console.log('[Player] stream resolved:', result.url.slice(0, 60));
        setPlayerStatus('Starting playback...');
        playWithUrl(result.url, result.headers);
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
  function renderQualityDropdown() {
    var wrap = document.getElementById('quality-dd-wrap');
    if (!wrap || !_availableQualities || !_availableQualities.length) return;
    var opts = _availableQualities.map(function (q, i) {
      return {
        value: String(i),
        label: q.label
      };
    });
    var best = _availableQualities.findIndex(function (q) {
      return q.label === '1080p';
    });
    var defaultIdx = best >= 0 ? best : 0;
    wrap.innerHTML = TVDropdown.html('quality-dd', opts, String(defaultIdx));
    wrap.style.display = '';
    TVDropdown.mount('quality-dd', function (val) {
      var qi = parseInt(val);
      var q = _availableQualities[qi];
      if (!q) return;
      var headers = {
        'Referer': 'https://player.videasy.net/',
        'Origin': 'https://player.videasy.net'
      };
      stopAvPlay();
      setPlayerStatus('Loading...');
      playWithUrl(q.url, headers);
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