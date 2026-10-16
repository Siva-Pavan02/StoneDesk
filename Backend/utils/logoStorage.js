const path = require('node:path');
const fs = require('node:fs/promises');
const { createClient } = require('@supabase/supabase-js');
const { supabaseSecretKey } = require('./supabaseKeys');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
const cloudEnabled = () => process.env.LOGO_STORAGE === 'supabase';
function storageClient() {
  const key = supabaseSecretKey('storage');
  if (!process.env.SUPABASE_URL || !key) throw new Error('Private logo storage is not configured');
  return createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage;
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

// Content-addressed logos: org/<organizationId>/<sha256>.png. The name is the hash of
// the bytes, so an object is never overwritten and repeat uploads dedupe. Callers pass
// the session's organization id; nothing here trusts a client-supplied folder.
const ORGANIZATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
function contentLogoKey(organizationId, sha256) {
  if (typeof organizationId !== 'string' || !ORGANIZATION_ID.test(organizationId) || typeof sha256 !== 'string' || !SHA256.test(sha256)) throw new Error('Invalid logo path');
  return `org/${organizationId}/${sha256}.png`;
}
const errorText = error => `${error?.message || ''} ${typeof error?.error === 'string' ? error.error : ''}`;
const isDuplicate = error => String(error?.statusCode) === '409' || error?.status === 409 || /already exists|duplicate/i.test(errorText(error));
// Only a missing object is "not found". Supabase reports a missing bucket or tenant with the
// same statusCode '404' ("Bucket not found"); that is a configuration problem and must surface
// as 503, not as a quiet 404 that the browser turns into the logo placeholder.
const isObjectNotFound = error => {
  if (error?.code === 'NoSuchKey') return true;
  const text = errorText(error);
  if (error?.code === 'NoSuchBucket' || error?.code === 'TenantNotFound' || /bucket|tenant/i.test(text)) return false;
  return /object not found|\bnot_found\b/i.test(text);
};
const logoNotFound = () => Object.assign(new Error('Logo not found'), { status: 404 });
// Resolves 'created' or 'exists'. An existing object is the same bytes by construction.
async function saveContentLogo(organizationId, sha256, buffer) {
  const key = contentLogoKey(organizationId, sha256);
  if (cloudEnabled()) {
    const { error } = await storageClient().from(bucketName()).upload(key, buffer, { contentType: 'image/png', upsert: false, cacheControl: '31536000' });
    if (!error) return 'created';
    if (isDuplicate(error)) return 'exists';
    throw storageFailure();
  }
  const file = path.join(uploadDir, ...key.split('/'));
  await fs.mkdir(path.dirname(file), { recursive: true });
  try { await fs.writeFile(file, buffer, { flag: 'wx' }); } catch (error) {
    if (error.code === 'EEXIST') return 'exists';
    throw error;
  }
  return 'created';
}
async function readContentLogo(organizationId, sha256) {
  const key = contentLogoKey(organizationId, sha256);
  if (!cloudEnabled()) {
    try { return await fs.readFile(path.join(uploadDir, ...key.split('/'))); } catch (error) {
      if (error.code === 'ENOENT') throw logoNotFound();
      throw error;
    }
  }
  const { data, error } = await storageClient().from(bucketName()).download(key);
  if (error) throw isObjectNotFound(error) ? logoNotFound() : storageFailure();
  return Buffer.from(await data.arrayBuffer());
}
module.exports = { uploadDir, cloudEnabled, storageClient, bucketName, saveLogo, readLogo, storageFailure, contentLogoKey, saveContentLogo, readContentLogo };
