// Browser regression with mocked APIs only; never reads or changes live accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildAnalytics, buildPaymentAnalytics } = require('../../Backend/utils/dispatchAnalytics');
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
    let savedDraft = null;
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
      else if (url.pathname === '/api/dispatches/analytics') {
        const now = new Date();
        const period = url.searchParams.get('period') || '3';
        body = { ...buildAnalytics([], now, period), paymentAnalytics: buildPaymentAnalytics([], [], now, period) };
        Object.assign(body.paymentAnalytics.current, { outstanding: 123456789.25, received: 98765432.5, unpaidInvoices: 1234, partialInvoices: 567, completedInvoices: 890 });
        if (period === 'all') {
          body.statusCounts.Draft = savedDraft ? 2 : 1; // Saved loads may have earlier dispatch dates.
          body.todayStatusCounts.Draft = 0;
        }
      }
      else if (url.pathname === '/api/dispatches' && route.request().method() === 'POST') {
        const draft = route.request().postDataJSON();
        savedDraft = { ...row('new-draft'), ...draft, id: 'new-draft', status: 'Draft' };
        body = savedDraft;
      }
      else if (url.pathname === '/api/dispatches') {
        const q = url.searchParams.get('q') || 'recent';
        if (q === 'slow') await new Promise(resolve => setTimeout(resolve, 800));
        body = { data: [row(q)], nextCursor: null, statusCounts: { all: 1, Draft: 1, Dispatched: 0, Delivered: 0 } };
      } else if (url.pathname.startsWith('/api/dispatches/')) body = savedDraft && url.pathname.endsWith('/new-draft') ? savedDraft : row('saved');
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
    await page.evaluate(() => { location.hash = 'home'; });
    await expect(page.locator('.dashboard-analytics')).toBeVisible();
    await expect.poll(() => requests.filter(p => p === '/api/dispatches/analytics?period=all').length).toBe(1);
    await expect(page.locator('.analytics-heading')).toContainText('All time');
    await expect(page.locator('.analytics-legend li').first()).toHaveText(/Drafts\s*1/);
    const beforePayments = requests.length;
    await page.evaluate(() => { location.hash = 'payments'; });
    await expect(page.locator('.payments-analytics')).toBeVisible();
    assert.deepEqual(requests.slice(beforePayments), ['/api/dispatches/analytics?period=3']);
    assert.deepEqual((await page.locator('.payments-kpi dt').allInnerTexts()).map(value => value.replace(/\s+/g, ' ').trim()), [
      'ALL TIME Outstanding balance', 'ALL TIME Unpaid invoices', 'ALL TIME Partially paid',
      'LAST 3 DAYS Amount received', 'LAST 3 DAYS Invoices paid in full'
    ]);
    for (const [viewportWidth, viewportHeight] of [[320, 568], [360, 640], [390, 844], [640, 360], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
      await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
      const layout = await page.locator('.payments-kpi-grid').evaluate(grid => {
        const parent = grid.getBoundingClientRect();
        return {
          containerWidth: parent.width,
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          cards: [...grid.children].map(card => {
            const box = card.getBoundingClientRect();
            const label = card.querySelector('dt');
            const value = card.querySelector('dd');
            const context = card.querySelector('.payments-eyebrow').getBoundingClientRect();
            return { top: Math.round(box.top), inside: box.left >= parent.left - 1 && box.right <= parent.right + 1,
              visible: !!label.textContent.trim() && !!value.textContent.trim() &&
                context.width > 0 && context.height > 0 && context.left >= box.left - 1 && context.right <= box.right + 1 &&
                value.scrollHeight <= value.clientHeight + 1 };
          })
        };
      });
      assert.equal(layout.pageOverflow, false, `horizontal overflow at ${viewportWidth}×${viewportHeight}`);
      assert.equal(layout.cards.length, 5);
      assert.ok(layout.cards.every(card => card.inside && card.visible), `KPI clipped at ${viewportWidth}×${viewportHeight}: ${JSON.stringify(layout)}`);
      const tops = layout.cards.map(card => card.top);
      if (layout.containerWidth <= 760) {
        assert.equal(tops[0], tops[3], `first KPI row at ${viewportWidth}×${viewportHeight}`);
        assert.equal(tops[1], tops[2], `second KPI row at ${viewportWidth}×${viewportHeight}`);
        assert.equal(tops[2], tops[4], `second KPI row at ${viewportWidth}×${viewportHeight}`);
        assert.ok(tops[1] > tops[0], `mobile KPI rows at ${viewportWidth}×${viewportHeight}`);
      } else assert.ok(tops.every(top => top === tops[0]), `desktop KPI row at ${viewportWidth}×${viewportHeight}`);
    }
    await page.setViewportSize({ width, height: 900 });
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
    await page.evaluate(() => { location.hash = 'load'; });
    await expect(page.getByRole('heading', { name: 'New load' })).toBeVisible();
    await page.getByLabel('Party name').fill('Earlier load');
    await page.getByLabel('Truck number').fill('AP 12 AB 1234');
    await page.getByLabel('Load date', { exact: true }).first().fill('10102026');
    await page.getByLabel('Destination').fill('Yard');
    await page.getByRole('combobox', { name: /Product \/ finish/ }).click();
    await page.getByRole('option', { name: /Stone/ }).click();
    await page.getByLabel('Length (ft)').fill('2');
    await page.getByLabel('Width (ft)').fill('3');
    await page.getByRole('button', { name: 'Add entry' }).click();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect.poll(() => savedDraft?.status).toBe('Draft');
    await expect(page).toHaveURL(/#bill\/new-draft$/);
    await page.evaluate(() => { location.hash = 'home'; });
    await expect.poll(() => requests.filter(p => p === '/api/dispatches/analytics?period=all').length).toBe(2);
    await expect(page.locator('.analytics-legend li').first()).toHaveText(/Drafts\s*2/);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: lazy data fetching, Payments period, and saved draft dashboard status`);
    await context.close();
  }
} finally { await browser.close(); }
