import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const relativeAsset = asset => asset.replace(/^\.\//, '');

function serviceWorkerCore() {
  const source = read('sw.js');
  const match = source.match(/const CORE\s*=\s*\[(.*?)\];/s);
  assert.ok(match, 'sw.js should define a CORE asset list');
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(matchResult => relativeAsset(matchResult[1]));
}

test('every JavaScript module import resolves to a repository file', () => {
  const files = ['app.js', ...fs.readdirSync(path.join(root, 'js')).map(file => `js/${file}`)];
  const importPattern = /(?:from\s+|import\s*)['"](\.\/[^'"]+)['"]/g;

  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(importPattern)) {
      const imported = path.normalize(path.join(path.dirname(file), match[1]));
      assert.ok(fs.existsSync(path.join(root, imported)), `${file} imports missing ${imported}`);
    }
  }
});

test('the service worker precaches every runtime module and stylesheet', () => {
  const core = serviceWorkerCore();
  const runtimeFiles = [
    'app.js',
    ...fs.readdirSync(path.join(root, 'js')).map(file => `js/${file}`),
    ...fs.readdirSync(path.join(root, 'styles')).map(file => `styles/${file}`),
    'package.json',
  ];

  for (const file of runtimeFiles) {
    assert.ok(core.includes(file), `sw.js CORE should include ${file}`);
    assert.ok(fs.existsSync(path.join(root, file)), `missing precached file ${file}`);
  }
});

test('all HTML entry-point assets exist', () => {
  const html = read('index.html');
  const assetPattern = /(?:src|href)="(\.\/[^"#?]+)"/g;
  for (const match of html.matchAll(assetPattern)) {
    const asset = relativeAsset(match[1]);
    assert.ok(fs.existsSync(path.join(root, asset)), `index.html references missing ${asset}`);
  }
});

test('package metadata is the only release-version source', () => {
  const packageMetadata = JSON.parse(read('package.json'));
  assert.match(packageMetadata.version, /^\d+\.\d+\.\d+$/);
  assert.ok(serviceWorkerCore().includes('package.json'));

  const semverPattern = /\bv?\d+\.\d+\.\d+\b/g;
  const sourceFiles = [
    'index.html',
    'app.js',
    'sw.js',
    'README.md',
    'CONTRIBUTING.md',
    '.github/workflows/build-android.yml',
    ...fs.readdirSync(path.join(root, 'js')).map(file => `js/${file}`),
    ...fs.readdirSync(path.join(root, 'styles')).map(file => `styles/${file}`),
  ];

  for (const file of sourceFiles) {
    assert.deepEqual(read(file).match(semverPattern), null, `${file} should not duplicate the release version`);
  }
});
