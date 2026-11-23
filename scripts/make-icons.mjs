// Draws the app icon (a small globe with a glowing pin) and writes PNGs to public/.
import fs from 'fs';
import zlib from 'zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (x) => Math.max(0, Math.min(1, x));

function shade(u, v) {
  // u, v in [-1, 1]
  const bg = mix([12, 22, 48], [5, 9, 20], clamp(Math.hypot(u, v + 0.2) / 1.3));
  let col = bg;
  const R = 0.66;
  const r = Math.hypot(u, v);
  // atmosphere glow
  col = mix(col, [110, 160, 255], 0.35 * clamp(1 - Math.abs(r - R) / 0.09) * (r > R ? 1 : 0.4));
  if (r < R) {
    const x = u / R, y = v / R, z = Math.sqrt(1 - x * x - y * y);
    const light = clamp(0.35 + 0.75 * (-0.45 * x - 0.5 * y + 0.74 * z));
    let g = mix([10, 26, 62], [32, 72, 140], light);
    // rotate the sphere a bit and draw meridians/parallels
    const lat = Math.asin(-y), lon = Math.atan2(x, z) + 0.35;
    const gl = (a, step) => clamp(1 - Math.abs(((a / step) % 1 + 1.5) % 1 - 0.5) * step * 90 / (1.4 * Math.max(z, 0.25)));
    const lines = Math.max(gl(lat, Math.PI / 6), gl(lon, Math.PI / 6));
    g = mix(g, [140, 175, 235], 0.28 * lines);
    // two warm "visited" patches
    const patch = (la, lo, s) => clamp(1 - Math.hypot(lat - la, (lon - lo) * Math.cos(lat)) / s);
    g = mix(g, [255, 176, 72], clamp(patch(0.55, 0.15, 0.32) * 3) * 0.9);
    g = mix(g, [255, 176, 72], clamp(patch(-0.2, -0.75, 0.22) * 3) * 0.9);
    col = mix(col, g, clamp((R - r) * 200));
  }
  // pin dot with glow
  const px = 0.06, py = -0.22, d = Math.hypot(u - px, v - py);
  col = mix(col, [255, 190, 100], 0.6 * clamp(1 - d / 0.2) ** 2);
  col = mix(col, [255, 248, 230], clamp((0.07 - d) * 120));
  return col;
}

function render(size) {
  const buf = Buffer.alloc(size * size * 3);
  const ss = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const u = ((x + (sx + 0.5) / ss) / size) * 2 - 1;
      const v = ((y + (sy + 0.5) / ss) / size) * 2 - 1;
      acc = acc.map((a, i) => a + shade(u, v)[i]);
    }
    const o = (y * size + x) * 3;
    for (let i = 0; i < 3; i++) buf[o + i] = Math.round(acc[i] / (ss * ss));
  }
  return png(size, buf);
}

for (const s of [180, 192, 512]) fs.writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), render(s));
console.log('icons written');
