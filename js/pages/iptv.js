const IPTVPage = (() => {
  let _channels = [];
  let _filtered = [];
  let _activeChannel = null;
  let _countries = [];
  let _categories = [];
  let _selCountry = '';
  let _selCategory = '';
  let _videoEl = null;
  let _hlsInstance = null;
  let _hideTimer = null;
  let _uiHidden = false;
  let _keyListener = null;

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

  // ── Channel list item ──────────────────────────────────
  function channelItem(ch, isActive = false) {
    const catLabel = (ch.categories || [])
      .map(c => CATEGORY_LABELS[c] || c)
      .slice(0, 2)
      .join(', ');
    return `
      <div class="channel-item ${isActive ? 'active' : ''}"
        data-nav data-channel-id="${ch.id}" tabindex="0">
        <div class="channel-logo">
          ${ch.logo
            ? `<img src="${ch.logo}" alt="${ch.name}" loading="lazy" onerror="this.style.display='none'">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M8 19v2M16 19v2M2 10h20"/>
               </svg>`}
        </div>
        <div style="overflow:hidden;flex:1;">
          <div class="channel-name">${ch.name || ''}</div>
          ${catLabel ? `<div class="channel-category">${catLabel}</div>` : ''}
        </div>
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
    playerArea.innerHTML = `
      <video id="iptv-video" class="iptv-video" autoplay playsinline
        style="width:100%;height:100%;background:#000;">
        <source src="${streamUrl}" type="application/x-mpegURL">
        <source src="${streamUrl}">
      </video>`;
    _videoEl = document.getElementById('iptv-video');
    if (_videoEl) {
      _videoEl.addEventListener('error', () => {
        if (playerArea) {
          playerArea.innerHTML = `<div class="iptv-placeholder"><p>Stream unavailable on this device</p></div>`;
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
        onbufferingstart:    function () {},
        onbufferingcomplete: function () {},
        onerror: function () {
          stopAvPlay();
          playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
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
            // Start listening for remote presses and begin auto-hide countdown
            startKeyListener();
            resetHideTimer();
          } catch (e) {
            stopAvPlay();
            playWithHTML5(streamUrl, document.getElementById('iptv-player-area'));
          }
        },
        function () {
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
          <div style="font-size:16px;font-weight:700;color:#f0f0f8;">${channel.name}</div>
          <div style="font-size:12px;color:rgba(240,240,248,0.45);">${(channel.categories || []).map(c => CATEGORY_LABELS[c] || c).join(' · ')}</div>
        </div>`;
    }

    const playerArea = document.getElementById('iptv-player-area');
    if (playerArea) {
      playerArea.innerHTML = `<div class="iptv-placeholder"><div class="spinner"></div><p>Connecting...</p></div>`;
    }

    let streamUrl = null;
    try {
      streamUrl = await IPTV.getStreamUrl(channel.id);
    } catch (err) {}

    if (!streamUrl) {
      if (playerArea) {
        playerArea.innerHTML = `<div class="iptv-placeholder"><p>Stream unavailable</p></div>`;
      }
      return;
    }

    // Try AVPlay first (Samsung native), fall back to HTML5
    if (!playWithAvPlay(streamUrl, playerArea)) {
      playWithHTML5(streamUrl, playerArea);
    }
  }

  // ── Refresh filtered channel list ──────────────────────
  async function refreshChannels() {
    const list = document.getElementById('iptv-channel-list');
    if (!list) return;

    list.innerHTML = `<div style="padding:20px;text-align:center;">
      <div class="spinner" style="margin:0 auto;"></div></div>`;

    try {
      _filtered = await IPTV.filterChannels({
        country: _selCountry,
        category: _selCategory,
      });

      if (!_filtered.length) {
        list.innerHTML = `<div style="padding:20px;text-align:center;color:rgba(240,240,248,0.45);font-size:14px;">
          No channels found for this filter</div>`;
        return;
      }

      // Limit to 60 — D-pad nav struggles with large focusable lists
      const toShow = _filtered.slice(0, 60);
      list.innerHTML = toShow.map(ch =>
        channelItem(ch, _activeChannel && _activeChannel.id === ch.id)
      ).join('');

      list.querySelectorAll('[data-channel-id]').forEach(el => {
        el.addEventListener('click', () => {
          const ch = _filtered.find(c => c.id === el.dataset.channelId);
          if (ch) playChannel(ch);
        });
      });
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
              <span style="font-size:18px;font-weight:800;color:#f0f0f8;">Live TV</span>
            </div>

            <div class="iptv-filter-label">Country</div>
            ${TVDropdown.html('iptv-country', [{ value: '', label: 'All Countries' }], '')}

            <div class="iptv-filter-label" style="margin-top:12px;">Category</div>
            ${TVDropdown.html('iptv-category', [{ value: '', label: 'All Categories' }], '')}
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
            <span style="font-size:14px;color:rgba(240,240,248,0.45);">No channel selected</span>
          </div>
        </div>

      </div>`;

    Nav.reset(container);

    // Wire initial empty dropdowns then rebuild with real data
    TVDropdown.mount('iptv-country', v => { _selCountry = v; refreshChannels(); });
    TVDropdown.mount('iptv-category', v => { _selCategory = v; refreshChannels(); });

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
  }

  return { render, onLeave };
})();

