'use strict';

/*
 * SubtitleClient — fetches subtitles from sub.wyzie.io (OpenSubtitles backend)
 *
 * Free API key: https://store.wyzie.io/redeem  →  Config.SUBTITLE_KEY
 * API response field: { id, url, flagUrl, format, display, language, ... }
 *
 * Tizen 3.0 compatible: no async/await, no arrow functions, no for-of.
 */
var SubtitleClient = function () {
  var BASE_URL = 'https://sub.wyzie.io';
  var CACHE_TTL = 60 * 60 * 1000; // 1 h

  function cacheRead(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return Date.now() - obj.ts > CACHE_TTL ? null : obj.data;
    } catch (e) {
      return null;
    }
  }
  function cacheWrite(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({
        ts: Date.now(),
        data: data
      }));
    } catch (e) {}
  }

  // ── IMDb ID lookup (movies require imdb_id) ──────────────
  function getImdbId(tmdbId) {
    var ck = 'np_imdb_' + tmdbId;
    var cached = cacheRead(ck);
    if (cached) return Promise.resolve(cached);
    if (typeof Config === 'undefined') return Promise.resolve(null);
    return fetch(Config.TMDB_BASE + '/movie/' + tmdbId + '/external_ids?api_key=' + Config.TMDB_KEY).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (d) {
      var id = d && d.imdb_id ? d.imdb_id : null;
      if (id) cacheWrite(ck, id);
      return id;
    }).catch(function () {
      return null;
    });
  }

  // ── Fetch all subtitles (all languages) ──────────────────
  // Cached per title — used to populate the language picker.
  function fetchAll(tmdbId, type, season, episode) {
    var key = typeof Config !== 'undefined' && Config.SUBTITLE_KEY ? Config.SUBTITLE_KEY : null;
    if (!key) return Promise.resolve([]);
    var ck = 'np_subs_all_' + tmdbId + '_' + type + '_' + (season || 0) + '_' + (episode || 0);
    var cached = cacheRead(ck);
    if (cached) return Promise.resolve(cached);
    var idPromise = type !== 'tv' ? getImdbId(tmdbId) : Promise.resolve(String(tmdbId));
    return idPromise.then(function (searchId) {
      if (!searchId) return [];
      var url = BASE_URL + '/search?id=' + encodeURIComponent(searchId) + '&type=' + (type === 'tv' ? 'show' : 'movie') + '&key=' + encodeURIComponent(key);
      if (type === 'tv' && season) url += '&season=' + season + '&episode=' + (episode || 1);
      return fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      }).then(function (r) {
        return r.ok ? r.json() : [];
      }).then(function (arr) {
        if (!Array.isArray(arr)) return [];
        var filtered = arr.filter(function (s) {
          return s && s.url && s.language;
        });
        if (filtered.length) cacheWrite(ck, filtered);
        return filtered;
      });
    }).catch(function () {
      return [];
    });
  }

  // ── Get unique languages available for a title ───────────
  // Returns: [{ language:'en', display:'English', flagUrl:'...', count:42 }, ...]
  // Sorted by download count (most popular first, English always first if present).
  function getLanguages(tmdbId, type, season, episode) {
    return fetchAll(tmdbId, type, season, episode).then(function (all) {
      var map = {};
      all.forEach(function (s) {
        var lc = s.language;
        if (!map[lc]) map[lc] = {
          language: lc,
          display: s.display || lc,
          flagUrl: s.flagUrl || '',
          count: 0
        };
        map[lc].count += s.downloadCount || 1;
      });
      var langs = Object.keys(map).map(function (k) {
        return map[k];
      });
      langs.sort(function (a, b) {
        // English first, then by popularity
        if (a.language === 'en') return -1;
        if (b.language === 'en') return 1;
        return b.count - a.count;
      });
      return langs;
    });
  }

  // ── Load best subtitle for a specific language ───────────
  // Returns Promise<{ blobUrl, language, display, flagUrl } | null>
  function loadLanguage(tmdbId, type, language, season, episode) {
    return fetchAll(tmdbId, type, season, episode).then(function (all) {
      // Pick entries for the requested language
      var forLang = all.filter(function (s) {
        return s.language === language;
      });
      if (!forLang.length) return null;

      // Prefer non-hearing-impaired, then highest download count
      var sorted = forLang.slice().sort(function (a, b) {
        if (!a.isHearingImpaired && b.isHearingImpaired) return -1;
        if (a.isHearingImpaired && !b.isHearingImpaired) return 1;
        return (b.downloadCount || 0) - (a.downloadCount || 0);
      });
      var best = sorted[0];
      return fetch(best.url).then(function (r) {
        return r.ok ? r.text() : null;
      }).then(function (text) {
        if (!text) return null;
        // SRT → VTT conversion
        var vtt = text.trim().startsWith('WEBVTT') ? text : 'WEBVTT\n\n' + text.replace(/\r\n/g, '\n').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        var blob = new Blob([vtt], {
          type: 'text/vtt'
        });
        return {
          blobUrl: URL.createObjectURL(blob),
          language: best.language,
          display: best.display || best.language,
          flagUrl: best.flagUrl || ''
        };
      }).catch(function () {
        return null;
      });
    });
  }

  // ── Apply a loaded subtitle to a <video> element ─────────
  // sub = { blobUrl, language, display } from loadLanguage()
  // Replaces any existing subtitle track.
  function applySubtitle(videoEl, sub) {
    if (!videoEl || !sub) return;
    // Remove previous nexplay track
    var old = videoEl.querySelector('track[data-nexplay-sub]');
    if (old) {
      try {
        URL.revokeObjectURL(old.src);
      } catch (e) {}
      old.parentNode.removeChild(old);
    }
    var track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = sub.blobUrl;
    track.srclang = sub.language;
    track.label = sub.display;
    track.setAttribute('data-nexplay-sub', '1');
    videoEl.appendChild(track);

    // Activate the track (mode = showing)
    for (var i = 0; i < videoEl.textTracks.length; i++) {
      if (videoEl.textTracks[i].kind === 'subtitles') {
        videoEl.textTracks[i].mode = 'showing';
        break;
      }
    }
  }

  // ── Remove subtitle track from a <video> element ─────────
  function removeSubtitle(videoEl) {
    if (!videoEl) return;
    for (var i = 0; i < videoEl.textTracks.length; i++) {
      if (videoEl.textTracks[i].kind === 'subtitles') videoEl.textTracks[i].mode = 'hidden';
    }
    var old = videoEl.querySelector('track[data-nexplay-sub]');
    if (old) {
      try {
        URL.revokeObjectURL(old.src);
      } catch (e) {}
      old.parentNode.removeChild(old);
    }
  }

  // ── Legacy: applyToVideo (used on initial stream start) ──
  // Silently loads English subtitles and hides them — CC button reveals the picker.
  function applyToVideo(videoEl, tmdbId, type, lang, season, episode) {
    if (!videoEl) return Promise.resolve(false);
    return getLanguages(tmdbId, type, season, episode).then(function (langs) {
      return langs.length > 0;
    }).catch(function () {
      return false;
    });
  }
  return {
    getLanguages: getLanguages,
    loadLanguage: loadLanguage,
    applySubtitle: applySubtitle,
    removeSubtitle: removeSubtitle,
    applyToVideo: applyToVideo // kept for CC button show/hide signal
  };
}();