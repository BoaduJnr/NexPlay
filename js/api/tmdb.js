class TMDBClient {
  constructor() {
    this._cache = {};
  }

  async _get(endpoint, params = {}) {
    let url = Config.TMDB_BASE + endpoint + '?api_key=' + Config.TMDB_KEY + '&language=en-US';
    const keys = Object.keys(params);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') {
        url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(String(v));
      }
    }
    if (this._cache[url]) return this._cache[url];
    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB ' + res.status + ' on ' + endpoint);
    const data = await res.json();
    this._cache[url] = data;
    return data;
  }

  // ── Movies ───────────────────────────────────────────────
  trending(window = 'week', page = 1) {
    return this._get(`/trending/movie/${window}`, { page });
  }

  popular(page = 1) {
    return this._get('/movie/popular', { page });
  }

  topRated(page = 1) {
    return this._get('/movie/top_rated', { page });
  }

  nowPlaying(page = 1) {
    return this._get('/movie/now_playing', { page });
  }

  upcoming(page = 1) {
    return this._get('/movie/upcoming', { page });
  }

  details(id) {
    return this._get(`/movie/${id}`, {
      append_to_response: 'credits,videos,similar,belongs_to_collection',
    });
  }

  recommendations(id, page = 1) {
    return this._get(`/movie/${id}/recommendations`, { page });
  }

  // ── Genres ───────────────────────────────────────────────
  genres() {
    return this._get('/genre/movie/list');
  }

  // ── Discover (by genre, year, sort, etc.) ────────────────
  discover(opts = {}) {
    return this._get('/discover/movie', {
      sort_by: 'popularity.desc',
      ...opts,
    });
  }

  byGenre(genreId, page = 1, extra = {}) {
    return this.discover({ with_genres: genreId, page, ...extra });
  }

  byYear(year, page = 1) {
    return this.discover({ primary_release_year: year, page });
  }

  // ── Collections / Franchises ─────────────────────────────
  collection(id) {
    return this._get(`/collection/${id}`);
  }

  // Fetch popular movies and extract unique collections from them
  async popularCollections(pages = 3) {
    const seen = new Set();
    const collections = [];
    for (let p = 1; p <= pages; p++) {
      const data = await this.popular(p);
      for (const movie of data.results) {
        if (movie.belongs_to_collection && !seen.has(movie.belongs_to_collection.id)) {
          seen.add(movie.belongs_to_collection.id);
          collections.push(movie.belongs_to_collection);
        }
      }
    }
    return collections;
  }

  // ── TV Series ────────────────────────────────────────────
  tvTrending(window = 'week', page = 1) {
    return this._get(`/trending/tv/${window}`, { page });
  }

  tvPopular(page = 1) {
    return this._get('/tv/popular', { page });
  }

  tvTopRated(page = 1) {
    return this._get('/tv/top_rated', { page });
  }

  tvAiringToday(page = 1) {
    return this._get('/tv/airing_today', { page });
  }

  tvOnTheAir(page = 1) {
    return this._get('/tv/on_the_air', { page });
  }

  tvGenres() {
    return this._get('/genre/tv/list');
  }

  tvDiscover(opts = {}) {
    return this._get('/discover/tv', { sort_by: 'popularity.desc', ...opts });
  }

  tvDetails(id) {
    return this._get(`/tv/${id}`, {
      append_to_response: 'credits,videos,similar',
    });
  }

  tvSeason(id, seasonNumber) {
    return this._get(`/tv/${id}/season/${seasonNumber}`);
  }

  tvRecommendations(id, page = 1) {
    return this._get(`/tv/${id}/recommendations`, { page });
  }

  // ── Search ───────────────────────────────────────────────
  search(query, page = 1) {
    return this._get('/search/movie', { query, page });
  }

  searchTv(query, page = 1) {
    return this._get('/search/tv', { query, page });
  }

  searchMulti(query, page = 1) {
    return this._get('/search/multi', { query, page });
  }

  // ── Images ───────────────────────────────────────────────
  img(path, size = Config.IMG.POSTER_MD) {
    if (!path) return '';
    return `${Config.TMDB_IMG}/${size}${path}`;
  }

  backdrop(path, size = Config.IMG.BACKDROP_LG) {
    if (!path) return '';
    return `${Config.TMDB_IMG}/${size}${path}`;
  }

  // ── Helpers ──────────────────────────────────────────────
  ratingColor(vote) {
    if (vote >= 7.5) return '#4ade80';
    if (vote >= 6) return '#facc15';
    return '#f87171';
  }

  formatRuntime(min) {
    if (!min) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}

const TMDB = new TMDBClient();
