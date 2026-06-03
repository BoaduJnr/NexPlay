'use strict';

/*
 * StreamResolver — Tizen 3.0 compatible (XHR + Promise chains, no async/await,
 * no TextEncoder, no Web Crypto API for primary path).
 *
 * Strategy:
 *   1. Videasy  — sequential XHR to 4 endpoints, decrypt via enc-dec.app (direct POST)
 *   2. Vidrock  — AES-CBC token via Web Crypto (modern browsers only), direct API call
 *   3. scrapeEmbed — regex .m3u8/.mp4 from embed page HTML (last resort)
 *
 * Proxy: nexplay-proxy.pielly16.workers.dev handles CORS + Referer injection
 *        + m3u8 segment URL rewriting for HLS playback.
 */
var StreamResolver = (function() {

  // ── XHR helpers ───────────────────────────────────────
  function xhrGet(url, timeoutMs, headers) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = timeoutMs || 8000;
      if (headers) {
        Object.keys(headers).forEach(function(k) {
          try { xhr.setRequestHeader(k, headers[k]); } catch(e) {}
        });
      }
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror   = function() { reject(new Error('XHR error')); };
      xhr.ontimeout = function() { reject(new Error('timeout')); };
      xhr.send();
    });
  }

  function xhrPost(url, body, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.timeout = timeoutMs || 10000;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror   = function() { reject(new Error('XHR error')); };
      xhr.ontimeout = function() { reject(new Error('timeout')); };
      xhr.send(body);
    });
  }

  // ── HTML stream extractor ──────────────────────────────
  function extractFromHtml(html) {
    if (!html) return null;
    var m3u8 = html.match(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/);
    if (m3u8) return m3u8[1];
    var mp4 = html.match(/(https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*)/);
    if (mp4) return mp4[1];
    var jsFile = html.match(/(?:file|src|source)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)/);
    if (jsFile) return jsFile[1];
    return null;
  }

  var PROXY_URL = 'https://nexplay-proxy.pielly16.workers.dev';

  // enc-dec.app supports CORS for POST from any origin — call directly, no proxy needed.
  var DEC_URL = 'https://enc-dec.app/api/dec-videasy';

  // ── Videasy ────────────────────────────────────────────
  var VIDEASY_ENDPOINTS = [
    'https://api.videasy.net/mb-flix/sources-with-title',
    'https://api.videasy.net/cdn/sources-with-title',
    'https://api.videasy.net/superflix/sources-with-title',
    'https://api.videasy.net/lamovie/sources-with-title',
  ];
  var VIDEASY_ORIGIN = 'https://player.videasy.net';
  var BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  function resolveVideasy(tmdbId, type, title, year, season, episode) {
    var qs = 'title='      + encodeURIComponent(title || '') +
             '&mediaType=' + (type === 'tv' ? 'show' : 'movie') +
             '&tmdbId='    + tmdbId +
             '&imdbId=' +
             '&language=english';
    if (type === 'movie') qs += '&year=0';
    if (type === 'tv')    qs += '&episodeId=' + episode + '&seasonId=' + season;

    function tryEndpoint(idx) {
      if (idx >= VIDEASY_ENDPOINTS.length) return Promise.resolve(null);

      // Proxy handles Referer/Origin injection (CF Worker hardcodes Videasy headers)
      var apiUrl = VIDEASY_ENDPOINTS[idx] + '?' + qs;
      var proxyApiUrl = PROXY_URL + '/?url=' + encodeURIComponent(apiUrl);
      return xhrGet(proxyApiUrl, 12000)
        .then(function(hexBlob) {
          if (!hexBlob || hexBlob.length < 20) return tryEndpoint(idx + 1);

          // POST directly to enc-dec.app — CORS is open for JSON POST from browsers
          return xhrPost(DEC_URL, JSON.stringify({ text: hexBlob, id: String(tmdbId) }), 10000)
            .then(function(decText) {
              var dec;
              try { dec = JSON.parse(decText); } catch(e) { return tryEndpoint(idx + 1); }

              if (!dec.result || !dec.result.sources || !dec.result.sources.length) {
                return tryEndpoint(idx + 1);
              }

              var sources = dec.result.sources.filter(function(s) {
                return s.url && s.url.indexOf('.m3u8') !== -1;
              });
              if (!sources.length) sources = dec.result.sources;
              var best = sources.find(function(s) { return s.quality === '1080p'; })
                      || sources.find(function(s) { return s.quality === '720p'; })
                      || sources[0];
              if (!best || !best.url) return tryEndpoint(idx + 1);

              console.log('[StreamResolver] Videasy OK ' + (best.quality || '') + ':', best.url.slice(0, 60));
              var cdnHdrs = { 'Referer': VIDEASY_ORIGIN + '/', 'Origin': VIDEASY_ORIGIN };
              var allQ = sources.filter(function(s) { return s.url && s.url.indexOf('.m3u8') !== -1; })
                                .map(function(s) { return { label: (s.quality || 'Auto'), url: s.url }; });
              return { url: best.url, headers: cdnHdrs, qualities: allQ };
            })
            .catch(function() { return tryEndpoint(idx + 1); });
        })
        .catch(function() { return tryEndpoint(idx + 1); });
    }

    return tryEndpoint(0);
  }

  // ── Vidrock (AES-CBC via Web Crypto — modern browsers only) ───────────────
  function encryptVidrock(itemId) {
    if (typeof crypto === 'undefined' || !crypto.subtle) return Promise.resolve(null);

    var passphrase = 'x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9';

    function strToBytes(str) {
      var bytes = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
      return bytes;
    }

    var keyData = strToBytes(passphrase);        // 32 bytes → AES-256
    var iv      = strToBytes(passphrase.slice(0, 16));
    var data    = strToBytes(itemId);

    return crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['encrypt'])
      .then(function(key) {
        return crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, key, data);
      })
      .then(function(encrypted) {
        var bytes = new Uint8Array(encrypted);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      });
  }

  function resolveVidrock(tmdbId, type, season, episode) {
    if (typeof crypto === 'undefined' || !crypto.subtle) return Promise.resolve(null);

    var itemId = type === 'tv'
      ? (tmdbId + '_' + (season || 1) + '_' + (episode || 1))
      : String(tmdbId);
    var apiType = type === 'tv' ? 'tv' : 'movie';
    var VIDROCK_ORIGIN = 'https://vidrock.net';

    return encryptVidrock(itemId).then(function(token) {
      if (!token) return null;

      // Vidrock API has CORS: * — call directly (no proxy needed for resolution)
      var apiUrl = VIDROCK_ORIGIN + '/api/' + apiType + '/' + token;
      return xhrGet(apiUrl, 10000, {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
      }).then(function(text) {
        var data;
        try { data = JSON.parse(text); } catch(e) { return null; }

        var PROXY_PREFIX = 'https://proxy.vidrock.store/';
        var hlsUrls = [];

        Object.keys(data).forEach(function(key) {
          var entry = data[key];
          if (!entry || !entry.url) return;
          var url = entry.url;

          // Unwrap proxy.vidrock.store prefix
          if (url.indexOf(PROXY_PREFIX) === 0) {
            url = decodeURIComponent(url.slice(PROXY_PREFIX.length).replace(/\+/g, '%2B'));
          }

          // Skip hls2.vdrk.site indirection (would need another async hop)
          if (url.indexOf('hls2.vdrk.site') !== -1) return;

          if (url.indexOf('.m3u8') !== -1) {
            hlsUrls.push({ label: entry.label || key || 'Auto', url: url });
          }
        });

        if (!hlsUrls.length) return null;

        var best = hlsUrls.find(function(s) { return s.label === '1080p'; })
                || hlsUrls.find(function(s) { return s.label === '720p'; })
                || hlsUrls[0];

        console.log('[StreamResolver] Vidrock OK:', best.url.slice(0, 60));
        // CDN requires Referer: https://vidrock.net/ — pass via headers for proxy
        return {
          url: best.url,
          headers: { 'Referer': VIDROCK_ORIGIN + '/', 'Origin': VIDROCK_ORIGIN },
          qualities: hlsUrls
        };
      });
    }).catch(function(e) {
      console.log('[StreamResolver] Vidrock error:', e.message);
      return null;
    });
  }

  // ── Scrape embed (last resort) ─────────────────────────
  function scrapeEmbed(embedUrl) {
    var proxyEmbedUrl = PROXY_URL + '/?url=' + encodeURIComponent(embedUrl);
    return xhrGet(proxyEmbedUrl, 10000)
      .then(function(html) {
        var stream = extractFromHtml(html);
        if (stream) console.log('[StreamResolver] Scraped:', stream.slice(0, 60));
        return stream ? { url: stream, headers: null } : null;
      })
      .catch(function() { return null; });
  }

  function tryScrapeUrls(urls, idx) {
    idx = idx || 0;
    if (idx >= urls.length) return Promise.resolve(null);
    return scrapeEmbed(urls[idx]).then(function(result) {
      if (result) return result;
      return tryScrapeUrls(urls, idx + 1);
    });
  }

  // ── Public API ─────────────────────────────────────────
  function resolveMovie(tmdbId, title, year) {
    console.log('[StreamResolver] resolveMovie', tmdbId, title);
    return resolveVideasy(tmdbId, 'movie', title, year, null, null)
      .then(function(result) {
        if (result) return result;
        console.log('[StreamResolver] Videasy failed, trying Vidrock...');
        return resolveVidrock(tmdbId, 'movie', null, null);
      })
      .then(function(result) {
        if (result) return result;
        console.log('[StreamResolver] Vidrock failed, scraping embeds...');
        return tryScrapeUrls([
          'https://vidsrc.xyz/embed/movie?tmdb=' + tmdbId,
          'https://vidsrc.me/embed/movie?tmdb='  + tmdbId,
          'https://multiembed.mov/?video_id='    + tmdbId + '&tmdb=1',
        ]);
      })
      .catch(function(e) {
        console.log('[StreamResolver] resolveMovie error:', e.message);
        return null;
      });
  }

  function resolveTVEpisode(tmdbId, title, season, episode) {
    console.log('[StreamResolver] resolveTVEpisode', tmdbId, 'S' + season + 'E' + episode);
    return resolveVideasy(tmdbId, 'tv', title, null, season, episode)
      .then(function(result) {
        if (result) return result;
        console.log('[StreamResolver] Videasy failed, trying Vidrock...');
        return resolveVidrock(tmdbId, 'tv', season, episode);
      })
      .then(function(result) {
        if (result) return result;
        console.log('[StreamResolver] Vidrock failed, scraping embeds...');
        return tryScrapeUrls([
          'https://vidsrc.xyz/embed/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode,
          'https://vidsrc.me/embed/tv?tmdb='  + tmdbId + '&season=' + season + '&episode=' + episode,
        ]);
      })
      .catch(function(e) {
        console.log('[StreamResolver] resolveTVEpisode error:', e.message);
        return null;
      });
  }

  return { resolveMovie: resolveMovie, resolveTVEpisode: resolveTVEpisode, scrapeEmbed: scrapeEmbed };

})();
