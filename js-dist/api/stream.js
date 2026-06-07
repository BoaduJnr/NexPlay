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
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var StreamResolver = function () {
  // ── XHR helpers ───────────────────────────────────────
  function xhrGet(url, timeoutMs, headers) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = timeoutMs || 8000;
      if (headers) {
        Object.keys(headers).forEach(function (k) {
          try {
            xhr.setRequestHeader(k, headers[k]);
          } catch (e) {}
        });
      }
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function () {
        reject(new Error('XHR error'));
      };
      xhr.ontimeout = function () {
        reject(new Error('timeout'));
      };
      xhr.send();
    });
  }
  function xhrPost(url, body, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.timeout = timeoutMs || 10000;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function () {
        reject(new Error('XHR error'));
      };
      xhr.ontimeout = function () {
        reject(new Error('timeout'));
      };
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
  var DEC_URL = 'https://enc-dec.app/api/dec-videasy'; // CORS open — call directly

  // Pick 1080p → 720p → first available, works for both Videasy (quality) and Vidrock (label).
  function pickBestQuality(sources) {
    function match(s, q) {
      return s.quality === q || s.label === q;
    }
    return sources.find(function (s) {
      return match(s, '1080p');
    }) || sources.find(function (s) {
      return match(s, '720p');
    }) || sources[0];
  }

  // ── Videasy ────────────────────────────────────────────
  // Live endpoints only (verified 2026-06-05 — mb-flix, cdn, hdmovie, lamovie respond;
  // moviebox/1movies=404, m4uhd/meine/superflix=500 → removed to cut resolve time).
  var VIDEASY_ENDPOINTS = ['https://api.videasy.to/mb-flix/sources-with-title', 'https://api.videasy.to/cdn/sources-with-title', 'https://api.videasy.to/hdmovie/sources-with-title', 'https://api.videasy.to/lamovie/sources-with-title'];
  var VIDEASY_ORIGIN = 'https://player.videasy.to';
  var BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  function resolveVideasy(tmdbId, type, title, year, season, episode) {
    // Title must be double-encoded per Videasy API requirement
    var qs = 'title=' + encodeURIComponent(encodeURIComponent(title || '')) + '&mediaType=' + (type === 'tv' ? 'tv' : 'movie') + '&tmdbId=' + tmdbId + '&imdbId=' + '&year=' + (year || 0) + '&language=english';
    if (type === 'tv') qs += '&episodeId=' + episode + '&seasonId=' + season;
    function tryEndpoint(idx) {
      if (idx >= VIDEASY_ENDPOINTS.length) return Promise.resolve(null);
      var apiUrl = VIDEASY_ENDPOINTS[idx] + '?' + qs;
      // Videasy has Access-Control-Allow-Origin: * and accepts any origin.
      // CF/Deno proxies cannot reach api.videasy.net (datacenter IP block) — call directly.
      return xhrGet(apiUrl, 10000, {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': VIDEASY_ORIGIN + '/'
      }).then(function (hexBlob) {
        if (!hexBlob || hexBlob.length < 20) return tryEndpoint(idx + 1);

        // POST directly to enc-dec.app — CORS is open for JSON POST from browsers
        return xhrPost(DEC_URL, JSON.stringify({
          text: hexBlob,
          id: String(tmdbId)
        }), 10000).then(function (decText) {
          var dec;
          try {
            dec = JSON.parse(decText);
          } catch (e) {
            return tryEndpoint(idx + 1);
          }
          if (!dec.result || !dec.result.sources || !dec.result.sources.length) {
            return tryEndpoint(idx + 1);
          }
          var sources = dec.result.sources.filter(function (s) {
            return s.url && s.url.indexOf('.m3u8') !== -1;
          });
          if (!sources.length) sources = dec.result.sources;
          var best = pickBestQuality(sources);
          if (!best || !best.url) return tryEndpoint(idx + 1);
          console.log('[StreamResolver] Videasy OK ' + (best.quality || '') + ':', best.url.slice(0, 60));
          var cdnHdrs = {
            'Referer': VIDEASY_ORIGIN + '/',
            'Origin': VIDEASY_ORIGIN
          };
          var allQ = sources.filter(function (s) {
            return s.url && s.url.indexOf('.m3u8') !== -1;
          }).map(function (s) {
            return {
              label: s.quality || 'Auto',
              url: s.url
            };
          });
          return {
            url: best.url,
            headers: cdnHdrs,
            qualities: allQ
          };
        }).catch(function () {
          return tryEndpoint(idx + 1);
        });
      }).catch(function () {
        return tryEndpoint(idx + 1);
      });
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
    var keyData = strToBytes(passphrase); // 32 bytes → AES-256
    var iv = strToBytes(passphrase.slice(0, 16));
    var data = strToBytes(itemId);
    return crypto.subtle.importKey('raw', keyData, {
      name: 'AES-CBC'
    }, false, ['encrypt']).then(function (key) {
      return crypto.subtle.encrypt({
        name: 'AES-CBC',
        iv: iv
      }, key, data);
    }).then(function (encrypted) {
      var bytes = new Uint8Array(encrypted);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    });
  }

  // Follow hls2.vdrk.site indirection — each URL returns [{resolution, url}] JSON
  function followVdrk(vdrkUrls, idx, collected) {
    if (idx >= vdrkUrls.length) return Promise.resolve(collected);
    var proxyUrl = PROXY_URL + '/?url=' + encodeURIComponent(vdrkUrls[idx]);
    return xhrGet(proxyUrl, 8000).then(function (text) {
      try {
        var arr = JSON.parse(text);
        if (Array.isArray(arr)) {
          arr.forEach(function (item) {
            if (item && item.url && item.url.indexOf('.m3u8') !== -1) {
              collected.push({
                label: item.resolution ? item.resolution + 'p' : 'Auto',
                url: item.url
              });
            }
          });
        }
      } catch (e) {}
      return followVdrk(vdrkUrls, idx + 1, collected);
    }).catch(function () {
      return followVdrk(vdrkUrls, idx + 1, collected);
    });
  }
  function resolveVidrock(tmdbId, type, season, episode) {
    // crypto.subtle needed for token encryption — skip on environments that lack it
    if (typeof crypto === 'undefined' || !crypto.subtle) return Promise.resolve(null);
    var itemId = type === 'tv' ? tmdbId + '_' + (season || 1) + '_' + (episode || 1) : String(tmdbId);
    var apiType = type === 'tv' ? 'tv' : 'movie';
    // vidrock.net 301-redirects to vidrock.ru — use .ru directly to avoid redirect issues on Tizen
    var VIDROCK_ORIGIN = 'https://vidrock.ru';
    return encryptVidrock(itemId).then(function (token) {
      if (!token) return null;
      var apiUrl = VIDROCK_ORIGIN + '/api/' + apiType + '/' + token;
      var vdrHeaders = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': VIDROCK_ORIGIN + '/',
        'Origin': VIDROCK_ORIGIN
      };
      function parseVidrock(text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          return null;
        }
        if (!data || _typeof(data) !== 'object') return null;
        var PROXY_PREFIX = 'https://proxy.vidrock.store/';
        var hlsUrls = [];
        var vdrkIndirect = [];
        Object.keys(data).forEach(function (key) {
          var entry = data[key];
          if (!entry || !entry.url) return;
          var url = entry.url;
          if (url.indexOf(PROXY_PREFIX) === 0) {
            url = decodeURIComponent(url.slice(PROXY_PREFIX.length).replace(/\+/g, '%2B'));
          }
          if (url.indexOf('hls2.vdrk.site') !== -1) {
            vdrkIndirect.push(url);
            return;
          }
          if (url.indexOf('.m3u8') !== -1) {
            hlsUrls.push({
              label: entry.label || key || 'Auto',
              url: url
            });
          }
        });
        return followVdrk(vdrkIndirect, 0, []).then(function (indirect) {
          var allHls = hlsUrls.concat(indirect);
          if (!allHls.length) return null;
          var best = pickBestQuality(allHls);
          console.log('[StreamResolver] Vidrock OK:', best.url.slice(0, 60));
          return {
            url: best.url,
            headers: {
              'Referer': VIDROCK_ORIGIN + '/',
              'Origin': VIDROCK_ORIGIN
            },
            qualities: allHls
          };
        });
      }

      // TV (Tizen): direct XHR — no CORS restriction, residential IP passes Vidrock check.
      // Browser: direct first, CF Worker proxy as CORS fallback.
      return xhrGet(apiUrl, 12000, vdrHeaders).then(parseVidrock).catch(function () {
        var hdrsB64 = btoa(JSON.stringify({
          'Referer': VIDROCK_ORIGIN + '/',
          'Origin': VIDROCK_ORIGIN
        }));
        var proxyUrl = PROXY_URL + '/?url=' + encodeURIComponent(apiUrl) + '&headers=' + encodeURIComponent(hdrsB64);
        return xhrGet(proxyUrl, 12000).then(parseVidrock).catch(function () {
          return null;
        });
      });
    }).catch(function (e) {
      console.log('[StreamResolver] Vidrock error:', e.message);
      return null;
    });
  }

  // ── SuperEmbed / seapi.link ───────────────────────────
  // JSON API: GET https://seapi.link/?type=tmdb&id={ID}&max_results=3
  // Returns array of {url, quality?, ...} objects with direct HLS stream URLs.
  // Always routed through CF Worker (CORS bypass + Tizen TLS compat).
  // DNS currently intermittent — fails gracefully when domain is unreachable.
  var SEAPI_URL = 'https://seapi.link';
  function resolveSeapi(tmdbId, type, season, episode) {
    var qs = '?type=tmdb&id=' + tmdbId + '&max_results=3';
    if (type === 'tv') qs += '&season=' + (season || 1) + '&episode=' + (episode || 1);
    var apiUrl = SEAPI_URL + '/' + qs;
    var proxyUrl = PROXY_URL + '/?url=' + encodeURIComponent(apiUrl);
    return xhrGet(proxyUrl, 10000).then(function (text) {
      var arr;
      try {
        arr = JSON.parse(text);
      } catch (e) {
        return null;
      }
      // Handle both array and {results:[]} envelope formats
      if (arr && arr.results) arr = arr.results;
      if (!Array.isArray(arr) || !arr.length) return null;
      var hlsSources = arr.filter(function (s) {
        return s && s.url;
      });
      if (!hlsSources.length) return null;

      // Pick highest quality — prefer 1080p then 720p then first
      function match(s, q) {
        return (s.quality || '') === q || (s.label || '') === q;
      }
      var best = hlsSources.find(function (s) {
        return match(s, '1080p');
      }) || hlsSources.find(function (s) {
        return match(s, '720p');
      }) || hlsSources[0];
      var qualities = hlsSources.map(function (s) {
        return {
          label: s.quality || s.label || 'Auto',
          url: s.url
        };
      });
      console.log('[StreamResolver] Seapi OK ' + (best.quality || '') + ':', best.url.slice(0, 60));
      return {
        url: best.url,
        headers: {},
        qualities: qualities
      };
    }).catch(function () {
      return null;
    });
  }

  // ── Scrape embed (last resort) ─────────────────────────
  function scrapeEmbed(embedUrl) {
    var proxyEmbedUrl = PROXY_URL + '/?url=' + encodeURIComponent(embedUrl);
    return xhrGet(proxyEmbedUrl, 10000).then(function (html) {
      var stream = extractFromHtml(html);
      if (stream) console.log('[StreamResolver] Scraped:', stream.slice(0, 60));
      return stream ? {
        url: stream,
        headers: null
      } : null;
    }).catch(function () {
      return null;
    });
  }
  function tryScrapeUrls(urls, idx) {
    idx = idx || 0;
    if (idx >= urls.length) return Promise.resolve(null);
    return scrapeEmbed(urls[idx]).then(function (result) {
      if (result) return result;
      return tryScrapeUrls(urls, idx + 1);
    });
  }

  // ── Public API ─────────────────────────────────────────
  // Embed scraping is useless on TV (AVPlay can't play iframe embeds) — skip it
  var _isTV = typeof webapis !== 'undefined' && !!webapis.avplay;
  function resolveMovie(tmdbId, title, year) {
    console.log('[StreamResolver] resolveMovie', tmdbId, title, _isTV ? '(TV)' : '(web)');
    // TV: Vidrock first — direct XHR works from residential IP, CDN proxiable.
    //     Videasy CDN blocks CF Worker datacenter IPs so it always fails on TV.
    // Web: Videasy first — CDN accessible from browser; Vidrock as fallback.
    var step1 = _isTV ? resolveVidrock(tmdbId, 'movie', null, null) : resolveVideasy(tmdbId, 'movie', title, year, null, null);
    var step2 = _isTV ? function () {
      return resolveVideasy(tmdbId, 'movie', title, year, null, null);
    } : function () {
      return resolveVidrock(tmdbId, 'movie', null, null);
    };
    return step1.then(function (result) {
      if (result) return result;
      console.log('[StreamResolver] step1 failed, trying step2...');
      return step2();
    }).then(function (result) {
      if (result || _isTV) return result;
      console.log('[StreamResolver] step2 failed, scraping embeds...');
      return tryScrapeUrls(['https://vidsrc.me/embed/movie?tmdb=' + tmdbId, 'https://multiembed.mov/?video_id=' + tmdbId + '&tmdb=1']);
    }).catch(function (e) {
      console.log('[StreamResolver] resolveMovie error:', e.message);
      return null;
    });
  }
  function resolveTVEpisode(tmdbId, title, season, episode) {
    console.log('[StreamResolver] resolveTVEpisode', tmdbId, 'S' + season + 'E' + episode, _isTV ? '(TV)' : '(web)');
    var step1 = _isTV ? resolveVidrock(tmdbId, 'tv', season, episode) : resolveVideasy(tmdbId, 'tv', title, null, season, episode);
    var step2 = _isTV ? function () {
      return resolveVideasy(tmdbId, 'tv', title, null, season, episode);
    } : function () {
      return resolveVidrock(tmdbId, 'tv', season, episode);
    };
    return step1.then(function (result) {
      if (result) return result;
      console.log('[StreamResolver] step1 failed, trying step2...');
      return step2();
    }).then(function (result) {
      if (result || _isTV) return result;
      console.log('[StreamResolver] step2 failed, scraping embeds...');
      return tryScrapeUrls(['https://vidsrc.xyz/embed/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode, 'https://vidsrc.me/embed/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode]);
    }).catch(function (e) {
      console.log('[StreamResolver] resolveTVEpisode error:', e.message);
      return null;
    });
  }
  return {
    resolveMovie: resolveMovie,
    resolveTVEpisode: resolveTVEpisode,
    scrapeEmbed: scrapeEmbed
  };
}();