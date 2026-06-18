﻿﻿﻿const PlayerPage = (() => {

  const SOURCES = [
    {
      id: 'vidsrc-wtf',
      label: 'VidSrc WTF',
      movieUrl: id       => `https://www.vidsrc.wtf/1/movie/${id}`,
      tvUrl:  (id, s, e) => `https://www.vidsrc.wtf/1/tv/${id}/${s}/${e}`,
    },
    {
      id: 'videasy',
      label: 'Videasy',
      movieUrl: id       => `https://player.videasy.to/movie/${id}`,
      tvUrl:  (id, s, e) => `https://player.videasy.to/tv/${id}/${s}/${e}`,
    },
    {
      id: 'vsembed',
      label: 'Source 1',
      movieUrl: id       => `${Config.VSEMBED_BASE}/embed/movie?tmdb=${id}`,
      tvUrl:  (id, s, e) => `${Config.VSEMBED_BASE}/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      id: '2embed',
      label: 'Source 2',
      movieUrl: id       => `https://www.2embed.cc/embed/${id}`,
      tvUrl:  (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    },
    {
      id: 'vidsrc-me',
      label: 'Source 3',
      movieUrl: id       => `https://vidsrc.me/embed/movie?tmdb=${id}`,
      tvUrl:  (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      id: 'vidsrc',
      label: 'Source 4',
      movieUrl: id       => `https://vidsrc.to/embed/movie/${id}`,
      tvUrl:  (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
    },
  ];

  let _params = {};
  let _activeSourceIdx = 0;
  let _currentSeason = 1;
  let _currentEpisode = 1;
  let _seriesDetails = null;
  let _availableQualities = [];
  let _hlsInstance      = null;  // active hls.js instance — must be destroyed before swapping streams
  let _wtClient         = null;  // active WebTorrent client — destroyed on stream switch
  let _currentStreamUrl      = null;  // original (un-proxied) stream URL — used by download
  let _dlXhr                 = null;  // active download XHR — cancelled on player close
  let _hlsDownloadController = null;  // AbortController for HLS segment downloads

  // ── Player UI auto-hide + progress tracking ───────────
  let _hideTimer = null, _uiHidden = false, _keyListener = null;
  let _progressInterval = null, _titleCache = '', _posterCache = '', _durationMs = 0;

  // ── Quality switching state ────────────────────────────
  let _resumePos = 0;        // ms to seek to after a quality switch
  let _qualityHeaders = null; // headers from the resolved stream — reused on quality change
  let _streamErrorRetries = 0; // re-resolution attempts before falling back to embed scraping

  // ── Seek-bar scrub state ───────────────────────────────
  var _seekMode     = false;  // true while user is scrubbing the progress bar
  var _seekPreview  = 0;      // target position (ms) being previewed
  var _subSyncTimer = null;   // interval ID for TV subtitle sync
  var _subCues      = [];     // parsed VTT cues [{start,end,text}]
  var _autoplayEnabled = false; // persisted as np_pref_autoplay
  var _autoplayTimer   = null;  // setInterval for countdown overlay

  // ── Embed-mode focus toast ─────────────────────────────
  var _embedFocusHandler = null;
  function _addEmbedFocusToast() {
    _removeEmbedFocusToast();
    _embedFocusHandler = function() {
      // User switched back to this tab — confirm embed is still running
      if (typeof App !== 'undefined') {
        App.showToast('Movie still playing above ↑');
      }
    };
    window.addEventListener('focus', _embedFocusHandler);
  }
  function _removeEmbedFocusToast() {
    if (_embedFocusHandler) {
      window.removeEventListener('focus', _embedFocusHandler);
      _embedFocusHandler = null;
    }
  }

  function showPlayerUI() {
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.remove('player-ui-hidden');
    _uiHidden = false;
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
    // TV series → episode list (quick episode switching).
    // Movies → play button (most common action when UI appears mid-stream).
    setTimeout(function() {
      var ep   = document.querySelector('#episode-list .episode-item');
      var play = document.getElementById('ctrl-play');
      var sim  = document.querySelector('#similar-panel .similar-item');
      var btn  = document.querySelector('.player-back');
      if (ep) Nav.focusEl(ep);
      else if (play) Nav.focusEl(play);
      else if (sim) Nav.focusEl(sim);
      else if (btn) Nav.focusEl(btn);
    }, 80);
  }

  function hidePlayerUI() {
    // Never auto-hide while the user is scrubbing the progress bar
    if (_seekMode) return;
    var modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('player-ui-hidden');
    _uiHidden = true;
  }

  function resetHideTimer() {
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hidePlayerUI, 4000);
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

  // Updates the buffer fill bar — shows how far ahead the stream is buffered vs playback.
  // Color codes: green = well ahead, yellow = within 10%, red = within 3% (about to stall).
  function _updateBufferFill(video, playPct) {
    var buf = document.getElementById('buffer-fill');
    if (!buf || !video) return;
    if (!video.buffered || !video.buffered.length || !video.duration) {
      buf.style.width = '0%'; return;
    }
    var buffEnd = 0;
    try { buffEnd = video.buffered.end(video.buffered.length - 1); } catch(e) { return; }
    var bufPct = Math.min(100, buffEnd / video.duration * 100);
    buf.style.width = bufPct + '%';
    var gap = bufPct - parseFloat(playPct || 0);
    buf.classList.remove('buf-close', 'buf-critical');
    if (gap < 3)  buf.classList.add('buf-critical');  // red  — nearly stalling
    else if (gap < 10) buf.classList.add('buf-close'); // yellow — getting close
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
      // Buffer fill — AVPlay exposes buffered range via streaming property
      var bufEl = document.getElementById('buffer-fill');
      if (bufEl && dur > 1) {
        try {
          var range = webapis.avplay.getStreamingProperty('GET_BUFFER_RANGE');
          if (range && range.end) {
            var bufPct = Math.min(100, (range.end / dur) * 100);
            bufEl.style.width = bufPct + '%';
            var gap = bufPct - parseFloat(pct);
            bufEl.classList.remove('buf-close', 'buf-critical');
            if (gap < 3)       bufEl.classList.add('buf-critical');
            else if (gap < 10) bufEl.classList.add('buf-close');
          }
        } catch(be) {}
      }
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
    try {
      webapis.avplay.seekTo(Math.max(0, webapis.avplay.getCurrentTime() + ms));
    } catch(e) {
      // AVPlay throws on live/sliding-window HLS streams that don't support seeking
      setPlayerStatus('Seek not available for this stream');
      setTimeout(function() { setPlayerStatus(''); }, 2000);
    }
  }

  // ── Seek-bar scrub helpers ────────────────────────────
  function getPlayDur() {
    if (_durationMs > 0) return _durationMs;
    try { if (typeof webapis !== 'undefined' && webapis.avplay) return webapis.avplay.getDuration(); } catch(e) {}
    var vid = document.getElementById('web-video');
    if (vid && vid.duration) return vid.duration * 1000;
    return 0;
  }

  function updateSeekPreview(posMs) {
    var dur = getPlayDur() || 1;
    var pct = Math.min(100, Math.max(0, posMs / dur * 100)).toFixed(1);
    var fill  = document.getElementById('progress-fill');
    var time  = document.getElementById('player-time');
    var track = document.getElementById('seek-track');
    if (fill)  fill.style.width = pct + '%';
    if (time)  time.textContent = '▶ ' + formatTime(posMs) + ' / ' + formatTime(dur);
    if (track) track.classList.add('seeking');
  }

  function commitSeek() {
    var target = _seekPreview;
    _seekMode = false; _seekPreview = 0;
    var track = document.getElementById('seek-track');
    if (track) track.classList.remove('seeking');
    var vid = document.getElementById('web-video');
    if (vid) { vid.currentTime = target / 1000; return; }
    try { if (typeof webapis !== 'undefined' && webapis.avplay) webapis.avplay.seekTo(Math.max(0, target)); }
    catch(e) { setPlayerStatus('Seek not available'); setTimeout(function(){setPlayerStatus('');},2000); }
  }

  function cancelSeek() {
    _seekMode = false; _seekPreview = 0;
    var track = document.getElementById('seek-track');
    if (track) track.classList.remove('seeking');
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

  function _showAutoplayCountdown(onPlay) {
    var existing = document.getElementById('autoplay-countdown');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
    var modal = document.getElementById('player-modal');
    if (!modal) return;
    var overlay = document.createElement('div');
    overlay.id = 'autoplay-countdown';
    overlay.style.cssText = 'position:absolute;bottom:120px;right:40px;background:rgba(10,10,18,0.92);color:#f0f0f8;padding:18px 24px;border-radius:12px;z-index:900;font-size:15px;min-width:220px;box-shadow:0 4px 24px rgba(0,0,0,0.5);';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'margin-bottom:12px;font-weight:600;';
    lbl.textContent = 'Next episode in 5s…';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.setAttribute('data-nav', ''); cancelBtn.setAttribute('tabindex', '0');
    cancelBtn.style.cssText = 'width:100%;font-size:13px;padding:6px 12px;';
    cancelBtn.textContent = 'Cancel';
    overlay.appendChild(lbl);
    overlay.appendChild(cancelBtn);
    modal.appendChild(overlay);
    Nav.reset(modal);
    var count = 5;
    _autoplayTimer = setInterval(function() {
      count--;
      if (count <= 0) {
        clearInterval(_autoplayTimer); _autoplayTimer = null;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        onPlay();
      } else {
        lbl.textContent = 'Next episode in ' + count + 's…';
      }
    }, 1000);
    cancelBtn.addEventListener('click', function() {
      clearInterval(_autoplayTimer); _autoplayTimer = null;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
  }

  function _autoplayNext() {
    if (!_autoplayEnabled || _params.type !== 'tv') return;
    var list = document.getElementById('episode-list');
    var items = list ? list.querySelectorAll('[data-ep]') : [];
    var currentIdx = -1;
    for (var i = 0; i < items.length; i++) {
      if (parseInt(items[i].dataset.ep) === _currentEpisode) { currentIdx = i; break; }
    }
    if (currentIdx !== -1 && currentIdx + 1 < items.length) {
      _showAutoplayCountdown(function() { items[currentIdx + 1].click(); });
      return;
    }
    // Last episode of season — advance to next season
    var seasons = _seriesDetails ? (_seriesDetails.seasons || []).filter(function(s) { return s.season_number > 0; }) : [];
    var nextSeason = null;
    for (var j = 0; j < seasons.length; j++) {
      if (seasons[j].season_number > _currentSeason) { nextSeason = seasons[j]; break; }
    }
    if (!nextSeason) return;
    _showAutoplayCountdown(function() {
      _currentSeason = nextSeason.season_number;
      _currentEpisode = 1;
      loadEpisodes(_currentSeason).then(function() {
        var list2 = document.getElementById('episode-list');
        if (!list2) return;
        var ep1 = list2.querySelector('[data-ep="1"]');
        if (ep1) ep1.click();
      });
    });
  }

  function startAutoHide() {
    stopAutoHide();  // always tear down any stale listener before creating a new one
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
      if (k === Config.KEYS.STOP || k === 413 || k === Config.KEYS.BACK || k === 10009) {
        e.stopPropagation(); e.preventDefault();
        closePlayer(); return;
      }
      if (k === Config.KEYS.INFO || k === 457) {
        e.stopPropagation(); e.preventDefault();
        _toggleWatchingOverlay(); showPlayerUI(); return;
      }

      // ── Seek-bar scrub (LEFT/RIGHT to preview, ENTER to commit) ─
      var focusedEl = document.querySelector('.nav-focused');
      var onTrack   = focusedEl && focusedEl.id === 'seek-track';

      // Cancel scrub mode if focus has left the seek track
      if (_seekMode && !onTrack) cancelSeek();

      if (onTrack && (k === 37 || k === Config.KEYS.LEFT)) {
        if (!_seekMode) { _seekMode = true; _seekPreview = capturePos() || 0; }
        _seekPreview = Math.max(0, _seekPreview - 15000);
        updateSeekPreview(_seekPreview);
        resetHideTimer(); // keep UI visible while scrubbing
        e.stopPropagation(); e.preventDefault(); return;
      }
      if (onTrack && (k === 39 || k === Config.KEYS.RIGHT)) {
        if (!_seekMode) { _seekMode = true; _seekPreview = capturePos() || 0; }
        _seekPreview = Math.min(getPlayDur() || Infinity, _seekPreview + 15000);
        updateSeekPreview(_seekPreview);
        resetHideTimer(); // keep UI visible while scrubbing
        e.stopPropagation(); e.preventDefault(); return;
      }

      // ── Enter: commit scrub seek if on seek track ──────────
      if ((k === Config.KEYS.ENTER || k === 13) && _seekMode && onTrack) {
        commitSeek();
        showPlayerUI();
        e.stopPropagation(); e.preventDefault(); return;
      }

      // ── Enter: allow on Back, control buttons and dropdown elements ─
      if (k === Config.KEYS.ENTER || k === 13) {
        var focused = document.querySelector('.nav-focused');
        var isBack     = focused && focused.classList.contains('player-back');
        var isCtrl     = focused && (focused.classList.contains('ctrl-btn') ||
                                     focused.classList.contains('pcb-btn') ||
                                     focused.classList.contains('player-settings-btn') ||
                                     focused.classList.contains('ps-close-btn') ||
                                     focused.classList.contains('ps-tv-opt-btn') ||
                                     focused.classList.contains('acct-connect-btn') ||
                                     focused.tagName === 'BUTTON');
        var isTrigger  = focused && focused.hasAttribute('data-tdd-trigger');
        var isDDOpt    = focused && focused.hasAttribute('data-tdd-opt');
        var isPanel    = focused && (focused.classList.contains('episode-item') ||
                                     focused.classList.contains('similar-item'));
        if (!isBack && !isCtrl && !isTrigger && !isDDOpt && !isPanel) {
          // Non-interactive element: show UI on first press, consume key
          if (_uiHidden) showPlayerUI();
          e.stopPropagation(); e.preventDefault();
          if (_hideTimer) clearTimeout(_hideTimer);
          _hideTimer = setTimeout(hidePlayerUI, 4000);
          return;
        }

        // Interactive element (ctrl, trigger, option, panel item, back):
        if (isBack) {
          // Back always closes regardless of UI state
          if (focused) focused.click();
          e.stopPropagation(); e.preventDefault();
          return;
        }

        if (_uiHidden) {
          // UI hidden: first press only shows UI (focus will land on play button).
          // User presses OK a second time to activate the focused control.
          showPlayerUI();
          e.stopPropagation(); e.preventDefault();
          return;
        }

        // UI visible: directly fire action on the visually focused element
        if (_hideTimer) clearTimeout(_hideTimer);
        _hideTimer = setTimeout(hidePlayerUI, 4000);
        if (focused) focused.click();
        e.stopPropagation(); e.preventDefault();
        return;
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
      } else if (k === 413 || k === Config.KEYS.STOP || k === 10009 || k === Config.KEYS.BACK) {
        e.stopPropagation(); e.preventDefault();
        closePlayer();
      } else if (k === Config.KEYS.ENTER || k === 13) {
        // Consume ENTER during load so Nav doesn't click the focused Back button.
        // startAutoHide() (registered when stream is ready) takes over full ENTER handling.
        e.stopPropagation(); e.preventDefault();
      }
    };
    document.addEventListener('keydown', _mediaKeyListener, true);
  }
  function stopMediaKeys() {
    if (_mediaKeyListener) { document.removeEventListener('keydown', _mediaKeyListener, true); _mediaKeyListener = null; }
  }

  // ── AVPlay helpers ────────────────────────────────────
  // ── WebTorrent (web/mobile only — no server, no proxy, pure P2P) ───────────
  function stopWebTorrent() {
    if (_wtClient) {
      try { _wtClient.destroy(); } catch(e) {}
      _wtClient = null;
    }
  }

  function _ensureWebTorrent() {
    if (typeof WebTorrent !== 'undefined') return Promise.resolve(true);
    return new Promise(function(resolve) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
      s.onload  = function() { resolve(typeof WebTorrent !== 'undefined'); };
      s.onerror = function() { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function playWithWebTorrent(magnetURI) {
    _ensureWebTorrent().then(function(available) {
      if (!available || typeof WebTorrent === 'undefined') {
        console.log('[Player] WebTorrent failed to load');
        trySource(0);
        return;
      }
      // Proceed even if WEBRTC_SUPPORT is false — web seeds (HTTP CDN) work without WebRTC
      _startWebTorrent(magnetURI);
    });
  }

  function _startWebTorrent(magnetURI) {
    var area = document.getElementById('avplay-area');
    if (!area) { trySource(0); return; }

    setPlayerStatus('Finding peers...');
    stopWebTorrent();
    _removeEmbedFocusToast();
    var _pm = document.getElementById('player-modal');
    if (_pm) _pm.classList.remove('player-embed-mode');

    area.innerHTML = '<video id="web-video" style="width:100%;height:100%;background:#000;" autoplay playsinline></video>';
    var video = document.getElementById('web-video');

    var playerModal = document.getElementById('player-modal');
    if (playerModal) {
      playerModal.addEventListener('mousemove', function() { showPlayerUI(); });
      playerModal.addEventListener('touchstart', function() { showPlayerUI(); }, { passive: true });
      playerModal.addEventListener('mouseleave', function() {
        if (_hideTimer) clearTimeout(_hideTimer);
        _hideTimer = setTimeout(hidePlayerUI, 1500);
      });
    }

    _wtClient = new WebTorrent();

    // 30s watchdog — P2P peers rarely connect for this content; fail fast to embeds
    var watchdog = setTimeout(function() {
      console.log('[Player] WebTorrent: no peers in 30s — falling back');
      stopWebTorrent();
      trySource(0);
    }, 30000);

    _wtClient.on('error', function(err) {
      console.error('[Player] WebTorrent error:', err && err.message || err);
      clearTimeout(watchdog);
      stopWebTorrent();
      trySource(0);
    });

    // magnetURI may be a magnet: link or a proxied .torrent URL
    _wtClient.add(magnetURI, { strategy: 'sequential' }, function(torrent) {
      console.log('[Player] WebTorrent: torrent ready, files:', torrent.files.length, 'seeds:', torrent.urlList && torrent.urlList.length);

      // Route all web-seed requests through our proxy to bypass CDN CORS restrictions
      if (torrent.urlList && torrent.urlList.length) {
        torrent.urlList = torrent.urlList.map(function(u) {
          return PROXY_BASE + '/?url=' + encodeURIComponent(u);
        });
      }

      // Only MP4/WebM files can play via browser MSE — never fall back to MKV/other
      var sorted = torrent.files.slice().sort(function(a, b) { return b.length - a.length; });
      var file = sorted.find(function(f) { return /\.mp4$/i.test(f.name) && !f.name.includes('.ia.'); })
               || sorted.find(function(f) { return /\.(mp4|webm)$/i.test(f.name); });

      if (!file) {
        clearTimeout(watchdog);
        console.log('[Player] WebTorrent: no MP4/WebM found (MKV not supported by browser MSE) — falling back');
        stopWebTorrent();
        trySource(0);
        return;
      }

      console.log('[Player] WebTorrent: streaming', file.name, '~' + Math.round(file.length / 1e6) + 'MB');
      setPlayerStatus('Connecting...');

      torrent.on('download', function() {
        if (torrent.downloadSpeed > 0) {
          clearTimeout(watchdog);
          setPlayerStatus('');
        }
        var spd = Math.round(torrent.downloadSpeed / 1024);
        var pct = (torrent.downloaded / torrent.length * 100).toFixed(1);
        console.log('[WT] ' + pct + '% @ ' + spd + 'KB/s peers:' + torrent.numPeers);
      });

      file.renderTo(video, function(err) {
        clearTimeout(watchdog);
        if (err) {
          console.error('[Player] WebTorrent renderTo error:', err);
          stopWebTorrent();
          trySource(0);
          return;
        }
        setPlayerStatus('');
        updatePlayIcon(true);
        startAutoHide();

        if (typeof NexPlayDB !== 'undefined') {
          NexPlayDB.addToHistory(_params.id, 'movie', _titleCache, _posterCache, null, null);
        }

        video.addEventListener('ended', function() {
          if (_params.playlist === 'watchlist') { goNextInPlaylist(); return; }
          _autoplayNext();
        });

        if (_progressInterval) clearInterval(_progressInterval);
        _progressInterval = setInterval(function() {
          if (!video || video.paused) return;
          var dur = video.duration * 1000 || 1;
          var pos = video.currentTime * 1000;
          var pct = Math.min(100, pos / dur * 100).toFixed(1);
          var fill = document.getElementById('progress-fill');
          var time = document.getElementById('player-time');
          if (fill) fill.style.width = pct + '%';
          if (time) time.textContent = formatTime(pos) + ' / ' + formatTime(dur);
          _updateBufferFill(video, pct);
          if (pos > 10000 && typeof NexPlayDB !== 'undefined') {
            NexPlayDB.saveProgress(_params.id, _params.type || 'movie',
              _titleCache, _posterCache, Math.round(pos), Math.round(dur),
              _currentSeason, _currentEpisode);
          }
        }, 3000);
      });
    });
  }

  // ── Settings panel — Quality · Subtitles · Download · Who's Watching ──
  var _subActiveLang  = null;
  var _dlQualityIdx   = 0;
  var _watchingTimer  = null;   // heartbeat interval for "now watching"
  var _watchingMovieId = null;  // current movie ID being broadcast

  // ── Watching helpers ──────────────────────────────────────────────────
  function _escHtmlP(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _watchingApiBase() {
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || window.location.protocol === 'https:') return '';
    if (typeof Config !== 'undefined' && Config.DEPLOY_URL) return Config.DEPLOY_URL;
    return '';
  }

  function _tvWatchConnected() {
    try { return !!localStorage.getItem('np_tv_profile'); } catch(e) { return false; }
  }
  function _tvWatchProfile() {
    try { var s = localStorage.getItem('np_tv_profile'); return s ? JSON.parse(s) : null; } catch(e) { return null; }
  }
  function _tvWatchUid() {
    try { var u = localStorage.getItem('np_sync_uid'); return (u && u.indexOf('g_') === 0) ? u : null; } catch(e) { return null; }
  }

  function _sendWatchingStatus() {
    if (!_watchingMovieId) return;
    var base = _watchingApiBase();
    if (!base && window.location.protocol === 'file:') return;
    var user = (typeof GoogleAuth !== 'undefined') ? GoogleAuth.getUser() : null;
    var uid, name, picture;
    if (user) {
      uid     = 'g_' + user.sub;
      name    = (user.firstName || '') + (user.lastName ? ' ' + user.lastName : '');
      picture = user.picture || '';
    } else if (_tvWatchConnected()) {
      var prof = _tvWatchProfile();
      uid     = _tvWatchUid();
      if (!uid) return;
      name    = prof ? ((prof.firstName || '') + (prof.lastName ? ' ' + prof.lastName : '')) : 'TV User';
      picture = prof ? (prof.picture || '') : '';
    } else {
      return;
    }
    var hidden = localStorage.getItem('np_status_hidden') === '1';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', base + '/api/watching', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 5000;
    xhr.send(JSON.stringify({
      uid:        uid,
      movieId:    _watchingMovieId,
      movieTitle: _titleCache || '',
      name:       name,
      picture:    picture,
      hidden:     hidden,
    }));
  }

  function _startWatchingHeartbeat(movieId) {
    _stopWatchingHeartbeat();
    _watchingMovieId = String(movieId);
    _sendWatchingStatus();
    _watchingTimer = setInterval(_sendWatchingStatus, 60000);
  }

  function _stopWatchingHeartbeat() {
    if (_watchingTimer) { clearInterval(_watchingTimer); _watchingTimer = null; }
    _watchingMovieId = null;
  }

  function _fetchWatchers(movieId, wListEl, wCountEl) {
    if (!movieId || !wListEl) return;
    var user = (typeof GoogleAuth !== 'undefined') ? GoogleAuth.getUser() : null;
    var uid  = user ? ('g_' + user.sub) : (_tvWatchUid() || '');
    var base = _watchingApiBase();
    var url  = base + '/api/watching?id=' + encodeURIComponent(movieId) + (uid ? '&uid=' + encodeURIComponent(uid) : '');
    var xhr  = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 6000;
    xhr.onload = function() {
      if (xhr.status !== 200) return;
      var watchers;
      try { watchers = JSON.parse(xhr.responseText); } catch(e) { return; }
      if (wCountEl) wCountEl.textContent = watchers.length > 0 ? watchers.length + ' watching' : 'Just you';
      if (!watchers.length) {
        wListEl.innerHTML = '<div class="ps-watching-empty">No one else watching right now</div>';
        return;
      }
      wListEl.innerHTML = watchers.map(function(w) {
        return '<div class="ps-watching-item">' +
          '<span class="ps-watching-av">' +
            (w.picture
              ? '<img src="' + _escHtmlP(w.picture) + '" class="ps-watching-avatar" onerror="this.style.display=\'none\'">'
              : '<span class="ps-watching-avatar-ph">' + (w.name||'?')[0].toUpperCase() + '</span>') +
            '<span class="online-dot ps-watching-online"></span>' +
          '</span>' +
          '<span class="ps-watching-name">' + _escHtmlP(w.name||'Someone') + '</span>' +
        '</div>';
      }).join('');
    };
    xhr.onerror = xhr.ontimeout = function() {
      if (wCountEl) wCountEl.textContent = '';
    };
    xhr.send();
  }

  // ── TV: Who's Watching overlay (INFO key 457) ────────────
  function _toggleWatchingOverlay() {
    var existing = document.getElementById('tv-watching-overlay');
    if (existing) { existing.parentNode.removeChild(existing); return; }
    if (!_tvWatchConnected() && !(typeof GoogleAuth !== 'undefined' && GoogleAuth.isSignedIn())) return;
    var movieId = _params && _params.id ? String(_params.id) : null;
    if (!movieId) return;

    var ov = document.createElement('div');
    ov.id = 'tv-watching-overlay';
    ov.className = 'tv-watching-overlay';
    ov.innerHTML =
      '<div class="tv-wo-title">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">' +
          '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
          '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
        '</svg>' +
        ' Who\'s Watching' +
        '<span class="tv-wo-count" id="tv-wo-count"></span>' +
      '</div>' +
      '<div id="tv-wo-list" class="tv-wo-list"><div class="ps-watching-loading">Loading…</div></div>';
    var modal = document.getElementById('player-modal');
    if (modal) modal.appendChild(ov);

    _fetchWatchers(movieId, ov.querySelector('#tv-wo-list'), ov.querySelector('#tv-wo-count'));

    // Auto-dismiss after 6s
    setTimeout(function() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }, 6000);
  }

  function _closeSettingsPanel() {
    var p = document.getElementById('player-settings-panel');
    if (p && p.parentNode) p.parentNode.removeChild(p);
  }

  // ── TV subtitle overlay (AVPlay-compatible VTT polling) ─────────────────
  function _vttTimeToMs(ts) {
    var parts = ts.replace(',', '.').split(':');
    if (parts.length === 3) return Math.round((parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000);
    if (parts.length === 2) return Math.round((parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000);
    return 0;
  }

  function _parseVTTCues(text) {
    var cues = [], lines = text.split('\n'), i = 0;
    while (i < lines.length) {
      var m = lines[i].trim().match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/);
      if (m) {
        var start = _vttTimeToMs(m[1]), end = _vttTimeToMs(m[2]), txtLines = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          txtLines.push(lines[i].trim().replace(/<[^>]+>/g, ''));
          i++;
        }
        if (txtLines.length) cues.push({ start: start, end: end, text: txtLines.join('\n') });
      } else { i++; }
    }
    return cues;
  }

  function _applySubtitleTV(sub) {
    _removeSubtitleTV();
    if (!sub) return;

    function _startCueLoop(vtt) {
      _subCues = _parseVTTCues(vtt);
      _subSyncTimer = setInterval(function() {
        var el = document.getElementById('player-subtitle-overlay');
        if (!el) { _removeSubtitleTV(); return; }
        var posMs = 0;
        try {
          if (typeof webapis !== 'undefined' && webapis.avplay) posMs = webapis.avplay.getCurrentTime();
          else { var v = document.getElementById('web-video'); if (v) posMs = v.currentTime * 1000; }
        } catch(e) {}
        var active = '';
        for (var ci = 0; ci < _subCues.length; ci++) {
          if (posMs >= _subCues[ci].start && posMs < _subCues[ci].end) { active = _subCues[ci].text; break; }
        }
        el.textContent = active;
      }, 250);
    }

    // Use vttText directly when available (avoids blob: fetch which Tizen 3.0 doesn't support)
    if (sub.vttText) { _startCueLoop(sub.vttText); return; }

    if (!sub.blobUrl) return;
    fetch(sub.blobUrl)
      .then(function(r) { return r.text(); })
      .then(function(vtt) { _startCueLoop(vtt); })
      .catch(function() {});
  }

  function _removeSubtitleTV() {
    if (_subSyncTimer) { clearInterval(_subSyncTimer); _subSyncTimer = null; }
    _subCues = [];
    var el = document.getElementById('player-subtitle-overlay');
    if (el) el.textContent = '';
  }

  function _toggleSettingsPanel() {
    if (document.getElementById('player-settings-panel')) { _closeSettingsPanel(); return; }
    _buildSettingsPanel();
  }

  function _buildSettingsPanel() {
    var wrap = document.getElementById('player-settings-wrap');
    if (!wrap) return;

    var panel = document.createElement('div');
    panel.id = 'player-settings-panel';
    panel.className = 'player-settings-panel';
    // Tizen 3.0: set before appendChild so CSS animation never starts
    if (!document.body.classList.contains('is-web')) {
      panel.style.webkitAnimation = 'none';
      panel.style.animation = 'none';
      panel.style.opacity = '1';
    }
    wrap.appendChild(panel);

    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', function onOut(e) {
        var p = document.getElementById('player-settings-panel');
        var btn = document.getElementById('player-settings-btn');
        if (!p) { document.removeEventListener('click', onOut, true); return; }
        if (!p.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
          _closeSettingsPanel();
          document.removeEventListener('click', onOut, true);
        }
      }, true);
    }, 80);

    _renderSettingsPanel(panel);
  }

  // ── Shared: build a styled dropdown (trigger + list) ─────────────────
  function _makeDropdown(opts, selectedIdx, placeholder, onSelect, up) {
    // opts = [{ label, value, html? }]
    var wrap = document.createElement('div');
    wrap.className = 'ps-dd-wrap' + (up ? ' ps-dd-wrap-up' : '');

    var trigger = document.createElement('button');
    trigger.className = 'ps-dd-trigger';
    var current = opts[selectedIdx] || opts[0];
    trigger.innerHTML = (current ? (current.html || current.label) : placeholder)
      + '<svg class="ps-dd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>';
    wrap.appendChild(trigger);

    var list = document.createElement('div');
    list.className = 'ps-dd-list hidden';
    opts.forEach(function(opt, i) {
      var item = document.createElement('button');
      item.className = 'ps-dd-item' + (i === selectedIdx ? ' ps-dd-item-active' : '');
      item.innerHTML = (opt.html || opt.label)
        + (i === selectedIdx ? '<svg class="ps-dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>' : '');
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        trigger.innerHTML = (opt.html || opt.label)
          + '<svg class="ps-dd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>';
        list.querySelectorAll('.ps-dd-item').forEach(function(it, ii) {
          it.classList.toggle('ps-dd-item-active', ii === i);
          var ck = it.querySelector('.ps-dd-check');
          if (ii === i && !ck) it.innerHTML += '<svg class="ps-dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>';
          else if (ii !== i && ck) ck.parentNode.removeChild(ck);
        });
        list.classList.add('hidden');
        trigger.classList.remove('ps-dd-open');
        onSelect(opt, i);
      });
      list.appendChild(item);
    });
    wrap.appendChild(list);

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = !list.classList.contains('hidden');
      // Close all other open dropdowns in the panel
      var panel = document.getElementById('player-settings-panel');
      if (panel) panel.querySelectorAll('.ps-dd-list').forEach(function(l) { l.classList.add('hidden'); });
      document.querySelectorAll('.ps-dd-trigger').forEach(function(t) { t.classList.remove('ps-dd-open'); });
      if (!isOpen) {
        list.classList.remove('hidden');
        trigger.classList.add('ps-dd-open');
      }
    });

    return wrap;
  }

  function _renderSettingsPanel(panel) {
    panel.innerHTML = '';
    var isTV = typeof webapis !== 'undefined' && !!(webapis.avplay);

    // ── Close button (TV: exit panel via D-pad) ───────────────
    var closeBtn = document.createElement('button');
    closeBtn.className = 'ps-close-btn';
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close';
    closeBtn.setAttribute('data-nav', '');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.addEventListener('click', function() { _closeSettingsPanel(); });
    panel.appendChild(closeBtn);

    // ── Who's Watching ────────────────────────────────────────
    var movieId  = _params && _params.id ? _params.id : null;
    var _isAuthed = (typeof GoogleAuth !== 'undefined' && GoogleAuth.isSignedIn()) || _tvWatchConnected();
    if (movieId && _isAuthed) {
      var wSection = document.createElement('div');
      wSection.className = 'ps-section ps-watching-section';

      var wHeader = document.createElement('div');
      wHeader.className = 'ps-section-title ps-watching-hd';
      wHeader.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
        ' Who\'s Watching' +
        '<span class="ps-watching-count" id="ps-watching-count">…</span>';

      var wList = document.createElement('div');
      wList.className = 'ps-watching-list';
      wList.id = 'ps-watching-list';
      wList.innerHTML = '<div class="ps-watching-loading">Loading…</div>';

      if (isTV) {
        // TV: auto-expand, header navigable
        wList.style.display = '';
        wHeader.setAttribute('data-nav', '');
        wHeader.setAttribute('tabindex', '0');
      } else {
        // Web: collapsed, click to expand
        var _wOpen = false;
        wHeader.style.cursor = 'pointer';
        wHeader.addEventListener('click', function() {
          _wOpen = !_wOpen;
          wList.style.display = _wOpen ? '' : 'none';
          var arrow = wHeader.querySelector('.ps-watching-arrow');
          if (arrow) arrow.style.transform = _wOpen ? 'rotate(180deg)' : '';
        });
        var wArrow = document.createElement('svg');
        wArrow.setAttribute('viewBox','0 0 24 24'); wArrow.setAttribute('width','12'); wArrow.setAttribute('height','12');
        wArrow.setAttribute('fill','none'); wArrow.setAttribute('stroke','currentColor'); wArrow.setAttribute('stroke-width','2.5');
        wArrow.className = 'ps-watching-arrow';
        wArrow.style.marginLeft = 'auto'; wArrow.style.flexShrink = '0';
        wArrow.style.transition = 'transform 150ms ease';
        wArrow.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
        wHeader.appendChild(wArrow);
        wList.style.display = 'none';
      }

      wSection.appendChild(wHeader);
      wSection.appendChild(wList);
      panel.appendChild(wSection);

      _fetchWatchers(movieId, wList, document.getElementById('ps-watching-count') || wHeader.querySelector('.ps-watching-count'));
    }

    // ── Quality ──────────────────────────────────────────────
    var qSection = document.createElement('div');
    qSection.className = 'ps-section';

    if (_availableQualities && _availableQualities.length) {
      var savedQ = ''; try { savedQ = localStorage.getItem('np_pref_quality') || ''; } catch(e) {}
      var qSelIdx = _availableQualities.findIndex(function(q) { return q.label === savedQ; });
      if (qSelIdx < 0) qSelIdx = 0;
      if (isTV) {
        var _qOpen = false;
        var qToggleBtn = document.createElement('button');
        qToggleBtn.className = 'ps-section-title ps-section-toggle';
        qToggleBtn.setAttribute('data-nav', ''); qToggleBtn.setAttribute('tabindex', '0');
        qToggleBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' +
          ' Quality' +
          '<span class="ps-stgl-cur" style="margin-left:6px;font-size:11px;opacity:0.55;font-weight:400">' + _availableQualities[qSelIdx].label + '</span>' +
          '<svg class="ps-stgl-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"' +
          ' style="margin-left:auto;flex-shrink:0;-webkit-transform:rotate(-90deg);transform:rotate(-90deg)"><polyline points="6 9 12 15 18 9"/></svg>';
        var qList = document.createElement('div');
        qList.className = 'ps-tv-opts';
        qList.style.display = 'none';
        qToggleBtn.addEventListener('click', function() {
          _qOpen = !_qOpen;
          var arrow = qToggleBtn.querySelector('.ps-stgl-arrow');
          if (arrow) {
            arrow.style.webkitTransform = _qOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
            arrow.style.transform       = _qOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
          }
          qList.style.display = _qOpen ? '' : 'none';
        });
        _availableQualities.forEach(function(q, qi) {
          (function(q, qi) {
            var btn = document.createElement('button');
            btn.className = 'ps-tv-opt-btn' + (qi === qSelIdx ? ' active' : '');
            btn.textContent = q.label;
            btn.setAttribute('data-nav', ''); btn.setAttribute('tabindex', '0');
            btn.addEventListener('click', function() {
              try { localStorage.setItem('np_pref_quality', q.label); } catch(e) {}
              _resumePos = capturePos();
              var hdrs = (_qualityHeaders && Object.keys(_qualityHeaders).length) ? _qualityHeaders : {};
              stopAvPlay(); setPlayerStatus('Switching quality...'); playWithUrl(q.url, hdrs);
              _closeSettingsPanel();
            });
            qList.appendChild(btn);
          })(q, qi);
        });
        qSection.appendChild(qToggleBtn);
        qSection.appendChild(qList);
      } else {
        qSection.innerHTML = '<div class="ps-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Quality</div>';
        var qOpts = _availableQualities.map(function(q) { return { label: q.label }; });
        var qDD = _makeDropdown(qOpts, qSelIdx, 'Auto', function(opt, i) {
          var q = _availableQualities[i];
          if (!q) return;
          try { localStorage.setItem('np_pref_quality', q.label); } catch(e) {}
          _resumePos = capturePos();
          var hdrs = (_qualityHeaders && Object.keys(_qualityHeaders).length) ? _qualityHeaders : {};
          stopAvPlay(); setPlayerStatus('Switching quality...'); playWithUrl(q.url, hdrs);
          _closeSettingsPanel();
        });
        qSection.appendChild(qDD);
      }
    } else {
      qSection.innerHTML = '<div class="ps-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Quality</div>';
      var qPlaceholder = document.createElement('div');
      qPlaceholder.className = 'ps-dd-trigger ps-dd-disabled';
      qPlaceholder.innerHTML = 'Auto <svg class="ps-dd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>';
      qSection.appendChild(qPlaceholder);
    }
    panel.appendChild(qSection);

    // ── Subtitles ─────────────────────────────────────────────
    var sSection = document.createElement('div');
    sSection.className = 'ps-section';

    var _sOpen = false;
    var _sLangListRef = null;

    if (isTV) {
      var sToggleBtn = document.createElement('button');
      sToggleBtn.className = 'ps-section-title ps-section-toggle';
      sToggleBtn.setAttribute('data-nav', '');
      sToggleBtn.setAttribute('tabindex', '0');
      sToggleBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h2M11 11h6"/></svg>' +
        ' Subtitles' +
        '<svg class="ps-stgl-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"' +
        ' style="margin-left:auto;flex-shrink:0;-webkit-transform:rotate(-90deg);transform:rotate(-90deg)"><polyline points="6 9 12 15 18 9"/></svg>';
      sToggleBtn.addEventListener('click', function() {
        _sOpen = !_sOpen;
        var arrow = sToggleBtn.querySelector('.ps-stgl-arrow');
        if (arrow) {
          arrow.style.webkitTransform = _sOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
          arrow.style.transform       = _sOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
        if (_sLangListRef) _sLangListRef.style.display = _sOpen ? '' : 'none';
      });
      sSection.appendChild(sToggleBtn);
    } else {
      sSection.innerHTML = '<div class="ps-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h2M11 11h6"/></svg> Subtitles</div>';
    }

    var sLoading = document.createElement('div');
    sLoading.className = 'ps-dd-trigger ps-dd-disabled';
    sLoading.textContent = 'Loading…';
    sSection.appendChild(sLoading);
    panel.appendChild(sSection);

    if (typeof SubtitleClient !== 'undefined') {
      SubtitleClient.getLanguages(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode)
        .then(function(langs) {
          if (!sSection.parentNode) return; // panel closed while loading
          if (sLoading.parentNode) sSection.removeChild(sLoading);

          if (isTV) {
            var sLangList = document.createElement('div');
            sLangList.className = 'ps-tv-opts';
            var offBtn = document.createElement('button');
            offBtn.className = 'ps-tv-opt-btn' + (!_subActiveLang ? ' active' : '');
            offBtn.textContent = 'Off';
            offBtn.setAttribute('data-nav', ''); offBtn.setAttribute('tabindex', '0');
            offBtn.addEventListener('click', function() {
              _subActiveLang = null; _removeSubtitleTV();
              sLangList.querySelectorAll('.ps-tv-opt-btn').forEach(function(b) { b.classList.remove('active'); });
              offBtn.classList.add('active');
            });
            sLangList.appendChild(offBtn);
            langs.forEach(function(l) {
              (function(l) {
                var btn = document.createElement('button');
                btn.className = 'ps-tv-opt-btn' + (_subActiveLang === l.language ? ' active' : '');
                btn.textContent = l.display || l.language;
                btn.setAttribute('data-nav', ''); btn.setAttribute('tabindex', '0');
                btn.addEventListener('click', function() {
                  var orig = btn.textContent;
                  btn.textContent = '…';
                  SubtitleClient.loadLanguage(_params.id, _params.type || 'movie', l.language, _currentSeason, _currentEpisode)
                    .then(function(sub) {
                      btn.textContent = orig;
                      if (!sub) { if (typeof App !== 'undefined') App.showToast('Subtitle unavailable'); return; }
                      _subActiveLang = l.language;
                      _applySubtitleTV(sub);
                      sLangList.querySelectorAll('.ps-tv-opt-btn').forEach(function(b) { b.classList.remove('active'); });
                      btn.classList.add('active');
                    });
                });
                sLangList.appendChild(btn);
              })(l);
            });
            if (!langs.length) {
              var noSubsEl = document.createElement('div');
              noSubsEl.className = 'ps-dd-trigger ps-dd-disabled'; noSubsEl.textContent = 'None available';
              sLangList.appendChild(noSubsEl);
            }
            _sLangListRef = sLangList;
            sLangList.style.display = 'none'; // collapsed until toggle pressed
            sSection.appendChild(sLangList);
          } else {
            var sOpts = [{ label: 'Off', html: '<span class="ps-dd-off">✕</span> Off' }];
            langs.forEach(function(l) {
              var flag = l.flagUrl ? '<img class="ps-dd-flag" src="' + l.flagUrl + '" onerror="this.style.display=\'none\'">' : '';
              sOpts.push({ label: l.display || l.language, html: flag + (l.display || l.language), _lang: l });
            });
            var sSelIdx = 0;
            if (_subActiveLang) {
              var found = sOpts.findIndex(function(o) { return o._lang && o._lang.language === _subActiveLang; });
              if (found >= 0) sSelIdx = found;
            }
            var sDD = _makeDropdown(sOpts, sSelIdx, 'Off', function(opt) {
              if (!opt._lang) {
                _subActiveLang = null;
                if (typeof SubtitleClient !== 'undefined') SubtitleClient.removeSubtitle(document.getElementById('web-video'));
                return;
              }
              var l = opt._lang;
              SubtitleClient.loadLanguage(_params.id, _params.type || 'movie', l.language, _currentSeason, _currentEpisode)
                .then(function(sub) {
                  if (!sub) { if (typeof App !== 'undefined') App.showToast('Subtitle unavailable'); return; }
                  _subActiveLang = l.language;
                  SubtitleClient.applySubtitle(document.getElementById('web-video'), sub);
                });
            }, true);
            sSection.appendChild(sDD);
          }
        })
        .catch(function() {
          if (sLoading.parentNode) sLoading.textContent = 'Unavailable';
        });
    }

    // ── Autoplay (series only) ───────────────────────────────────
    if (_params.type === 'tv') {
      var apSection = document.createElement('div');
      apSection.className = 'ps-section';
      var apRow = document.createElement('div');
      apRow.className = 'ps-section-title';
      apRow.style.cssText = 'display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;';
      apRow.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
        '<span style="margin-left:6px;-webkit-flex:1;flex:1;">Autoplay</span>';
      var apBtn = document.createElement('button');
      apBtn.className = 'ps-tv-opt-btn' + (_autoplayEnabled ? ' active' : '');
      apBtn.setAttribute('data-nav', ''); apBtn.setAttribute('tabindex', '0');
      apBtn.style.cssText = 'margin-left:auto;font-size:11px;padding:4px 10px;min-width:42px;flex-shrink:0;';
      apBtn.textContent = _autoplayEnabled ? 'ON' : 'OFF';
      apBtn.addEventListener('click', function() {
        _autoplayEnabled = !_autoplayEnabled;
        apBtn.textContent = _autoplayEnabled ? 'ON' : 'OFF';
        apBtn.classList.toggle('active', _autoplayEnabled);
        try { localStorage.setItem('np_pref_autoplay', _autoplayEnabled ? '1' : '0'); } catch(e) {}
      });
      apRow.appendChild(apBtn);
      apSection.appendChild(apRow);
      panel.appendChild(apSection);
    }

    // ── Download ──────────────────────────────────────────────
    if (_currentStreamUrl && typeof webapis === 'undefined') {
      var dSection = document.createElement('div');
      dSection.className = 'ps-section';
      dSection.innerHTML = '<div class="ps-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Download</div>';

      if (_availableQualities && _availableQualities.length) {
        var dOpts = _availableQualities.map(function(q) { return { label: q.label }; });
        var dDD = _makeDropdown(dOpts, _dlQualityIdx, 'Auto', function(opt, i) { _dlQualityIdx = i; });
        dSection.appendChild(dDD);
      } else {
        var dPlaceholder = document.createElement('div');
        dPlaceholder.className = 'ps-dd-trigger ps-dd-disabled';
        dPlaceholder.innerHTML = 'Auto <svg class="ps-dd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>';
        dSection.appendChild(dPlaceholder);
      }

      var dBtn = document.createElement('button');
      dBtn.className = 'ps-dl-btn';
      dBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Save MP4';
      dBtn.addEventListener('click', function() {
        _closeSettingsPanel();
        if (_availableQualities && _availableQualities.length && _availableQualities[_dlQualityIdx]) {
          _currentStreamUrl = _availableQualities[_dlQualityIdx].url;
        }
        _handleDownload();
      });
      dSection.appendChild(dBtn);
      panel.appendChild(dSection);
    }
  }

  // ── Legacy sub-picker — kept for closePlayer ref ───────────────────────
  function _closePicker() { _closeSettingsPanel(); }

  function _openSubPicker() {
    // If picker already open, close it
    if (document.getElementById('player-sub-picker')) { _closePicker(); return; }
    if (typeof SubtitleClient === 'undefined') return;

    var ccBtn = document.getElementById('player-cc-btn');
    if (!ccBtn) return;

    // Build picker shell immediately so user sees it right away
    var picker = document.createElement('div');
    picker.id = 'player-sub-picker';
    picker.className = 'player-sub-picker';
    picker.innerHTML = '<div class="sub-picker-loading">Loading…</div>';
    ccBtn.parentNode.style.position = 'relative';
    ccBtn.parentNode.appendChild(picker);

    // Close on click outside
    setTimeout(function() {
      document.addEventListener('click', function onOut(e) {
        if (!picker.contains(e.target) && e.target !== ccBtn) {
          _closePicker();
          document.removeEventListener('click', onOut, true);
        }
      }, true);
    }, 100);

    // Fetch languages and populate
    SubtitleClient.getLanguages(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode)
      .then(function(langs) {
        picker.innerHTML = '';

        // "Off" option
        var offOpt = document.createElement('div');
        offOpt.className = 'sub-lang-opt' + (!_subActiveLang ? ' active' : '');
        offOpt.innerHTML = '<span class="sub-lang-off-icon">✕</span><span class="sub-lang-name">Off</span>'
          + (!_subActiveLang ? '<span class="sub-lang-check">✓</span>' : '');
        offOpt.addEventListener('click', function() {
          _subActiveLang = null;
          SubtitleClient.removeSubtitle(document.getElementById('web-video'));
          var btn = document.getElementById('player-cc-btn');
          if (btn) { btn.classList.remove('cc-active'); btn.querySelector('.cc-label').textContent = 'CC'; }
          _closePicker();
        });
        picker.appendChild(offOpt);

        if (!langs.length) {
          var none = document.createElement('div');
          none.className = 'sub-lang-opt sub-lang-empty';
          none.textContent = 'No subtitles found';
          picker.appendChild(none);
          return;
        }

        langs.forEach(function(l) {
          var opt = document.createElement('div');
          var isActive = _subActiveLang === l.language;
          opt.className = 'sub-lang-opt' + (isActive ? ' active' : '');
          var flagHtml = l.flagUrl
            ? '<img class="sub-lang-flag" src="' + l.flagUrl + '" onerror="this.style.display=\'none\'">'
            : '<span class="sub-lang-flag-placeholder"></span>';
          opt.innerHTML = flagHtml
            + '<span class="sub-lang-name">' + (l.display || l.language) + '</span>'
            + (isActive ? '<span class="sub-lang-check">✓</span>' : '<span class="sub-lang-loading" style="display:none">…</span>');
          opt.addEventListener('click', function() {
            var loadingEl = opt.querySelector('.sub-lang-loading');
            if (loadingEl) loadingEl.style.display = '';
            SubtitleClient.loadLanguage(_params.id, _params.type || 'movie', l.language, _currentSeason, _currentEpisode)
              .then(function(sub) {
                if (!sub) { if (typeof App !== 'undefined') App.showToast('Subtitle not available'); _closePicker(); return; }
                _subActiveLang = l.language;
                SubtitleClient.applySubtitle(document.getElementById('web-video'), sub);
                var btn = document.getElementById('player-cc-btn');
                if (btn) {
                  btn.classList.add('cc-active');
                  btn.querySelector('.cc-label').textContent = l.language.toUpperCase();
                }
                _closePicker();
              })
              .catch(function() { _closePicker(); });
          });
          picker.appendChild(opt);
        });
      })
      .catch(function() { _closePicker(); });
  }

  // ── Download handler ────────────────────────────────────────────────────
  function _resetDownloadUI() {
    var btn  = document.getElementById('player-dl-btn');
    var fill = document.getElementById('player-dl-fill');   // now the .dl-fill span inside button
    var lbl  = btn && btn.querySelector('.dl-label');
    var ico  = btn && btn.querySelector('.dl-icon');
    if (btn)  { btn.classList.remove('dl-active', 'dl-done'); }
    if (lbl)  { lbl.textContent = 'Save'; }
    if (ico)  { ico.innerHTML = '<path d="M12 5v14M5 12l7 7 7-7"/>'; }
    if (fill) { fill.style.width = '0%'; }
  }

  function _handleDownload() {
    if (!_currentStreamUrl) {
      if (typeof App !== 'undefined') App.showToast('No stream available to download');
      return;
    }

    var btn = document.getElementById('player-dl-btn');
    if (btn && btn.classList.contains('dl-active')) return; // already in progress

    var fill = document.getElementById('player-dl-fill');   // .dl-fill span inside button

    // Determine stream type: CDN headers or HLS URL → segment download; otherwise direct XHR
    var hasStreamHeaders = _qualityHeaders && Object.keys(_qualityHeaders).length > 0;
    var isHLS = /\.m3u8/i.test(_currentStreamUrl) || /\/hls\//i.test(_currentStreamUrl);

    if (hasStreamHeaders || isHLS) {
      _downloadHLS();
    } else {
      // Direct MP4 (e.g. YTS torrent web seed) — simple XHR blob download
      if (typeof App !== 'undefined') App.showToast('Starting download…');
      _startFileDownload(btn, fill);
    }
  }

  // Download HLS stream by fetching all segments through the CF Worker proxy
  async function _downloadHLS() {
    var btn  = document.getElementById('player-dl-btn');
    var fill = document.getElementById('player-dl-fill');
    var lbl  = btn && btn.querySelector('.dl-label');
    if (btn)  btn.classList.add('dl-active');
    if (lbl)  lbl.textContent = '…';
    if (fill) fill.style.width = '0%';

    _hlsDownloadController = new AbortController();
    var signal = _hlsDownloadController.signal;

    var safeName = (_titleCache || 'video').replace(/[^a-zA-Z0-9 ]/g, '_').slice(0, 60);

    function setProgress(done, total) {
      var pct = Math.round(done / total * 100);
      if (fill) fill.style.width = pct + '%';   // fill the pill from left
      if (lbl)  lbl.textContent = pct + '%';
    }

    // Resolve relative or proxy URL to an absolute CDN URL
    function origAbsUrl(rel, origBase) {
      if (!rel) return '';
      if (/^https?:\/\//i.test(rel)) return rel;
      if (rel.charAt(0) === '/') {
        var m = origBase.match(/^(https?:\/\/[^\/]+)/);
        return m ? m[1] + rel : rel;
      }
      return origBase.substring(0, origBase.lastIndexOf('/') + 1) + rel;
    }

    // Wrap a CDN URL with the CF Worker proxy (unless already proxied)
    function proxyUrl(cdnUrl) {
      if (cdnUrl.indexOf(PROXY_BASE) === 0) return cdnUrl; // already proxied by the CF Worker
      return buildProxyUrl(cdnUrl, _qualityHeaders);
    }

    // Extract original CDN URL from a proxy URL (for base URL resolution)
    function unproxyUrl(url) {
      if (url.indexOf(PROXY_BASE) !== 0) return url;
      try {
        var purl = new URL(url);
        return decodeURIComponent(purl.searchParams.get('url') || url);
      } catch(e) { return url; }
    }

    function parseM3U8(text, origBase) {
      var lines = text.trim().split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
      var segments = [], isMaster = false, bestBW = 0, bestProxyUrl = null, bestOrigUrl = null;
      var isLive = text.indexOf('#EXT-X-ENDLIST') === -1;

      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (ln.indexOf('#EXT-X-STREAM-INF') === 0) {
          isMaster = true;
          var bwM = ln.match(/BANDWIDTH=(\d+)/i);
          var bw = bwM ? parseInt(bwM[1]) : 0;
          if (bw >= bestBW && i + 1 < lines.length && lines[i + 1].charAt(0) !== '#') {
            bestBW = bw;
            var rawVariant = lines[i + 1];
            // If the proxy already rewrote this URL, extract the original for base URL tracking
            var absVariant = origAbsUrl(unproxyUrl(rawVariant), origBase);
            bestOrigUrl   = absVariant;
            bestProxyUrl  = proxyUrl(absVariant);
          }
        } else if (ln.charAt(0) !== '#' && ln.length > 0) {
          if (!isMaster) {
            // Segment URL — may be already proxied or relative/absolute CDN URL
            var absSeg = origAbsUrl(unproxyUrl(ln), origBase);
            segments.push(proxyUrl(absSeg));
          }
        }
      }

      return { isMaster: isMaster, isLive: isLive && !isMaster, bestProxyUrl: bestProxyUrl, bestOrigUrl: bestOrigUrl, segments: segments };
    }

    try {
      var origUrl = _currentStreamUrl; // original CDN URL (un-proxied)

      // Fetch master/media playlist through the proxy
      var resp = await fetch(proxyUrl(origUrl), { signal: signal });
      if (!resp.ok) throw new Error('Playlist fetch failed (' + resp.status + ')');
      var m3u8Text = await resp.text();
      var parsed = parseM3U8(m3u8Text, origUrl);

      // If it's a master playlist, follow to the best quality variant
      if (parsed.isMaster) {
        if (!parsed.bestProxyUrl) throw new Error('No quality variant found in master playlist');
        resp = await fetch(parsed.bestProxyUrl, { signal: signal });
        if (!resp.ok) throw new Error('Variant fetch failed (' + resp.status + ')');
        m3u8Text = await resp.text();
        parsed = parseM3U8(m3u8Text, parsed.bestOrigUrl || origUrl);
      }

      if (parsed.isLive) {
        _resetDownloadUI();
        if (typeof App !== 'undefined') App.showToast('Live streams cannot be downloaded');
        return;
      }

      var segs = parsed.segments;
      if (!segs.length) throw new Error('No segments found in playlist');

      // Load mux.js for TS→MP4 remux (fast container swap, no re-encoding)
      if (typeof muxjs === 'undefined') {
        if (lbl) lbl.textContent = 'Init…';
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/mux.js@6/dist/mux.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      if (typeof App !== 'undefined') App.showToast('Downloading ' + segs.length + ' segments…');

      // Try File System Access API for streaming write (Chrome/Edge/Android Chrome)
      var writable = null;
      if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
        try {
          var fh = await window.showSaveFilePicker({
            suggestedName: safeName + '.mp4',
            types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }]
          });
          writable = await fh.createWritable();
        } catch(e) {
          if (e.name === 'AbortError') { _resetDownloadUI(); return; }
          writable = null;
        }
      }

      // Mux.js transmuxer: TS → fMP4. Rules:
      //   • push() feeds raw TS bytes; data events may fire during push
      //   • flush() is called ONCE after ALL segments — signals end-of-stream
      //   • NEVER call flush() inside the download loop (it resets the stream)
      // FSA writes must be chained (Promise queue) to preserve MP4 byte order.
      var tx = new muxjs.mp4.Transmuxer();
      var mp4Chunks = [];                      // blob-fallback accumulator
      var mp4WriteQueue = Promise.resolve();   // FSA ordered-write chain
      var initDone = false;

      tx.on('data', function(segment) {
        var pieces = [];
        if (!initDone && segment.initSegment && segment.initSegment.byteLength > 0) {
          pieces.push(new Uint8Array(segment.initSegment));
          initDone = true;
        }
        if (segment.data && segment.data.byteLength > 0) {
          pieces.push(new Uint8Array(segment.data));
        }
        if (!pieces.length) return;

        if (writable) {
          // Chain each write so they land in order even though the event is sync
          pieces.forEach(function(p) {
            mp4WriteQueue = mp4WriteQueue.then(function() { return writable.write(p); });
          });
        } else {
          pieces.forEach(function(p) { mp4Chunks.push(p); });
        }
      });

      var failed = 0;
      var BATCH = 4;

      for (var i = 0; i < segs.length; i += BATCH) {
        if (signal.aborted) break;

        var batch = segs.slice(i, i + BATCH);
        var results = await Promise.all(batch.map(function(u) {
          return fetch(u, { signal: signal })
            .then(function(r) { return r.ok ? r.arrayBuffer() : Promise.reject(r.status); })
            .then(function(ab) { return new Uint8Array(ab); })
            .catch(function() { return null; });
        }));

        for (var j = 0; j < results.length; j++) {
          if (!results[j]) { failed++; continue; }
          tx.push(results[j]); // data events fire here for complete PES packets
        }
        // ↑ No flush() here — flushing inside the loop resets the transmuxer stream

        setProgress(Math.min(i + BATCH, segs.length), segs.length);
      }

      // Single flush at the very end — drains remaining buffered data
      tx.flush();

      // Wait for all queued FSA writes to land before closing the file
      await mp4WriteQueue;

      if (signal.aborted) {
        if (writable) try { await writable.abort(); } catch(e) {}
        _resetDownloadUI();
        return;
      }

      if (writable) {
        await writable.close();
      } else if (mp4Chunks.length) {
        if (lbl) lbl.textContent = 'Saving…';
        var totalLen = mp4Chunks.reduce(function(s, c) { return s + c.byteLength; }, 0);
        var output = new Uint8Array(totalLen);
        var off = 0;
        mp4Chunks.forEach(function(c) { output.set(c, off); off += c.byteLength; });
        var dlBlob = new Blob([output], { type: 'video/mp4' });
        var dlObjUrl = URL.createObjectURL(dlBlob);
        var dlA = document.createElement('a');
        dlA.href = dlObjUrl;
        dlA.download = safeName + '.mp4';
        document.body.appendChild(dlA);
        dlA.click();
        document.body.removeChild(dlA);
        setTimeout(function() { URL.revokeObjectURL(dlObjUrl); }, 5000);
      }

      _hlsDownloadController = null;
      if (btn)  { btn.classList.remove('dl-active'); btn.classList.add('dl-done'); }
      // Swap to checkmark icon and "Saved" label
      var doneIco = btn && btn.querySelector('.dl-icon');
      if (doneIco) doneIco.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
      if (lbl)  lbl.textContent = failed ? failed + ' missed' : 'Saved';
      if (fill) fill.style.width = '100%';
      if (typeof App !== 'undefined') App.showToast(
        'Download complete!' + (failed ? ' (' + failed + ' segments failed)' : ''));
      setTimeout(function() {
        if (btn) btn.classList.remove('dl-done');
        // Reset icon + label after dismiss
        var resetIco = btn && btn.querySelector('.dl-icon');
        var resetLbl = btn && btn.querySelector('.dl-label');
        if (resetIco) resetIco.innerHTML = '<path d="M12 5v14M5 12l7 7 7-7"/>';
        if (resetLbl) resetLbl.textContent = 'Save';
      }, 6000);

    } catch(e) {
      _hlsDownloadController = null;
      if (e.name === 'AbortError') { _resetDownloadUI(); return; }
      console.error('[DL] HLS error:', e);
      _resetDownloadUI();
      if (typeof App !== 'undefined') App.showToast('Download failed: ' + (e.message || String(e)));
    }
  }

  function _startFileDownload(btn, fill) {
    var lbl = btn && btn.querySelector('.dl-label');
    if (btn)  btn.classList.add('dl-active');
    if (lbl)  lbl.textContent = '0%';
    if (fill) fill.style.width = '0%';

    var filename = (_titleCache ? _titleCache.replace(/[^a-zA-Z0-9 ]/g, '_').slice(0, 80) : 'video') + '.mp4';

    var xhr = new XMLHttpRequest();
    _dlXhr = xhr;
    xhr.open('GET', _currentStreamUrl, true);
    xhr.responseType = 'blob';

    xhr.onprogress = function(e) {
      if (e.lengthComputable) {
        var pct = Math.round(e.loaded / e.total * 100);
        if (fill) fill.style.width = pct + '%';
        if (lbl)  lbl.textContent = pct + '%';
      } else {
        var mb = Math.round(e.loaded / 1e6);
        if (lbl) lbl.textContent = mb + 'MB';
      }
    };

    xhr.onload = function() {
      _dlXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        var objUrl = URL.createObjectURL(xhr.response);
        var a = document.createElement('a');
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(objUrl); }, 2000);

        if (btn)  { btn.classList.remove('dl-active'); btn.classList.add('dl-done'); }
        var doneIco = btn && btn.querySelector('.dl-icon');
        if (doneIco) doneIco.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        if (lbl)  lbl.textContent = 'Saved';
        if (fill) fill.style.width = '100%';
        if (typeof App !== 'undefined') App.showToast('Download complete!');

        setTimeout(function() {
          if (btn) btn.classList.remove('dl-done');
          var rIco = btn && btn.querySelector('.dl-icon');
          var rLbl = btn && btn.querySelector('.dl-label');
          if (rIco) rIco.innerHTML = '<path d="M12 5v14M5 12l7 7 7-7"/>';
          if (rLbl) rLbl.textContent = 'Save';
        }, 4000);
      } else {
        _resetDownloadUI();
        if (typeof App !== 'undefined') App.showToast('Download failed (' + xhr.status + ')');
      }
    };

    xhr.onerror = function() {
      _dlXhr = null;
      _resetDownloadUI();
      if (typeof App !== 'undefined') App.showToast('Download failed');
    };

    xhr.onabort = function() { _dlXhr = null; _resetDownloadUI(); };

    xhr.send();
  }

  function stopAvPlay() {
    // Save final position before stopping
    if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null; }
    // Cancel any active download (XHR or HLS segment fetch)
    if (_dlXhr) { try { _dlXhr.abort(); } catch(e) {} _dlXhr = null; }
    if (_hlsDownloadController) { try { _hlsDownloadController.abort(); } catch(e) {} _hlsDownloadController = null; }
    _resetDownloadUI();
    // Tear down any active WebTorrent session
    stopWebTorrent();
    // Web: save hls.js watch position before destroying the video
    if (_hlsInstance) {
      try {
        var _wv = document.getElementById('web-video');
        if (_wv && typeof NexPlayDB !== 'undefined' && _wv.currentTime > 5) {
          NexPlayDB.saveProgress(
            _params.id, _params.type || 'movie',
            _titleCache, _posterCache,
            Math.round(_wv.currentTime * 1000),
            Math.round((_wv.duration || 0) * 1000),
            _currentSeason, _currentEpisode
          );
        }
      } catch(e) {}
      try { _hlsInstance.destroy(); } catch(e) {}
      _hlsInstance = null;
    }
    // Explicitly stop the web video element — hls.js destroy alone doesn't always halt buffered audio
    try {
      var _wv2 = document.getElementById('web-video');
      if (_wv2) { _wv2.pause(); _wv2.src = ''; _wv2.load(); }
    } catch(e) {}
    // Unload any iframe embed — setting about:blank stops audio/video inside cross-origin frames
    try {
      var _ef = document.getElementById('embed-frame');
      if (_ef) { _ef.src = 'about:blank'; }
    } catch(e) {}
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
        // Clear callbacks before stopping so queued native events don't fire into stale handlers.
        try { webapis.avplay.setListener({}); } catch(e2) {}
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

  // Iframe embed state — tracks which source is active across switches
  var _embedSourceList = [];
  var _embedSourceIdx  = 0;

  function showIframeEmbed(embedUrl) {
    // Web fallback only — TV uses AVPlay which cannot render iframes.
    if (typeof webapis !== 'undefined' && webapis.avplay) return;
    var area = document.getElementById('avplay-area');
    if (!area) return;

    // Hide our controls — they don't work on cross-origin iframe players
    var _pModal = document.getElementById('player-modal');
    if (_pModal) _pModal.classList.add('player-embed-mode');

    // Friendly source names for display
    var SOURCE_NAMES = { 'vidsrc-wtf': 'VidSrc', 'videasy': 'Videasy', '2embed': '2Embed', 'vsembed': 'VSEmbed', 'vidsrc-me': 'VidSrc', 'vidsrc': 'VidSrc.to' };
    var srcObj   = _embedSourceList[_embedSourceIdx] || {};
    var srcName  = SOURCE_NAMES[srcObj.id] || srcObj.label || 'Embed Player';
    var hasNext  = _embedSourceIdx < _embedSourceList.length - 1;

    area.innerHTML =
      '<iframe id="embed-frame" src="' + embedUrl + '" allowfullscreen frameborder="0"' +
      ' allow="autoplay; fullscreen; encrypted-media; picture-in-picture"' +
      ' style="width:100%;height:100%;border:none;background:#000;"></iframe>' +
      '<div id="embed-play-btn" data-nav tabindex="0" class="embed-launch-overlay">' +
      '  <div class="embed-launch-card">' +
      '    <svg viewBox="0 0 24 24" fill="white" width="48" height="48" style="margin-bottom:12px;"><path d="M8 5v14l11-7z"/></svg>' +
      '    <div class="embed-launch-title">Watch on ' + srcName + '</div>' +
      '    <div class="embed-launch-hint">The player may open a new tab.<br>Return to this tab — your movie continues here.</div>' +
      (hasNext
        ? '    <button id="embed-next-src" class="btn btn-secondary" style="margin-top:16px;font-size:14px;padding:8px 20px;" onclick="event.stopPropagation()">Try next source</button>'
        : '') +
      '  </div>' +
      '</div>';

    setPlayerStatus('');

    // Add focus listener — toast when user returns after embed opens a new tab
    _addEmbedFocusToast();

    var btn   = document.getElementById('embed-play-btn');
    var frame = document.getElementById('embed-frame');
    var next  = document.getElementById('embed-next-src');

    if (btn) btn.addEventListener('click', function() {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    });
    if (next) next.addEventListener('click', function(e) {
      e.stopPropagation();
      _embedSourceIdx++;
      if (_embedSourceIdx < _embedSourceList.length) {
        var src = _embedSourceList[_embedSourceIdx];
        var url = _params.type === 'tv'
          ? src.tvUrl(_params.id, _currentSeason, _currentEpisode)
          : src.movieUrl(_params.id);
        showIframeEmbed(url);
      }
    });

    startAutoHide();
    Nav.reset(document.getElementById('player-modal'));
  }

  function trySource(idx) {
    // On TV, embed scraping and iframes never work with AVPlay — bail immediately
    if (typeof webapis !== 'undefined' && webapis.avplay) {
      setPlayerStatus('Stream unavailable for this title');
      return;
    }
    // All modern embed sites (vidsrc.wtf, videasy, 2embed etc.) use client-side rendering —
    // scraping static HTML for m3u8 always fails and wastes ~8s per source.
    // Go directly to iframe embed on web/mobile (skip the scrape loop).
    _embedSourceList = SOURCES.slice().filter(Boolean);
    _embedSourceIdx  = 0;
    if (_embedSourceList.length) {
      var first = _embedSourceList[0];
      showIframeEmbed(_params.type === 'tv'
        ? first.tvUrl(_params.id, _currentSeason, _currentEpisode)
        : first.movieUrl(_params.id));
    }
    return;
  }

  var PROXY_BASE = 'https://nexplay-proxy.pielly16.workers.dev';

  function buildProxyUrl(streamUrl, headers) {
    var h = '';
    if (headers && Object.keys(headers).length) {
      try { h = btoa(JSON.stringify(headers)); } catch(e) {}
    }
    return PROXY_BASE + '/?url=' + encodeURIComponent(streamUrl) + (h ? '&headers=' + encodeURIComponent(h) : '');
  }

  function playWithHlsJs(streamUrl, headers, _isDirect) {
    // streamUrl may be a direct CDN URL or a proxied URL depending on _isDirect.
    // Direct mode: browser IP is usually not blocked by CDNs (only CF Worker IPs are).
    // Proxy mode: used as fallback — adds Referer/Origin and rewrites segment URLs.
    var playUrl = streamUrl;
    // Real HLS stream — restore controls and remove embed tab listener
    _removeEmbedFocusToast();
    var _pm = document.getElementById('player-modal');
    if (_pm) _pm.classList.remove('player-embed-mode');
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
        playerModal.addEventListener('mousemove',  function() { showPlayerUI(); });
        playerModal.addEventListener('touchstart',  function() { showPlayerUI(); }, { passive: true });
        playerModal.addEventListener('mouseleave', function() {
          if (_hideTimer) clearTimeout(_hideTimer);
          _hideTimer = setTimeout(hidePlayerUI, 1500);
        });
      }
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        _streamErrorRetries = 0;
        if (typeof NexPlayDB !== 'undefined') {
          NexPlayDB.addToHistory(_params.id, _params.type || 'movie',
            _titleCache, _posterCache, _currentSeason, _currentEpisode);
        }
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
        }

        video.addEventListener('ended', function() {
          if (_params.playlist === 'watchlist') { goNextInPlaylist(); return; }
          _autoplayNext();
        });

        // Auto-load English subtitles (warms cache and selects English if available)
        if (typeof SubtitleClient !== 'undefined' && typeof webapis === 'undefined' && !_subActiveLang) {
          SubtitleClient.getLanguages(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode)
            .then(function(langs) {
              if (_subActiveLang) return;
              var en = langs.find(function(l) { return l.language === 'en' || l.language === 'eng'; });
              if (!en) return;
              SubtitleClient.loadLanguage(_params.id, _params.type || 'movie', en.language, _currentSeason, _currentEpisode)
                .then(function(sub) {
                  if (!sub || _subActiveLang) return;
                  _subActiveLang = en.language;
                  var video = document.getElementById('web-video');
                  if (video) SubtitleClient.applySubtitle(video, sub);
                  var btn = document.getElementById('player-cc-btn');
                  if (btn) {
                    btn.classList.add('cc-active');
                    btn.querySelector('.cc-label').textContent = 'EN';
                  }
                })
                .catch(function() {});
            })
            .catch(function() {});
        }

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
          _updateBufferFill(video, pct);
          if (pos > 10000 && typeof NexPlayDB !== 'undefined') {
            NexPlayDB.saveProgress(_params.id, _params.type || 'movie',
              _titleCache, _posterCache, Math.round(pos), Math.round(dur),
              _currentSeason, _currentEpisode);
          }
        }, 3000);
      });
      hls.on(Hls.Events.ERROR, function(ev, data) {
        console.error('[Player] HLS error:', data.type, data.details, data.fatal);
        if (data.fatal) {
          if (_isDirect) {
            // Direct CDN access failed — retry through the CF Worker proxy
            var proxied = buildProxyUrl(_currentStreamUrl, _qualityHeaders);
            playWithHlsJs(proxied, _qualityHeaders, false);
          } else {
            // Both direct and proxy failed — try the next stream source (e.g. Vidrock after Videasy CDN fails)
            _streamErrorRetries++;
            if (_streamErrorRetries <= 2) {
              setPlayerStatus('Trying another source...');
              loadBestSource();
            } else {
              _streamErrorRetries = 0;
              trySource(0);
            }
          }
        }
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
    _currentStreamUrl = url;

    // Broadcast "now watching" presence (signed-in or TV-connected users)
    if (_params && _params.id) _startWatchingHeartbeat(_params.id);

    // Show settings button for all non-TV streams (TV uses quality DD instead).
    var swrap = document.getElementById('player-settings-wrap');
    if (swrap) swrap.style.display = '';

    setPlayerStatus('Loading...');

    if (typeof webapis === 'undefined' || !webapis.avplay) {
      // Web/mobile: for CDN-auth streams try the URL DIRECTLY first.
      // CDNs like mooncarpet.site block CF Worker datacenter IPs with 403,
      // but allow residential browser IPs. Try direct, fall back to proxy on fatal error.
      var hasHeaders = headers && Object.keys(headers).length > 0;
      if (hasHeaders) {
        playWithHlsJs(url, headers, true); // true = direct mode, will proxy on failure
      } else {
        var playUrl = buildProxyUrl(url, headers);
        playWithHlsJs(playUrl, headers, false);
      }
      return;
    }

    // TV: AVPlay via proxy
    var playUrl = buildProxyUrl(url, headers);
    // Restore controls in case we're retrying after an iframe embed
    _removeEmbedFocusToast();
    var _pm2 = document.getElementById('player-modal');
    if (_pm2) _pm2.classList.remove('player-embed-mode');

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
        onbufferingstart: function() { setPlayerStatus('Buffering...'); },
        onbufferingcomplete: function() { setPlayerStatus(''); updatePlayIcon(true); },
        oncompletion: function() {
          if (_params.playlist === 'watchlist') { goNextInPlaylist(); return; }
          _autoplayNext();
        },
        onerror: function(e) {
          // Guard: callbacks can fire after the player is closed on Tizen
          var _m = document.getElementById('player-modal');
          if (!_m || _m.classList.contains('hidden')) return;
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
        },
      });

      // Hard timeout — avoids "Loading..." forever when CDN returns a bad response
      var _avplayTimeout = setTimeout(function() {
        var _m = document.getElementById('player-modal');
        if (!_m || _m.classList.contains('hidden')) return;
        console.warn('[Player] AVPlay prepareAsync timeout');
        try { webapis.avplay.stop(); } catch(e) {}
        try { webapis.avplay.close(); } catch(e) {}
        document.body.classList.remove('movie-avplay-on');
        _streamErrorRetries++;
        if (_streamErrorRetries <= 2) {
          setPlayerStatus('Reconnecting...');
          loadBestSource();
        } else {
          _streamErrorRetries = 0;
          trySource(0);
        }
      }, 15000);

      webapis.avplay.prepareAsync(
        function() {
          clearTimeout(_avplayTimeout);
          _streamErrorRetries = 0;
          webapis.avplay.play();
          setPlayerStatus('');
          updatePlayIcon(true);
          // Defer out of AVPlay native callback context so document.addEventListener
          // registers correctly on Tizen 3.0 (fails silently when called inline).
          setTimeout(startAutoHide, 0);
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
            } catch(e) {}
          }
          // Auto-load English subtitles if available and none selected yet
          if (typeof SubtitleClient !== 'undefined' && !_subActiveLang) {
            SubtitleClient.getLanguages(_params.id, _params.type || 'movie', _currentSeason, _currentEpisode)
              .then(function(langs) {
                if (_subActiveLang) return;
                var en = langs.find(function(l) { return l.language === 'en' || l.language === 'eng'; });
                if (!en) return;
                SubtitleClient.loadLanguage(_params.id, _params.type || 'movie', en.language, _currentSeason, _currentEpisode)
                  .then(function(sub) {
                    if (!sub || _subActiveLang) return;
                    _subActiveLang = en.language;
                    _applySubtitleTV(sub);
                  })
                  .catch(function() {});
              })
              .catch(function() {});
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
          clearTimeout(_avplayTimeout);
          console.error('[Player] prepareAsync error:', e);
          document.body.classList.remove('movie-avplay-on');
          // Re-resolve to get fresh CDN URLs (same as onerror retry)
          _streamErrorRetries++;
          if (_streamErrorRetries <= 2) {
            setPlayerStatus('Reconnecting...');
            loadBestSource();
          } else {
            _streamErrorRetries = 0;
            trySource(0);
          }
        }
      );
    } catch(e) {
      console.error('[Player] playWithUrl exception:', e.message);
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
  }

  // ── Torrent source (web/mobile only — WebRTC required) ──────────────────
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
          _qualityHeaders = result.headers || null;

          // autoDownload: skip playback and trigger download through settings panel
          if (_params.autoDownload) {
            _currentStreamUrl = result.url;
            _qualityHeaders   = result.headers || null;
            setPlayerStatus('Ready to download');
            setTimeout(function() { _handleDownload(); }, 400);
            return;
          }

          setPlayerStatus('Starting playback...');
          var _savedPrefLabel = '';
          if (_streamErrorRetries === 0) {
            try { _savedPrefLabel = localStorage.getItem('np_pref_quality') || ''; } catch(e) {}
          }
          var _prefQ = _savedPrefLabel && _availableQualities.find(function(q) { return q.label === _savedPrefLabel; });
          playWithUrl(_prefQ ? _prefQ.url : result.url, result.headers);
          renderQualityDropdown();
        } else if (result && result.type === 'torrent') {
          setPlayerStatus('Loading torrent...');
          playWithWebTorrent(result.magnetURI);
        } else {
          trySource(0);
        }
      })
      .catch(function(e) {
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
      label: (s.season_number === _currentSeason ? '▶  ' : '') + `Season ${s.season_number}  (${s.episode_count} eps)`,
    }));

    const isMobilePanel = panel.classList.contains('episode-panel-mobile');
    panel.innerHTML = `
      <div class="ep-panel-header"${isMobilePanel ? ' style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);"' : ''}>
        ${TVDropdown.html('season-dd', seasonOptions, String(_currentSeason))}
      </div>
      <div class="episode-list" id="episode-list" data-scroll
        ${isMobilePanel ? 'style="display:-webkit-flex;display:flex;-webkit-flex-direction:row;flex-direction:row;overflow-x:auto;overflow-y:hidden;gap:8px;padding:8px 12px;flex:1;"' : ''}>
        <div style="padding:12px;text-align:center;color:rgba(240,240,248,0.45);">Loading...</div>
      </div>`;

    TVDropdown.mount('season-dd', v => {
      _currentSeason  = parseInt(v);
      _currentEpisode = 1;
      loadEpisodes(_currentSeason);
      // No loadBestSource() here — playback only starts when an episode is clicked
    });

    loadEpisodes(_currentSeason);
  }

  async function loadEpisodes(seasonNumber) {
    const list = document.getElementById('episode-list');
    if (!list) return;

    try {
      const season = await TMDB.tvSeason(_params.id, seasonNumber);
      const episodes = season.episodes || [];

      const isMobileList = !!(list.closest('.episode-panel-mobile'));
      const itemStyle = isMobileList
        ? 'style="flex-shrink:0;width:100px;flex-direction:column;padding:6px;gap:4px;align-items:flex-start;"'
        : '';
      const thumbStyle = isMobileList ? 'style="width:100%;height:56px;"' : '';
      const titleStyle = isMobileList
        ? 'style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;"'
        : '';
      list.innerHTML = episodes.map(ep => {
        const still = ep.still_path ? TMDB.img(ep.still_path, Config.IMG.POSTER_SM) : '';
        const active = ep.episode_number === _currentEpisode ? 'active' : '';
        return `
          <div class="episode-item ${active}" data-nav data-ep="${ep.episode_number}" tabindex="0" ${itemStyle}>
            <div class="ep-thumb" ${thumbStyle}>
              ${still
                ? `<img src="${still}" alt="Ep ${ep.episode_number}" loading="lazy">`
                : `<div class="ep-thumb-placeholder">></div>`}
              <div class="ep-num-badge">${ep.episode_number}</div>
            </div>
            <div class="ep-info">
              <div class="ep-title" ${titleStyle}>${ep.name || `Episode ${ep.episode_number}`}</div>
              ${!isMobileList ? `<div class="ep-meta">${ep.runtime ? ep.runtime + 'm' : ''}</div>` : ''}
            </div>
          </div>`;
      }).join('');

      list.querySelectorAll('[data-ep]').forEach(el => {
        el.addEventListener('click', () => {
          _currentEpisode = parseInt(el.dataset.ep);
          list.querySelectorAll('[data-ep]').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          // Sync the play icon in season dropdown to the now-playing season
          document.querySelectorAll('[data-tdd-opt="season-dd"]').forEach(function(opt) {
            var span = opt.querySelector('span');
            if (!span) return;
            var text = span.textContent.replace(/^▶\s+/, '');
            span.textContent = (parseInt(opt.dataset.value) === _currentSeason) ? '▶  ' + text : text;
          });
          var trigLbl = document.getElementById('tdd-label-season-dd');
          if (trigLbl) {
            var txt = trigLbl.textContent.replace(/^▶\s+/, '');
            trigLbl.textContent = '▶  ' + txt;
          }
          loadBestSource();
        });
      });

      Nav.reset(document.getElementById('player-modal'));
      if (typeof webapis !== 'undefined') {
        setTimeout(function() {
          var ep   = document.querySelector('#episode-list .episode-item.active') || document.querySelector('#episode-list .episode-item');
          var play = document.getElementById('ctrl-play');
          if (ep) Nav.focusEl(ep); else if (play) Nav.focusEl(play);
        }, 0);
      }
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
    var prefLabel = '';
    try { prefLabel = localStorage.getItem('np_pref_quality') || ''; } catch(e) {}
    var prefIdx = _availableQualities.findIndex(function(q) { return q.label === prefLabel; });
    var bestIdx = _availableQualities.findIndex(function(q) { return q.label === '1080p'; });
    var defaultIdx = prefIdx >= 0 ? prefIdx : (bestIdx >= 0 ? bestIdx : 0);
    wrap.innerHTML = TVDropdown.html('quality-dd', opts, String(defaultIdx));
    wrap.style.display = '';
    TVDropdown.mount('quality-dd', function(val) {
      var qi = parseInt(val);
      var q = _availableQualities[qi];
      if (!q) return;
      try { localStorage.setItem('np_pref_quality', q.label); } catch(e) {}
      _resumePos = capturePos(); // save position before stopping
      var hdrs = (_qualityHeaders && Object.keys(_qualityHeaders).length) ? _qualityHeaders : { 'Referer': 'https://cineby.sc/', 'Origin': 'https://cineby.sc' };
      stopAvPlay();
      setPlayerStatus('Switching quality...');
      playWithUrl(q.url, hdrs);
    });
  }

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function render(container, params = {}) {
    _params = params;
    _currentSeason    = parseInt(params.season  || 1);
    _currentEpisode   = parseInt(params.episode || 1);
    _activeSourceIdx  = 0;
    _seriesDetails    = null;
    try { _autoplayEnabled = localStorage.getItem('np_pref_autoplay') === '1'; } catch(e) {}
    _availableQualities = [];
    _qualityHeaders      = null;
    _resumePos           = 0;
    _streamErrorRetries  = 0;
    _seekMode            = false;
    _seekPreview         = 0;

    const isTV     = params.type === 'tv';
    const isMobile = window.innerWidth < 1024;
    const rightPad = isMobile ? 0 : (isTV ? 300 : 240);
    const modal = document.getElementById('player-modal');
    if (!modal) return;

    stopAvPlay();
    modal.classList.remove('hidden');
    document.body.classList.add('player-open');

    modal.innerHTML = `
      <div class="player-header" style="margin-right:${rightPad}px;">
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
          <div id="player-subtitle-overlay" class="player-subtitle-overlay"></div>
        </div>
        ${!isMobile ? (isTV ? `<div id="episode-panel" class="episode-panel"></div>` : `<div id="similar-slot"></div>`) : ''}
      </div>

      ${isMobile && isTV
        ? `<div id="episode-panel" class="episode-panel episode-panel-mobile"
             style="width:100%;height:160px;min-height:160px;max-height:160px;flex-shrink:0;flex-direction:column;border-left:none;border-top:1px solid rgba(255,255,255,0.08);"></div>`
        : ''}

      <div class="player-cbar" id="player-cbar" style="right:${rightPad}px;">
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
          <!-- Quality dropdown — visible on TV (D-pad), hidden on web/mobile (settings panel used instead) -->
          <div id="quality-dd-wrap" class="player-cbar-quality">
            ${TVDropdown.html('quality-dd', [{ value: 'auto', label: 'Auto' }], 'auto')}
          </div>
        </div>
        <!-- Row 2 (bottom): seek track + time + gear settings button -->
        <div class="player-cbar-row1">
          <div class="player-cbar-track" id="seek-track" data-nav tabindex="0" title="Left/Right to seek">
            <div id="buffer-fill" class="player-cbar-buffer-fill"></div>
            <div id="progress-fill" class="player-cbar-fill"></div>
          </div>
          <span id="player-time" class="player-cbar-time">0:00 / 0:00</span>
          <!-- ⚙ Settings button (web/mobile only) — consolidates quality, subtitles, download -->
          <div id="player-settings-wrap" class="player-settings-wrap" style="display:none;">
            <button id="player-settings-btn" class="player-settings-btn" data-nav tabindex="0" title="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
          <!-- Legacy single-track download pill (web/mobile) — hidden, kept so download JS refs work -->
          <button id="player-dl-btn" class="player-dl-btn" style="display:none!important;">
            <span class="dl-fill" id="player-dl-fill"></span>
            <svg class="dl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            <span class="dl-label">Save</span>
          </button>
          <!-- Legacy CC button — hidden, kept so CC JS refs work -->
          <button id="player-cc-btn" class="player-cc-btn" style="display:none!important;">
            <span class="cc-label">CC</span>
          </button>
        </div>
        <!-- Shell retained so JS references to player-dl-row don't throw -->
        <div id="player-dl-row" style="display:none;"></div>
      </div>

      <div class="player-info-bar" style="right:${rightPad}px;">
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
      try { localStorage.setItem('np_pref_quality', q.label); } catch(e) {}
      _resumePos = capturePos();
      var hdrs = (_qualityHeaders && Object.keys(_qualityHeaders).length) ? _qualityHeaders : { 'Referer': 'https://cineby.sc/', 'Origin': 'https://cineby.sc' };
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

    // Settings button — also shown on TV (quality, subtitles, who's watching via D-pad)
    var settingsBtn = document.getElementById('player-settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', function(e) { e.stopPropagation(); _toggleSettingsPanel(); });

    Nav.reset(modal);
    if (typeof webapis !== 'undefined') {
      setTimeout(function() {
        var play = document.getElementById('ctrl-play');
        if (play) Nav.focusEl(play);
      }, 150);
    }
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
        if (typeof webapis !== 'undefined') {
          setTimeout(function() {
            var ep   = document.querySelector('#episode-list .episode-item.active') || document.querySelector('#episode-list .episode-item');
            var play = document.getElementById('ctrl-play');
            if (ep) Nav.focusEl(ep); else if (play) Nav.focusEl(play);
          }, 150);
        }
      } catch (err) {
        console.error('Player metadata error:', err);
      }
    }
  }

  function closePlayer() {
    _closeSettingsPanel();
    _stopWatchingHeartbeat();
    _removeSubtitleTV();
    _subActiveLang  = null;
    if (_autoplayTimer) { clearInterval(_autoplayTimer); _autoplayTimer = null; }
    var _acd = document.getElementById('autoplay-countdown');
    if (_acd && _acd.parentNode) _acd.parentNode.removeChild(_acd);
    _dlQualityIdx   = 0;
    stopAutoHide();
    stopMediaKeys();
    stopAvPlay();
    document.body.classList.remove('player-open');
    const modal = document.getElementById('player-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('player-embed-mode');
    }
    _removeEmbedFocusToast();
    Nav.reset(document.getElementById('main-content'));
  }

  function onLeave() { closePlayer(); }

  return { render, closePlayer, onLeave };
})();


