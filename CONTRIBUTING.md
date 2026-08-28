# Contributing to Piecework

Piecework is a static, dependency-light PWA. There is no bundler or application build step: edit the source files, serve the repository over HTTP, and refresh the browser.

## Local development

Install the Node development dependencies first:

```bash
npm install
```

Serve the repository root over HTTP so the service worker and ES modules work:

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>. Do not open `index.html` directly from the filesystem. Changes to the web app are made in `index.html`, `app.js`, `js/`, and `styles/`; `www/` is generated and ignored.

## Deploying the web app

There is no web build step. Publish the repository root to a static HTTPS host such as GitHub Pages, Cloudflare Pages, Netlify, or a normal web server. Keep `index.html`, `app.js`, `js/`, `styles/`, `icons/`, `manifest.webmanifest`, and `sw.js` together; the relative URLs also work when the site is hosted in a repository subdirectory.

## Tests and asset preparation

Run the Node test suite before committing:

```bash
npm test
```

The tests cover puzzle/state behavior and verify that HTML imports, JavaScript module imports, and service-worker precaching point to real assets.

To create the web directory used by Capacitor:

```bash
npm run prepare:www
```

This copies `index.html`, `app.js`, the `js/` and `styles/` directories, icons, the manifest, and the service worker into `www/`. Run it after changing runtime assets; do not edit generated files in `www/`.

## Architecture rules

- Keep `index.html` as the application shell. Do not add runtime HTML partial loading without a deliberate design change.
- Use relative asset paths so the app works from a domain root and from a repository subdirectory.
- Add every new runtime JavaScript or CSS asset to both `scripts/prepare-www.cjs` and the `CORE` precache list in `sw.js`.
- Keep application code and ESM-compatible tests in native ES modules. CommonJS Node-only tooling belongs in `.cjs` files.
- Preserve the IndexedDB/local-storage keys and serialized game shape unless a migration is included.
- Preserve the Android app id and signing setup; changing either can prevent an existing APK from updating.

When changing the module or stylesheet graph, run `npm test`, `npm run prepare:www`, and `git diff --check`.

## Android packaging

The GitHub Actions workflow at `.github/workflows/build-android.yml` builds a debug APK. It runs on manual dispatch and on pushes of `v*` tags; a tag also creates a GitHub Release. Do not push a version tag unless a release is intended.

The workflow:

1. installs dependencies with Node.js 20;
2. prepares `www/` and creates a Capacitor Android project;
3. generates launcher icons and syncs the web assets;
4. signs the debug APK with the fixed Piecework debug keystore; and
5. uploads the APK as the `piecework-debug-apk` artifact.

The repository secret `ANDROID_KEYSTORE_BASE64` is required. The expected alias and passwords are documented in [`docs/APK_SIGNING.md`](docs/APK_SIGNING.md), which also explains why the keystore must remain fixed for APK updates to install over earlier builds.

For a local Capacitor project, prepare the assets and add the Android platform once:

```bash
npm install
npm run prepare:www
npx cap add android
npm run android:icons
npx cap sync android
```

After the platform exists, `npm run android:sync` combines asset preparation with `npx cap sync android`. The generated `android/` and `www/` directories are ignored by Git.

## Pull requests

Keep each behavior or refactor change focused. Before opening a pull request:

- run `npm test`;
- run `npm run prepare:www` when runtime assets changed;
- check `git diff --check`;
- verify the app loads from a local HTTP server; and
- update the service-worker cache and documentation when the asset graph or user-facing behavior changes.
