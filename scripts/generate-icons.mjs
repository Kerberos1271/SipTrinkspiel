import fs from 'node:fs';
import zlib from 'node:zlib';

const colors = {
  ink: [45, 41, 66, 255],
  amber: [227, 198, 140, 255],
  coral: [200, 111, 91, 255],
};

function setPixel(data, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (y * size + x) * 4;
  data.set(color, offset);
}

function roundedRect(data, size, left, top, right, bottom, radius, color) {
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
    const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
    const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(data, size, x, y, color);
  }
}

function polygon(data, size, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1]))));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...points.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      if ((current[1] <= y && next[1] > y) || (next[1] <= y && current[1] > y)) intersections.push(current[0] + ((y - current[1]) * (next[0] - current[0])) / (next[1] - current[1]));
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index < intersections.length; index += 2) for (let x = Math.ceil(intersections[index]); x <= intersections[index + 1]; x += 1) setPixel(data, size, x, y, color);
  }
}

function circle(data, size, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(data, size, x, y, color);
}

function line(data, size, x1, y1, x2, y2, width, color) {
  const distance = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let index = 0; index <= distance; index += 1) {
    const progress = distance ? index / distance : 0;
    circle(data, size, x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress, width / 2, color);
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function png(size) {
  const data = new Uint8Array(size * size * 4);
  roundedRect(data, size, 0, 0, size - 1, size - 1, Math.round(size * .25), colors.ink);
  polygon(data, size, [[size * .242, size * .246], [size * .758, size * .246], [size * .723, size * .635], [size * .69, size * .74], [size * .61, size * .80], [size * .39, size * .80], [size * .31, size * .74], [size * .277, size * .635]], colors.amber);
  line(data, size, size * .268, size * .307, size * .732, size * .307, size * .043, colors.coral);
  line(data, size, size * .348, size * .219, size * .469, size * .219, size * .043, colors.coral);
  line(data, size, size * .469, size * .219, size * .59, size * .219, size * .043, colors.coral);
  circle(data, size, size * .467, size * .447, size * .027, colors.ink);
  circle(data, size, size * .59, size * .447, size * .027, colors.ink);
  line(data, size, size * .441, size * .543, size * .559, size * .543, size * .025, colors.ink);
  const rows = [];
  for (let y = 0; y < size; y += 1) rows.push(Buffer.concat([Buffer.from([0]), Buffer.from(data.buffer, y * size * 4, size * 4)]));
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

function ico(pngData) {
  const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[6] = 32; header[7] = 32; header[8] = 0; header[9] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(pngData.length, 14); header.writeUInt32LE(22, 18);
  return Buffer.concat([header, pngData]);
}

fs.mkdirSync('public/icons', { recursive: true });
const icon192 = png(192);
const icon512 = png(512);
fs.writeFileSync('public/pwa-192x192.png', icon192);
fs.writeFileSync('public/pwa-512x512.png', icon512);
fs.writeFileSync('public/apple-touch-icon.png', png(180));
fs.writeFileSync('public/favicon.ico', ico(png(32)));
