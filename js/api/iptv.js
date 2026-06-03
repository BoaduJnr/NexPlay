class IPTVClient {
  constructor() {
    this._channels = null;
    this._streams = null;
    this._countries = null;
    this._categories = null;
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

  async getChannels() {
    if (!this._channels) {
      this._channels = await this._fetchJSON('/channels.json');
    }
    return this._channels;
  }

  async getStreams() {
    if (!this._streams) {
      this._streams = await this._fetchJSON('/streams.json');
    }
    return this._streams;
  }

  // Return channels filtered by country code and/or category id
  async filterChannels({ country = '', category = '' } = {}) {
    const all = await this.getChannels();
    return all.filter(ch => {
      if (ch.is_nsfw) return false;
      if (country && ch.country !== country.toUpperCase()) return false;
      if (category && !ch.categories.includes(category)) return false;
      return true;
    });
  }

  // Find streams for a given channel id
  async getStreamUrl(channelId) {
    const streams = await this.getStreams();
    const match = streams.find(s => s.channel === channelId);
    return match ? match.url : null;
  }

  // Return all streams for a channel id (some channels have multiple)
  async getStreamUrls(channelId) {
    const streams = await this.getStreams();
    return streams.filter(s => s.channel === channelId).map(s => s.url);
  }

  // Group channels by country for the country filter UI
  async channelsByCountry() {
    const [channels, countries] = await Promise.all([
      this.getChannels(),
      this.getCountries(),
    ]);
    const countryMap = {};
    for (const c of countries) countryMap[c.code] = c;

    const grouped = {};
    for (const ch of channels) {
      if (ch.is_nsfw) continue;
      const code = ch.country || 'INTL';
      if (!grouped[code]) grouped[code] = { code, name: (countryMap[code] && countryMap[code].name) || code, channels: [] };
      grouped[code].channels.push(ch);
    }
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Quick lookup: country name from code
  async countryName(code) {
    const countries = await this.getCountries();
    const found = countries.find(c => c.code === code);
    return (found && found.name) || code;
  }
}

const IPTV = new IPTVClient();
