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
  // Live endpoints verified 2026-06-10:
  //   lamovie → vimeos.net CDN (cors:*, works direct + proxy) ✅
  //   cdn     → mooncarpet.site CDN (403 for all external IPs) ✅ API but ❌ CDN
  //   mb-flix → 404 (endpoint removed)
  //   hdmovie → timeout (dead)
  // lamovie first — its CDN (vimeos.net) is the only one that actually streams.
  var VIDEASY_ENDPOINTS = ['https://api.videasy.to/lamovie/sources-with-title', 'https://api.videasy.to/cdn/sources-with-title'];
  var VIDEASY_ORIGIN = 'https://player.videasy.to';
  var BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  function resolveVideasy(tmdbId, type, title, year, season, episode, imdbId) {
    var buildQs = function buildQs(iid) {
      var qs = 'title=' + encodeURIComponent(encodeURIComponent(title || '')) + '&mediaType=' + (type === 'tv' ? 'tv' : 'movie') + '&tmdbId=' + tmdbId + '&imdbId=' + (iid || '') + '&year=' + (year || 0) + '&language=english';
      if (type === 'tv') qs += '&episodeId=' + episode + '&seasonId=' + season;
      return qs;
    };

    // Fetch IMDB ID from TMDB if not provided — Videasy API requires it for accurate matching
    var imdbPromise = imdbId ? Promise.resolve(imdbId) : fetch(Config.TMDB_BASE + '/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '/external_ids?api_key=' + Config.TMDB_KEY).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (d) {
      return d && d.imdb_id ? d.imdb_id : '';
    }).catch(function () {
      return '';
    });
    return imdbPromise.then(function (iid) {
      var qs = buildQs(iid);
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
    }); // end imdbPromise.then
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

  // ── Binary XHR helper (for .torrent files — responseType arraybuffer) ───────
  function xhrGetBinary(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = timeoutMs || 15000;
      xhr.responseType = 'arraybuffer';
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);else reject(new Error('HTTP ' + xhr.status));
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

  // ── Minimal bencode decoder ───────────────────────────────────────────────
  // Only used to parse YTS .torrent files (~10 KB). Extracts url-list and info.
  function _parseBencode(bytes, pos) {
    var ch = bytes[pos];
    // String: {digits}:{data}
    if (ch >= 48 && ch <= 57) {
      var col = pos;
      while (col < bytes.length && bytes[col] !== 58) col++;
      var len = 0;
      for (var p = pos; p < col; p++) len = len * 10 + (bytes[p] - 48);
      var s = '';
      for (var i = col + 1, e = col + 1 + len; i < e && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return [s, col + 1 + len];
    }
    // Integer: i{n}e
    if (ch === 105) {
      var end = pos + 1;
      while (end < bytes.length && bytes[end] !== 101) end++;
      return [parseInt(String.fromCharCode.apply(null, bytes.slice(pos + 1, end))), end + 1];
    }
    // List: l...e
    if (ch === 108) {
      var list = [];
      pos++;
      while (pos < bytes.length && bytes[pos] !== 101) {
        var r = _parseBencode(bytes, pos);
        list.push(r[0]);
        pos = r[1];
      }
      return [list, pos + 1];
    }
    // Dict: d...e
    if (ch === 100) {
      var dict = {};
      pos++;
      while (pos < bytes.length && bytes[pos] !== 101) {
        var k = _parseBencode(bytes, pos);
        pos = k[1];
        var v = _parseBencode(bytes, pos);
        pos = v[1];
        dict[k[0]] = v[0];
      }
      return [dict, pos + 1];
    }
    return [null, pos + 1];
  }
  function _parseTorrentInfo(bytes) {
    try {
      var torrent = _parseBencode(bytes, 0)[0];
      if (!torrent || _typeof(torrent) !== 'object') return null;
      var urlList = torrent['url-list'];
      var info = torrent['info'] || {};
      var name = info['name'] || '';
      var files = info['files'];
      // Web seed URLs
      var seeds = Array.isArray(urlList) ? urlList : urlList ? [urlList] : [];
      seeds = seeds.filter(function (u) {
        return typeof u === 'string' && u.indexOf('http') === 0;
      });
      // Find first MP4 path
      var mp4Path = null;
      if (Array.isArray(files)) {
        for (var i = 0; i < files.length; i++) {
          var pathArr = Array.isArray(files[i]['path']) ? files[i]['path'] : [];
          var ps = pathArr.join('/');
          if (/\.mp4$/i.test(ps)) {
            mp4Path = ps;
            break;
          }
        }
      } else if (/\.mp4$/i.test(name)) {
        mp4Path = name;
      }
      return {
        seeds: seeds,
        name: name,
        mp4Path: mp4Path
      };
    } catch (e) {
      return null;
    }
  }

  // ── TV-specific torrent resolution (direct URL for AVPlay, no WebRTC) ───────
  function _doResolveTorrentTV(tmdbId) {
    // Step 1: TMDB → IMDB ID (XHR, Tizen-safe)
    return xhrGet(Config.TMDB_BASE + '/movie/' + tmdbId + '/external_ids?api_key=' + Config.TMDB_KEY, 8000).then(function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return null;
      }
      var imdbId = data && data.imdb_id;
      if (!imdbId) {
        console.log('[StreamResolver] TV torrent: no IMDB ID');
        return null;
      }

      // Step 2: YTS API via proxy (yts.lt — yts.mx blocked for CF Worker IPs)
      var ytsUrl = 'https://yts.lt/api/v2/movie_details.json?imdb_id=' + imdbId + '&with_torrents=true';
      return xhrGet(PROXY_URL + '/?url=' + encodeURIComponent(ytsUrl), 12000).then(function (text2) {
        var yts;
        try {
          yts = JSON.parse(text2);
        } catch (e) {
          return null;
        }
        var movie = yts && yts.data && yts.data.movie;
        if (!movie || !movie.torrents || !movie.torrents.length) {
          console.log('[StreamResolver] TV torrent: no YTS entry');
          return null;
        }
        var torrents = movie.torrents;
        var t = torrents.find(function (t) {
          return t.quality === '1080p' && t.type === 'bluray';
        }) || torrents.find(function (t) {
          return t.quality === '1080p';
        }) || torrents.find(function (t) {
          return t.quality === '720p';
        }) || torrents[0];

        // Step 3: fetch .torrent binary via proxy → parse web seeds → direct AVPlay URL
        // Use t.url from API (yts.bz CDN) — yts.mx is blocked for CF Worker IPs
        var torrentProxyUrl = PROXY_URL + '/?url=' + encodeURIComponent(t.url || 'https://yts.bz/torrent/download/' + t.hash);
        return xhrGetBinary(torrentProxyUrl, 15000).then(function (ab) {
          if (!ab) {
            console.log('[StreamResolver] TV torrent: failed to fetch .torrent');
            return null;
          }
          var info = _parseTorrentInfo(new Uint8Array(ab));
          if (!info || !info.seeds.length) {
            console.log('[StreamResolver] TV torrent: no web seeds');
            return null;
          }
          var base = info.seeds[0];
          if (base.charAt(base.length - 1) !== '/') base += '/';

          // Build direct MP4 URL: base + [folder/] + file
          var videoUrl;
          if (info.mp4Path && info.name && info.mp4Path !== info.name) {
            videoUrl = base + info.name + '/' + info.mp4Path; // multi-file
          } else if (info.mp4Path) {
            videoUrl = base + info.mp4Path; // single file
          } else if (info.name) {
            videoUrl = base + info.name + (info.name.indexOf('.mp4') < 0 ? '.mp4' : '');
          }
          if (!videoUrl) {
            console.log('[StreamResolver] TV torrent: cannot build URL');
            return null;
          }
          console.log('[StreamResolver] TV torrent direct:', t.quality, videoUrl.slice(0, 80));
          return {
            url: videoUrl,
            headers: {},
            qualities: [{
              label: t.quality,
              url: videoUrl
            }]
          };
        });
      });
    }).catch(function (e) {
      console.log('[StreamResolver] _doResolveTorrentTV error:', e.message);
      return null;
    });
  }

  // ── Torrent via YTS ───────────────────────────────────────────────────────
  // TV:         fetches .torrent binary, parses web seeds → direct URL → AVPlay
  // Web/mobile: WebTorrent streams via MSE (no server needed)
  // Movies only — YTS indexes films, not TV episodes.
  function _loadWebTorrent() {
    if (typeof WebTorrent !== 'undefined') return Promise.resolve(true);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
      s.onload = function () {
        resolve(true);
      };
      s.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }
  function resolveTorrent(tmdbId, type) {
    if (type !== 'movie') return Promise.resolve(null);

    // TV: AVPlay plays a direct HTTP URL — no WebTorrent/WebRTC needed.
    //     Parse .torrent binary to extract YTS CDN web-seed URL.
    if (_isTV) return _doResolveTorrentTV(tmdbId);

    // Web/mobile: WebTorrent streams via MSE in the browser.
    return _loadWebTorrent().then(function (ok) {
      if (!ok || typeof WebTorrent === 'undefined') {
        console.log('[StreamResolver] WebTorrent failed to load');
        return null;
      }
      return _doResolveTorrent(tmdbId);
    });
  }
  function _doResolveTorrent(tmdbId) {
    // Use fetch (not xhrGet) — both TMDB and YTS APIs allow browser CORS fetch.
    // Step 1: TMDB → IMDB ID
    return fetch(Config.TMDB_BASE + '/movie/' + tmdbId + '/external_ids?api_key=' + Config.TMDB_KEY).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data) return null;
      var imdbId = data.imdb_id;
      if (!imdbId) {
        console.log('[StreamResolver] no IMDB ID for tmdb=' + tmdbId);
        return null;
      }

      // Step 2: YTS API via proxy.
      // yts.mx is blocked by Cloudflare for CF Worker IPs — use yts.lt mirror instead.
      var ytsUrl = 'https://yts.lt/api/v2/movie_details.json?imdb_id=' + imdbId + '&with_torrents=true';
      return fetch(PROXY_URL + '/?url=' + encodeURIComponent(ytsUrl)).then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (yts) {
        var movie = yts && yts.data && yts.data.movie;
        if (!movie || !movie.torrents || !movie.torrents.length) {
          console.log('[StreamResolver] no YTS torrents for', imdbId);
          return null;
        }
        var torrents = movie.torrents;
        // Pick the best quality from torrents that actually have seeds.
        // Prefer 'web'/'WEBRip' type — these are almost always MP4.
        // 'bluray' type is often MKV which browser MSE cannot play.
        var withSeeds = torrents.filter(function (t) {
          return t.seeds > 0;
        });
        var isWeb = function isWeb(t) {
          return /web/i.test(t.type);
        };
        var t = withSeeds.find(function (t) {
          return t.quality === '1080p' && isWeb(t);
        }) || withSeeds.find(function (t) {
          return t.quality === '720p' && isWeb(t);
        }) || withSeeds.find(function (t) {
          return t.quality === '1080p';
        }) || withSeeds.find(function (t) {
          return t.quality === '720p';
        }) || withSeeds[0];
        if (!t) {
          console.log('[StreamResolver] no YTS torrent with seeds for', imdbId);
          return null;
        }

        // Pass the proxied .torrent file URL — WebTorrent fetches the binary immediately
        // (gets metadata fast), then uses DHT/WebRTC trackers for peer connections.
        // yts.mx is blocked for CF Worker IPs; use t.url from API (yts.bz CDN).
        var torrentFileUrl = PROXY_URL + '/?url=' + encodeURIComponent(t.url);
        console.log('[StreamResolver] YTS torrent:', t.quality, t.seeds + ' seeds', t.hash.slice(0, 8) + '...');
        return {
          type: 'torrent',
          magnetURI: torrentFileUrl,
          hash: t.hash,
          quality: t.quality,
          title: movie.title_long
        };
      });
    }).catch(function (e) {
      console.log('[StreamResolver] _doResolveTorrent error:', e.message);
      return null;
    });
  }

  // ── Public API ─────────────────────────────────────────
  // Embed scraping is useless on TV (AVPlay can't play iframe embeds) — skip it
  var _isTV = typeof webapis !== 'undefined' && !!webapis.avplay;
  function resolveMovie(tmdbId, title, year) {
    console.log('[StreamResolver] resolveMovie', tmdbId, title, _isTV ? '(TV)' : '(web)');
    // Vidrock first on ALL platforms — Videasy CDN (mooncarpet.site) now returns 403
    // for both direct browser access AND CF Worker proxy; Vidrock CDN is still accessible.
    var step1 = resolveVidrock(tmdbId, 'movie', null, null);
    var step2 = function step2() {
      return resolveVideasy(tmdbId, 'movie', title, year, null, null);
    };
    return step1.then(function (result) {
      if (result) return result;
      console.log('[StreamResolver] step1 failed, trying step2...');
      return step2();
    }).then(function (result) {
      if (result) return result;
      console.log('[StreamResolver] step2 failed, trying torrent...');
      return resolveTorrent(tmdbId, 'movie'); // TV uses direct URL path; web uses WebTorrent
    }).then(function (result) {
      if (result) return result;
      if (_isTV) return null;
      console.log('[StreamResolver] torrent N/A, scraping embeds...');
      return tryScrapeUrls(['https://www.vidsrc.wtf/1/movie/' + tmdbId, 'https://vidsrc.me/embed/movie?tmdb=' + tmdbId, 'https://multiembed.mov/?video_id=' + tmdbId + '&tmdb=1']);
    }).catch(function (e) {
      console.log('[StreamResolver] resolveMovie error:', e.message);
      return null;
    });
  }
  function resolveTVEpisode(tmdbId, title, season, episode) {
    console.log('[StreamResolver] resolveTVEpisode', tmdbId, 'S' + season + 'E' + episode, _isTV ? '(TV)' : '(web)');
    // Vidrock first on all platforms — Videasy CDN is currently returning 403 for all IPs
    var step1 = resolveVidrock(tmdbId, 'tv', season, episode);
    var step2 = function step2() {
      return resolveVideasy(tmdbId, 'tv', title, null, season, episode);
    };
    return step1.then(function (result) {
      if (result) return result;
      console.log('[StreamResolver] step1 failed, trying step2...');
      return step2();
    }).then(function (result) {
      if (result || _isTV) return result;
      console.log('[StreamResolver] step2 failed, scraping embeds...');
      return tryScrapeUrls(['https://www.vidsrc.wtf/1/tv/' + tmdbId + '/' + season + '/' + episode, 'https://vidsrc.xyz/embed/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode, 'https://vidsrc.me/embed/tv?tmdb=' + tmdbId + '&season=' + season + '&episode=' + episode]);
    }).catch(function (e) {
      console.log('[StreamResolver] resolveTVEpisode error:', e.message);
      return null;
    });
  }
  return {
    resolveMovie: resolveMovie,
    resolveTVEpisode: resolveTVEpisode,
    scrapeEmbed: scrapeEmbed,
    resolveTorrent: resolveTorrent
  };
}();