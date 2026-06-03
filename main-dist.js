"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
// ── On-screen debug console (Yellow button = keyCode 405 to toggle) ──────
(function () {
  var _logs = [];
  var _visible = false;
  var _panel = null;
  function getPanel() {
    if (!_panel) {
      _panel = document.createElement('div');
      _panel.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;max-height:360px;' + 'overflow-y:auto;background:rgba(0,0,0,0.92);color:#0f0;font-size:18px;' + 'font-family:monospace;padding:12px;z-index:99998;display:none;';
      document.body.appendChild(_panel);
    }
    return _panel;
  }
  function addLog(level, args) {
    var msg = Array.prototype.slice.call(args).map(function (a) {
      try {
        return _typeof(a) === 'object' ? JSON.stringify(a) : String(a);
      } catch (e) {
        return String(a);
      }
    }).join(' ');
    _logs.push('[' + level + '] ' + msg);
    if (_logs.length > 60) _logs.shift();
    if (_visible) renderPanel();
  }
  function renderPanel() {
    var p = getPanel();
    p.innerHTML = _logs.map(function (l) {
      var c = l.indexOf('[ERR]') >= 0 ? '#f66' : l.indexOf('[WARN]') >= 0 ? '#fa0' : '#0f0';
      return '<div style="color:' + c + ';border-bottom:1px solid #222;padding:2px 0;">' + l.replace(/</g, '&lt;') + '</div>';
    }).join('');
    p.scrollTop = p.scrollHeight;
  }

  // Intercept console methods
  var _orig = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };
  console.log = function () {
    addLog('LOG', arguments);
    _orig.log.apply(console, arguments);
  };
  console.error = function () {
    addLog('ERR', arguments);
    _orig.error.apply(console, arguments);
  };
  console.warn = function () {
    addLog('WARN', arguments);
    _orig.warn.apply(console, arguments);
  };

  // Toggle: Yellow button (405) OR triple-press of Info button (457)
  var _infoCount = 0;
  var _infoTimer = null;
  document.addEventListener('keydown', function (e) {
    var toggle = false;
    if (e.keyCode === 405) {
      // Yellow
      toggle = true;
    } else if (e.keyCode === 457) {
      // Info — triple-press fallback
      _infoCount++;
      clearTimeout(_infoTimer);
      _infoTimer = setTimeout(function () {
        _infoCount = 0;
      }, 800);
      if (_infoCount >= 3) {
        _infoCount = 0;
        toggle = true;
      }
    }
    if (toggle) {
      _visible = !_visible;
      var p = getPanel();
      p.style.display = _visible ? 'block' : 'none';
      if (_visible) renderPanel();
    }
  });
  window.onerror = function (msg, src, line) {
    console.error('line ' + line + ': ' + msg);
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:red;color:#fff;font-size:32px;padding:30px;z-index:99999;word-wrap:break-word;';
    d.textContent = 'ERROR line ' + line + ': ' + msg;
    document.body.appendChild(d);
  };
})();

/*
 * Tizen lifecycle entry point.
 * Registers the hardware back key and handles app suspend/resume.
 */
window.onload = function () {
  // Register Tizen remote key events
  try {
    tizen.tvinputdevice.registerKey('MediaPlay');
    tizen.tvinputdevice.registerKey('MediaPause');
    tizen.tvinputdevice.registerKey('MediaStop');
    tizen.tvinputdevice.registerKey('MediaFastForward');
    tizen.tvinputdevice.registerKey('MediaRewind');
    // Color buttons — must be explicitly registered on Samsung TV
    tizen.tvinputdevice.registerKey('ColorF0Red');
    tizen.tvinputdevice.registerKey('ColorF1Green');
    tizen.tvinputdevice.registerKey('ColorF2Yellow');
    tizen.tvinputdevice.registerKey('ColorF3Blue');
  } catch (e) {
    // Running outside Tizen (e.g., browser dev) — ignore
  }
  // Green button cycles theme
  document.addEventListener('keydown', function (e) {
    if (e.keyCode === 404 && typeof App !== 'undefined') {
      // Green
      App.cycleTheme();
    }
  });
};
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    // App moved to background — pause any active video
    var video = document.getElementById('iptv-video');
    if (video) video.pause();
  }
});
