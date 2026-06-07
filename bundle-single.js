#!/usr/bin/env node
/**
 * NexPlay — Single-file Deno Deploy bundler
 * Reads all compiled JS + CSS, inlines them into one nexplay-single.ts
 *
 * Usage:
 *   node bundle-single.js
 *
 * Then deploy nexplay-single.ts to your Deno project manually.
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;

// ── 1. Build fresh JS + CSS ────────────────────────────────────────────────
console.log('[1] Transpiling JS...');
execSync('npx babel js/ --out-dir js-dist/ --quiet', { cwd: ROOT, stdio: 'inherit' });

console.log('[2] Building CSS...');
execSync('npx postcss css/style.css --output css/style-dist.css', { cwd: ROOT, stdio: 'inherit' });

// ── 2. Read all assets ─────────────────────────────────────────────────────
console.log('[3] Reading assets...');

const css       = fs.readFileSync(path.join(ROOT, 'css/style-dist.css'),  'utf8');
const polyfills = fs.readFileSync(path.join(ROOT, 'polyfills.js'),        'utf8');
const mainDist  = fs.readFileSync(path.join(ROOT, 'main-dist.js'),        'utf8');

// Icon — base64 encode for inline data URL
const iconPath   = path.join(ROOT, 'icon.png');
const iconBase64 = fs.existsSync(iconPath)
  ? fs.readFileSync(iconPath).toString('base64')
  : '';
const iconHref   = iconBase64 ? `data:image/png;base64,${iconBase64}` : '';

// JS files in load order (hls.min.js loaded from CDN — too large to inline)
const JS_FILES = [
  'js-dist/config.js',
  'js-dist/api/db.js',
  'js-dist/api/tmdb.js',
  'js-dist/api/iptv.js',
  'js-dist/api/stream.js',
  'js-dist/api/epg.js',
  'js-dist/nav.js',
  'js-dist/dropdown.js',
  'js-dist/utils.js',
  'js-dist/pages/home.js',
  'js-dist/pages/movies.js',
  'js-dist/pages/player.js',
  'js-dist/pages/series.js',
  'js-dist/pages/iptv.js',
  'js-dist/pages/detail.js',
  'js-dist/pages/favourites.js',
  'js-dist/pages/watchlist.js',
  'js-dist/app.js',
];

const appJs = JS_FILES.map(f => {
  const file = path.join(ROOT, f);
  if (!fs.existsSync(file)) { console.warn('  MISSING:', f); return ''; }
  return fs.readFileSync(file, 'utf8');
}).join('\n;\n');

// ── 3. Compose the full HTML ───────────────────────────────────────────────
console.log('[4] Composing HTML...');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NexPlay — Stream Movies, Series &amp; Live TV</title>
  <link rel="icon" type="image/png" href="/icon.png">
  <meta name="theme-color" content="#7c3aed">
  <meta name="description" content="NexPlay — Watch movies, series and live TV channels in one place. Free streaming with no sign-up required.">
  <meta name="application-name" content="NexPlay">

  <!-- Open Graph (WhatsApp, Facebook, Telegram link previews) -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="NexPlay — Stream Movies, Series &amp; Live TV">
  <meta property="og:description" content="Watch movies, series and live TV channels in one place. Free streaming with no sign-up required.">
  <meta property="og:site_name"   content="NexPlay">

  <!-- Twitter card -->
  <meta name="twitter:card"        content="summary">
  <meta name="twitter:title"       content="NexPlay">
  <meta name="twitter:description" content="Free movies, series and live TV. No sign-up.">

  <!-- PWA / installable web app -->
  <link rel="manifest" href="/manifest.json">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="NexPlay">
  <link rel="apple-touch-icon" href="/icon.png">

  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self' 'unsafe-inline' https: data: blob:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; frame-src https:; connect-src 'self' https:; img-src 'self' https: data: blob:; media-src 'self' https: blob:;">
  <style>
${css}
  </style>
</head>
<body>

<!-- Splash screen — visible immediately, removed by JS after first render -->
<div id="nexplay-splash" style="
  position:fixed;inset:0;z-index:99999;
  background:#0d1117;
  display:-webkit-flex;display:flex;
  -webkit-flex-direction:column;flex-direction:column;
  -webkit-align-items:center;align-items:center;
  -webkit-justify-content:center;justify-content:center;
  gap:28px;
">
  <div style="display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:12px;">
    <div style="
      width:56px;height:56px;border-radius:14px;
      background:linear-gradient(135deg,#7c3aed,#4f46e5);
      display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;
      font-size:30px;font-weight:900;color:#fff;font-family:system-ui,sans-serif;
      box-shadow:0 0 32px rgba(124,58,237,0.5);
    ">N</div>
    <span style="font-size:28px;font-weight:900;color:#e6edf3;font-family:system-ui,sans-serif;letter-spacing:-0.5px;">exPlay</span>
  </div>
  <div style="
    width:36px;height:36px;border-radius:50%;
    border:3px solid rgba(124,58,237,0.25);
    border-top-color:#7c3aed;
    animation:_sp 0.8s linear infinite;
  "></div>
</div>
<style>@keyframes _sp{to{transform:rotate(360deg)}}</style>

<div id="app">
  <nav id="sidebar" class="sidebar"></nav>
  <main id="main-content" class="main-content"></main>
  <div id="player-modal" class="player-modal hidden"></div>
  <div id="loading" class="loading-overlay hidden"><div class="spinner"></div></div>
  <div id="toast" class="toast"></div>
</div>

<script>
${polyfills}
</script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
<script>
${appJs}
</script>
<script>
${mainDist}
</script>
<script>
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function() {});
  }
} catch(e) { /* sandboxed context — skip service worker */ }
</script>

