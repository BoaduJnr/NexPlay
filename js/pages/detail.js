const DetailPage = (() => {
  var _detailDLController = null; // AbortController for active detail-page download

  function render(container, params) {
    const id   = params.id;
    const type = params.type || 'movie';

    container.innerHTML = `
      <div id="detail-page" style="min-height:1080px;position:relative;">
        <div id="detail-backdrop" style="position:absolute;top:0;left:0;right:0;bottom:0;">
          <div id="detail-backdrop-img" style="position:absolute;top:0;left:0;right:0;height:540px;background-size:cover;background-position:center top;"></div>
          <div class="detail-grad-overlay" style="position:absolute;top:0;left:0;right:0;height:540px;"></div>
        </div>
        <div style="position:relative;padding:320px 72px 60px;">
          <div id="detail-content" style="max-width:700px;">
            <div id="detail-genres" class="detail-genres-text" style="font-size:14px;margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;"></div>
            <h1 id="detail-title" class="detail-title-text" style="font-size:52px;font-weight:900;margin-bottom:16px;"></h1>
            <div id="detail-meta" class="detail-meta-text" style="font-size:18px;margin-bottom:24px;"></div>
            <p id="detail-overview" class="detail-overview-text" style="font-size:20px;line-height:1.7;margin-bottom:36px;max-width:620px;"></p>
            <div class="detail-btns">
              <button class="btn btn-primary detail-btn" id="detail-play" data-nav data-nav-default tabindex="0">
                &#9654; Play
              </button>
              ${type === 'movie' ? `
              <button class="btn btn-secondary detail-btn detail-dl-btn" id="detail-dl" data-nav tabindex="0">
                <svg id="detail-dl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                <span id="detail-dl-lbl">Download</span>
              </button>` : ''}
              <button class="btn btn-secondary detail-btn" id="detail-fav" data-nav tabindex="0">
                &#9825; Favourite
              </button>
              <button class="btn btn-secondary detail-btn" id="detail-wl" data-nav tabindex="0">
                + Watchlist
              </button>
            </div>
            <!-- Inline download progress — shown below buttons when downloading -->
            <div id="detail-dl-progress" class="detail-dl-progress">
              <div class="detail-dl-track">
                <div id="detail-dl-fill" class="detail-dl-fill"></div>
                <span id="detail-dl-status" class="detail-dl-status"></span>
              </div>
            </div>
            <div id="detail-cast" style="margin-bottom:40px;"></div>
          </div>
        </div>
      </div>`;

    Nav.reset(container);

    document.getElementById('detail-play').addEventListener('click', function() {
      App.navigate('player', { id: id, type: type, season: 1, episode: 1 });
    });

    // Download — runs inline on the detail page (no player navigation needed)
    var _detailMovieTitle = '', _detailMovieYear = 2020;
    const dlBtn = document.getElementById('detail-dl');
    if (dlBtn) {
      dlBtn.addEventListener('click', function() {
        if (dlBtn.dataset.dlActive === '1') {
          // Cancel the active download
          if (_detailDLController) { _detailDLController.abort(); _detailDLController = null; }
        } else {
          _runDetailDownload(id, _detailMovieTitle, _detailMovieYear);
        }
      });
    }

    // Fav / Watchlist buttons — update once data is available
    function refreshListBtns(title, poster) {
      const favBtn = document.getElementById('detail-fav');
      const wlBtn  = document.getElementById('detail-wl');
      if (!favBtn || !wlBtn || typeof NexPlayDB === 'undefined') return;

      const isFav = NexPlayDB.isFavourite(id, type);
      const isWL  = NexPlayDB.isInWatchlist(id, type);

      favBtn.innerHTML = isFav ? '&#9829; In Favourites' : '&#9825; Favourite';
      favBtn.style.color = isFav ? '#f87171' : '';
      wlBtn.innerHTML  = isWL  ? '&#10003; In Watchlist' : '+ Watchlist';
      wlBtn.style.color = isWL ? '#4ade80' : '';

      favBtn.onclick = function() {
        const added = NexPlayDB.toggleFavourite(id, type, title, poster);
        App.showToast(added ? 'Added to Favourites' : 'Removed from Favourites');
        refreshListBtns(title, poster);
      };
      wlBtn.onclick = function() {
        const added = NexPlayDB.toggleWatchlist(id, type, title, poster);
        App.showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist');
        refreshListBtns(title, poster);
      };
    }

    // Wire up placeholders immediately so buttons are focusable
    refreshListBtns('', '');

    // Load data
    const fetchFn = type === 'tv'
      ? TMDB.tvDetails(parseInt(id))
      : TMDB.details(parseInt(id));

    fetchFn.then(function(d) {
      const title   = d.title || d.name || '';
      const year    = (d.release_date || d.first_air_date || '').slice(0, 4);
      _detailMovieTitle = title;
      _detailMovieYear  = parseInt(year) || 2020;
      const rating  = d.vote_average ? ('★ ' + d.vote_average.toFixed(1)) : '';
      const runtime = d.runtime ? TMDB.formatRuntime(d.runtime) : (d.number_of_seasons ? d.number_of_seasons + ' seasons' : '');
      const genres  = (d.genres || []).slice(0, 4).map(function(g) { return g.name; }).join('  |  ');
      const backdrop = d.backdrop_path ? TMDB.backdrop(d.backdrop_path, Config.IMG.BACKDROP_FULL) : '';
      const poster   = d.poster_path   ? TMDB.img(d.poster_path, Config.IMG.POSTER_MD) : '';

      const titleEl    = document.getElementById('detail-title');
      const genresEl   = document.getElementById('detail-genres');
      const metaEl     = document.getElementById('detail-meta');
      const overviewEl = document.getElementById('detail-overview');
      const bdImg      = document.getElementById('detail-backdrop-img');

      if (titleEl)    titleEl.textContent    = title;
      if (genresEl)   genresEl.textContent   = genres;
      if (metaEl)     metaEl.textContent     = [year, runtime, rating].filter(Boolean).join('   |   ');
      if (overviewEl) overviewEl.textContent = d.overview || '';
      if (bdImg && backdrop) bdImg.style.backgroundImage = 'url(' + backdrop + ')';

      // Refresh list buttons with real title + poster
      refreshListBtns(title, poster);

      // Cast
      const credits = d.credits || d.aggregate_credits;
      if (credits && credits.cast && credits.cast.length) {
        const castEl = document.getElementById('detail-cast');
        if (castEl) {
          castEl.innerHTML = '<div class="detail-cast-header" style="font-size:16px;margin-bottom:16px;letter-spacing:1px;text-transform:uppercase;">Cast</div>'
            + '<div style="display:-webkit-flex;display:flex;flex-wrap:wrap;">'
            + credits.cast.slice(0, 8).map(function(p) {
                const img = p.profile_path ? TMDB.img(p.profile_path, Config.IMG.POSTER_SM) : '';
                return '<div style="margin-right:28px;margin-bottom:16px;text-align:center;width:80px;">'
                  + (img
                    ? '<img src="' + img + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.15);">'
                    : '<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;">?</div>')
                  + '<div class="detail-cast-name" style="margin-top:8px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;" title="' + p.name + '">' + p.name + '</div>'
                  + '</div>';
              }).join('')
            + '</div>';
        }
      }

      Nav.reset(container);
    }).catch(function() {});
  }

  // ── Inline movie download — runs on the detail page without opening the player ──
  async function _runDetailDownload(movieId, title, year) {
    var PROXY = 'https://nexplay-proxy.pielly16.workers.dev';
    var dlBtn   = document.getElementById('detail-dl');
    var progress= document.getElementById('detail-dl-progress');
    var fill    = document.getElementById('detail-dl-fill');
    var status  = document.getElementById('detail-dl-status');
    var lbl     = document.getElementById('detail-dl-lbl');
    var ico     = document.getElementById('detail-dl-ico');

    if (!dlBtn || dlBtn.dataset.dlActive === '1') return;
    dlBtn.dataset.dlActive = '1';

    _detailDLController = new AbortController();
    var signal = _detailDLController.signal;

    var safeName = (title || 'movie').replace(/[^a-zA-Z0-9 ]/g, '_').slice(0, 60);

    function setLbl(t) { if (lbl) lbl.textContent = t; }
    function setIco(d) { if (ico) ico.innerHTML = d; }
    function setFill(pct) { if (fill) fill.style.width = pct + '%'; }
    function setStatus(t) { if (status) status.textContent = t; }
    function showProgress() { if (progress) progress.classList.add('active'); }
    function resetUI() {
      dlBtn.dataset.dlActive = '';
      _detailDLController = null;
      setLbl('Download'); setFill(0); setStatus('');
      setIco('<path d="M12 5v14M5 12l7 7 7-7"/>');
      if (progress) progress.classList.remove('active');
    }
    function fail(msg) {
      resetUI();
      if (msg && typeof App !== 'undefined') App.showToast(msg);
    }

    // Show Cancel button during download
    setIco('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    setLbl('Cancel'); showProgress(); setStatus('Finding stream…');

    try {
      if (typeof StreamResolver === 'undefined') { fail('StreamResolver unavailable'); return; }

      // Step 1: resolve stream (same chain as player)
      var result = await StreamResolver.resolveMovie(movieId, title, year);
      if (!result || !result.url) { fail('No stream found for download'); return; }

      var streamUrl = result.url;
      var headers   = result.headers || {};
      var hB64 = Object.keys(headers).length ? btoa(JSON.stringify(headers)) : '';

      function pxUrl(u) {
        if (u.indexOf(PROXY) === 0) return u;
        return PROXY + '/?url=' + encodeURIComponent(u) + (hB64 ? '&headers=' + encodeURIComponent(hB64) : '');
      }
      function origOf(u) {
        if (u.indexOf(PROXY) !== 0) return u;
        try { return decodeURIComponent(new URL(u).searchParams.get('url') || u); } catch(e) { return u; }
      }
      function absUrl(rel, base) {
        if (/^https?:\/\//i.test(rel)) return rel;
        if (rel.charAt(0) === '/') { var m = base.match(/^(https?:\/\/[^\/]+)/); return m ? m[1]+rel : rel; }
        return base.substring(0, base.lastIndexOf('/') + 1) + rel;
      }

      // Step 2: load mux.js
      if (typeof muxjs === 'undefined') {
        setStatus('Loading converter…'); setLbl('Init…');
        await new Promise(function(res, rej) {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/mux.js@6/dist/mux.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      setStatus('Fetching playlist…'); setLbl('…');

      // Step 3: fetch + parse m3u8
      if (signal.aborted) { resetUI(); return; }
      var r0 = await fetch(pxUrl(streamUrl), { signal: signal });
      if (!r0.ok) throw new Error('Manifest ' + r0.status);
      var m3u8 = await r0.text();

      function parseM3u8(text, origBase) {
        var lines = text.trim().split('\n').map(function(l){return l.trim();}).filter(Boolean);
        var segs=[], isMaster=false, bestBw=0, bestProxyUrl=null, bestOrig=null;
        var live = text.indexOf('#EXT-X-ENDLIST') === -1;
        for (var i=0; i<lines.length; i++) {
          var ln = lines[i];
          if (ln.indexOf('#EXT-X-STREAM-INF') === 0) {
            isMaster = true;
            var bwm = ln.match(/BANDWIDTH=(\d+)/i);
            var bw  = bwm ? parseInt(bwm[1]) : 0;
            if (bw >= bestBw && i+1 < lines.length && lines[i+1].charAt(0) !== '#') {
              bestBw = bw;
              var raw = lines[i+1];
              var orig = absUrl(origOf(raw), origBase);
              bestOrig = orig; bestProxyUrl = pxUrl(orig);
            }
          } else if (ln.charAt(0) !== '#' && ln.length > 0 && !isMaster) {
            segs.push(pxUrl(absUrl(origOf(ln), origBase)));
          }
        }
        return { isMaster: isMaster, isLive: live && !isMaster, bestProxyUrl: bestProxyUrl, bestOrig: bestOrig, segs: segs };
      }

      var parsed = parseM3u8(m3u8, streamUrl);
      if (parsed.isMaster) {
        if (!parsed.bestProxyUrl) throw new Error('No variant found');
        setStatus('Fetching variant…');
        var rv = await fetch(parsed.bestProxyUrl, { signal: signal });
        var rt = await rv.text();
        parsed = parseM3u8(rt, parsed.bestOrig || streamUrl);
      }
      if (parsed.isLive) { fail('Live streams cannot be downloaded'); return; }
      if (!parsed.segs.length) throw new Error('No segments found');

      setStatus('Downloading ' + parsed.segs.length + ' segments…');
      if (typeof App !== 'undefined') App.showToast('Downloading ' + parsed.segs.length + ' segments — saves as MP4');

      // Step 4: setup FSA or blob
      var writable = null;
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          var fh = await window.showSaveFilePicker({ suggestedName: safeName + '.mp4', types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }] });
          writable = await fh.createWritable();
        } catch(e) { if (e.name === 'AbortError') { resetUI(); return; } writable = null; }
      }

      // Step 5: transmux TS → MP4 with mux.js
      var tx = new muxjs.mp4.Transmuxer();
      var chunks = [], wQueue = Promise.resolve(), initDone = false, failed = 0;
      tx.on('data', function(seg) {
        var pieces = [];
        if (!initDone && seg.initSegment && seg.initSegment.byteLength > 0) { pieces.push(new Uint8Array(seg.initSegment)); initDone = true; }
        if (seg.data && seg.data.byteLength > 0) pieces.push(new Uint8Array(seg.data));
        if (!pieces.length) return;
        if (writable) { pieces.forEach(function(p) { wQueue = wQueue.then(function() { return writable.write(p); }); }); }
        else { pieces.forEach(function(p) { chunks.push(p); }); }
      });

      var BATCH = 4;
      for (var i = 0; i < parsed.segs.length; i += BATCH) {
        if (signal.aborted) break;
        var batch = parsed.segs.slice(i, i + BATCH);
        var results = await Promise.all(batch.map(function(u) {
          return fetch(u, { signal: signal }).then(function(r) { return r.ok ? r.arrayBuffer() : null; })
            .then(function(ab) { return ab ? new Uint8Array(ab) : null; }).catch(function() { return null; });
        }));
        results.forEach(function(r) { if (!r) { failed++; return; } tx.push(r); });
        tx.flush();
        var pct = Math.round(Math.min(i + BATCH, parsed.segs.length) / parsed.segs.length * 100);
        setFill(pct); setLbl(pct + '%');
        setStatus((Math.min(i+BATCH, parsed.segs.length)) + '/' + parsed.segs.length);
      }
      tx.flush();
      await wQueue;

      // Step 6: save
      if (writable) {
        await writable.close();
      } else if (chunks.length) {
        setStatus('Saving…'); setLbl('Saving…');
        var total = chunks.reduce(function(s,c) { return s+c.byteLength; }, 0);
        var out = new Uint8Array(total), off = 0;
        chunks.forEach(function(c) { out.set(c, off); off += c.byteLength; });
        var blob = new Blob([out], { type: 'video/mp4' });
        var objUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = objUrl; a.download = safeName + '.mp4';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(objUrl); }, 5000);
      }

      // Step 7: done state
      setIco('<polyline points="20 6 9 17 4 12"/>');
      setLbl(failed ? 'Saved*' : 'Saved');
      setFill(100);
      setStatus(failed ? 'Done – ' + failed + ' segments failed' : 'Download complete');
      if (typeof App !== 'undefined') App.showToast('Download complete!');

      setTimeout(function() { resetUI(); }, 6000);

    } catch(e) {
      if (e.name === 'AbortError') { resetUI(); return; }
      fail('Download failed: ' + (e.message || String(e)));
    }
  }

  return { render: render };
})();
