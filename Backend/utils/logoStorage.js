const path = require('node:path');
const fs = require('node:fs/promises');
const { createClient } = require('@supabase/supabase-js');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
const cloudEnabled = () => process.env.LOGO_STORAGE === 'supabase';
function storageClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Private logo storage is not configured');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage;
}
const bucketName = () => process.env.SUPABASE_LOGO_BUCKET || 'stonedesk-logos';
function valid(filename) {
  if (!/^[a-f0-9-]+\.png$/.test(filename)) throw new Error('Invalid logo filename');
}
function storageFailure() {
  return Object.assign(new Error('Logo storage is temporarily unavailable. Please retry.'), { status: 503, safeAuthError: true });
}
async function saveLogo(filename, buffer) {
  valid(filename);
  if (cloudEnabled()) {
    const { error } = await storageClient().from(bucketName()).upload(filename, buffer, { contentType: 'image/png', upsert: false });
    if (error) throw storageFailure();
  } else {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), buffer);
  }
}
async function readLogo(filename) {
  valid(filename);
  if (!cloudEnabled()) return fs.readFile(path.join(uploadDir, filename));
  const { data, error } = await storageClient().from(bucketName()).download(filename);
  if (error) throw storageFailure();
  return Buffer.from(await data.arrayBuffer());
}
module.exports = { uploadDir, cloudEnabled, storageClient, bucketName, saveLogo, readLogo };
