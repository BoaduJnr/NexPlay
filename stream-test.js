const { chromium } = require('playwright');

async function testItem(page, logs, params, label) {
  logs.length = 0;
  console.log('\n══ ' + label + ' ══');

  await page.evaluate(function(p) { App.navigate('player', p); }, params);

  var result = 'timeout';
  for (var i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    var status = await page.evaluate(function() {
      var el = document.getElementById('player-status');
      return el ? el.textContent.trim() : '(gone)';
    });
    var area = await page.evaluate(function() {
      var el = document.getElementById('avplay-area');
      if (!el) return '(no avplay-area)';
      var iframe = el.querySelector('iframe');
      if (iframe) return 'IFRAME:' + iframe.src.slice(0, 90);
      var video = el.querySelector('video');
      if (video) return 'VIDEO:src=' + (video.src || '').slice(0, 60) + ' readyState=' + video.readyState;
      return 'HTML:' + el.innerHTML.slice(0, 60).replace(/\s+/g, ' ');
    });
    console.log('  t+' + ((i + 1) * 2) + 's | status=[' + status + '] | ' + area);

    if (area.indexOf('IFRAME:') !== -1)          { result = 'iframe-fallback'; break; }
    if (area.indexOf('readyState=4') !== -1)      { result = 'video-loaded';   break; }
    if (area.indexOf('readyState=3') !== -1)      { result = 'video-playing';  break; }
    if (status === '' || status === 'Paused')      { result = 'playing';        break; }
    if (status.indexOf('unavailable') !== -1)     { result = 'unavailable';    break; }
  }

  // Key resolver logs
  var resolverLogs = logs.filter(function(l) {
    return l.indexOf('[StreamResolver]') !== -1 || l.indexOf('[Player] stream') !== -1
        || l.indexOf('mediaType') !== -1 || l.indexOf('CORS') !== -1
        || l.indexOf('Vidrock') !== -1  || l.indexOf('Videasy') !== -1;
  });
  resolverLogs.forEach(function(l) { console.log('  ' + l); });

  // Check mediaType in the outgoing XHR (capture in logs via interceptor)
  var mediaTypeSent = await page.evaluate(function() {
    return window.__lastVideasyMediaType || '(not captured)';
  });
  console.log('  mediaType sent to Videasy: ' + mediaTypeSent);
  console.log('  → result: ' + result);
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', function(m) {
    var txt = m.text();
    if (m.type() === 'error' || txt.indexOf('[Stream') !== -1 || txt.indexOf('[Player') !== -1)
      logs.push('[' + m.type().toUpperCase() + '] ' + txt);
  });

  // Intercept XHR to capture mediaType parameter sent to Videasy
  await page.route('**/api.videasy.net/**', function(route) {
    var url = route.request().url();
    var m = url.match(/[?&]mediaType=([^&]+)/);
    page.evaluate(function(v) { window.__lastVideasyMediaType = v; }, m ? m[1] : 'not-found').catch(function(){});
    route.continue();
  });

  await page.goto('http://127.0.0.1:7700/index.html', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  var summary = {};

  // ── Test 1: Movie ──────────────────────────────────────────────────────────
  await page.evaluate(function() { App.navigate('movies'); });
  await page.waitForTimeout(5000);
  var cards = await page.$$('[data-movie-id]');
  if (!cards.length) { console.log('ERROR: no movie cards'); await browser.close(); return; }
  var movieId = await cards[0].getAttribute('data-movie-id');
  var movieTitle = await cards[0].getAttribute('data-movie-title') || movieId;
  summary.movie = await testItem(page, logs,
    { id: movieId, type: 'movie' },
    'Movie: ' + movieTitle + ' (' + movieId + ')');

  // Close player
  await page.evaluate(function() {
    if (typeof PlayerPage !== 'undefined') PlayerPage.closePlayer();
  });
  await page.waitForTimeout(1000);

  // ── Test 2: TV show (Breaking Bad S1E1, tmdbId=1396) ──────────────────────
  summary.tv = await testItem(page, logs,
    { id: '1396', type: 'tv', season: 1, episode: 1 },
    'TV: Breaking Bad S01E01 (1396)');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══ SUMMARY ══');
  Object.keys(summary).forEach(function(k) {
    var icon = summary[k] === 'unavailable' || summary[k] === 'timeout' ? '✗' : '✓';
    console.log('  ' + icon + ' ' + k + ': ' + summary[k]);
  });

  await browser.close();
  process.exit(0);
})().catch(function(e) { console.error(e.message); process.exit(1); });
