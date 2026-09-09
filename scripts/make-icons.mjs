import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

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
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bg = [15, 17, 21], fg = [52, 199, 89], ink = [247, 247, 245];
  const r = size * 0.22;
  const inRound = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r), cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      let c = inRound(x, y) ? bg : [0, 0, 0], a = inRound(x, y) ? 255 : 0;
      // an "R"-like block letter: a vertical bar and two horizontal bars
      const u = x / size, v = y / size;
      const bar = u > 0.3 && u < 0.42 && v > 0.25 && v < 0.75;
      const top = v > 0.25 && v < 0.35 && u > 0.3 && u < 0.62;
      const mid = v > 0.48 && v < 0.58 && u > 0.3 && u < 0.62;
      const right = u > 0.58 && u < 0.7 && v > 0.25 && v < 0.55;
      const leg = v > 0.55 && v < 0.75 && u > 0.5 + (v - 0.55) * 0.9 && u < 0.62 + (v - 0.55) * 0.9;
      if (bar || top || mid || right) c = ink;
      if (leg) c = fg;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
mkdirSync('public/icons', { recursive: true });
for (const s of [192, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s));
console.log('icons written');
