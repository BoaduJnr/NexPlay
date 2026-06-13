const FavouritesPage = (() => {
  let _keyHandler = null;

  function itemCard(item, isFirst) {
    const poster = item.poster
      ? `<img src="${item.poster}" alt="${item.title}" loading="lazy">`
      : `<div class="no-img">${item.type === 'tv' ? '📺' : '🎬'}</div>`;
    const rating = item.rating ? item.rating.toFixed(1) : '';
    const isTV   = item.type === 'tv';
    const typeAttrs = isTV
      ? `data-show-id="${item.id}" data-show-title="${(item.title || '').replace(/"/g, '&quot;')}" data-show-poster="${item.poster || ''}" data-show-rating="${item.rating || 0}"`
      : `data-movie-id="${item.id}" data-movie-title="${(item.title || '').replace(/"/g, '&quot;')}" data-movie-poster="${item.poster || ''}" data-movie-rating="${item.rating || 0}"`;
    const badgesClass = isTV ? 'card-badges card-badges--below' : 'card-badges';
    const isFav = typeof NexPlayDB !== 'undefined' && NexPlayDB.isFavourite(item.id, item.type);
    const isWL  = typeof NexPlayDB !== 'undefined' && NexPlayDB.isInWatchlist(item.id, item.type);
    return `
      <div class="card" data-nav data-item-id="${item.id}" data-item-type="${item.type}"
           data-item-title="${(item.title || '').replace(/"/g, '&quot;')}"
           data-item-poster="${item.poster || ''}"
           ${typeAttrs}
           ${isFirst ? 'data-nav-default' : ''} tabindex="0">
        <div class="card-poster">
          ${poster}
          ${rating ? `<div class="card-rating">★ ${rating}</div>` : ''}
          <div class="${badgesClass}" id="badges-${item.id}">
            ${UX.badgesHTML(item.id, item.type)}
          </div>
          <div class="card-overlay"></div>
          <div class="card-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="card-mobile-actions">
            <button class="card-action-btn" data-action="info" title="More Info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></button>
            <button class="card-action-btn${isFav ? ' fav-active' : ''}" data-action="fav" title="Favourite">${isFav ? '♥' : '♡'}</button>
            <button class="card-action-btn${isWL ? ' wl-active' : ''}" data-action="wl" title="Watchlist"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
          </div>
          <div class="card-ia-rating card-ia-na" id="ia-${item.id}" title="No NexPlay ratings yet">N/A</div>
          <div class="card-prog" id="cprog-${item.id}" data-type="${item.type}"></div>
        </div>
      </div>`;
  }

  function bindCardClicks(container) {
    container.querySelectorAll('[data-item-id]').forEach(function(el) {
      el.addEventListener('click', function() {
        App.navigate('player', { id: el.dataset.itemId, type: el.dataset.itemType, season: 1, episode: 1 });
      });
    });
  }

  function bindRemoteKeys() {
    _keyHandler = function(e) {
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused[data-item-id]');
      if (!focused || !focused.dataset.itemId) return;
      var id    = focused.dataset.itemId;
      var type  = focused.dataset.itemType  || 'movie';
      var title = focused.dataset.itemTitle || '';
      var poster = focused.dataset.itemPoster || '';

      if (e.keyCode === Config.KEYS.RED) {
        e.preventDefault();
        NexPlayDB.toggleFavourite(id, type, title, poster);
        App.showToast('Removed from Favourites');
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
    var items = typeof NexPlayDB !== 'undefined'
      ? NexPlayDB.getFavourites().filter(function(f) { return f.type !== 'channel'; })
      : [];

    container.innerHTML = `
      <div id="favourites-page">
        <div class="page-header">
          <h1 class="page-title">Favourites</h1>
        </div>
        ${items.length === 0
          ? `<div class="list-empty-state">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" style="opacity:0.25;margin-bottom:20px;">
                 <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
               </svg>
               <p>No favourites yet.</p>
               <p style="font-size:16px;opacity:0.55;margin-top:8px;">Press RED on any movie or series card to save it here.</p>
             </div>`
          : `<div class="movie-grid" id="favourites-grid">
               ${items.map(function(item, i) { return itemCard(item, i === 0); }).join('')}
             </div>`}
      </div>`;

    Nav.reset(container);
    if (items.length > 0) {
      bindCardClicks(container);
      UX.fillProgressBars(container);
      UX.fetchInAppRatings(items.map(function(i) { return String(i.id); }));
    }
    bindRemoteKeys();
  }

  function onLeave() { unbindRemoteKeys(); }

  return { render: render, onLeave: onLeave };
})();
