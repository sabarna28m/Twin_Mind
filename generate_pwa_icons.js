// generate_pwa_icons.js — Build all PWA/favicon icon assets from the new brain logo
const sharp  = require('./node_modules/sharp');
const path   = require('path');
const fs     = require('fs');

const LOGO_DIR  = path.join(__dirname, 'logo');
const ICONS_DIR = path.join(__dirname, 'Frontend', 'public', 'icons');
const PUB_DIR   = path.join(__dirname, 'Frontend', 'public');

fs.mkdirSync(ICONS_DIR, { recursive: true });

// ── Source SVGs ────────────────────────────────────────────────────────────
// App-icon variant (brain centered on dark #1A1A2E rounded-rect background)
const APP_SVG    = path.join(LOGO_DIR, 'twinmind-logo-app-icon.svg');
// Main brain SVG (transparent background) — used for favicon
const BRAIN_SVG  = path.join(LOGO_DIR, 'twinmind-logo.svg');

// ── Maskable icon SVG ──────────────────────────────────────────────────────
// PWA maskable icons need a solid background extending to all edges (no rounding).
// The logo must stay within the centre 80% "safe zone".
// We generate this from the app-icon SVG with rx="0" (square corners).
const appSvgSrc = fs.readFileSync(APP_SVG, 'utf8');
const maskableSvg = appSvgSrc
  .replace(/rx="200"/g, 'rx="0"');   // remove rounded corners

const MASKABLE_SVG_PATH = path.join(LOGO_DIR, 'twinmind-logo-maskable.svg');
fs.writeFileSync(MASKABLE_SVG_PATH, maskableSvg, 'utf8');
console.log('OK  twinmind-logo-maskable.svg  (square bg for maskable purpose)');

// ── Icon generation tasks ──────────────────────────────────────────────────
//   src          → output path                             size    description
const tasks = [
  // Standard PWA icons (dark bg, rounded)
  [APP_SVG,       path.join(ICONS_DIR, 'icon-512.png'),    512,   'PWA 512x512'],
  [APP_SVG,       path.join(ICONS_DIR, 'icon-192.png'),    192,   'PWA 192x192'],
  [APP_SVG,       path.join(ICONS_DIR, 'icon-180.png'),    180,   'Apple touch icon 180x180'],
  [APP_SVG,       path.join(ICONS_DIR, 'icon-152.png'),    152,   'iPad 152x152'],
  [APP_SVG,       path.join(ICONS_DIR, 'icon-120.png'),    120,   'iPhone 120x120'],

  // Maskable icons (square bg, safe-zone centred)
  [MASKABLE_SVG_PATH, path.join(ICONS_DIR, 'icon-maskable-512.png'), 512, 'Maskable 512x512'],
  [MASKABLE_SVG_PATH, path.join(ICONS_DIR, 'icon-maskable-192.png'), 192, 'Maskable 192x192'],

  // Favicon PNGs (transparent brain, no bg)
  [BRAIN_SVG,     path.join(ICONS_DIR, 'favicon-32.png'),   32,   'Favicon 32x32'],
  [BRAIN_SVG,     path.join(ICONS_DIR, 'favicon-16.png'),   16,   'Favicon 16x16'],
];

async function main() {
  for (const [src, out, size, desc] of tasks) {
    await sharp(src)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(out);
    const kb = (fs.statSync(out).size / 1024).toFixed(1);
    console.log(`OK  ${path.basename(out).padEnd(30)} ${String(size).padStart(4)}px  ${kb} KB   ${desc}`);
  }

  // ── Also refresh the logo-dir PNGs ──────────────────────────────────────
  for (const [src, out, size] of [
    [BRAIN_SVG, path.join(LOGO_DIR, 'twinmind-logo-512.png'),  512],
    [BRAIN_SVG, path.join(LOGO_DIR, 'twinmind-logo-1024.png'), 1024],
    [APP_SVG,   path.join(LOGO_DIR, 'twinmind-logo-app-icon-1024.png'), 1024],
  ]) {
    await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
    console.log(`OK  logo/${path.basename(out)}  refreshed`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n--- Icons in Frontend/public/icons/ ---');
  let total = 0;
  for (const f of fs.readdirSync(ICONS_DIR).sort()) {
    const sz = fs.statSync(path.join(ICONS_DIR, f)).size;
    total += sz;
    console.log(`  ${f.padEnd(38)} ${(sz/1024).toFixed(1).padStart(6)} KB`);
  }
  console.log(`\n  Total: ${(total/1024).toFixed(1)} KB  (${fs.readdirSync(ICONS_DIR).length} files)`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
