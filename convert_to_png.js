// convert_to_png.js — Convert TwinMind SVG logo to PNG using sharp
const sharp = require('./node_modules/sharp');
const path  = require('path');
const fs    = require('fs');

const LOGO_DIR = path.join(__dirname, 'logo');
const SRC_SVG  = path.join(LOGO_DIR, 'twinmind-logo.svg');
const APP_SVG  = path.join(LOGO_DIR, 'twinmind-logo-app-icon.svg');

async function main() {
  if (!fs.existsSync(SRC_SVG)) {
    console.error('ERROR: twinmind-logo.svg not found. Run generate_logos.py first.');
    process.exit(1);
  }

  const tasks = [
    { src: SRC_SVG,  out: 'twinmind-logo-512.png',  w: 512,  h: 512  },
    { src: SRC_SVG,  out: 'twinmind-logo-1024.png', w: 1024, h: 1024 },
    { src: APP_SVG,  out: 'twinmind-logo-app-icon-1024.png', w: 1024, h: 1024 },
  ];

  for (const { src, out, w, h } of tasks) {
    if (!fs.existsSync(src)) { console.log(`SKIP ${out} (source SVG missing)`); continue; }
    const outPath = path.join(LOGO_DIR, out);
    await sharp(src)
      .resize(w, h)
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    const sz = fs.statSync(outPath).size;
    console.log(`OK  ${out}  (${w}x${h})  ${(sz/1024).toFixed(1)} KB`);
  }

  // Final summary
  console.log('\n--- All files in /logo/ ---');
  let total = 0;
  for (const f of fs.readdirSync(LOGO_DIR).sort()) {
    const sz = fs.statSync(path.join(LOGO_DIR, f)).size;
    total += sz;
    const kind = f.endsWith('.png') ? 'PNG' : 'SVG';
    console.log(`  [${kind}] ${f.padEnd(50)} ${(sz/1024).toFixed(1).padStart(7)} KB`);
  }
  console.log(`\n  Total: ${(total/1024).toFixed(1)} KB across ${fs.readdirSync(LOGO_DIR).length} files`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
