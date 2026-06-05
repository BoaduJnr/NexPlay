/**
 * NexPlay Cloudflare Worker — CORS proxy + HLS manifest rewriter
 *
 * Usage: https://<worker>/?url=<encoded-target-url>[&headers=<base64-json-headers>]
 *
 * - Forwards the request to the target URL with smart header injection.
 * - Videasy API: no Origin header (server-to-server request, all Accept headers).
 * - Vidrock CDN: Referer/Origin set to vidrock.net for auth.
 * - Everything else: default Videasy player headers (backwards-compatible).
 * - If the response is an HLS manifest (.m3u8), rewrites all segment/sub-playlist
 *   URLs so they also route back through this proxy (preserving headers).
 * - CORS headers are added to every response so browsers can access streams.
 *
 * Deploy: wrangler deploy  (or paste into Cloudflare Workers dashboard)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Header sets per upstream service ─────────────────────────────────────────
// Videasy API (api.videasy.net): Origin/Referer must be cineby.sc — the embed
// host Videasy validates against. player.videasy.net is no longer accepted.
const HEADERS_VIDEASY_API = {
  'User-Agent':      DEFAULT_UA,
  'Accept':          '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://cineby.sc/',
  'Origin':          'https://cineby.sc',
};

// Vidrock CDN segments and API — requires Referer: vidrock.net for auth.
const HEADERS_VIDROCK = {
  'User-Agent': DEFAULT_UA,
  'Accept':     '*/*',
  'Referer':    'https://vidrock.net/',
  'Origin':     'https://vidrock.net',
};

// Default — Videasy CDN segment delivery and everything else.
// Segments are served from the embed host (cineby.sc), same as the API.
const DEFAULT_HEADERS = {
  'User-Agent':  DEFAULT_UA,
  'Accept':      '*/*',
  'Referer':     'https://cineby.sc/',
  'Origin':      'https://cineby.sc',
};

// Deno Deploy proxy — used as a fallback when CF→CF blocking returns 5xx.
// Deno is NOT on Cloudflare's network so it can freely fetch CF-protected CDNs.
// TV connects only to workers.dev (RSA/GlobalSign cert, Tizen 3.0 trusted).
const DENO_PROXY = 'https://nexplay.boadujnr.deno.net';

