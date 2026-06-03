# NexPlay

A modern Smart TV streaming application built for Samsung Tizen devices. NexPlay provides a feature-rich platform for browsing and watching movies, TV series, live TV (IPTV), and managing collections—all optimized for the TV viewing experience.

## Features

- **Movies & Series**: Browse and stream a curated catalog of movies and TV series
- **Live TV (IPTV)**: Stream live television channels
- **Collections**: Organize and manage your favorite content
- **Multi-Theme Support**: Choose between Default, Bright, and Calm themes
- **HLS Streaming**: Native support for HLS (HTTP Live Streaming) protocol
- **Responsive UI**: Optimized sidebar navigation and full-screen player modal
- **Content Details**: Comprehensive detail pages with metadata and descriptions
- **Persistent Preferences**: Theme and user preferences saved locally

## Project Structure

```
NexPlay/
├── index.html                 # Main application entry point
├── main.js                    # Application initialization
├── config.xml                 # Tizen app configuration
├── css/
│   ├── style.css             # Source styles
│   └── style-dist.css        # Compiled styles
├── js/
│   ├── app.js                # Main app controller & routing
│   ├── config.js             # App configuration
│   ├── nav.js                # Navigation management
│   ├── dropdown.js           # UI dropdown component
│   ├── api/
│   │   ├── db.js             # Local database operations
│   │   ├── iptv.js           # IPTV/Live TV API
│   │   ├── stream.js         # Streaming operations
│   │   └── tmdb.js           # TMDB API integration
│   ├── pages/
│   │   ├── home.js           # Home page
│   │   ├── movies.js         # Movies page
│   │   ├── series.js         # Series page
│   │   ├── iptv.js           # Live TV page
│   │   ├── detail.js         # Content detail page
│   │   ├── player.js         # Video player
│   │   └── collections.js    # Collections page
│   └── components/           # Reusable UI components
├── js-dist/                  # Transpiled JavaScript (Babel output)
├── Debug/
│   └── NexPlay.wgt           # Built widget package
└── package.json              # Project dependencies
```

## Setup & Installation

### Prerequisites
- Node.js and npm
- Samsung Tizen SDK (for deployment)
- Modern web browser or Tizen emulator for testing

### Installation

1. **Clone or download the project**
   ```bash
   cd NexPlay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### Development

The project uses **Babel** for JavaScript transpilation and **PostCSS** for CSS processing.

#### Build Commands

The project doesn't include explicit build scripts in `package.json`. Manual transpilation can be done:

```bash
# Transpile JavaScript (Babel)
npx babel js --out-dir js-dist

# Process CSS (PostCSS)
npx postcss css/style.css -o css/style-dist.css
```

#### Deployment

Deploy to Samsung Tizen device using the deployment script:

```powershell
# PowerShell (Windows)
./deploy-tv.ps1
```

## Technologies

- **Frontend**: Vanilla JavaScript (no framework dependencies)
- **Build Tools**: 
  - Babel (ES6+ transpilation)
  - PostCSS (CSS processing)
  - Playwright (testing)
- **Streaming**: HLS.js for media playback
- **APIs**: 
  - TMDB (Movie & TV metadata)
  - IPTV streams
  - Local database for cache/preferences
- **Platform**: Tizen (Samsung Smart TV)

## Configuration

- **`config.xml`**: Tizen application metadata, privileges, and settings
- **`babel.config.json`**: JavaScript transpilation configuration
- **`postcss.config.js`**: CSS processing pipeline
- **`deploy-config.json`**: TV deployment settings

## Browser Support

- Samsung Tizen devices (TV OS 3.0+)
- Requires ES6+ capable environment
- Tests performed with Playwright

## File Structure Notes

- **Source files**: Located in `js/` and `css/`
- **Built files**: Generated in `js-dist/` and `css/style-dist.css`
- **Distribution**: Packaged as `.wgt` file in `Debug/` directory

## Contributing

When adding new features:

1. Create source files in `js/` (not `js-dist/`)
2. Add styles to `css/style.css`
3. Run transpilation before testing
4. Test on Tizen emulator or device

## License

ISC

## Author

NexPlay Development Team

---

For more information about Tizen development, visit [Tizen Developer Documentation](https://docs.tizen.org/application/web/).
