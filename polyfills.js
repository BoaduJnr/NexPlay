// NodeList.forEach (Chrome 51+)
if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach;
}

// Array.from (Chrome 45+)
if (!Array.from) {
  Array.from = function (arrayLike) {
    return Array.prototype.slice.call(arrayLike);
  };
}

// Object.assign (Chrome 45+)
if (!Object.assign) {
  Object.assign = function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) {
        for (var key in src) {
          if (Object.prototype.hasOwnProperty.call(src, key)) {
            target[key] = src[key];
          }
        }
      }
    }
    return target;
  };
}

// Object.entries (Chrome 54+)
if (!Object.entries) {
  Object.entries = function (obj) {
    var keys = Object.keys(obj);
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      out.push([keys[i], obj[keys[i]]]);
    }
    return out;
  };
}

// Element.closest (Chrome 41+)
if (typeof Element !== 'undefined' && !Element.prototype.closest) {
  Element.prototype.closest = function (sel) {
    var el = this;
    while (el && el.nodeType === 1) {
      if (el.matches ? el.matches(sel) : el.msMatchesSelector && el.msMatchesSelector(sel)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  };
}

// Element.matches
if (typeof Element !== 'undefined' && !Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

// AbortController (Chrome 66+)
if (typeof AbortController === 'undefined') {
  window.AbortController = function() {
    this.signal = { aborted: false };
    this.abort = function() { this.signal.aborted = true; };
  };
}

// classList.toggle second-argument (force) polyfill
(function () {
  var toggle = DOMTokenList.prototype.toggle;
  DOMTokenList.prototype.toggle = function (token, force) {
    if (arguments.length > 1) {
      return force ? (this.add(token), true) : (this.remove(token), false);
    }
    return toggle.call(this, token);
  };
})();