function pickBaseHeaders(targetUrl) {
  if (targetUrl.includes('api.videasy.net'))                                  return HEADERS_VIDEASY_API;
  if (targetUrl.includes('vidrock.net') || targetUrl.includes('vdrk.site') ||
      targetUrl.includes('b-cdn.net'))                                        return HEADERS_VIDROCK;
  return DEFAULT_HEADERS;
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const reqUrl = new URL(request.url);
  const path   = reqUrl.pathname;

  // POST /decrypt — proxy enc-dec.app for environments that can't do cross-origin POST
  if (path === '/decrypt' && request.method === 'POST') {
    const body = await request.text();
    let upResp;
    try {
      upResp = await fetch('https://enc-dec.app/api/dec-videasy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_UA },
        body,
      });
    } catch (err) {
      return new Response('Decrypt upstream error: ' + err.message,
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
    }
    const result = await upResp.text();
    return new Response(result, {
      status: upResp.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('NexPlay proxy ready', {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
    });
  }

  // Parse optional custom headers (?headers=base64-json)
  let customHeaders = {};
  const headersParam = reqUrl.searchParams.get('headers');
  if (headersParam) {
    try { customHeaders = JSON.parse(atob(headersParam)); } catch (_) {}
  }

  // Smart headers: service-specific base, caller overrides on top
  const upstreamHeaders = { ...pickBaseHeaders(targetUrl), ...customHeaders };

  // Forward Range for video seeking
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

  let upstreamBody;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    upstreamBody = await request.text();
  }

  let upstreamResp;
  try {
    upstreamResp = await fetch(targetUrl, {
      method:  request.method,
      headers: upstreamHeaders,
      body:    upstreamBody,
    });
  } catch (err) {
    return new Response('Upstream fetch failed: ' + err.message, {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
    });
  }

  // CF→CF fallback: if upstream returns 5xx (Cloudflare blocking CF Worker requests
  // to another Cloudflare-protected origin), retry via Deno Deploy which is on a
  // separate network and can freely fetch those origins. ?raw=1 returns content
  // without URL rewriting so this Worker can do its own rewriting below.
  // resolvedUrl tracks the ORIGINAL CDN URL for correct relative-URL resolution in
  // the m3u8 rewriter — denoResp.url would be the Deno proxy URL which is wrong.
  let resolvedUrl = upstreamResp.url || targetUrl;
  if (upstreamResp.status >= 500 && DENO_PROXY) {
    try {
      const hdrs = Object.keys(customHeaders).length
        ? '&headers=' + encodeURIComponent(btoa(JSON.stringify(customHeaders))) : '';
      const denoUrl = DENO_PROXY + '/?url=' + encodeURIComponent(targetUrl) + hdrs + '&raw=1';
      const denoResp = await fetch(denoUrl, { headers: { 'User-Agent': DEFAULT_UA } });
      if (denoResp.ok) {
        upstreamResp = denoResp;
        resolvedUrl  = targetUrl;   // keep CDN URL as base for relative-URL resolution
      }
    } catch (_) {}
  }

  const contentType = upstreamResp.headers.get('Content-Type') || '';
  const isM3U8 = contentType.includes('mpegurl') ||
                 contentType.includes('x-mpegURL') ||
                 targetUrl.includes('.m3u8');

  const respHeaders = { ...CORS_HEADERS };
  respHeaders['Content-Type']  = isM3U8 ? 'application/vnd.apple.mpegurl' : (contentType || 'application/octet-stream');
  respHeaders['Cache-Control'] = isM3U8 ? 'public, max-age=10' : 'public, max-age=300';

  if (!isM3U8) {
    for (const h of ['Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const v = upstreamResp.headers.get(h);
      if (v) respHeaders[h] = v;
    }
  }

  // ?raw=1 — skip URL rewriting, return content as-is.
  // Used by stream.js when fetching a master m3u8 just to parse quality levels —
  // the raw CDN variant URLs are stored in _availableQualities, avoiding
  // double-proxying when quality switching or a saved preference is applied.
  const rawMode = reqUrl.searchParams.get('raw') === '1';

  if (isM3U8 && !rawMode) {
    const body = streamRewriteM3U8(upstreamResp.body, resolvedUrl, reqUrl.origin, customHeaders);
    return new Response(body, { status: upstreamResp.status, headers: respHeaders });
  }

  return new Response(upstreamResp.body, { status: upstreamResp.status, headers: respHeaders });
}

/**
 * Stream-rewrite an HLS manifest line-by-line via TransformStream.
 */
function streamRewriteM3U8(upstreamBody, manifestUrl, proxyOrigin, customHeaders) {
  const base      = new URL(manifestUrl);
  const hdrsParam = Object.keys(customHeaders).length
    ? '&headers=' + encodeURIComponent(btoa(JSON.stringify(customHeaders)))
    : '';

  function wrap(uri) {
    const abs = resolveUrl(uri.trim(), base);
    return `${proxyOrigin}/?url=${encodeURIComponent(abs)}${hdrsParam}`;
  }

  function rewriteLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${wrap(uri)}"`);
    }
    return wrap(trimmed);
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf   = '';

  const { readable, writable } = new TransformStream({
    transform(chunk, ctrl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        ctrl.enqueue(enc.encode(rewriteLine(line) + '\n'));
      }
    },
    flush(ctrl) {
      if (buf) ctrl.enqueue(enc.encode(rewriteLine(buf)));
    },
  });

  upstreamBody.pipeTo(writable);
  return readable;
}

function resolveUrl(url, base) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//'))  return base.protocol + url;
  if (url.startsWith('/'))   return base.origin + url;
  const dir = base.href.substring(0, base.href.lastIndexOf('/') + 1);
  return dir + url;
}
