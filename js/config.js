const Config = {
  // Get your free API key at https://www.themoviedb.org/settings/api
  TMDB_KEY: 'cf2f36167e69da85eead182a65a67baa',
  TMDB_BASE: 'https://api.themoviedb.org/3',
  TMDB_IMG: 'https://image.tmdb.org/t/p',

  // Embed player sources — NexPlay tries Videasy first, falls back to Vidrock
  VIDEASY_BASE: 'https://www.videasy.net',
  VIDROCK_BASE: 'https://vidrock.ru',
  VIDLINK_BASE: 'https://vidlink.pro',
  VSEMBED_BASE: 'https://vsembed.ru',

  // Deno Deploy proxy for VidLink on TV (VidLink CDN is CF-hosted — CF→CF blocked,
  // and uses TLS 1.3 which Tizen 3.0 can't speak). Deploy deno-proxy.js to
  // https://dash.deno.com and set your URL here. Leave '' to use Vidrock on TV.
  VIDLINK_PROXY_URL: 'https://nexplay.boadujnr.deno.net',

  // iptv-org public API (no key required)
  IPTV_API: 'https://iptv-org.github.io/api',

  // Subtitle API key — free key from https://store.wyzie.io/redeem
  // Leave as '' to disable subtitles (app still works without it)
  SUBTITLE_KEY: 'wyzie-5z58waleuedrwul1xxr5tbufcgl0co8k',

  // Google Sign-In — get Client ID from console.cloud.google.com
  // Add your Deno Deploy URL as an Authorized JavaScript Origin
  GOOGLE_CLIENT_ID: '610456713977-0p6gb40a3fjjtbkv8qs8ln08umd1fsqt.apps.googleusercontent.com',
  DEPLOY_URL: 'https://nexplay.boadujnr.deno.net',

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
