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
var IPTVPage = function () {
  // ── Render ──────────────────────────────────────────────
  var render = function render(container) {
    try {
      container.innerHTML = "\n      <div id=\"iptv-page\" class=\"iptv-layout\" style=\"height:1080px;\">\n\n        <!-- Left sidebar: filters + channel list -->\n        <div class=\"iptv-sidebar\">\n          <div style=\"padding:20px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.06);\">\n            <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:16px;\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a78bfa\" stroke-width=\"2\"\n                width=\"20\" height=\"20\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n                <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n              </svg>\n              <span class=\"iptv-sidebar-title\">Live TV</span>\n            </div>\n\n            <div class=\"iptv-filter-label\">Country</div>\n            ".concat(TVDropdown.html('iptv-country', [{
        value: '',
        label: 'All Countries'
      }], ''), "\n\n            <div class=\"iptv-filter-label\" style=\"margin-top:12px;\">Category</div>\n            ").concat(TVDropdown.html('iptv-category', [{
        value: '',
        label: 'All Categories'
      }], ''), "\n\n            <button id=\"iptv-ghana-toggle\" data-nav tabindex=\"0\"\n              class=\"iptv-working-btn").concat(_useGhana ? ' active' : '', "\" style=\"margin-top:8px;\">\n              \uD83C\uDDEC\uD83C\uDDED Ghana Direct\n            </button>\n            <button id=\"iptv-working-toggle\" data-nav tabindex=\"0\"\n              class=\"iptv-working-btn").concat(_showWorkingOnly ? ' active' : '', "\">\n              <span class=\"ch-status ch-status-ok\" style=\"position:static;width:9px;height:9px;display:inline-block;flex-shrink:0;\"></span>\n              Working channels only\n            </button>\n          </div>\n\n          <div class=\"channel-list\" id=\"iptv-channel-list\" data-scroll>\n            ").concat(Array.from({
        length: 8
      }, function () {
        return "\n              <div class=\"channel-item\">\n                <div class=\"channel-logo skeleton\" style=\"width:44px;height:44px;\"></div>\n                <div style=\"flex:1;\">\n                  <div class=\"skeleton\" style=\"height:13px;width:75%;border-radius:3px;margin-bottom:6px;\"></div>\n                  <div class=\"skeleton\" style=\"height:10px;width:45%;border-radius:3px;\"></div>\n                </div>\n              </div>";
      }).join(''), "\n          </div>\n        </div>\n\n        <!-- Right: player -->\n        <div class=\"iptv-player\">\n          <div class=\"iptv-player-area\" id=\"iptv-player-area\">\n            <div class=\"iptv-placeholder\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n                <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n              </svg>\n              <p>Select a channel to watch</p>\n            </div>\n          </div>\n          <div class=\"iptv-channel-bar\" id=\"iptv-channel-bar\">\n            <span class=\"iptv-idle-text\">No channel selected</span>\n          </div>\n        </div>\n\n      </div>");
      Nav.reset(container);

      // Wire initial empty dropdowns then rebuild with real data
      TVDropdown.mount('iptv-country', function (v) {
        _selCountry = v;
        refreshChannels();
      });
      TVDropdown.mount('iptv-category', function (v) {
        _selCategory = v;
        refreshChannels();
      });

      // Ghana Direct — just set country filter to GH (index.m3u covers all countries)
      var ghanaBtn = document.getElementById('iptv-ghana-toggle');
      if (ghanaBtn) {
        ghanaBtn.addEventListener('click', function () {
          _selCountry = _selCountry === 'GH' ? '' : 'GH';
          ghanaBtn.classList.toggle('active', _selCountry === 'GH');
          refreshChannels();
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
      function _temp4() {
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
      var _temp3 = _catch(function () {
        return Promise.resolve(IPTV.getCategories()).then(function (_IPTV$getCategories) {
          _categories = _IPTV$getCategories;
        });
      }, function () {
        _categories = [];
      });
      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Build country TVDropdown ───────────────────────────
  var buildCountryOptions = function buildCountryOptions() {
    try {
      function _temp2() {
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
      var _temp = _catch(function () {
        return Promise.resolve(IPTV.getCountries()).then(function (_IPTV$getCountries) {
          _countries = _IPTV$getCountries;
        });
      }, function () {
        _countries = [];
      });
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
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
          // Scroll-based loading for remaining batches
          list.innerHTML = '';
          appendChannelBatch();
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

      // Reset status to unknown immediately so user sees it's being retried
      setChStatus(channel.id, 'unknown');
      updateChannelCard(channel.id, 'unknown');

      // Always show UI when switching channels
      showUI();
      if (_hideTimer) {
        clearTimeout(_hideTimer);
        _hideTimer = null;
      }

      // Stop previous playback
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

      // Update channel bar
      var bar = document.getElementById('iptv-channel-bar');
      if (bar) {
        bar.innerHTML = "\n        <div class=\"live-badge\"><div class=\"live-dot\"></div> LIVE</div>\n        <div class=\"channel-logo\" style=\"width:36px;height:36px;\">\n          ".concat(channel.logo ? "<img src=\"".concat(channel.logo, "\" style=\"width:100%;height:100%;object-fit:contain;padding:2px;\">") : '', "\n        </div>\n        <div>\n          <div class=\"iptv-bar-name\">").concat(channel.name, "</div>\n          <div class=\"iptv-bar-meta\">").concat((channel.categories || []).map(function (c) {
          return CATEGORY_LABELS[c] || c;
        }).join(' · '), "</div>\n        </div>");
      }
      var playerArea = document.getElementById('iptv-player-area');
      if (playerArea) {
        playerArea.innerHTML = "<div class=\"iptv-placeholder\"><div class=\"spinner\"></div><p>Connecting...</p></div>";
      }

      // P2: collect ALL stream URLs for this channel
      _streamUrls = [];
      _streamIdx = 0;
      resetStall();

      // All channels now have urls[] from index.m3u — no streams.json lookup needed
      _streamUrls = channel.urls && channel.urls.length ? channel.urls : channel.url ? [channel.url] : [];
      if (!_streamUrls.length) {
        setChStatus(channel.id, 'fail');
        updateChannelCard(channel.id, 'fail');
        if (playerArea) playerArea.innerHTML = "<div class=\"iptv-placeholder\"><p>Stream unavailable</p></div>";
        return Promise.resolve();
      }

      // P2: race top-3 to find fastest responding URL
      return Promise.resolve(raceStreams(_streamUrls)).then(function (bestUrl) {
        _streamIdx = Math.max(0, _streamUrls.indexOf(bestUrl));

        // Play (AVPlay on TV, HLS.js on web)
        if (!playWithAvPlay(bestUrl, playerArea)) {
          playWithHTML5(bestUrl, playerArea);
        }
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }; // ── Working-only filter ────────────────────────────────────
  var _filtered = [];
  var _activeChannel = null;
  var _countries = [];
  var _categories = [];
  var _selCountry = '';
  var _selCategory = '';
  var _videoEl = null;
  var _hideTimer = null;
  var _uiHidden = false;
  var _keyListener = null;
  var CHANNEL_BATCH = 80;
  var _channelOffset = 0;
  var _chanScrollHandler = null;
  var _showWorkingOnly = false;
  var _useGhana = false; // P1: gh.m3u source active

  // P2: multi-stream state
  var _streamUrls = []; // all candidate URLs for the current channel
  var _streamIdx = 0; // which URL we're currently playing

  // P3: stall detection
  var _stallCount = 0;
  var _stallTimer = null;

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
      if (!_activeChannel) return;
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
    showUI(); // always restore UI when leaving
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

  // ── P2: race top-3 stream URLs, return fastest responding ─
  function raceStreams(urls) {
    if (!urls || !urls.length) return Promise.resolve(null);
    if (urls.length === 1) return Promise.resolve(urls[0]);
    return new Promise(function (resolve) {
      var settled = false;
      var count = 0;
      var top = urls.slice(0, 3);
      function done(winner) {
        count++;
        if (!settled && winner) {
          settled = true;
          resolve(winner);
          return;
        }
        if (count === top.length && !settled) resolve(top[0]); // all HEAD failed → try first anyway
      }
      top.forEach(function (url) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 4000;
        xhr.open('HEAD', url);
        xhr.onload = function () {
          done(xhr.status < 400 ? url : null);
        };
        xhr.onerror = function () {
          done(null);
        };
        xhr.ontimeout = function () {
          done(null);
        };
        xhr.send();
      });
    });
  }

  // ── Channel status — persisted in localStorage ───────────
  var CH_STATUS_KEY = 'np_iptv_ch';
  function getChStatus(id) {
    try {
      var d = JSON.parse(localStorage.getItem(CH_STATUS_KEY) || '{}');
      return d[id] || 'unknown'; // 'ok' | 'fail' | 'unknown'
    } catch (e) {
      return 'unknown';
    }
  }
  function setChStatus(id, status) {
    try {
      var d = JSON.parse(localStorage.getItem(CH_STATUS_KEY) || '{}');
      d[id] = status;
      localStorage.setItem(CH_STATUS_KEY, JSON.stringify(d));
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
  function channelItem(ch, isActive) {
    var initial = (ch.name || '?').trim()[0].toUpperCase();
    var logoSrc = channelLogoUrl(ch);
    // Status comes only from actual play attempts — no pre-marking from stream-set
    // (79% of channels have ID mismatches vs streams.json so pre-marking causes false reds)
    var status = getChStatus(ch.id);
    return "\n      <div class=\"channel-item ".concat(isActive ? 'active' : '', "\"\n        data-nav data-channel-id=\"").concat(ch.id, "\" tabindex=\"0\">\n        <div class=\"channel-logo\">\n          <span class=\"channel-initial\">").concat(initial, "</span>\n          ").concat(logoSrc ? "<img src=\"".concat(logoSrc, "\" alt=\"").concat(ch.name, "\" loading=\"eager\" onerror=\"this.style.display='none'\">") : '', "\n          <span class=\"ch-status ch-status-").concat(status, "\"></span>\n        </div>\n        <div class=\"channel-name\">").concat(ch.name || '', "</div>\n      </div>");
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
      hls.loadSource(streamUrl);
      hls.attachMedia(_videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        _videoEl.play().catch(function () {});
        onOk();
      });
      hls.on(Hls.Events.ERROR, function (ev, data) {
        if (data.fatal) {
          hls.destroy();
          // P3: try next stream URL before giving up
          if (_streamIdx + 1 < _streamUrls.length) {
            tryNextStream();
          } else {
            onFail();
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
          // P3: start a stall timer — if buffering doesn't complete in 8s, try next stream
          if (_stallTimer) clearTimeout(_stallTimer);
          _stallTimer = setTimeout(function () {
            _stallTimer = null;
            _stallCount++;
            if (_stallCount >= 2) tryNextStream(); // 2 consecutive stalls → switch
          }, 8000);
        },
        onbufferingcomplete: function onbufferingcomplete() {
          // Buffering resolved — cancel stall timer, reset count
          if (_stallTimer) {
            clearTimeout(_stallTimer);
            _stallTimer = null;
          }
          _stallCount = 0;
          if (_activeChannel) {
            setChStatus(_activeChannel.id, 'ok');
            updateChannelCard(_activeChannel.id, 'ok');
          }
        },
        onerror: function onerror() {
          resetStall();
          if (_activeChannel) {
            setChStatus(_activeChannel.id, 'fail');
            updateChannelCard(_activeChannel.id, 'fail');
          }
          stopAvPlay();
          // Try next stream URL before falling back to HTML5
          if (_streamIdx + 1 < _streamUrls.length) {
            tryNextStream();
          } else {
            playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
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
  function getDisplayList() {
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
      el.addEventListener('click', function () {
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
    batch.forEach(function (ch) {
      var tmp = document.createElement('div');
      tmp.innerHTML = channelItem(ch, _activeChannel && _activeChannel.id === ch.id);
      var item = tmp.firstElementChild;
      if (item) {
        list.appendChild(item);
        bindChannelItems([item]);
      }
    });
  }
  function onLeave() {
    stopKeyListener();
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
    _useGhana = false;
    _streamUrls = [];
    _streamIdx = 0;
    resetStall();
  }
  return {
    render: render,
    onLeave: onLeave
  };
}();