// Feature: unified-a4-bill-format, Property 9: Bank parsing preserves every non-empty label and value in order.
// For any bankDetails text, bankDetailPairs (or bankDetailSegments when not every segment is a pair)
// together contain every non-empty label and value of the input, in input order, trimmed.
// **Validates: Requirements 10.7, 10.9**
import test from 'node:test';
import assert from 'node:assert/strict';
import { genBankText, runProperty } from './helpers/a4Generators.js';
import { bankDetailPairs, bankDetailSegments } from '../src/utils/a4InvoiceModel.js';

// Output tokens the renderer would show: pair labels and values, or plain segments.
function parsedTokens(text) {
  const pairs = bankDetailPairs(text);
  return { pairs, tokens: pairs ? pairs.flat() : bankDetailSegments(text) };
}

// Removes whitespace, delimiters and colons: what remains is the visible content that must survive parsing.
const compact = value => value.replace(/[\s·|;,:]/g, '');

function assertPreserved(text) {
  const { tokens } = parsedTokens(text);
  let cursor = 0;
  for (const token of tokens) {
    assert.ok(token.length > 0, 'no empty label, value or segment');
    assert.equal(token, token.trim(), `token is trimmed: ${JSON.stringify(token)}`);
    const at = text.indexOf(token, cursor);
    assert.ok(at >= cursor, `token ${JSON.stringify(token)} appears in input order`);
    cursor = at + token.length;
  }
  assert.equal(compact(tokens.join('')), compact(text), 'every non-empty character of the input is kept');
}

test('Feature: unified-a4-bill-format, Property 9: Bank parsing preserves every non-empty label and value in order', async () => {
  const kinds = new Set();
  await runProperty('Property 9: bank parsing (generated bank text)', rng => genBankText(rng), ({ text, kind, pairs }) => {
    kinds.add(kind);
    assertPreserved(text);
    if (kind === 'pairs') {
      assert.deepEqual(bankDetailPairs(text), pairs, 'all-pair text parses to the expected trimmed pairs in order');
    } else {
      assert.equal(bankDetailPairs(text), null, 'mixed text yields no pairs');
      const segments = bankDetailSegments(text);
      assert.equal(segments.filter(segment => !segment.includes(':')).length, 1, 'the colon-free value stays one segment');
    }
  });
  assert.deepEqual([...kinds].sort(), ['mixed', 'pairs'], 'both pair and mixed inputs were exercised');
});

const ALPHABET = ['a', 'B', '7', 'SBI', ' ', '  ', '\t', '\n', '\r\n', '\r', ':', ',', ';', '|', '·', ' · ', '<', '&', '"'];

test('Feature: unified-a4-bill-format, Property 9: Bank parsing preserves content for arbitrary text', async () => {
  await runProperty('Property 9: bank parsing (arbitrary text)', rng => {
    const length = rng.int(0, 40);
    return Array.from({ length }, () => rng.pick(ALPHABET)).join('');
  }, text => assertPreserved(text));
});

test('Property 9 examples: legacy single-line bank details (Req 10.8)', () => {
  assert.deepEqual(bankDetailPairs('Bank: SBI, IFSC: SBIN0001'), [['Bank', 'SBI'], ['IFSC', 'SBIN0001']]);
  assert.equal(bankDetailPairs('SBI, Main branch'), null);
  assert.deepEqual(bankDetailSegments('SBI, Main branch'), ['SBI, Main branch']);
  assert.deepEqual(bankDetailSegments('  \n '), []);
  assert.equal(bankDetailPairs(''), null);
});
