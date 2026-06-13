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
var CloudSync = function () {
  var _uid = null;
  var _synced = false; // true once syncDown has run this session

  // ── Anonymous user ID ─────────────────────────────────
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

  // ── Init ──────────────────────────────────────────────
  function init() {
    _uid = _getOrCreateUid();
    _synced = false; // allow re-sync after every init (e.g. Sync Now button)
    console.log('[CloudSync] Ready — uid:', _uid);
  }

  // ── Push local data → Deno KV ─────────────────────────
  function syncUp() {
    if (!_uid || typeof NexPlayDB === 'undefined') return Promise.resolve();

    // Include user profile so TV can show name/avatar after connecting
    var profile = null;
    try {
      var u = localStorage.getItem('np_user');
      if (u) {
        var parsed = JSON.parse(u);
        profile = {
          name: parsed.name || '',
          email: parsed.email || '',
          firstName: parsed.firstName || '',
          lastName: parsed.lastName || '',
          picture: parsed.picture || ''
        };
      }
    } catch (e) {}
    var data = JSON.stringify({
      ts: Date.now(),
      profile: profile,
      favourites: NexPlayDB.getFavourites(500),
      watchlist: NexPlayDB.getWatchlist(500),
      history: NexPlayDB.getHistory(200)
    });
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/sync?uid=' + encodeURIComponent(_uid), true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 8000;
      xhr.onload = function () {
        console.log('[CloudSync] syncUp OK');
        resolve();
      };
      xhr.onerror = function () {
        resolve();
      };
      xhr.ontimeout = function () {
        resolve();
      };
      xhr.send(data);
    });
  }

  // ── Pull Deno KV → localStorage and merge with local ──
  function syncDown() {
    if (!_uid || _synced || typeof NexPlayDB === 'undefined') return Promise.resolve();
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/sync?uid=' + encodeURIComponent(_uid), true);
      xhr.timeout = 8000;
      xhr.onload = function () {
        _synced = true;
        if (xhr.status !== 200) {
          resolve();
          return;
        }
        var data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          resolve();
          return;
        }
        if (!data) {
          resolve();
          return;
        }

        // Replace local favourites with cloud data (server is authoritative — prevents ghost items)
        if (data.favourites !== undefined && data.favourites !== null) {
          try {
            var favData = data.favourites.map(function (f) {
              return {
                id: String(f.id),
                type: f.type,
                title: f.title,
                poster: f.poster || '',
                rating: parseFloat(f.rating) || 0,
                addedAt: f.addedAt || 0
              };
            });
            localStorage.setItem('np_favourites', JSON.stringify(favData));
            console.log('[CloudSync] Replaced favourites:', favData.length, 'items');
          } catch (e) {}
        }

        // Replace local watchlist with cloud data
        if (data.watchlist !== undefined && data.watchlist !== null) {
          try {
            var wlData = data.watchlist.map(function (f) {
              return {
                id: String(f.id),
                type: f.type,
                title: f.title,
                poster: f.poster || '',
                rating: parseFloat(f.rating) || 0,
                addedAt: f.addedAt || 0
              };
            });
            localStorage.setItem('np_watchlist', JSON.stringify(wlData));
            console.log('[CloudSync] Replaced watchlist:', wlData.length, 'items');
          } catch (e) {}
        }

        // Restore profile so TV can show user name/avatar
        if (data.profile) {
          try {
            localStorage.setItem('np_tv_profile', JSON.stringify(data.profile));
          } catch (e) {}
        }
        console.log('[CloudSync] Sync complete');
        resolve();
      };
      xhr.onerror = function () {
        _synced = true;
        resolve();
      };
      xhr.ontimeout = function () {
        _synced = true;
        resolve();
      };
      xhr.send();
    });
  }
  return {
    init: init,
    syncUp: syncUp,
    syncDown: syncDown
  };
}();