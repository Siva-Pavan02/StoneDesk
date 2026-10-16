// DB-free tests for content-addressed logo storage and the finalize snapshot. Run with:
//   node --test tests/logoContent.test.js
// Must not require ./database (that needs .env.test and a PostgreSQL database).
// Uses local-disk logo storage in a fresh temp directory; never touches Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');

const ORG = 'aaaaaaaa-0000-4000-8000-00000000000a';
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

test('storeLogo writes content-addressed PNGs and snapshot() stores only a reference', async t => {
  const saved = { dir: process.env.UPLOAD_DIR, mode: process.env.LOGO_STORAGE };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stonedesk-logo-content-'));
  process.env.UPLOAD_DIR = directory;
  delete process.env.LOGO_STORAGE;
  t.after(async () => {
    if (saved.dir === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = saved.dir;
    if (saved.mode === undefined) delete process.env.LOGO_STORAGE; else process.env.LOGO_STORAGE = saved.mode;
    await fs.rm(directory, { recursive: true, force: true });
  });
  const { storeLogo, snapshot } = require('../utils/businessBranding');
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#115e59' } }).png().toBuffer();
  const contentFile = sha => path.join(directory, 'org', ORG, `${sha}.png`);

  const logoPath = await storeLogo(png, 'image/png', ORG);
  const sha = logoPath.match(/^\/uploads\/logos\/([a-f0-9]{64})\.png$/)?.[1];
  assert.ok(sha, logoPath);
  const stored = await fs.readFile(contentFile(sha));
  assert.equal(sha256(stored), sha);

  await t.test('the same image maps to the same object without an overwrite error', async () => {
    assert.equal(await storeLogo(png, 'image/png', ORG), logoPath);
  });

  await t.test('JPEG uploads are re-encoded to PNG', async () => {
    const jpeg = await sharp({ create: { width: 24, height: 12, channels: 3, background: '#335577' } }).jpeg().toBuffer();
    const jpegPath = await storeLogo(jpeg, 'image/jpeg', ORG);
    const jpegSha = jpegPath.match(/^\/uploads\/logos\/([a-f0-9]{64})\.png$/)[1];
    assert.equal((await sharp(await fs.readFile(contentFile(jpegSha))).metadata()).format, 'png');
  });

  await t.test('an invalid organization id is rejected before any write', async () => {
    for (const org of ['org-a', ORG.toUpperCase(), '../x', undefined]) await assert.rejects(storeLogo(png, 'image/png', org), /Invalid logo path/);
  });

  await t.test('finalize snapshot keeps text fields and references the logo, never embedding it', async () => {
    const result = await snapshot({ businessName: 'B', address: 'A', phone: 'P', bankDetails: 'K', logoPath }, ORG);
    assert.deepEqual(result.logo, { sha256: sha, width: 20, height: 20, bytes: stored.length });
    assert.equal(Object.hasOwn(result, 'logoDataUrl'), false);
    assert.deepEqual({ ...result, logo: undefined }, { businessName: 'B', address: 'A', phone: 'P', bankDetails: 'K', logo: undefined });
  });

  await t.test('a legacy <uuid>.png logo is copied to the content-addressed key and referenced', async () => {
    const legacy = await sharp({ create: { width: 30, height: 10, channels: 3, background: '#aa3300' } }).png().toBuffer();
    const legacySha = sha256(legacy);
    await fs.writeFile(path.join(directory, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.png'), legacy);
    const result = await snapshot({ businessName: 'B', logoPath: '/uploads/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png' }, ORG);
    assert.deepEqual(result.logo, { sha256: legacySha, width: 30, height: 10, bytes: legacy.length });
    assert.ok((await fs.readFile(contentFile(legacySha))).equals(legacy));
    assert.equal(Object.hasOwn(result, 'logoDataUrl'), false);
    // A second finalize with the same legacy logo finds the copy already in place.
    assert.deepEqual((await snapshot({ businessName: 'B', logoPath: '/uploads/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png' }, ORG)).logo, result.logo);
  });

  await t.test('tampered, missing and malformed stored logos fail closed', async () => {
    const other = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000000' } }).png().toBuffer();
    const tamperedSha = sha256(Buffer.from('original bytes'));
    await fs.writeFile(contentFile(tamperedSha), other);
    await assert.rejects(snapshot({ businessName: 'B', logoPath: `/uploads/logos/${tamperedSha}.png` }, ORG), error => error.status === 400);
    await assert.rejects(snapshot({ businessName: 'B', logoPath: `/uploads/logos/${'f'.repeat(64)}.png` }, ORG), error => error.status === 503);
    for (const bad of ['/uploads/../x.png', '/uploads/logos/../x.png', `/uploads/logos/${sha.toUpperCase()}.png`, 'https://evil.example/x.png']) {
      await assert.rejects(snapshot({ businessName: 'B', logoPath: bad }, ORG), error => error.status === 400, bad);
    }
    // Another organization's folder is never read: the same sha under ORG_B is not found.
    await assert.rejects(snapshot({ businessName: 'B', logoPath }, 'bbbbbbbb-0000-4000-8000-00000000000b'), error => error.status === 503);
  });

  await t.test('no logoPath gives no logo key', async () => {
    const result = await snapshot({ businessName: 'B' }, ORG);
    assert.equal(Object.hasOwn(result, 'logo'), false);
    assert.equal(Object.hasOwn(result, 'logoDataUrl'), false);
  });
});
