"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var IPTVClient = /*#__PURE__*/function () {
  function IPTVClient() {
    _classCallCheck(this, IPTVClient);
    this._channels = null;
    this._streams = null;
    this._countries = null;
    this._categories = null;
  }
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
    }
  }, {
    key: "getChannels",
    value: function getChannels() {
      try {
        var _this3 = this;
        function _temp6() {
          return _this3._channels;
        }
        var _temp5 = function () {
          if (!_this3._channels) {
            return Promise.resolve(_this3._fetchJSON('/channels.json')).then(function (_this3$_fetchJSON) {
              _this3._channels = _this3$_fetchJSON;
            });
          }
        }();
        return Promise.resolve(_temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5));
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }, {
    key: "getStreams",
    value: function getStreams() {
      try {
        var _this4 = this;
        function _temp8() {
          return _this4._streams;
        }
        var _temp7 = function () {
          if (!_this4._streams) {
            return Promise.resolve(_this4._fetchJSON('/streams.json')).then(function (_this4$_fetchJSON) {
              _this4._streams = _this4$_fetchJSON;
            });
          }
        }();
        return Promise.resolve(_temp7 && _temp7.then ? _temp7.then(_temp8) : _temp8(_temp7));
      } catch (e) {
        return Promise.reject(e);
      }
    } // Return channels filtered by country code and/or category id
  }, {
    key: "filterChannels",
    value: function filterChannels() {
      var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$country = _ref.country,
        country = _ref$country === void 0 ? '' : _ref$country,
        _ref$category = _ref.category,
        category = _ref$category === void 0 ? '' : _ref$category;
      try {
        var _this5 = this;
        return Promise.resolve(_this5.getChannels()).then(function (all) {
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
    } // Find streams for a given channel id
  }, {
    key: "getStreamUrl",
    value: function getStreamUrl(channelId) {
      try {
        var _this6 = this;
        return Promise.resolve(_this6.getStreams()).then(function (streams) {
          var match = streams.find(function (s) {
            return s.channel === channelId;
          });
          return match ? match.url : null;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    } // Return all streams for a channel id (some channels have multiple)
  }, {
    key: "getStreamUrls",
    value: function getStreamUrls(channelId) {
      try {
        var _this7 = this;
        return Promise.resolve(_this7.getStreams()).then(function (streams) {
          return streams.filter(function (s) {
            return s.channel === channelId;
          }).map(function (s) {
            return s.url;
          });
        });
      } catch (e) {
        return Promise.reject(e);
      }
    } // Group channels by country for the country filter UI
  }, {
    key: "channelsByCountry",
    value: function channelsByCountry() {
      try {
        var _this8 = this;
        return Promise.resolve(Promise.all([_this8.getChannels(), _this8.getCountries()])).then(function (_ref2) {
          var _ref3 = _slicedToArray(_ref2, 2),
            channels = _ref3[0],
            countries = _ref3[1];
          var countryMap = {};
          var _iterator = _createForOfIteratorHelper(countries),
            _step;
          try {
            for (_iterator.s(); !(_step = _iterator.n()).done;) {
              var c = _step.value;
              countryMap[c.code] = c;
            }
          } catch (err) {
            _iterator.e(err);
          } finally {
            _iterator.f();
          }
          var grouped = {};
          var _iterator2 = _createForOfIteratorHelper(channels),
            _step2;
          try {
            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
              var ch = _step2.value;
              if (ch.is_nsfw) continue;
              var code = ch.country || 'INTL';
              if (!grouped[code]) grouped[code] = {
                code: code,
                name: countryMap[code] && countryMap[code].name || code,
                channels: []
              };
              grouped[code].channels.push(ch);
            }
          } catch (err) {
            _iterator2.e(err);
          } finally {
            _iterator2.f();
          }
          return Object.values(grouped).sort(function (a, b) {
            return a.name.localeCompare(b.name);
          });
        });
      } catch (e) {
        return Promise.reject(e);
      }
    } // Quick lookup: country name from code
  }, {
    key: "countryName",
    value: function countryName(code) {
      try {
        var _this9 = this;
        return Promise.resolve(_this9.getCountries()).then(function (countries) {
          var found = countries.find(function (c) {
            return c.code === code;
          });
          return found && found.name || code;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }]);
}();
var IPTV = new IPTVClient();