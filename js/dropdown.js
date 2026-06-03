/*
 * TVDropdown — custom TV-friendly dropdown that works cleanly
 * with D-pad navigation instead of native <select>.
 *
 * Usage:
 *   const dd = TVDropdown.create({
 *     id: 'sort-dd',
 *     options: [{ value: 'x', label: 'X' }, ...],
 *     selected: 'x',
 *     onChange: (value) => { ... },
 *   });
 *   container.innerHTML += dd.html();
 *   dd.mount();
 *
 * Or inline:
 *   TVDropdown.html(id, options, selected) → HTML string
 *   TVDropdown.mount(id, onChange)         → wire up events
 */
const TVDropdown = (() => {
  const _instances = {};

  function html(id, options, selected) {
    const current = options.find(o => o.value === selected) || options[0];
    const opts = options.map(o => `
      <div class="tdd-option ${o.value === selected ? 'selected' : ''}"
        data-nav data-tdd-opt="${id}" data-value="${o.value}" tabindex="0">
        ${o.value === selected
          ? `<svg class="tdd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
               <polyline points="20 6 9 17 4 12"/>
             </svg>`
          : `<span class="tdd-check-placeholder"></span>`}
        <span>${o.label}</span>
      </div>`).join('');

    return `
      <div class="tdd-wrapper" id="tdd-wrap-${id}">
        <button class="tdd-trigger" data-nav data-tdd-trigger="${id}" tabindex="0">
          <span id="tdd-label-${id}">${current ? current.label : ''}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="tdd-list hidden" id="tdd-list-${id}">
          ${opts}
        </div>
      </div>`;
  }

  function mount(id, onChange) {
    const wrap    = document.getElementById(`tdd-wrap-${id}`);
    const trigger = wrap && wrap.querySelector(`[data-tdd-trigger="${id}"]`);
    const list    = document.getElementById(`tdd-list-${id}`);
    if (!wrap || !trigger || !list) return;

    function open() {
      // Close any other open dropdown first
      document.querySelectorAll('.tdd-wrapper.open').forEach(function(other) {
        if (other !== wrap) {
          var otherList = other.querySelector('.tdd-list');
          if (otherList) otherList.classList.add('hidden');
          other.classList.remove('open');
        }
      });
      list.classList.remove('hidden');
      wrap.classList.add('open');
      const sel = list.querySelector('.tdd-option.selected') || list.querySelector('.tdd-option');
      if (sel) Nav.focusEl(sel);
    }

    function close() {
      list.classList.add('hidden');
      wrap.classList.remove('open');
      Nav.focusEl(trigger);
    }

    trigger.addEventListener('click', () => {
      if (wrap.classList.contains('open')) { close(); } else { open(); }
    });

    list.querySelectorAll(`[data-tdd-opt="${id}"]`).forEach(opt => {
      opt.addEventListener('click', () => {
        const value = opt.dataset.value;
        const _labelEl = opt.querySelector('span:last-child');
        const label = (_labelEl && _labelEl.textContent) || value;

        // Update selected state in DOM
        list.querySelectorAll(`[data-tdd-opt="${id}"]`).forEach(o => {
          const check = o.querySelector('.tdd-check, .tdd-check-placeholder');
          if (o.dataset.value === value) {
            o.classList.add('selected');
            if (check) check.outerHTML = `<svg class="tdd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`;
          } else {
            o.classList.remove('selected');
            if (check) check.outerHTML = `<span class="tdd-check-placeholder"></span>`;
          }
        });

        document.getElementById(`tdd-label-${id}`).textContent = label;
        close();
        if (onChange) onChange(value);
      });
    });

    // TV dropdowns close via: option click, trigger re-click, or Back key.
    // focusout auto-close is omitted — it causes premature closes on TV where
    // D-pad navigation fires unusual focus event sequences.

    _instances[id] = { open, close };
  }

  function create({ id, options, selected, onChange }) {
    return {
      html: () => html(id, options, selected),
      mount: () => mount(id, onChange),
    };
  }

  return { html, mount, create };
})();
