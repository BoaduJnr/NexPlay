'use strict';

/*
 * CloudSync — cross-device sync via Deno KV REST endpoints.
 * Only loaded in the web bundle (nexplay-single.ts).
 * TV (index.html) never loads this file → all syncUp() calls skip silently.
 *
 * Endpoints (same origin on Deno Deploy):
 *   GET  /api/sync?uid=xxx  → returns saved JSON or null
 *   POST /api/sync?uid=xxx  → saves JSON body
 *
 * Tizen 3.0 compatible: plain XHR, no async/await, no arrow functions.
 */
var CloudSync = (function () {
  var _uid       = null;
  var _synced    = false; // true once syncDown has run this session
  var _syncTimer = null;  // debounce handle for queueSyncUp

  // ── Helpers ───────────────────────────────────────────
  function _getOrCreateUid() {
    try {
      var id = localStorage.getItem('np_sync_uid');
      if (!id) {
        id = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('np_sync_uid', id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  // Merge two arrays by id+type, keeping the item with the newer addedAt.
  function _mergeById(local, server) {
    var map = {};
    server.forEach(function(item) {
      map[item.id + '|' + item.type] = item;
    });
    local.forEach(function(item) {
      var key = item.id + '|' + item.type;
      if (!map[key] || (item.addedAt || 0) > (map[key].addedAt || 0)) map[key] = item;
    });
    return Object.keys(map).map(function(k) { return map[k]; })
      .sort(function(a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
  }

  // Merge progress objects (keyed by progressKey), keeping the newer updatedAt.
  function _mergeProgress(local, server) {
    var merged = {};
    Object.keys(server || {}).forEach(function(k) { merged[k] = server[k]; });
    Object.keys(local || {}).forEach(function(k) {
      if (!merged[k] || (local[k].updatedAt || 0) > (merged[k].updatedAt || 0)) merged[k] = local[k];
    });
    return merged;
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    _uid = _getOrCreateUid();
    _synced = false; // allow re-sync after every init (e.g. Sync Now button)
    console.log('[CloudSync] Ready — uid:', _uid);
  }

  // ── Debounced sync up (called after every DB mutation) ─
  function queueSyncUp() {
    if (!_uid) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function() { _syncTimer = null; syncUp(); }, 3000);
  }

  // ── Push local data → Deno KV ─────────────────────────
  function syncUp() {
    if (!_uid || typeof NexPlayDB === 'undefined') return Promise.resolve();
    if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; } // flush any pending debounce

    // Include user profile so TV can show name/avatar after connecting
    var profile = null;
    try {
      var u = localStorage.getItem('np_user');
      if (u) {
        var parsed = JSON.parse(u);
        profile = {
          name:      parsed.name      || '',
          email:     parsed.email     || '',
          firstName: parsed.firstName || '',
          lastName:  parsed.lastName  || '',
          picture:   parsed.picture   || '',
        };
      }
    } catch (e) {}

    var statusHidden = false;
    try { statusHidden = localStorage.getItem('np_status_hidden') === '1'; } catch(e) {}

    var data = JSON.stringify({
      ts:           Date.now(),
      profile:      profile,
      statusHidden: statusHidden,
      favourites:   NexPlayDB.getFavourites(500),
      watchlist:    NexPlayDB.getWatchlist(500),
      history:      NexPlayDB.getHistory(200),
      progress:     NexPlayDB.getAllProgress(),
    });

    var base = (typeof Config !== 'undefined' && Config.DEPLOY_URL) ? Config.DEPLOY_URL : '';
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', base + '/api/sync?uid=' + encodeURIComponent(_uid), true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 8000;
      xhr.onload  = function () { console.log('[CloudSync] syncUp OK'); resolve(); };
      xhr.onerror = function () { resolve(); };
      xhr.ontimeout = function () { resolve(); };
      xhr.send(data);
    });
  }

  // ── Pull Deno KV → localStorage and merge with local ──
  function syncDown() {
    if (!_uid || _synced || typeof NexPlayDB === 'undefined') return Promise.resolve();

    var base = (typeof Config !== 'undefined' && Config.DEPLOY_URL) ? Config.DEPLOY_URL : '';
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', base + '/api/sync?uid=' + encodeURIComponent(_uid), true);
      xhr.timeout = 8000;

      xhr.onload = function () {
        _synced = true;
        if (xhr.status !== 200) { resolve(); return; }

        var data;
        try { data = JSON.parse(xhr.responseText); } catch (e) { resolve(); return; }
        if (!data) { resolve(); return; }

        // Server wins for favourites (propagates deletes),
        // but re-add any local items added after the server snapshot (preserves offline adds).
        var serverTs = data.ts || 0;
        if (data.favourites !== undefined && data.favourites !== null) {
          try {
            var localFavs = NexPlayDB.getFavourites(500);
            var localNewFavs = localFavs.filter(function(f) { return (f.addedAt || 0) > serverTs; });
            var serverFavs = data.favourites.map(function(f) {
              return { id: String(f.id), type: f.type, title: f.title, poster: f.poster || '',
                       rating: parseFloat(f.rating) || 0, addedAt: f.addedAt || 0 };
            });
            var merged = _mergeById(localNewFavs, serverFavs);
            localStorage.setItem('np_favourites', JSON.stringify(merged));
            console.log('[CloudSync] Synced favourites:', merged.length, 'items');
          } catch (e) {}
        }

        // Same strategy for watchlist
        if (data.watchlist !== undefined && data.watchlist !== null) {
          try {
            var localWl = NexPlayDB.getWatchlist(500);
            var localNewWl = localWl.filter(function(f) { return (f.addedAt || 0) > serverTs; });
            var serverWl = data.watchlist.map(function(f) {
              return { id: String(f.id), type: f.type, title: f.title, poster: f.poster || '',
                       rating: parseFloat(f.rating) || 0, addedAt: f.addedAt || 0 };
            });
            var mergedWl = _mergeById(localNewWl, serverWl);
            localStorage.setItem('np_watchlist', JSON.stringify(mergedWl));
            console.log('[CloudSync] Synced watchlist:', mergedWl.length, 'items');
          } catch (e) {}
        }

        // Merge history: server base + local items watched after server snapshot
        if (data.history && Array.isArray(data.history)) {
          try {
            var localHistory = NexPlayDB.getHistory(200);
            var localNewHistory = localHistory.filter(function(h) { return (h.watchedAt || 0) > serverTs; });
            var histMap = {};
            data.history.forEach(function(h) { histMap[h.id + '|' + h.type + '|' + (h.season||'') + '|' + (h.episode||'')] = h; });
            localNewHistory.forEach(function(h) {
              var k = h.id + '|' + h.type + '|' + (h.season||'') + '|' + (h.episode||'');
              if (!histMap[k] || (h.watchedAt||0) > (histMap[k].watchedAt||0)) histMap[k] = h;
            });
            var mergedHistory = Object.keys(histMap).map(function(k) { return histMap[k]; })
              .sort(function(a, b) { return (b.watchedAt||0) - (a.watchedAt||0); }).slice(0, 200);
            localStorage.setItem('np_history', JSON.stringify(mergedHistory));
            console.log('[CloudSync] Synced history:', mergedHistory.length, 'items');
          } catch(e) {}
        }

        // Merge progress: newest updatedAt wins per key
        if (data.progress && typeof data.progress === 'object') {
          try {
            var localProg = NexPlayDB.getAllProgress();
            var mergedProg = _mergeProgress(localProg, data.progress);
            localStorage.setItem('np_progress', JSON.stringify(mergedProg));
            console.log('[CloudSync] Merged progress entries:', Object.keys(mergedProg).length);
          } catch (e) {}
        }

        // Restore online status preference across devices
        if (typeof data.statusHidden === 'boolean') {
          try { localStorage.setItem('np_status_hidden', data.statusHidden ? '1' : '0'); } catch (e) {}
        }

        // Restore profile so TV can show user name/avatar
        if (data.profile) {
          try { localStorage.setItem('np_tv_profile', JSON.stringify(data.profile)); } catch (e) {}
        }

        console.log('[CloudSync] Sync complete');
        resolve();
      };

      xhr.onerror   = function () { _synced = true; resolve(); };
      xhr.ontimeout = function () { _synced = true; resolve(); };
      xhr.send();
    });
  }

  return { init: init, syncUp: syncUp, syncDown: syncDown, queueSyncUp: queueSyncUp };
})();
