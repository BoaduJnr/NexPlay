"use strict";

var _Pact = /*#__PURE__*/function () {
  function _Pact() {}
  _Pact.prototype.then = function (onFulfilled, onRejected) {
    var result = new _Pact();
    var state = this.s;
    if (state) {
      var callback = state & 1 ? onFulfilled : onRejected;
      if (callback) {
        try {
          _settle(result, 1, callback(this.v));
        } catch (e) {
          _settle(result, 2, e);
        }
        return result;
      } else {
        return this;
      }
    }
    this.o = function (_this) {
      try {
        var value = _this.v;
        if (_this.s & 1) {
          _settle(result, 1, onFulfilled ? onFulfilled(value) : value);
        } else if (onRejected) {
          _settle(result, 1, onRejected(value));
        } else {
          _settle(result, 2, value);
        }
      } catch (e) {
        _settle(result, 2, e);
      }
    };
    return result;
  };
  return _Pact;
}();
function _for(test, update, body) {
  var stage;
  for (;;) {
    var shouldContinue = test();
    if (_isSettledPact(shouldContinue)) {
      shouldContinue = shouldContinue.v;
    }
    if (!shouldContinue) {
      return result;
    }
    if (shouldContinue.then) {
      stage = 0;
      break;
    }
    var result = body();
    if (result && result.then) {
      if (_isSettledPact(result)) {
        result = result.s;
      } else {
        stage = 1;
        break;
      }
    }
    if (update) {
      var updateValue = update();
      if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
        stage = 2;
        break;
      }
    }
  }
  var pact = new _Pact();
  var reject = _settle.bind(null, pact, 2);
  (stage === 0 ? shouldContinue.then(_resumeAfterTest) : stage === 1 ? result.then(_resumeAfterBody) : updateValue.then(_resumeAfterUpdate)).then(void 0, reject);
  return pact;
  function _resumeAfterBody(value) {
    result = value;
    do {
      if (update) {
        updateValue = update();
        if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
          updateValue.then(_resumeAfterUpdate).then(void 0, reject);
          return;
        }
      }
      shouldContinue = test();
      if (!shouldContinue || _isSettledPact(shouldContinue) && !shouldContinue.v) {
        _settle(pact, 1, result);
        return;
      }
      if (shouldContinue.then) {
        shouldContinue.then(_resumeAfterTest).then(void 0, reject);
        return;
      }
      result = body();
      if (_isSettledPact(result)) {
        result = result.v;
      }
    } while (!result || !result.then);
    result.then(_resumeAfterBody).then(void 0, reject);
  }
  function _resumeAfterTest(shouldContinue) {
    if (shouldContinue) {
      result = body();
      if (result && result.then) {
        result.then(_resumeAfterBody).then(void 0, reject);
      } else {
        _resumeAfterBody(result);
      }
    } else {
      _settle(pact, 1, result);
    }
  }
  function _resumeAfterUpdate() {
    if (shouldContinue = test()) {
      if (shouldContinue.then) {
        shouldContinue.then(_resumeAfterTest).then(void 0, reject);
      } else {
        _resumeAfterTest(shouldContinue);
      }
    } else {
      _settle(pact, 1, result);
    }
  }
}
function _isSettledPact(thenable) {
  return thenable instanceof _Pact && thenable.s & 1;
}
function _settle(pact, state, value) {
  if (!pact.s) {
    if (value instanceof _Pact) {
      if (value.s) {
        if (state & 1) {
          state = value.s;
        }
        value = value.v;
      } else {
        value.o = _settle.bind(null, pact, state);
        return;
      }
    }
    if (value && value.then) {
      value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
      return;
    }
    pact.s = state;
    pact.v = value;
    var observer = pact.o;
    if (observer) {
      observer(pact);
    }
  }
}
function _catch(body, recover) {
  try {
    var result = body();
  } catch (e) {
    return recover(e);
  }
  if (result && result.then) {
    return result.then(void 0, recover);
  }
  return result;
}
var DetailPage = function () {
  // ── Inline movie download — runs on the detail page without opening the player ──
  var _runDetailDownload = function _runDetailDownload(movieId, title, year) {
    try {
      var PROXY = 'https://nexplay-proxy.pielly16.workers.dev';
      var dlBtn = document.getElementById('detail-dl');
      var progress = document.getElementById('detail-dl-progress');
      var fill = document.getElementById('detail-dl-fill');
      var status = document.getElementById('detail-dl-status');
      var lbl = document.getElementById('detail-dl-lbl');
      var ico = document.getElementById('detail-dl-ico');
      if (!dlBtn || dlBtn.dataset.dlActive === '1') return Promise.resolve();
      dlBtn.dataset.dlActive = '1';
      _detailDLController = new AbortController();
      var signal = _detailDLController.signal;
      function setLbl(t) {
        if (lbl) lbl.textContent = t;
      }
      function setIco(d) {
        if (ico) ico.innerHTML = d;
      }
      function setFill(pct) {
        if (fill) fill.style.width = pct + '%';
      }
      function setStatus(t) {
        if (status) status.textContent = t;
      }
      function showProgress() {
        if (progress) progress.classList.add('active');
      }
      function resetUI() {
        dlBtn.dataset.dlActive = '';
        _detailDLController = null;
        setLbl('Download');
        setFill(0);
        setStatus('');
        setIco('<path d="M12 5v14M5 12l7 7 7-7"/>');
        if (progress) progress.classList.remove('active');
      }
      function fail(msg) {
        resetUI();
        if (msg && typeof App !== 'undefined') App.showToast(msg);
      }

      // Show Cancel button during download
      var safeName = (title || 'movie').replace(/[^a-zA-Z0-9 ]/g, '_').slice(0, 60);
      setIco('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
      setLbl('Cancel');
      showProgress();
      setStatus('Finding stream…');
      return Promise.resolve(_catch(function () {
        if (typeof StreamResolver === 'undefined') {
          fail('StreamResolver unavailable');
          return;
        }

        // Step 1: resolve stream (same chain as player)
        return Promise.resolve(StreamResolver.resolveMovie(movieId, title, year)).then(function (result) {
          function _temp0() {
            setStatus('Fetching playlist…');
            setLbl('…');

            // Step 3: fetch + parse m3u8
            // Step 4: setup FSA or blob
            // Step 5: transmux TS → MP4 with mux.js
            // Step 6: save
            // Step 7: done state
            if (signal.aborted) {
              resetUI();
              return;
            }
            return Promise.resolve(fetch(pxUrl(streamUrl), {
              signal: signal
            })).then(function (r0) {
              if (!r0.ok) throw new Error('Manifest ' + r0.status);
              function parseM3u8(text, origBase) {
                var lines = text.trim().split('\n').map(function (l) {
                  return l.trim();
                }).filter(Boolean);
                var segs = [],
                  isMaster = false,
                  bestBw = 0,
                  bestProxyUrl = null,
                  bestOrig = null;
                var live = text.indexOf('#EXT-X-ENDLIST') === -1;
                for (var i = 0; i < lines.length; i++) {
                  var ln = lines[i];
                  if (ln.indexOf('#EXT-X-STREAM-INF') === 0) {
                    isMaster = true;
                    var bwm = ln.match(/BANDWIDTH=(\d+)/i);
                    var bw = bwm ? parseInt(bwm[1]) : 0;
                    if (bw >= bestBw && i + 1 < lines.length && lines[i + 1].charAt(0) !== '#') {
                      bestBw = bw;
                      var raw = lines[i + 1];
                      var orig = absUrl(origOf(raw), origBase);
                      bestOrig = orig;
                      bestProxyUrl = pxUrl(orig);
                    }
                  } else if (ln.charAt(0) !== '#' && ln.length > 0 && !isMaster) {
                    segs.push(pxUrl(absUrl(origOf(ln), origBase)));
                  }
                }
                return {
                  isMaster: isMaster,
                  isLive: live && !isMaster,
                  bestProxyUrl: bestProxyUrl,
                  bestOrig: bestOrig,
                  segs: segs
                };
              }
              return Promise.resolve(r0.text()).then(function (m3u8) {
                var _exit = false;
                function _temp8(_result2) {
                  var _exit2 = false;
                  if (_exit) return _result2;
                  function _temp6(_result4) {
                    var _interrupt = false;
                    if (_exit2) return _result4;
                    function _temp4() {
                      tx.flush();
                      return Promise.resolve(wQueue).then(function () {
                        function _temp2() {
                          setIco('<polyline points="20 6 9 17 4 12"/>');
                          setLbl(failed ? 'Saved*' : 'Saved');
                          setFill(100);
                          setStatus(failed ? 'Done – ' + failed + ' segments failed' : 'Download complete');
                          if (typeof App !== 'undefined') App.showToast('Download complete!');
                          setTimeout(function () {
                            resetUI();
                          }, 6000);
                        }
                        var _temp = function () {
                          if (writable) {
                            return Promise.resolve(writable.close()).then(function () {});
                          } else if (chunks.length) {
                            setStatus('Saving…');
                            setLbl('Saving…');
                            var total = chunks.reduce(function (s, c) {
                              return s + c.byteLength;
                            }, 0);
                            var out = new Uint8Array(total),
                              off = 0;
                            chunks.forEach(function (c) {
                              out.set(c, off);
                              off += c.byteLength;
                            });
                            var blob = new Blob([out], {
                              type: 'video/mp4'
                            });
                            var objUrl = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = objUrl;
                            a.download = safeName + '.mp4';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(function () {
                              URL.revokeObjectURL(objUrl);
                            }, 5000);
                          }
                        }();
                        return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
                      });
                    }
                    var tx = new muxjs.mp4.Transmuxer();
                    var chunks = [],
                      wQueue = Promise.resolve(),
                      initDone = false,
                      failed = 0;
                    tx.on('data', function (seg) {
                      var pieces = [];
                      if (!initDone && seg.initSegment && seg.initSegment.byteLength > 0) {
                        pieces.push(new Uint8Array(seg.initSegment));
                        initDone = true;
                      }
                      if (seg.data && seg.data.byteLength > 0) pieces.push(new Uint8Array(seg.data));
                      if (!pieces.length) return;
                      if (writable) {
                        pieces.forEach(function (p) {
                          wQueue = wQueue.then(function () {
                            return writable.write(p);
                          });
                        });
                      } else {
                        pieces.forEach(function (p) {
                          chunks.push(p);
                        });
                      }
                    });
                    var BATCH = 4;
                    var i = 0;
                    var _temp3 = _for(function () {
                      return !_interrupt && i < parsed.segs.length;
                    }, function () {
                      return !!(i += BATCH);
                    }, function () {
                      if (signal.aborted) {
                        _interrupt = true;
                        return;
                      }
                      var batch = parsed.segs.slice(i, i + BATCH);
                      return Promise.resolve(Promise.all(batch.map(function (u) {
                        return fetch(u, {
                          signal: signal
                        }).then(function (r) {
                          return r.ok ? r.arrayBuffer() : null;
                        }).then(function (ab) {
                          return ab ? new Uint8Array(ab) : null;
                        }).catch(function () {
                          return null;
                        });
                      }))).then(function (results) {
                        results.forEach(function (r) {
                          if (!r) {
                            failed++;
                            return;
                          }
                          tx.push(r);
                        });
                        tx.flush();
                        var pct = Math.round(Math.min(i + BATCH, parsed.segs.length) / parsed.segs.length * 100);
                        setFill(pct);
                        setLbl(pct + '%');
                        setStatus(Math.min(i + BATCH, parsed.segs.length) + '/' + parsed.segs.length);
                      });
                    });
                    return _temp3 && _temp3.then ? _temp3.then(_temp4) : _temp4(_temp3);
                  }
                  if (parsed.isLive) {
                    fail('Live streams cannot be downloaded');
                    return;
                  }
                  if (!parsed.segs.length) throw new Error('No segments found');
                  setStatus('Downloading ' + parsed.segs.length + ' segments…');
                  if (typeof App !== 'undefined') App.showToast('Downloading ' + parsed.segs.length + ' segments — saves as MP4');
                  var writable = null;
                  var _temp5 = function () {
                    if (typeof window.showSaveFilePicker === 'function') {
                      return _catch(function () {
                        return Promise.resolve(window.showSaveFilePicker({
                          suggestedName: safeName + '.mp4',
                          types: [{
                            description: 'MP4 Video',
                            accept: {
                              'video/mp4': ['.mp4']
                            }
                          }]
                        })).then(function (fh) {
                          return Promise.resolve(fh.createWritable()).then(function (_fh$createWritable) {
                            writable = _fh$createWritable;
                          });
                        });
                      }, function (e) {
                        if (e.name === 'AbortError') {
                          resetUI();
                          _exit2 = true;
                          return;
                        }
                        writable = null;
                      });
                    }
                  }();
                  return _temp5 && _temp5.then ? _temp5.then(_temp6) : _temp6(_temp5);
                }
                var parsed = parseM3u8(m3u8, streamUrl);
                var _temp7 = function () {
                  if (parsed.isMaster) {
                    if (!parsed.bestProxyUrl) throw new Error('No variant found');
                    setStatus('Fetching variant…');
                    return Promise.resolve(fetch(parsed.bestProxyUrl, {
                      signal: signal
                    })).then(function (rv) {
                      return Promise.resolve(rv.text()).then(function (rt) {
                        parsed = parseM3u8(rt, parsed.bestOrig || streamUrl);
                      });
                    });
                  }
                }();
                return _temp7 && _temp7.then ? _temp7.then(_temp8) : _temp8(_temp7);
              });
            });
          }
          if (!result || !result.url) {
            fail('No stream found for download');
            return;
          }
          var streamUrl = result.url;
          var headers = result.headers || {};
          function pxUrl(u) {
            if (u.indexOf(PROXY) === 0) return u;
            return PROXY + '/?url=' + encodeURIComponent(u) + (hB64 ? '&headers=' + encodeURIComponent(hB64) : '');
          }
          function origOf(u) {
            if (u.indexOf(PROXY) !== 0) return u;
            try {
              return decodeURIComponent(new URL(u).searchParams.get('url') || u);
            } catch (e) {
              return u;
            }
          }
          function absUrl(rel, base) {
            if (/^https?:\/\//i.test(rel)) return rel;
            if (rel.charAt(0) === '/') {
              var m = base.match(/^(https?:\/\/[^\/]+)/);
              return m ? m[1] + rel : rel;
            }
            return base.substring(0, base.lastIndexOf('/') + 1) + rel;
          }

          // Step 2: load mux.js
          var hB64 = Object.keys(headers).length ? btoa(JSON.stringify(headers)) : '';
          var _temp9 = function () {
            if (typeof muxjs === 'undefined') {
              setStatus('Loading converter…');
              setLbl('Init…');
              return Promise.resolve(new Promise(function (res, rej) {
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/mux.js@6/dist/mux.min.js';
                s.onload = res;
                s.onerror = rej;
                document.head.appendChild(s);
              })).then(function () {});
            }
          }();
          return _temp9 && _temp9.then ? _temp9.then(_temp0) : _temp0(_temp9);
        });
      }, function (e) {
        if (e.name === 'AbortError') {
          resetUI();
          return;
        }
        fail('Download failed: ' + (e.message || String(e)));
      }));
    } catch (e) {
      return Promise.reject(e);
    }
  };
  var _detailDLController = null;

  // ── Reviews ────────────────────────────────────────────
  var _reviewRating = 0; // 1-5 selected by user
  var _reviewMovieId = null;
  function _escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _timeAgo(ts) {
    var diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  function _stars(n, total) {
    total = total || 5;
    var s = '';
    for (var i = 1; i <= total; i++) s += '<span class="rv-star' + (i <= n ? ' filled' : '') + '" data-star="' + i + '">★</span>';
    return s;
  }
  function _apiBase() {
    var h = window.location.hostname;
    // Running under a real server (localhost or deployed) → same-origin calls
    if (h === 'localhost' || h === '127.0.0.1') return '';
    if (window.location.protocol === 'https:') return '';
    // TV (.wgt, file://) or LAN → call the deployed server directly
    if (typeof Config !== 'undefined' && Config.DEPLOY_URL) return Config.DEPLOY_URL;
    return '';
  }
  function _hasReviewsBackend() {
    var h = window.location.hostname;
    // Available on localhost (Deno running locally) or any HTTPS origin (deployed)
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (window.location.protocol === 'https:') return true;
    // TV / file:// — only if DEPLOY_URL is set
    return typeof Config !== 'undefined' && !!Config.DEPLOY_URL;
  }
  function _loadReviews(movieId) {
    var section = document.getElementById('detail-reviews');
    if (!section) return;

    // Reviews API requires Deno Deploy backend — not available locally
    if (!_hasReviewsBackend()) {
      section.style.display = 'none';
      return;
    }
    var isSignedIn = typeof GoogleAuth !== 'undefined' && GoogleAuth.isSignedIn();
    var isTV = !document.body.classList.contains('is-web');
    var isTVConnected = isTV && function () {
      try {
        return !!localStorage.getItem('np_tv_profile');
      } catch (e) {
        return false;
      }
    }();

    // Show to signed-in web users or any TV user (read-only on TV)
    if (!isSignedIn && !isTV) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    _reviewMovieId = movieId;
    _reviewRating = 0;
    if (isSignedIn) {
      var user = GoogleAuth.getUser();

      // Build write form HTML
      var formHtml = '<div class="rv-form">' + '<div class="rv-form-user">' + (user.picture ? '<img src="' + _escHtml(user.picture) + '" class="rv-form-avatar" alt="">' : '<div class="rv-form-initials">' + (user.firstName || '?')[0] + '</div>') + '<span class="rv-form-name">' + _escHtml(user.firstName + (user.lastName ? ' ' + user.lastName : '')) + '</span>' + '</div>' + '<div class="rv-star-row" id="rv-star-select">' + _stars(0) + '</div>' + '<textarea class="rv-textarea" id="rv-text-input" placeholder="Share your thoughts about this movie…" maxlength="500"></textarea>' + '<div class="rv-form-footer">' + '<span class="rv-char-count" id="rv-char-count">0 / 500</span>' + '<button class="rv-submit-btn" id="rv-submit-btn" disabled>Post Review</button>' + '</div>' + '</div>';
      section.innerHTML = '<div class="rv-section-header">' + '<h3 class="rv-section-title">Reviews</h3>' + '<span class="rv-count" id="rv-count"></span>' + '</div>' + formHtml + '<div id="rv-list" class="rv-list"><div class="rv-loading">Loading reviews…</div></div>';
      _wireReviewForm(movieId, user);
      _fetchReviews(movieId, user.sub);
    } else {
      // TV read-only: no write form, just the list
      section.innerHTML = '<div class="rv-section-header">' + '<h3 class="rv-section-title">Reviews</h3>' + '<span class="rv-count" id="rv-count"></span>' + '</div>' + '<div id="rv-list" class="rv-list"><div class="rv-loading">Loading reviews…</div></div>';
      _fetchReviews(movieId, null);
    }
  }
  function _wireReviewForm(movieId, user) {
    // Star selector
    var starRow = document.getElementById('rv-star-select');
    if (starRow) {
      starRow.addEventListener('mouseleave', function () {
        var stars = starRow.querySelectorAll('.rv-star');
        for (var i = 0; i < stars.length; i++) stars[i].classList.toggle('filled', i < _reviewRating);
      });
      starRow.addEventListener('mouseover', function (e) {
        var s = e.target.closest ? e.target.closest('.rv-star') : e.target.classList.contains('rv-star') ? e.target : null;
        if (!s) return;
        var n = parseInt(s.getAttribute('data-star'));
        var all = starRow.querySelectorAll('.rv-star');
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('filled', i < n);
      });
      starRow.addEventListener('click', function (e) {
        var s = e.target.closest ? e.target.closest('.rv-star') : e.target.classList.contains('rv-star') ? e.target : null;
        if (!s) return;
        _reviewRating = parseInt(s.getAttribute('data-star'));
        var all = starRow.querySelectorAll('.rv-star');
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('filled', i < _reviewRating);
        _updateSubmitBtn();
      });
    }

    // Textarea char count
    var textarea = document.getElementById('rv-text-input');
    if (textarea) {
      textarea.addEventListener('input', function () {
        var len = textarea.value.length;
        var counter = document.getElementById('rv-char-count');
        if (counter) counter.textContent = len + ' / 500';
        _updateSubmitBtn();
      });
    }

    // Submit
    var submitBtn = document.getElementById('rv-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var text = textarea ? textarea.value.trim() : '';
        if (!_reviewRating || !text) return;
        _submitReview(movieId, user);
      });
    }
  }
  function _updateSubmitBtn() {
    var btn = document.getElementById('rv-submit-btn');
    var textarea = document.getElementById('rv-text-input');
    if (!btn) return;
    var hasText = textarea && textarea.value.trim().length > 0;
    var hasStar = _reviewRating > 0;
    btn.disabled = !(hasText && hasStar);
  }
  function _fetchReviews(movieId, userSub) {
    var list = document.getElementById('rv-list');
    if (!list) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _apiBase() + '/api/reviews?id=' + encodeURIComponent(movieId), true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (xhr.status !== 200) {
        list.innerHTML = '<div class="rv-empty">Could not load reviews.</div>';
        return;
      }
      var reviews;
      try {
        reviews = JSON.parse(xhr.responseText);
      } catch (e) {
        reviews = [];
      }
      _renderReviews(reviews, userSub);
    };
    xhr.onerror = xhr.ontimeout = function () {
      list.innerHTML = '<div class="rv-empty">Could not load reviews.</div>';
    };
    xhr.send();
  }
  function _renderReviews(reviews, userSub) {
    var list = document.getElementById('rv-list');
    var count = document.getElementById('rv-count');
    if (!list) return;
    var isTV = !document.body.classList.contains('is-web');
    if (count) count.textContent = reviews.length ? reviews.length + (reviews.length === 1 ? ' review' : ' reviews') : '';
    if (!reviews.length) {
      list.innerHTML = '<div class="rv-empty">' + (isTV ? 'No reviews yet.' : 'No reviews yet. Be the first!') + '</div>';
      return;
    }

    // Pre-fill write form if user has already reviewed
    var myReview = null;
    for (var m = 0; m < reviews.length; m++) {
      if (reviews[m].uid === 'g_' + userSub) {
        myReview = reviews[m];
        break;
      }
    }
    if (myReview) {
      var textarea = document.getElementById('rv-text-input');
      if (textarea) textarea.value = myReview.text || '';
      _reviewRating = myReview.rating || 0;
      var starRow = document.getElementById('rv-star-select');
      if (starRow) {
        var allStars = starRow.querySelectorAll('.rv-star');
        for (var si = 0; si < allStars.length; si++) allStars[si].classList.toggle('filled', si < _reviewRating);
      }
      var wBtn = document.getElementById('rv-submit-btn');
      if (wBtn) {
        wBtn.textContent = 'Update Review';
        wBtn.disabled = false;
      }
    }
    list.innerHTML = reviews.map(function (r) {
      var isMine = userSub && r.uid === 'g_' + userSub;
      var ts = r.ts || 0;
      var replies = Array.isArray(r.replies) ? r.replies : [];
      var rCount = replies.length;
      var repliesHtml = replies.map(function (rep) {
        var isMyReply = userSub && rep.uid === 'g_' + userSub;
        return '<div class="rv-reply-item' + (isMyReply ? ' rv-mine-reply' : '') + '">' + '<div class="rv-reply-left">' + (rep.picture ? '<img src="' + _escHtml(rep.picture) + '" class="rv-reply-avatar" alt="" onerror="this.style.display=\'none\'">' : '<div class="rv-reply-avatar-ph">' + (rep.name || '?')[0].toUpperCase() + '</div>') + '</div>' + '<div class="rv-reply-body">' + '<div class="rv-reply-hd">' + '<span class="rv-reply-name">' + _escHtml(rep.name || 'Anonymous') + (isMyReply ? ' <span class="rv-you">You</span>' : '') + '</span>' + '<span class="rv-reply-date">' + _timeAgo(rep.ts || 0) + '</span>' + '</div>' + '<p class="rv-reply-text">' + _escHtml(rep.text || '') + '</p>' + '</div>' + '</div>';
      }).join('');
      var toggleLabel = rCount > 0 ? rCount + (rCount === 1 ? ' Reply ▼' : ' Replies ▼') : 'Reply';
      return '<div class="rv-item' + (isMine ? ' rv-mine' : '') + '"' + (isTV ? ' data-nav tabindex="0"' : '') + ' data-ts="' + ts + '" data-uid="' + _escHtml(r.uid || '') + '">' + '<div class="rv-item-left">' + '<div class="rv-av-wrap" data-av-uid="' + _escHtml(r.uid || '') + '">' + (r.picture ? '<img src="' + _escHtml(r.picture) + '" class="rv-avatar" alt="" onerror="this.style.display=\'none\'">' : '<div class="rv-avatar-placeholder">' + (r.name || '?')[0].toUpperCase() + '</div>') + '</div>' + '</div>' + '<div class="rv-item-body">' + '<div class="rv-item-header">' + '<span class="rv-item-name">' + _escHtml(r.name || 'Anonymous') + (isMine ? ' <span class="rv-you">You</span>' : '') + '</span>' + '<div class="rv-item-stars">' + _stars(r.rating || 0) + '</div>' + '<span class="rv-item-date">' + _timeAgo(ts) + '</span>' + '</div>' + '<p class="rv-item-text">' + _escHtml(r.text || '') + '</p>' +
      // Action row
      '<div class="rv-actions">' + (rCount > 0 ? '<button class="rv-toggle-btn"' + (isTV ? ' data-nav tabindex="0"' : '') + ' data-ts="' + ts + '">' + toggleLabel + '</button>' : '') + (!isTV ? '<button class="rv-reply-open-btn" data-ts="' + ts + '">Reply</button>' : '') + '</div>' +
      // Replies list (collapsed)
      '<div class="rv-replies-wrap" id="rv-replies-' + ts + '">' + (rCount > 0 ? '<div class="rv-replies-list">' + repliesHtml + '</div>' : '') + '</div>' + (
      // Inline reply form (hidden — web only)
      !isTV ? '<div class="rv-reply-form" id="rv-reply-form-' + ts + '" style="display:none;">' + '<textarea class="rv-reply-ta" placeholder="Write a reply…" maxlength="500"></textarea>' + '<div class="rv-reply-form-footer">' + '<span class="rv-reply-char">0 / 500</span>' + '<div class="rv-reply-form-btns">' + '<button class="rv-reply-cancel" data-ts="' + ts + '">Cancel</button>' + '<button class="rv-reply-submit" data-ts="' + ts + '" disabled>Post Reply</button>' + '</div>' + '</div>' + '</div>' : '') + '</div>' + '</div>';
    }).join('');
    _wireReviewActions(_reviewMovieId, userSub);
    _fetchPresence(reviews);
  }
  function _wireReviewActions(movieId, userSub) {
    var list = document.getElementById('rv-list');
    if (!list) return;

    // ── Toggle replies collapse/expand ────────────────
    var toggleBtns = list.querySelectorAll('.rv-toggle-btn');
    for (var i = 0; i < toggleBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var ts = btn.getAttribute('data-ts');
          var wrap = document.getElementById('rv-replies-' + ts);
          if (!wrap) return;
          var open = wrap.classList.contains('rv-open');
          wrap.classList.toggle('rv-open', !open);
          var rCount = wrap.querySelectorAll('.rv-reply-item').length;
          btn.textContent = rCount + (rCount === 1 ? ' Reply ' : ' Replies ') + (open ? '▼' : '▲');
        });
      })(toggleBtns[i]);
    }

    // ── Open reply form ───────────────────────────────
    var replyOpenBtns = list.querySelectorAll('.rv-reply-open-btn');
    for (var j = 0; j < replyOpenBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var ts = btn.getAttribute('data-ts');
          var form = document.getElementById('rv-reply-form-' + ts);
          var wrap = document.getElementById('rv-replies-' + ts);
          if (!form) return;
          var visible = form.style.display !== 'none';
          form.style.display = visible ? 'none' : '';
          if (!visible) {
            if (wrap) wrap.classList.add('rv-open');
            var ta = form.querySelector('.rv-reply-ta');
            if (ta) ta.focus();
          }
        });
      })(replyOpenBtns[j]);
    }

    // ── Cancel reply ──────────────────────────────────
    var cancelBtns = list.querySelectorAll('.rv-reply-cancel');
    for (var k = 0; k < cancelBtns.length; k++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var ts = btn.getAttribute('data-ts');
          var form = document.getElementById('rv-reply-form-' + ts);
          if (form) {
            form.style.display = 'none';
            var ta = form.querySelector('.rv-reply-ta');
            if (ta) ta.value = '';
          }
        });
      })(cancelBtns[k]);
    }

    // ── Reply textarea char count + submit enable ─────
    var replyTAs = list.querySelectorAll('.rv-reply-ta');
    for (var n = 0; n < replyTAs.length; n++) {
      (function (ta) {
        ta.addEventListener('input', function () {
          var len = ta.value.length;
          var footer = ta.closest('.rv-reply-form');
          var charEl = footer ? footer.querySelector('.rv-reply-char') : null;
          var subBtn = footer ? footer.querySelector('.rv-reply-submit') : null;
          if (charEl) charEl.textContent = len + ' / 500';
          if (subBtn) subBtn.disabled = len === 0;
        });
        ta.addEventListener('keydown', function (e) {
          e.stopPropagation();
        });
      })(replyTAs[n]);
    }

    // ── Submit reply ──────────────────────────────────
    var subBtns = list.querySelectorAll('.rv-reply-submit');
    for (var l = 0; l < subBtns.length; l++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var ts = parseInt(btn.getAttribute('data-ts'));
          var form = document.getElementById('rv-reply-form-' + ts);
          var ta = form ? form.querySelector('.rv-reply-ta') : null;
          var text = ta ? ta.value.trim() : '';
          if (!text) return;
          var user = typeof GoogleAuth !== 'undefined' ? GoogleAuth.getUser() : null;
          if (!user) return;
          _submitReply(movieId, ts, user, text, btn, form, ta);
        });
      })(subBtns[l]);
    }
  }
  function _fetchPresence(reviews) {
    if (!reviews || !reviews.length) return;
    var base = _apiBase();
    if (!base && window.location.protocol === 'file:') return;
    var uids = reviews.map(function (r) {
      return r.uid || '';
    }).filter(Boolean).join(',');
    if (!uids) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + '/api/presence?uids=' + encodeURIComponent(uids), true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      var online;
      try {
        online = JSON.parse(xhr.responseText);
      } catch (e) {
        return;
      }
      // Add online dot to each online reviewer's avatar wrapper
      Object.keys(online).forEach(function (uid) {
        var wraps = document.querySelectorAll('[data-av-uid="' + uid + '"]');
        for (var i = 0; i < wraps.length; i++) {
          if (!wraps[i].querySelector('.online-dot')) {
            var dot = document.createElement('span');
            dot.className = 'online-dot';
            wraps[i].appendChild(dot);
          }
        }
      });
    };
    xhr.onerror = xhr.ontimeout = function () {};
    xhr.send();
  }
  function _submitReview(movieId, user) {
    var textarea = document.getElementById('rv-text-input');
    var submitBtn = document.getElementById('rv-submit-btn');
    var text = textarea ? textarea.value.trim() : '';
    if (!text || !_reviewRating) return;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting…';
    }
    var payload = JSON.stringify({
      uid: 'g_' + user.sub,
      name: (user.firstName || '') + (user.lastName ? ' ' + user.lastName : ''),
      picture: user.picture || '',
      rating: _reviewRating,
      text: text
    });
    var xhr = new XMLHttpRequest();
    xhr.open('POST', _apiBase() + '/api/reviews?id=' + encodeURIComponent(movieId), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (submitBtn) {
        submitBtn.textContent = 'Update Review';
        submitBtn.disabled = false;
      }
      if (xhr.status === 200) {
        if (typeof App !== 'undefined') App.showToast('Review posted!');
        _fetchReviews(movieId, user.sub);
      } else {
        if (typeof App !== 'undefined') App.showToast('Failed to post review');
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Review';
      }
      if (typeof App !== 'undefined') App.showToast('Network error — try again');
    };
    xhr.send(payload);
  }
  function _submitReply(movieId, reviewTs, user, text, submitBtn, form, ta) {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting…';
    }
    var payload = JSON.stringify({
      reviewTs: reviewTs,
      uid: 'g_' + user.sub,
      name: (user.firstName || '') + (user.lastName ? ' ' + user.lastName : ''),
      picture: user.picture || '',
      text: text
    });
    var xhr = new XMLHttpRequest();
    xhr.open('POST', _apiBase() + '/api/reply?id=' + encodeURIComponent(movieId), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Reply';
      }
      if (xhr.status === 200) {
        if (ta) ta.value = '';
        if (form) form.style.display = 'none';
        if (typeof App !== 'undefined') App.showToast('Reply posted!');
        _fetchReviews(movieId, user.sub);
      } else {
        if (typeof App !== 'undefined') App.showToast('Failed to post reply');
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Reply';
      }
      if (typeof App !== 'undefined') App.showToast('Network error — try again');
    };
    xhr.send(payload);
  }
  function _fetchDetailInAppRating(movieId) {
    var el = document.getElementById('detail-ia-rating');
    if (!el) return;
    // Show placeholder while loading
    el.innerHTML = '<span class="detail-ia-chip">NexPlay Rating</span> <span class="detail-ia-loading">…</span>';
    var base = _apiBase();
    if (!base && window.location.protocol === 'file:') {
      el.innerHTML = '<span class="detail-ia-chip">NexPlay Rating</span> <span class="detail-ia-na">N/A</span> <span class="detail-ia-hint">No reviews yet</span>';
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + '/api/ratings?ids=' + encodeURIComponent(movieId), true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      if (!document.getElementById('detail-ia-rating')) return; // page navigated away
      var data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        data = {};
      }
      var r = data[movieId];
      if (r && r.count > 0) {
        el.innerHTML = '<span class="detail-ia-chip">NexPlay Rating</span>' + '<span class="detail-ia-stars">' + _detailStars(r.avg) + '</span>' + '<strong class="detail-ia-score">' + parseFloat(r.avg).toFixed(1) + '</strong>' + '<span class="detail-ia-max">&thinsp;/ 5</span>' + '<span class="detail-ia-count">(' + r.count + (r.count === 1 ? ' review' : ' reviews') + ')</span>';
      } else {
        el.innerHTML = '<span class="detail-ia-chip">NexPlay Rating</span>' + '<span class="detail-ia-na">N/A</span>' + '<span class="detail-ia-hint">No reviews yet — be the first!</span>';
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      var el2 = document.getElementById('detail-ia-rating');
      if (el2) el2.innerHTML = '<span class="detail-ia-chip">NexPlay Rating</span> <span class="detail-ia-na">N/A</span>';
    };
    xhr.send();
  }
  function _detailStars(avg) {
    var full = Math.floor(avg);
    var half = avg - full >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    var s = '';
    for (var i = 0; i < full; i++) s += '<span class="detail-ia-star detail-ia-star-full">★</span>';
    if (half) s += '<span class="detail-ia-star detail-ia-star-half">★</span>';
    for (var j = 0; j < empty; j++) s += '<span class="detail-ia-star detail-ia-star-empty">★</span>';
    return s;
  }
  function render(container, params) {
    var id = params.id;
    var type = params.type || 'movie';
    container.innerHTML = "\n      <div id=\"detail-page\" style=\"min-height:1080px;position:relative;\">\n        <div id=\"detail-backdrop\" style=\"position:absolute;top:0;left:0;right:0;bottom:0;\">\n          <div id=\"detail-backdrop-img\" style=\"position:absolute;top:0;left:0;right:0;height:540px;background-size:cover;background-position:center top;\"></div>\n          <div class=\"detail-grad-overlay\" style=\"position:absolute;top:0;left:0;right:0;height:540px;\"></div>\n        </div>\n        <div style=\"position:relative;padding:320px 72px 60px;\">\n          <div id=\"detail-content\" style=\"max-width:700px;\">\n            <div id=\"detail-genres\" class=\"detail-genres-text\" style=\"font-size:14px;margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;\"></div>\n            <h1 id=\"detail-title\" class=\"detail-title-text\" style=\"font-size:52px;font-weight:900;margin-bottom:16px;\"></h1>\n            <div id=\"detail-meta\" class=\"detail-meta-text\" style=\"font-size:18px;margin-bottom:10px;\"></div>\n            <div id=\"detail-extra-meta\" class=\"detail-extra-meta-text\" style=\"font-size:14px;margin-bottom:12px;opacity:0.65;\"></div>\n            <div id=\"detail-ia-rating\" class=\"detail-ia-rating\"></div>\n            <p id=\"detail-overview\" class=\"detail-overview-text\" style=\"font-size:20px;line-height:1.7;margin-bottom:36px;max-width:620px;\"></p>\n            <div class=\"detail-btns\">\n              <button class=\"btn btn-primary detail-btn\" id=\"detail-play\" data-nav data-nav-default tabindex=\"0\">\n                &#9654; Play\n              </button>\n              ".concat(type === 'movie' ? "\n              <button class=\"btn btn-secondary detail-btn detail-dl-btn\" id=\"detail-dl\" data-nav tabindex=\"0\">\n                <svg id=\"detail-dl-ico\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"14\" height=\"14\"><path d=\"M12 5v14M5 12l7 7 7-7\"/></svg>\n                <span id=\"detail-dl-lbl\">Download</span>\n              </button>" : '', "\n              <button class=\"btn btn-secondary detail-btn\" id=\"detail-fav\" data-nav tabindex=\"0\">\n                &#9825; Favourite\n              </button>\n              <button class=\"btn btn-secondary detail-btn\" id=\"detail-wl\" data-nav tabindex=\"0\">\n                + Watchlist\n              </button>\n            </div>\n            <!-- Inline download progress \u2014 shown below buttons when downloading -->\n            <div id=\"detail-dl-progress\" class=\"detail-dl-progress\">\n              <div class=\"detail-dl-track\">\n                <div id=\"detail-dl-fill\" class=\"detail-dl-fill\"></div>\n                <span id=\"detail-dl-status\" class=\"detail-dl-status\"></span>\n              </div>\n            </div>\n            <div id=\"detail-cast\" style=\"margin-bottom:40px;\"></div>\n          </div>\n          <!-- Reviews section \u2014 only visible to signed-in users -->\n          <div id=\"detail-reviews\" class=\"detail-reviews-wrap\" style=\"display:none;max-width:760px;padding-bottom:60px;\"></div>\n        </div>\n      </div>");
    Nav.reset(container);
    document.getElementById('detail-play').addEventListener('click', function () {
      App.navigate('player', {
        id: id,
        type: type,
        season: 1,
        episode: 1
      });
    });

    // Download — runs inline on the detail page (no player navigation needed)
    var _detailMovieTitle = '',
      _detailMovieYear = 2020;
    var dlBtn = document.getElementById('detail-dl');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        if (dlBtn.dataset.dlActive === '1') {
          // Cancel the active download
          if (_detailDLController) {
            _detailDLController.abort();
            _detailDLController = null;
          }
        } else {
          _runDetailDownload(id, _detailMovieTitle, _detailMovieYear);
        }
      });
    }

    // Fav / Watchlist buttons — update once data is available
    function refreshListBtns(title, poster, rating) {
      var favBtn = document.getElementById('detail-fav');
      var wlBtn = document.getElementById('detail-wl');
      if (!favBtn || !wlBtn || typeof NexPlayDB === 'undefined') return;
      var isFav = NexPlayDB.isFavourite(id, type);
      var isWL = NexPlayDB.isInWatchlist(id, type);
      favBtn.innerHTML = isFav ? '&#9829; In Favourites' : '&#9825; Favourite';
      favBtn.style.color = isFav ? '#f87171' : '';
      wlBtn.innerHTML = isWL ? '&#10003; In Watchlist' : '+ Watchlist';
      wlBtn.style.color = isWL ? '#4ade80' : '';
      favBtn.onclick = function () {
        var added = NexPlayDB.toggleFavourite(id, type, title, poster, rating);
        App.showToast(added ? 'Added to Favourites' : 'Removed from Favourites');
        refreshListBtns(title, poster, rating);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      };
      wlBtn.onclick = function () {
        var added = NexPlayDB.toggleWatchlist(id, type, title, poster, rating);
        App.showToast(added ? 'Added to Watchlist' : 'Removed from Watchlist');
        refreshListBtns(title, poster, rating);
        if (typeof CloudSync !== 'undefined') CloudSync.syncUp();
      };
    }

    // Wire up placeholders immediately so buttons are focusable
    refreshListBtns('', '', 0);

    // Load data
    var fetchFn = type === 'tv' ? TMDB.tvDetails(parseInt(id)) : TMDB.details(parseInt(id));
    fetchFn.then(function (d) {
      var title = d.title || d.name || '';
      var year = (d.release_date || d.first_air_date || '').slice(0, 4);
      _detailMovieTitle = title;
      _detailMovieYear = parseInt(year) || 2020;
      var rating = d.vote_average ? '★ ' + d.vote_average.toFixed(1) : '';
      var seasons = d.number_of_seasons ? d.number_of_seasons + (d.number_of_seasons === 1 ? ' Season' : ' Seasons') : '';
      var episodes = d.number_of_episodes ? d.number_of_episodes + ' Episodes' : '';
      var runtime = d.runtime ? TMDB.formatRuntime(d.runtime) : [seasons, episodes].filter(Boolean).join(' · ') || '';
      var genres = (d.genres || []).slice(0, 4).map(function (g) {
        return g.name;
      }).join('  |  ');
      var backdrop = d.backdrop_path ? TMDB.backdrop(d.backdrop_path, Config.IMG.BACKDROP_FULL) : '';
      var poster = d.poster_path ? TMDB.img(d.poster_path, Config.IMG.POSTER_MD) : '';
      var titleEl = document.getElementById('detail-title');
      var genresEl = document.getElementById('detail-genres');
      var metaEl = document.getElementById('detail-meta');
      var overviewEl = document.getElementById('detail-overview');
      var bdImg = document.getElementById('detail-backdrop-img');
      var countries = (d.production_countries || []).map(function (c) {
        return c.name;
      }).join(', ');
      var languages = (d.spoken_languages || []).map(function (l) {
        return l.english_name || l.name;
      }).join(', ');
      var extraMeta = [countries ? 'Country: ' + countries : '', languages ? 'Language: ' + languages : ''].filter(Boolean).join('   |   ');
      var extraMetaEl = document.getElementById('detail-extra-meta');
      if (titleEl) titleEl.textContent = title;
      if (genresEl) genresEl.textContent = genres;
      if (metaEl) metaEl.textContent = [year, runtime, rating].filter(Boolean).join('   |   ');
      if (extraMetaEl) extraMetaEl.textContent = extraMeta;
      if (overviewEl) overviewEl.textContent = d.overview || '';
      if (bdImg && backdrop) bdImg.style.backgroundImage = 'url(' + backdrop + ')';

      // In-app rating
      _fetchDetailInAppRating(String(id));

      // Refresh list buttons with real title + poster + rating
      refreshListBtns(title, poster, d.vote_average || 0);

      // Cast
      var credits = d.credits || d.aggregate_credits;
      if (credits && credits.cast && credits.cast.length) {
        var castEl = document.getElementById('detail-cast');
        if (castEl) {
          castEl.innerHTML = '<div class="detail-cast-header" style="font-size:16px;margin-bottom:16px;letter-spacing:1px;text-transform:uppercase;">Cast</div>' + '<div style="display:-webkit-flex;display:flex;flex-wrap:wrap;">' + credits.cast.slice(0, 8).map(function (p) {
            var img = p.profile_path ? TMDB.img(p.profile_path, Config.IMG.POSTER_SM) : '';
            return '<div style="margin-right:28px;margin-bottom:16px;text-align:center;width:80px;">' + (img ? '<img src="' + img + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.15);">' : '<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;">?</div>') + '<div class="detail-cast-name" style="margin-top:8px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;" title="' + p.name + '">' + p.name + '</div>' + '</div>';
          }).join('') + '</div>';
        }
      }
      Nav.reset(container);

      // Load reviews for signed-in users
      _loadReviews(String(id));
    }).catch(function () {});
  }
  return {
    render: render
  };
}();