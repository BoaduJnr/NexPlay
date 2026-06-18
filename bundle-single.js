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
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');
const { minify }    = require('terser');

const ROOT = __dirname;

(async () => {

// ── 1. Build fresh JS + CSS ────────────────────────────────────────────────
console.log('[1] Transpiling JS...');
execSync('npx babel js/ --out-dir js-dist/ --quiet', { cwd: ROOT, stdio: 'inherit' });

console.log('[2] Building CSS...');
execSync('npx postcss css/style.css --output css/style-dist.css', { cwd: ROOT, stdio: 'inherit' });

// ── 2. Read all assets ─────────────────────────────────────────────────────
console.log('[3] Reading assets...');

const css       = fs.readFileSync(path.join(ROOT, 'css/style-dist.css'),  'utf8');
const polyfills   = fs.readFileSync(path.join(ROOT, 'polyfills.js'),               'utf8');
const mainDist    = fs.readFileSync(path.join(ROOT, 'main-dist.js'),               'utf8');

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
  'js-dist/api/subtitles.js',
  'js-dist/api/cloudsync.js',
  'js-dist/api/google-auth.js',
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

const rawJs = JS_FILES.map(f => {
  const file = path.join(ROOT, f);
  if (!fs.existsSync(file)) { console.warn('  MISSING:', f); return ''; }
  return fs.readFileSync(file, 'utf8');
}).join('\n;\n');

// ── Minify + strip console.* calls ────────────────────────────────────────
console.log('[3b] Minifying JS...');
let appJs = rawJs;
try {
  const result = await minify(rawJs, {
    ecma:       5,       // output compatible with Chrome 47 (Tizen 3.0)
    compress: {
      drop_console:  true,   // remove all console.log/warn/error/info
      drop_debugger: true,
      dead_code:     true,
      unused:        true,
      passes:        2,      // two passes for better compression
    },
    mangle: false,           // keep variable names (needed for Babel globals)
    format: { comments: false },
  });
  if (result.code) {
    const before = Math.round(rawJs.length / 1024);
    const after  = Math.round(result.code.length / 1024);
    console.log(`       JS: ${before}KB → ${after}KB (saved ${before - after}KB)`);
    appJs = result.code;
  }
} catch (e) {
  console.warn('  Terser error (using unminified JS):', e.message);
}

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
    content="default-src 'self' 'unsafe-inline' https: data: blob:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.gstatic.com https://accounts.google.com; frame-src https:; connect-src 'self' https: wss:; img-src 'self' https: data: blob:; media-src 'self' https: blob:;">
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
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js"></script>
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

// ── Admin panel HTML ───────────────────────────────────────────────────────
const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NexPlay Admin</title>
<style>
:root{--bg:#0a0a16;--sur:#12121e;--sur2:#1a1a2e;--brd:rgba(255,255,255,0.08);--acc:#7c3aed;--txt:#e0e0f0;--txt2:rgba(224,224,240,.55);--grn:#4ade80;--red:#f87171;--yel:#fbbf24}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:system-ui,sans-serif;min-height:100vh}
#login{display:flex;align-items:center;justify-content:center;min-height:100vh}
.lc{background:var(--sur);border:1px solid var(--brd);border-radius:16px;padding:40px;width:360px;text-align:center}
.lc h1{font-size:22px;margin-bottom:8px}.lc p{color:var(--txt2);font-size:13px;margin-bottom:24px}
.inp{width:100%;height:44px;padding:0 14px;border-radius:8px;background:var(--sur2);border:1.5px solid var(--brd);color:var(--txt);font-size:14px;outline:none;margin-bottom:10px}
.inp:focus{border-color:var(--acc)}
.btn{width:100%;height:44px;border-radius:8px;background:var(--acc);border:none;color:#fff;font-size:15px;font-weight:700;cursor:pointer}
.btn:hover{opacity:.88}
#app{display:none;flex-direction:column;min-height:100vh}
header{background:var(--sur);border-bottom:1px solid var(--brd);padding:0 24px;height:52px;display:flex;align-items:center;gap:14px}
header h1{font-size:17px;font-weight:800}.sp{flex:1}
nav{display:flex;gap:2px;padding:12px 24px 0;flex-wrap:wrap}
.tab{padding:7px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;cursor:pointer;color:var(--txt2);border:1px solid transparent;border-bottom:none}
.tab.on{background:var(--sur);border-color:var(--brd);color:var(--txt)}
main{flex:1;padding:20px 24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:22px}
.sc{background:var(--sur);border:1px solid var(--brd);border-radius:12px;padding:18px;text-align:center}
.sc .v{font-size:30px;font-weight:900;color:var(--acc)}.sc .l{font-size:12px;color:var(--txt2);margin-top:3px}
table{width:100%;border-collapse:collapse;background:var(--sur);border-radius:12px;overflow:hidden}
th,td{padding:10px 14px;text-align:left;border-bottom:1px solid var(--brd);font-size:12px}
th{color:var(--txt2);font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
tr:last-child td{border-bottom:none}tr:hover td{background:var(--sur2)}
.bdg{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:800}
.g{background:rgba(74,222,128,.12);color:var(--grn)}.r{background:rgba(248,113,113,.12);color:var(--red)}
.y{background:rgba(251,191,36,.12);color:var(--yel)}.p{background:rgba(124,58,237,.12);color:#a78bfa}
.err{color:var(--red);font-size:13px;margin-top:8px}
.ld{color:var(--txt2);font-size:14px;padding:40px;text-align:center}
.st{font-size:15px;font-weight:800;margin-bottom:14px;margin-top:4px}
.rb{background:var(--sur2);border:1px solid var(--brd);color:var(--txt2);padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer}
.rb:hover{color:var(--txt)}.bk{background:none;border:none;color:var(--acc);font-size:12px;font-weight:700;cursor:pointer;margin-bottom:14px;display:block}
.tr{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.av{width:26px;height:26px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px}
.db{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:var(--red);padding:3px 9px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer}
.eb{background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);color:#a78bfa;padding:3px 9px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px}
.ef{background:var(--sur2);padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.ef textarea{width:100%;min-height:72px;padding:8px 10px;border-radius:6px;background:var(--bg);border:1px solid var(--brd);color:var(--txt);font-size:12px;font-family:inherit;resize:vertical;outline:none}
.ef textarea:focus{border-color:var(--acc)}
.ef .stars{display:flex;gap:3px;font-size:18px;cursor:pointer;margin-bottom:2px}
.ef .star{color:rgba(255,255,255,.2)}.ef .star.on{color:#facc15}
.ef .row{display:flex;gap:8px}
.sv{background:rgba(124,58,237,.85);border:none;color:#fff;padding:5px 14px;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer}
.od{width:7px;height:7px;border-radius:50%;background:var(--grn);display:inline-block;margin-right:5px}
</style>
</head>
<body>
<div id="login">
  <div class="lc">
    <h1>&#127916; NexPlay Admin</h1>
    <p>Enter your admin key to access the dashboard</p>
    <input type="password" id="ki" class="inp" placeholder="Admin key&hellip;" autocomplete="off">
    <div id="le" class="err"></div>
    <button class="btn" id="login-btn">Access Dashboard</button>
  </div>
</div>
<div id="app">
  <header>
    <h1>&#127916; NexPlay Admin</h1>
    <span class="sp"></span>
    <button class="rb" onclick="loadTab(_tab)">&#8635; Refresh</button>
    <button class="rb" onclick="logout()">Logout</button>
  </header>
  <nav id="tnav">
    <div class="tab on" onclick="switchTab('ov')">Overview</div>
    <div class="tab" onclick="switchTab('rv')">Reviews</div>
    <div class="tab" onclick="switchTab('ch')">Messages</div>
    <div class="tab" onclick="switchTab('gr')">Groups</div>
    <div class="tab" onclick="switchTab('us')">Users</div>
    <div class="tab" onclick="switchTab('on')">Online</div>
  </nav>
  <main id="mc"></main>
</div>
<script>
var _k='',_tab='ov',_tabs=['ov','rv','ch','gr','us','on'];
async function api(p){
  var r=await fetch('/admin/api'+p+'?key='+encodeURIComponent(_k));
  if(!r.ok)throw new Error(r.status+' '+r.statusText);
  return r.json();
}
async function doLogin(){
  var k=document.getElementById('ki').value.trim();
  if(!k)return;
  document.getElementById('le').textContent='';
  try{
    var r=await fetch('/admin/api/stats?key='+encodeURIComponent(k));
    if(!r.ok)throw new Error('wrong key');
    _k=k;
    document.getElementById('login').style.display='none';
    document.getElementById('app').style.display='flex';
    loadTab('ov');
  }catch(e){document.getElementById('le').textContent='Invalid key — try again.';}
}
document.getElementById('ki').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
document.getElementById('login-btn').addEventListener('click',doLogin);
function logout(){_k='';document.getElementById('login').style.display='flex';document.getElementById('app').style.display='none';}
function switchTab(t){
  _tab=t;
  document.querySelectorAll('.tab').forEach(function(el,i){el.classList.toggle('on',_tabs[i]===t);});
  loadTab(t);
}
function loadTab(t){
  _tab=t;
  var el=document.getElementById('mc');
  el.innerHTML='<div class="ld">Loading&hellip;</div>';
  if(t==='ov')ov(el);
  else if(t==='rv')rv(el);
  else if(t==='ch')ch(el);
  else if(t==='gr')gr(el);
  else if(t==='us')us(el);
  else if(t==='on')on(el);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function dt(ts){return ts?new Date(ts).toLocaleString():'—';}
function ago(ts){var d=Date.now()-ts;if(d<60000)return Math.round(d/1000)+'s ago';if(d<3600000)return Math.round(d/60000)+'m ago';return Math.round(d/3600000)+'h ago';}
async function ov(el){
  try{
    var s=await api('/stats');
    el.innerHTML='<div class="grid">'
      +'<div class="sc"><div class="v">'+s.movies+'</div><div class="l">Movies reviewed</div></div>'
      +'<div class="sc"><div class="v">'+s.reviews+'</div><div class="l">Total reviews</div></div>'
      +'<div class="sc"><div class="v">'+s.convos+'</div><div class="l">Conversations</div></div>'
      +'<div class="sc"><div class="v">'+s.groups+'</div><div class="l">Groups</div></div>'
      +'<div class="sc"><div class="v">'+s.users+'</div><div class="l">Synced users</div></div>'
      +'<div class="sc"><div class="v">'+s.online+'</div><div class="l">Online now</div></div>'
      +'</div>'
      +'<p class="st">Top Rated Movies</p>'
      +'<table><thead><tr><th>Movie ID</th><th>Avg</th><th>Reviews</th></tr></thead><tbody>'
      +(s.topRated||[]).map(function(r){return'<tr><td>'+esc(r.id)+'</td><td>'+(r.avg?'&#9733; '+r.avg:'—')+'</td><td>'+r.count+'</td></tr>';}).join('')
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
}
async function rv(el,mid){
  if(mid){
    try{
      var d=await api('/reviews/'+mid);
      el.innerHTML='<button class="bk" onclick="rv(document.getElementById(&apos;mc&apos;))">&#8592; Back to movies</button>'
        +'<p class="st">Reviews — Movie #'+esc(mid)+' ('+d.length+')</p>'
        +'<table><thead><tr><th>User</th><th>Rating</th><th>Review</th><th>Date</th><th></th></tr></thead><tbody>'
        +d.map(function(r){return'<tr data-rv-uid="'+esc(r.uid)+'" data-rv-ts="'+r.ts+'">'
          +'<td>'+(r.picture?'<img src="'+esc(r.picture)+'" class="av">':'')+esc(r.name||'?')+'</td>'
          +'<td class="rv-stars">'+'&#9733;'.repeat(r.rating||0)+'&#9734;'.repeat(5-(r.rating||0))+'</td>'
          +'<td class="tr rv-text">'+esc(r.text||'')+'</td>'
          +'<td>'+dt(r.ts)+'</td>'
          +'<td style="white-space:nowrap">'
            +'<button class="eb" data-mid="'+esc(mid)+'" data-uid="'+esc(r.uid)+'" data-ts="'+r.ts+'" data-rating="'+(r.rating||0)+'" data-text="'+esc(r.text||'')+'" onclick="editRev(this)">Edit</button>'
            +'<button class="db" data-mid="'+esc(mid)+'" data-uid="'+esc(r.uid)+'" data-ts="'+r.ts+'" onclick="delRev(this.dataset.mid,this.dataset.uid,+this.dataset.ts,this)">Delete</button>'
          +'</td>'
          +'</tr>';}).join('')
        +'</tbody></table>';
    }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
    return;
  }
  try{
    var d=await api('/reviews');
    el.innerHTML='<p class="st">Movies with Reviews ('+d.length+')</p>'
      +'<table><thead><tr><th>Movie ID</th><th>Reviews</th><th>Avg Rating</th><th>Last Review</th><th></th></tr></thead><tbody>'
      +d.map(function(m){return'<tr>'
        +'<td><strong>'+esc(m.id)+'</strong></td>'
        +'<td><span class="bdg p">'+m.count+'</span></td>'
        +'<td>'+(m.avg?'&#9733; '+m.avg:'—')+'</td>'
        +'<td>'+dt(m.lastTs)+'</td>'
        +'<td><button class="rb" data-mid="'+esc(m.id)+'" onclick="rv(document.getElementById(&apos;mc&apos;),this.dataset.mid)">View</button></td>'
        +'</tr>';}).join('')
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
}
async function ch(el){
  try{
    var d=await api('/chats');
    el.innerHTML='<p class="st">Conversations ('+d.length+')</p>'
      +'<table><thead><tr><th>Participants</th><th>Messages</th><th>Last message</th><th>Date</th><th></th></tr></thead><tbody>'
      +d.map(function(c){return'<tr>'
        +'<td class="tr">'+esc(c.key)+'</td><td>'+c.count+'</td>'
        +'<td class="tr">'+esc(c.lastMsg||'—')+'</td><td>'+dt(c.lastTs)+'</td>'
        +'<td><button class="db" data-key="'+esc(c.key)+'" onclick="delChat(this.dataset.key,this)">Delete</button></td>'
        +'</tr>';}).join('')
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
}
async function gr(el){
  try{
    var d=await api('/groups');
    el.innerHTML='<p class="st">Groups ('+d.length+')</p>'
      +'<table><thead><tr><th>Code</th><th>Name</th><th>Members</th><th>Messages</th><th>Created</th><th></th></tr></thead><tbody>'
      +d.map(function(g){return'<tr>'
        +'<td><span class="bdg p">'+esc(g.id)+'</span></td>'
        +'<td><strong>'+esc(g.name)+'</strong></td>'
        +'<td>'+g.memberCount+'</td><td>'+g.msgCount+'</td><td>'+dt(g.ts)+'</td>'
        +'<td><button class="db" data-gid="'+esc(g.id)+'" onclick="delGroup(this.dataset.gid,this)">Delete</button></td>'
        +'</tr>';}).join('')
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
}
async function us(el){
  try{
    var d=await api('/users');
    el.innerHTML='<p class="st">Synced Users ('+d.length+')</p>'
      +'<table><thead><tr><th>User</th><th>Email</th><th>Favourites</th><th>Watchlist</th><th>Last Sync</th><th></th></tr></thead><tbody>'
      +d.map(function(u){return'<tr>'
        +'<td>'+(u.picture?'<img src="'+esc(u.picture)+'" class="av">':'')+esc(u.name||u.uid)+'</td>'
        +'<td>'+esc(u.email||'—')+'</td>'
        +'<td>'+u.favCount+'</td><td>'+u.wlCount+'</td><td>'+dt(u.ts)+'</td>'
        +'<td><button class="db" data-uid="'+esc(u.uid)+'" onclick="delUser(this.dataset.uid,this)">Delete</button></td>'
        +'</tr>';}).join('')
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
}
async function on(el){
  try{
    var d=await api('/online');
    el.innerHTML='<p class="st">Online ('+d.online.length+') &nbsp;·&nbsp; Watching ('+d.watching.length+')</p>'
      +'<p style="font-size:11px;color:var(--txt2);margin-bottom:10px;">CURRENTLY ONLINE</p>'
      +'<table style="margin-bottom:20px;"><thead><tr><th>User ID</th><th>Visibility</th><th>Last seen</th></tr></thead><tbody>'
      +(d.online.length?d.online.map(function(u){return'<tr>'
        +'<td><span class="od"></span>'+esc(u.uid)+'</td>'
        +'<td>'+(u.hidden?'<span class="bdg y">Hidden</span>':'<span class="bdg g">Visible</span>')+'</td>'
        +'<td>'+ago(u.ts)+'</td></tr>';}).join('')
        :'<tr><td colspan="3" style="color:var(--txt2);text-align:center;">No one online</td></tr>')
      +'</tbody></table>'
      +'<p style="font-size:11px;color:var(--txt2);margin-bottom:10px;">CURRENTLY WATCHING</p>'
      +'<table><thead><tr><th>User</th><th>Movie</th><th>Title</th><th>Since</th></tr></thead><tbody>'
      +(d.watching.length?d.watching.map(function(w){return'<tr>'
        +'<td>'+esc(w.name||w.uid)+'</td><td>'+esc(w.movieId)+'</td>'
        +'<td class="tr">'+esc(w.movieTitle||'—')+'</td><td>'+ago(w.ts)+'</td></tr>';}).join('')
        :'<tr><td colspan="4" style="color:var(--txt2);text-align:center;">No one watching</td></tr>')
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div class="ld err">'+esc(e.message)+'</div>';}
}
async function delRev(mid,uid,ts,btn){
  if(!confirm('Delete this review?'))return;
  btn.disabled=true;btn.textContent='…';
  try{
    var r=await fetch('/admin/api/reviews/'+mid+'?key='+encodeURIComponent(_k)+'&uid='+encodeURIComponent(uid)+'&ts='+ts,{method:'DELETE'});
    if(!r.ok)throw new Error('Failed');
    var row=btn.closest('tr');
    var next=row.nextElementSibling;
    if(next&&next.classList.contains('ef-row'))next.remove();
    row.remove();
  }catch(e){btn.disabled=false;btn.textContent='Delete';alert(e.message);}
}
function editRev(btn){
  var row=btn.closest('tr');
  var next=row.nextElementSibling;
  // Toggle off if already open
  if(next&&next.classList.contains('ef-row')){next.remove();return;}
  var mid=btn.dataset.mid,uid=btn.dataset.uid,ts=+btn.dataset.ts;
  var rating=+btn.dataset.rating||0;
  var text=btn.dataset.text||'';
  var efRow=document.createElement('tr');
  efRow.className='ef-row';
  var stars='';
  for(var i=1;i<=5;i++)stars+='<span class="star'+(i<=rating?' on':'')+'" data-v="'+i+'">&#9733;</span>';
  efRow.innerHTML='<td colspan="5"><div class="ef">'
    +'<div class="stars" id="ef-stars-'+ts+'">'+stars+'</div>'
    +'<textarea id="ef-ta-'+ts+'">'+text.replace(/</g,'&lt;')+'</textarea>'
    +'<div class="row">'
      +'<button class="sv" onclick="saveRev(&#39;'+mid+'&#39;,&#39;'+encodeURIComponent(uid)+'&#39;,'+ts+',this)">Save</button>'
      +'<button class="rb" onclick="this.closest(&#39;.ef-row&#39;).remove()">Cancel</button>'
    +'</div>'
  +'</div></td>';
  row.after(efRow);
  // Star click
  var starsEl=document.getElementById('ef-stars-'+ts);
  starsEl.addEventListener('click',function(e){
    var s=e.target.closest('.star');if(!s)return;
    var v=+s.dataset.v;
    starsEl.querySelectorAll('.star').forEach(function(x){x.classList.toggle('on',+x.dataset.v<=v);});
    starsEl.dataset.rating=v;
  });
  starsEl.dataset.rating=rating;
}
async function saveRev(mid,uidEnc,ts,btn){
  btn.disabled=true;btn.textContent='…';
  var efRow=btn.closest('.ef-row');
  var starsEl=document.getElementById('ef-stars-'+ts);
  var newRating=+(starsEl?starsEl.dataset.rating||0:0);
  var ta=document.getElementById('ef-ta-'+ts);
  var newText=ta?ta.value.trim():'';
  if(!newText){btn.disabled=false;btn.textContent='Save';alert('Review text cannot be empty.');return;}
  var uid=decodeURIComponent(uidEnc);
  try{
    var r=await fetch('/admin/api/reviews/'+mid+'?key='+encodeURIComponent(_k)+'&uid='+encodeURIComponent(uid)+'&ts='+ts,{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({rating:newRating,text:newText})
    });
    if(!r.ok)throw new Error('Failed');
    // Update displayed row
    var dataRow=efRow.previousElementSibling;
    if(dataRow){
      var starsCell=dataRow.querySelector('.rv-stars');
      if(starsCell)starsCell.innerHTML='&#9733;'.repeat(newRating)+'&#9734;'.repeat(5-newRating);
      var textCell=dataRow.querySelector('.rv-text');
      if(textCell)textCell.textContent=newText;
      var editBtn=dataRow.querySelector('.eb');
      if(editBtn){editBtn.dataset.rating=newRating;editBtn.dataset.text=newText;}
    }
    efRow.remove();
  }catch(e){btn.disabled=false;btn.textContent='Save';alert(e.message);}
}
async function delChat(key,btn){
  if(!confirm('Delete this conversation? This removes all messages.'))return;
  btn.disabled=true;btn.textContent='…';
  try{
    var r=await fetch('/admin/api/chats/'+encodeURIComponent(key)+'?key='+encodeURIComponent(_k),{method:'DELETE'});
    if(!r.ok)throw new Error('Failed');
    btn.closest('tr').remove();
  }catch(e){btn.disabled=false;btn.textContent='Delete';alert(e.message);}
}
async function delGroup(gid,btn){
  if(!confirm('Delete group '+gid+'? This removes all messages and member list.'))return;
  btn.disabled=true;btn.textContent='…';
  try{
    var r=await fetch('/admin/api/groups/'+encodeURIComponent(gid)+'?key='+encodeURIComponent(_k),{method:'DELETE'});
    if(!r.ok)throw new Error('Failed');
    btn.closest('tr').remove();
  }catch(e){btn.disabled=false;btn.textContent='Delete';alert(e.message);}
}
async function delUser(uid,btn){
  if(!confirm('Delete sync data for this user? Their favourites/watchlist stored in cloud will be removed.'))return;
  btn.disabled=true;btn.textContent='…';
  try{
    var r=await fetch('/admin/api/users/'+encodeURIComponent(uid)+'?key='+encodeURIComponent(_k),{method:'DELETE'});
    if(!r.ok)throw new Error('Failed');
    btn.closest('tr').remove();
  }catch(e){btn.disabled=false;btn.textContent='Delete';alert(e.message);}
}
</script>
</body>
</html>`;

const denoScript = `/**
 * NexPlay — Single-file Deno Deploy script
 * Generated: ${new Date().toISOString()}
 *
 * Deploy options:
 *  a) Paste into https://dash.deno.com → New Playground
 *  b) deployctl deploy --project=<your-project> nexplay-single.ts
 */

const HTML: string     = ${escaped};
const MANIFEST: string    = ${JSON.stringify(manifestJson)};
const ADMIN_HTML: string  = ${JSON.stringify(adminHtml)};
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

// Deno KV — required for reviews, chat, presence, ratings.
// Deno Deploy projects: works natively.
// Deno Playground / old runtimes: gracefully disabled (app still serves HTML).
let kv: Deno.Kv | null = null;
try {
  if (typeof Deno !== "undefined" && typeof (Deno as Record<string, unknown>).openKv === "function") {
    kv = await Deno.openKv();
  } else {
    console.warn("[NexPlay] Deno.openKv not available — social features disabled. Deploy as a Deno Deploy project to enable KV.");
  }
} catch (e) {
  console.warn("[NexPlay] Deno KV init failed:", (e as Error).message);
}

// CORS headers for review API — allows TV (.wgt) and local dev to call the deployed server
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(r: Response): Response {
  const h = new Headers(r.headers);
  Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const t0  = Date.now();
  const url = new URL(req.url);

  // Handle CORS preflight for review API
  const _apiPaths = ["/api/reviews","/api/reply","/api/presence","/api/watching","/api/chats","/api/chat","/api/chat_code","/api/ratings","/api/group_create","/api/group_info","/api/group_join","/api/group_list","/api/group_msgs","/api/group_msg","/api/group_leave"];
  if (req.method === "OPTIONS" && _apiPaths.indexOf(url.pathname) !== -1) {
    return new Response(null, { status: 204, headers: CORS });
  }
  // Return 503 for all API routes when KV is not available
  if (!kv && _apiPaths.indexOf(url.pathname) !== -1) {
    return withCors(new Response(JSON.stringify({ error: "KV not available. Deploy as a Deno Deploy project." }), {
      status: 503, headers: { "Content-Type": "application/json" },
    }));
  }

  let res: Response;
  let label = "";

  if (url.pathname === "/api/sync") {
    label = "KV-sync";
    const uid = url.searchParams.get("uid") || "";
    if (!uid || !/^[ug]_[a-z0-9_]{5,60}$/.test(uid)) {
      res = new Response("Bad Request", { status: 400 });
    } else if (req.method === "GET") {
      const entry = await kv.get<unknown>(["sync", uid]);
      res = new Response(JSON.stringify(entry.value ?? null), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      });
    } else if (req.method === "POST") {
      let body: unknown;
      try { body = await req.json(); } catch { body = null; }
      if (!body) {
        res = new Response("Bad JSON", { status: 400 });
      } else {
        await kv.set(["sync", uid], body);
        res = new Response("OK");
      }
    } else {
      res = new Response("Method Not Allowed", { status: 405 });
    }
  // ── Group chat endpoints ─────────────────────────────────────────────────
  } else if (url.pathname === "/api/group_create" && req.method === "POST") {
    label = "KV-group-create";
    let body: Record<string, unknown>; try { body = await req.json(); } catch { body = {}; }
    const uid     = String(body.uid     || "").slice(0, 64);
    const name    = String(body.name    || "Anonymous").slice(0, 60);
    const picture = String(body.picture || "").slice(0, 300);
    const gName   = String(body.groupName || "New Group").trim().slice(0, 60);
    if (!uid || !/^[a-z0-9_-]{5,64}$/.test(uid)) {
      res = withCors(new Response("Bad Request", { status: 400 }));
    } else {
      // Generate unique group code: GC + 6 chars
      const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let gid = ""; let attempts = 0;
      do {
        const bytes = new Uint8Array(6); crypto.getRandomValues(bytes);
        gid = "GC" + Array.from(bytes).map(b => alpha[b % alpha.length]).join("");
        const clash = await kv.get(["group", gid]);
        if (!clash.value) break; gid = "";
      } while (++attempts < 10);
      if (!gid) { res = withCors(new Response("Server Error", { status: 500 })); }
      else {
        const group = { id: gid, name: gName, owner: uid, members: [{ uid, name, picture }], ts: Date.now() };
        await kv.set(["group", gid], group);
        await kv.set(["group_list", uid, gid], { id: gid, name: gName, lastMsg: "", lastTs: Date.now(), memberCount: 1 });
        res = withCors(new Response(JSON.stringify({ id: gid }), { headers: { "Content-Type": "application/json" } }));
      }
    }
  } else if (url.pathname === "/api/group_info" && req.method === "GET") {
    label = "KV-group-info";
    const gid = (url.searchParams.get("id") || "").toUpperCase();
    if (!gid || !/^GC[A-Z2-9]{6}$/.test(gid)) { res = withCors(new Response("Bad Request", { status: 400 })); }
    else {
      const entry = await kv.get<Record<string, unknown>>(["group", gid]);
      if (!entry.value) { res = withCors(new Response(JSON.stringify(null), { headers: { "Content-Type": "application/json" } })); }
      else {
        const g = entry.value;
        res = withCors(new Response(JSON.stringify({ id: g.id, name: g.name, memberCount: (g.members as unknown[]).length }), { headers: { "Content-Type": "application/json" } }));
      }
    }
  } else if (url.pathname === "/api/group_join" && req.method === "POST") {
    label = "KV-group-join";
    let body: Record<string, unknown>; try { body = await req.json(); } catch { body = {}; }
    const uid     = String(body.uid     || "").slice(0, 64);
    const name    = String(body.name    || "Anonymous").slice(0, 60);
    const picture = String(body.picture || "").slice(0, 300);
    const gid     = String(body.groupId || "").toUpperCase();
    if (!uid || !gid || !/^GC[A-Z2-9]{6}$/.test(gid)) { res = withCors(new Response("Bad Request", { status: 400 })); }
    else {
      const entry = await kv.get<Record<string, unknown>>(["group", gid]);
      if (!entry.value) { res = withCors(new Response(JSON.stringify(null), { headers: { "Content-Type": "application/json" } })); }
      else {
        const g = { ...(entry.value as Record<string, unknown>) };
        const members = [...(g.members as Record<string, unknown>[])];
        if (!members.find((m) => (m as Record<string, unknown>).uid === uid)) {
          members.push({ uid, name, picture }); g.members = members;
          await kv.set(["group", gid], g);
        }
        await kv.set(["group_list", uid, gid], { id: gid, name: g.name, lastMsg: "", lastTs: Date.now(), memberCount: members.length });
        res = withCors(new Response(JSON.stringify({ id: gid, name: g.name, memberCount: members.length }), { headers: { "Content-Type": "application/json" } }));
      }
    }
  } else if (url.pathname === "/api/group_list" && req.method === "GET") {
    label = "KV-group-list";
    const uid = url.searchParams.get("uid") || "";
    if (!uid) { res = withCors(new Response("[]", { headers: { "Content-Type": "application/json" } })); }
    else {
      const groups: Record<string, unknown>[] = [];
      const iter = kv.list<Record<string, unknown>>({ prefix: ["group_list", uid] });
      for await (const e of iter) { if (e.value) groups.push(e.value as Record<string, unknown>); }
      groups.sort((a, b) => ((b.lastTs as number) ?? 0) - ((a.lastTs as number) ?? 0));
      res = withCors(new Response(JSON.stringify(groups), { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } }));
    }
  } else if (url.pathname === "/api/group_msgs" && req.method === "GET") {
    label = "KV-group-msgs";
    const gid = (url.searchParams.get("id") || "").toUpperCase();
    if (!gid) { res = withCors(new Response("[]", { headers: { "Content-Type": "application/json" } })); }
    else {
      const entry = await kv.get<unknown[]>(["group_msgs", gid]);
      res = withCors(new Response(JSON.stringify(entry.value ?? []), { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } }));
    }
  } else if (url.pathname === "/api/group_msg" && req.method === "POST") {
    label = "KV-group-msg";
    let body: Record<string, unknown>; try { body = await req.json(); } catch { body = {}; }
    const uid     = String(body.uid     || "").slice(0, 64);
    const name    = String(body.name    || "").slice(0, 60);
    const picture = String(body.picture || "").slice(0, 300);
    const gid     = String(body.groupId || "").toUpperCase();
    const text    = String(body.text    || "").trim().slice(0, 500);
    if (!uid || !gid || !text || !/^GC[A-Z2-9]{6}$/.test(gid)) { res = withCors(new Response("Bad Request", { status: 400 })); }
    else {
      const gEntry = await kv.get<Record<string, unknown>>(["group", gid]);
      if (!gEntry.value) { res = withCors(new Response("Not Found", { status: 404 })); }
      else {
        const g = gEntry.value;
        const msgsEntry = await kv.get<unknown[]>(["group_msgs", gid]);
        const msgs = Array.isArray(msgsEntry.value) ? [...msgsEntry.value] : [];
        const msg = { uid, name, picture, text, ts: Date.now() };
        msgs.push(msg); if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
        await kv.set(["group_msgs", gid], msgs);
        // Update last message for all members
        const members = (g.members as Record<string, unknown>[]) ?? [];
        for (const m of members) {
          await kv.set(["group_list", String((m as Record<string, unknown>).uid), gid], { id: gid, name: g.name, lastMsg: text.slice(0, 60), lastTs: msg.ts, memberCount: members.length });
        }
        res = withCors(new Response(JSON.stringify(msg), { headers: { "Content-Type": "application/json" } }));
      }
    }
  } else if (url.pathname === "/api/chat_code") {
    label = "KV-chat-code";
    if (req.method === "POST") {
      // Register or retrieve a user's chat code
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { body = {}; }
      const uid     = String(body.uid     || "").slice(0, 64);
      const name    = String(body.name    || "").slice(0, 60);
      const picture = String(body.picture || "").slice(0, 300);
      if (!uid || !/^[a-z0-9_-]{5,64}$/.test(uid)) {
        res = withCors(new Response("Bad Request", { status: 400 }));
      } else {
        // Check if user already has a code
        const existing = await kv.get<string>(["user_code", uid]);
        let code = existing.value ?? "";
        if (!code) {
          // Generate unique 8-char code (NP + 6 chars from safe alphabet)
          const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          let attempts = 0;
          do {
            const bytes = new Uint8Array(6);
            crypto.getRandomValues(bytes);
            code = "NP" + Array.from(bytes).map(b => alpha[b % alpha.length]).join("");
            const clash = await kv.get(["chat_code", code]);
            if (!clash.value) break;
            code = "";
          } while (++attempts < 10);
          if (!code) { res = withCors(new Response("Server Error", { status: 500 })); }
          else {
            await kv.set(["chat_code", code], { uid, name, picture });
            await kv.set(["user_code", uid], code);
          }
        }
        if (code) {
          // Refresh name/picture on each call (they might have updated)
          await kv.set(["chat_code", code], { uid, name, picture });
          res = withCors(new Response(JSON.stringify({ code }), {
            headers: { "Content-Type": "application/json" },
          }));
        }
      }
    } else if (req.method === "GET") {
      // Look up a user by their chat code
      const code = (url.searchParams.get("code") || "").toUpperCase().trim();
      if (!code || !/^NP[A-Z2-9]{6}$/.test(code)) {
        res = withCors(new Response("Bad Request", { status: 400 }));
      } else {
        const entry = await kv.get<{ uid: string; name: string; picture: string }>(["chat_code", code]);
        if (!entry.value) {
          res = withCors(new Response(JSON.stringify(null), {
            headers: { "Content-Type": "application/json" },
          }));
        } else {
          res = withCors(new Response(JSON.stringify(entry.value), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
          }));
        }
      }
    } else {
      res = withCors(new Response("Method Not Allowed", { status: 405 }));
    }
  } else if (url.pathname === "/api/chats" && req.method === "GET") {
    label = "KV-chats";
    const uid = url.searchParams.get("uid") || "";
    if (!uid || !/^[a-z0-9_-]{5,64}$/.test(uid)) {
      res = withCors(new Response("Bad Request", { status: 400 }));
    } else {
      const convos: Record<string, unknown>[] = [];
      const iter = kv.list<Record<string, unknown>>({ prefix: ["chat_meta", uid] });
      for await (const e of iter) { if (e.value) convos.push(e.value as Record<string, unknown>); }
      convos.sort((a, b) => ((b.lastTs as number) ?? 0) - ((a.lastTs as number) ?? 0));
      res = withCors(new Response(JSON.stringify(convos), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      }));
    }
  } else if (url.pathname === "/api/chat") {
    label = "KV-chat";
    if (req.method === "GET") {
      const uid1 = url.searchParams.get("uid1") || "";
      const uid2 = url.searchParams.get("uid2") || "";
      if (!uid1 || !uid2) { res = withCors(new Response("Bad Request", { status: 400 })); }
      else {
        const key = [uid1, uid2].sort().join("|");
        const entry = await kv.get<unknown[]>(["chat_msgs", key]);
        res = withCors(new Response(JSON.stringify(entry.value ?? []), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        }));
      }
    } else if (req.method === "POST") {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { body = {}; }
      const fromUid     = String(body.fromUid     || "").slice(0, 64);
      const fromName    = String(body.fromName    || "").slice(0, 60);
      const fromPicture = String(body.fromPicture || "").slice(0, 300);
      const toUid       = String(body.toUid       || "").slice(0, 64);
      const toName      = String(body.toName      || "").slice(0, 60);
      const toPicture   = String(body.toPicture   || "").slice(0, 300);
      const text        = String(body.text        || "").trim().slice(0, 500);
      if (!fromUid || !toUid || !text) { res = withCors(new Response("Bad Request", { status: 400 })); }
      else {
        const key = [fromUid, toUid].sort().join("|");
        const entry = await kv.get<unknown[]>(["chat_msgs", key]);
        const msgs  = Array.isArray(entry.value) ? [...entry.value] : [];
        const msg   = { from: fromUid, text, ts: Date.now() };
        msgs.push(msg);
        if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
        await kv.set(["chat_msgs", key], msgs);
        const ts = msg.ts;
        await kv.set(["chat_meta", fromUid, toUid], { otherUid: toUid,   otherName: toName,    otherPicture: toPicture,   lastMsg: text, lastTs: ts });
        await kv.set(["chat_meta", toUid, fromUid], { otherUid: fromUid, otherName: fromName,  otherPicture: fromPicture, lastMsg: text, lastTs: ts });
        res = withCors(new Response(JSON.stringify(msg), { headers: { "Content-Type": "application/json" } }));
      }
    } else if (req.method === "DELETE") {
      // Delete a DM conversation for the requesting user only
      const uid      = url.searchParams.get("uid")   || "";
      const otherUid = url.searchParams.get("other") || "";
      if (!uid || !otherUid) { res = withCors(new Response("Bad Request", { status: 400 })); }
      else {
        // Remove the chat_meta entry so it no longer appears in the list for this user.
        // Messages in chat_msgs are shared; we don't delete them so the other party still sees them.
        await kv.delete(["chat_meta", uid, otherUid]);
        res = withCors(new Response("OK"));
      }
    } else { res = withCors(new Response("Method Not Allowed", { status: 405 })); }
  } else if (url.pathname === "/api/group_leave" && req.method === "POST") {
    label = "KV-group-leave";
    let body: Record<string, unknown>; try { body = await req.json(); } catch { body = {}; }
    const uid = String(body.uid || "").slice(0, 64);
    const gid = String(body.groupId || "").toUpperCase();
    if (!uid || !gid || !/^GC[A-Z2-9]{6}$/.test(gid)) {
      res = withCors(new Response("Bad Request", { status: 400 }));
    } else {
      // Remove user from group member list
      const entry = await kv.get<Record<string, unknown>>(["group", gid]);
      if (entry.value) {
        const g = { ...(entry.value as Record<string, unknown>) };
        const members = (g.members as Record<string, unknown>[]).filter((m) => (m as Record<string, unknown>).uid !== uid);
        g.members = members;
        await kv.set(["group", gid], g);
        // Update remaining members' group_list counts
        for (const m of members) {
          const glEntry = await kv.get<Record<string, unknown>>(["group_list", String((m as Record<string, unknown>).uid), gid]);
          if (glEntry.value) await kv.set(["group_list", String((m as Record<string, unknown>).uid), gid], { ...(glEntry.value as Record<string, unknown>), memberCount: members.length });
        }
      }
      // Remove the group_list entry for this user so it no longer shows
      await kv.delete(["group_list", uid, gid]);
      res = withCors(new Response("OK"));
    }
  } else if (url.pathname === "/api/ratings" && req.method === "GET") {
    label = "KV-ratings";
    const ids = (url.searchParams.get("ids") || "")
      .split(",").map(s => s.trim()).filter(s => /^\\d{1,10}$/.test(s)).slice(0, 100);
    if (!ids.length) {
      res = withCors(new Response("{}", { headers: { "Content-Type": "application/json" } }));
    } else {
      const out: Record<string, unknown> = {};
      for (const id of ids) {
        const entry = await kv.get<{ avg: number | null; count: number }>(["rating", id]);
        out[id] = entry.value ?? { avg: null, count: 0 };
      }
      res = withCors(new Response(JSON.stringify(out), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      }));
    }
  } else if (url.pathname === "/api/watching") {
    label = "KV-watching";
    if (req.method === "POST") {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { body = {}; }
      const uid        = String(body.uid        || "").slice(0, 64);
      const movieId    = String(body.movieId    || "").slice(0, 20);
      const name       = String(body.name       || "").slice(0, 60);
      const picture    = String(body.picture    || "").slice(0, 300);
      const movieTitle = String(body.movieTitle || "").slice(0, 100);
      const hidden     = Boolean(body.hidden);
      if (!uid || !movieId || !/^[a-z0-9_\-]{5,64}$/.test(uid)) {
        res = withCors(new Response("Bad Request", { status: 400 }));
      } else {
        await kv.set(["watching", movieId, uid], { uid, name, picture, movieTitle, ts: Date.now(), hidden });
        res = withCors(new Response("OK"));
      }
    } else if (req.method === "GET") {
      const movieId      = url.searchParams.get("id")  || "";
      const requesterUid = url.searchParams.get("uid") || "";
      if (!movieId) {
        res = withCors(new Response("Bad Request", { status: 400 }));
      } else {
        const now = Date.now();
        const FIVE_MIN = 5 * 60 * 1000;
        const watchers: Record<string, unknown>[] = [];
        const iter = kv.list<{ uid: string; name: string; picture: string; ts: number; hidden: boolean }>({
          prefix: ["watching", movieId],
        });
        for await (const entry of iter) {
          const v = entry.value;
          if (v && !v.hidden && (now - v.ts) < FIVE_MIN && v.uid !== requesterUid) {
            watchers.push({ uid: v.uid, name: v.name, picture: v.picture, ts: v.ts });
          }
        }
        watchers.sort((a, b) => ((b as Record<string, number>).ts ?? 0) - ((a as Record<string, number>).ts ?? 0));
        res = withCors(new Response(JSON.stringify(watchers), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
        }));
      }
    } else {
      res = withCors(new Response("Method Not Allowed", { status: 405 }));
    }
  } else if (url.pathname === "/api/presence") {
    label = "KV-presence";
    if (req.method === "POST") {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { body = {}; }
      const uid    = String(body.uid    || "").slice(0, 64);
      const hidden = Boolean(body.hidden);
      if (!uid || !/^[a-z0-9_\-]{5,64}$/.test(uid)) {
        res = withCors(new Response("Bad Request", { status: 400 }));
      } else {
        await kv.set(["presence", uid], { ts: Date.now(), hidden });
        const syncEntry = await kv.get<Record<string, unknown>>(["sync", uid]);
        const syncBlob = syncEntry.value ? { ...syncEntry.value, statusHidden: hidden } : { statusHidden: hidden };
        await kv.set(["sync", uid], syncBlob);
        res = withCors(new Response("OK"));
      }
    } else if (req.method === "GET") {
      const raw   = url.searchParams.get("uids") || "";
      const uids  = raw.split(",").map(u => u.trim()).filter(u => /^[a-z0-9_\-]{5,64}$/.test(u)).slice(0, 50);
      const now   = Date.now();
      const THREE_MIN = 3 * 60 * 1000;
      const online: Record<string, boolean> = {};
      for (const uid of uids) {
        const entry = await kv.get<{ ts: number; hidden: boolean }>(["presence", uid]);
        if (entry.value && !entry.value.hidden && (now - entry.value.ts) < THREE_MIN) {
          online[uid] = true;
        }
      }
      res = withCors(new Response(JSON.stringify(online), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      }));
    } else {
      res = withCors(new Response("Method Not Allowed", { status: 405 }));
    }
  } else if (url.pathname === "/api/reviews") {
    label = "KV-reviews";
    const movieId = url.searchParams.get("id") || "";
    if (!movieId || !/^\\d{1,10}$/.test(movieId)) {
      res = new Response("Bad Request", { status: 400 });
    } else if (req.method === "GET") {
      const entry = await kv.get<unknown[]>(["reviews", movieId]);
      res = new Response(JSON.stringify(entry.value ?? []), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      });
    } else if (req.method === "POST") {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { body = {}; }
      const uid     = String(body.uid     || "").slice(0, 64);
      const name    = String(body.name    || "Anonymous").slice(0, 60);
      const picture = String(body.picture || "").slice(0, 300);
      const text    = String(body.text    || "").trim().slice(0, 500);
      const rating  = Math.min(5, Math.max(1, Math.floor(Number(body.rating) || 1)));
      if (!uid || !text || !/^[a-z0-9_\-]{5,64}$/.test(uid)) {
        res = new Response("Bad Request", { status: 400 });
      } else {
        const entry   = await kv.get<unknown[]>(["reviews", movieId]);
        const reviews: Record<string, unknown>[] = Array.isArray(entry.value) ? [...entry.value as Record<string, unknown>[]] : [];
        const idx     = reviews.findIndex((r) => (r as Record<string, unknown>).uid === uid);
        // Preserve existing replies when updating a review
        const existingReplies = idx >= 0 ? ((reviews[idx] as Record<string, unknown>).replies ?? []) : [];
        const review  = { uid, name, picture, rating, text, ts: Date.now(), replies: existingReplies };
        if (idx >= 0) { reviews[idx] = review; } else { reviews.unshift(review); }
        if (reviews.length > 500) reviews.length = 500;
        await kv.set(["reviews", movieId], reviews);
        // Update pre-computed rating summary for fast card display
        const ratedReviews = reviews.filter((r: Record<string, unknown>) => (r.rating as number) > 0);
        const ratingAvg = ratedReviews.length > 0
          ? Math.round(ratedReviews.reduce((s: number, r: Record<string, unknown>) => s + (r.rating as number), 0) / ratedReviews.length * 10) / 10
          : null;
        await kv.set(["rating", movieId], { avg: ratingAvg, count: ratedReviews.length });
        res = withCors(new Response(JSON.stringify(review), {
          headers: { "Content-Type": "application/json" },
        }));
      }
    } else {
      res = new Response("Method Not Allowed", { status: 405 });
    }
    res = withCors(res);
  } else if (url.pathname === "/api/reply" && req.method === "POST") {
    label = "KV-reply";
    const movieId = url.searchParams.get("id") || "";
    if (!movieId || !/^\\d{1,10}$/.test(movieId)) {
      res = new Response("Bad Request", { status: 400 });
    } else {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { body = {}; }
      const reviewTs = Number(body.reviewTs || 0);
      const uid      = String(body.uid     || "").slice(0, 64);
      const name     = String(body.name    || "Anonymous").slice(0, 60);
      const picture  = String(body.picture || "").slice(0, 300);
      const text     = String(body.text    || "").trim().slice(0, 500);
      if (!reviewTs || !uid || !text || !/^[a-z0-9_\-]{5,64}$/.test(uid)) {
        res = new Response("Bad Request", { status: 400 });
      } else {
        const entry   = await kv.get<unknown[]>(["reviews", movieId]);
        const reviews: Record<string, unknown>[] = Array.isArray(entry.value) ? [...entry.value as Record<string, unknown>[]] : [];
        const idx     = reviews.findIndex((r) => (r as Record<string, unknown>).ts === reviewTs);
        if (idx < 0) {
          res = new Response("Review not found", { status: 404 });
        } else {
          const review  = { ...(reviews[idx] as Record<string, unknown>) };
          const replies: Record<string, unknown>[] = Array.isArray(review.replies) ? [...review.replies as Record<string, unknown>[]] : [];
          const ridx    = replies.findIndex((r) => (r as Record<string, unknown>).uid === uid);
          const reply   = { uid, name, picture, text, ts: Date.now() };
          if (ridx >= 0) { replies[ridx] = reply; } else { replies.push(reply); }
          if (replies.length > 100) replies.length = 100;
          review.replies = replies;
          reviews[idx]   = review;
          await kv.set(["reviews", movieId], reviews);
          res = new Response(JSON.stringify(reply), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
    res = withCors(res);
  // ── Admin panel ───────────────────────────────────────────────────────────
  } else if (url.pathname === "/admin" || url.pathname === "/admin/") {
    label = "admin-ui";
    res = new Response(ADMIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } else if (url.pathname.startsWith("/admin/api")) {
    label = "admin-api";
    const adminKey = Deno.env.get("ADMIN_KEY") || "";
    const key      = url.searchParams.get("key") || "";
    if (!adminKey) {
      res = new Response(JSON.stringify({ error: "Set ADMIN_KEY in Deno Deploy environment variables." }), { status: 503, headers: { "Content-Type": "application/json" } });
    } else if (!key || key !== adminKey) {
      res = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    } else {
      const sub = url.pathname.slice("/admin/api".length).replace(/\\/+$/, "");
      if (sub === "/stats") {
        let movies = 0, reviews = 0, convos = 0, groups = 0, users = 0, online = 0;
        const topRated: { id: string; avg: string | null; count: number }[] = [];
        const now = Date.now();
        for await (const e of kv.list<unknown[]>({ prefix: ["reviews"] })) {
          movies++; reviews += (e.value as unknown[]).length;
        }
        for await (const _ of kv.list({ prefix: ["chat_msgs"] })) convos++;
        for await (const _ of kv.list({ prefix: ["group"] }))     groups++;
        for await (const _ of kv.list({ prefix: ["sync"] }))      users++;
        for await (const e of kv.list<{ ts: number; hidden: boolean }>({ prefix: ["presence"] })) {
          const v = e.value; if (v && (now - v.ts) < 180000) online++;
        }
        for await (const e of kv.list<{ avg: number | null; count: number }>({ prefix: ["rating"] })) {
          const v = e.value; if (v && v.count > 0) topRated.push({ id: String(e.key[1]), avg: v.avg ? v.avg.toFixed(1) : null, count: v.count });
        }
        topRated.sort((a, b) => parseFloat(b.avg || "0") - parseFloat(a.avg || "0"));
        res = new Response(JSON.stringify({ movies, reviews, convos, groups, users, online, topRated: topRated.slice(0, 10) }), { headers: { "Content-Type": "application/json" } });
      } else if (sub === "/reviews") {
        const out: { id: string; count: number; avg: string | null; lastTs: number }[] = [];
        for await (const e of kv.list<unknown[]>({ prefix: ["reviews"] })) {
          const id  = String(e.key[1]);
          const rs  = e.value as Record<string, unknown>[];
          const lts = rs.reduce((mx, r) => Math.max(mx, Number(r.ts) || 0), 0);
          const re  = await kv.get<{ avg: number | null; count: number }>(["rating", id]);
          out.push({ id, count: rs.length, avg: re.value?.avg ? re.value.avg.toFixed(1) : null, lastTs: lts });
        }
        out.sort((a, b) => b.count - a.count);
        res = new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
      } else if (sub.startsWith("/reviews/")) {
        const mid = sub.replace("/reviews/", "");
        if (req.method === "DELETE") {
          const uid = url.searchParams.get("uid") || "";
          const ts  = Number(url.searchParams.get("ts") || 0);
          const entry = await kv.get<unknown[]>(["reviews", mid]);
          const rs = (Array.isArray(entry.value) ? [...entry.value as Record<string,unknown>[]] : []).filter((r: Record<string,unknown>) => !(r.uid === uid && r.ts === ts));
          await kv.set(["reviews", mid], rs);
          const ratedRs = rs.filter((r: Record<string,unknown>) => (r.rating as number) > 0) as Record<string,unknown>[];
          const avg = ratedRs.length ? Math.round(ratedRs.reduce((s, r) => s + Number(r.rating), 0) / ratedRs.length * 10) / 10 : null;
          await kv.set(["rating", mid], { avg, count: ratedRs.length });
          res = new Response("OK");
        } else if (req.method === "PUT") {
          const uid = url.searchParams.get("uid") || "";
          const ts  = Number(url.searchParams.get("ts") || 0);
          let body: Record<string,unknown>; try { body = await req.json(); } catch { body = {}; }
          const newText   = String(body.text || "").trim().slice(0, 500);
          const newRating = Math.min(5, Math.max(1, Math.floor(Number(body.rating) || 1)));
          const entry = await kv.get<unknown[]>(["reviews", mid]);
          const rs = Array.isArray(entry.value) ? [...entry.value as Record<string,unknown>[]] : [];
          const idx = rs.findIndex((r: Record<string,unknown>) => r.uid === uid && r.ts === ts);
          if (idx < 0) { res = new Response("Not Found", { status: 404 }); }
          else {
            rs[idx] = { ...(rs[idx] as Record<string,unknown>), text: newText, rating: newRating, updatedAt: Date.now() };
            await kv.set(["reviews", mid], rs);
            const ratedRs = rs.filter((r: Record<string,unknown>) => (r.rating as number) > 0) as Record<string,unknown>[];
            const avg = ratedRs.length ? Math.round(ratedRs.reduce((s, r) => s + Number(r.rating), 0) / ratedRs.length * 10) / 10 : null;
            await kv.set(["rating", mid], { avg, count: ratedRs.length });
            res = new Response(JSON.stringify(rs[idx]), { headers: { "Content-Type": "application/json" } });
          }
        } else {
          const entry = await kv.get<unknown[]>(["reviews", mid]);
          res = new Response(JSON.stringify(entry.value ?? []), { headers: { "Content-Type": "application/json" } });
        }
      } else if (sub.startsWith("/chats/") && req.method === "DELETE") {
        const chatKey = decodeURIComponent(sub.replace("/chats/", ""));
        await kv.delete(["chat_msgs", chatKey]);
        const parts = chatKey.split("|");
        if (parts.length === 2) {
          await kv.delete(["chat_meta", parts[0], parts[1]]);
          await kv.delete(["chat_meta", parts[1], parts[0]]);
        }
        res = new Response("OK");
      } else if (sub.startsWith("/groups/") && req.method === "DELETE") {
        const gid = decodeURIComponent(sub.replace("/groups/", "")).toUpperCase();
        const gEntry = await kv.get<Record<string,unknown>>(["group", gid]);
        if (gEntry.value) {
          const members = (gEntry.value.members as Record<string,unknown>[]) || [];
          for (const m of members) {
            await kv.delete(["group_list", String((m as Record<string,unknown>).uid), gid]);
          }
        }
        await kv.delete(["group", gid]);
        await kv.delete(["group_msgs", gid]);
        res = new Response("OK");
      } else if (sub.startsWith("/users/") && req.method === "DELETE") {
        const delUid = decodeURIComponent(sub.replace("/users/", ""));
        await kv.delete(["sync", delUid]);
        res = new Response("OK");
      } else if (sub === "/chats") {
        const out: { key: string; count: number; lastMsg: string; lastTs: number }[] = [];
        for await (const e of kv.list<unknown[]>({ prefix: ["chat_msgs"] })) {
          const msgs = e.value as Record<string,unknown>[];
          const last = msgs.length ? msgs[msgs.length - 1] as Record<string,unknown> : null;
          out.push({ key: String(e.key[1]), count: msgs.length, lastMsg: last ? String(last.text || "").slice(0, 60) : "", lastTs: last ? Number(last.ts) || 0 : 0 });
        }
        out.sort((a, b) => b.lastTs - a.lastTs);
        res = new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
      } else if (sub === "/groups") {
        const out: Record<string, unknown>[] = [];
        for await (const e of kv.list<Record<string,unknown>>({ prefix: ["group"] })) {
          const g = e.value; const gid = String(e.key[1]);
          const me = await kv.get<unknown[]>(["group_msgs", gid]);
          out.push({ id: g.id, name: g.name, memberCount: (g.members as unknown[]).length, msgCount: (me.value || []).length, ts: g.ts });
        }
        out.sort((a, b) => Number(b.ts) - Number(a.ts));
        res = new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
      } else if (sub === "/users") {
        const out: Record<string, unknown>[] = [];
        for await (const e of kv.list<Record<string,unknown>>({ prefix: ["sync"] })) {
          const uid = String(e.key[1]); const d = e.value;
          const p = d.profile as Record<string,unknown> | null;
          out.push({ uid, name: p?.name || uid.slice(0, 16) + "…", email: p?.email || "", picture: p?.picture || "", favCount: Array.isArray(d.favourites) ? (d.favourites as unknown[]).length : 0, wlCount: Array.isArray(d.watchlist) ? (d.watchlist as unknown[]).length : 0, ts: d.ts });
        }
        out.sort((a, b) => Number(b.ts) - Number(a.ts));
        res = new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
      } else if (sub === "/online") {
        const now = Date.now();
        const onl: Record<string,unknown>[] = [], wat: Record<string,unknown>[] = [];
        for await (const e of kv.list<{ ts: number; hidden: boolean }>({ prefix: ["presence"] })) {
          const v = e.value; if (v && (now - v.ts) < 180000) onl.push({ uid: e.key[1], ts: v.ts, hidden: v.hidden });
        }
        for await (const e of kv.list<{ uid: string; name: string; movieId: string; movieTitle: string; ts: number; hidden: boolean }>({ prefix: ["watching"] })) {
          const v = e.value; if (v && !v.hidden && (now - v.ts) < 300000) wat.push({ uid: v.uid, name: v.name, movieId: e.key[1], movieTitle: v.movieTitle, ts: v.ts });
        }
        res = new Response(JSON.stringify({ online: onl, watching: wat }), { headers: { "Content-Type": "application/json" } });
      } else {
        res = new Response("Not Found", { status: 404 });
      }
    }
  } else if (url.pathname === "/manifest.json") {
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

const outPath  = path.join(ROOT, 'nexplay-single.ts');
const mainPath = path.join(ROOT, 'main.ts');
const srcDir   = path.join(ROOT, 'src');
const srcMain  = path.join(srcDir, 'main.ts');
fs.writeFileSync(outPath, denoScript, 'utf8');
fs.copyFileSync(outPath, mainPath);
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);
fs.copyFileSync(outPath, srcMain);                     // Deno Deploy looks in src/

const sizeKB  = Math.round(fs.statSync(outPath).size / 1024);
console.log(`\nDone!  nexplay-single.ts + main.ts  (${sizeKB} KB)`);
console.log('Deno Deploy limit: 1024 KB');
if (sizeKB > 900) console.warn('WARNING: File is close to the 1 MB Deno Deploy limit.');
console.log('\nDeploy:');
console.log('  deno deploy --entrypoint=main.ts');

})().catch(err => { console.error('Build failed:', err); process.exit(1); });
