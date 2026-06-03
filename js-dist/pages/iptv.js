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
      container.innerHTML = "\n      <div id=\"iptv-page\" class=\"iptv-layout\" style=\"height:1080px;\">\n\n        <!-- Left sidebar: filters + channel list -->\n        <div class=\"iptv-sidebar\">\n          <div style=\"padding:20px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.06);\">\n            <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:16px;\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#a78bfa\" stroke-width=\"2\"\n                width=\"20\" height=\"20\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n                <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n              </svg>\n              <span style=\"font-size:18px;font-weight:800;color:#f0f0f8;\">Live TV</span>\n            </div>\n\n            <div class=\"iptv-filter-label\">Country</div>\n            ".concat(TVDropdown.html('iptv-country', [{
        value: '',
        label: 'All Countries'
      }], ''), "\n\n            <div class=\"iptv-filter-label\" style=\"margin-top:12px;\">Category</div>\n            ").concat(TVDropdown.html('iptv-category', [{
        value: '',
        label: 'All Categories'
      }], ''), "\n          </div>\n\n          <div class=\"channel-list\" id=\"iptv-channel-list\" data-scroll>\n            ").concat(Array.from({
        length: 8
      }, function () {
        return "\n              <div class=\"channel-item\">\n                <div class=\"channel-logo skeleton\" style=\"width:44px;height:44px;\"></div>\n                <div style=\"flex:1;\">\n                  <div class=\"skeleton\" style=\"height:13px;width:75%;border-radius:3px;margin-bottom:6px;\"></div>\n                  <div class=\"skeleton\" style=\"height:10px;width:45%;border-radius:3px;\"></div>\n                </div>\n              </div>";
      }).join(''), "\n          </div>\n        </div>\n\n        <!-- Right: player -->\n        <div class=\"iptv-player\">\n          <div class=\"iptv-player-area\" id=\"iptv-player-area\">\n            <div class=\"iptv-placeholder\">\n              <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/>\n                <path d=\"M8 19v2M16 19v2M2 10h20\"/>\n              </svg>\n              <p>Select a channel to watch</p>\n            </div>\n          </div>\n          <div class=\"iptv-channel-bar\" id=\"iptv-channel-bar\">\n            <span style=\"font-size:14px;color:rgba(240,240,248,0.45);\">No channel selected</span>\n          </div>\n        </div>\n\n      </div>");
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
      function _temp6() {
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
      var _temp5 = _catch(function () {
        return Promise.resolve(IPTV.getCategories()).then(function (_IPTV$getCategories) {
          _categories = _IPTV$getCategories;
        });
      }, function () {
        _categories = [];
      });
      return Promise.resolve(_temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Build country TVDropdown ───────────────────────────
  var buildCountryOptions = function buildCountryOptions() {
    try {
      function _temp4() {
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
      var _temp3 = _catch(function () {
        return Promise.resolve(IPTV.getCountries()).then(function (_IPTV$getCountries) {
          _countries = _IPTV$getCountries;
        });
      }, function () {
        _countries = [];
      });
      return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  // ── Refresh filtered channel list ──────────────────────
  var refreshChannels = function refreshChannels() {
    try {
      var list = document.getElementById('iptv-channel-list');
      if (!list) return Promise.resolve();
      list.innerHTML = "<div style=\"padding:20px;text-align:center;\">\n      <div class=\"spinner\" style=\"margin:0 auto;\"></div></div>";
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

          // Limit to 60 — D-pad nav struggles with large focusable lists
          var toShow = _filtered.slice(0, 60);
          list.innerHTML = toShow.map(function (ch) {
            return channelItem(ch, _activeChannel && _activeChannel.id === ch.id);
          }).join('');
          list.querySelectorAll('[data-channel-id]').forEach(function (el) {
            el.addEventListener('click', function () {
              var ch = _filtered.find(function (c) {
                return c.id === el.dataset.channelId;
              });
              if (ch) playChannel(ch);
            });
          });
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
      function _temp2() {
        if (!streamUrl) {
          if (playerArea) {
            playerArea.innerHTML = "<div class=\"iptv-placeholder\"><p>Stream unavailable</p></div>";
          }
          return;
        }

        // Try AVPlay first (Samsung native), fall back to HTML5
        if (!playWithAvPlay(streamUrl, playerArea)) {
          playWithHTML5(streamUrl, playerArea);
        }
      }
      _activeChannel = channel;

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
        bar.innerHTML = "\n        <div class=\"live-badge\"><div class=\"live-dot\"></div> LIVE</div>\n        <div class=\"channel-logo\" style=\"width:36px;height:36px;\">\n          ".concat(channel.logo ? "<img src=\"".concat(channel.logo, "\" style=\"width:100%;height:100%;object-fit:contain;padding:2px;\">") : '', "\n        </div>\n        <div>\n          <div style=\"font-size:16px;font-weight:700;color:#f0f0f8;\">").concat(channel.name, "</div>\n          <div style=\"font-size:12px;color:rgba(240,240,248,0.45);\">").concat((channel.categories || []).map(function (c) {
          return CATEGORY_LABELS[c] || c;
        }).join(' · '), "</div>\n        </div>");
      }
      var playerArea = document.getElementById('iptv-player-area');
      if (playerArea) {
        playerArea.innerHTML = "<div class=\"iptv-placeholder\"><div class=\"spinner\"></div><p>Connecting...</p></div>";
      }
      var streamUrl = null;
      var _temp = _catch(function () {
        return Promise.resolve(IPTV.getStreamUrl(channel.id)).then(function (_IPTV$getStreamUrl) {
          streamUrl = _IPTV$getStreamUrl;
        });
      }, function () {});
      return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var _channels = [];
  var _filtered = [];
  var _activeChannel = null;
  var _countries = [];
  var _categories = [];
  var _selCountry = '';
  var _selCategory = '';
  var _videoEl = null;
  var _hlsInstance = null;
  var _hideTimer = null;
  var _uiHidden = false;
  var _keyListener = null;

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

  // ── Channel list item ──────────────────────────────────
  function channelItem(ch) {
    var isActive = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var catLabel = (ch.categories || []).map(function (c) {
      return CATEGORY_LABELS[c] || c;
    }).slice(0, 2).join(', ');
    return "\n      <div class=\"channel-item ".concat(isActive ? 'active' : '', "\"\n        data-nav data-channel-id=\"").concat(ch.id, "\" tabindex=\"0\">\n        <div class=\"channel-logo\">\n          ").concat(ch.logo ? "<img src=\"".concat(ch.logo, "\" alt=\"").concat(ch.name, "\" loading=\"lazy\" onerror=\"this.style.display='none'\">") : "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" width=\"22\" height=\"22\">\n                <rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M8 19v2M16 19v2M2 10h20\"/>\n               </svg>", "\n        </div>\n        <div style=\"overflow:hidden;flex:1;\">\n          <div class=\"channel-name\">").concat(ch.name || '', "</div>\n          ").concat(catLabel ? "<div class=\"channel-category\">".concat(catLabel, "</div>") : '', "\n        </div>\n      </div>");
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
    playerArea.innerHTML = "\n      <video id=\"iptv-video\" class=\"iptv-video\" autoplay playsinline\n        style=\"width:100%;height:100%;background:#000;\">\n        <source src=\"".concat(streamUrl, "\" type=\"application/x-mpegURL\">\n        <source src=\"").concat(streamUrl, "\">\n      </video>");
    _videoEl = document.getElementById('iptv-video');
    if (_videoEl) {
      _videoEl.addEventListener('error', function () {
        if (playerArea) {
          playerArea.innerHTML = "<div class=\"iptv-placeholder\"><p>Stream unavailable on this device</p></div>";
        }
      });
    }
  }
  function playWithAvPlay(streamUrl, playerArea) {
    if (typeof webapis === 'undefined' || !webapis.avplay) return false;
    try {
      stopAvPlay();
      webapis.avplay.open(streamUrl);

      // Set listener BEFORE prepareAsync (Samsung requirement)
      webapis.avplay.setListener({
        onbufferingstart: function onbufferingstart() {},
        onbufferingcomplete: function onbufferingcomplete() {},
        onerror: function onerror() {
          stopAvPlay();
          playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
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
          // Start listening for remote presses and begin auto-hide countdown
          startKeyListener();
          resetHideTimer();
        } catch (e) {
          stopAvPlay();
          playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
        }
      }, function () {
        stopAvPlay();
        playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
      });
      return true;
    } catch (e) {
      stopAvPlay();
      return false;
    }
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
  }
  return {
    render: render,
    onLeave: onLeave
  };
}();