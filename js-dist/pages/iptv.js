"use strict";

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
function _isSettledPact(thenable) {
  return thenable instanceof _Pact && thenable.s & 1;
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
var IPTVPage = function () {
  // ── Render ──────────────────────────────────────────────
  var render = function render(container) {
    try {
      // Seed in-memory fav map from localStorage on page entry
      _favChannelIds = {};
      if (typeof NexPlayDB !== 'undefined') {
        NexPlayDB.getFavourites(1000).forEach(function (f) {
          if (f.type === 'channel') _favChannelIds[f.id] = true;
        });
      }
      container.innerHTML = "\n      <div id=\"iptv-page\" class=\"iptv-layout\" style=\"height:1080px;\">\n\n        <!-- Left sidebar: filters + channel list -->\n        <div class=\"iptv-sidebar\">\n          <div id=\"iptv-filter-section\" style=\"border-bottom:1px solid rgba(255,255,255,0.06);\">\n\n            <!-- Header strip \u2014 always visible; chevron only shown on mobile -->\n            <div id=\"iptv-filter-header\" style=\"padding:12px 20px 10px;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:10px;\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a78bfa\" stroke-width=\"2\"\n                width=\"20\" height=\"20\" style=\"flex-shrink:0;\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n                <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n              </svg>\n              <span class=\"iptv-sidebar-title\">Live TV</span>\n              <button id=\"iptv-filter-toggle\" class=\"iptv-filter-toggle-btn\" aria-label=\"Toggle filters\">\n                Filters\n                <svg class=\"iptv-filter-chevron\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" width=\"13\" height=\"13\">\n                  <polyline points=\"6 9 12 15 18 9\"/>\n                </svg>\n              </button>\n            </div>\n\n            <!-- Collapsible filter body -->\n            <div id=\"iptv-filter-body\">\n              <div style=\"padding:0 20px 12px;\">\n                <div class=\"iptv-filter-label\">Country</div>\n                ".concat(TVDropdown.html('iptv-country', [{
        value: '',
        label: 'All Countries'
      }], ''), "\n\n                <div class=\"iptv-filter-label\" style=\"margin-top:12px;\">Category</div>\n                ").concat(TVDropdown.html('iptv-category', [{
        value: '',
        label: 'All Categories'
      }], ''), "\n\n                <button id=\"iptv-ghana-toggle\" data-nav tabindex=\"0\"\n                  class=\"iptv-working-btn").concat(_selCountry === 'GH' ? ' active' : '', "\" style=\"margin-top:8px;\">\n                  \uD83C\uDDEC\uD83C\uDDED Ghana Direct\n                </button>\n                <button id=\"iptv-fav-toggle\" data-nav tabindex=\"0\"\n                  class=\"iptv-working-btn").concat(_showFavsOnly ? ' active' : '', "\">\n                  <span style=\"color:#f87171;font-size:13px;flex-shrink:0;\">\u2665</span>\n                  Favourites only\n                </button>\n                <button id=\"iptv-working-toggle\" data-nav tabindex=\"0\"\n                  class=\"iptv-working-btn").concat(_showWorkingOnly ? ' active' : '', "\">\n                  <span class=\"ch-status ch-status-ok\" style=\"position:static;width:9px;height:9px;display:inline-block;flex-shrink:0;\"></span>\n                  Working channels only\n                </button>\n                <button id=\"iptv-scan-btn\" data-nav tabindex=\"0\"\n                  class=\"iptv-working-btn\">\n                  <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"11\" height=\"11\" style=\"flex-shrink:0;\">\n                    <circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"M21 21l-4.35-4.35\"/>\n                  </svg>\n                  Scan channels\n                </button>\n              </div>\n            </div>\n\n          </div>\n\n          <div class=\"channel-list\" id=\"iptv-channel-list\" data-scroll>\n            ").concat(Array.from({
        length: 8
      }, function () {
        return "\n              <div class=\"channel-item\">\n                <div class=\"channel-logo skeleton\" style=\"width:44px;height:44px;\"></div>\n                <div style=\"flex:1;\">\n                  <div class=\"skeleton\" style=\"height:13px;width:75%;border-radius:3px;margin-bottom:6px;\"></div>\n                  <div class=\"skeleton\" style=\"height:10px;width:45%;border-radius:3px;\"></div>\n                </div>\n              </div>";
      }).join(''), "\n          </div>\n        </div>\n\n        <!-- Right: player -->\n        <div class=\"iptv-player\">\n          <div class=\"iptv-player-area\" id=\"iptv-player-area\">\n            <div class=\"iptv-placeholder iptv-placeholder--idle\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" class=\"iptv-idle-icon\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n                <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n              </svg>\n              <p>Pick a channel from the list</p>\n              <span class=\"iptv-idle-hint\">\u2190 scroll the sidebar to browse</span>\n            </div>\n          </div>\n          <div class=\"iptv-channel-bar\" id=\"iptv-channel-bar\">\n            <span class=\"iptv-idle-text\">No channel selected</span>\n          </div>\n        </div>\n\n      </div>");
      Nav.reset(container);

      // Start key listener immediately so RED works on channel cards without playing first
      startKeyListener();

      // Wire initial empty dropdowns then rebuild with real data
      TVDropdown.mount('iptv-country', function (v) {
        _selCountry = v;
        refreshChannels();
      });
      TVDropdown.mount('iptv-category', function (v) {
        _selCategory = v;
        refreshChannels();
      });

      // Mobile filter collapse toggle
      var filterToggle = document.getElementById('iptv-filter-toggle');
      if (filterToggle && _isMobile()) {
        filterToggle.addEventListener('click', function () {
          var section = document.getElementById('iptv-filter-section');
          var body = document.getElementById('iptv-filter-body');
          var chevron = filterToggle.querySelector('.iptv-filter-chevron');
          var collapsed = section && section.classList.toggle('iptv-filters-collapsed');
          if (body) body.style.display = collapsed ? 'none' : '';
          if (chevron) chevron.style.transform = collapsed ? 'rotate(-90deg)' : '';
        });
      }

      // Ghana Direct — just set country filter to GH (index.m3u covers all countries)
      var ghanaBtn = document.getElementById('iptv-ghana-toggle');
      if (ghanaBtn) {
        ghanaBtn.addEventListener('click', function () {
          _selCountry = _selCountry === 'GH' ? '' : 'GH';
          ghanaBtn.classList.toggle('active', _selCountry === 'GH');
          refreshChannels();
        });
      }

      // Scan button
      var scanBtn = document.getElementById('iptv-scan-btn');
      if (scanBtn) scanBtn.addEventListener('click', function () {
        scanChannels();
      });

      // Mobile: tap on player area shows sidebar then re-hides
      var playerArea = document.getElementById('iptv-player-area');
      if (playerArea) {
        playerArea.addEventListener('touchstart', function () {
          onPlayerAreaTouch();
        }, {
          passive: true
        });
        playerArea.addEventListener('click', function () {
          onPlayerAreaTouch();
        });
      }

      // Favourites-only toggle
      var favToggle = document.getElementById('iptv-fav-toggle');
      if (favToggle) {
        favToggle.addEventListener('click', function () {
          applyFavFilter(!_showFavsOnly);
        });
      }

      // Working-only toggle
      var workingBtn = document.getElementById('iptv-working-toggle');
      if (workingBtn) {
        workingBtn.addEventListener('click', function () {
          applyWorkingFilter(!_showWorkingOnly);
        });
      }

      // Load meta + channels in parallel
      return Promise.resolve(Promise.all([buildCountryOptions(), buildCategoryOptions(), refreshChannels()])).then(function () {
        // Re-establish focus after dropdowns are rebuilt (outerHTML replacement detaches old elements)
        Nav.reset(container);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Build category TVDropdown ──────────────────────────
  var buildCategoryOptions = function buildCategoryOptions() {
    try {
      function _temp8() {
        var catOpts = _categories.length ? _categories.filter(function (c) {
          return c.id !== 'xxx';
        }).map(function (c) {
          return {
            value: c.id,
            label: c.name || CATEGORY_LABELS[c.id] || c.id
          };
        }) : Object.keys(CATEGORY_LABELS).filter(function (k) {
          return k !== 'xxx';
        }).map(function (k) {
          return {
            value: k,
            label: CATEGORY_LABELS[k]
          };
        });
        var opts = [{
          value: '',
          label: 'All Categories'
        }].concat(catOpts);
        var wrap = document.getElementById('tdd-wrap-iptv-category');
        if (wrap) {
          wrap.outerHTML = TVDropdown.html('iptv-category', opts, '');
          TVDropdown.mount('iptv-category', function (v) {
            _selCategory = v;
            refreshChannels();
          });
        }
      }
      var _temp7 = _catch(function () {
        return Promise.resolve(IPTV.getCategories()).then(function (_IPTV$getCategories) {
          _categories = _IPTV$getCategories;
        });
      }, function () {
        _categories = [];
      });
      return Promise.resolve(_temp7 && _temp7.then ? _temp7.then(_temp8) : _temp8(_temp7));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Build country TVDropdown ───────────────────────────
  var buildCountryOptions = function buildCountryOptions() {
    try {
      function _temp6() {
        var opts = [{
          value: '',
          label: 'All Countries'
        }].concat(_countries.map(function (c) {
          return {
            value: c.code,
            label: c.name
          };
        }));
        var wrap = document.getElementById('tdd-wrap-iptv-country');
        if (wrap) {
          wrap.outerHTML = TVDropdown.html('iptv-country', opts, '');
          TVDropdown.mount('iptv-country', function (v) {
            _selCountry = v;
            refreshChannels();
          });
        }
      }
      var _temp5 = _catch(function () {
        return Promise.resolve(IPTV.getCountries()).then(function (_IPTV$getCountries) {
          _countries = _IPTV$getCountries;
        });
      }, function () {
        _countries = [];
      });
      return Promise.resolve(_temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Refresh filtered channel list ──────────────────────
  var refreshChannels = function refreshChannels() {
    try {
      var list = document.getElementById('iptv-channel-list');
      if (!list) return Promise.resolve();

      // Clear any previous scroll handler
      if (_chanScrollHandler) {
        list.removeEventListener('scroll', _chanScrollHandler);
        _chanScrollHandler = null;
      }
      _channelOffset = 0;
      list.innerHTML = "<div style=\"padding:20px;text-align:center;\">\n      <div class=\"spinner\" style=\"margin:0 auto 14px;\"></div>\n      <div style=\"font-size:12px;color:rgba(240,240,248,0.40);line-height:1.5;\">\n        Loading channels&hellip;<br>First load may take a minute.\n      </div></div>";
      return Promise.resolve(_catch(function () {
        return Promise.resolve(IPTV.filterChannels({
          country: _selCountry,
          category: _selCategory
        })).then(function (_IPTV$filterChannels) {
          _filtered = _IPTV$filterChannels;
          if (!_filtered.length) {
            list.innerHTML = "<div style=\"padding:20px;text-align:center;color:rgba(240,240,248,0.45);font-size:14px;\">\n          No channels found for this filter</div>";
            return;
          }

          // Render first batch
          // Defer EPG prefetch — give the TV JS engine time to paint the channel list first
          // Update scan button label to reflect current list size
          // Scroll-based loading for remaining batches
          list.innerHTML = '';
          appendChannelBatch();
          if (typeof EPGClient !== 'undefined') {
            setTimeout(function () {
              var ids = _filtered.slice(0, 30).map(function (ch) {
                return ch.id;
              });
              EPGClient.prefetch(ids);
            }, 3000);
          }
          var unknownCount = _filtered.filter(function (ch) {
            return ch.url && getChStatus(ch.id) === 'unknown';
          }).length;
          if (unknownCount > SCAN_CAP) {
            _updateScanBtn('large', unknownCount);
          } else {
            _updateScanBtn('idle');
          }
          if (getDisplayList().length > CHANNEL_BATCH) {
            _chanScrollHandler = function _chanScrollHandler() {
              var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 300;
              if (nearBottom) appendChannelBatch();
            };
            list.addEventListener('scroll', _chanScrollHandler);
          }
        });
      }, function (err) {
        list.innerHTML = "<div class=\"error-msg\">Failed to load channels</div>";
        console.error('IPTV channel load error:', err);
      }));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Play a channel ─────────────────────────────────────
  var playChannel = function playChannel(channel) {
    try {
      _activeChannel = channel;
      // Cancel any pending mobile full-screen mode on channel switch
      cancelMobileWatching();

      // Reset status to unknown immediately so user sees it's being retried
      setChStatus(channel.id, 'unknown');
      updateChannelCard(channel.id, 'unknown');

      // Always show UI when switching channels
      showUI();
      if (_hideTimer) {
        clearTimeout(_hideTimer);
        _hideTimer = null;
      }

      // Stop previous playback — destroy HLS first to prevent recovery callbacks
      // firing on the old instance after the new one starts (audio overlap + _reconnectCount race)
      if (_hls) {
        try {
          _hls.destroy();
        } catch (e) {}
        _hls = null;
      }
      stopAvPlay();
      if (_videoEl) {
        try {
          _videoEl.pause();
          _videoEl.src = '';
        } catch (e) {}
        _videoEl = null;
      }

      // Update active state in list
      document.querySelectorAll('.channel-item').forEach(function (el) {
        el.classList.toggle('active', el.dataset.channelId === channel.id);
      });

      // Update channel bar (immediate render, then refresh once EPG loads)
      renderChannelBar(channel);
      // Close any open EPG panel — it belongs to the previous channel
      _epgOpen = false;
      var oldPanel = document.getElementById('iptv-epg-panel');
      if (oldPanel) oldPanel.parentNode.removeChild(oldPanel);
      var playerArea = document.getElementById('iptv-player-area');
      if (playerArea) {
        playerArea.innerHTML = "<div class=\"iptv-placeholder\"><div class=\"spinner\"></div><p>Connecting...</p></div>";
      }

      // P2: collect ALL stream URLs for this channel
      _streamUrls = [];
      _streamIdx = 0;
      _reconnectCount = 0;
      resetStall();

      // All channels now have urls[] from index.m3u — no streams.json lookup needed
      _streamUrls = channel.urls && channel.urls.length ? channel.urls : channel.url ? [channel.url] : [];
      if (!_streamUrls.length) {
        setChStatus(channel.id, 'fail');
        updateChannelCard(channel.id, 'fail');
        if (playerArea) playerArea.innerHTML = "<div class=\"iptv-placeholder\"><p>Stream unavailable</p></div>";
        return Promise.resolve();
      }

      // Use first URL directly — testChannelManifest already validated it in the background.
      // tryNextStream() handles failover if it doesn't play.
      _streamIdx = 0;
      if (!playWithAvPlay(_streamUrls[0], playerArea)) {
        playWithHTML5(_streamUrls[0], playerArea);
      }

      // Fetch EPG for this channel; refresh the bar when data arrives
      if (typeof EPGClient !== 'undefined') {
        EPGClient.fetchProgrammes(channel.id).then(function () {
          // Only refresh if still on the same channel
          if (_activeChannel && _activeChannel.id === channel.id) {
            renderChannelBar(channel);
            // Also update this channel's card to show now-playing text
            updateChannelCard(channel.id, getChStatus(channel.id));
          }
        }).catch(function () {});
      }
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }; // ── Channel favourites ────────────────────────────────────
  var scanChannels = function scanChannels() {
    try {
      var _interrupt = false;
      function _temp4() {
        _scanActive = false;
        _scanStop = false;
        var working = _filtered.filter(function (ch) {
          return getChStatus(ch.id) === 'ok';
        }).length;
        _updateScanBtn('done', working);
        setTimeout(function () {
          _updateScanBtn('idle');
        }, 4000);
      }
      // Toggle: pressing while scanning cancels it
      if (_scanActive) {
        _scanStop = true;
        return Promise.resolve();
      }
      var toTest = _filtered.filter(function (ch) {
        return ch.url && getChStatus(ch.id) === 'unknown';
      });
      if (!toTest.length) {
        _updateScanBtn('done', 0);
        return Promise.resolve();
      }

      // Hard cap: protect Tizen 3.0 from memory / event-loop overload
      if (toTest.length > SCAN_CAP) {
        _updateScanBtn('large', toTest.length);
        return Promise.resolve();
      }
      _scanActive = true;
      _scanStop = false;
      var total = toTest.length;
      var done = 0;
      var CONCURRENT = 3;
      var BATCH_GAP = 400;
      var i = 0;
      var _temp3 = _for(function () {
        return !_interrupt && i < toTest.length;
      }, function () {
        return !!(i += CONCURRENT);
      }, function () {
        if (_scanStop) {
          _interrupt = true;
          return;
        }
        var chunk = toTest.slice(i, i + CONCURRENT);
        return Promise.resolve(Promise.all(chunk.map(function (ch) {
          return testChannelManifest(ch.id, ch.url).then(function () {
            done++;
            _updateScanBtn('progress', done, total);
          });
        }))).then(function () {
          var _temp2 = function () {
            if (!_scanStop) {
              return Promise.resolve(new Promise(function (r) {
                setTimeout(r, BATCH_GAP);
              })).then(function () {});
            }
          }();
          if (_temp2 && _temp2.then) return _temp2.then(function () {});
        });
      });
      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Test a batch concurrently (6 at a time) ────────────────
  var testVisibleChannels = function testVisibleChannels(channels) {
    try {
      var CONCURRENT = 6;
      var toTest = channels.filter(function (ch) {
        return ch.url && getChStatus(ch.id) === 'unknown';
      });
      var i = 0;
      var _temp = _for(function () {
        return i < toTest.length;
      }, function () {
        return !!(i += CONCURRENT);
      }, function () {
        var chunk = toTest.slice(i, i + CONCURRENT);
        return Promise.resolve(Promise.all(chunk.map(function (ch) {
          return testChannelManifest(ch.id, ch.url);
        }))).then(function () {});
      });
      return Promise.resolve(_temp && _temp.then ? _temp.then(function () {}) : void 0);
    } catch (e) {
      return Promise.reject(e);
    }
  }; // ── Full channel scan (background, cancellable) ───────────
  // Capped at 300 channels — scanning thousands locks up Tizen 3.0 and hits CF proxy limits.
  var _filtered = [];
  var _activeChannel = null;
  var _countries = [];
  var _categories = [];
  var _selCountry = '';
  var _selCategory = '';
  var _videoEl = null;
  var _hls = null;
  var _hideTimer = null;
  var _uiHidden = false;
  var _keyListener = null;
  var CHANNEL_BATCH = 80;
  var PROXY_BASE = 'https://nexplay-proxy.pielly16.workers.dev';
  var _channelOffset = 0;
  var _chanScrollHandler = null;
  var _showWorkingOnly = false;
  var _showFavsOnly = false;
  // In-memory fav set — authoritative for badge rendering within a session.
  // Supplements localStorage which can lag on Tizen 3.0 async reads.
  var _favChannelIds = {};

  // Background channel scan state
  var _scanActive = false;
  var _scanStop = false;

  // Mobile full-screen watching mode
  var _mobileHideTimer = null;
  var _mobileWatchActive = false;
  function _isMobile() {
    return window.innerWidth < 1024;
  }
  function enterMobileWatching() {
    if (!_isMobile() || !_activeChannel) return;
    _mobileWatchActive = true;
    var page = document.getElementById('iptv-page');
    if (page) page.classList.add('iptv-watching');
    // Also hide the bottom nav bar so video fills the full screen
    document.body.classList.add('iptv-fullscreen');
  }
  function exitMobileWatching() {
    _mobileWatchActive = false;
    var page = document.getElementById('iptv-page');
    if (page) page.classList.remove('iptv-watching');
    document.body.classList.remove('iptv-fullscreen');
  }
  function scheduleMobileWatching(delayMs) {
    if (!_isMobile()) return;
    if (_mobileHideTimer) clearTimeout(_mobileHideTimer);
    _mobileHideTimer = setTimeout(function () {
      _mobileHideTimer = null;
      if (_activeChannel) enterMobileWatching();
    }, delayMs || 4000);
  }
  function cancelMobileWatching() {
    if (_mobileHideTimer) {
      clearTimeout(_mobileHideTimer);
      _mobileHideTimer = null;
    }
    exitMobileWatching();
  }
  function onPlayerAreaTouch() {
    // User tapped the video — show sidebar briefly then re-hide
    if (_mobileWatchActive) {
      exitMobileWatching();
      scheduleMobileWatching(8000);
    }
  }

  // P2: multi-stream state
  var _streamUrls = [];
  var _streamIdx = 0;

  // EPG panel state
  var _epgOpen = false;

  // P3: stall detection + auto-recovery
  var _stallCount = 0;
  var _stallTimer = null;
  var _reconnectCount = 0;
  var MAX_RECONNECTS = 2; // reconnect same URL twice before switching to next

  // ── Player UI show/hide ────────────────────────────────
  function showUI() {
    var page = document.getElementById('iptv-page');
    if (page) page.classList.remove('iptv-ui-hidden');
    _uiHidden = false;
    resetHideTimer();
  }
  function hideUI() {
    var page = document.getElementById('iptv-page');
    if (page) page.classList.add('iptv-ui-hidden');
    _uiHidden = true;
  }
  function resetHideTimer() {
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hideUI, 4000);
  }
  function startKeyListener() {
    if (_keyListener) return;
    _keyListener = function _keyListener(e) {
      // RED key: toggle favourite on the focused card OR the active channel.
      // Works whether or not a channel is currently playing.
      if (e.keyCode === 403 || e.keyCode === Config.KEYS.RED) {
        var focusedCard = document.querySelector('.nav-focused[data-channel-id]');
        var targetId = focusedCard ? focusedCard.dataset.channelId : null;
        var targetCh = targetId ? _filtered.find(function (c) {
          return c.id === targetId;
        }) || _activeChannel : _activeChannel;
        if (targetCh) {
          toggleChannelFavourite(targetCh);
          if (_activeChannel) showUI();
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (!_activeChannel) return;
      // INFO key toggles the EPG schedule panel
      if (e.keyCode === 457 || e.keyCode === Config.KEYS.INFO) {
        toggleEPGPanel();
        showUI();
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (_uiHidden) {
        showUI();
        e.stopPropagation(); // absorb this key press — just reveal the UI
      } else {
        resetHideTimer(); // any key resets the auto-hide clock
      }
    };
    document.addEventListener('keydown', _keyListener, true);
  }
  function stopKeyListener() {
    if (_keyListener) {
      document.removeEventListener('keydown', _keyListener, true);
      _keyListener = null;
    }
    if (_hideTimer) {
      clearTimeout(_hideTimer);
      _hideTimer = null;
    }
    // Restore UI visibility directly — don't call showUI() because it calls
    // resetHideTimer() which schedules a future hideUI(). That stale timer would
    // fire on the next IPTV visit and blank the sidebar within 4 seconds.
    var page = document.getElementById('iptv-page');
    if (page) page.classList.remove('iptv-ui-hidden');
    _uiHidden = false;
  }
  var CATEGORY_LABELS = {
    auto: 'Automotive',
    business: 'Business',
    classic: 'Classic',
    comedy: 'Comedy',
    cooking: 'Cooking',
    culture: 'Culture',
    documentary: 'Documentary',
    education: 'Education',
    entertainment: 'Entertainment',
    family: 'Family',
    general: 'General',
    kids: 'Kids',
    legislative: 'Legislative',
    lifestyle: 'Lifestyle',
    movies: 'Movies',
    music: 'Music',
    news: 'News',
    outdoor: 'Outdoor',
    relax: 'Relax',
    religious: 'Religious',
    series: 'Series',
    shop: 'Shopping',
    sports: 'Sports',
    travel: 'Travel',
    weather: 'Weather',
    xxx: 'Adult'
  };

  // ── Check if response body is a valid HLS manifest ───────
  function isHLS(text) {
    var t = (text || '').trim().slice(0, 200);
    return t.indexOf('#EXTM3U') >= 0 || t.indexOf('#EXT-X-') >= 0 || t.indexOf('#EXTINF') >= 0;
  }

  // ── Manifest test: direct first, proxy fallback ────────────
  // Direct works for local channels that allow CORS from user's IP.
  // Proxy fallback: only marks OK if manifest valid; geo-blocked → stays grey
  //   (channel may still work on TV via AVPlay which ignores CORS).
  function testChannelManifest(channelId, streamUrl) {
    return new Promise(function (resolve) {
      var stored = getChStatus(channelId);
      if (stored === 'ok' || stored === 'fail') {
        resolve();
        return;
      }
      var settled = false;
      function done() {
        if (!settled) {
          settled = true;
          resolve();
        }
      }

      // Step 1 — direct (manual timeout: Tizen 3.0 xhr.timeout is unreliable)
      var direct = new XMLHttpRequest();
      var directTimer = setTimeout(function () {
        try {
          direct.abort();
        } catch (e) {}
        tryViaProxy();
      }, 5000);
      try {
        direct.open('GET', streamUrl);
      } catch (e) {
        clearTimeout(directTimer);
        tryViaProxy();
        return;
      }
      direct.onload = function () {
        clearTimeout(directTimer);
        if (direct.status >= 200 && direct.status < 400 && isHLS(direct.responseText)) {
          setChStatus(channelId, 'ok');
          updateChannelCard(channelId, 'ok');
          done();
        } else {
          tryViaProxy();
        }
      };
      direct.onerror = function () {
        clearTimeout(directTimer);
        tryViaProxy();
      };
      direct.onabort = function () {};
      try {
        direct.send();
      } catch (e) {
        clearTimeout(directTimer);
        tryViaProxy();
      }

      // Step 2 — proxy fallback
      function tryViaProxy() {
        if (settled) return;
        var proxyUrl = PROXY_BASE + '/?url=' + encodeURIComponent(streamUrl);
        var xhr = new XMLHttpRequest();
        var proxyTimer = setTimeout(function () {
          try {
            xhr.abort();
          } catch (e) {}
          done();
        }, 8000);
        try {
          xhr.open('GET', proxyUrl);
        } catch (e) {
          clearTimeout(proxyTimer);
          done();
          return;
        }
        xhr.onload = function () {
          clearTimeout(proxyTimer);
          if (xhr.status >= 200 && xhr.status < 400) {
            if (isHLS(xhr.responseText)) {
              setChStatus(channelId, 'ok');
              updateChannelCard(channelId, 'ok');
            }
          } else {
            setChStatus(channelId, 'fail');
            updateChannelCard(channelId, 'fail');
          }
          done();
        };
        xhr.onerror = function () {
          clearTimeout(proxyTimer);
          done();
        };
        xhr.onabort = function () {
          done();
        };
        try {
          xhr.send();
        } catch (e) {
          clearTimeout(proxyTimer);
          done();
        }
      }
    });
  }
  var SCAN_CAP = 300;
  function _updateScanBtn(state, a, b) {
    var btn = document.getElementById('iptv-scan-btn');
    if (!btn) return;
    btn.classList.remove('active');
    if (state === 'idle') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" style="flex-shrink:0;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' + '<span>Scan channels</span>';
    } else if (state === 'progress') {
      var pct = b > 0 ? Math.round(a / b * 100) : 0;
      btn.classList.add('active');
      btn.innerHTML = '<span class="scan-fill-bg" style="width:' + pct + '%"></span>' + '<span class="scan-fill-text">Scanning ' + a + '/' + b + ' &nbsp;✕</span>';
    } else if (state === 'done') {
      btn.innerHTML = '<span>✓ ' + (a ? a + ' working' : 'All tested') + '</span>';
    } else if (state === 'large') {
      btn.innerHTML = '<span>Filter first (' + a + ' channels)</span>';
    }
  }

  // ── P3: stall helpers ─────────────────────────────────────
  function resetStall() {
    _stallCount = 0;
    if (_stallTimer) {
      clearTimeout(_stallTimer);
      _stallTimer = null;
    }
  }

  // Try the next stream URL for the current channel (P2+P3 shared)
  function tryNextStream() {
    resetStall();
    _reconnectCount = 0; // clean slate for the new URL
    _streamIdx++;
    var playerArea = document.getElementById('iptv-player-area');
    if (_streamIdx >= _streamUrls.length) {
      if (_activeChannel) {
        setChStatus(_activeChannel.id, 'fail');
        updateChannelCard(_activeChannel.id, 'fail');
      }
      if (playerArea) playerArea.innerHTML = '<div class="iptv-placeholder"><p>All streams exhausted</p></div>';
      return;
    }
    var nextUrl = _streamUrls[_streamIdx];
    App.showToast('Trying stream ' + (_streamIdx + 1) + ' of ' + _streamUrls.length + '...');
    stopAvPlay();
    if (_videoEl) {
      try {
        _videoEl.pause();
        _videoEl.src = '';
      } catch (e) {}
      _videoEl = null;
    }
    if (playerArea) playerArea.innerHTML = '<div class="iptv-placeholder"><div class="spinner"></div><p>Switching stream...</p></div>';
    if (!playWithAvPlay(nextUrl, playerArea)) {
      playWithHTML5(nextUrl, playerArea);
    }
  }

  // ── Reconnect same stream before giving up to next URL ─────
  // Uses setTimeout to exit the AVPlay callback stack before calling stop/open,
  // which is required on Tizen 3.0 to avoid AVPlay state machine deadlock.
  function reconnectCurrentStream() {
    var url = _streamUrls[_streamIdx];
    if (!url || !_activeChannel) {
      tryNextStream();
      return;
    }
    resetStall();
    App.showToast('Reconnecting stream (' + _reconnectCount + '/' + MAX_RECONNECTS + ')...');
    setTimeout(function () {
      stopAvPlay();
      if (_videoEl) {
        try {
          _videoEl.pause();
          _videoEl.src = '';
        } catch (e) {}
        _videoEl = null;
      }
      var pa = document.getElementById('iptv-player-area');
      if (pa) pa.innerHTML = '<div class="iptv-placeholder"><div class="spinner"></div><p>Reconnecting...</p></div>';
      if (!playWithAvPlay(url, document.getElementById('iptv-player-area'))) {
        playWithHTML5(url, document.getElementById('iptv-player-area'));
      }
    }, 500);
  }

  // ── Channel status — persisted in localStorage ───────────
  // In-memory cache so rendering 80+ cards doesn't parse localStorage 80+ times.
  var CH_STATUS_KEY = 'np_iptv_ch';
  var _chStatusCache = null;
  function _loadChCache() {
    if (!_chStatusCache) {
      try {
        _chStatusCache = JSON.parse(localStorage.getItem(CH_STATUS_KEY) || '{}');
      } catch (e) {
        _chStatusCache = {};
      }
    }
  }
  function getChStatus(id) {
    _loadChCache();
    return _chStatusCache[id] || 'unknown';
  }
  function setChStatus(id, status) {
    _loadChCache();
    _chStatusCache[id] = status;
    try {
      localStorage.setItem(CH_STATUS_KEY, JSON.stringify(_chStatusCache));
    } catch (e) {}
  }
  function updateChannelCard(id, status) {
    var card = document.querySelector('[data-channel-id="' + id + '"]');
    if (!card) return;
    var dot = card.querySelector('.ch-status');
    if (dot) dot.className = 'ch-status ch-status-' + status;
  }

  // ── Resolve best logo URL for a channel ───────────────
  function channelLogoUrl(ch) {
    if (ch.logo) return ch.logo;
    // Extract hostname from website for Google favicon service
    if (ch.website) {
      var m = ch.website.match(/https?:\/\/([^\/]+)/);
      if (m) return 'https://www.google.com/s2/favicons?domain=' + m[1] + '&sz=128';
    }
    return null;
  }

  // ── Channel card (logo-first grid tile) ───────────────
  function channelItem(ch, isActive, favSet) {
    var initial = (ch.name || '?').trim()[0].toUpperCase();
    var logoSrc = channelLogoUrl(ch);
    var status = getChStatus(ch.id);
    var nowProg = typeof EPGClient !== 'undefined' ? EPGClient.getCurrent(ch.id) : null;
    // Use pre-built favSet when available (avoids per-card localStorage read)
    var isFav = favSet ? !!favSet[ch.id] : typeof NexPlayDB !== 'undefined' ? NexPlayDB.isFavourite(ch.id, 'channel') : false;
    return "\n      <div class=\"channel-item ".concat(isActive ? 'active' : '', "\"\n        data-nav data-channel-id=\"").concat(ch.id, "\" tabindex=\"0\">\n        <div class=\"channel-logo\">\n          <span class=\"channel-initial\">").concat(initial, "</span>\n          ").concat(logoSrc ? "<img src=\"".concat(logoSrc, "\" alt=\"").concat(ch.name, "\" loading=\"eager\" onerror=\"this.style.display='none'\">") : '', "\n          <span class=\"ch-status ch-status-").concat(status, "\"></span>\n        </div>\n        <div class=\"ch-name-wrap\">\n          <div class=\"channel-name\">").concat(ch.name || '', "</div>\n          ").concat(nowProg ? "<div class=\"ch-now-prog\">".concat(nowProg.title, "</div>") : '', "\n        </div>\n        ").concat(isFav ? '<span class="ch-fav-badge">&#9829;</span>' : '', "\n        <button class=\"ch-fav-btn").concat(isFav ? ' active' : '', "\" data-ch-fav=\"").concat(ch.id, "\" title=\"").concat(isFav ? 'Remove favourite' : 'Add favourite', "\">").concat(isFav ? '♥' : '♡', "</button>\n      </div>");
  }

  // ── AVPlay helpers ─────────────────────────────────────
  function stopAvPlay() {
    document.documentElement.style.background = '';
    document.body.style.background = '';
    document.body.classList.remove('avplay-on');
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try {
      webapis.avplay.stop();
    } catch (e) {}
    try {
      webapis.avplay.close();
    } catch (e) {}
  }
  function playWithHTML5(streamUrl, playerArea) {
    if (!playerArea) return;
    playerArea.style.background = '';
    playerArea.innerHTML = '<video id="iptv-video" class="iptv-video" autoplay playsinline style="width:100%;height:100%;background:#000;"></video>';
    _videoEl = document.getElementById('iptv-video');
    if (!_videoEl) return;
    function onOk() {
      if (_activeChannel) {
        setChStatus(_activeChannel.id, 'ok');
        updateChannelCard(_activeChannel.id, 'ok');
      }
      // Mobile: schedule full-screen watching mode after stream confirms playing
      scheduleMobileWatching(8000);
    }
    function onFail() {
      if (_activeChannel) {
        setChStatus(_activeChannel.id, 'fail');
        updateChannelCard(_activeChannel.id, 'fail');
      }
      if (playerArea) playerArea.innerHTML = '<div class="iptv-placeholder"><p>Stream unavailable on this device</p></div>';
    }

    // Use HLS.js when available (Chrome/Firefox) — same approach as the movie player
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      var hls = new Hls({
        enableWorker: false,
        debug: false,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 2
      });
      _hls = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(_videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        _videoEl.play().catch(function () {});
        onOk();
      });
      hls.on(Hls.Events.ERROR, function (ev, data) {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && _reconnectCount < MAX_RECONNECTS) {
            _reconnectCount++;
            hls.startLoad(); // HLS.js recovery for transient network interruptions
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && _reconnectCount < MAX_RECONNECTS) {
            _reconnectCount++;
            hls.recoverMediaError();
          } else {
            hls.destroy();
            if (_hls === hls) _hls = null;
            _reconnectCount = 0;
            if (_streamIdx + 1 < _streamUrls.length) {
              tryNextStream();
            } else {
              onFail();
            }
          }
        }
      });
    } else if (_videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / Tizen native HLS fallback
      _videoEl.src = streamUrl;
      _videoEl.play().catch(function () {});
      _videoEl.addEventListener('playing', onOk, {
        once: true
      });
      _videoEl.addEventListener('error', onFail);
    } else {
      onFail();
    }
  }
  function playWithAvPlay(streamUrl, playerArea) {
    if (typeof webapis === 'undefined' || !webapis.avplay) return false;
    try {
      stopAvPlay();
      resetStall();
      webapis.avplay.open(streamUrl);

      // Set listener BEFORE prepareAsync (Samsung requirement)
      webapis.avplay.setListener({
        onbufferingstart: function onbufferingstart() {
          if (_stallTimer) clearTimeout(_stallTimer);
          _stallTimer = setTimeout(function () {
            _stallTimer = null;
            _stallCount++;
            if (_stallCount >= 2) {
              // 2 consecutive stalls: reconnect same URL before switching
              if (_reconnectCount < MAX_RECONNECTS) {
                _reconnectCount++;
                reconnectCurrentStream();
              } else {
                tryNextStream(); // exhausted reconnects → try next URL
              }
            }
          }, 8000);
        },
        onbufferingcomplete: function onbufferingcomplete() {
          if (_stallTimer) {
            clearTimeout(_stallTimer);
            _stallTimer = null;
          }
          _stallCount = 0;
          _reconnectCount = 0; // stream recovered — reset reconnect counter
          if (_activeChannel) {
            setChStatus(_activeChannel.id, 'ok');
            updateChannelCard(_activeChannel.id, 'ok');
          }
        },
        onerror: function onerror() {
          resetStall();
          // Try reconnecting before marking fail / switching URL
          if (_reconnectCount < MAX_RECONNECTS) {
            _reconnectCount++;
            reconnectCurrentStream();
          } else {
            _reconnectCount = 0;
            if (_activeChannel) {
              setChStatus(_activeChannel.id, 'fail');
              updateChannelCard(_activeChannel.id, 'fail');
            }
            stopAvPlay();
            if (_streamIdx + 1 < _streamUrls.length) {
              tryNextStream();
            } else {
              playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
            }
          }
        }
      });

      // Clear ALL backgrounds so AVPlay video renders through the HTML layer
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.body.classList.add('avplay-on');
      playerArea.innerHTML = '<div style="width:100%;height:100%;background:transparent;"></div>';
      webapis.avplay.prepareAsync(function () {
        try {
          webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
          webapis.avplay.play();
          startKeyListener();
          resetHideTimer();
          scheduleMobileWatching(8000);
        } catch (e) {
          if (_activeChannel) {
            setChStatus(_activeChannel.id, 'fail');
            updateChannelCard(_activeChannel.id, 'fail');
          }
          stopAvPlay();
          playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
        }
      }, function () {
        if (_activeChannel) {
          setChStatus(_activeChannel.id, 'fail');
          updateChannelCard(_activeChannel.id, 'fail');
        }
        stopAvPlay();
        playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
      });
      return true;
    } catch (e) {
      stopAvPlay();
      return false;
    }
  }

  // ── EPG helpers ────────────────────────────────────────
  function renderChannelBar(channel) {
    var bar = document.getElementById('iptv-channel-bar');
    if (!bar) return;
    var epg = typeof EPGClient !== 'undefined';
    var cur = epg ? EPGClient.getCurrent(channel.id) : null;
    var next = epg ? EPGClient.getNext(channel.id) : null;
    var pct = epg ? EPGClient.currentProgress(channel.id) : 0;
    var cats = (channel.categories || []).map(function (c) {
      return CATEGORY_LABELS[c] || c;
    }).join(' · ');
    bar.innerHTML = "\n      <div class=\"live-badge\"><div class=\"live-dot\"></div> LIVE</div>\n      <div class=\"channel-logo\" style=\"width:36px;height:36px;flex-shrink:0;\">\n        ".concat(channel.logo ? "<img src=\"".concat(channel.logo, "\" style=\"width:100%;height:100%;object-fit:contain;padding:2px;\" onerror=\"this.style.display='none'\">") : '', "\n      </div>\n      <div class=\"iptv-bar-info\">\n        <div class=\"iptv-bar-name\">").concat(channel.name, "</div>\n        ").concat(cur ? "\n          <div class=\"iptv-bar-prog\">\n            <span class=\"iptv-prog-label\">NOW</span>\n            <span class=\"iptv-prog-title\">".concat(cur.title, "</span>\n            <span class=\"iptv-prog-time\">").concat(EPGClient.formatTime(cur.start), "&ndash;").concat(EPGClient.formatTime(cur.stop), "</span>\n          </div>\n          <div class=\"iptv-prog-bar\"><div class=\"iptv-prog-fill\" style=\"width:").concat(pct.toFixed(1), "%\"></div></div>\n          ").concat(next ? "<div class=\"iptv-bar-prog iptv-bar-next\">\n            <span class=\"iptv-prog-label\">NEXT</span>\n            <span class=\"iptv-prog-title\">".concat(next.title, "</span>\n            <span class=\"iptv-prog-time\">").concat(EPGClient.formatTime(next.start), "</span>\n          </div>") : '', "\n        ") : "<div class=\"iptv-bar-meta\">".concat(cats || '', "</div>"), "\n      </div>\n      <button class=\"iptv-guide-btn").concat(_epgOpen ? ' active' : '', "\" id=\"iptv-guide-btn\" data-nav tabindex=\"0\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"16\" height=\"16\">\n          <rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/>\n          <path d=\"M7 8h10M7 12h6M7 16h4\"/>\n        </svg>\n        Guide\n      </button>");
    var guideBtn = document.getElementById('iptv-guide-btn');
    if (guideBtn) guideBtn.addEventListener('click', function () {
      toggleEPGPanel();
    });
  }
  function toggleEPGPanel() {
    _epgOpen = !_epgOpen;
    if (_epgOpen) {
      renderEPGPanel();
    } else {
      var panel = document.getElementById('iptv-epg-panel');
      if (panel) panel.parentNode.removeChild(panel);
    }
    // Refresh guide button active state
    var btn = document.getElementById('iptv-guide-btn');
    if (btn) btn.classList.toggle('active', _epgOpen);
  }
  function renderEPGPanel() {
    if (!_activeChannel) return;
    var playerArea = document.getElementById('iptv-player-area');
    if (!playerArea) return;
    var existing = document.getElementById('iptv-epg-panel');
    if (existing) existing.parentNode.removeChild(existing);
    var progs = typeof EPGClient !== 'undefined' ? EPGClient.getToday(_activeChannel.id) : null;
    var now = Date.now();
    var chName = _activeChannel.name || '';
    var panel = document.createElement('div');
    panel.id = 'iptv-epg-panel';
    panel.className = 'iptv-epg-panel';
    if (!progs || !progs.length) {
      panel.innerHTML = "\n        <div class=\"epg-panel-header\">\n          <span>Programme Guide</span>\n          <span class=\"epg-panel-ch\">".concat(chName, "</span>\n        </div>\n        <div class=\"epg-no-data\">\n          No schedule available<br>\n          <span style=\"font-size:11px;opacity:0.6;\">EPG data is limited to certain channels</span>\n        </div>");
    } else {
      var items = progs.map(function (p) {
        var isCur = p.start <= now && p.stop > now;
        var isPast = p.stop < now;
        var pBar = isCur ? Math.min(100, (now - p.start) / (p.stop - p.start) * 100) : 0;
        var dur = p.stop > p.start ? Math.round((p.stop - p.start) / 60000) + 'm' : '';
        return "\n          <div class=\"epg-item".concat(isCur ? ' epg-current' : '').concat(isPast ? ' epg-past' : '', "\">\n            <div class=\"epg-item-time\">").concat(typeof EPGClient !== 'undefined' ? EPGClient.formatTime(p.start) : '', "</div>\n            <div class=\"epg-item-body\">\n              <div class=\"epg-item-title\">").concat(p.title || '', "</div>\n              ").concat(dur ? "<div class=\"epg-item-dur\">".concat(dur, "</div>") : '', "\n              ").concat(isCur && pBar > 0 ? "<div class=\"epg-item-prog-bar\"><div class=\"epg-item-prog-fill\" style=\"width:".concat(pBar.toFixed(1), "%\"></div></div>") : '', "\n              ").concat(p.desc && !isPast ? "<div class=\"epg-item-desc\">".concat(p.desc.slice(0, 80)).concat(p.desc.length > 80 ? '&hellip;' : '', "</div>") : '', "\n            </div>\n          </div>");
      }).join('');
      panel.innerHTML = "\n        <div class=\"epg-panel-header\">\n          <span>Today's Schedule</span>\n          <span class=\"epg-panel-ch\">".concat(chName, "</span>\n        </div>\n        <div class=\"epg-list\" id=\"epg-list\" data-scroll>").concat(items, "</div>");
    }
    playerArea.appendChild(panel);

    // Scroll the current programme into view
    var curEl = panel.querySelector('.epg-current');
    if (curEl) {
      setTimeout(function () {
        curEl.scrollIntoView({
          block: 'center'
        });
      }, 80);
    }
  }
  function toggleChannelFavourite(channel) {
    if (typeof NexPlayDB === 'undefined') return;
    var added = NexPlayDB.toggleFavourite(channel.id, 'channel', channel.name, channel.logo || '');
    // Keep in-memory map in sync so badge persists through filter re-renders
    if (added) _favChannelIds[channel.id] = true;else delete _favChannelIds[channel.id];
    if (typeof App !== 'undefined') {
      App.showToast(added ? '♥ Added to Favourites' : '♡ Removed from Favourites');
    }
    // Update card badge in the list
    var card = document.querySelector('[data-channel-id="' + channel.id + '"]');
    if (card) {
      var old = card.querySelector('.ch-fav-badge');
      if (added && !old) {
        var badge = document.createElement('span');
        badge.className = 'ch-fav-badge';
        badge.innerHTML = '♥';
        card.appendChild(badge);
      } else if (!added && old) {
        old.parentNode.removeChild(old);
      }
    }
    // If favourites-only filter is on and we unfavourited, refresh list
    if (_showFavsOnly && !added) {
      applyFavFilter(true);
    }
  }
  function applyFavFilter(show) {
    _showFavsOnly = show;
    var btn = document.getElementById('iptv-fav-toggle');
    if (btn) btn.classList.toggle('active', show);
    var list = document.getElementById('iptv-channel-list');
    if (!list) return;
    if (_chanScrollHandler) {
      list.removeEventListener('scroll', _chanScrollHandler);
      _chanScrollHandler = null;
    }
    _channelOffset = 0;
    list.innerHTML = '';
    var display = getDisplayList();
    if (!display.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:rgba(240,240,248,0.45);">' + (show ? 'No favourite channels yet — press ♥ RED while watching to add one.' : 'No channels found.') + '</div>';
      return;
    }
    appendChannelBatch();
    if (display.length > CHANNEL_BATCH) {
      _chanScrollHandler = function _chanScrollHandler() {
        if (list.scrollHeight - list.scrollTop - list.clientHeight < 300) appendChannelBatch();
      };
      list.addEventListener('scroll', _chanScrollHandler);
    }
  }

  // ── Working-only filter ────────────────────────────────────
  function getDisplayList() {
    if (_showFavsOnly && typeof NexPlayDB !== 'undefined') {
      return _filtered.filter(function (ch) {
        return NexPlayDB.isFavourite(ch.id, 'channel');
      });
    }
    if (_showWorkingOnly) {
      return _filtered.filter(function (ch) {
        return getChStatus(ch.id) === 'ok';
      });
    }
    return _filtered;
  }
  function applyWorkingFilter(show) {
    _showWorkingOnly = show;
    var btn = document.getElementById('iptv-working-toggle');
    if (btn) btn.classList.toggle('active', show);
    var list = document.getElementById('iptv-channel-list');
    if (!list) return;
    if (_chanScrollHandler) {
      list.removeEventListener('scroll', _chanScrollHandler);
      _chanScrollHandler = null;
    }
    _channelOffset = 0;
    list.innerHTML = '';
    var display = getDisplayList();
    if (!display.length) {
      list.innerHTML = show ? '<div style="padding:20px;text-align:center;font-size:13px;color:rgba(240,240,248,0.45);">No working channels yet — try some channels first to discover what plays.</div>' : '<div style="padding:20px;text-align:center;font-size:13px;color:rgba(240,240,248,0.45);">No channels found.</div>';
      return;
    }
    appendChannelBatch();
    if (display.length > CHANNEL_BATCH) {
      _chanScrollHandler = function _chanScrollHandler() {
        var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 300;
        if (nearBottom) appendChannelBatch();
      };
      list.addEventListener('scroll', _chanScrollHandler);
    }
  }

  // ── Bind click + vertical scroll-into-view on channel cards ─
  function bindChannelItems(els) {
    els.forEach(function (el) {
      el.addEventListener('click', function (e) {
        // Mobile ♥ fav button — toggle without starting the channel
        if (e.target.closest('.ch-fav-btn')) {
          e.stopPropagation();
          var btn = e.target.closest('.ch-fav-btn');
          var ch = _filtered.find(function (c) {
            return c.id === btn.dataset.chFav;
          });
          if (ch) {
            toggleChannelFavourite(ch);
            // Update button state immediately
            var isFavNow = typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(ch.id, 'channel');
            btn.classList.toggle('active', isFavNow);
            btn.textContent = isFavNow ? '♥' : '♡';
          }
          return;
        }
        var ch = _filtered.find(function (c) {
          return c.id === el.dataset.channelId;
        });
        if (ch) playChannel(ch);
      });
      // Keep card visible in the sidebar when D-pad focuses it
      el.addEventListener('nav:focus', function () {
        var list = document.getElementById('iptv-channel-list');
        if (!list) return;
        var er = el.getBoundingClientRect();
        var sr = list.getBoundingClientRect();
        if (er.bottom > sr.bottom - 40) list.scrollTop += er.bottom - sr.bottom + 60;else if (er.top < sr.top + 40) list.scrollTop -= sr.top - er.top + 60;
        // Tizen 3.0: programmatic scrollTop changes don't fire scroll events,
        // so the scroll-based batch loader never triggers. Check manually.
        if (list.scrollHeight - list.scrollTop - list.clientHeight < 400) {
          appendChannelBatch();
        }
      });
    });
  }

  // ── Append one batch of channels to the list ──────────────
  function appendChannelBatch() {
    var list = document.getElementById('iptv-channel-list');
    var display = getDisplayList();
    if (!list || _channelOffset >= display.length) return;
    var batch = display.slice(_channelOffset, _channelOffset + CHANNEL_BATCH);
    _channelOffset += CHANNEL_BATCH;

    // Use the in-memory fav map — avoids stale localStorage reads on Tizen 3.0
    var favSet = _favChannelIds;
    batch.forEach(function (ch) {
      var tmp = document.createElement('div');
      tmp.innerHTML = channelItem(ch, _activeChannel && _activeChannel.id === ch.id, favSet);
      var item = tmp.firstElementChild;
      if (item) {
        list.appendChild(item);
        bindChannelItems([item]);
      }
    });

    // Defer the XHR burst so the UI can paint before network requests start.
    var batchCopy = batch.slice(0, 20);
    setTimeout(function () {
      testVisibleChannels(batchCopy);
    }, 1200);
  }
  function onLeave() {
    stopKeyListener();
    if (_hls) {
      try {
        _hls.destroy();
      } catch (e) {}
      _hls = null;
    }
    stopAvPlay();
    document.body.classList.remove('avplay-on');
    if (_videoEl) {
      try {
        _videoEl.pause();
        _videoEl.src = '';
      } catch (e) {}
      _videoEl = null;
    }
    _activeChannel = null;
    // Remove channel scroll handler to prevent memory leak
    var list = document.getElementById('iptv-channel-list');
    if (list && _chanScrollHandler) list.removeEventListener('scroll', _chanScrollHandler);
    _chanScrollHandler = null;
    _channelOffset = 0;
    _showWorkingOnly = false;
    _showFavsOnly = false;
    _scanStop = true; // cancel any running scan
    _scanActive = false;
    cancelMobileWatching();
    _streamUrls = [];
    _streamIdx = 0;
    _reconnectCount = 0;
    _epgOpen = false;
    resetStall();
  }
  return {
    render: render,
    onLeave: onLeave
  };
}();