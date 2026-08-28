# Piecework

Piecework is a private, offline-first jigsaw puzzle app for the web and Android. Choose a photo, pick a difficulty, and assemble the puzzle from a scrollable tray. Imported images and game progress stay on the device; Piecework has no account, backend, or upload step.

## What you can do

- Use a JPEG, PNG, or WebP photo, or start with the built-in sample artwork.
- Choose 12, 24, 48, or 80 pieces. The grid adapts to the image’s aspect ratio.
- Drag individual pieces or connected groups onto the board and snap them into place.
- Use the tray with mouse, touch, or stylus input; pinch or scroll to zoom and pan around the board.
- Preview the completed image, reshuffle, reset, and resume an unfinished puzzle.
- Track time, progress, and completion statistics, with optional sound and vibration feedback.
- Use English, Persian, Arabic, or Simplified Chinese, including automatic RTL layout for Persian and Arabic.

## Offline and privacy

The web app is a static PWA. Its application shell is cached by the service worker so it can continue to open offline after the first visit. Puzzle images, settings, unfinished games, and completion statistics are stored locally in the browser or Android WebView using IndexedDB and local storage. They are not sent to a Piecework server.

## Web and Android

The web version can be hosted from any static HTTPS host. The Android app uses the same files through Capacitor and has the package id `com.msadrashakouri.piecework`.

Development, testing, static hosting, and APK instructions live in [`CONTRIBUTING.md`](CONTRIBUTING.md). The fixed debug-signing setup and APK update constraints are documented in [`docs/APK_SIGNING.md`](docs/APK_SIGNING.md).

## Project map

```text
index.html       Application shell and markup
app.js           ES-module composition root
js/              UI, puzzle, game, rendering, input, state, and storage modules
styles/          Ordered base, layout, game, component, and responsive CSS
icons/           PWA and Android launcher icons
sw.js            Offline cache and runtime asset list
scripts/         Static-asset preparation and Android icon generation
test/            Node tests for puzzle behavior and the asset graph
docs/            Android signing documentation
```

Piecework intentionally uses native ES modules and plain CSS. The web app has no bundler or runtime dependency; keeping the asset paths, service-worker cache, and local storage format stable is part of the project’s compatibility contract.
