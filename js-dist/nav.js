"use strict";

/*
 * NexPlay Spatial Navigation
 * Handles TV remote D-pad navigation by finding the closest focusable
 * element in the pressed direction using element bounding rects.
 */
var Nav = function () {
  var FOCUSABLE = '[data-nav]';
  var _current = null;
  function all() {
    // Dropdown open — lock nav inside it
    var openDD = document.querySelector('.tdd-wrapper.open');
    if (openDD) {
      return Array.from(openDD.querySelectorAll(FOCUSABLE)).filter(function (el) {
        return el.offsetParent !== null && !el.hasAttribute('disabled');
      });
    }
    // Player modal open — lock nav inside modal only (prevents ghost focus on hidden sidebar/content)
    var modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      return Array.from(modal.querySelectorAll(FOCUSABLE)).filter(function (el) {
        return el.offsetParent !== null && !el.hasAttribute('disabled');
      });
    }
    return Array.from(document.querySelectorAll(FOCUSABLE)).filter(function (el) {
      return el.offsetParent !== null && !el.hasAttribute('disabled');
    });
  }
  function rect(el) {
    return el.getBoundingClientRect();
  }
  function center(r) {
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    };
  }
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Filter candidates that lie in the given direction and rank by proximity.
  function bestIn(direction, from) {
    var fr = rect(from);
    var fc = center(fr);
    var THRESHOLD = 5; // px overlap tolerance

    var candidates = all().filter(function (el) {
      return el !== from;
    }).filter(function (el) {
      var er = rect(el);
      switch (direction) {
        case 'right':
          return er.left >= fr.right - THRESHOLD;
        case 'left':
          return er.right <= fr.left + THRESHOLD;
        case 'down':
          return er.top >= fr.bottom - THRESHOLD;
        case 'up':
          return er.bottom <= fr.top + THRESHOLD;
      }
    });
    if (!candidates.length) return null;

    // Primary sort: distance along the axis; secondary: perpendicular distance
    return candidates.sort(function (a, b) {
      var ar = rect(a),
        br = rect(b);
      var ac = center(ar),
        bc = center(br);
      var aDist = dist(fc, ac);
      var bDist = dist(fc, bc);
      return aDist - bDist;
    })[0];
  }
  function setFocus(el) {
    if (!el) return;
    if (_current) _current.classList.remove('nav-focused');
    _current = el;
    el.classList.add('nav-focused');
    el.focus({
      preventScroll: true
    });
    scrollIntoView(el);
    el.dispatchEvent(new CustomEvent('nav:focus', {
      bubbles: true
    }));
  }
  function scrollIntoView(el) {
    var scroller = el.closest('[data-scroll]');
    if (scroller) {
      var er = rect(el);
      var sr = rect(scroller);
      // Horizontal scroll (card rows) — wider margin so the full card is visible
      if (er.left < sr.left + 60) {
        scroller.scrollLeft -= sr.left - er.left + 80;
      } else if (er.right > sr.right - 60) {
        scroller.scrollLeft += er.right - sr.right + 80;
      }
      // Vertical scroll (episode list, similar/watchlist panel)
      if (er.top < sr.top + 20) {
        scroller.scrollTop -= sr.top - er.top + 40;
      } else if (er.bottom > sr.bottom - 20) {
        scroller.scrollTop += er.bottom - sr.bottom + 40;
      }
    }
    var pageScroll = document.getElementById('main-content');
    if (pageScroll) {
      // Hero elements: always snap to top so the full hero backdrop and title show
      if (el.closest('#hero-wrapper')) {
        pageScroll.scrollTop = 0;
        return;
      }
      var _er = rect(el);
      var vH = window.innerHeight;
      if (_er.bottom > vH - 80) {
        pageScroll.scrollTop += _er.bottom - vH + 100;
      } else if (_er.top < 80) {
        pageScroll.scrollTop -= 80 - _er.top + 40;
      }
    }
  }
  function navigate(direction) {
    if (!_current) {
      var first = all()[0];
      if (first) setFocus(first);
      return;
    }
    var next = bestIn(direction, _current);
    if (next) setFocus(next);
  }
  function onKey(e) {
    switch (e.keyCode) {
      case Config.KEYS.UP:
        e.preventDefault();
        navigate('up');
        break;
      case Config.KEYS.DOWN:
        e.preventDefault();
        navigate('down');
        break;
      case Config.KEYS.LEFT:
        e.preventDefault();
        navigate('left');
        break;
      case Config.KEYS.RIGHT:
        e.preventDefault();
        navigate('right');
        break;
      case Config.KEYS.ENTER:
        if (_current) {
          e.preventDefault();
          _current.click();
        }
        break;
      case Config.KEYS.BACK:
      case Config.KEYS.ESCAPE:
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('nav:back'));
        break;
    }
  }
  function init() {
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', function (e) {
      var el = e.target.closest(FOCUSABLE);
      // Skip nav-page items — navigate() handles focus for page transitions
      // so we don't re-expand the sidebar after it was collapsed by navigate()
      if (el && !el.dataset.navPage) setFocus(el);
    });
  }

  // After a page renders, focus the default element (first or marked default)
  function reset(container) {
    // Remove nav-focused from current element before clearing — prevents stale class
    // staying on sidebar items when player opens and confusing the player key listener.
    if (_current) _current.classList.remove('nav-focused');
    _current = null;
    var preferred = (container || document).querySelector('[data-nav-default]');
    // Prefer elements inside the container — avoids focusing the main sidebar
    // nav items which would expand the sidebar unexpectedly
    var inContainer = container ? all().filter(function (el) {
      return container.contains(el);
    })[0] : null;
    var first = preferred || inContainer || all()[0];
    if (first) setTimeout(function () {
      return setFocus(first);
    }, 50);
  }
  function focusEl(el) {
    if (el) setFocus(el);
  }
  function current() {
    return _current;
  }
  return {
    init: init,
    reset: reset,
    focusEl: focusEl,
    navigate: navigate,
    current: current
  };
}();