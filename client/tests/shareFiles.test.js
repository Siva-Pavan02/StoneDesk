import test from 'node:test';
import assert from 'node:assert/strict';
import { shareFiles } from '../src/utils/shareFiles.js';

test('Web Share Utility', async (t) => {
  const originalNavigator = global.navigator;

  t.afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  const setNavigator = (nav) => {
    Object.defineProperty(global, 'navigator', {
      value: nav,
      writable: true,
      configurable: true
    });
  };

  await t.test('1. Fails gracefully if navigator.share is undefined', async () => {
    setNavigator({});
    await assert.rejects(
      async () => await shareFiles([], 'Title', 'Text'),
      /Sharing is not supported on this browser/
    );
  });

  await t.test('2. Fails gracefully if navigator.canShare returns false for files', async () => {
    setNavigator({
      share: async () => {},
      canShare: () => false
    });
    await assert.rejects(
      async () => await shareFiles([new Blob()], 'Title', 'Text'),
      /File sharing is unavailable on this browser/
    );
  });

  await t.test('3. Successfully shares when supported', async () => {
    let sharedPayload = null;
    setNavigator({
      share: async (payload) => { sharedPayload = payload; },
      canShare: () => true
    });
    await shareFiles([{name: 'test.pdf'}], 'My Title', 'My Text');
    
    assert.ok(sharedPayload);
    assert.equal(sharedPayload.title, 'My Title');
    assert.equal(sharedPayload.text, 'My Text');
    assert.equal(sharedPayload.files[0].name, 'test.pdf');
  });

  await t.test('4. Gracefully swallows AbortError (User cancellation)', async () => {
    setNavigator({
      share: async () => {
        const err = new Error('Cancelled');
        err.name = 'AbortError';
        throw err;
      },
      canShare: () => true
    });
    
    // Should not reject
    await shareFiles([], 'Title', 'Text');
  });

  await t.test('5. Throws other errors from share', async () => {
    setNavigator({
      share: async () => {
        throw new Error('Some native error');
      },
      canShare: () => true
    });
    
    await assert.rejects(
      async () => await shareFiles([], 'Title', 'Text'),
      /Some native error/
    );
  });
});
