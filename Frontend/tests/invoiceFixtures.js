import { deflateSync } from 'node:zlib';

// Synthetic landscape logo, kept local to tests. No business asset or network call.
function pngChunk(type, content) {
  const name = Buffer.from(type), payload = Buffer.concat([name, content]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(content.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}

const width = 120, height = 48;
const header = Buffer.alloc(13);
header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc(height * (width * 3 + 1));
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const mark = x >= 12 && x < 36 && y >= 12 && y < 36;
  const index = y * (width * 3 + 1) + 1 + x * 3;
  [pixels[index], pixels[index + 1], pixels[index + 2]] = mark ? [244, 248, 245] : [23, 100, 93];
}
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
export const testLogo = `data:image/png;base64,${png.toString('base64')}`;