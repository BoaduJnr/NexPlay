# NexPlay

A streaming application for Samsung Tizen Smart TVs and modern web browsers. Watch movies, TV series and live IPTV channels with a remote-friendly interface on TV and a responsive layout on mobile and desktop.

---

## Live Web App

Hosted at **[nexplay.boadujnr.deno.net](https://nexplay.boadujnr.deno.net)** — works on any browser, no installation needed.

---

## Features

### Content
- **Movies & Series** — browse by genre, search, view details and ratings via TMDB
- **Live TV (IPTV)** — 8 000+ channels from iptv-org, filterable by country and category
- **Favourites** — bookmark movies, series and IPTV channels (RED key on TV)
- **Watchlist** — queue content to watch later (BLUE key on TV)
- **Watch History** — automatic progress tracking; resume where you left off
- **Continue Watching** — episode badges and progress bars on card thumbnails

### Player
- AVPlay (Tizen native) on TV for hardware-accelerated HLS playback
- hls.js on web for browser HLS playback
- **Seek scrub** — D-pad LEFT/RIGHT on the progress bar previews position in yellow; OK commits the seek
- **Quality switching** — select stream resolution mid-playback
- **You Might Also Like** — similar content panel during playback
- **Embed fallback** — if no direct stream is found, falls back to embedded players (2embed, vidsrc.to)

### IPTV
- Channel scanning with green/red/grey status indicators
- **Scan channels** button — verifies up to 300 channels with a full-background progress bar
- **Favourites filter** — show only saved channels
- **Working channels only** filter
- **Ghana Direct** shortcut
- **Programme Guide (EPG)** — current/next programme in the channel bar; full today schedule via the Guide button or INFO key
- Channel favourite badge on card; toggle with RED key without needing to play the channel first

### Themes
Three themes switchable with the **GREEN** key on the remote:

| Theme | Look |
|---|---|
| **Calm** | Deep GitHub-style blues — blue accents throughout |
| **Bright** | Light background, dark text — optimised for bright rooms |
| **Night** | OLED-friendly deep blacks, rich purple |

All accent colours (buttons, progress bars, focus rings, sidebar separator, filter pills) adapt per theme.

### Navigation (TV)
- Full D-pad spatial navigation scoped to the active page
- Auto-hide player UI (4 s timeout); any key reveals it
- Sidebar stays within page sections — UP/DOWN cannot accidentally jump to sidebar items

---

## Platforms

| Platform | How to use |
|---|---|
| Samsung TV (Tizen 3.0+) | Install the `.wgt` package via `deploy-tv.ps1` |
| Web browser | Visit the Deno Deploy URL |
| Mobile / tablet | Visit the same URL; sidebar becomes a bottom tab bar |

---

## Project Structure

```
NexPlay/
├── index.html              Main entry point
├── main.js / main-dist.js  Bootstrap (key bindings, theme cycle)
├── polyfills.js            Tizen 3.0 compatibility shims
├── hls.min.js              HLS.js player library
├── config.xml              Tizen app metadata and privileges
├── server.ts               Deno Deploy static file server
├── bundle-single.js        Generates nexplay-single.ts (single-file deploy)
├── nexplay-single.ts       Self-contained Deno Deploy script (generated)
├── build-deploy.ps1        Prepares deploy-dist/ for manual deployment
├── deploy-tv.ps1           Packages and installs on the Samsung TV
├── stream-test.js          Smoke-tests stream resolution without TV
│
├── css/
│   ├── style.css           Source styles
│   └── style-dist.css      PostCSS output
│
├── js/                     Source files (edit these)
│   ├── app.js              Router, theme manager, sidebar builder
│   ├── nav.js              Spatial D-pad navigation engine
│   ├── config.js           API keys, CDN bases, key codes
│   ├── dropdown.js         TVDropdown component
│   ├── utils.js            Shared helpers (progress bars, badges)
│   ├── api/
│   │   ├── db.js           localStorage: history, favourites, watchlist
│   │   ├── tmdb.js         TMDB movie/series metadata API
│   │   ├── iptv.js         iptv-org M3U parser and channel cache
│   │   ├── stream.js       HLS stream resolver (Videasy → Vidrock → embed)
│   │   └── epg.js          IPTV Electronic Programme Guide client
│   └── pages/
│       ├── home.js         Home page with hero carousel
│       ├── movies.js       Movies grid with genre filter
│       ├── series.js       Series grid with genre/tab filter
│       ├── player.js       Video player (AVPlay + hls.js)
│       ├── iptv.js         Live TV with EPG and channel scan
│       ├── detail.js       Movie/series detail page
│       ├── favourites.js   Favourites collection page
│       └── watchlist.js    Watchlist page
│
└── js-dist/                Babel transpiled output (ES5, Tizen 3.0 compatible)
```

---

## Development

### Prerequisites
- Node.js 18+
- Samsung Tizen Studio (TV deployment only)
- `deployctl` for Deno Deploy (`npm i -g @deno/deployctl`)

### Install
```bash
npm install
```

### Build
```bash
npx babel js/ --out-dir js-dist/
npx postcss css/style.css --output css/style-dist.css
```

### Smoke test (no TV needed)
```bash
node stream-test.js
```

---

## TV Deployment

```powershell
# Connect to TV (Developer Mode ON, Host IP pointing to this machine)
& "C:\tizen-studio\tools\sdb.exe" connect 192.168.x.x:26101

# Run once after cert regeneration
& "C:\tizen-studio\tools\ide\bin\tizen.bat" install-permit -s 192.168.x.x:26101

# Build, package, install and launch
.\deploy-tv.ps1
```

---

## Web Deployment (Deno)

### Single-file bundle (recommended)
```bash
node bundle-single.js
# Outputs nexplay-single.ts (~590 KB)
```
Deploy via Deno Playground (paste file contents) or CLI:
```bash
deployctl deploy --project=YOUR_PROJECT nexplay-single.ts
```

### Static directory
```powershell
.\build-deploy.ps1
cd deploy-dist
deployctl deploy --project=YOUR_PROJECT server.ts
```

---

## Streaming Sources

| Source | Status | Notes |
|---|---|---|
| Videasy | Active (intermittent) | Direct browser call; API can go down |
| Vidrock | Partial | API works; CDN blocked via datacenter IPs |
| Embed fallback | Active | 2embed.cc, vidsrc.to — web only |

### IPTV EPG
- Index: `iptv-org.github.io/api/guides.json`
- Community worker: `worker-9dd4.onrender.com`
- Covered channels (2026): AlJazeera.qa, ANT1Europe.gr

---

## Technologies

| Area | Technology |
|---|---|
| Language | Vanilla JavaScript (ES6 source, ES5 dist) |
| TV player | Samsung AVPlay API |
| Web player | hls.js |
| Build tools | Babel, PostCSS |
| TV platform | Tizen 3.0 (Chromium 56) |
| Web hosting | Deno Deploy |
| Metadata API | TMDB |
| IPTV data | iptv-org |
| Stream proxy | Cloudflare Worker |
| Font | SamsungOne / Samsung Sharp Sans |

---

## Remote Control Keys

| Key | Action |
|---|---|
| D-pad | Navigate |
| OK | Select / confirm seek |
| Back | Go back |
| GREEN | Cycle theme |
| RED | Toggle favourite |
| BLUE | Toggle watchlist |
| INFO | Toggle programme guide (IPTV) |
| PLAY/PAUSE | Playback |
| FF / RW | +30 s / -10 s |
| STOP | Close player |

---

## License

ISC — George Junior Boadu
