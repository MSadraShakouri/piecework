// Generates Android launcher icons from icons/icon-512.png after Capacitor creates android/.
// Covers legacy icons and Android 8+ adaptive icons.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '..', 'icons', 'icon-512.png');
// Optional transparent, single-color glyph used by Android themed icons.
// Place a 512×512 PNG at icons/icon-monochrome.png to override the fallback.
const MONO_SOURCE = path.join(__dirname, '..', 'icons', 'icon-monochrome.png');
const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const BACKGROUND_COLOR = '#121316';
const SAFE_ZONE_SCALE = 0.66;

const LEGACY = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const ADAPTIVE = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function renderContainedIcon(outputName, sizeMap, source = SOURCE) {
  for (const [folder, size] of Object.entries(sizeMap)) {
    const dir = path.join(RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    const artSize = Math.round(size * SAFE_ZONE_SCALE);
    const art = await sharp(source).resize(artSize, artSize, { fit: 'contain' }).png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: art, left: Math.round((size - artSize) / 2), top: Math.round((size - artSize) / 2) }])
      .png()
      .toFile(path.join(dir, outputName));
  }
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Icon source not found: ${SOURCE}`);

  for (const [folder, size] of Object.entries(LEGACY)) {
    const dir = path.join(RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    const base = sharp(SOURCE).resize(size, size, { fit: 'cover' }).png();
    await base.clone().toFile(path.join(dir, 'ic_launcher.png'));
    await base.clone().toFile(path.join(dir, 'ic_launcher_round.png'));
  }

  await renderContainedIcon('ic_launcher_foreground.png', ADAPTIVE);
  const monochromeSource = fs.existsSync(MONO_SOURCE) ? MONO_SOURCE : SOURCE;
  if (!fs.existsSync(MONO_SOURCE)) {
    console.warn('icons/icon-monochrome.png not found; using the regular icon as a themed-icon fallback.');
  }
  await renderContainedIcon('ic_launcher_monochrome.png', ADAPTIVE, monochromeSource);

  const valuesDir = path.join(RES, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND_COLOR}</color>\n</resources>\n`
  );

  const anydpiDir = path.join(RES, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpiDir, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), xml);

  console.log('Generated Android launcher icons.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
