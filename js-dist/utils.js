"use strict";

// ── Shared UI helpers used across page modules ───────────────────────────────
var UX = function () {
  var PROGRESS_MIN_MS = 5000;
  var PROGRESS_CAP_PCT = 98;
  var WL_BADGE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11">' + '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  function fillProgressBars(container) {
    if (typeof NexPlayDB === 'undefined') return;
    (container || document).querySelectorAll('[id^="cprog-"]').forEach(function (el) {
      var id = el.id.replace('cprog-', '');
      var saved = NexPlayDB.getProgress(id, 'movie') || NexPlayDB.getProgress(id, 'tv');
      if (saved && saved.position > PROGRESS_MIN_MS && saved.duration > 0) {
        var pct = Math.min(PROGRESS_CAP_PCT, saved.position / saved.duration * 100).toFixed(0);
        el.innerHTML = '<div style="width:' + pct + '%;height:100%;background:var(--accent);border-radius:0 2px 0 0;"></div>';
      }
    });
  }
  function badgesHTML(id, type) {
    if (typeof NexPlayDB === 'undefined') return '';
    var fav = NexPlayDB.isFavourite(id, type);
    var wl = NexPlayDB.isInWatchlist(id, type);
    return (fav ? '<span class="card-badge card-badge-fav">&#9829;</span>' : '') + (wl ? '<span class="card-badge card-badge-wl">' + WL_BADGE_SVG + '</span>' : '');
  }
  function skeletonCards(count) {
    return Array.from({
      length: count || 12
    }, function () {
      return '<div class="card"><div class="card-poster skeleton"></div>' + '<div class="card-info">' + '<div class="skeleton" style="height:14px;width:80%;margin-bottom:6px;border-radius:4px;"></div>' + '<div class="skeleton" style="height:12px;width:40%;border-radius:4px;"></div>' + '</div></div>';
    }).join('');
  }
  return {
    fillProgressBars: fillProgressBars,
    badgesHTML: badgesHTML,
    skeletonCards: skeletonCards
  };
}();