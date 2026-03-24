// Pure Node.js PNG icon generator - no external dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

function writeUInt32BE(buf, value, offset) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset+1] = (value >>> 16) & 0xff;
  buf[offset+2] = (value >>> 8) & 0xff;
  buf[offset+3] = value & 0xff;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  writeUInt32BE(len, data.length, 0);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  writeUInt32BE(crcVal, crc32(crcBuf), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function generatePNG(size) {
  // Create RGBA pixel data
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const t = (x / size * 0.5 + y / size * 0.5);

      // Rounded rect mask (22% radius)
      const rr = size * 0.22;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      let inside = false;
      if (ax <= r && ay <= r) {
        if (ax <= r - rr || ay <= r - rr) {
          inside = true;
        } else {
          const ex = ax - (r - rr), ey = ay - (r - rr);
          inside = ex * ex + ey * ey <= rr * rr;
        }
      }

      if (!inside) {
        pixels[idx+3] = 0; // transparent
        continue;
      }

      // Purple gradient: #1e1b4b -> #4c1d95 -> #6d28d9
      const r1 = lerp(lerp(0x1e, 0x4c, t), 0x6d, t);
      const g1 = lerp(lerp(0x1b, 0x1d, t), 0x28, t);
      const b1 = lerp(lerp(0x4b, 0x95, t), 0xd9, t);

      pixels[idx]   = Math.round(r1);
      pixels[idx+1] = Math.round(g1);
      pixels[idx+2] = Math.round(b1);
      pixels[idx+3] = 255;

      // Draw a simple "₪" symbol approximation: a white coin circle with ₪ lines
      // White circle in center (60% of size)
      const cr = size * 0.30;
      if (dx*dx + dy*dy <= cr*cr) {
        pixels[idx]   = 255;
        pixels[idx+1] = 255;
        pixels[idx+2] = 255;
        pixels[idx+3] = 255;

        // Inner purple ring
        const ir = cr * 0.75;
        if (dx*dx + dy*dy <= ir*ir) {
          pixels[idx]   = Math.round(r1);
          pixels[idx+1] = Math.round(g1);
          pixels[idx+2] = Math.round(b1);
          pixels[idx+3] = 255;

          // Center shekel symbol: vertical bar + two horizontal bars
          const bw = size * 0.035;
          const barH = ir * 0.7;
          // Vertical bar (slightly left of center)
          const offX = -size * 0.03;
          if (Math.abs(dx - offX) < bw && Math.abs(dy) < barH) {
            pixels[idx]   = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; pixels[idx+3] = 255;
          }
          // Top horizontal bar
          if (Math.abs(dy - (-barH * 0.5)) < bw && dx > offX - bw && dx < offX + ir * 0.5) {
            pixels[idx]   = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; pixels[idx+3] = 255;
          }
          // Bottom horizontal bar
          if (Math.abs(dy - (barH * 0.5)) < bw && dx > offX - bw && dx < offX + ir * 0.5) {
            pixels[idx]   = 255; pixels[idx+1] = 255; pixels[idx+2] = 255; pixels[idx+3] = 255;
          }
        }
      }
    }
  }

  // Build PNG: IHDR + IDAT + IEND
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdrData = Buffer.alloc(13);
  writeUInt32BE(ihdrData, size, 0);
  writeUInt32BE(ihdrData, size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  // Raw image data with filter bytes
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

sizes.forEach((size) => {
  const png = generatePNG(size);
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), png);
  console.log(`✓ icon-${size}.png (${png.length} bytes)`);
});
console.log('Done!');
