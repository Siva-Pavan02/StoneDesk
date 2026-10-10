require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const { storageClient, bucketName, uploadDir } = require('../utils/logoStorage');
async function main() {
  const storage = storageClient();
  const bucket = bucketName();
  const options = { public: false, fileSizeLimit: 2 * 1024 * 1024, allowedMimeTypes: ['image/png'] };
  const existing = await storage.getBucket(bucket);
  if (existing.error && !['404', '400'].includes(String(existing.error.statusCode))) throw existing.error;
  const result = existing.data ? await storage.updateBucket(bucket, options) : await storage.createBucket(bucket, options);
  if (result.error) throw result.error;
  let count = 0;
  for (const filename of await fs.readdir(uploadDir).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    if (!/^[a-f0-9-]+\.png$/.test(filename)) continue;
    const result = await storage.from(bucket).upload(filename, await fs.readFile(path.join(uploadDir, filename)), { contentType: 'image/png', upsert: false });
    if (result.error && !['409', 'Duplicate'].includes(String(result.error.statusCode || result.error.error))) throw result.error;
    const downloaded = await storage.from(bucket).download(filename);
    if (downloaded.error) throw downloaded.error;
    const local = await fs.readFile(path.join(uploadDir, filename));
    if (!local.equals(Buffer.from(await downloaded.data.arrayBuffer()))) throw new Error('Logo verification failed');
    count++;
  }
  console.log(`Private logo bucket ready; ${count} existing logos verified. Local originals retained.`);
}
main().catch(() => { console.error('Cloud logo setup failed. Check server credentials and Storage availability.'); process.exitCode = 1; });
