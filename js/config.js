const Config = {
  // Get your free API key at https://www.themoviedb.org/settings/api
  TMDB_KEY: 'cf2f36167e69da85eead182a65a67baa',
  TMDB_BASE: 'https://api.themoviedb.org/3',
  TMDB_IMG: 'https://image.tmdb.org/t/p',

  // Embed player sources — NexPlay tries Videasy first, falls back to Vidrock
  VIDEASY_BASE: 'https://www.videasy.net',
  VIDROCK_BASE: 'https://vidrock.ru',
  VSEMBED_BASE: 'https://vsembed.ru',

  // iptv-org public API (no key required)
  IPTV_API: 'https://iptv-org.github.io/api',

  // Image sizes used across the app
  IMG: {
    POSTER_SM: 'w185',
    POSTER_MD: 'w342',
    POSTER_LG: 'w500',
    BACKDROP_MD: 'w780',
    BACKDROP_LG: 'w1280',
    BACKDROP_FULL: 'original',
    LOGO: 'w300',
  },

  // Tizen TV remote key codes
  KEYS: {
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    ENTER: 13,
    BACK: 10009,
    PLAY: 415,
    PAUSE: 19,
    PLAY_PAUSE: 10252,
    STOP: 413,
    FF: 417,
    RW: 412,
    INFO: 457,
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,
    ESCAPE: 27,
  },
};
