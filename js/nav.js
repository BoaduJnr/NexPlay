/*
 * NexPlay Spatial Navigation
 * Handles TV remote D-pad navigation by finding the closest focusable
 * element in the pressed direction using element bounding rects.
 */
const Nav = (() => {
  const FOCUSABLE = '[data-nav]';
  let _current = null;

  function all() {
    // Dropdown open — lock nav inside it
    const openDD = document.querySelector('.tdd-wrapper.open');
    if (openDD) {
      return Array.from(openDD.querySelectorAll(FOCUSABLE)).filter(
        function(el) { return el.offsetParent !== null && !el.hasAttribute('disabled'); }
      );
    }
    // Player modal open — lock nav inside modal only (prevents ghost focus on hidden sidebar/content)
    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      return Array.from(modal.querySelectorAll(FOCUSABLE)).filter(
        function(el) { return el.offsetParent !== null && !el.hasAttribute('disabled'); }
      );
    }
    return Array.from(document.querySelectorAll(FOCUSABLE)).filter(
      function(el) { return el.offsetParent !== null && !el.hasAttribute('disabled'); }
    );
  }

  function rect(el) {
    return el.getBoundingClientRect();
  }

  function center(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Filter candidates that lie in the given direction and rank by proximity.
  function bestIn(direction, from) {
    const fr = rect(from);
    const fc = center(fr);
    const THRESHOLD = 5; // px overlap tolerance

    const candidates = all()
      .filter(el => el !== from)
      .filter(el => {
        const er = rect(el);
        switch (direction) {
          case 'right': return er.left >= fr.right - THRESHOLD;
          case 'left':  return er.right <= fr.left + THRESHOLD;
          case 'down':  return er.top >= fr.bottom - THRESHOLD;
          case 'up':    return er.bottom <= fr.top + THRESHOLD;
        }
      });

    if (!candidates.length) return null;

    // Primary sort: distance along the axis; secondary: perpendicular distance
    return candidates.sort((a, b) => {
      const ar = rect(a), br = rect(b);
      const ac = center(ar), bc = center(br);
      const aDist = dist(fc, ac);
      const bDist = dist(fc, bc);
      return aDist - bDist;
    })[0];
  }

  function setFocus(el) {
    if (!el) return;
    if (_current) _current.classList.remove('nav-focused');
    _current = el;
    el.classList.add('nav-focused');
    el.focus({ preventScroll: true });
    scrollIntoView(el);
    el.dispatchEvent(new CustomEvent('nav:focus', { bubbles: true }));
  }

  function scrollIntoView(el) {
    const scroller = el.closest('[data-scroll]');
    if (scroller) {
      const er = rect(el);
      const sr = rect(scroller);
      if (er.left < sr.left + 40) {
        scroller.scrollLeft -= sr.left - er.left + 60;
      } else if (er.right > sr.right - 40) {
        scroller.scrollLeft += er.right - sr.right + 60;
      }
    }

    const pageScroll = document.getElementById('main-content');
    if (pageScroll) {
      const er = rect(el);
      const vH = window.innerHeight;
      if (er.bottom > vH - 80) {
        pageScroll.scrollTop += er.bottom - vH + 100;
      } else if (er.top < 80) {
        pageScroll.scrollTop -= 80 - er.top + 40;
      }
    }
  }

  function navigate(direction) {
    if (!_current) {
      const first = all()[0];
      if (first) setFocus(first);
      return;
    }
    const next = bestIn(direction, _current);
    if (next) setFocus(next);
  }

  function onKey(e) {
    switch (e.keyCode) {
      case Config.KEYS.UP:    e.preventDefault(); navigate('up');    break;
      case Config.KEYS.DOWN:  e.preventDefault(); navigate('down');  break;
      case Config.KEYS.LEFT:  e.preventDefault(); navigate('left');  break;
      case Config.KEYS.RIGHT: e.preventDefault(); navigate('right'); break;
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
    document.addEventListener('click', e => {
      const el = e.target.closest(FOCUSABLE);
      // Skip nav-page items — navigate() handles focus for page transitions
      // so we don't re-expand the sidebar after it was collapsed by navigate()
      if (el && !el.dataset.navPage) setFocus(el);
    });
  }

  // After a page renders, focus the default element (first or marked default)
  function reset(container) {
    _current = null;
    const preferred = (container || document).querySelector('[data-nav-default]');
    // Prefer elements inside the container — avoids focusing the main sidebar
    // nav items which would expand the sidebar unexpectedly
    const inContainer = container
      ? all().filter(el => container.contains(el))[0]
      : null;
    const first = preferred || inContainer || all()[0];
    if (first) setTimeout(() => setFocus(first), 50);
  }

  function focusEl(el) { if (el) setFocus(el); }
  function current() { return _current; }

  return { init, reset, focusEl, navigate, current };
})();
