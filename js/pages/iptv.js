const IPTVPage = (() => {
  let _filtered = [];
  let _activeChannel = null;
  let _countries = [];
  let _categories = [];
  let _selCountry = '';
  let _selCategory = '';
  let _videoEl = null;
  let _hideTimer = null;
  let _uiHidden = false;
  let _keyListener = null;

  const CHANNEL_BATCH = 80;
  const PROXY_BASE    = 'https://nexplay-proxy.pielly16.workers.dev';
  let _channelOffset     = 0;
  let _chanScrollHandler = null;
  let _showWorkingOnly   = false;

  // P2: multi-stream state
  let _streamUrls  = [];
  let _streamIdx   = 0;

  // P3: stall detection + auto-recovery
  let _stallCount      = 0;
  let _stallTimer      = null;
  let _reconnectCount  = 0;
  const MAX_RECONNECTS = 2;   // reconnect same URL twice before switching to next

  // ── Player UI show/hide ────────────────────────────────
  function showUI() {
    const page = document.getElementById('iptv-page');
    if (page) page.classList.remove('iptv-ui-hidden');
    _uiHidden = false;
    resetHideTimer();
  }

  function hideUI() {
    const page = document.getElementById('iptv-page');
    if (page) page.classList.add('iptv-ui-hidden');
    _uiHidden = true;
  }

  function resetHideTimer() {
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hideUI, 4000);
  }

  function startKeyListener() {
    if (_keyListener) return;
    _keyListener = function(e) {
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
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    showUI(); // always restore UI when leaving
  }

  const CATEGORY_LABELS = {
    auto:          'Automotive',
    business:      'Business',
    classic:       'Classic',
    comedy:        'Comedy',
    cooking:       'Cooking',
    culture:       'Culture',
    documentary:   'Documentary',
    education:     'Education',
    entertainment: 'Entertainment',
    family:        'Family',
    general:       'General',
    kids:          'Kids',
    legislative:   'Legislative',
    lifestyle:     'Lifestyle',
    movies:        'Movies',
    music:         'Music',
    news:          'News',
    outdoor:       'Outdoor',
    relax:         'Relax',
    religious:     'Religious',
    series:        'Series',
    shop:          'Shopping',
    sports:        'Sports',
    travel:        'Travel',
    weather:       'Weather',
    xxx:           'Adult',
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
    return new Promise(function(resolve) {
      var stored = getChStatus(channelId);
      if (stored === 'ok' || stored === 'fail') { resolve(); return; }

      // Step 1 — direct request (no proxy)
      var direct = new XMLHttpRequest();
      direct.timeout = 5000;
      direct.open('GET', streamUrl);

      direct.onload = function() {
        if (direct.status >= 200 && direct.status < 400 && isHLS(direct.responseText)) {
          // Direct success → channel works from user's network
          setChStatus(channelId, 'ok');
          updateChannelCard(channelId, 'ok');
          resolve();
        } else {
          tryViaProxy();
        }
      };
      direct.onerror   = function() { tryViaProxy(); }; // CORS or network → try proxy
      direct.ontimeout = function() { tryViaProxy(); };
      direct.send();

      // Step 2 — proxy fallback
      function tryViaProxy() {
        var proxyUrl = PROXY_BASE + '/?url=' + encodeURIComponent(streamUrl);
        var xhr = new XMLHttpRequest();
        xhr.timeout = 8000;
        xhr.open('GET', proxyUrl);
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 400) {
            if (isHLS(xhr.responseText)) {
              // Proxy confirms valid HLS → green
              setChStatus(channelId, 'ok');
              updateChannelCard(channelId, 'ok');
            }
            // else: proxy returned geo-blocked HTML → leave grey (TV may still play it)
          } else {
            // Definitive 4xx → red
            setChStatus(channelId, 'fail');
            updateChannelCard(channelId, 'fail');
          }
          resolve();
        };
        xhr.onerror   = function() { resolve(); }; // proxy error → leave grey
        xhr.ontimeout = function() { resolve(); }; // timeout → leave grey
        xhr.send();
      }
    });
  }

  // ── Test a batch concurrently (6 at a time) ────────────────
  async function testVisibleChannels(channels) {
    var CONCURRENT = 6;
    var toTest = channels.filter(function(ch) {
      return ch.url && getChStatus(ch.id) === 'unknown';
    });
    for (var i = 0; i < toTest.length; i += CONCURRENT) {
      var chunk = toTest.slice(i, i + CONCURRENT);
      await Promise.all(chunk.map(function(ch) {
        return testChannelManifest(ch.id, ch.url);
      }));
    }
  }

  // ── P3: stall helpers ─────────────────────────────────────
  function resetStall() {
    _stallCount = 0;
    if (_stallTimer) { clearTimeout(_stallTimer); _stallTimer = null; }
  }

  // Try the next stream URL for the current channel (P2+P3 shared)
  function tryNextStream() {
    resetStall();
    _reconnectCount = 0; // clean slate for the new URL
    _streamIdx++;
    var playerArea = document.getElementById('iptv-player-area');
    if (_streamIdx >= _streamUrls.length) {
      if (_activeChannel) { setChStatus(_activeChannel.id, 'fail'); updateChannelCard(_activeChannel.id, 'fail'); }
      if (playerArea) playerArea.innerHTML = '<div class="iptv-placeholder"><p>All streams exhausted</p></div>';
      return;
    }
    var nextUrl = _streamUrls[_streamIdx];
    App.showToast('Trying stream ' + (_streamIdx + 1) + ' of ' + _streamUrls.length + '...');
    stopAvPlay();
    if (_videoEl) { try { _videoEl.pause(); _videoEl.src = ''; } catch(e) {} _videoEl = null; }
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
    if (!url || !_activeChannel) { tryNextStream(); return; }
    resetStall();
    App.showToast('Reconnecting stream (' + _reconnectCount + '/' + MAX_RECONNECTS + ')...');
    setTimeout(function() {
      stopAvPlay();
      if (_videoEl) { try { _videoEl.pause(); _videoEl.src = ''; } catch(e) {} _videoEl = null; }
      var pa = document.getElementById('iptv-player-area');
      if (pa) pa.innerHTML = '<div class="iptv-placeholder"><div class="spinner"></div><p>Reconnecting...</p></div>';
      if (!playWithAvPlay(url, document.getElementById('iptv-player-area'))) {
        playWithHTML5(url, document.getElementById('iptv-player-area'));
      }
    }, 500);
  }

  // ── Channel status — persisted in localStorage ───────────
  var CH_STATUS_KEY = 'np_iptv_ch';

  function getChStatus(id) {
    try {
      var d = JSON.parse(localStorage.getItem(CH_STATUS_KEY) || '{}');
      return d[id] || 'unknown'; // 'ok' | 'fail' | 'unknown'
    } catch(e) { return 'unknown'; }
  }

  function setChStatus(id, status) {
    try {
      var d = JSON.parse(localStorage.getItem(CH_STATUS_KEY) || '{}');
      d[id] = status;
      localStorage.setItem(CH_STATUS_KEY, JSON.stringify(d));
    } catch(e) {}
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

    return `
      <div class="channel-item ${isActive ? 'active' : ''}"
        data-nav data-channel-id="${ch.id}" tabindex="0">
        <div class="channel-logo">
          <span class="channel-initial">${initial}</span>
          ${logoSrc ? `<img src="${logoSrc}" alt="${ch.name}" loading="eager" onerror="this.style.display='none'">` : ''}
          <span class="ch-status ch-status-${status}"></span>
        </div>
        <div class="channel-name">${ch.name || ''}</div>
      </div>`;
  }

  // ── AVPlay helpers ─────────────────────────────────────
  function stopAvPlay() {
    document.documentElement.style.background = '';
    document.body.style.background = '';
    document.body.classList.remove('avplay-on');
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try { webapis.avplay.stop(); } catch (e) {}
    try { webapis.avplay.close(); } catch (e) {}
  }

  function playWithHTML5(streamUrl, playerArea) {
    if (!playerArea) return;
    playerArea.style.background = '';
    playerArea.innerHTML = '<video id="iptv-video" class="iptv-video" autoplay playsinline style="width:100%;height:100%;background:#000;"></video>';
    _videoEl = document.getElementById('iptv-video');
    if (!_videoEl) return;

    function onOk() {
      if (_activeChannel) { setChStatus(_activeChannel.id, 'ok'); updateChannelCard(_activeChannel.id, 'ok'); }
    }
    function onFail() {
      if (_activeChannel) { setChStatus(_activeChannel.id, 'fail'); updateChannelCard(_activeChannel.id, 'fail'); }
      if (playerArea) playerArea.innerHTML = '<div class="iptv-placeholder"><p>Stream unavailable on this device</p></div>';
    }

    // Use HLS.js when available (Chrome/Firefox) — same approach as the movie player
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      var hls = new Hls({ enableWorker: false, debug: false, manifestLoadingTimeOut: 10000, manifestLoadingMaxRetry: 2 });
      hls.loadSource(streamUrl);
      hls.attachMedia(_videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        _videoEl.play().catch(function() {});
        onOk();
      });
      hls.on(Hls.Events.ERROR, function(ev, data) {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && _reconnectCount < MAX_RECONNECTS) {
            _reconnectCount++;
            hls.startLoad(); // HLS.js recovery for transient network interruptions
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && _reconnectCount < MAX_RECONNECTS) {
            _reconnectCount++;
            hls.recoverMediaError();
          } else {
            hls.destroy();
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
      _videoEl.play().catch(function() {});
      _videoEl.addEventListener('playing', onOk, { once: true });
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
        onbufferingstart: function() {
          if (_stallTimer) clearTimeout(_stallTimer);
          _stallTimer = setTimeout(function() {
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
        onbufferingcomplete: function() {
          if (_stallTimer) { clearTimeout(_stallTimer); _stallTimer = null; }
          _stallCount     = 0;
          _reconnectCount = 0; // stream recovered — reset reconnect counter
          if (_activeChannel) { setChStatus(_activeChannel.id, 'ok'); updateChannelCard(_activeChannel.id, 'ok'); }
        },
        onerror: function() {
          resetStall();
          // Try reconnecting before marking fail / switching URL
          if (_reconnectCount < MAX_RECONNECTS) {
            _reconnectCount++;
            reconnectCurrentStream();
          } else {
            _reconnectCount = 0;
            if (_activeChannel) { setChStatus(_activeChannel.id, 'fail'); updateChannelCard(_activeChannel.id, 'fail'); }
            stopAvPlay();
            if (_streamIdx + 1 < _streamUrls.length) {
              tryNextStream();
            } else {
              playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
            }
          }
        },
      });

      // Clear ALL backgrounds so AVPlay video renders through the HTML layer
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
      document.body.classList.add('avplay-on');
      playerArea.innerHTML = '<div style="width:100%;height:100%;background:transparent;"></div>';

      webapis.avplay.prepareAsync(
        function () {
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
        },
        function () {
          if (_activeChannel) {
            setChStatus(_activeChannel.id, 'fail');
            updateChannelCard(_activeChannel.id, 'fail');
          }
          stopAvPlay();
          playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
        }
      );
      return true;
    } catch (e) {
      stopAvPlay();
      return false;
    }
  }

  // ── Play a channel ─────────────────────────────────────
  async function playChannel(channel) {
    _activeChannel = channel;

    // Reset status to unknown immediately so user sees it's being retried
    setChStatus(channel.id, 'unknown');
    updateChannelCard(channel.id, 'unknown');

    // Always show UI when switching channels
    showUI();
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }

    // Stop previous playback
    stopAvPlay();
    if (_videoEl) { try { _videoEl.pause(); _videoEl.src = ''; } catch (e) {} _videoEl = null; }

    // Update active state in list
    document.querySelectorAll('.channel-item').forEach(el => {
      el.classList.toggle('active', el.dataset.channelId === channel.id);
    });

    // Update channel bar
    const bar = document.getElementById('iptv-channel-bar');
    if (bar) {
      bar.innerHTML = `
        <div class="live-badge"><div class="live-dot"></div> LIVE</div>
        <div class="channel-logo" style="width:36px;height:36px;">
          ${channel.logo ? `<img src="${channel.logo}" style="width:100%;height:100%;object-fit:contain;padding:2px;">` : ''}
        </div>
        <div>
          <div class="iptv-bar-name">${channel.name}</div>
          <div class="iptv-bar-meta">${(channel.categories || []).map(c => CATEGORY_LABELS[c] || c).join(' · ')}</div>
        </div>`;
    }

    const playerArea = document.getElementById('iptv-player-area');
    if (playerArea) {
      playerArea.innerHTML = `<div class="iptv-placeholder"><div class="spinner"></div><p>Connecting...</p></div>`;
    }

    // P2: collect ALL stream URLs for this channel
    _streamUrls     = [];
    _streamIdx      = 0;
    _reconnectCount = 0;
    resetStall();

    // All channels now have urls[] from index.m3u — no streams.json lookup needed
    _streamUrls = channel.urls && channel.urls.length ? channel.urls : (channel.url ? [channel.url] : []);

    if (!_streamUrls.length) {
      setChStatus(channel.id, 'fail');
      updateChannelCard(channel.id, 'fail');
      if (playerArea) playerArea.innerHTML = `<div class="iptv-placeholder"><p>Stream unavailable</p></div>`;
      return;
    }

    // Use first URL directly — testChannelManifest already validated it in the background.
    // tryNextStream() handles failover if it doesn't play.
    _streamIdx = 0;
    if (!playWithAvPlay(_streamUrls[0], playerArea)) {
      playWithHTML5(_streamUrls[0], playerArea);
    }
  }

  // ── Working-only filter ────────────────────────────────────
  function getDisplayList() {
    if (_showWorkingOnly) {
      return _filtered.filter(function(ch) { return getChStatus(ch.id) === 'ok'; });
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
      list.innerHTML = show
        ? '<div style="padding:20px;text-align:center;font-size:13px;color:rgba(240,240,248,0.45);">No working channels yet — try some channels first to discover what plays.</div>'
        : '<div style="padding:20px;text-align:center;font-size:13px;color:rgba(240,240,248,0.45);">No channels found.</div>';
      return;
    }

    appendChannelBatch();

    if (display.length > CHANNEL_BATCH) {
      _chanScrollHandler = function() {
        var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 300;
        if (nearBottom) appendChannelBatch();
      };
      list.addEventListener('scroll', _chanScrollHandler);
    }
  }

  // ── Bind click + vertical scroll-into-view on channel cards ─
  function bindChannelItems(els) {
    els.forEach(function(el) {
      el.addEventListener('click', function() {
        var ch = _filtered.find(function(c) { return c.id === el.dataset.channelId; });
        if (ch) playChannel(ch);
      });
      // Keep card visible in the sidebar when D-pad focuses it
      el.addEventListener('nav:focus', function() {
        var list = document.getElementById('iptv-channel-list');
        if (!list) return;
        var er = el.getBoundingClientRect();
        var sr = list.getBoundingClientRect();
        if (er.bottom > sr.bottom - 40) list.scrollTop += er.bottom - sr.bottom + 60;
        else if (er.top < sr.top + 40)  list.scrollTop -= sr.top  - er.top   + 60;
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
    batch.forEach(function(ch) {
      var tmp = document.createElement('div');
      tmp.innerHTML = channelItem(ch, _activeChannel && _activeChannel.id === ch.id);
      var item = tmp.firstElementChild;
      if (item) { list.appendChild(item); bindChannelItems([item]); }
    });
    // Background manifest check — test first 20 per batch (keeps XHR volume manageable)
    testVisibleChannels(batch.slice(0, 20));
  }

  // ── Refresh filtered channel list ──────────────────────
  async function refreshChannels() {
    const list = document.getElementById('iptv-channel-list');
    if (!list) return;

    // Clear any previous scroll handler
    if (_chanScrollHandler) {
      list.removeEventListener('scroll', _chanScrollHandler);
      _chanScrollHandler = null;
    }
    _channelOffset = 0;

    list.innerHTML = `<div style="padding:20px;text-align:center;">
      <div class="spinner" style="margin:0 auto 14px;"></div>
      <div style="font-size:12px;color:rgba(240,240,248,0.40);line-height:1.5;">
        Loading channels&hellip;<br>First load may take a minute.
      </div></div>`;

    try {
      _filtered = await IPTV.filterChannels({ country: _selCountry, category: _selCategory });

      if (!_filtered.length) {
        list.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(240,240,248,0.45);font-size:14px;">
          No channels found for this filter</div>`;
        return;
      }

      // Render first batch
      list.innerHTML = '';
      appendChannelBatch();

      // Scroll-based loading for remaining batches
      if (getDisplayList().length > CHANNEL_BATCH) {
        _chanScrollHandler = function() {
          var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 300;
          if (nearBottom) appendChannelBatch();
        };
        list.addEventListener('scroll', _chanScrollHandler);
      }
    } catch (err) {
      list.innerHTML = `<div class="error-msg">Failed to load channels</div>`;
      console.error('IPTV channel load error:', err);
    }
  }

  // ── Build country TVDropdown ───────────────────────────
  async function buildCountryOptions() {
    try {
      _countries = await IPTV.getCountries();
    } catch (_) { _countries = []; }
    const opts = [{ value: '', label: 'All Countries' }].concat(
      _countries.map(c => ({ value: c.code, label: c.name }))
    );
    const wrap = document.getElementById('tdd-wrap-iptv-country');
    if (wrap) {
      wrap.outerHTML = TVDropdown.html('iptv-country', opts, '');
      TVDropdown.mount('iptv-country', v => { _selCountry = v; refreshChannels(); });
    }
  }

  // ── Build category TVDropdown ──────────────────────────
  async function buildCategoryOptions() {
    try {
      _categories = await IPTV.getCategories();
    } catch (_) { _categories = []; }
    const catOpts = _categories.length
      ? _categories.filter(c => c.id !== 'xxx').map(c => ({
          value: c.id, label: c.name || CATEGORY_LABELS[c.id] || c.id
        }))
      : Object.keys(CATEGORY_LABELS)
          .filter(k => k !== 'xxx')
          .map(k => ({ value: k, label: CATEGORY_LABELS[k] }));
    const opts = [{ value: '', label: 'All Categories' }].concat(catOpts);
    const wrap = document.getElementById('tdd-wrap-iptv-category');
    if (wrap) {
      wrap.outerHTML = TVDropdown.html('iptv-category', opts, '');
      TVDropdown.mount('iptv-category', v => { _selCategory = v; refreshChannels(); });
    }
  }

  // ── Render ──────────────────────────────────────────────
  async function render(container) {
    container.innerHTML = `
      <div id="iptv-page" class="iptv-layout" style="height:1080px;">

        <!-- Left sidebar: filters + channel list -->
        <div class="iptv-sidebar">
          <div style="padding:20px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"
                width="20" height="20">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <path d="M8 19v2M16 19v2M2 10h20"/>
              </svg>
              <span class="iptv-sidebar-title">Live TV</span>
            </div>

            <div class="iptv-filter-label">Country</div>
            ${TVDropdown.html('iptv-country', [{ value: '', label: 'All Countries' }], '')}

            <div class="iptv-filter-label" style="margin-top:12px;">Category</div>
            ${TVDropdown.html('iptv-category', [{ value: '', label: 'All Categories' }], '')}

            <button id="iptv-ghana-toggle" data-nav tabindex="0"
              class="iptv-working-btn${_selCountry === 'GH' ? ' active' : ''}" style="margin-top:8px;">
              🇬🇭 Ghana Direct
            </button>
            <button id="iptv-working-toggle" data-nav tabindex="0"
              class="iptv-working-btn${_showWorkingOnly ? ' active' : ''}">
              <span class="ch-status ch-status-ok" style="position:static;width:9px;height:9px;display:inline-block;flex-shrink:0;"></span>
              Working channels only
            </button>
          </div>

          <div class="channel-list" id="iptv-channel-list" data-scroll>
            ${Array.from({length:8}, () => `
              <div class="channel-item">
                <div class="channel-logo skeleton" style="width:44px;height:44px;"></div>
                <div style="flex:1;">
                  <div class="skeleton" style="height:13px;width:75%;border-radius:3px;margin-bottom:6px;"></div>
                  <div class="skeleton" style="height:10px;width:45%;border-radius:3px;"></div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Right: player -->
        <div class="iptv-player">
          <div class="iptv-player-area" id="iptv-player-area">
            <div class="iptv-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <path d="M8 19v2M16 19v2M2 10h20"/>
              </svg>
              <p>Select a channel to watch</p>
            </div>
          </div>
          <div class="iptv-channel-bar" id="iptv-channel-bar">
            <span class="iptv-idle-text">No channel selected</span>
          </div>
        </div>

      </div>`;

    Nav.reset(container);

    // Wire initial empty dropdowns then rebuild with real data
    TVDropdown.mount('iptv-country', v => { _selCountry = v; refreshChannels(); });
    TVDropdown.mount('iptv-category', v => { _selCategory = v; refreshChannels(); });

    // Ghana Direct — just set country filter to GH (index.m3u covers all countries)
    var ghanaBtn = document.getElementById('iptv-ghana-toggle');
    if (ghanaBtn) {
      ghanaBtn.addEventListener('click', function() {
        _selCountry = _selCountry === 'GH' ? '' : 'GH';
        ghanaBtn.classList.toggle('active', _selCountry === 'GH');
        refreshChannels();
      });
    }

    // Working-only toggle
    var workingBtn = document.getElementById('iptv-working-toggle');
    if (workingBtn) {
      workingBtn.addEventListener('click', function() {
        applyWorkingFilter(!_showWorkingOnly);
      });
    }

    // Load meta + channels in parallel
    await Promise.all([
      buildCountryOptions(),
      buildCategoryOptions(),
      refreshChannels(),
    ]);

    // Re-establish focus after dropdowns are rebuilt (outerHTML replacement detaches old elements)
    Nav.reset(container);
  }

  function onLeave() {
    stopKeyListener();
    stopAvPlay();
    document.body.classList.remove('avplay-on');
    if (_videoEl) {
      try { _videoEl.pause(); _videoEl.src = ''; } catch (e) {}
      _videoEl = null;
    }
    _activeChannel = null;
    // Remove channel scroll handler to prevent memory leak
    var list = document.getElementById('iptv-channel-list');
    if (list && _chanScrollHandler) list.removeEventListener('scroll', _chanScrollHandler);
    _chanScrollHandler  = null;
    _channelOffset      = 0;
    _showWorkingOnly    = false;
    _streamUrls         = [];
    _streamIdx          = 0;
    _reconnectCount     = 0;
    resetStall();
  }

  return { render, onLeave };
})();

