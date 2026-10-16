// Feature: unified-a4-bill-format, Property 11: Markup characters in bank details render as literal text.
// For any bankDetails text containing <, >, &, ", ', the rendered Bank_Details_Block shows them as
// literal visible text (escaped as entities) and creates no markup element from them.
// **Validates: Requirements 10.10**
import test from 'node:test';
import assert from 'node:assert/strict';
import { genA4Input, genBankText, planSynthetic, runProperty } from './helpers/a4Generators.js';
import { bankDetailPairs, bankDetailSegments, prepareA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { renderA4Invoice } from '../src/utils/a4InvoiceRender.js';

const MARKUP_SNIPPETS = ['<b>bold</b>', '<br/>', '<script>alert(1)</script>', 'A&B', '"q"', "it's", '<', '>', '&amp;', '<img src=x onerror=y>'];
// The only tags the renderer emits inside the bank block.
const KNOWN_TAG = /<\/?(?:section|div|h2|p|span|dl|dt|dd)(?:\s[^<>]*)?>/g;
const ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ENTITY[entity]);

// Returns the `<section class="bank-details">…</section>` substring (it nests no section).
function extractBankBlock(html) {
  const match = html.match(/<section [^>]*class="bank-details">[\s\S]*?<\/section>/);
  assert.ok(match, 'the bank details block is rendered');
  const block = match[0];
  assert.ok(/<dl class="bank-fields">|<p class="bank-text">/.test(block), 'the bank block holds pairs or one plain line');
  return block;
}

// Ensures the text carries markup characters, inserted inside an existing segment.
function withMarkup(rng, text) {
  const snippet = `${rng.pick(MARKUP_SNIPPETS)} ${rng.pick(MARKUP_SNIPPETS)}`;
  const trimmed = text.trimEnd();
  return `${trimmed} ${snippet}${text.slice(trimmed.length)}`;
}

test('Feature: unified-a4-bill-format, Property 11: Markup characters in bank details render as literal text', async () => {
  await runProperty('Property 11: bank details markup escaping', rng => {
    const bank = genBankText(rng);
    const input = genA4Input(rng, { maxGroups: 12, bankDetails: withMarkup(rng, bank.text) });
    input.mode = 'production';
    input.status = rng.pick(['Draft', 'Dispatched', 'Delivered']);
    return input;
  }, input => {
    const model = prepareA4Invoice(input);
    const html = renderA4Invoice(model, planSynthetic(model, 'buyer'), 'buyer', 'document');
    const block = extractBankBlock(html);
    const text = model.seller.bankDetails.trim();

    // No markup element comes from the input: once the renderer's own tags are removed, no < or > remains.
    const textOnly = block.replace(KNOWN_TAG, '\u0000');
    assert.ok(!/[<>]/.test(textOnly), `no raw < or > outside renderer tags: ${textOnly}`);
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(textOnly), 'every & is part of an entity');
    assert.ok(!/<(?:script|b|br|img)\b/i.test(block), 'no input tag appears as markup');

    // Decoded visible text reproduces the parsed bank details exactly, in order.
    const nodes = textOnly.split('\u0000').filter(Boolean).map(decode);
    const pairs = bankDetailPairs(text);
    const expected = pairs ? pairs.flatMap(([label, value]) => [`${label}:`, value]) : [bankDetailSegments(text).join(' · ')];
    assert.deepEqual(nodes, ['Bank details', ...expected]);
  });
});
