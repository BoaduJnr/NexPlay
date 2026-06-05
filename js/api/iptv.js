class IPTVClient {
  constructor() {
    this._allChannels = null;
    this._countries   = null;
    this._categories  = null;
  }

  // ── localStorage cache helpers ────────────────────────────
  static _readCache(key, maxAgeMs) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > maxAgeMs) return null;
      return obj.data;
    } catch(e) { return null; }
  }

  static _writeCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) { /* quota exceeded — skip cache */ }
  }

  async _fetchJSON(path) {
    const res = await fetch(`${Config.IPTV_API}${path}`);
    if (!res.ok) throw new Error(`IPTV fetch failed: ${path}`);
    return res.json();
  }

  async getCountries() {
    if (!this._countries) {
      this._countries = await this._fetchJSON('/countries.json');
    }
    return this._countries;
  }

  async getCategories() {
    if (!this._categories) {
      this._categories = await this._fetchJSON('/categories.json');
    }
    return this._categories;
  }

  // ── M3U parser ──────────────────────────────────────────
  // index.m3u format: tvg-id="ChannelName.countrycode@quality"
  // Country is the 2-letter code before @quality, not a tvg-country attr.
  // group-title may contain multiple categories separated by ";".
  static parseM3U(text) {
    var entries = [];
    var lines = text.split('\n');
    var meta = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        meta = {};
        var attrs = line.match(/[\w-]+=(?:"[^"]*"|[^\s,]+)/g) || [];
        attrs.forEach(function(a) {
          var p = a.match(/([\w-]+)="?([^"]*)"?/);
          if (p) meta[p[1]] = p[2];
        });
        var nameM = line.match(/,([^,]+)$/);
        if (nameM) meta._name = nameM[1].trim();
      } else if (line && !line.startsWith('#') && meta) {
        var tvgId   = meta['tvg-id'] || '';
        // Extract country from tvg-id suffix ".xx@quality" or ".xx"
        var cc      = tvgId.match(/\.([a-zA-Z]{2})(?:@|$)/);
        var country = cc ? cc[1].toUpperCase() : '';
        // Base ID for grouping: strip @quality suffix so HD+SD share one card
        var baseId  = tvgId.replace(/@[^@]*$/, '') || '';
        // Split semicolon-separated group-titles into individual categories
        var cats = meta['group-title']
          ? meta['group-title'].split(';').map(function(c) {
              return c.trim().toLowerCase().replace(/\s+/g, '-');
            }).filter(Boolean)
          : [];
        entries.push({
          id:         baseId,
          name:       meta['tvg-name'] || meta._name || baseId,
          logo:       meta['tvg-logo'] || '',
          country:    country,
          categories: cats,
          is_nsfw:    false,
          url:        line,
        });
        meta = null;
      }
      // skip #EXTVLCOPT and other comment lines — they only affect VLC, not our player
    }
    return entries;
  }

  // ── Group M3U entries by base tvg-id → one card, all stream URLs ──
  static groupM3UChannels(entries) {
    var map = {};
    var ordered = [];
    var fallback = 0;
    entries.forEach(function(e) {
      var key = e.id || ('_' + (fallback++));
      if (e.id && map[key]) {
        map[key].urls.push(e.url); // add quality variant to existing card
      } else {
        var ch = Object.assign({}, e, { urls: [e.url] });
        if (e.id) map[key] = ch;
        ordered.push(ch);
      }
    });
    return ordered;
  }

  // ── Primary source: index.m3u — 2.1 MB, single file, no ID mismatch ──
  async getAllChannels() {
    if (this._allChannels) return this._allChannels;
    var cached = IPTVClient._readCache('np_iptv_m3u_v2', 12 * 60 * 60 * 1000); // 12h; v2 = country+category fix
    if (cached) { this._allChannels = cached; return cached; }
    var res = await fetch('https://iptv-org.github.io/iptv/index.m3u');
    if (!res.ok) throw new Error('index.m3u fetch failed');
    var text = await res.text();
    var entries  = IPTVClient.parseM3U(text);
    var channels = IPTVClient.groupM3UChannels(entries);
    IPTVClient._writeCache('np_iptv_m3u_v2', channels);
    this._allChannels = channels;
    return channels;
  }

  // ── filterChannels now uses index.m3u (replaces channels.json + streams.json) ──
  async filterChannels({ country = '', category = '' } = {}) {
    var all = await this.getAllChannels();
    return all.filter(function(ch) {
      if (ch.is_nsfw) return false;
      if (country && ch.country !== country.toUpperCase()) return false;
      if (category && !ch.categories.includes(category)) return false;
      return true;
    });
  }
}

const IPTV = new IPTVClient();
