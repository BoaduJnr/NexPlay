'use strict';

/*
 * GoogleAuth — Google Sign-In (web) + TV Connect flow.
 *
 * Profile panel layout:
 *   ── Profile ──────────────
 *   ID / Code   g_xxx  [Copy]
 *   First Name  George
 *   Last Name   Boadu
 *   Email       george@...
 *
 *   ── Settings ─────────────
 *   Theme   [Calm] [Bright] [Night]
 *           [↻ Sync Now]
 *
 *   [Sign Out]  (web) | [Disconnect] (TV)
 *
 * Tizen 3.0 compatible: no async/await, no arrow functions, no for-of.
 */
var GoogleAuth = function () {
  var _user = null;
  var _panel = null;
  var _heartbeatTimer = null;
  var _statusHidden = false;

  // ── Chat state ─────────────────────────────────────────
  var _activeTab = 'settings'; // 'settings' | 'chats'
  var _chatView = 'list'; // 'list' | 'thread' | 'new'
  var _chatWith = null; // { uid, name, picture } current thread
  var _chatCode = ''; // this user's NP-code (separate from TV sync code)
  var _chatPollTimer = null;
  var _chatMsgCount = 0;
  var _currentGroup = null; // { id, name } when in a group thread

  // ── Helpers ───────────────────────────────────────────
  function _isTV() {
    return !document.body.classList.contains('is-web');
  }
  function _escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _currentUid() {
    try {
      return localStorage.getItem('np_sync_uid') || '';
    } catch (e) {
      return '';
    }
  }
  function _isTVConnected() {
    return _isTV() && _currentUid().indexOf('g_') === 0;
  }
  function _currentTheme() {
    return localStorage.getItem('nexplay-theme') || 'theme-calm';
  }

  // ── Presence / online status ──────────────────────────
  function _presenceBase() {
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || window.location.protocol === 'https:') return '';
    if (typeof Config !== 'undefined' && Config.DEPLOY_URL) return Config.DEPLOY_URL;
    return '';
  }
  function _loadPrivacy() {
    _statusHidden = localStorage.getItem('np_status_hidden') === '1';
  }
  function _savePrivacy(hidden) {
    _statusHidden = hidden;
    try {
      localStorage.setItem('np_status_hidden', hidden ? '1' : '0');
    } catch (e) {}
  }
  function _sendPresence() {
    if (!_user) return;
    var base = _presenceBase();
    if (!base && window.location.protocol === 'file:') return; // no server
    var uid = 'g_' + _user.sub;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', base + '/api/presence', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 5000;
    xhr.send(JSON.stringify({
      uid: uid,
      hidden: _statusHidden
    }));
  }
  function _startHeartbeat() {
    _stopHeartbeat();
    _sendPresence();
    _heartbeatTimer = setInterval(_sendPresence, 60000); // every 60s
    // Also send when tab regains focus
    document.addEventListener('visibilitychange', _onVisibility);
  }
  function _stopHeartbeat() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
    document.removeEventListener('visibilitychange', _onVisibility);
  }
  function _onVisibility() {
    if (!document.hidden) _sendPresence();
  }

  // ── Chat API helpers ──────────────────────────────────
  function _chatApiBase() {
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || window.location.protocol === 'https:') return '';
    if (typeof Config !== 'undefined' && Config.DEPLOY_URL) return Config.DEPLOY_URL;
    return '';
  }
  function _loadChatList(cb) {
    var uid = _currentUid();
    if (!uid) {
      cb([]);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _chatApiBase() + '/api/chats?uid=' + encodeURIComponent(uid), true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      try {
        cb(JSON.parse(xhr.responseText) || []);
      } catch (e) {
        cb([]);
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      cb([]);
    };
    xhr.send();
  }
  function _loadChatThread(otherUid, cb) {
    var uid = _currentUid();
    if (!uid || !otherUid) {
      cb([]);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', _chatApiBase() + '/api/chat?uid1=' + encodeURIComponent(uid) + '&uid2=' + encodeURIComponent(otherUid), true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      try {
        cb(JSON.parse(xhr.responseText) || []);
      } catch (e) {
        cb([]);
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      cb([]);
    };
    xhr.send();
  }
  function _sendChatMessage(toUid, toName, toPicture, text, cb) {
    if (!_user || !toUid || !text) return;
    var payload = JSON.stringify({
      fromUid: 'g_' + _user.sub,
      fromName: (_user.firstName || '') + (_user.lastName ? ' ' + _user.lastName : ''),
      fromPicture: _user.picture || '',
      toUid: toUid,
      toName: toName || '',
      toPicture: toPicture || '',
      text: text
    });
    var xhr = new XMLHttpRequest();
    xhr.open('POST', _chatApiBase() + '/api/chat', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    xhr.onload = function () {
      cb && cb(xhr.status === 200);
    };
    xhr.onerror = xhr.ontimeout = function () {
      cb && cb(false);
    };
    xhr.send(payload);
  }

  // ── Chat code registration ────────────────────────────
  // Registers (or retrieves) a unique NP-code for this Google user.
  // Completely separate from the TV sync/connect code.
  // ── Group API helpers ─────────────────────────────────
  function _groupApiCall(method, path, body, cb) {
    var base = _chatApiBase();
    var xhr = new XMLHttpRequest();
    xhr.open(method, base + path, true);
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    xhr.onload = function () {
      try {
        cb(null, JSON.parse(xhr.responseText));
      } catch (e) {
        cb(null, null);
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      cb('error', null);
    };
    xhr.send(body ? JSON.stringify(body) : null);
  }
  function _createGroup(groupName, cb) {
    if (!_user) return;
    _groupApiCall('POST', '/api/group_create', {
      uid: 'g_' + _user.sub,
      name: (_user.firstName || '') + (_user.lastName ? ' ' + _user.lastName : ''),
      picture: _user.picture || '',
      groupName: groupName
    }, cb);
  }
  function _lookupGroup(gid, cb) {
    _groupApiCall('GET', '/api/group_info?id=' + encodeURIComponent(gid.toUpperCase()), null, cb);
  }
  function _joinGroup(gid, cb) {
    if (!_user) return;
    _groupApiCall('POST', '/api/group_join', {
      uid: 'g_' + _user.sub,
      name: (_user.firstName || '') + (_user.lastName ? ' ' + _user.lastName : ''),
      picture: _user.picture || '',
      groupId: gid.toUpperCase()
    }, cb);
  }
  function _loadGroupList(cb) {
    var uid = _currentUid();
    if (!uid) {
      cb([]);
      return;
    }
    _groupApiCall('GET', '/api/group_list?uid=' + encodeURIComponent(uid), null, function (err, data) {
      cb(Array.isArray(data) ? data : []);
    });
  }
  function _loadGroupMsgs(gid, cb) {
    _groupApiCall('GET', '/api/group_msgs?id=' + encodeURIComponent(gid.toUpperCase()), null, function (err, data) {
      cb(Array.isArray(data) ? data : []);
    });
  }
  function _sendGroupMsg(gid, text, cb) {
    if (!_user) return;
    _groupApiCall('POST', '/api/group_msg', {
      uid: 'g_' + _user.sub,
      name: (_user.firstName || '') + (_user.lastName ? ' ' + _user.lastName : ''),
      picture: _user.picture || '',
      groupId: gid.toUpperCase(),
      text: text
    }, cb);
  }
  function _deleteChat(otherUid, cb) {
    var uid = _currentUid();
    if (!uid || !otherUid) {
      if (cb) cb(false);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('DELETE', _chatApiBase() + '/api/chat?uid=' + encodeURIComponent(uid) + '&other=' + encodeURIComponent(otherUid), true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (cb) cb(xhr.status === 200);
    };
    xhr.onerror = xhr.ontimeout = function () {
      if (cb) cb(false);
    };
    xhr.send();
  }
  function _leaveGroup(gid, cb) {
    var uid = _currentUid();
    if (!uid || !gid) {
      if (cb) cb(false);
      return;
    }
    _groupApiCall('POST', '/api/group_leave', {
      uid: uid,
      groupId: gid.toUpperCase()
    }, function (err, ok) {
      if (cb) cb(!err && !!ok);
    });
  }
  function _registerChatCode(user) {
    if (!user) return;
    var base = _chatApiBase();
    if (!base && window.location.protocol === 'file:') return;
    var cached = '';
    try {
      cached = localStorage.getItem('np_chat_code') || '';
    } catch (e) {}
    if (cached) {
      _chatCode = cached;
      return;
    } // already registered this session
    var xhr = new XMLHttpRequest();
    xhr.open('POST', base + '/api/chat_code', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      try {
        var data = JSON.parse(xhr.responseText);
        if (data && data.code) {
          _chatCode = data.code;
          try {
            localStorage.setItem('np_chat_code', data.code);
          } catch (e) {}
          // Update DOM if settings panel is currently open
          var codeEl = document.getElementById('acct-chat-code-val');
          if (codeEl) {
            codeEl.textContent = data.code;
          }
          // Also update the copy button title
          var copyBtn = document.getElementById('acct-copy-chat-code');
          if (copyBtn) copyBtn.disabled = false;
        }
      } catch (e) {}
    };
    xhr.onerror = xhr.ontimeout = function () {
      // Retry once after 5s (handles transient server unavailability)
      setTimeout(function () {
        if (!_chatCode && _user) _registerChatCode(_user);
      }, 5000);
    };
    xhr.send(JSON.stringify({
      uid: 'g_' + user.sub,
      name: (user.firstName || '') + (user.lastName ? ' ' + user.lastName : ''),
      picture: user.picture || ''
    }));
  }

  // Look up a user by their chat code
  function _lookupChatCode(code, cb) {
    var base = _chatApiBase();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + '/api/chat_code?code=' + encodeURIComponent(code.toUpperCase()), true);
    xhr.timeout = 6000;
    xhr.onload = function () {
      if (xhr.status !== 200) {
        cb(null);
        return;
      }
      try {
        cb(JSON.parse(xhr.responseText));
      } catch (e) {
        cb(null);
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      cb(null);
    };
    xhr.send();
  }
  function _tvProfile() {
    try {
      var s = localStorage.getItem('np_tv_profile');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  // ── Restore web session ───────────────────────────────
  function _loadUser() {
    try {
      var s = localStorage.getItem('np_user');
      if (s) _user = JSON.parse(s);
    } catch (e) {
      _user = null;
    }
  }

  // ── Decode Google JWT ─────────────────────────────────
  function _parseJwt(token) {
    try {
      var b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64));
    } catch (e) {
      return null;
    }
  }

  // ── GIS credential callback ───────────────────────────
  function _onCredential(response) {
    var p = _parseJwt(response.credential);
    if (!p) return;
    _user = {
      sub: p.sub,
      email: p.email || '',
      firstName: p.given_name || '',
      lastName: p.family_name || '',
      name: p.name || '',
      picture: p.picture || ''
    };
    try {
      localStorage.setItem('np_user', JSON.stringify(_user));
    } catch (e) {}
    var uid = 'g_' + _user.sub;
    try {
      localStorage.setItem('np_sync_uid', uid);
    } catch (e) {}
    if (typeof CloudSync !== 'undefined') {
      CloudSync.init();
      CloudSync.syncDown();
    }
    _startHeartbeat();
    _registerChatCode(_user);
    _updateUI();
    closePanel();
    if (typeof App !== 'undefined') App.showToast('Signed in as ' + (_user.firstName || _user.email));
  }

  // ── Init ─────────────────────────────────────────────
  function init() {
    _loadUser();
    _loadPrivacy();
    if (typeof google !== 'undefined' && google.accounts && Config.GOOGLE_CLIENT_ID) {
      google.accounts.id.initialize({
        client_id: Config.GOOGLE_CLIENT_ID,
        callback: _onCredential,
        auto_select: true,
        cancel_on_tap_outside: true
      });
      if (!_user) google.accounts.id.prompt(function () {});
    }
    if (_user) {
      _startHeartbeat();
      _registerChatCode(_user);
    }
    // Restore cached chat code
    try {
      var cc = localStorage.getItem('np_chat_code');
      if (cc) _chatCode = cc;
    } catch (e) {}
    _updateUI();
  }

  // ── Sign out (web) ────────────────────────────────────
  function signOut() {
    if (typeof google !== 'undefined' && google.accounts) google.accounts.id.disableAutoSelect();
    _user = null;
    try {
      localStorage.removeItem('np_user');
      localStorage.removeItem('np_chat_code');
      localStorage.setItem('np_sync_uid', 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
    } catch (e) {}
    _chatCode = '';
    _stopHeartbeat();
    if (typeof CloudSync !== 'undefined') CloudSync.init();
    _updateUI();
    closePanel();
    if (typeof App !== 'undefined') App.showToast('Signed out');
  }

  // ── Disconnect (TV) ───────────────────────────────────
  function disconnect() {
    _stopHeartbeat();
    try {
      localStorage.removeItem('np_tv_profile');
      localStorage.setItem('np_sync_uid', 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
    } catch (e) {}
    if (typeof CloudSync !== 'undefined') CloudSync.init();
    _updateUI();
    closePanel();
    if (typeof App !== 'undefined') App.showToast('Disconnected');
  }

  // ── TV: apply connect code ────────────────────────────
  function _connectTV(code) {
    var t = (code || '').trim();
    if (!t) {
      if (typeof App !== 'undefined') App.showToast('Please enter your connect code');
      return;
    }
    if (!/^[a-z0-9_\-]{5,50}$/.test(t)) {
      if (typeof App !== 'undefined') App.showToast('Invalid code — copy it exactly from the web app');
      return;
    }
    try {
      localStorage.setItem('np_sync_uid', t);
    } catch (e) {}
    closePanel();
    if (typeof App !== 'undefined') App.showToast('Connecting…');
    if (typeof CloudSync !== 'undefined') {
      CloudSync.init();
      CloudSync.syncDown().then(function () {
        _updateUI();
        if (typeof App !== 'undefined') App.showToast('Connected! Your data has been synced.');
      });
    } else {
      _updateUI();
    }
  }

  // ── Update nav + FAB ──────────────────────────────────
  function _updateUI() {
    var navInner = document.getElementById('nav-account-inner');
    var fabEl = document.getElementById('account-fab');
    var onTV = _isTV();

    // Online dot shown on own avatar (always — you're clearly online if you're viewing the app)
    var onlineDot = '<span class="online-dot online-dot-self"></span>';
    if (_user) {
      var av = _user.picture ? '<span class="av-wrap"><img src="' + _escHtml(_user.picture) + '" class="nav-account-avatar" alt="">' + onlineDot + '</span>' : '<span class="av-wrap nav-account-initials">' + (_user.firstName[0] || '?') + onlineDot + '</span>';
      if (navInner) navInner.innerHTML = av + '<span class="nav-label">' + _escHtml(_user.firstName || 'Account') + '</span>';
      if (fabEl) {
        fabEl.innerHTML = (_user.picture ? '<img src="' + _escHtml(_user.picture) + '" class="fab-avatar" alt="">' : '<span class="fab-initials">' + (_user.firstName[0] || '?') + '</span>') + '<span class="online-dot online-dot-fab"></span>';
        fabEl.title = _user.name;
      }
    } else if (onTV && _isTVConnected()) {
      var prof = _tvProfile();
      if (prof && prof.picture) {
        if (navInner) navInner.innerHTML = '<img src="' + _escHtml(prof.picture) + '" class="nav-account-avatar" alt=""><span class="nav-label">' + _escHtml(prof.firstName || 'Account') + '</span>';
      } else {
        if (navInner) navInner.innerHTML = _ICON_LINK + '<span class="nav-label">' + _escHtml(prof && prof.firstName || 'Account') + '</span>';
      }
    } else if (onTV) {
      if (navInner) navInner.innerHTML = _ICON_PERSON + '<span class="nav-label">Connect</span>';
    } else {
      if (navInner) navInner.innerHTML = _ICON_PERSON + '<span class="nav-label">Sign In</span>';
      if (fabEl) {
        fabEl.innerHTML = _ICON_PERSON_SM;
        fabEl.title = 'Sign In';
      }
    }
  }

  // ── Open / close panel ────────────────────────────────
  function openPanel() {
    if (_panel) {
      closePanel();
      return;
    }
    _activeTab = 'settings';
    _chatView = 'list';
    _chatWith = null;

    // Ensure chat code is available — register if still missing
    if (_user && !_chatCode) _registerChatCode(_user);
    _panel = document.createElement('div');
    _panel.id = 'account-panel-wrap';
    _panel.className = 'account-panel-wrap';
    _panel.innerHTML = _buildPanelHTML();
    document.body.appendChild(_panel);

    // Google renderButton
    var gBtn = document.getElementById('g-btn-container');
    if (gBtn && typeof google !== 'undefined' && google.accounts && Config.GOOGLE_CLIENT_ID) {
      google.accounts.id.renderButton(gBtn, {
        theme: 'outline',
        size: 'large',
        width: 268,
        text: 'sign_in_with',
        shape: 'rectangular',
        logo_alignment: 'left'
      });
    }

    // Theme buttons
    var themeBtns = _panel.querySelectorAll('[data-theme]');
    for (var i = 0; i < themeBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var t = btn.getAttribute('data-theme');
          if (typeof App !== 'undefined' && App.applyTheme) App.applyTheme(t);
          // Update active state
          var all = _panel.querySelectorAll('[data-theme]');
          for (var j = 0; j < all.length; j++) all[j].classList.toggle('active', all[j].getAttribute('data-theme') === t);
        });
      })(themeBtns[i]);
    }

    // Copy UID
    // Copy sync/TV code
    var btnCopy = document.getElementById('acct-copy-code');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        var code = _currentUid();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(function () {
            btnCopy.textContent = 'Copied!';
            setTimeout(function () {
              btnCopy.textContent = 'Copy';
            }, 2000);
          }).catch(function () {
            _copyFallback(code, btnCopy);
          });
        } else {
          _copyFallback(code, btnCopy);
        }
      });
    }
    // Copy chat code
    var btnCopyChatCode = document.getElementById('acct-copy-chat-code');
    if (btnCopyChatCode) {
      btnCopyChatCode.addEventListener('click', function () {
        var code = _chatCode || '…';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(function () {
            btnCopyChatCode.textContent = 'Copied!';
            setTimeout(function () {
              btnCopyChatCode.textContent = 'Copy';
            }, 2000);
          }).catch(function () {
            _copyFallback(code, btnCopyChatCode);
          });
        } else {
          _copyFallback(code, btnCopyChatCode);
        }
      });
    }

    // TV connect input
    var inp = document.getElementById('acct-code-input');
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.keyCode === 13) _connectTV(inp.value);
      });
      inp.addEventListener('input', function (e) {
        e.stopPropagation();
      });
      setTimeout(function () {
        inp.focus();
      }, 80);
    }
    var btnConnect = document.getElementById('acct-connect-btn');
    if (btnConnect) btnConnect.addEventListener('click', function () {
      _connectTV(inp ? inp.value : '');
    });

    // Sync Now
    var btnSync = document.getElementById('acct-sync-btn');
    if (btnSync) {
      btnSync.addEventListener('click', function () {
        btnSync.disabled = true;
        btnSync.textContent = 'Syncing…';
        var act = _isTV() ? typeof CloudSync !== 'undefined' ? CloudSync.syncDown() : Promise.resolve() : typeof CloudSync !== 'undefined' ? CloudSync.syncUp() : Promise.resolve();
        act.then(function () {
          btnSync.disabled = false;
          btnSync.innerHTML = _ICON_SYNC + ' Sync Now';
          if (typeof App !== 'undefined') App.showToast('Sync complete');
        });
      });
    }

    // Online status privacy toggle
    var statusCb = document.getElementById('acct-status-cb');
    var statusLbl = document.getElementById('acct-status-lbl');
    if (statusCb) {
      statusCb.addEventListener('change', function () {
        var visible = statusCb.checked;
        _savePrivacy(!visible); // hidden = !visible
        if (statusLbl) statusLbl.textContent = visible ? 'Visible' : 'Hidden';
        _sendPresence(); // update server immediately
      });
    }

    // Tab switching
    var tabs = _panel.querySelectorAll('.acct-tab');
    for (var ti = 0; ti < tabs.length; ti++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          var t = tab.getAttribute('data-tab');
          _activeTab = t;
          _chatView = 'list';
          _chatWith = null;
          // Update active class
          var allTabs = _panel.querySelectorAll('.acct-tab');
          for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.toggle('active', allTabs[i].getAttribute('data-tab') === t);
          // Show/hide panes
          var settingsPan = document.getElementById('acct-pane-settings');
          var chatsPan = document.getElementById('acct-pane-chats');
          if (settingsPan) settingsPan.style.display = t === 'settings' ? '' : 'none';
          if (chatsPan) chatsPan.style.display = t === 'chats' ? '' : 'none';
          // Load chat list when chats tab opens
          if (t === 'chats') _renderChatListPane(); // use _chatBody() — don't destroy the inner div
        });
      })(tabs[ti]);
    }

    // Sign out / disconnect / change / close
    var btnOut = document.getElementById('acct-signout-btn');
    var btnDisc = document.getElementById('acct-disconnect-btn');
    var btnChg = document.getElementById('acct-change-btn');
    var btnCl = document.getElementById('acct-close-btn');
    if (btnOut) btnOut.addEventListener('click', function () {
      signOut();
    });
    if (btnDisc) btnDisc.addEventListener('click', function () {
      disconnect();
    });
    if (btnChg) btnChg.addEventListener('click', function () {
      closePanel();
      setTimeout(openPanel, 50);
    });
    if (btnCl) btnCl.addEventListener('click', function () {
      closePanel();
    });
    _panel.addEventListener('click', function (e) {
      if (e.target === _panel) closePanel();
    });
    setTimeout(function () {
      var f = document.getElementById('acct-close-btn');
      if (f && typeof Nav !== 'undefined') Nav.focusEl(f);
    }, 80);
  }
  function _copyFallback(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    setTimeout(function () {
      btn.textContent = 'Copy';
    }, 2000);
  }
  function closePanel() {
    _stopChatPoll(); // always stop polling when panel closes
    if (_panel && _panel.parentNode) _panel.parentNode.removeChild(_panel);
    _panel = null;
  }

  // ── Build panel HTML ──────────────────────────────────
  // ── Chat pane renderers ───────────────────────────────

  function _chatBody() {
    return document.getElementById('acct-chat-body');
  }
  function _renderChatListPane(container) {
    var el = container || _chatBody();
    if (!el) return;
    el.innerHTML = '<div class="acct-chat-loading">Loading…</div>';
    // Load both DMs and groups in parallel
    var dmsLoaded = false,
      groupsLoaded = false;
    var dms = [],
      groups = [];
    function _render() {
      if (!dmsLoaded || !groupsLoaded) return;
      if (!el.parentNode) return;

      // Merge + sort by lastTs
      var dmItems = dms.map(function (c) {
        return {
          _type: 'dm',
          _ts: c.lastTs || 0,
          data: c
        };
      });
      var grpItems = groups.map(function (g) {
        return {
          _type: 'group',
          _ts: g.lastTs || 0,
          data: g
        };
      });
      var all = dmItems.concat(grpItems).sort(function (a, b) {
        return b._ts - a._ts;
      });
      var html = '<div class="acct-chat-list-hd">' + '<span class="acct-chat-list-title">Chats</span>' + '<button class="acct-chat-new-btn" id="acct-chat-new">+ New</button>' + '</div>';
      if (!all.length) {
        html += '<div class="acct-chat-empty">No chats yet.<br>Start a DM or create a group.</div>';
      } else {
        html += '<div class="acct-chat-list">';
        all.forEach(function (item) {
          if (item._type === 'dm') {
            var c = item.data;
            html += '<div class="acct-chat-item" data-type="dm" data-uid="' + _escHtml(c.otherUid) + '" data-name="' + _escHtml(c.otherName || '') + '" data-pic="' + _escHtml(c.otherPicture || '') + '">' + '<div class="acct-chat-item-av">' + (c.otherPicture ? '<img src="' + _escHtml(c.otherPicture) + '" class="acct-chat-av" onerror="this.style.display=\'none\'">' : '<div class="acct-chat-av-ph">' + (c.otherName || '?')[0].toUpperCase() + '</div>') + '</div>' + '<div class="acct-chat-item-body">' + '<div class="acct-chat-item-name">' + _escHtml(c.otherName || 'Unknown') + '</div>' + '<div class="acct-chat-item-last">' + _escHtml((c.lastMsg || '').slice(0, 40)) + '</div>' + '</div>' + '<div class="acct-chat-item-time">' + _chatTimeAgo(c.lastTs || 0) + '</div>' + '</div>';
          } else {
            var g = item.data;
            html += '<div class="acct-chat-item acct-chat-item-group" data-type="group" data-gid="' + _escHtml(g.id) + '" data-gname="' + _escHtml(g.name || '') + '">' + '<div class="acct-chat-item-av">' + '<div class="acct-group-av">👥</div>' + '</div>' + '<div class="acct-chat-item-body">' + '<div class="acct-chat-item-name">' + _escHtml(g.name || 'Group') + ' <span class="acct-group-tag">Group</span></div>' + '<div class="acct-chat-item-last">' + (g.memberCount ? g.memberCount + ' members' : '') + (g.lastMsg ? ' · ' + _escHtml(g.lastMsg.slice(0, 30)) : '') + '</div>' + '</div>' + '<div class="acct-chat-item-time">' + _chatTimeAgo(g.lastTs || 0) + '</div>' + '</div>';
          }
        });
        html += '</div>';
      }
      el.innerHTML = html;

      // Wire DM clicks
      var items = el.querySelectorAll('.acct-chat-item[data-type="dm"]');
      for (var i = 0; i < items.length; i++) {
        (function (item) {
          item.addEventListener('click', function () {
            _chatWith = {
              uid: item.getAttribute('data-uid'),
              name: item.getAttribute('data-name'),
              picture: item.getAttribute('data-pic')
            };
            _chatView = 'thread';
            _chatMsgCount = 0;
            _renderChatThread();
          });
        })(items[i]);
      }
      // Wire group clicks
      var gitems = el.querySelectorAll('.acct-chat-item[data-type="group"]');
      for (var j = 0; j < gitems.length; j++) {
        (function (item) {
          item.addEventListener('click', function () {
            _currentGroup = {
              id: item.getAttribute('data-gid'),
              name: item.getAttribute('data-gname')
            };
            _chatView = 'group';
            _chatMsgCount = 0;
            _renderGroupThread();
          });
        })(gitems[j]);
      }
      // New button → show choice
      var newBtn = document.getElementById('acct-chat-new');
      if (newBtn) newBtn.addEventListener('click', function () {
        _chatView = 'new-choice';
        _renderNewChoice();
      });
    }
    _loadChatList(function (d) {
      dms = d;
      dmsLoaded = true;
      _render();
    });
    _loadGroupList(function (d) {
      groups = d;
      groupsLoaded = true;
      _render();
    });
  }

  // ── New chat choice ───────────────────────────────────
  function _renderNewChoice() {
    var el = _chatBody();
    if (!el) return;
    el.innerHTML = '<div class="acct-thread-hd">' + '<button class="acct-thread-back" id="acct-nc-back">←</button>' + '<span class="acct-thread-name">New Chat</span>' + '</div>' + '<div class="acct-newchat-body">' + '<button class="acct-new-choice-btn" id="acct-nc-dm">' + '<span style="font-size:18px;">💬</span>' + '<div><div class="acct-nc-btn-title">Direct Message</div><div class="acct-nc-btn-sub">Chat privately with one person</div></div>' + '</button>' + '<button class="acct-new-choice-btn" id="acct-nc-create">' + '<span style="font-size:18px;">👥</span>' + '<div><div class="acct-nc-btn-title">Create Group</div><div class="acct-nc-btn-sub">Start a new group chat, get a code to share</div></div>' + '</button>' + '<button class="acct-new-choice-btn" id="acct-nc-join">' + '<span style="font-size:18px;">🔗</span>' + '<div><div class="acct-nc-btn-title">Join Group</div><div class="acct-nc-btn-sub">Enter a group code from someone else</div></div>' + '</button>' + '</div>';
    var back = document.getElementById('acct-nc-back');
    var dmBtn = document.getElementById('acct-nc-dm');
    var crBtn = document.getElementById('acct-nc-create');
    var joBtn = document.getElementById('acct-nc-join');
    if (back) back.addEventListener('click', function () {
      _chatView = 'list';
      _renderChatListPane();
    });
    if (dmBtn) dmBtn.addEventListener('click', function () {
      _chatView = 'new';
      _renderNewChat();
    });
    if (crBtn) crBtn.addEventListener('click', function () {
      _chatView = 'new-group';
      _renderCreateGroup();
    });
    if (joBtn) joBtn.addEventListener('click', function () {
      _chatView = 'join-group';
      _renderJoinGroup();
    });
  }

  // ── Create group ──────────────────────────────────────
  function _renderCreateGroup() {
    var el = _chatBody();
    if (!el) return;
    el.innerHTML = '<div class="acct-thread-hd">' + '<button class="acct-thread-back" id="acct-cg-back">←</button>' + '<span class="acct-thread-name">Create Group</span>' + '</div>' + '<div class="acct-newchat-body">' + '<div class="acct-chat-empty" style="text-align:left;margin-bottom:10px;">Give your group a name, then share the group code with anyone you want to invite.</div>' + '<input type="text" id="acct-cg-name" class="account-code-input" placeholder="Group name…" maxlength="60" autocomplete="off">' + '<button class="btn btn-primary" id="acct-cg-create" style="width:100%;margin-top:10px;height:44px;">Create Group</button>' + '<div id="acct-cg-result" style="display:none;margin-top:14px;"></div>' + '</div>';
    var back = document.getElementById('acct-cg-back');
    if (back) back.addEventListener('click', function () {
      _chatView = 'new-choice';
      _renderNewChoice();
    });
    var inp = document.getElementById('acct-cg-name');
    var btn = document.getElementById('acct-cg-create');
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.keyCode === 13 && btn) btn.click();
      });
      inp.addEventListener('input', function (e) {
        e.stopPropagation();
      });
      setTimeout(function () {
        inp.focus();
      }, 80);
    }
    if (btn) {
      btn.addEventListener('click', function () {
        var name = inp ? inp.value.trim() : '';
        if (!name) {
          if (typeof App !== 'undefined') App.showToast('Enter a group name');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Creating…';
        _createGroup(name, function (err, data) {
          btn.disabled = false;
          btn.textContent = 'Create Group';
          if (!data || !data.id) {
            if (typeof App !== 'undefined') App.showToast('Failed to create group');
            return;
          }
          var res = document.getElementById('acct-cg-result');
          if (res) {
            res.style.display = '';
            res.innerHTML = '<div class="acct-newchat-found">' + '<div style="width:100%;">' + '<div style="font-size:11px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:rgba(255,255,255,0.40);margin-bottom:6px;">Group Created!</div>' + '<div class="acct-chat-item-name" style="margin-bottom:8px;">' + _escHtml(name) + '</div>' + '<div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.38);margin-bottom:6px;">Group Code — Share this to invite people</div>' + '<div class="account-field-value-row">' + '<span class="account-field-value account-field-mono" id="acct-cg-code">' + _escHtml(data.id) + '</span>' + '<button id="acct-cg-copy" class="account-copy-btn">Copy</button>' + '</div>' + '<button class="btn btn-secondary" id="acct-cg-open" style="width:100%;margin-top:12px;height:38px;">Open Group Chat</button>' + '</div>' + '</div>';
            var copy = document.getElementById('acct-cg-copy');
            if (copy) copy.addEventListener('click', function () {
              if (navigator.clipboard) navigator.clipboard.writeText(data.id).then(function () {
                copy.textContent = 'Copied!';
                setTimeout(function () {
                  copy.textContent = 'Copy';
                }, 2000);
              });else _copyFallback(data.id, copy);
            });
            var open = document.getElementById('acct-cg-open');
            if (open) open.addEventListener('click', function () {
              _currentGroup = {
                id: data.id,
                name: name
              };
              _chatView = 'group';
              _chatMsgCount = 0;
              _renderGroupThread();
            });
          }
        });
      });
    }
  }

  // ── Join group ────────────────────────────────────────
  function _renderJoinGroup() {
    var el = _chatBody();
    if (!el) return;
    el.innerHTML = '<div class="acct-thread-hd">' + '<button class="acct-thread-back" id="acct-jg-back">←</button>' + '<span class="acct-thread-name">Join Group</span>' + '</div>' + '<div class="acct-newchat-body">' + '<div class="acct-chat-empty" style="text-align:left;margin-bottom:10px;">Enter the group code. Group codes start with <strong style="color:#a78bfa;">GC</strong> (e.g. <code>GCABC123</code>). Each group has its own unique code.</div>' + '<div class="acct-newchat-input-wrap">' + '<input type="text" id="acct-jg-code" class="account-code-input acct-newchat-code-inp" placeholder="GCABC123" maxlength="8" autocomplete="off" autocorrect="off" autocapitalize="characters">' + '<button class="acct-thread-send" id="acct-jg-lookup">Look up</button>' + '</div>' + '<div id="acct-jg-result" style="display:none;margin-top:10px;"></div>' + '<button class="btn btn-primary" id="acct-jg-join" style="width:100%;margin-top:10px;height:44px;display:none;">Join Group</button>' + '</div>';
    var back = document.getElementById('acct-jg-back');
    if (back) back.addEventListener('click', function () {
      _chatView = 'new-choice';
      _renderNewChoice();
    });
    var inp = document.getElementById('acct-jg-code');
    var look = document.getElementById('acct-jg-lookup');
    var res = document.getElementById('acct-jg-result');
    var join = document.getElementById('acct-jg-join');
    var _foundGroup = null;
    function doLookup() {
      var code = inp ? inp.value.trim().toUpperCase() : '';
      if (code.length < 8) {
        if (typeof App !== 'undefined') App.showToast('Enter a valid group code');
        return;
      }
      res.style.display = 'none';
      join.style.display = 'none';
      _foundGroup = null;
      look.disabled = true;
      look.textContent = '…';
      _lookupGroup(code, function (err, data) {
        look.disabled = false;
        look.textContent = 'Look up';
        if (!data) {
          res.style.display = '';
          res.innerHTML = '<div class="acct-newchat-notfound">No group found for <strong>' + _escHtml(code) + '</strong>.<br>Check the code and try again.</div>';
          return;
        }
        _foundGroup = {
          id: code,
          name: data.name
        };
        res.style.display = '';
        res.innerHTML = '<div class="acct-newchat-found"><span style="font-size:22px;margin-right:4px;">👥</span><div><div class="acct-chat-item-name">' + _escHtml(data.name) + '</div><div class="acct-chat-item-last">' + data.memberCount + ' member' + (data.memberCount === 1 ? '' : 's') + '</div></div></div>';
        join.style.display = '';
      });
    }
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.keyCode === 13) doLookup();
      });
      inp.addEventListener('input', function (e) {
        e.stopPropagation();
        join.style.display = 'none';
        _foundGroup = null;
      });
      setTimeout(function () {
        inp.focus();
      }, 80);
    }
    if (look) look.addEventListener('click', doLookup);
    if (join) {
      join.addEventListener('click', function () {
        if (!_foundGroup) return;
        join.disabled = true;
        join.textContent = 'Joining…';
        _joinGroup(_foundGroup.id, function (err, data) {
          join.disabled = false;
          join.textContent = 'Join Group';
          if (!data) {
            if (typeof App !== 'undefined') App.showToast('Failed to join group');
            return;
          }
          if (typeof App !== 'undefined') App.showToast('Joined ' + _foundGroup.name + '!');
          _currentGroup = {
            id: _foundGroup.id,
            name: _foundGroup.name
          };
          _chatView = 'group';
          _chatMsgCount = 0;
          _renderGroupThread();
        });
      });
    }
  }

  // ── Group thread ──────────────────────────────────────
  function _renderGroupThread() {
    var el = _chatBody();
    if (!el || !_currentGroup) return;
    var myUid = _currentUid();
    // Capture now — _currentGroup may be nulled externally before the async callback fires
    var currentGroup = _currentGroup;
    if (_chatMsgCount === 0) el.innerHTML = '<div class="acct-chat-loading">Loading messages…</div>';
    _loadGroupMsgs(currentGroup.id, function (msgs) {
      if (!el.parentNode) return;
      _chatMsgCount = msgs.length;
      var prevInput = '';
      var prevEl = document.getElementById('acct-thread-inp');
      if (prevEl) prevInput = prevEl.value;
      var msgsHtml = msgs.length ? msgs.map(function (m) {
        var isMe = m.uid === myUid;
        return '<div class="acct-msg' + (isMe ? ' acct-msg-me' : '') + '">' + (!isMe ? '<div class="acct-group-msg-name">' + _escHtml(m.name || 'Someone') + '</div>' : '') + '<div class="acct-msg-bubble">' + _escHtml(m.text || '') + '</div>' + '<div class="acct-msg-time">' + _chatTimeAgo(m.ts || 0) + '</div>' + '</div>';
      }).join('') : '<div class="acct-chat-empty">No messages yet. Say hello!</div>';
      el.innerHTML = '<div class="acct-thread-hd">' + '<button class="acct-thread-back" id="acct-grp-back">←</button>' + '<div class="acct-thread-who">' + '<span style="font-size:18px;flex-shrink:0;">👥</span>' + '<span class="acct-thread-name">' + _escHtml(currentGroup.name || 'Group') + '</span>' + '</div>' + '<span class="acct-poll-dot" id="acct-new-msg-dot" style="display:none;">●</span>' + '<button class="acct-thread-del" id="acct-grp-leave" title="Leave group" style="margin-left:auto;flex-shrink:0;height:26px;padding:0 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.30);color:#f87171;">Leave</button>' + '</div>' + '<div class="acct-thread-msgs" id="acct-thread-msgs">' + msgsHtml + '</div>' + '<div class="acct-thread-input-row">' + '<input type="text" id="acct-thread-inp" class="acct-thread-inp" placeholder="Message group…" maxlength="500" autocomplete="off" value="' + _escHtml(prevInput) + '">' + '<button class="acct-thread-send" id="acct-thread-send">Send</button>' + '</div>';
      var msgsEl = document.getElementById('acct-thread-msgs');
      if (msgsEl) setTimeout(function () {
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }, 50);
      var backBtn = document.getElementById('acct-grp-back');
      if (backBtn) backBtn.addEventListener('click', function () {
        _stopChatPoll();
        _chatView = 'list';
        _renderChatListPane();
      });

      // Leave group
      var leaveBtn = document.getElementById('acct-grp-leave');
      if (leaveBtn) leaveBtn.addEventListener('click', function () {
        if (!confirm('Leave "' + (currentGroup.name || 'group') + '"? You can rejoin with the group code.')) return;
        leaveBtn.disabled = true;
        leaveBtn.textContent = '…';
        _leaveGroup(currentGroup.id, function (ok) {
          if (ok) {
            _stopChatPoll();
            _currentGroup = null;
            _chatView = 'list';
            _chatMsgCount = 0;
            _renderChatListPane();
            if (typeof App !== 'undefined') App.showToast('You left the group');
          } else {
            leaveBtn.disabled = false;
            leaveBtn.textContent = 'Leave';
            if (typeof App !== 'undefined') App.showToast('Failed to leave group');
          }
        });
      });
      var inp = document.getElementById('acct-thread-inp');
      var send = document.getElementById('acct-thread-send');
      function doSend() {
        var text = inp ? inp.value.trim() : '';
        if (!text) return;
        inp.value = '';
        inp.disabled = true;
        send.disabled = true;
        _sendGroupMsg(currentGroup.id, text, function (err, ok) {
          inp.disabled = false;
          send.disabled = false;
          if (ok) _renderGroupThread();else if (typeof App !== 'undefined') App.showToast('Failed to send');
        });
      }
      if (inp) {
        inp.addEventListener('keydown', function (e) {
          e.stopPropagation();
          if (e.keyCode === 13) doSend();
        });
        inp.addEventListener('input', function (e) {
          e.stopPropagation();
        });
      }
      if (send) send.addEventListener('click', doSend);
      // Start group polling
      _startGroupPoll();
    });
  }
  function _startGroupPoll() {
    _stopChatPoll();
    _chatPollTimer = setInterval(function () {
      if (!_panel || _chatView !== 'group' || !_currentGroup) {
        _stopChatPoll();
        return;
      }
      _loadGroupMsgs(_currentGroup.id, function (msgs) {
        if (msgs.length !== _chatMsgCount) {
          _chatMsgCount = msgs.length;
          _renderGroupThread();
          var dot = document.getElementById('acct-new-msg-dot');
          if (dot) dot.style.display = '';
        }
      });
    }, 5000);
  }
  function _renderChatThread() {
    var el = _chatBody();
    if (!el || !_chatWith) return;
    var myUid = _currentUid();
    // Capture now — _chatWith may be nulled externally before the async callback fires
    var chatWith = _chatWith;

    // Only show loading spinner on the very first open (not on poll refreshes)
    if (_chatMsgCount === 0) {
      el.innerHTML = '<div class="acct-chat-loading">Loading messages…</div>';
    }
    _loadChatThread(chatWith.uid, function (msgs) {
      if (!el.parentNode) return;
      _chatMsgCount = msgs.length; // track for poll comparisons

      var headerAvatar = chatWith.picture ? '<img src="' + _escHtml(chatWith.picture) + '" class="acct-thread-av" onerror="this.style.display=\'none\'">' : '<div class="acct-thread-av-ph">' + (chatWith.name || '?')[0].toUpperCase() + '</div>';
      var msgsHtml = msgs.length ? msgs.map(function (m) {
        var isMe = m.from === myUid;
        return '<div class="acct-msg' + (isMe ? ' acct-msg-me' : '') + '">' + '<div class="acct-msg-bubble">' + _escHtml(m.text || '') + '</div>' + '<div class="acct-msg-time">' + _chatTimeAgo(m.ts || 0) + '</div>' + '</div>';
      }).join('') : '<div class="acct-chat-empty">No messages yet. Say hi!</div>';

      // Preserve the input value across poll refreshes
      var prevInput = '';
      var prevInpEl = document.getElementById('acct-thread-inp');
      if (prevInpEl) prevInput = prevInpEl.value;
      el.innerHTML = '<div class="acct-thread-hd">' + '<button class="acct-thread-back" id="acct-thread-back">←</button>' + '<div class="acct-thread-who">' + headerAvatar + '<span class="acct-thread-name">' + _escHtml(chatWith.name || 'Unknown') + '</span>' + '</div>' + '<span class="acct-poll-dot" id="acct-new-msg-dot" style="display:none;" title="New message">●</span>' + '<button class="acct-thread-del" id="acct-thread-del" title="Delete conversation" style="margin-left:auto;flex-shrink:0;height:26px;padding:0 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;background:rgba(248,113,113,0.10);border:1px solid rgba(248,113,113,0.30);color:#f87171;">Delete</button>' + '</div>' + '<div class="acct-thread-msgs" id="acct-thread-msgs">' + msgsHtml + '</div>' + '<div class="acct-thread-input-row">' + '<input type="text" id="acct-thread-inp" class="acct-thread-inp" placeholder="Type a message…" maxlength="500" autocomplete="off" value="' + _escHtml(prevInput) + '">' + '<button class="acct-thread-send" id="acct-thread-send">Send</button>' + '</div>';

      // Scroll to bottom
      var msgsEl = document.getElementById('acct-thread-msgs');
      if (msgsEl) setTimeout(function () {
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }, 50);

      // Back — stop polling when leaving thread
      var backBtn = document.getElementById('acct-thread-back');
      if (backBtn) backBtn.addEventListener('click', function () {
        _stopChatPoll();
        _chatView = 'list';
        _renderChatListPane();
      });

      // Delete conversation
      var delBtn = document.getElementById('acct-thread-del');
      if (delBtn) delBtn.addEventListener('click', function () {
        if (!confirm('Delete this conversation? The other person can still see it.')) return;
        delBtn.disabled = true;
        delBtn.textContent = '…';
        _deleteChat(chatWith.uid, function (ok) {
          if (ok) {
            _stopChatPoll();
            _chatWith = null;
            _chatView = 'list';
            _chatMsgCount = 0;
            _renderChatListPane();
            if (typeof App !== 'undefined') App.showToast('Conversation deleted');
          } else {
            delBtn.disabled = false;
            delBtn.textContent = 'Delete';
            if (typeof App !== 'undefined') App.showToast('Failed to delete');
          }
        });
      });

      // Start polling now that thread is rendered
      _startChatPoll();

      // Send on Enter or button click
      var inp = document.getElementById('acct-thread-inp');
      var send = document.getElementById('acct-thread-send');
      function doSend() {
        if (!inp) return;
        var text = inp.value.trim();
        if (!text) return;
        inp.value = '';
        inp.disabled = true;
        send.disabled = true;
        _sendChatMessage(chatWith.uid, chatWith.name, chatWith.picture, text, function (ok) {
          inp.disabled = false;
          send.disabled = false;
          if (ok) {
            _renderChatThread();
          } else {
            if (typeof App !== 'undefined') App.showToast('Failed to send');
          }
        });
      }
      if (inp) {
        inp.addEventListener('keydown', function (e) {
          e.stopPropagation();
          if (e.keyCode === 13) doSend();
        });
        inp.addEventListener('input', function (e) {
          e.stopPropagation();
        });
      }
      if (send) send.addEventListener('click', doSend);
    });
  }
  function _renderNewChat() {
    var el = _chatBody();
    if (!el) return;
    el.innerHTML = '<div class="acct-thread-hd">' + '<button class="acct-thread-back" id="acct-newchat-back">←</button>' + '<span class="acct-thread-name">New Chat</span>' + '</div>' + '<div class="acct-newchat-body">' + '<div class="acct-chat-empty" style="text-align:left;margin-bottom:12px;">' + 'Enter the other person\'s <strong style="color:#a78bfa;">Chat Code</strong> (e.g. <code>NPABC123</code>).<br>' + 'They can find it in their <em>Settings tab → Chat Code</em>.' + '</div>' + '<div class="acct-newchat-input-wrap">' + '<input type="text" id="acct-newchat-code" class="account-code-input acct-newchat-code-inp"' + ' placeholder="e.g. NPABC123"' + ' maxlength="8" autocomplete="off" autocorrect="off" autocapitalize="characters">' + '<button class="acct-thread-send" id="acct-newchat-lookup" style="flex-shrink:0;">Look up</button>' + '</div>' + '<div id="acct-newchat-result" class="acct-newchat-result" style="display:none;"></div>' + '<button class="btn btn-primary" id="acct-newchat-start" style="width:100%;margin-top:10px;height:44px;display:none;">Start Chat</button>' + '</div>';
    var backBtn = document.getElementById('acct-newchat-back');
    if (backBtn) backBtn.addEventListener('click', function () {
      _chatView = 'list';
      _renderChatListPane();
    });
    var codeInp = document.getElementById('acct-newchat-code');
    var lookupBtn = document.getElementById('acct-newchat-lookup');
    var resultEl = document.getElementById('acct-newchat-result');
    var startBtn = document.getElementById('acct-newchat-start');
    var _found = null; // { uid, name, picture }

    function doLookup() {
      var code = codeInp ? codeInp.value.trim().toUpperCase() : '';
      if (code.length < 4) {
        if (typeof App !== 'undefined') App.showToast('Enter a valid Chat Code');
        return;
      }
      resultEl.style.display = 'none';
      startBtn.style.display = 'none';
      if (lookupBtn) {
        lookupBtn.disabled = true;
        lookupBtn.textContent = '…';
      }
      _lookupChatCode(code, function (user) {
        if (lookupBtn) {
          lookupBtn.disabled = false;
          lookupBtn.textContent = 'Look up';
        }
        if (!user) {
          resultEl.style.display = '';
          resultEl.innerHTML = '<div class="acct-newchat-notfound">No user found for code <strong>' + _escHtml(code) + '</strong>.<br>Check the code and try again.</div>';
          startBtn.style.display = 'none';
          _found = null;
          return;
        }
        // Prevent chatting with yourself
        if (user.uid && user.uid === _currentUid()) {
          resultEl.style.display = '';
          resultEl.innerHTML = '<div class="acct-newchat-notfound">That\'s your own code! Enter someone else\'s Chat Code to start a conversation.</div>';
          startBtn.style.display = 'none';
          _found = null;
          return;
        }
        _found = user;
        var avHtml = user.picture ? '<img src="' + _escHtml(user.picture) + '" class="acct-chat-av" onerror="this.style.display=\'none\'">' : '<div class="acct-chat-av-ph">' + _escHtml(user.name || '?')[0] + '</div>';
        resultEl.style.display = '';
        resultEl.innerHTML = '<div class="acct-newchat-found">' + '<span class="acct-chat-item-av">' + avHtml + '</span>' + '<div>' + '<div class="acct-chat-item-name">' + _escHtml(user.name || 'Unknown') + '</div>' + '<div class="acct-chat-item-last" style="font-size:11px;">Code: <code>' + _escHtml(code) + '</code></div>' + '</div>' + '</div>';
        startBtn.style.display = '';
      });
    }
    if (codeInp) {
      codeInp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.keyCode === 13) doLookup();
      });
      codeInp.addEventListener('input', function (e) {
        e.stopPropagation();
        startBtn.style.display = 'none';
        _found = null;
      });
      setTimeout(function () {
        codeInp.focus();
      }, 80);
    }
    if (lookupBtn) lookupBtn.addEventListener('click', doLookup);
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        if (!_found) return;
        _chatWith = {
          uid: _found.uid,
          name: _found.name || 'Unknown',
          picture: _found.picture || ''
        };
        _chatView = 'thread';
        _renderChatThread();
      });
    }
  }
  function _chatTimeAgo(ts) {
    if (!ts) return '';
    var diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  }

  // ── Chat message polling ──────────────────────────────
  function _startChatPoll() {
    _stopChatPoll();
    _chatPollTimer = setInterval(function () {
      // Stop if panel closed, view changed, or no thread open
      if (!_panel || _chatView !== 'thread' || !_chatWith) {
        _stopChatPoll();
        return;
      }
      _loadChatThread(_chatWith.uid, function (msgs) {
        // Only re-render if new messages arrived (avoids flicker)
        if (msgs.length !== _chatMsgCount) {
          _chatMsgCount = msgs.length;
          _renderChatThread();
          // Show subtle indicator
          var dot = document.getElementById('acct-new-msg-dot');
          if (dot) dot.style.display = '';
        }
      });
    }, 5000); // poll every 5 seconds
  }
  function _stopChatPoll() {
    if (_chatPollTimer) {
      clearInterval(_chatPollTimer);
      _chatPollTimer = null;
    }
    _chatMsgCount = 0;
  }
  function _buildPanelHTML() {
    var onTV = _isTV();
    var profile = _user || (onTV ? _tvProfile() : null);
    var isConnected = _user && !onTV || onTV && _isTVConnected();

    // ── Profile + Settings panel (signed-in / connected) ─
    if (isConnected) {
      var uid = _currentUid();
      var firstName = profile && profile.firstName || '';
      var lastName = profile && profile.lastName || '';
      var email = profile && profile.email || '';
      var displayName = profile && profile.name || firstName + (lastName ? ' ' + lastName : '') || 'Account';
      var picture = profile && profile.picture || '';
      var avatar = picture ? '<img src="' + _escHtml(picture) + '" class="account-panel-avatar" alt="">' : '<div class="account-panel-avatar-placeholder">' + ((firstName || displayName)[0] || '?').toUpperCase() + '</div>';
      var theme = _currentTheme();

      // Profile fields
      var chatCodeRow = !onTV ? '<div class="account-field">' + '<span class="account-field-label">Chat Code</span>' + '<div class="account-field-value-row">' + '<span class="account-field-value account-field-mono acct-chat-code-val" id="acct-chat-code-val">' + (_chatCode ? _escHtml(_chatCode) : '…') + '</span>' + '<button id="acct-copy-chat-code" class="account-copy-btn" data-nav tabindex="0">Copy</button>' + '</div>' + '</div>' : '';
      var profileSection = '<div class="account-section">' + '<div class="account-section-title">Profile Information</div>' + '<div class="account-field">' + '<span class="account-field-label">' + (onTV ? 'Connect Code' : 'Sync ID') + '</span>' + '<div class="account-field-value-row">' + '<span class="account-field-value account-field-mono">' + _escHtml(uid) + '</span>' + '<button id="acct-copy-code" class="account-copy-btn" data-nav tabindex="0">Copy</button>' + '</div>' + '</div>' + chatCodeRow + _fieldRow('First Name', firstName) + _fieldRow('Last Name', lastName) + _fieldRow('Email', email) + '</div>';

      // Settings
      var settingsSection = '<div class="account-section">' + '<div class="account-section-title">Account Settings</div>' + '<div class="account-field">' + '<span class="account-field-label">Theme</span>' + '<div class="account-theme-btns">' + _themeBtn('Calm', 'theme-calm', theme) + _themeBtn('Bright', 'theme-bright', theme) + _themeBtn('Night', 'theme-night', theme) + '</div>' + '</div>' + '<div class="account-field">' + '<span class="account-field-label">Online Status</span>' + '<label class="acct-status-toggle" title="When off, others cannot see you are online">' + '<input type="checkbox" id="acct-status-cb"' + (_statusHidden ? '' : ' checked') + '>' + '<span class="acct-toggle-track">' + '<span class="acct-toggle-thumb"></span>' + '</span>' + '<span class="acct-toggle-label" id="acct-status-lbl">' + (_statusHidden ? 'Hidden' : 'Visible') + '</span>' + '</label>' + '</div>' + '<button id="acct-sync-btn" class="account-settings-btn" data-nav tabindex="0">' + _ICON_SYNC + ' Sync Now</button>' + '</div>';
      var primaryBtn = onTV ? '<button id="acct-disconnect-btn" class="btn btn-secondary account-panel-btn" data-nav tabindex="0">Disconnect</button>' : '<button id="acct-signout-btn"    class="btn btn-secondary account-panel-btn" data-nav tabindex="0">Sign Out</button>';
      var changeBtn = onTV ? '<button id="acct-change-btn" class="account-panel-btn-ghost" data-nav tabindex="0">Change Code</button>' : '';

      // ── Tab bar (only on web — TV keeps flat layout) ────
      var tabBar = !onTV ? '<div class="acct-tabs">' + '<button class="acct-tab' + (_activeTab === 'settings' ? ' active' : '') + '" data-tab="settings">Settings</button>' + '<button class="acct-tab' + (_activeTab === 'chats' ? ' active' : '') + '" data-tab="chats">' + _ICON_CHAT + ' Chats' + '</button>' + '</div>' : '';
      var settingsPane = '<div id="acct-pane-settings" style="' + (_activeTab !== 'settings' ? 'display:none;' : '') + '">' + profileSection + settingsSection + primaryBtn + changeBtn + '</div>';
      var chatsPane = !onTV ? '<div id="acct-pane-chats" class="acct-chat-pane" style="' + (_activeTab !== 'chats' ? 'display:none;' : '') + '">' + '<div id="acct-chat-body" class="acct-chat-body">' + '<div class="acct-chat-loading">Loading conversations…</div>' + '</div>' + '</div>' : '';
      return '<div class="account-panel account-panel-profile">' + '<button id="acct-close-btn" class="account-panel-close" data-nav tabindex="0">✕</button>' + '<div class="account-panel-avatar-wrap">' + avatar + '</div>' + '<div class="account-panel-name">' + _escHtml(displayName) + '</div>' + tabBar + settingsPane + chatsPane + '</div>';
    }

    // ── TV: enter connect code ───────────────────────────
    if (onTV) {
      return '<div class="account-panel">' + '<button id="acct-close-btn" class="account-panel-close" data-nav tabindex="0">✕</button>' + '<div class="account-panel-title">Connect</div>' + '<div class="account-panel-desc">Enter the TV Connect Code from your NexPlay account on web.</div>' + '<input id="acct-code-input" class="account-code-input" type="text" placeholder="e.g. g_103456789012" autocomplete="off" autocorrect="off" autocapitalize="none">' + '<button id="acct-connect-btn" class="btn btn-primary account-panel-btn" data-nav tabindex="0">Connect</button>' + '</div>';
    }

    // ── Web: signed out ─────────────────────────────────
    var gis = typeof google !== 'undefined' && !!google.accounts;
    var action = gis ? '<div id="g-btn-container" style="margin-top:8px;display:-webkit-flex;display:flex;-webkit-justify-content:center;justify-content:center;"></div>' : '<div class="account-panel-web-hint">Sign in on web:<br><strong>' + _escHtml(Config.DEPLOY_URL || 'nexplay web') + '</strong></div>';
    return '<div class="account-panel">' + '<button id="acct-close-btn" class="account-panel-close" data-nav tabindex="0">✕</button>' + '<div class="account-panel-title">Account</div>' + '<div class="account-panel-desc">Sign in to keep your favourites and watchlist across all your devices.</div>' + action + '</div>';
  }
  function _fieldRow(label, value) {
    if (!value) return '';
    return '<div class="account-field">' + '<span class="account-field-label">' + label + '</span>' + '<span class="account-field-value">' + _escHtml(value) + '</span>' + '</div>';
  }
  function _themeBtn(label, theme, current) {
    return '<button class="account-theme-btn' + (theme === current ? ' active' : '') + '" data-theme="' + theme + '" data-nav tabindex="0">' + label + '</button>';
  }

  // ── Icons ─────────────────────────────────────────────
  var _ICON_PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var _ICON_PERSON_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var _ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  var _ICON_SYNC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align:middle;margin-right:4px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  var _ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align:middle;margin-right:4px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  return {
    init: init,
    signOut: signOut,
    disconnect: disconnect,
    openPanel: openPanel,
    closePanel: closePanel,
    getUser: function getUser() {
      return _user;
    },
    isSignedIn: function isSignedIn() {
      return !!_user;
    }
  };
}();