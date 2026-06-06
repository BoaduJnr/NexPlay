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
  ${iconHref ? `<link rel="icon" type="image/png" href="${iconHref}">` : ''}
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
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self' 'unsafe-inline' https: data: blob:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; frame-src https:; connect-src 'self' https:; img-src 'self' https: data: blob:; media-src 'self' https: blob:;">
  <style>
${css}
  </style>
</head>
<body>

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

</body>
</html>`;

// ── 4. Generate Deno script ────────────────────────────────────────────────
console.log('[5] Generating nexplay-single.ts...');

// JSON.stringify safely escapes the HTML (handles backticks, ${...}, quotes)
const escaped = JSON.stringify(html);

const denoScript = `/**
 * NexPlay — Single-file Deno Deploy script
 * Generated: ${new Date().toISOString()}
 *
 * Deploy options:
 *  a) Paste into https://dash.deno.com → New Playground
 *  b) deployctl deploy --project=<your-project> nexplay-single.ts
 */

const HTML: string = ${escaped};

Deno.serve((_req: Request): Response =>
  new Response(HTML, {
    headers: {
      "Content-Type":              "text/html; charset=utf-8",
      "Cache-Control":             "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options":    "nosniff",
      "Referrer-Policy":           "no-referrer-when-downgrade",
    },
  })
);
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
