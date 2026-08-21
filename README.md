# Piecework — Jigsaw Studio

A dependency-free, offline-first jigsaw puzzle PWA. Images stay on the device.

## Run locally

Service workers require HTTP(S), so do not open `index.html` directly from the filesystem.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

Upload the contents of this folder to any static host (GitHub Pages, Cloudflare Pages, Netlify, Vercel, or a normal HTTPS web server). No build step is required.

For GitHub Pages, publish this directory as the site root. The relative URLs in the manifest and service worker also work when the app is hosted inside a repository subdirectory.

## Included

- User photo picker and drag-and-drop import
- On-device image resizing
- 12, 24, 48, and 80-piece modes
- Procedurally generated complementary jigsaw edges
- Connected-piece group dragging and magnetic snapping
- Mouse, touch, stylus, wheel zoom, and pinch support
- Pan, zoom, fit, reshuffle, preview, timer, progress, sound, and vibration feedback
- Automatic save/resume using IndexedDB
- Completion statistics stored locally
- Responsive phone, tablet, and desktop interface
- Installable web app manifest and icons
- Offline application shell via service worker

## Project structure

- `index.html` — application markup
- `styles.css` — responsive interface and visual design
- `app.js` — puzzle engine, renderer, input, persistence, and UI
- `manifest.webmanifest` — PWA metadata
- `sw.js` — offline cache
- `icons/` — app icons
