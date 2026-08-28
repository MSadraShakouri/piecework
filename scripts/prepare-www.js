const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const files = ['index.html', 'app.js', 'manifest.webmanifest', 'sw.js'];
const directories = ['js', 'styles'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}

for (const directory of directories) {
  fs.cpSync(path.join(root, directory), path.join(out, directory), { recursive: true });
}

fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });
console.log('Prepared Capacitor web assets in www/.');
