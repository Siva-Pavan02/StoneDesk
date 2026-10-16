// DB-free tests for MasterSettings.bankDetails newline preservation (Req 9.7, 9.8, 9.10, 9.11, 13.3, 13.5, 13.6).
// The controller's prisma import is replaced with an in-memory store through require.cache,
// the same injection pattern used by securityBoundary.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');

const ORG = '11111111-1111-4111-8111-111111111111';
let row;
const reset = () => { row = { id: ORG, version: 0, businessName: 'Stone Co', address: '', phone: '', bankDetails: 'UPI: before@upi', gstNumber: '', tradeLicense: '', logoPath: null }; };
const pick = (obj, select) => select ? Object.fromEntries(Object.keys(select).map(k => [k, obj[k]])) : structuredClone(obj);
const fakePrisma = {
  masterSettings: {
    findUniqueOrThrow: async ({ where }) => { assert.equal(where.id, ORG); return structuredClone(row); },
    findUnique: async ({ where, select }) => { assert.equal(where.id, ORG); return pick(row, select); },
    updateMany: async ({ where, data }) => {
      if (where.id !== row.id || where.version !== row.version) return { count: 0 };
      const { version, ...rest } = data;
      row = { ...row, ...structuredClone(rest), version: row.version + (version?.increment ?? 0) };
      return { count: 1 };
    }
  }
};
require.cache[require.resolve('../utils/prisma')] = { exports: fakePrisma };
const controller = require('../controllers/masterSettingsController');
const { snapshot } = require('../utils/businessBranding');

async function save(body) {
  const res = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
  let error;
  await controller.updateProfile({ body: { businessName: 'Stone Co', ...body }, user: { organizationId: ORG } }, res, err => { error = err; });
  if (error) throw error;
  return res;
}
// Reload path: what GET /settings returns is the stored row.
const reload = () => fakePrisma.masterSettings.findUniqueOrThrow({ where: { id: ORG } });

// mulberry32 seeded PRNG (inline; no new dependencies).
function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ALPHABET = 'abcXYZ0123@.:/-₹é ';
const BREAKS = ['\n', '\r\n', '\n\n'];
const EDGE_WS = [' ', '\t', '\n', '\r\n', '\u00a0'];
function genBankDetails(rand) {
  // Core of 1..300 chars that is already trimmed, with internal line breaks, plus optional edge whitespace.
  const target = 1 + Math.floor(rand() * 300);
  let core = '';
  while (core.length < target) core += rand() < 0.15 ? BREAKS[Math.floor(rand() * BREAKS.length)] : ALPHABET[Math.floor(rand() * ALPHABET.length)];
  core = core.slice(0, target).trim() || 'x';
  const edge = () => Array.from({ length: Math.floor(rand() * 3) }, () => EDGE_WS[Math.floor(rand() * EDGE_WS.length)]).join('');
  return edge() + core + edge();
}

test('Property 10: bank text survives save and reload unchanged (Validates: Requirements 9.8, 9.7, 13.6)', async () => {
  const base = Number(process.env.PBT_SEED) || 0xB4A4;
  for (let i = 0; i < 150; i++) {
    const seed = base + i;
    const input = genBankDetails(mulberry32(seed));
    reset();
    try {
      const res = await save({ bankDetails: input });
      assert.equal(res.statusCode, 200);
      const expected = input.trim();
      assert.ok(expected.length <= 300);
      assert.equal(res.body.bankDetails, expected);
      assert.equal((await reload()).bankDetails, expected);
      // Bill snapshot copies the text verbatim (no logo, so no storage access).
      assert.equal((await snapshot(await reload(), ORG)).bankDetails, expected);
    } catch (error) {
      console.error(`Property 10 failed: seed=${seed} input=${JSON.stringify(input)}`);
      throw error;
    }
  }
});

test('exact round-trip keeps internal newlines and trims only the edges', async () => {
  reset();
  const input = '  \nBank: State Bank of India\nA/C: 1234567890\r\nIFSC: SBIN0000001\n\nUPI: shop@upi \n\t';
  await save({ bankDetails: input });
  assert.equal((await reload()).bankDetails, 'Bank: State Bank of India\nA/C: 1234567890\r\nIFSC: SBIN0000001\n\nUPI: shop@upi');
});

test('limit is measured after trimming: 300 trimmed chars accepted, 301 rejected with settings unchanged', async () => {
  reset();
  const ok = 'a\n'.repeat(149) + 'bb'; // 300 chars
  assert.equal(ok.length, 300);
  assert.equal((await save({ bankDetails: `\n  ${ok}  \n` })).statusCode, 200);
  assert.equal((await reload()).bankDetails, ok);

  reset();
  const before = structuredClone(row);
  const res = await save({ bankDetails: ' ' + 'x\n'.repeat(150) + 'y ', address: 'changed' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Bank details must be at most 300 characters');
  assert.deepEqual(await reload(), before);
});

test('omitted, blank, whitespace-only and non-string bankDetails are stored as empty string', async () => {
  for (const body of [{}, { bankDetails: '' }, { bankDetails: '  \n\t\r\n ' }, { bankDetails: null }, { bankDetails: 42 }]) {
    reset();
    assert.equal((await save(body)).statusCode, 200, JSON.stringify(body));
    assert.equal((await reload()).bankDetails, '', JSON.stringify(body));
  }
});

test('businessBranding snapshot keeps newlines and defaults missing bank text to empty string', async () => {
  assert.equal((await snapshot({ businessName: 'X', bankDetails: 'Line 1\nLine 2\r\nLine 3' }, ORG)).bankDetails, 'Line 1\nLine 2\r\nLine 3');
  assert.equal((await snapshot({ businessName: 'X' }, ORG)).bankDetails, '');
  assert.equal((await snapshot(null, ORG)).bankDetails, '');
});
