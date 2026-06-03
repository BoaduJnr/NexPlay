/**
 * NexPlay Cloudflare Worker — CORS proxy + HLS manifest rewriter
 *
 * Usage: https://<worker>/?url=<encoded-target-url>[&headers=<base64-json-headers>]
 *
 * - Forwards the request to the target URL with the specified (or default) headers.
 * - If the response is an HLS manifest (.m3u8), rewrites all segment/sub-playlist
 *   URLs so they also route back through this proxy (preserving headers).
 * - CORS headers are added to every response so browsers can access streams.
 *
 * Headers priority: custom (?headers=) overrides defaults.
 * Default headers match Videasy CDN expectations (backwards-compatible with old worker).
 *
 * Deploy: wrangler deploy  (or paste into Cloudflare Workers dashboard)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Default upstream headers — used when caller doesn't supply ?headers=
// Matches Videasy CDN requirements (backwards-compatible).
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_HEADERS = {
  'User-Agent':  DEFAULT_UA,
  'Referer':     'https://player.videasy.net/',
  'Origin':      'https://player.videasy.net',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const reqUrl  = new URL(request.url);
  const path    = reqUrl.pathname;

  // POST /decrypt — proxy enc-dec.app for environments that can't do cross-origin POST
  // (e.g. old Tizen WebKit). Body is forwarded verbatim; CORS added on the way back.
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

  // Merge: custom headers override defaults so any CDN can be targeted
  const upstreamHeaders = { ...DEFAULT_HEADERS, ...customHeaders };

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

  const contentType = upstreamResp.headers.get('Content-Type') || '';
  const isM3U8 = contentType.includes('mpegurl') ||
                 contentType.includes('x-mpegURL') ||
                 targetUrl.includes('.m3u8');

  // Use the FINAL URL after redirects as the base for relative-URL resolution in m3u8.
  // If the CDN redirects (e.g. signed token → actual CDN path), relative segment paths
  // like "seg-1-v1-a1.ts" must be resolved against the redirect destination, not the
  // original URL the caller passed — otherwise all segment URLs come out wrong.
  const resolvedUrl = upstreamResp.url || targetUrl;

  // Build response headers
  const respHeaders = { ...CORS_HEADERS };
  respHeaders['Content-Type']  = isM3U8 ? 'application/vnd.apple.mpegurl' : (contentType || 'application/octet-stream');
  respHeaders['Cache-Control'] = isM3U8 ? 'public, max-age=10' : 'public, max-age=300';

  // Never forward Content-Length:
  //  - m3u8: rewritten body is larger than the upstream compressed response
  //  - segments: CF Worker auto-decompresses gzip/br upstream responses; the decompressed
  //    body is larger than the original Content-Length, causing hls.js to truncate the
  //    segment and report fragParsingError.  Let the browser use chunked transfer instead.
  // Do forward Content-Range / Accept-Ranges so range-based seeking still works.
  if (!isM3U8) {
    for (const h of ['Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const v = upstreamResp.headers.get(h);
      if (v) respHeaders[h] = v;
    }
  }

  if (isM3U8) {
    // Stream the rewrite line-by-line so hls.js starts receiving data immediately.
    // Use resolvedUrl (post-redirect) as the base so relative segment URLs like
    // "seg-1-v1-a1.ts" resolve against the actual CDN path, not the original token URL.
    const body = streamRewriteM3U8(upstreamResp.body, resolvedUrl, reqUrl.origin, customHeaders);
    return new Response(body, { status: upstreamResp.status, headers: respHeaders });
  }

  return new Response(upstreamResp.body, { status: upstreamResp.status, headers: respHeaders });
}

/**
 * Stream-rewrite an HLS manifest line-by-line via TransformStream.
 * The first bytes reach hls.js within ~1s instead of waiting for the entire
 * manifest to buffer in Worker memory (which caused 60s+ stalls on large VODs).
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
      buf = lines.pop();                      // keep incomplete trailing line
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
