﻿﻿﻿const PlayerPage = (() => {

  const SOURCES = [
    {
      id: 'vidsrc-xyz',
      label: 'Source 1',
      movieUrl: id       => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
      tvUrl:  (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      id: 'vidsrc',
      label: 'Source 2',
      movieUrl: id       => `https://vidsrc.to/embed/movie/${id}`,
      tvUrl:  (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
    },
    {
      id: 'videasy',
      label: 'Source 3',
      movieUrl: id       => `${Config.VIDEASY_BASE}/embed/movie/${id}`,
      tvUrl:  (id, s, e) => `${Config.VIDEASY_BASE}/embed/tv/${id}/${s}/${e}`,
    },
    {
      id: 'vsembed',
      label: 'Source 4',
      movieUrl: id       => `${Config.VSEMBED_BASE}/embed/movie/${id}`,
      tvUrl:  (id, s, e) => `${Config.VSEMBED_BASE}/embed/tv/${id}/${s}/${e}`,
    },
  ];

  let _params = {};
  let _activeSourceIdx = 0;
  let _currentSeason = 1;
  let _currentEpisode = 1;
  let _seriesDetails = null;
  let _availableQualities = [];
  let _hlsInstance = null;  // active hls.js instance — must be destroyed before swapping streams

  // ── Player UI auto-hide + progress tracking ───────────
  let _hideTimer = null, _uiHidden = false, _keyListener = null;
  let _progressInterval = null, _titleCache = '', _posterCache = '', _durationMs = 0;

  // ── Quality switching state ────────────────────────────
  let _resumePos = 0;        // ms to seek to after a quality switch
  let _qualityHeaders = null; // headers from the resolved stream — reused on quality change

  function showPlayerUI() {
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.remove('player-ui-hidden');
    _uiHidden = false;
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
    // Focus the relevant panel: episodes for series, suggestions for movies
    setTimeout(function() {
      var ep  = document.querySelector('#episode-list .episode-item');
      var sim = document.querySelector('#similar-panel .similar-item');
      var btn = document.querySelector('.player-back');
      if (ep) Nav.focusEl(ep); else if (sim) Nav.focusEl(sim); else if (btn) Nav.focusEl(btn);
    }, 80);
  }

  function hidePlayerUI() {
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('player-ui-hidden');
    _uiHidden = true;
  }

  var PLAY_PATH  = 'M8 5v14l11-7z';
  var PAUSE_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

  function updatePlayIcon(playing) {
    var icon = document.getElementById('ctrl-play-icon');
    if (!icon) return;
    var path = icon.querySelector('path');
    if (path) path.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
  }

  function formatTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60); s = s % 60;
    var h = Math.floor(m / 60); m = m % 60;
    return h > 0 ? (h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s)
                 : (m + ':' + (s < 10 ? '0' : '') + s);
  }

  function updateProgress() {
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try {
      var pos = webapis.avplay.getCurrentTime();
      var dur = _durationMs || 1;
      var pct = Math.min(100, (pos / dur) * 100).toFixed(1);
      var fill = document.getElementById('progress-fill');
      var time = document.getElementById('player-time');
      if (fill) fill.style.width = pct + '%';
      if (time) time.textContent = formatTime(pos) + ' / ' + formatTime(dur);
    } catch(e) {}
  }

  function togglePlayPause() {
    // Web fallback (video element)
    var video = document.getElementById('web-video');
    if (video) {
      if (video.paused) { video.play(); updatePlayIcon(true); setPlayerStatus(''); }
      else { video.pause(); updatePlayIcon(false); setPlayerStatus('Paused'); }
      return;
    }
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try {
      var s = webapis.avplay.getState();
      if (s === 'PLAYING') { webapis.avplay.pause(); updatePlayIcon(false); setPlayerStatus('Paused'); }
      else if (s === 'PAUSED') { webapis.avplay.play(); updatePlayIcon(true); setPlayerStatus(''); }
    } catch(e) {}
  }

  function seekRelative(ms) {
    // Web fallback
    var video = document.getElementById('web-video');
    if (video) { video.currentTime = Math.max(0, video.currentTime + ms / 1000); return; }
    if (typeof webapis === 'undefined' || !webapis.avplay) return;
    try { webapis.avplay.seekTo(Math.max(0, webapis.avplay.getCurrentTime() + ms)); } catch(e) {}
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
    stopMediaKeys(); // hand off from buffering listener to full player listener
    _keyListener = function(e) {
      // Self-clean if player modal is no longer visible
      var _modal = document.getElementById('player-modal');
      if (!_modal || _modal.classList.contains('hidden')) {
        document.removeEventListener('keydown', _keyListener, true);
        _keyListener = null;
        return;
      }

      var k = e.keyCode;

      // ── Media keys work regardless of UI visibility ─────
      if (k === Config.KEYS.PLAY || k === Config.KEYS.PLAY_PAUSE || k === 415 || k === 10252) {
        togglePlayPause(); e.stopPropagation(); e.preventDefault();
        showPlayerUI(); return;
      }
      if (k === Config.KEYS.PAUSE || k === 19) {
        togglePlayPause(); e.stopPropagation(); e.preventDefault();
        showPlayerUI(); return;
      }
      if (k === Config.KEYS.FF || k === 417) {
        seekRelative(30000); e.stopPropagation(); e.preventDefault();
        showPlayerUI(); return;
      }
      if (k === Config.KEYS.RW || k === 412) {
        seekRelative(-10000); e.stopPropagation(); e.preventDefault();
        showPlayerUI(); return;
      }
      if (k === Config.KEYS.STOP || k === 413) {
        e.stopPropagation(); e.preventDefault();
        closePlayer(); return;
      }

      // ── Seek via LEFT/RIGHT when progress track is focused ──────
      var focusedEl = document.querySelector('.nav-focused');
      var onTrack = focusedEl && focusedEl.id === 'seek-track';
      if (onTrack && (k === 37 || k === Config.KEYS.LEFT)) {
        seekRelative(-15000); e.stopPropagation(); e.preventDefault(); return;
      }
      if (onTrack && (k === 39 || k === Config.KEYS.RIGHT)) {
        seekRelative(15000); e.stopPropagation(); e.preventDefault(); return;
      }

      // ── Enter: allow on Back, control buttons and dropdown elements ─
      if (k === Config.KEYS.ENTER || k === 13) {
        var focused = document.querySelector('.nav-focused');
        var isBack     = focused && focused.classList.contains('player-back');
        var isCtrl     = focused && focused.classList.contains('ctrl-btn');
        var isTrigger  = focused && focused.hasAttribute('data-tdd-trigger');
        var isDDOpt    = focused && focused.hasAttribute('data-tdd-opt');
        if (!isBack && !isCtrl && !isTrigger && !isDDOpt) {
          if (_uiHidden) showPlayerUI();
          e.stopPropagation(); e.preventDefault();
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
    document.addEventListener('keydown', _keyListener, true);
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
  }

  function stopAutoHide() {
    if (_keyListener) { document.removeEventListener('keydown', _keyListener, true); _keyListener = null; }
    if (_hideTimer)   { clearTimeout(_hideTimer); _hideTimer = null; }
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.remove('player-ui-hidden');
    _uiHidden = false;
  }

  // ── Persistent media-key listener (active from modal open, not stream start) ──
  // Works even while stream is still loading / buffering
  var _mediaKeyListener = null;
  function startMediaKeys() {
    if (_mediaKeyListener) return;
    _mediaKeyListener = function(e) {
      var k = e.keyCode;
      var modal = document.getElementById('player-modal');
      if (!modal || modal.classList.contains('hidden')) {
        document.removeEventListener('keydown', _mediaKeyListener, true);
        _mediaKeyListener = null;
        return;
      }
      if (k === 415 || k === 10252 || k === Config.KEYS.PLAY || k === Config.KEYS.PLAY_PAUSE) {
        togglePlayPause(); showPlayerUI(); e.stopPropagation(); e.preventDefault();
      } else if (k === 19 || k === Config.KEYS.PAUSE) {
        togglePlayPause(); showPlayerUI(); e.stopPropagation(); e.preventDefault();
      } else if (k === 417 || k === Config.KEYS.FF) {
        seekRelative(30000); showPlayerUI(); e.stopPropagation(); e.preventDefault();
      } else if (k === 412 || k === Config.KEYS.RW) {
        seekRelative(-10000); showPlayerUI(); e.stopPropagation(); e.preventDefault();
      } else if (k === 413 || k === Config.KEYS.STOP) {
        e.stopPropagation(); e.preventDefault();
        closePlayer();
      }
    };
    document.addEventListener('keydown', _mediaKeyListener, true);
  }
  function stopMediaKeys() {
    if (_mediaKeyListener) { document.removeEventListener('keydown', _mediaKeyListener, true); _mediaKeyListener = null; }
  }

  // ── AVPlay helpers ────────────────────────────────────
  function stopAvPlay() {
    // Save final position before stopping
    if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null; }
    // Destroy hls.js instance so segments stop loading and no stale events fire.
    if (_hlsInstance) { try { _hlsInstance.destroy(); } catch(e) {} _hlsInstance = null; }
    if (typeof NexPlayDB !== 'undefined' && typeof webapis !== 'undefined' && webapis.avplay) {
      try {
        var pos = webapis.avplay.getCurrentTime();
        if (pos > 0) {
          NexPlayDB.saveProgress(_params.id, _params.type || 'movie',
            _titleCache, _posterCache, pos, _durationMs, _currentSeason, _currentEpisode);
        }
      } catch(e) {}
    }
    try {
      if (typeof webapis !== 'undefined' && webapis.avplay) {
        const state = webapis.avplay.getState();
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
    const el = document.getElementById('player-status');
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
          if (src) { showIframeEmbed(_params.type === 'tv' ? src.tvUrl(_params.id, _currentSeason, _currentEpisode) : src.movieUrl(_params.id)); return; }
        }
      }
      setPlayerStatus('Stream unavailable for this title');
      return;
    }
    _activeSourceIdx = idx;
    setPlayerStatus(idx === 0 ? 'Loading...' : 'Trying another source...');

    // Scrape the embed page to extract a direct .m3u8/.mp4 URL.
    // Falls back to iframe embed when scraping yields nothing (most dynamic players).
    const embedUrl = buildUrl(idx);
    if (typeof StreamResolver !== 'undefined' && StreamResolver.scrapeEmbed) {
      StreamResolver.scrapeEmbed(embedUrl)
        .then(function (result) {
          if (result && result.url) {
            playWithUrl(result.url, result.headers);
          } else {
            trySource(idx + 1);
          }
        })
        .catch(function () {
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
      try { h = btoa(JSON.stringify(headers)); } catch(e) {}
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
      try { _hlsInstance.destroy(); } catch(e) {}
      _hlsInstance = null;
    }

    var area = document.getElementById('avplay-area');
    if (!area) return;
    area.innerHTML = '<video id="web-video" style="width:100%;height:100%;background:#000;" autoplay playsinline></video>';
    var video = document.getElementById('web-video');

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      var hls = new Hls({ enableWorker: false, debug: false, manifestLoadingTimeOut: 120000, manifestLoadingMaxRetry: 3 });
      _hlsInstance = hls;
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      var playerModal = document.getElementById('player-modal');
      if (playerModal) {
        playerModal.addEventListener('mousemove', function() { showPlayerUI(); });
        playerModal.addEventListener('mouseleave', function() {
          if (_hideTimer) clearTimeout(_hideTimer);
          _hideTimer = setTimeout(hidePlayerUI, 1500);
        });
      }
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        console.log('[Player] HLS manifest parsed, playing');
        video.play().catch(function() {});
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
          console.log('[Player] HLS seeking to', Math.round(hlsSeek/1000) + 's');
        }

        video.addEventListener('ended', function() {
          if (_params.playlist === 'watchlist') goNextInPlaylist();
        });
        if (_progressInterval) clearInterval(_progressInterval);
        _progressInterval = setInterval(function() {
          if (!video || video.paused) return;
          var dur = video.duration * 1000 || 1;
          var pos = video.currentTime * 1000;
          var pct = Math.min(100, (pos / dur) * 100).toFixed(1);
          var fill = document.getElementById('progress-fill');
          var time = document.getElementById('player-time');
          if (fill) fill.style.width = pct + '%';
          if (time) time.textContent = formatTime(pos) + ' / ' + formatTime(dur);
        }, 3000);
      });
      hls.on(Hls.Events.ERROR, function(ev, data) {
        console.error('[Player] HLS error:', data.type, data.details, data.fatal);
        if (data.fatal) { trySource(0); }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playUrl;
      video.play().catch(function(e) { console.error('[Player] Native HLS error:', e); });
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
        onbufferingstart:    function() { setPlayerStatus('Buffering...'); },
        onbufferingcomplete: function() { setPlayerStatus(''); updatePlayIcon(true); },
        oncompletion: function() {
          if (_params.playlist === 'watchlist') goNextInPlaylist();
        },
        onerror: function(e) {
          console.error('[Player] AVPlay error:', e);
          document.body.classList.remove('movie-avplay-on');
          trySource(0);
        },
      });

      webapis.avplay.prepareAsync(
        function() {
          console.log('[Player] prepareAsync success');
          webapis.avplay.play();
          setPlayerStatus('');
          updatePlayIcon(true);
          startAutoHide();
          // Get duration for progress tracking
          try { _durationMs = webapis.avplay.getDuration(); } catch(e) { _durationMs = 0; }
          // Save to watch history
          if (typeof NexPlayDB !== 'undefined') {
            NexPlayDB.addToHistory(_params.id, _params.type || 'movie',
              _titleCache, _posterCache, _currentSeason, _currentEpisode);
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
              console.log('[Player] Seeking to', Math.round(seekTarget/1000) + 's');
            } catch(e) {}
          }
          // Update progress bar + auto-save every 3s
          if (_progressInterval) clearInterval(_progressInterval);
          _progressInterval = setInterval(function() {
            updateProgress();
            if (typeof NexPlayDB !== 'undefined') {
              try {
                var pos = webapis.avplay.getCurrentTime();
                if (pos > 0) NexPlayDB.saveProgress(_params.id, _params.type || 'movie',
                  _titleCache, _posterCache, pos, _durationMs, _currentSeason, _currentEpisode);
              } catch(e) {}
            }
          }, 3000);
        },
        function(e) {
          console.error('[Player] prepareAsync error:', e);
          document.body.classList.remove('movie-avplay-on');
          trySource(0);
        }
      );
    } catch(e) {
      console.error('[Player] playWithUrl exception:', e.message);
      document.body.classList.remove('movie-avplay-on');
      trySource(0);
    }
  }

  function loadBestSource() {
    if (typeof StreamResolver === 'undefined') { trySource(0); return; }

    setPlayerStatus('Resolving stream...');

    var metaPromise = _params.type === 'tv'
      ? TMDB.tvDetails(parseInt(_params.id)).then(function(d) {
          return { title: d.name || '', year: parseInt((d.first_air_date || '2020').slice(0, 4)) };
        })
      : TMDB.details(parseInt(_params.id)).then(function(d) {
          return { title: d.title || '', year: parseInt((d.release_date || '2020').slice(0, 4)) };
        });

    var outerTimeout = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('timeout')); }, 25000);
    });

    Promise.race([metaPromise, outerTimeout])
      .then(function(meta) {
        var resolvePromise = _params.type === 'tv'
          ? StreamResolver.resolveTVEpisode(_params.id, meta.title, _currentSeason, _currentEpisode)
          : StreamResolver.resolveMovie(_params.id, meta.title, meta.year);

        var innerTimeout = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('resolve timeout')); }, 25000);
        });

        return Promise.race([resolvePromise, innerTimeout]);
      })
      .then(function(result) {
        if (result && result.url) {
          _availableQualities = result.qualities || [];
          _qualityHeaders = result.headers || null; // keep for quality switching
          console.log('[Player] stream resolved:', result.url.slice(0, 60));
          setPlayerStatus('Starting playback...');
          playWithUrl(result.url, result.headers);
          renderQualityDropdown();
        } else {
          console.log('[Player] no stream, falling back to embeds');
          trySource(0);
        }
      })
      .catch(function(e) {
        console.log('[Player] loadBestSource failed:', e.message);
        trySource(0);
      });
  }

  function buildUrl(sourceIdx) {
    const src = SOURCES[sourceIdx];
    const { id, type } = _params;
    return type === 'tv'
      ? src.tvUrl(id, _currentSeason, _currentEpisode)
      : src.movieUrl(id);
  }

  // â"€â"€ TV Episode panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function buildEpisodePanel(seriesId) {
    const panel = document.getElementById('episode-panel');
    if (!panel) return;

    try {
      _seriesDetails = await TMDB.tvDetails(seriesId);
    } catch {
      panel.innerHTML = '';
      return;
    }

    const seasons = (_seriesDetails.seasons || []).filter(s => s.season_number > 0);
    if (!seasons.length) { panel.innerHTML = ''; return; }

    const seasonOptions = seasons.map(s => ({
      value: String(s.season_number),
      label: `Season ${s.season_number}  (${s.episode_count} eps)`,
    }));

    panel.innerHTML = `
      <div class="ep-panel-header">
        ${TVDropdown.html('season-dd', seasonOptions, String(_currentSeason))}
      </div>
      <div class="episode-list" id="episode-list" data-scroll>
        <div style="padding:12px;text-align:center;color:rgba(240,240,248,0.45);">Loading...</div>
      </div>`;

    TVDropdown.mount('season-dd', v => {
      _currentSeason  = parseInt(v);
      _currentEpisode = 1;
      loadEpisodes(_currentSeason);
      loadBestSource();
    });

    loadEpisodes(_currentSeason);
  }

  async function loadEpisodes(seasonNumber) {
    const list = document.getElementById('episode-list');
    if (!list) return;

    try {
      const season = await TMDB.tvSeason(_params.id, seasonNumber);
      const episodes = season.episodes || [];

      list.innerHTML = episodes.map(ep => {
        const still = ep.still_path ? TMDB.img(ep.still_path, Config.IMG.POSTER_SM) : '';
        const active = ep.episode_number === _currentEpisode ? 'active' : '';
        return `
          <div class="episode-item ${active}" data-nav data-ep="${ep.episode_number}" tabindex="0">
            <div class="ep-thumb">
              ${still
                ? `<img src="${still}" alt="Ep ${ep.episode_number}" loading="lazy">`
                : `<div class="ep-thumb-placeholder">></div>`}
              <div class="ep-num-badge">${ep.episode_number}</div>
            </div>
            <div class="ep-info">
              <div class="ep-title">${ep.name || `Episode ${ep.episode_number}`}</div>
              <div class="ep-meta">${ep.runtime ? ep.runtime + 'm' : ''}</div>
            </div>
          </div>`;
      }).join('');

      list.querySelectorAll('[data-ep]').forEach(el => {
        el.addEventListener('click', () => {
          _currentEpisode = parseInt(el.dataset.ep);
          list.querySelectorAll('[data-ep]').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          loadBestSource();
        });
      });

      Nav.reset(document.getElementById('player-modal'));
    } catch (err) {
      list.innerHTML = `<div class="error-msg" style="font-size:13px;">Could not load episodes</div>`;
    }
  }

  // ── Go to next item in watchlist playlist ──────────────
  function goNextInPlaylist() {
    if (typeof NexPlayDB === 'undefined') return;
    var list = NexPlayDB.getWatchlist();
    if (!list.length) return;
    var currentId   = String(_params.id);
    var currentType = _params.type || 'movie';
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === currentId && list[i].type === currentType) { idx = i; break; }
    }
    if (idx >= 0 && idx < list.length - 1) {
      var next = list[idx + 1];
      var content = document.getElementById('main-content');
      render(content, { id: next.id, type: next.type || 'movie', season: 1, episode: 1, playlist: 'watchlist' });
    } else {
      App.showToast('End of Watchlist');
    }
  }

  // ── Watchlist playlist panel ────────────────────────────
  function buildWatchlistPanel(items, currentId, currentType) {
    if (!items || !items.length) return '';
    var curId = String(currentId);
    return `
      <div id="similar-panel" class="similar-panel">
        <div class="similar-header">Watchlist</div>
        <div class="similar-list" data-scroll>
          ${items.map(function(item) {
            var isCurrent = item.id === curId && item.type === currentType;
            return `
              <div class="similar-item${isCurrent ? ' playlist-current' : ''}" data-nav
                data-id="${item.id}" data-type="${item.type || 'movie'}" tabindex="0">
                <div class="similar-thumb">
                  ${item.poster ? `<img src="${item.poster}" loading="lazy">` : '<div class="ep-thumb-placeholder">🎬</div>'}
                </div>
                <div class="ep-info">
                  <div class="ep-title">${item.title || ''}</div>
                  <div class="ep-meta" style="${isCurrent ? 'color:var(--accent);' : ''}">
                    ${isCurrent ? 'Now Playing' : 'Up next'}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // â"€â"€ Similar panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function buildSimilarPanel(items, type) {
    if (!items || !items.length) return '';
    return `
      <div id="similar-panel" class="similar-panel">
        <div class="similar-header">You Might Also Like</div>
        <div class="similar-list" data-scroll>
          ${items.slice(0, 15).map(item => {
            const poster = item.poster_path ? TMDB.img(item.poster_path, Config.IMG.POSTER_SM) : '';
            const title  = item.title || item.name || '';
            const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
            const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
            return `
              <div class="similar-item" data-nav
                data-id="${item.id}" data-type="${type}" tabindex="0">
                <div class="similar-thumb">
                  ${poster ? `<img src="${poster}" loading="lazy">` : '<div class="ep-thumb-placeholder">[movie]</div>'}
                </div>
                <div class="ep-info">
                  <div class="ep-title">${title}</div>
                  <div class="ep-meta">${year}${rating ? '  * ' + rating : ''}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Capture current playback position in ms before a quality switch
  function capturePos() {
    try {
      if (typeof webapis !== 'undefined' && webapis.avplay) {
        var p = webapis.avplay.getCurrentTime();
        if (p > 0) return p;
      }
    } catch(e) {}
    try {
      var vid = document.getElementById('web-video');
      if (vid && vid.currentTime > 0) return Math.floor(vid.currentTime * 1000);
    } catch(e) {}
    return 0;
  }

  function renderQualityDropdown() {
    var wrap = document.getElementById('quality-dd-wrap');
    if (!wrap || !_availableQualities || !_availableQualities.length) return;
    var opts = _availableQualities.map(function(q, i) { return { value: String(i), label: q.label }; });
    var best = _availableQualities.findIndex(function(q) { return q.label === '1080p'; });
    var defaultIdx = best >= 0 ? best : 0;
    wrap.innerHTML = TVDropdown.html('quality-dd', opts, String(defaultIdx));
    wrap.style.display = '';
    TVDropdown.mount('quality-dd', function(val) {
      var qi = parseInt(val);
      var q = _availableQualities[qi];
      if (!q) return;
      _resumePos = capturePos(); // save position before stopping
      var hdrs = _qualityHeaders || { 'Referer': 'https://player.videasy.net/', 'Origin': 'https://player.videasy.net' };
      stopAvPlay();
      setPlayerStatus('Switching quality...');
      playWithUrl(q.url, hdrs);
    });
  }

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function render(container, params = {}) {
    _params = params;
    _currentSeason  = parseInt(params.season  || 1);
    _currentEpisode = parseInt(params.episode || 1);
    _activeSourceIdx = 0;
    _seriesDetails = null;

    const isTV = params.type === 'tv';
    const modal = document.getElementById('player-modal');
    if (!modal) return;

    stopAvPlay();
    modal.classList.remove('hidden');

    modal.innerHTML = `
      <div class="player-header" style="${isTV ? 'margin-right:300px;' : 'margin-right:240px;'}">
        <button class="player-back btn btn-secondary" data-nav tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
      </div>

      <div style="position:relative;display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;-webkit-flex:1;flex:1;overflow:hidden;background:transparent;">
        <div id="avplay-area" style="-webkit-flex:1;flex:1;min-width:0;background:transparent;position:relative;">
          <div id="player-status" class="player-status-overlay">Loading...</div>
        </div>
        ${isTV
          ? `<div id="episode-panel" class="episode-panel"></div>`
          : `<div id="similar-slot"></div>`}
      </div>

      <div class="player-cbar" id="player-cbar" style="${isTV ? 'right:300px;' : 'right:240px;'}">
        <!-- Row 1 (top): controls centered + quality far right -->
        <div class="player-cbar-row2">
          <div class="player-cbar-btns">
            ${isTV ? `<button class="pcb-btn" id="ctrl-prev" data-nav tabindex="0">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              <span>Prev</span></button>` : ''}
            <button class="pcb-btn" id="ctrl-rw" data-nav tabindex="0">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
              <span>-10s</span></button>
            <button class="pcb-btn pcb-play" id="ctrl-play" data-nav tabindex="0">
              <svg id="ctrl-play-icon" viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="pcb-btn" id="ctrl-ff" data-nav tabindex="0">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
              <span>+30s</span></button>
            ${isTV ? `<button class="pcb-btn" id="ctrl-next" data-nav tabindex="0">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 18l8.5-6L6 6v12zm2.5-6l8.5 6V6l-8.5 6z"/><rect x="16" y="6" width="2" height="12"/></svg>
              <span>Next</span></button>` : ''}
          </div>
          <div id="quality-dd-wrap" class="player-cbar-quality">
            ${TVDropdown.html('quality-dd', [{ value: 'auto', label: 'Auto' }], 'auto')}
          </div>
        </div>
        <!-- Row 2 (bottom): progress track (seekable) + time -->
        <div class="player-cbar-row1">
          <div class="player-cbar-track" id="seek-track" data-nav tabindex="0" title="Left/Right to seek">
            <div id="progress-fill" class="player-cbar-fill"></div>
          </div>
          <span id="player-time" class="player-cbar-time">0:00 / 0:00</span>
        </div>
      </div>

      <div class="player-info-bar" style="${isTV ? 'margin-right:300px;' : 'margin-right:240px;'}">
        <div style="-webkit-flex:1;flex:1;min-width:0;">
          <div class="player-title" id="player-title">Loading...</div>
          <div class="player-meta" id="player-meta"></div>
        </div>
      </div>`;

    modal.querySelector('.player-back').addEventListener('click', closePlayer);
    TVDropdown.mount('quality-dd', function(val) {
      var qi = parseInt(val);
      var q = _availableQualities && _availableQualities[qi];
      if (!q) return;
      _resumePos = capturePos();
      var hdrs = _qualityHeaders || { 'Referer': 'https://player.videasy.net/', 'Origin': 'https://player.videasy.net' };
      stopAvPlay(); setPlayerStatus('Switching quality...'); playWithUrl(q.url, hdrs);
    });
    startMediaKeys(); // active immediately on modal open

    // Wire media control buttons
    var rwBtn   = document.getElementById('ctrl-rw');
    var playBtn = document.getElementById('ctrl-play');
    var ffBtn   = document.getElementById('ctrl-ff');
    if (rwBtn)   rwBtn.addEventListener('click',   function() { seekRelative(-10000); showPlayerUI(); });
    if (playBtn) playBtn.addEventListener('click',  function() { togglePlayPause(); });
    if (ffBtn)   ffBtn.addEventListener('click',   function() { seekRelative(30000);  showPlayerUI(); });
    var prevBtn = document.getElementById('ctrl-prev');
    var nextBtn = document.getElementById('ctrl-next');
    if (prevBtn) prevBtn.addEventListener('click', function() { goPrevEpisode(); showPlayerUI(); });
    if (nextBtn) nextBtn.addEventListener('click', function() { goNextEpisode(); showPlayerUI(); });

    Nav.reset(modal);
    loadBestSource();

    if (params.id) {
      try {
        if (isTV) {
          const [details] = await Promise.all([
            TMDB.tvDetails(parseInt(params.id)),
            buildEpisodePanel(parseInt(params.id)),
          ]);
          // Cache for progress tracking
          _titleCache  = details.name || '';
          _posterCache = details.poster_path ? TMDB.img(details.poster_path, Config.IMG.POSTER_SM) : '';
          const titleEl = document.getElementById('player-title');
          const metaEl  = document.getElementById('player-meta');
          if (titleEl) titleEl.textContent = details.name || '';
          if (metaEl) {
            const year    = (details.first_air_date || '').slice(0, 4);
            const rating  = details.vote_average ? `* ${details.vote_average.toFixed(1)}` : '';
            const genres  = (details.genres || []).slice(0, 3).map(g => g.name).join(' . ');
            const seasons = details.number_of_seasons ? `${details.number_of_seasons} seasons` : '';
            metaEl.textContent = [year, seasons, rating, genres].filter(Boolean).join('  |  ');
          }
          const similarSlot = document.getElementById('similar-slot');
          if (similarSlot && details.similar && details.similar.results && details.similar.results.length) {
            similarSlot.outerHTML = buildSimilarPanel(details.similar.results, 'tv');
            document.querySelectorAll('.similar-item').forEach(el => {
              el.addEventListener('click', () =>
                render(container, { id: el.dataset.id, type: el.dataset.type, season: 1, episode: 1 })
              );
            });
          }
        } else {
          const details = await TMDB.details(parseInt(params.id));
          // Cache for progress tracking
          _titleCache  = details.title || '';
          _posterCache = details.poster_path ? TMDB.img(details.poster_path, Config.IMG.POSTER_SM) : '';
          const titleEl = document.getElementById('player-title');
          const metaEl  = document.getElementById('player-meta');
          if (titleEl) titleEl.textContent = details.title || '';
          if (metaEl) {
            const year    = (details.release_date || '').slice(0, 4);
            const rating  = details.vote_average ? `* ${details.vote_average.toFixed(1)}` : '';
            const runtime = details.runtime ? TMDB.formatRuntime(details.runtime) : '';
            const genres  = (details.genres || []).slice(0, 3).map(g => g.name).join(' . ');
            metaEl.textContent = [year, runtime, rating, genres].filter(Boolean).join('  |  ');
          }
          const similarSlot = document.getElementById('similar-slot');
          if (similarSlot) {
            if (_params.playlist === 'watchlist' && typeof NexPlayDB !== 'undefined') {
              // Show watchlist as playlist sidebar
              var wlItems = NexPlayDB.getWatchlist();
              if (wlItems.length) {
                similarSlot.outerHTML = buildWatchlistPanel(wlItems, _params.id, _params.type || 'movie');
                document.querySelectorAll('.similar-item').forEach(function(el) {
                  el.addEventListener('click', function() {
                    render(container, { id: el.dataset.id, type: el.dataset.type || 'movie', season: 1, episode: 1, playlist: 'watchlist' });
                  });
                });
              }
            } else if (details.similar && details.similar.results && details.similar.results.length) {
              similarSlot.outerHTML = buildSimilarPanel(details.similar.results, 'movie');
              document.querySelectorAll('.similar-item').forEach(function(el) {
                el.addEventListener('click', function() {
                  render(container, { id: el.dataset.id, type: 'movie' });
                });
              });
            }
          }
        }
        Nav.reset(modal);
      } catch (err) {
        console.error('Player metadata error:', err);
      }
    }
  }

  function closePlayer() {
    stopAutoHide();
    stopMediaKeys();
    stopAvPlay();
    const modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('hidden');
    Nav.reset(document.getElementById('main-content'));
  }

  function onLeave() { closePlayer(); }

  return { render, closePlayer, onLeave };
})();


