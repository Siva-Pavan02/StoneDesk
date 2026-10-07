const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');
const { bad } = require('./pilotCalculations');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));

async function storeLogo(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 2 * 1024 * 1024) bad('Logo must be at most 2 MB');
  if (!['image/png', 'image/jpeg'].includes(mime)) bad('Choose a JPEG or PNG logo');
  let output;
  try {
    const image = sharp(buffer, { limitInputPixels: 16000000 });
    const metadata = await image.metadata();
    if ((mime === 'image/png' && metadata.format !== 'png') || (mime === 'image/jpeg' && metadata.format !== 'jpeg')) bad('Logo format does not match its content');
    output = await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch {
    bad('Invalid or oversized JPEG/PNG image');
  }
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}.png`;
  await fs.writeFile(path.join(uploadDir, filename), output);
  return `/uploads/${filename}`;
}
async function snapshot(settings) {
  const result = { businessName: settings?.businessName || 'StoneDesk', address: settings?.address || '', phone: settings?.phone || '' };
  if (settings?.logoPath) {
    const filename = settings.logoPath.match(/^\/uploads\/([a-f0-9-]+\.png)$/)?.[1];
    if (!filename) bad('Invalid stored logo');
    // Store image bytes as well as text: replacing a logo cannot change an old bill.
    result.logoDataUrl = `data:image/png;base64,${(await fs.readFile(path.join(uploadDir, filename))).toString('base64')}`;
  }
  return result;
}
module.exports = { uploadDir, storeLogo, snapshot };
