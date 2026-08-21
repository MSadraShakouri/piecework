# Piecework — Jigsaw Studio

A dependency-free, offline-first jigsaw puzzle PWA. Images stay on the device.

## Run locally

Service workers require HTTP(S), so do not open `index.html` directly from the filesystem.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy as a website

Upload the contents of this folder to any static host (GitHub Pages, Cloudflare Pages, Netlify, Vercel, or a normal HTTPS web server). No build step is required for the web app.

For GitHub Pages, publish this directory as the site root. The relative URLs in the manifest and service worker also work when the app is hosted inside a repository subdirectory.

## Build an Android APK

This repository includes a GitHub Actions workflow at `.github/workflows/build-android.yml`. It follows the same Capacitor-based pattern as the `lyric-sync` APK workflow:

- copies the static PWA files into `www/`
- creates a Capacitor Android project during the workflow run
- generates Android launcher icons from `icons/icon-512.png`
- builds a debug APK
- signs that debug APK with a fixed keystore from `ANDROID_KEYSTORE_BASE64`
- uploads the APK as a workflow artifact
- attaches the APK to a GitHub Release when you push a `v*` tag

The Android package id is:

```text
com.msadrashakouri.piecework
```

The fixed debug keystore is important because Android only allows an APK to install as an update when both the package id and signing certificate are unchanged. See [`docs/APK_SIGNING.md`](docs/APK_SIGNING.md) for the full keystore/base64/fingerprint guide.

### Required GitHub secret

Add this repository secret before running the APK workflow:

```text
ANDROID_KEYSTORE_BASE64
```

The workflow expects the debug keystore to use:

```text
Alias: piecework
Store password: android
Key password: android
```

### Run the APK workflow

Manual build:

1. Open the repository on GitHub.
2. Go to **Actions** → **Build Android APK**.
3. Choose **Run workflow**.
4. Download the `piecework-debug-apk` artifact from the completed run.

Release build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That creates a signed debug APK and uploads it to the generated GitHub Release.

## Included

- User photo picker and drag-and-drop import
- On-device image resizing
- Aspect-ratio-aware difficulty ranges (square images use square grids such as 5×5; portrait and landscape images receive proportional grids)
- English, Persian, Arabic, and Simplified Chinese interfaces with automatic RTL layout for Persian and Arabic
- Procedurally generated complementary jigsaw edges
- Connected-piece group dragging and magnetic snapping
- Mouse, touch, stylus, wheel zoom, and pinch support
- Pan, zoom, fit, reshuffle, preview, timer, progress, sound, and vibration feedback
- Automatic save/resume using IndexedDB
- Completion statistics stored locally
- Responsive phone, tablet, and desktop interface
- Installable web app manifest and icons
- Offline application shell via service worker
- GitHub Actions APK packaging with Capacitor

## Project structure

- `index.html` — application markup
- `styles.css` — responsive interface and visual design
- `app.js` — puzzle engine, renderer, input, persistence, and UI
- `manifest.webmanifest` — PWA metadata
- `sw.js` — offline cache
- `icons/` — app icons
- `package.json` — Capacitor/Android packaging scripts
- `capacitor.config.json` — Android app id, name, and web asset directory
- `scripts/prepare-www.js` — copies static web assets for Capacitor
- `scripts/generate-android-icons.js` — creates Android launcher icons
- `icons/icon-monochrome.png` — optional 512×512 transparent, single-color Android themed-icon glyph
- `docs/APK_SIGNING.md` — fixed debug keystore and APK update guide

## Custom Android monochrome icon

Place your custom themed icon at:

```text
icons/icon-monochrome.png
```

Use a **512×512 transparent PNG** containing a single-color (ideally white) Piecework glyph. Do not include a background square or rounded app-icon plate. Android supplies and tints the background itself. The workflow detects this file automatically; if it is absent, the regular icon is used as a fallback.
