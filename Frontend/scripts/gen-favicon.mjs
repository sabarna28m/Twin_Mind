/**
 * gen-favicon.mjs — Generate favicon.ico from existing icon PNGs
 *
 * Uses fast-png (already in node_modules) to decode/encode PNGs.
 * Scales icon-512.png → 48x48 via bilinear interpolation.
 * Packs 16x16 + 32x32 + 48x48 into a multi-size favicon.ico.
 *
 * Run: node scripts/gen-favicon.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');

// ── Minimal PNG encoder (IDAT deflate via Node.js built-in zlib) ──────────

import { deflateSync } from 'zlib';

function encodePNG(width, height, data /* Uint8Array RGBA */) {
  function crc32(buf) {
    const table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
      }
      return t;
    })();
    let c = 0xFFFFFFFF;
    for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes  = Buffer.from(type, 'ascii');
    const lenBuf     = Buffer.allocUnsafe(4);
    lenBuf.writeUInt32BE(data.length);
    const crcBuf     = Buffer.allocUnsafe(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // color type: RGB (no alpha in ICO PNGs for compat)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build RGB scanlines with filter byte
  const rows = Buffer.allocUnsafe(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rows[y * (1 + width * 3)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 3) + 1 + x * 3;
      rows[di]     = data[si];
      rows[di + 1] = data[si + 1];
      rows[di + 2] = data[si + 2];
    }
  }

  const idat = chunk('IDAT', deflateSync(rows, { level: 6 }));

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    chunk('IHDR', ihdr),
    idat,
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Bilinear downscale ────────────────────────────────────────────────────

function bilinearScale(src, srcW, srcH, dstW, dstH) {
  const dst = new Uint8Array(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const sx  = dx * xRatio;
      const sy  = dy * yRatio;
      const x0  = Math.min(Math.floor(sx), srcW - 1);
      const y0  = Math.min(Math.floor(sy), srcH - 1);
      const x1  = Math.min(x0 + 1, srcW - 1);
      const y1  = Math.min(y0 + 1, srcH - 1);
      const xf  = sx - x0;
      const yf  = sy - y0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const di = (dy * dstW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        dst[di + c] = Math.round(
          src[i00 + c] * (1 - xf) * (1 - yf) +
          src[i10 + c] * xf       * (1 - yf) +
          src[i01 + c] * (1 - xf) * yf       +
          src[i11 + c] * xf       * yf,
        );
      }
    }
  }
  return dst;
}

// ── fast-png decode wrapper ───────────────────────────────────────────────

const { decode } = await import('../node_modules/fast-png/lib/index.js');

function decodePng(buf) {
  const img = decode(buf);
  // fast-png returns { data, width, height, channels, depth }
  // data is Uint8Array of (channels × depth/8 × width × height)
  const { data, width, height, channels, depth } = img;
  const rgba = new Uint8Array(width * height * 4);
  const bytesPerChannel = depth / 8;
  const srcStride = channels * bytesPerChannel;

  for (let i = 0; i < width * height; i++) {
    const si = i * srcStride;
    if (channels === 4) {
      if (bytesPerChannel === 1) {
        rgba[i * 4]     = data[si];
        rgba[i * 4 + 1] = data[si + 1];
        rgba[i * 4 + 2] = data[si + 2];
        rgba[i * 4 + 3] = data[si + 3];
      } else {
        // 16-bit → 8-bit
        rgba[i * 4]     = data[si] ;
        rgba[i * 4 + 1] = data[si + 2];
        rgba[i * 4 + 2] = data[si + 4];
        rgba[i * 4 + 3] = data[si + 6];
      }
    } else if (channels === 3) {
      rgba[i * 4]     = data[si];
      rgba[i * 4 + 1] = data[si + 1];
      rgba[i * 4 + 2] = data[si + 2];
      rgba[i * 4 + 3] = 255;
    } else if (channels === 2) {
      rgba[i * 4]     = data[si];
      rgba[i * 4 + 1] = data[si];
      rgba[i * 4 + 2] = data[si];
      rgba[i * 4 + 3] = data[si + 1];
    } else {
      rgba[i * 4]     = data[si];
      rgba[i * 4 + 1] = data[si];
      rgba[i * 4 + 2] = data[si];
      rgba[i * 4 + 3] = 255;
    }
  }
  return { rgba, width, height };
}

// ── Build ICO ─────────────────────────────────────────────────────────────

function buildIco(images) {
  // images: Array<{ size: number, pngBuf: Buffer }>
  const count  = images.length;
  const header = Buffer.allocUnsafe(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: icon
  header.writeUInt16LE(count, 4);  // image count

  const DIR_ENTRY = 16;
  let offset = 6 + DIR_ENTRY * count;

  const dirs = images.map(({ size, pngBuf }) => {
    const dir = Buffer.allocUnsafe(16);
    dir.writeUInt8(size === 256 ? 0 : size, 0);   // width  (0 = 256)
    dir.writeUInt8(size === 256 ? 0 : size, 1);   // height
    dir.writeUInt8(0, 2);                          // color count
    dir.writeUInt8(0, 3);                          // reserved
    dir.writeUInt16LE(1, 4);                       // planes
    dir.writeUInt16LE(32, 6);                      // bit depth
    dir.writeUInt32LE(pngBuf.length, 8);           // data size
    dir.writeUInt32LE(offset, 12);                 // data offset
    offset += pngBuf.length;
    return dir;
  });

  return Buffer.concat([header, ...dirs, ...images.map(i => i.pngBuf)]);
}

// ── Main ──────────────────────────────────────────────────────────────────

console.log('Reading source images…');

const png16Buf = readFileSync(join(ICONS_DIR, 'favicon-16.png'));
const png32Buf = readFileSync(join(ICONS_DIR, 'favicon-32.png'));

// Generate 48×48 by scaling down icon-512.png
const src512Buf = readFileSync(join(ICONS_DIR, 'icon-512.png'));
const { rgba: src512, width: w512, height: h512 } = decodePng(src512Buf);
console.log(`Source icon: ${w512}×${h512}`);

const rgba48 = bilinearScale(src512, w512, h512, 48, 48);
const png48Buf = encodePNG(48, 48, rgba48);
writeFileSync(join(ICONS_DIR, 'favicon-48.png'), png48Buf);
console.log('Generated favicon-48.png');

// Also regenerate 16 and 32 from the 512 source for crispness
const rgba16 = bilinearScale(src512, w512, h512, 16, 16);
const rgba32 = bilinearScale(src512, w512, h512, 32, 32);
const png16New = encodePNG(16, 16, rgba16);
const png32New = encodePNG(32, 32, rgba32);
writeFileSync(join(ICONS_DIR, 'favicon-16.png'), png16New);
writeFileSync(join(ICONS_DIR, 'favicon-32.png'), png32New);
console.log('Regenerated favicon-16.png and favicon-32.png from 512 source');

// Pack into ICO
const ico = buildIco([
  { size: 16, pngBuf: png16New },
  { size: 32, pngBuf: png32New },
  { size: 48, pngBuf: png48Buf },
]);

writeFileSync(join(ROOT, 'public', 'favicon.ico'), ico);
console.log(`\nfavicon.ico written (${ico.length} bytes) with 16x16, 32x32, 48x48`);
console.log('Done!');
