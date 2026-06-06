'use strict';

/*
 * EPGClient — Electronic Programme Guide for IPTV channels.
 *
 * Data source : iptv-org/api (https://iptv-org.github.io/api/guides.json)
 *   guides.json maps channel tvg-id → { sources: [{ url }] }
 *   Sources are community-hosted workers that serve guide.json in JSON format.
 *
 * Guide JSON format (from worker):
 *   { date, channels, programs: [{ channel, start(ms), stop(ms), titles:[{value}], descriptions:[{value}] }] }
 *
 * Coverage note: only channels listed in guides.json with non-empty sources[]
 * have programme data.  As of 2026, major covered channels include:
 *   AlJazeera.qa (Al Jazeera English), ANT1Europe.gr (ANT1 Europe)
 *
 * All fetches go through the CF Worker proxy for CORS.
 * Tizen 3.0 compatible: no async/await, no arrow functions, no destructuring.
 */
var EPGClient = function () {
  var PROXY_URL = 'https://nexplay-proxy.pielly16.workers.dev';
  var GUIDES_URL = 'https://iptv-org.github.io/api/guides.json';
  var GUIDES_TTL = 24 * 60 * 60 * 1000; // 24 h
  var PROG_TTL = 2 * 60 * 60 * 1000; //  2 h

  var _guidesPromise = null;
  var _channelMap = null; // { tvgId: [workerUrl, ...] }
  var _programmes = {}; // { tvgId: Programme[] | undefined }
  var _pending = {}; // in-flight fetch promises
  // Cache of already-fetched worker guide JSON: { workerUrl: Programme[] }
  var _workerCache = {};

  // ── localStorage helpers ──────────────────────────────────
  function cacheRead(key, ttl) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > ttl) return null;
      return obj.data;
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

  // ── Parse guide.json from a community worker ──────────────
  // Returns all programs from that worker across all channels
  function parseWorkerJSON(json, targetId) {
    var programs = json.programs || [];
    var idLower = (targetId || '').toLowerCase();

    // channel field may be "AlJazeera.qa@English" — strip @feed for matching
    function stripFeed(ch) {
      return (ch || '').split('@')[0].toLowerCase();
    }
    var result = [];
    var now = Date.now();
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = today.getTime();
    today.setHours(23, 59, 59, 999);
    var end = today.getTime();
    programs.forEach(function (p) {
      var ch = stripFeed(p.channel);
      if (ch !== idLower) return;
      var s = p.start || 0;
      var e2 = p.stop || 0;
      if (e2 < start || s > end) return; // not today

      var title = '';
      var desc = '';
      if (p.titles && p.titles.length) title = (p.titles[0].value || '').trim();
      if (p.descriptions && p.descriptions.length) desc = (p.descriptions[0].value || '').trim();
      result.push({
        start: s,
        stop: e2,
        title: title,
        desc: desc
      });
    });
    result.sort(function (a, b) {
      return a.start - b.start;
    });
    return result;
  }

  // ── Load guides index ─────────────────────────────────────
  function loadGuides() {
    if (_channelMap) return Promise.resolve(_channelMap);
    if (_guidesPromise) return _guidesPromise;
    var cached = cacheRead('np_epg_guides_v3', GUIDES_TTL);
    if (cached) {
      _channelMap = cached;
      return Promise.resolve(_channelMap);
    }
    _guidesPromise = fetch(GUIDES_URL).then(function (r) {
      if (!r.ok) throw new Error('guides ' + r.status);
      return r.json();
    }).then(function (guides) {
      _channelMap = {};
      if (!Array.isArray(guides)) return _channelMap;
      guides.forEach(function (g) {
        // channel field is the tvg-id (may be null)
        var id = (g.channel || '').toLowerCase();
        var sources = g.sources || [];
        if (!id || !sources.length) return;
        // Prefer JSON format for efficiency
        var jsonSrc = sources.find(function (s) {
          return s.format === 'JSON';
        });
        var url = jsonSrc ? jsonSrc.url : sources[0] ? sources[0].url : '';
        if (!url) return;
        if (!_channelMap[id]) _channelMap[id] = [];
        _channelMap[id].push(url);
      });
      cacheWrite('np_epg_guides_v3', _channelMap);
      return _channelMap;
    }).catch(function (e) {
      console.warn('[EPG] guides load failed:', e.message);
      _channelMap = {};
      _guidesPromise = null;
      return _channelMap;
    });
    return _guidesPromise;
  }

  // ── Fetch worker guide JSON (shared across channels on same worker) ──
  function fetchWorkerGuide(workerUrl, tvgId) {
    if (_workerCache[workerUrl]) {
      return Promise.resolve(parseWorkerJSON(_workerCache[workerUrl], tvgId));
    }
    var proxyUrl = PROXY_URL + '/?url=' + encodeURIComponent(workerUrl);
    return fetch(proxyUrl).then(function (r) {
      return r.json();
    }).then(function (json) {
      _workerCache[workerUrl] = json;
      return parseWorkerJSON(json, tvgId);
    });
  }

  // ── Fetch programmes for one channel ─────────────────────
  function fetchProgrammes(tvgId) {
    if (!tvgId) return Promise.resolve([]);
    var idKey = tvgId.toLowerCase();
    if (_programmes[idKey] !== undefined) return Promise.resolve(_programmes[idKey]);
    if (_pending[idKey]) return _pending[idKey];
    var cKey = 'np_epg_p_' + idKey.replace(/[^a-z0-9]/gi, '_').slice(0, 32);
    var cached = cacheRead(cKey, PROG_TTL);
    if (cached) {
      _programmes[idKey] = cached;
      return Promise.resolve(cached);
    }
    _pending[idKey] = loadGuides().then(function (map) {
      var urls = map[idKey] || [];
      if (!urls.length) return [];
      return fetchWorkerGuide(urls[0], idKey);
    }).then(function (progs) {
      _programmes[idKey] = progs;
      if (progs.length) cacheWrite(cKey, progs);
      delete _pending[idKey];
      return progs;
    }).catch(function () {
      _programmes[idKey] = [];
      delete _pending[idKey];
      return [];
    });
    return _pending[idKey];
  }

  // ── Public query helpers ──────────────────────────────────
  function getCurrent(tvgId) {
    var progs = _programmes[(tvgId || '').toLowerCase()];
    if (!progs) return null;
    var now = Date.now();
    for (var i = 0; i < progs.length; i++) {
      if (progs[i].start <= now && progs[i].stop > now) return progs[i];
    }
    return null;
  }
  function getNext(tvgId) {
    var progs = _programmes[(tvgId || '').toLowerCase()];
    if (!progs) return null;
    var now = Date.now();
    for (var i = 0; i < progs.length; i++) {
      if (progs[i].start > now) return progs[i];
    }
    return null;
  }
  function getToday(tvgId) {
    var v = _programmes[(tvgId || '').toLowerCase()];
    return v !== undefined ? v : null;
  }
  function currentProgress(tvgId) {
    var prog = getCurrent(tvgId);
    if (!prog || prog.stop <= prog.start) return 0;
    return Math.min(100, Math.max(0, (Date.now() - prog.start) / (prog.stop - prog.start) * 100));
  }
  function prefetch(tvgIds) {
    if (!tvgIds || !tvgIds.length) return;
    loadGuides().then(function () {
      tvgIds.slice(0, 25).forEach(function (id) {
        var k = (id || '').toLowerCase();
        if (k && _programmes[k] === undefined && !_pending[k]) {
          fetchProgrammes(id).catch(function () {});
        }
      });
    }).catch(function () {});
  }
  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = d.getHours(),
      m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  return {
    fetchProgrammes: fetchProgrammes,
    prefetch: prefetch,
    getCurrent: getCurrent,
    getNext: getNext,
    getToday: getToday,
    currentProgress: currentProgress,
    formatTime: formatTime
  };
}();