// Feature: unified-a4-bill-format, Property 1: Driver copy carries no money or bank text.
// For any valid A4Model, the driver copy's HTML text content contains no ₹, no "Rs"/"INR"
// token (incl. "Rs."), no "Rupees", no formatted Rupee_Amount of the buyer model (rates, line amounts,
// group amounts, materialTotal, loading/royalty, netPayable) and no text from seller.bankDetails.
// The vector PDF is drawn from this very markup in the browser, so it is checked there
// (tests/a4InvoicePdf.test.js and the browser PDF check) instead of here.
// **Validates: Requirements 1.7, 1.8**
//
// Collision handling: an amount is compared as a whole numeric token, never as a substring, so
// "16.00" inside "116.00" is not a hit. A formatted amount is skipped only when the same token is a
// legitimate non-money value of the buyer model (an entry/group/total area, a dimension, or a number
// inside the reference, date, lorry number or contact line) — those strings may rightly appear on
// the driver copy. Bank tokens (length ≥ 4) are skipped only when they already appear in the driver
// copy rendered from the same input with empty bank details (fixed template words such as "Total",
// seller-name words such as "Stone"); unique markers (ZQ…) are always checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { genA4Input, genBankText, planSynthetic, runProperty } from './helpers/a4Generators.js';
import { SAMPLE_BANK_PAIRS, formatA4Dimension, formatA4Money, formatA4Number, formatA4Rate, prepareA4Invoice,
  projectCopy, sampleA4Invoice } from '../src/utils/a4InvoiceModel.js';
import { renderA4Invoice } from '../src/utils/a4InvoiceRender.js';

const ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ENTITY[entity]);
// Tags become spaces so adjacent cells stay separate tokens.
const htmlText = html => decode(html.replace(/<[^>]*>/g, ' '));
const ariaLabels = html => [...html.matchAll(/aria-label="([^"]*)"/g)].map(([, value]) => decode(value));

const NUMBER_TOKEN = /\d[\d,]*\d(?:\.\d+)*|\d(?:\.\d+)*/g;
const tokens = text => new Set(String(text ?? '').match(NUMBER_TOKEN) || []);

// Every formatted money string of the buyer model, as a bare number token.
function moneyTokens(model) {
  const bare = formatted => formatted.replace(/^₹/, '');
  const values = new Set();
  const add = (formatter, value) => { if (value != null) values.add(bare(formatter(value))); };
  for (const group of model.groups) {
    for (const entry of group.entries) { add(formatA4Rate, entry.ratePerSqFt); add(formatA4Money, entry.amount); add(formatA4Money, entry.unroundedAmount); }
    for (const part of [group.regular, group.top, group.total]) add(formatA4Money, part.amount);
  }
  for (const key of ['regularAmount', 'topAmount', 'materialTotal', 'netPayable']) add(formatA4Money, model.totals[key]);
  add(formatA4Money, model.loadingRoyalty);
  return values;
}

// Number tokens that legitimately appear on the driver copy.
function nonMoneyTokens(model) {
  const values = new Set();
  const addText = text => tokens(text).forEach(token => values.add(token));
  for (const group of model.groups) {
    for (const entry of group.entries) {
      values.add(formatA4Number(entry.area));
      for (const dim of [entry.lengthFt, entry.widthFt]) { addText(formatA4Dimension(dim)); addText(dim); }
    }
    for (const part of [group.regular, group.top, group.total]) values.add(formatA4Number(part.area));
  }
  for (const key of ['area', 'regularArea', 'topArea']) values.add(formatA4Number(model.totals[key]));
  const { seller } = model;
  for (const text of [model.invoiceNumber, model.lorryNumber, model.invoiceDate?.label, model.invoiceDate?.datetime,
    seller.name, seller.location, seller.phone, seller.contactLine, model.party, model.destination, model.supervisor]) addText(text);
  return values;
}

const bankTokens = text => [...new Set(String(text).split(/[^\p{L}\p{N}@]+/u).filter(token => token.length >= 4))];

function assertNoMoney(text, model, where) {
  assert.ok(!text.includes('₹'), `${where}: no ₹`);
  assert.doesNotMatch(text, /\b(?:Rs|INR)\b/, `${where}: no Rs / Rs. / INR token`);
  assert.doesNotMatch(text, /Rupees?/i, `${where}: no Rupees`);
  const present = tokens(text), allowed = nonMoneyTokens(model);
  for (const amount of moneyTokens(model)) {
    if (allowed.has(amount)) continue; // collides with an area / dimension / identity number
    assert.ok(!present.has(amount), `${where}: amount ${amount} must not appear`);
  }
}

function assertNoBank(text, baseline, bankText, where) {
  for (const token of bankTokens(bankText)) {
    if (baseline.includes(token)) continue; // part of the fixed driver template or other model text
    assert.ok(!text.includes(token), `${where}: bank text "${token}" must not appear`);
  }
}

function driverTexts(model) {
  const driver = projectCopy(model, 'driver');
  const html = renderA4Invoice(driver, planSynthetic(driver, 'driver'), 'driver', 'prop1');
  return { html, htmlText: htmlText(html) };
}

function checkModel(model, bankText) {
  const { html, htmlText: text } = driverTexts(model);
  assertNoMoney(text, model, 'driver HTML');
  for (const label of ariaLabels(html)) assert.doesNotMatch(label, /₹|\b(?:Rs|INR)\b|Rupees?/i, `aria-label "${label}" carries no money`);
  // The money-free sections of the reference final page are the only ones present.
  assert.doesNotMatch(html, /Payment summary|Material total|Loading \/ royalty|Net payable|Bank details|Amount in words/, 'driver HTML has no money section');
  assert.doesNotMatch(html, /Order totals and payment summary/, 'driver continuation note never mentions payment');

  // Baseline: the same model with no bank details, rendered as the driver copy.
  const bare = { ...model, seller: { ...model.seller, bankDetails: '' } };
  assertNoBank(text, driverTexts(bare).htmlText, bankText, 'driver HTML');
}

// Distinctive markers so the bank check never depends only on generic words.
function bankWithMarkers(rng) {
  const n = rng.int(100, 999_999);
  return `${genBankText(rng).text}\nHolder: ZQHOLDER${n}\nIFSC: ZQIFSC${n}\nUPI: zqbank${n}@upi`;
}

test('Feature: unified-a4-bill-format, Property 1: Driver copy carries no money or bank text', async () => {
  await runProperty('Property 1: driver copy has no money or bank text', rng => {
    const input = genA4Input(rng, { maxGroups: 20, bankDetails: bankWithMarkers(rng) });
    input.mode = 'production';
    input.status = rng.pick(['Draft', 'Dispatched', 'Delivered']);
    return input;
  }, input => {
    const model = prepareA4Invoice(input);
    checkModel(model, model.seller.bankDetails);
  });
});

test('Property 1 (sample mode): driver copy has no money, sample rate or bank placeholders', () => {
  const input = sampleA4Invoice();
  input.seller = { ...input.seller, bankDetails: 'Holder: ZQSAMPLEHOLDER | IFSC: ZQSAMPLEIFSC' };
  const model = prepareA4Invoice(input);
  const placeholders = SAMPLE_BANK_PAIRS.flat().join(' ');
  checkModel(model, `${model.seller.bankDetails} ${placeholders}`);
  const { htmlText: text } = driverTexts(model);
  for (const [, value] of SAMPLE_BANK_PAIRS) {
    assert.ok(!text.includes(value), `driver HTML has no sample placeholder ${value}`);
  }
  assert.doesNotMatch(text, /Sample rate/);
});
