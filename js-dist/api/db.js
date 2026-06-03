"use strict";

/**
 * NexPlayDB — localStorage-based database for NexPlay.
 * Handles: watch history, continue-watching timestamps, playlists.
 * Uses localStorage + JSON (works reliably on Tizen 3.0).
 */
var NexPlayDB = function () {
  var K = {
    HISTORY: 'np_history',
    PROGRESS: 'np_progress',
    PLAYLISTS: 'np_playlists',
    FAVOURITES: 'np_favourites',
    WATCHLIST: 'np_watchlist'
  };
  var MAX_HISTORY = 100;
  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }
  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  // ── Progress (continue watching) ──────────────────────────────────────
  // key: "movie-550" or "tv-1396-1-3" (type-id-season-episode)
  function progressKey(id, type, season, episode) {
    return type === 'tv' ? 'tv-' + id + '-' + (season || 1) + '-' + (episode || 1) : 'movie-' + id;
  }
  function saveProgress(id, type, title, poster, positionMs, durationMs, season, episode) {
    var progress = load(K.PROGRESS) || {};
    var key = progressKey(id, type, season, episode);
    progress[key] = {
      id: String(id),
      type: type,
      title: title,
      poster: poster || '',
      position: positionMs,
      duration: durationMs || 0,
      season: season || null,
      episode: episode || null,
      updatedAt: Date.now()
    };
    save(K.PROGRESS, progress);
  }
  function getProgress(id, type, season, episode) {
    var progress = load(K.PROGRESS) || {};
    return progress[progressKey(id, type, season, episode)] || null;
  }
  function clearProgress(id, type, season, episode) {
    var progress = load(K.PROGRESS) || {};
    delete progress[progressKey(id, type, season, episode)];
    save(K.PROGRESS, progress);
  }
  function getContinueWatching(limit) {
    var progress = load(K.PROGRESS) || {};
    return Object.values(progress).filter(function (p) {
      return p.duration > 0 && p.position < p.duration * 0.95;
    }).sort(function (a, b) {
      return b.updatedAt - a.updatedAt;
    }).slice(0, limit || 20);
  }

  // ── Watch history ─────────────────────────────────────────────────────
  function addToHistory(id, type, title, poster, season, episode) {
    var history = load(K.HISTORY) || [];
    // Remove existing entry for this item
    history = history.filter(function (h) {
      return !(h.id === String(id) && h.type === type && h.season === (season || null) && h.episode === (episode || null));
    });
    history.unshift({
      id: String(id),
      type: type,
      title: title,
      poster: poster || '',
      season: season || null,
      episode: episode || null,
      watchedAt: Date.now()
    });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    save(K.HISTORY, history);
  }
  function getHistory(limit) {
    return (load(K.HISTORY) || []).slice(0, limit || 20);
  }
  function removeFromHistory(id, type) {
    var history = (load(K.HISTORY) || []).filter(function (h) {
      return !(h.id === String(id) && h.type === type);
    });
    save(K.HISTORY, history);
  }
  function clearHistory() {
    save(K.HISTORY, []);
  }

  // ── Playlists ─────────────────────────────────────────────────────────
  function genId() {
    return Date.now().toString(36);
  }
  function createPlaylist(name) {
    var playlists = load(K.PLAYLISTS) || [];
    var playlist = {
      id: genId(),
      name: name,
      items: [],
      createdAt: Date.now()
    };
    playlists.unshift(playlist);
    save(K.PLAYLISTS, playlists);
    return playlist;
  }
  function getPlaylists() {
    return load(K.PLAYLISTS) || [];
  }
  function addToPlaylist(playlistId, id, type, title, poster) {
    var playlists = load(K.PLAYLISTS) || [];
    var pl = playlists.find(function (p) {
      return p.id === playlistId;
    });
    if (!pl) return false;
    var exists = pl.items.some(function (i) {
      return i.id === String(id) && i.type === type;
    });
    if (!exists) pl.items.unshift({
      id: String(id),
      type: type,
      title: title,
      poster: poster || ''
    });
    save(K.PLAYLISTS, playlists);
    return true;
  }
  function removeFromPlaylist(playlistId, id, type) {
    var playlists = load(K.PLAYLISTS) || [];
    var pl = playlists.find(function (p) {
      return p.id === playlistId;
    });
    if (!pl) return false;
    pl.items = pl.items.filter(function (i) {
      return !(i.id === String(id) && i.type === type);
    });
    save(K.PLAYLISTS, playlists);
    return true;
  }
  function deletePlaylist(playlistId) {
    var playlists = (load(K.PLAYLISTS) || []).filter(function (p) {
      return p.id !== playlistId;
    });
    save(K.PLAYLISTS, playlists);
  }
  function isInPlaylist(playlistId, id, type) {
    var playlists = load(K.PLAYLISTS) || [];
    var pl = playlists.find(function (p) {
      return p.id === playlistId;
    });
    return pl ? pl.items.some(function (i) {
      return i.id === String(id) && i.type === type;
    }) : false;
  }

  // ── Favourites ────────────────────────────────────────────────────────
  function toggleFavourite(id, type, title, poster) {
    var favs = load(K.FAVOURITES) || [];
    var idx = -1;
    for (var i = 0; i < favs.length; i++) {
      if (favs[i].id === String(id) && favs[i].type === type) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      favs.splice(idx, 1);
      save(K.FAVOURITES, favs);
      return false;
    }
    favs.unshift({
      id: String(id),
      type: type,
      title: title,
      poster: poster || '',
      addedAt: Date.now()
    });
    save(K.FAVOURITES, favs);
    return true;
  }
  function isFavourite(id, type) {
    var favs = load(K.FAVOURITES) || [];
    for (var i = 0; i < favs.length; i++) {
      if (favs[i].id === String(id) && favs[i].type === type) return true;
    }
    return false;
  }
  function getFavourites(limit) {
    return (load(K.FAVOURITES) || []).slice(0, limit || 100);
  }

  // ── Watchlist ─────────────────────────────────────────────────────────
  function toggleWatchlist(id, type, title, poster) {
    var wl = load(K.WATCHLIST) || [];
    var idx = -1;
    for (var i = 0; i < wl.length; i++) {
      if (wl[i].id === String(id) && wl[i].type === type) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      wl.splice(idx, 1);
      save(K.WATCHLIST, wl);
      return false;
    }
    wl.unshift({
      id: String(id),
      type: type,
      title: title,
      poster: poster || '',
      addedAt: Date.now()
    });
    save(K.WATCHLIST, wl);
    return true;
  }
  function isInWatchlist(id, type) {
    var wl = load(K.WATCHLIST) || [];
    for (var i = 0; i < wl.length; i++) {
      if (wl[i].id === String(id) && wl[i].type === type) return true;
    }
    return false;
  }
  function getWatchlist(limit) {
    return (load(K.WATCHLIST) || []).slice(0, limit || 100);
  }
  return {
    saveProgress: saveProgress,
    getProgress: getProgress,
    clearProgress: clearProgress,
    getContinueWatching: getContinueWatching,
    addToHistory: addToHistory,
    getHistory: getHistory,
    removeFromHistory: removeFromHistory,
    clearHistory: clearHistory,
    createPlaylist: createPlaylist,
    getPlaylists: getPlaylists,
    addToPlaylist: addToPlaylist,
    removeFromPlaylist: removeFromPlaylist,
    deletePlaylist: deletePlaylist,
    isInPlaylist: isInPlaylist,
    toggleFavourite: toggleFavourite,
    isFavourite: isFavourite,
    getFavourites: getFavourites,
    toggleWatchlist: toggleWatchlist,
    isInWatchlist: isInWatchlist,
    getWatchlist: getWatchlist
  };
}();