const WatchlistPage = (() => {
  let _keyHandler = null;

  function itemCard(item, isFirst) {
    const poster = item.poster
      ? `<img src="${item.poster}" alt="${item.title}" loading="lazy">`
      : `<div class="no-img">${item.type === 'tv' ? '📺' : '🎬'}</div>`;
    return `
      <div class="card" data-nav data-item-id="${item.id}" data-item-type="${item.type}"
           data-item-title="${(item.title || '').replace(/"/g, '&quot;')}"
           data-item-poster="${item.poster || ''}"
           ${isFirst ? 'data-nav-default' : ''} tabindex="0">
        <div class="card-poster">
          ${poster}
          <div class="card-badges" id="badges-${item.id}">
            ${UX.badgesHTML(item.id, item.type)}
          </div>
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>`;
  }

  function bindCardClicks(container) {
    container.querySelectorAll('[data-item-id]').forEach(function(el) {
      el.addEventListener('click', function() {
        App.navigate('player', { id: el.dataset.itemId, type: el.dataset.itemType, season: 1, episode: 1, playlist: 'watchlist' });
      });
    });
  }

  function bindRemoteKeys() {
    _keyHandler = function(e) {
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused[data-item-id]');
      if (!focused || !focused.dataset.itemId) return;
      var id     = focused.dataset.itemId;
      var type   = focused.dataset.itemType   || 'movie';
      var title  = focused.dataset.itemTitle  || '';
      var poster = focused.dataset.itemPoster || '';

      if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        NexPlayDB.toggleWatchlist(id, type, title, poster);
        App.showToast('Removed from Watchlist');
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
        var content = document.getElementById('main-content');
        if (content) render(content);
      } else if (e.keyCode === Config.KEYS.YELLOW) {
        e.preventDefault();
        App.navigate('detail', { id: id, type: type });
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }

  function unbindRemoteKeys() {
    if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }

  function render(container) {
    var items = typeof NexPlayDB !== 'undefined' ? NexPlayDB.getWatchlist() : [];

    container.innerHTML = `
      <div id="watchlist-page">
        <div class="page-header">
          <h1 class="page-title">Watchlist</h1>
        </div>
        ${items.length === 0
          ? `<div class="list-empty-state">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" style="opacity:0.25;margin-bottom:20px;">
                 <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
               </svg>
               <p>Your watchlist is empty.</p>
               <p style="font-size:16px;opacity:0.55;margin-top:8px;">Press BLUE on any movie or series card to save it here.</p>
             </div>`
          : `<div class="movie-grid" id="watchlist-grid">
               ${items.map(function(item, i) { return itemCard(item, i === 0); }).join('')}
             </div>`}
      </div>`;

    Nav.reset(container);
    if (items.length > 0) bindCardClicks(container);
    bindRemoteKeys();
  }

  function onLeave() { unbindRemoteKeys(); }

  return { render: render, onLeave: onLeave };
})();
