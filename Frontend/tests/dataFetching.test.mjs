// Browser regression with mocked APIs only; never reads or changes live accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildAnalytics } = require('../../Backend/utils/dispatchAnalytics');
let pw = process.env.INTERFACE_PLAYWRIGHT_DIR;
if (!pw) {
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache', '_npx');
  for (const item of await fs.readdir(cache)) {
    const candidate = path.join(cache, item, 'node_modules', 'playwright');
    if (existsSync(path.join(candidate, 'test.mjs'))) { pw = candidate; break; }
  }
}
assert.ok(pw, 'Set INTERFACE_PLAYWRIGHT_DIR to an installed Playwright directory');
const { chromium } = await import(pathToFileURL(path.join(pw, 'index.mjs')));
const { expect } = await import(pathToFileURL(path.join(pw, 'test.mjs')));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.INTERFACE_BASE_URL || 'http://127.0.0.1:5173';
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const requests = [], errors = [];
    const user = { id: 'test-user', organizationId: 'test-org', name: 'Tester', email: 'test@example.invalid', role: 'Admin', active: true };
    const settings = { id: 'test-org', organizationId: 'TEST-YARD', businessName: 'Test Yard', stoneRates: [{ id: 'stone', stoneType: 'Stone', finish: 'Polished', defaultRate: 40 }], savedTrucks: [], savedDestinations: [], defaultRoyaltyFee: 0 };
    const row = name => ({ id: name, partyName: `${name} Party`, date: '2026-10-10', createdAt: '2026-10-10', updatedAt: '2026-10-10', status: 'Draft', dispatchSlipNumber: name, logistics: { truckNumber: 'AP-1' }, summary: { totalPieces: 1, totalSqFt: 6, netPayable: 240 }, inventory: [] });
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      requests.push(url.pathname + url.search);
      let body;
      if (url.pathname === '/api/auth/session') body = { user };
      else if (url.pathname.startsWith('/api/master-settings/')) body = settings;
      else if (url.pathname === '/api/auth/users') body = [user];
      else if (url.pathname === '/api/auth/invitations') body = [];
      else if (url.pathname === '/api/loading-lists') body = { data: [{ id: '11111111-1111-4111-8111-111111111111', loadingListNumber: 'LL-ONE', buyerDestination: 'Kadapa' }], nextCursor: null };
      else if (url.pathname.startsWith('/api/loading-lists/')) { await new Promise(resolve => setTimeout(resolve, 700)); body = { id: '11111111-1111-4111-8111-111111111111', loadingListNumber: 'LL-ONE', supervisor: 'Loaded supervisor', buyerDestination: 'Kadapa', stoneType: 'Stone', finish: 'Polished', requirements: [] }; }
      else if (url.pathname === '/api/dispatches/analytics') body = buildAnalytics([], new Date());
      else if (url.pathname === '/api/dispatches') {
        const q = url.searchParams.get('q') || 'recent';
        if (q === 'slow') await new Promise(resolve => setTimeout(resolve, 800));
        body = { data: [row(q)], nextCursor: null, statusCounts: { all: 1, Draft: 1, Dispatched: 0, Delivered: 0 } };
      } else if (url.pathname.startsWith('/api/dispatches/')) body = row('saved');
      else throw new Error(`Unexpected request ${url.pathname}`);
      await route.fulfill({ json: body });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/#settings`);
    await expect(page.locator('#settings-account-heading')).toBeVisible();
    assert.equal(requests.filter(p => p === '/api/auth/session').length, 1);
    assert.equal(requests.filter(p => p.startsWith('/api/master-settings/')).length, 1);
    assert.equal(requests.filter(p => p.startsWith('/api/dispatches')).length, 0);
    await page.evaluate(() => { location.hash = 'entries'; });
    await expect(page.getByText('recent Party', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    assert.equal(requests.filter(p => p === '/api/dispatches').length, 1);
    assert.equal(requests.filter(p => p === '/api/dispatches/analytics').length, 0);
    // Search is part of the Loading entries toolbar, so #entries is already open above.
    const search = page.locator('#global-search');
    await search.fill('f'); await search.fill('fa'); await search.fill('fast');
    await expect(page.getByText('fast Party', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    assert.equal(requests.filter(p => p.includes('?q=')).length, 1, 'typing is debounced');
    await search.fill('slow');
    await expect.poll(() => requests.some(p => p.endsWith('?q=slow'))).toBe(true);
    await search.fill('fast');
    await expect.poll(() => requests.filter(p => p.endsWith('?q=fast')).length).toBe(2);
    await page.waitForTimeout(1000);
    await expect(page.getByText('fast Party', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const beforeBill = requests.length;
    await page.evaluate(() => { location.hash = 'bill/saved'; });
    await expect.poll(() => requests.slice(beforeBill).includes('/api/dispatches/saved')).toBe(true);
    await page.waitForTimeout(200);
    assert.deepEqual(requests.slice(beforeBill), ['/api/dispatches/saved']);
    const beforeLists = requests.length;
    await page.evaluate(() => { location.hash = 'requirements'; });
    await expect(page.getByLabel('Saved loading lists', { exact:true })).toBeVisible();
    await expect.poll(()=>requests.slice(beforeLists).some(p=>p === '/api/loading-lists' || p.startsWith('/api/loading-lists?'))).toBe(true);
    assert.equal(requests.slice(beforeLists).filter(p=>p.startsWith('/api/loading-lists/')).length,0);
    page.once('dialog', dialog=>dialog.accept());
    await page.getByLabel('Saved loading lists', { exact:true }).selectOption('11111111-1111-4111-8111-111111111111');
    await expect(page.getByRole('status').filter({hasText:'Opening loading list'})).toBeVisible();
    await expect(page.getByLabel('Search loading lists', {exact:true})).toBeDisabled();
    await expect(page.locator('input[value="Loaded supervisor"]')).toBeVisible();
    await expect.poll(()=>requests.slice(beforeLists).filter(p=>p.startsWith('/api/loading-lists/')).length).toBe(1);
    await page.getByLabel('Search loading lists', { exact:true }).fill('old');
    await expect.poll(()=>requests.some(p=>p==='/api/loading-lists?q=old')).toBe(true);
    assert.equal(requests.slice(beforeLists).filter(p=>p.startsWith('/api/master-settings/')).length,0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: settings requests, lazy lists, debounced search, stale-response protection, bill-only fetch`);
    await context.close();
  }
} finally { await browser.close(); }

