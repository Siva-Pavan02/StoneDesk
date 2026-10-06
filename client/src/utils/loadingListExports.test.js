import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalToFraction } from './fractionParser.js';

// Logic mimicking the grouping inside PDF/Excel exports
function generateSizeSummary(requirements) {
  const loadedGroups = {};
  requirements.forEach(req => {
    (req.loadedPieces || []).forEach(p => {
      const pLen = p.lengthDisplay || decimalToFraction(p.lengthFt);
      const pWid = p.widthDisplay || decimalToFraction(p.widthFt);
      const key = `${pLen} × ${pWid}`;
      loadedGroups[key] = (loadedGroups[key] || 0) + 1;
    });
  });
  return loadedGroups;
}

test('Mandatory Export Test: Correctly groups exact dimensions and preserves differently sized loaded pieces', () => {
  const requirements = [
    {
      lengthDisplay: '4⅓',
      widthDisplay: '5½',
      lengthFt: 4.333333,
      widthFt: 5.5,
      requiredQuantity: 20,
      loadedQuantity: 20,
      balance: 0,
      loadedPieces: [
        ...Array.from({ length: 18 }).map(() => ({
          lengthDisplay: '4⅓',
          widthDisplay: '5½',
          lengthFt: 4.333333,
          widthFt: 5.5
        })),
        ...Array.from({ length: 2 }).map(() => ({
          lengthDisplay: '4½',
          widthDisplay: '5½',
          lengthFt: 4.5,
          widthFt: 5.5
        }))
      ]
    }
  ];

  const summary = generateSizeSummary(requirements);

  assert.equal(summary['4⅓ × 5½'], 18);
  assert.equal(summary['4½ × 5½'], 2);
  assert.equal(Object.keys(summary).length, 2);
});

test('Multiple Requirement Test: Correctly groups loaded pieces across multiple requirements', () => {
  const requirements = [
    {
      lengthDisplay: '4⅓', widthDisplay: '5½',
      loadedPieces: Array.from({ length: 20 }).map(() => ({ lengthDisplay: '4⅓', widthDisplay: '5½' }))
    },
    {
      lengthDisplay: '4½', widthDisplay: '6',
      loadedPieces: Array.from({ length: 15 }).map(() => ({ lengthDisplay: '4½', widthDisplay: '6' }))
    },
    {
      lengthDisplay: '5', widthDisplay: '2⅜',
      loadedPieces: Array.from({ length: 27 }).map(() => ({ lengthDisplay: '5', widthDisplay: '2⅜' }))
    }
  ];

  const summary = generateSizeSummary(requirements);

  assert.equal(summary['4⅓ × 5½'], 20);
  assert.equal(summary['4½ × 6'], 15);
  assert.equal(summary['5 × 2⅜'], 27);
  assert.equal(Object.keys(summary).length, 3);
});
