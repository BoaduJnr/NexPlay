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
      var type = el.dataset.type || 'movie';
      if (type === 'tv') {
        // Find the most recently watched episode for this series
        var allProgress = NexPlayDB.getContinueWatching(200);
        var seriesProgress = allProgress.filter(function (p) {
          return String(p.id) === String(id) && p.type === 'tv';
        });
        if (!seriesProgress.length) return;
        var latest = seriesProgress[0]; // sorted by updatedAt desc
        var pct = latest.duration > 0 ? Math.min(PROGRESS_CAP_PCT, latest.position / latest.duration * 100).toFixed(0) : 50;
        // Progress bar at bottom + episode badge
        el.innerHTML = '<div class="card-prog-fill" style="width:' + pct + '%"></div>';
        // Attach episode chip to poster (remove old one first)
        var poster = el.parentElement;
        if (poster) {
          var old = poster.querySelector('.ep-badge');
          if (old) old.parentNode.removeChild(old);
          if (latest.season && latest.episode) {
            var badge = document.createElement('div');
            badge.className = 'ep-badge';
            badge.style.cssText = 'position:absolute;bottom:8px;left:6px;background:rgba(0,0,0,0.78);color:rgba(255,255,255,0.92);font-size:9px;font-weight:800;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;z-index:5;line-height:1.2;';
            badge.textContent = 'S' + latest.season + 'E' + latest.episode;
            poster.appendChild(badge);
          }
        }
      } else {
        // Movie: progress bar showing % watched
        var saved = NexPlayDB.getProgress(id, 'movie');
        if (saved && saved.position > PROGRESS_MIN_MS && saved.duration > 0) {
          var pct = Math.min(PROGRESS_CAP_PCT, saved.position / saved.duration * 100).toFixed(0);
          el.innerHTML = '<div class="card-prog-fill" style="width:' + pct + '%"></div>';
        }
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

  // ── Mobile card action buttons — delegated handler ───────────────────────────
  // Capture phase fires before the card's own click (which navigates to player).
  // Handles ♥ fav and 🔖 watchlist buttons on movie/series cards on touch/web.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.card-action-btn');
    if (!btn) return;
    e.stopPropagation();
    var card = btn.closest('[data-movie-id],[data-show-id]');
    if (!card) return;
    var isShow = !!card.dataset.showId;
    var id = isShow ? card.dataset.showId : card.dataset.movieId;
    var type = isShow ? 'tv' : 'movie';
    var title = isShow ? card.dataset.showTitle || '' : card.dataset.movieTitle || '';
    var poster = isShow ? card.dataset.showPoster || '' : card.dataset.moviePoster || '';
    var action = btn.dataset.action;
    if (action === 'info') {
      if (typeof App !== 'undefined') App.navigate('detail', {
        id: id,
        type: type
      });
      return;
    }
    if (typeof NexPlayDB === 'undefined') return;
    if (action === 'fav') {
      var added = NexPlayDB.toggleFavourite(id, type, title, poster);
      btn.classList.toggle('fav-active', added);
      btn.textContent = added ? '♥' : '♡';
      if (typeof App !== 'undefined') App.showToast(added ? '♥ Added to Favourites' : '♡ Removed from Favourites');
      var b = document.getElementById('badges-' + id);
      if (b) b.innerHTML = badgesHTML(id, type);
    } else if (action === 'wl') {
      var addedWL = NexPlayDB.toggleWatchlist(id, type, title, poster);
      btn.classList.toggle('wl-active', addedWL);
      if (typeof App !== 'undefined') App.showToast(addedWL ? '+ Added to Watchlist' : 'Removed from Watchlist');
      var b2 = document.getElementById('badges-' + id);
      if (b2) b2.innerHTML = badgesHTML(id, type);
    }
  }, true); // capture phase

  return {
    fillProgressBars: fillProgressBars,
    badgesHTML: badgesHTML,
    skeletonCards: skeletonCards
  };
}();