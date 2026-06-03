"use strict";

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
var TVDropdown = function () {
  var _instances = {};
  function _html(id, options, selected) {
    var current = options.find(function (o) {
      return o.value === selected;
    }) || options[0];
    var opts = options.map(function (o) {
      return "\n      <div class=\"tdd-option ".concat(o.value === selected ? 'selected' : '', "\"\n        data-nav data-tdd-opt=\"").concat(id, "\" data-value=\"").concat(o.value, "\" tabindex=\"0\">\n        ").concat(o.value === selected ? "<svg class=\"tdd-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" width=\"16\" height=\"16\">\n               <polyline points=\"20 6 9 17 4 12\"/>\n             </svg>" : "<span class=\"tdd-check-placeholder\"></span>", "\n        <span>").concat(o.label, "</span>\n      </div>");
    }).join('');
    return "\n      <div class=\"tdd-wrapper\" id=\"tdd-wrap-".concat(id, "\">\n        <button class=\"tdd-trigger\" data-nav data-tdd-trigger=\"").concat(id, "\" tabindex=\"0\">\n          <span id=\"tdd-label-").concat(id, "\">").concat(current ? current.label : '', "</span>\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" width=\"16\" height=\"16\">\n            <polyline points=\"6 9 12 15 18 9\"/>\n          </svg>\n        </button>\n        <div class=\"tdd-list hidden\" id=\"tdd-list-").concat(id, "\">\n          ").concat(opts, "\n        </div>\n      </div>");
  }
  function _mount(id, onChange) {
    var wrap = document.getElementById("tdd-wrap-".concat(id));
    var trigger = wrap && wrap.querySelector("[data-tdd-trigger=\"".concat(id, "\"]"));
    var list = document.getElementById("tdd-list-".concat(id));
    if (!wrap || !trigger || !list) return;
    function open() {
      // Close any other open dropdown first
      document.querySelectorAll('.tdd-wrapper.open').forEach(function (other) {
        if (other !== wrap) {
          var otherList = other.querySelector('.tdd-list');
          if (otherList) otherList.classList.add('hidden');
          other.classList.remove('open');
        }
      });
      list.classList.remove('hidden');
      wrap.classList.add('open');
      var sel = list.querySelector('.tdd-option.selected') || list.querySelector('.tdd-option');
      if (sel) Nav.focusEl(sel);
    }
    function close() {
      list.classList.add('hidden');
      wrap.classList.remove('open');
      Nav.focusEl(trigger);
    }
    trigger.addEventListener('click', function () {
      if (wrap.classList.contains('open')) {
        close();
      } else {
        open();
      }
    });
    list.querySelectorAll("[data-tdd-opt=\"".concat(id, "\"]")).forEach(function (opt) {
      opt.addEventListener('click', function () {
        var value = opt.dataset.value;
        var _labelEl = opt.querySelector('span:last-child');
        var label = _labelEl && _labelEl.textContent || value;

        // Update selected state in DOM
        list.querySelectorAll("[data-tdd-opt=\"".concat(id, "\"]")).forEach(function (o) {
          var check = o.querySelector('.tdd-check, .tdd-check-placeholder');
          if (o.dataset.value === value) {
            o.classList.add('selected');
            if (check) check.outerHTML = "<svg class=\"tdd-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" width=\"16\" height=\"16\"><polyline points=\"20 6 9 17 4 12\"/></svg>";
          } else {
            o.classList.remove('selected');
            if (check) check.outerHTML = "<span class=\"tdd-check-placeholder\"></span>";
          }
        });
        document.getElementById("tdd-label-".concat(id)).textContent = label;
        close();
        if (onChange) onChange(value);
      });
    });

    // TV dropdowns close via: option click, trigger re-click, or Back key.
    // focusout auto-close is omitted — it causes premature closes on TV where
    // D-pad navigation fires unusual focus event sequences.

    _instances[id] = {
      open: open,
      close: close
    };
  }
  function create(_ref) {
    var id = _ref.id,
      options = _ref.options,
      selected = _ref.selected,
      onChange = _ref.onChange;
    return {
      html: function html() {
        return _html(id, options, selected);
      },
      mount: function mount() {
        return _mount(id, onChange);
      }
    };
  }
  return {
    html: _html,
    mount: _mount,
    create: create
  };
}();