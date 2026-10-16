const path = require('node:path');
const sharp = require('sharp');
const { createHash } = require('node:crypto');
const { bad } = require('./pilotCalculations');
const { uploadDir, readLogo, storageFailure, saveContentLogo, readContentLogo } = require('./logoStorage');

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

function validateLogoFilename(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const basename = path.basename(filename);
  if (basename !== filename) return false;
  return /^[a-f0-9-]+\.png$/.test(basename);
}

// Re-encodes the upload and stores it content-addressed at org/<organizationId>/<sha256>.png.
// The same image uploaded twice maps to the same object, so 'exists' is success.
async function storeLogo(buffer, mime, organizationId) {
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
  const sha = sha256(output);
  await saveContentLogo(organizationId, sha, output);
  return `/uploads/logos/${sha}.png`;
}

// Finalized bills keep a small reference to an immutable object instead of the bytes:
// businessSnapshot.logo = { sha256, width, height, bytes }. The frontend fetches
// /uploads/logos/<sha256>.png once and embeds it at render time.
async function snapshot(settings, organizationId) {
  const result = { businessName: settings?.businessName || 'StoneDesk', address: settings?.address || '', phone: settings?.phone || '', bankDetails: settings?.bankDetails || '' };
  if (settings?.logoPath) {
    const logoPath = settings.logoPath;
    const contentSha = typeof logoPath === 'string' ? logoPath.match(/^\/uploads\/logos\/([a-f0-9]{64})\.png$/)?.[1] : undefined;
    let sha, buffer;
    if (contentSha) {
      try { buffer = await readContentLogo(organizationId, contentSha); } catch (error) {
        // A referenced object that is missing is a storage problem, not a bad request:
        // keep the 503 rather than finalizing without branding.
        if (error.status === 404) throw storageFailure();
        throw error;
      }
      sha = sha256(buffer);
      if (sha !== contentSha) bad('Invalid stored logo');
    } else {
      // Legacy <uuid>.png logoPath: copy it once to the content-addressed key and
      // reference that. MasterSettings.logoPath is left as is.
      const filename = typeof logoPath === 'string' ? logoPath.match(/^\/uploads\/([a-f0-9-]+\.png)$/)?.[1] : undefined;
      if (!filename || !validateLogoFilename(filename)) bad('Invalid stored logo');
      // readLogo takes the bare filename and resolves it against the active backend,
      // which is Supabase Storage in production. The filename has already passed the
      // separator-free whitelist above, so there is no local path to contain.
      buffer = await readLogo(filename);
      sha = sha256(buffer);
      await saveContentLogo(organizationId, sha, buffer);
    }
    let metadata;
    try { metadata = await sharp(buffer).metadata(); } catch { bad('Invalid stored logo'); }
    if (metadata.format !== 'png' || !metadata.width || !metadata.height) bad('Invalid stored logo');
    result.logo = { sha256: sha, width: metadata.width, height: metadata.height, bytes: buffer.length };
  }
  return result;
}
module.exports = { uploadDir, storeLogo, snapshot };