</body>
</html>`;

// ── 4. Generate Deno script ────────────────────────────────────────────────
console.log('[5] Generating nexplay-single.ts...');

// JSON.stringify safely escapes the HTML (handles backticks, ${...}, quotes)
const escaped = JSON.stringify(html);

// Build manifest and service worker strings
const manifestJson = JSON.stringify({
  name:             'NexPlay',
  short_name:       'NexPlay',
  description:      'Stream movies, series and live TV channels. Free, no sign-up.',
  start_url:        '/',
  display:          'standalone',
  background_color: '#0d1117',
  theme_color:      '#7c3aed',
  orientation:      'portrait-primary',
  icons: [
    { src: '/icon.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}, null, 2);

// Cache version — bump this string whenever a rebuild should bust all clients' caches.
// The SW file content changes → browser installs new SW → old cache deleted on activate.
const swCacheVer = `nexplay-v${Math.floor(Date.now() / 86400000)}`; // changes daily

const swJs = `
const CACHE = '${swCacheVer}';
self.addEventListener('install', e => {
  // Pre-cache shell for offline fallback
  e.waitUntil(caches.open(CACHE).then(c => c.add('/')));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // Delete ALL old caches so stale builds never come back
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Network-first for the shell so every deploy reaches clients immediately.
  // Falls back to cache only when offline.
  if (url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
`;

const denoScript = `/**
 * NexPlay — Single-file Deno Deploy script
 * Generated: ${new Date().toISOString()}
 *
 * Deploy options:
 *  a) Paste into https://dash.deno.com → New Playground
 *  b) deployctl deploy --project=<your-project> nexplay-single.ts
 */

const HTML: string     = ${escaped};
const MANIFEST: string = ${JSON.stringify(manifestJson)};
const SW: string       = ${JSON.stringify(swJs)};
const ICON_B64: string = "${iconBase64}";

function b64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function detectClient(ua: string): string {
  if (!ua) return "unknown";
  const has = (p: RegExp) => p.test(ua);
  const ver = (p: RegExp) => { const m = ua.match(p); return m ? m[1] : ""; };

  const device =
    has(/Tizen|SmartTV|SMART-TV/i) ? "Samsung-TV" :
    has(/iPhone/i)   ? "iPhone" :
    has(/iPad/i)     ? "iPad" :
    has(/Android/i)  ? (ua.includes("Mobile") ? "Android-Phone" : "Android-Tablet") :
    has(/Windows/i)  ? "Windows" :
    has(/Mac OS/i)   ? "Mac" :
    has(/Linux/i)    ? "Linux" : "Other";

  const browser =
    has(/EdgA?\\//i)         ? "Edge/"    + ver(/EdgA?\\/(\\d+)/i) :
    has(/OPR\\//i)           ? "Opera/"   + ver(/OPR\\/(\\d+)/i) :
    has(/SamsungBrowser/i)   ? "Samsung/" + ver(/SamsungBrowser\\/(\\d+)/i) :
    has(/Firefox\\//i)       ? "Firefox/" + ver(/Firefox\\/(\\d+)/i) :
    has(/Chrome\\//i)        ? "Chrome/"  + ver(/Chrome\\/(\\d+)/i) :
    has(/Version\\/.*Safari/i) ? "Safari/" + ver(/Version\\/(\\d+)/i) :
    has(/Safari\\//i)        ? "Safari/?" : "?";

  return device + "/" + browser;
}

function log(req: Request, status: number, ms: number, label: string): void {
  const url   = new URL(req.url);
  const ua    = req.headers.get("user-agent") || "";
  const ip    = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
             || req.headers.get("cf-connecting-ip")
             || "—";
  const lang  = req.headers.get("accept-language")?.split(",")[0] || "—";
  const ref   = req.headers.get("referer") || "—";
  const client = detectClient(ua);
  const ts    = new Date().toISOString();

  console.log(
    \`[\${ts}] \${req.method} \${url.pathname} \${status} \${ms}ms\` +
    \` | client=\${client} ip=\${ip} lang=\${lang}\` +
    (url.pathname === "/" ? \` referer=\${ref}\` : "") +
    (label ? \` [\${label}]\` : "")
  );
}

Deno.serve((req: Request): Response => {
  const t0  = Date.now();
  const url = new URL(req.url);

  let res: Response;
  let label = "";

  if (url.pathname === "/manifest.json") {
    label = "PWA-manifest";
    res = new Response(MANIFEST, {
      headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
    });
  } else if (url.pathname === "/sw.js") {
    label = "PWA-sw";
    res = new Response(SW, {
      headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache" },
    });
  } else if (url.pathname === "/icon.png" && ICON_B64) {
    label = "icon";
    res = new Response(b64ToUint8(ICON_B64), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000" },
    });
  } else {
    res = new Response(HTML, {
      headers: {
        "Content-Type":           "text/html; charset=utf-8",
        "Cache-Control":          "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy":        "no-referrer-when-downgrade",
      },
    });
  }

  log(req, res.status, Date.now() - t0, label);
  return res;
});
`;

const outPath = path.join(ROOT, 'nexplay-single.ts');
fs.writeFileSync(outPath, denoScript, 'utf8');

const sizeKB  = Math.round(fs.statSync(outPath).size / 1024);
console.log(`\nDone!  nexplay-single.ts  (${sizeKB} KB)`);
console.log('Deno Deploy limit: 1024 KB');
if (sizeKB > 900) console.warn('WARNING: File is close to the 1 MB Deno Deploy limit.');
console.log('\nDeploy manually:');
console.log('  Option A — Deno Playground: paste nexplay-single.ts into dash.deno.com');
console.log('  Option B — CLI: deployctl deploy --project=<name> nexplay-single.ts');
