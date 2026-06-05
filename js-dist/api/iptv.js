"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var IPTVClient = /*#__PURE__*/function () {
  function IPTVClient() {
    _classCallCheck(this, IPTVClient);
    this._allChannels = null;
    this._countries = null;
    this._categories = null;
  }

  // ── localStorage cache helpers ────────────────────────────
  return _createClass(IPTVClient, [{
    key: "_fetchJSON",
    value: function _fetchJSON(path) {
      try {
        return Promise.resolve(fetch("".concat(Config.IPTV_API).concat(path))).then(function (res) {
          if (!res.ok) throw new Error("IPTV fetch failed: ".concat(path));
          return res.json();
        });
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }, {
    key: "getCountries",
    value: function getCountries() {
      try {
        var _this = this;
        function _temp2() {
          return _this._countries;
        }
        var _temp = function () {
          if (!_this._countries) {
            return Promise.resolve(_this._fetchJSON('/countries.json')).then(function (_this$_fetchJSON) {
              _this._countries = _this$_fetchJSON;
            });
          }
        }();
        return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }, {
    key: "getCategories",
    value: function getCategories() {
      try {
        var _this2 = this;
        function _temp4() {
          return _this2._categories;
        }
        var _temp3 = function () {
          if (!_this2._categories) {
            return Promise.resolve(_this2._fetchJSON('/categories.json')).then(function (_this2$_fetchJSON) {
              _this2._categories = _this2$_fetchJSON;
            });
          }
        }();
        return Promise.resolve(_temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3));
      } catch (e) {
        return Promise.reject(e);
      }
    } // ── M3U parser ──────────────────────────────────────────
    // index.m3u format: tvg-id="ChannelName.countrycode@quality"
    // Country is the 2-letter code before @quality, not a tvg-country attr.
    // group-title may contain multiple categories separated by ";".
  }, {
    key: "getAllChannels",
    value: // ── Primary source: index.m3u — 2.1 MB, single file, no ID mismatch ──
    function getAllChannels() {
      try {
        var _this3 = this;
        if (_this3._allChannels) return Promise.resolve(_this3._allChannels);
        var cached = IPTVClient._readCache('np_iptv_m3u_v2', 12 * 60 * 60 * 1000); // 12h; v2 = country+category fix
        if (cached) {
          _this3._allChannels = cached;
          return Promise.resolve(cached);
        }
        return Promise.resolve(fetch('https://iptv-org.github.io/iptv/index.m3u')).then(function (res) {
          if (!res.ok) throw new Error('index.m3u fetch failed');
          return Promise.resolve(res.text()).then(function (text) {
            var entries = IPTVClient.parseM3U(text);
            var channels = IPTVClient.groupM3UChannels(entries);
            IPTVClient._writeCache('np_iptv_m3u_v2', channels);
            _this3._allChannels = channels;
            return channels;
          });
        });
      } catch (e) {
        return Promise.reject(e);
      }
    } // ── filterChannels now uses index.m3u (replaces channels.json + streams.json) ──
  }, {
    key: "filterChannels",
    value: function filterChannels() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$country = _ref.country,
        country = _ref$country === void 0 ? '' : _ref$country,
        _ref$category = _ref.category,
        category = _ref$category === void 0 ? '' : _ref$category;
      try {
        var _this4 = this;
        return Promise.resolve(_this4.getAllChannels()).then(function (all) {
          return all.filter(function (ch) {
            if (ch.is_nsfw) return false;
            if (country && ch.country !== country.toUpperCase()) return false;
            if (category && !ch.categories.includes(category)) return false;
            return true;
          });
        });
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }], [{
    key: "_readCache",
    value: function _readCache(key, maxAgeMs) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (Date.now() - obj.ts > maxAgeMs) return null;
        return obj.data;
      } catch (e) {
        return null;
      }
    }
  }, {
    key: "_writeCache",
    value: function _writeCache(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify({
          ts: Date.now(),
          data: data
        }));
      } catch (e) {/* quota exceeded — skip cache */}
    }
  }, {
    key: "parseM3U",
    value: function parseM3U(text) {
      var entries = [];
      var lines = text.split('\n');
      var meta = null;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
          meta = {};
          var attrs = line.match(/[\w-]+=(?:"[^"]*"|[^\s,]+)/g) || [];
          attrs.forEach(function (a) {
            var p = a.match(/([\w-]+)="?([^"]*)"?/);
            if (p) meta[p[1]] = p[2];
          });
          var nameM = line.match(/,([^,]+)$/);
          if (nameM) meta._name = nameM[1].trim();
        } else if (line && !line.startsWith('#') && meta) {
          var tvgId = meta['tvg-id'] || '';
          // Extract country from tvg-id suffix ".xx@quality" or ".xx"
          var cc = tvgId.match(/\.([a-zA-Z]{2})(?:@|$)/);
          var country = cc ? cc[1].toUpperCase() : '';
          // Base ID for grouping: strip @quality suffix so HD+SD share one card
          var baseId = tvgId.replace(/@[^@]*$/, '') || '';
          // Split semicolon-separated group-titles into individual categories
          var cats = meta['group-title'] ? meta['group-title'].split(';').map(function (c) {
            return c.trim().toLowerCase().replace(/\s+/g, '-');
          }).filter(Boolean) : [];
          entries.push({
            id: baseId,
            name: meta['tvg-name'] || meta._name || baseId,
            logo: meta['tvg-logo'] || '',
            country: country,
            categories: cats,
            is_nsfw: false,
            url: line
          });
          meta = null;
        }
        // skip #EXTVLCOPT and other comment lines — they only affect VLC, not our player
      }
      return entries;
    }

    // ── Group M3U entries by base tvg-id → one card, all stream URLs ──
  }, {
    key: "groupM3UChannels",
    value: function groupM3UChannels(entries) {
      var map = {};
      var ordered = [];
      var fallback = 0;
      entries.forEach(function (e) {
        var key = e.id || '_' + fallback++;
        if (e.id && map[key]) {
          map[key].urls.push(e.url); // add quality variant to existing card
        } else {
          var ch = Object.assign({}, e, {
            urls: [e.url]
          });
          if (e.id) map[key] = ch;
          ordered.push(ch);
        }
      });
      return ordered;
    }
  }]);
}();
var IPTV = new IPTVClient();