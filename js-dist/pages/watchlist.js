"use strict";

var WatchlistPage = function () {
  var _keyHandler = null;
  function itemCard(item, isFirst) {
    var poster = item.poster ? "<img src=\"".concat(item.poster, "\" alt=\"").concat(item.title, "\" loading=\"lazy\">") : "<div class=\"no-img\">".concat(item.type === 'tv' ? '📺' : '🎬', "</div>");
    return "\n      <div class=\"card\" data-nav data-item-id=\"".concat(item.id, "\" data-item-type=\"").concat(item.type, "\"\n           data-item-title=\"").concat((item.title || '').replace(/"/g, '&quot;'), "\"\n           data-item-poster=\"").concat(item.poster || '', "\"\n           ").concat(isFirst ? 'data-nav-default' : '', " tabindex=\"0\">\n        <div class=\"card-poster\">\n          ").concat(poster, "\n          <div class=\"card-overlay\"></div>\n          <div class=\"card-play-icon\">\n            <svg viewBox=\"0 0 24 24\" fill=\"white\" width=\"18\" height=\"18\"><path d=\"M8 5v14l11-7z\"/></svg>\n          </div>\n        </div>\n      </div>");
  }
  function bindCardClicks(container) {
    container.querySelectorAll('[data-item-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        App.navigate('player', {
          id: el.dataset.itemId,
          type: el.dataset.itemType,
          season: 1,
          episode: 1,
          playlist: 'watchlist'
        });
      });
    });
  }
  function bindRemoteKeys() {
    _keyHandler = function _keyHandler(e) {
      var focused = Nav.current() || document.querySelector('[data-nav].nav-focused[data-item-id]');
      if (!focused || !focused.dataset.itemId) return;
      var id = focused.dataset.itemId;
      var type = focused.dataset.itemType || 'movie';
      var title = focused.dataset.itemTitle || '';
      var poster = focused.dataset.itemPoster || '';
      if (e.keyCode === Config.KEYS.BLUE) {
        e.preventDefault();
        NexPlayDB.toggleWatchlist(id, type, title, poster);
        App.showToast('Removed from Watchlist');
        var content = document.getElementById('main-content');
        if (content) render(content);
      } else if (e.keyCode === Config.KEYS.YELLOW) {
        e.preventDefault();
        App.navigate('detail', {
          id: id,
          type: type
        });
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
    container.innerHTML = "\n      <div id=\"watchlist-page\">\n        <div class=\"page-header\">\n          <h1 class=\"page-title\">Watchlist</h1>\n        </div>\n        ".concat(items.length === 0 ? "<div class=\"list-empty-state\">\n               <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" width=\"64\" height=\"64\" style=\"opacity:0.25;margin-bottom:20px;\">\n                 <path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"/>\n               </svg>\n               <p>Your watchlist is empty.</p>\n               <p style=\"font-size:16px;opacity:0.55;margin-top:8px;\">Press BLUE on any movie or series card to save it here.</p>\n             </div>" : "<div class=\"movie-grid\" id=\"watchlist-grid\">\n               ".concat(items.map(function (item, i) {
      return itemCard(item, i === 0);
    }).join(''), "\n             </div>"), "\n      </div>");
    Nav.reset(container);
    if (items.length > 0) bindCardClicks(container);
    bindRemoteKeys();
  }
  function onLeave() {
    unbindRemoteKeys();
  }
  return {
    render: render,
    onLeave: onLeave
  };
}();