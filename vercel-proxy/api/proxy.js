/**
 * NexPlay Vercel proxy for VidLink on Tizen TV
 *
 * Why Vercel instead of CF Worker:
 *   - VidLink CDN is behind Cloudflare — CF Worker can't reach it (CF→CF blocked)
 *   - Vercel uses Google Trust Services → GlobalSign Root CA (RSA chain)
 *   - Tizen 3.0 trusts GlobalSign Root CA — same chain as workers.dev
 *   - Deno Deploy uses ECDSA certs that Tizen 3.0 doesn't support
 *
 * Deploy: push this folder to GitHub, import to vercel.com (free)
 * Set Config.VIDLINK_PROXY_URL to your https://<project>.vercel.app/api/proxy
 */

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age':       '86400',
};

function resolveUrl(uri, base) {
  if (/^https?:\/\//.test(uri)) return uri;
  if (uri.startsWith('//'))      return base.protocol + uri;
  if (uri.startsWith('/'))       return base.origin + uri;
  return base.href.slice(0, base.href.lastIndexOf('/') + 1) + uri;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).set(CORS).end();
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(200).set(CORS).set('Content-Type', 'text/plain').send('NexPlay Vercel proxy ready');
  }

  let customHeaders = {};
  if (req.query.headers) {
    try { customHeaders = JSON.parse(Buffer.from(req.query.headers, 'base64').toString()); } catch (_) {}
  }

  const upstreamHeaders = { 'User-Agent': DEFAULT_UA, 'Accept': '*/*', ...customHeaders };
  const range = req.headers.range;
  if (range) upstreamHeaders['Range'] = range;

  let upResp;
  try {
    upResp = await fetch(targetUrl, { headers: upstreamHeaders, redirect: 'follow' });
  } catch (err) {
    return res.status(502).set(CORS).set('Content-Type', 'text/plain').send('Upstream error: ' + err.message);
  }

  const ct     = upResp.headers.get('Content-Type') || '';
  const isM3U8 = ct.includes('mpegurl') || ct.includes('x-mpegURL') || targetUrl.includes('.m3u8');

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', isM3U8 ? 'application/vnd.apple.mpegurl' : (ct || 'application/octet-stream'));
  res.setHeader('Cache-Control', isM3U8 ? 'public, max-age=10' : 'public, max-age=300');

  if (!isM3U8) {
    for (const h of ['Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const v = upResp.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    const buf = Buffer.from(await upResp.arrayBuffer());
    return res.status(upResp.status).send(buf);
  }

  const body = await upResp.text();
  const base = new URL(upResp.url || targetUrl);
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const proxyOrigin = proto + '://' + host;
  const hdrsParam   = Object.keys(customHeaders).length
    ? '&headers=' + encodeURIComponent(Buffer.from(JSON.stringify(customHeaders)).toString('base64'))
    : '';

  const rewritten = body.split('\n').map(line => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_, uri) =>
        `URI="${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolveUrl(uri.trim(), base))}${hdrsParam}"`
      );
    }
    return `${proxyOrigin}/api/proxy?url=${encodeURIComponent(resolveUrl(t, base))}${hdrsParam}`;
  }).join('\n');

  return res.status(upResp.status).send(rewritten);
}
