/**
 * NexPlay Deno Deploy proxy — for VidLink CDN on Tizen TV
 *
 * Solves two issues the Cloudflare Worker can't fix:
 *   1. VidLink CDN uses TLS 1.3 only; Tizen 3.0 only speaks TLS 1.2.
 *      Deno Deploy acts as the TLS bridge.
 *   2. VidLink CDN is behind Cloudflare; CF→CF requests are blocked.
 *      Deno's network is not Cloudflare so it can fetch freely.
 *
 * Deploy: paste this file into https://dash.deno.com → New Project → Playground
 * URL will be:  https://<your-project>.deno.dev
 * Update VIDLINK_PROXY_URL in js/api/stream.js to match.
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age':       '86400',
};

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function resolveUrl(uri, base) {
  if (/^https?:\/\//.test(uri)) return uri;
  if (uri.startsWith('//'))     return base.protocol + uri;
  if (uri.startsWith('/'))      return base.origin + uri;
  return base.href.slice(0, base.href.lastIndexOf('/') + 1) + uri;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const reqUrl   = new URL(req.url);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('NexPlay Deno proxy ready', { status: 200, headers: { ...CORS, 'Content-Type': 'text/plain' } });
  }

  let customHeaders = {};
  const hp = reqUrl.searchParams.get('headers');
  if (hp) { try { customHeaders = JSON.parse(atob(hp)); } catch (_) {} }

  const upstreamHeaders = { 'User-Agent': DEFAULT_UA, 'Accept': '*/*', ...customHeaders };
  const range = req.headers.get('Range');
  if (range) upstreamHeaders['Range'] = range;

  let upResp;
  try {
    upResp = await fetch(targetUrl, { method: req.method, headers: upstreamHeaders, redirect: 'follow' });
  } catch (err) {
    return new Response('Upstream error: ' + err.message, { status: 502, headers: { ...CORS, 'Content-Type': 'text/plain' } });
  }

  const ct     = upResp.headers.get('Content-Type') || '';
  const isM3U8 = ct.includes('mpegurl') || ct.includes('x-mpegURL') || targetUrl.includes('.m3u8');
  const base   = new URL(upResp.url || targetUrl);

  const respHeaders = { ...CORS };
  respHeaders['Content-Type']  = isM3U8 ? 'application/vnd.apple.mpegurl' : (ct || 'application/octet-stream');
  respHeaders['Cache-Control'] = isM3U8 ? 'public, max-age=10' : 'public, max-age=300';

  // ?raw=1: return content without URL rewriting — used by the CF Worker so it
  // can do its own rewriting back to workers.dev instead of deno.net.
  if (!isM3U8 || reqUrl.searchParams.get('raw') === '1') {
    if (!isM3U8) {
      for (const h of ['Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
        const v = upResp.headers.get(h);
        if (v) respHeaders[h] = v;
      }
    }
    return new Response(upResp.body, { status: upResp.status, headers: respHeaders });
  }

  const proxyOrigin = `${reqUrl.protocol}//${reqUrl.host}`;
  const hdrsParam   = Object.keys(customHeaders).length
    ? '&headers=' + encodeURIComponent(btoa(JSON.stringify(customHeaders)))
    : '';

  const body     = await upResp.text();
  const rewritten = body.split('\n').map(line => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_, uri) =>
        `URI="${proxyOrigin}/?url=${encodeURIComponent(resolveUrl(uri.trim(), base))}${hdrsParam}"`
      );
    }
    return `${proxyOrigin}/?url=${encodeURIComponent(resolveUrl(t, base))}${hdrsParam}`;
  }).join('\n');

  return new Response(rewritten, { status: upResp.status, headers: respHeaders });
});
