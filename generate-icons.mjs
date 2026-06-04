/**
 * Generates TwinMind PWA icons (192×192 and 512×512) as PNG files.
 * Uses only Node.js built-ins — no extra dependencies.
 * Run: node generate-icons.mjs
 */
import { createWriteStream, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

function makePNG(size) {
  const BG  = [6, 11, 24];      // #060b18
  const FG  = [0, 212, 255];    // #00D4FF

  // Build raw RGBA scanlines
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r1 = size * 0.28, r2 = size * 0.38; // outer/inner ring radii

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;

      // Background
      pixels[i]   = BG[0]; pixels[i+1] = BG[1]; pixels[i+2] = BG[2]; pixels[i+3] = 255;

      // Outer circle border
      if (dist >= size * 0.44 && dist <= size * 0.48) {
        const a = Math.min(1, (size * 0.48 - dist) / (size * 0.02));
        pixels[i]   = Math.round(BG[0] + (FG[0]-BG[0]) * a);
        pixels[i+1] = Math.round(BG[1] + (FG[1]-BG[1]) * a);
        pixels[i+2] = Math.round(BG[2] + (FG[2]-BG[2]) * a);
      }

      // Ring shape (torus)
      if (dist >= r1 && dist <= r2) {
        const ringAlpha = Math.min(1, Math.min(dist - r1, r2 - dist) / (size * 0.02));
        pixels[i]   = Math.round(BG[0] + (FG[0]-BG[0]) * ringAlpha);
        pixels[i+1] = Math.round(BG[1] + (FG[1]-BG[1]) * ringAlpha);
        pixels[i+2] = Math.round(BG[2] + (FG[2]-BG[2]) * ringAlpha);
      }

      // Diamond / rhombus (◈ shape)
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const diamondDist = (ax + ay) / (size * 0.16);
      if (diamondDist >= 0.85 && diamondDist <= 1.15) {
        const a = Math.min(1, (0.15 - Math.abs(diamondDist - 1)) / 0.15);
        pixels[i]   = Math.round(BG[0] + (FG[0]-BG[0]) * a);
        pixels[i+1] = Math.round(BG[1] + (FG[1]-BG[1]) * a);
        pixels[i+2] = Math.round(BG[2] + (FG[2]-BG[2]) * a);
      }

      // Inner dot at center
      if (dist < size * 0.04) {
        pixels[i] = FG[0]; pixels[i+1] = FG[1]; pixels[i+2] = FG[2];
      }
    }
  }

  // Build PNG bytes
  const SIG = Buffer.from([137,80,78,71,13,10,26,10]);

  function chunk(type, data) {
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, 'ascii');
    const crc   = crc32(Buffer.concat([typeB, data]));
    const crcB  = Buffer.allocUnsafe(4);
    crcB.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines with filter byte 0
  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const pi = (y * size + x) * 4;
      const ri = y * (1 + size * 3) + 1 + x * 3;
      raw[ri] = pixels[pi]; raw[ri+1] = pixels[pi+1]; raw[ri+2] = pixels[pi+2];
    }
  }

  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF);
}

mkdirSync('Frontend/public/icons', { recursive: true });
for (const size of [192, 512]) {
  const buf  = makePNG(size);
  const path = `Frontend/public/icons/icon-${size}.png`;
  const ws   = createWriteStream(path);
  ws.write(buf);
  ws.end();
  console.log(`✓ Generated ${path} (${buf.length} bytes)`);
}
console.log('PWA icons ready.');
