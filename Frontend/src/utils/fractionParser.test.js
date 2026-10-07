import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFraction, decimalToFraction } from './fractionParser.js';

test('parseFraction: 4½ is accepted', () => {
  assert.deepEqual(parseFraction('4½'), { numeric: 4.5, display: '4½' });
});

test('parseFraction: 4 1/2 is accepted', () => {
  assert.deepEqual(parseFraction('4 1/2'), { numeric: 4.5, display: '4½' });
});

test('parseFraction: 4 ½ is accepted', () => {
  assert.deepEqual(parseFraction('4 ½'), { numeric: 4.5, display: '4½' });
});

test('parseFraction: 4⅓ is accepted', () => {
  assert.deepEqual(parseFraction('4⅓'), { numeric: 4.333333333333333, display: '4⅓' });
});

test('parseFraction: 4 1/3 is accepted', () => {
  assert.deepEqual(parseFraction('4 1/3'), { numeric: 4.333333333333333, display: '4⅓' });
});

test('parseFraction: 5⅝ is accepted', () => {
  assert.deepEqual(parseFraction('5⅝'), { numeric: 5.625, display: '5⅝' });
});

test('parseFraction: 2⅜ is accepted', () => {
  assert.deepEqual(parseFraction('2⅜'), { numeric: 2.375, display: '2⅜' });
});

test('parseFraction: 1¾ is accepted', () => {
  assert.deepEqual(parseFraction('1¾'), { numeric: 1.75, display: '1¾' });
});

test('parseFraction: 3⅞ is accepted', () => {
  assert.deepEqual(parseFraction('3⅞'), { numeric: 3.875, display: '3⅞' });
});

test('parseFraction: 4.5 is normalized correctly for legacy compatibility', () => {
  assert.deepEqual(parseFraction('4.5'), { numeric: 4.5, display: '4½' });
});

test('parseFraction: 1.25 is normalized correctly for legacy compatibility', () => {
  assert.deepEqual(parseFraction('1.25'), { numeric: 1.25, display: '1¼' });
});

test('parseFraction: Invalid fractions are rejected', () => {
  assert.equal(parseFraction('4 1/x'), null);
  assert.equal(parseFraction('abc'), null);
});

test('parseFraction: Zero denominator is rejected', () => {
  assert.equal(parseFraction('4 1/0'), null);
});

test('parseFraction: Negative dimensions are rejected', () => {
  assert.equal(parseFraction('-4 1/2'), null);
});

test('decimalToFraction: Works natively', () => {
  assert.equal(decimalToFraction(4.5), '4½');
  assert.equal(decimalToFraction(1.25), '1¼');
  assert.equal(decimalToFraction(1.333333), '1⅓');
});
