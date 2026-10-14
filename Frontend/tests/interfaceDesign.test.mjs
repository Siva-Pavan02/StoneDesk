/**
 * Read-only, integrated Vite interface validation. Run directly with Node.
 * Uses Playwright from the npm cache and installed Chrome, not repo dependencies.
 * Every API request is fulfilled locally. No real session, login or account is used.
 * Screenshots, downloaded sample PDFs and reports are written only to OS TEMP.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { testLogo } from './invoiceFixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const base = process.env.INTERFACE_BASE_URL || 'http://localhost:5174';
const widths = (process.env.INTERFACE_WIDTHS || '320,390,768,1024,1440').split(',').map(Number);
const languages = (process.env.INTERFACE_LANGUAGES || 'en,te').split(',');
const phases = (process.env.INTERFACE_PHASES || 'landing,workspace,motion,empty').split(',');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.env.INTERFACE_REPORT_DIR || path.join(os.tmpdir(), `StoneDesk-interface-${stamp}`);
await fs.mkdir(out, { recursive: true });

async function playwrightDirectory() {
  if (process.env.INTERFACE_PLAYWRIGHT_DIR) return process.env.INTERFACE_PLAYWRIGHT_DIR;
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache', '_npx');
  for (const item of await fs.readdir(cache, { withFileTypes: true })) {
    const candidate = path.join(cache, item.name, 'node_modules', 'playwright');
    if (existsSync(path.join(candidate, 'index.mjs')) && existsSync(path.join(candidate, 'test.mjs'))) return candidate;
  }
  throw new Error('No cached Playwright found. Set INTERFACE_PLAYWRIGHT_DIR to a temporary installation.');
}
const pw = await playwrightDirectory();
const { chromium } = await import(pathToFileURL(path.join(pw, 'index.mjs')).href);
const { expect: originalExpect } = await import(pathToFileURL(path.join(pw, 'test.mjs')).href);
const expect = originalExpect.configure({ timeout: 7000 });
const executable = process.env.INTERFACE_CHROME_PATH || [
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].find(existsSync);
assert.ok(executable, 'Installed Chrome is required; no browser is installed by this script.');

async function productionSnapshot() {
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  const snapshot = {};
  for (const name of new Set(names.split('\0').filter(Boolean))) {
    if (name === 'Frontend/tests/interfaceDesign.test.mjs') continue;
    try { snapshot[name] = createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return snapshot;
}
const before = await productionSnapshot();
const settings = {
  id: 'interface-settings', organizationId: 'MOCK-YARD-TEST', businessName: 'Sample Stone & Tile Works',
  address: 'Demonstration only', phone: '', gstNumber: '', tradeLicense: '', logoPath: null,
  defaultRoyaltyFee: 1200, savedTrucks: ['MOCK-LORRY-01', 'MOCK-LORRY-02'],
  savedDestinations: ['Sample North Yard', 'Sample South Yard'],
  stoneRates: [
    { id: 'mock-product-1', stoneType: 'Sample stone', finish: 'Polished', defaultRate: 64 },
    { id: 'mock-product-2', stoneType: 'Sample tile', finish: 'Natural', defaultRate: 52 },
  ],
};
const user = { id: 'mock-admin', name: 'Sample Administrator', email: 'admin@example.invalid', role: 'Admin', active: true, isOwner: true, organizationId: settings.organizationId };
const members = [user, { id: 'mock-member', name: 'Sample Team Member', email: 'member@example.invalid', role: 'Dispatcher', active: true, isOwner: false }];
const statuses = ['Draft', 'Dispatched', 'Delivered', 'Draft', 'Dispatched', 'Delivered', 'Draft', 'Delivered'];
const records = statuses.map((status, i) => ({
  id: `mock-load-${i + 1}`, status, date: `2026-10-${String(8 - i).padStart(2, '0')}T06:30:00.000Z`,
  dispatchSlipNumber: `MOCK-00${i + 1}`, partyName: `Sample Buyer ${i + 1}`, supervisor: user.name,
  logistics: { truckNumber: `MOCK-LORRY-0${i + 1}`, buyerDestination: 'Sample North Yard' },
  businessSnapshot: { businessName: settings.businessName, address: settings.address },
  inventory: [{ stoneType: 'Sample stone', finish: 'Polished', ratePerSqFt: 64, totalSqFt: 268.5, lineTotal: 17184, measurementRows: [
    { lengthFt: 3.5, widthFt: 2, quantity: 30, category: 'Regular', sqFt: 210, lineTotal: 13440 },
    { lengthFt: 3, widthFt: 1.5, quantity: 13, category: 'TOP', sqFt: 58.5, lineTotal: 3744 },
  ] }],
  summary: { totalPieces: 43, totalDispatchVolumeSqFt: 268.5, baseMaterialTotal: 17184, loadingAndRoyaltyFees: 1200, netBillableAmount: 18384 },
}));
const analyticsMock = empty => {
  const totals = empty ? { finalizedLoads: 0, billed: 0, areaSqFt: 0, pieces: 0, averageBilled: 0 } : { finalizedLoads: 5, billed: 91920, areaSqFt: 1342.5, pieces: 215, averageBilled: 18384 };
  const daily = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10), billed: !empty && i % 6 === 2 ? 18384 : 0, loads: !empty && i % 6 === 2 ? 1 : 0 }));
  return { period: { from: '2026-09-10', to: '2026-10-09', days: 30, timezone: 'Asia/Kolkata', dateBasis: 'dispatchDate' }, comparison: { from: '2026-08-11', to: '2026-09-09' },
    statusCounts: { Draft: empty ? 0 : 2, Dispatched: empty ? 0 : 2, Delivered: empty ? 0 : 3 }, current: totals,
    previous: empty ? totals : { finalizedLoads: 4, billed: 73536, areaSqFt: 1074, pieces: 172, averageBilled: 18384 }, daily,
    topDestinations: empty ? [] : [{ name: 'Sample North Yard', billed: 55152, loads: 3 }, { name: 'Sample South Yard', billed: 36768, loads: 2 }], unreadable: 0 };
};
const navigation = [['home', 'Dashboard', 'డ్యాష్‌బోర్డ్'], ['entries', 'Loading entries', 'లోడ్ వివరాలు'], ['products', 'Products & places', 'రకాలు మరియు ప్రదేశాలు'], ['profile', 'Profile settings', 'ప్రొఫైల్ సెట్టింగ్స్'], ['settings', 'Settings', 'సెట్టింగ్స్']];
const results = { base, browser: executable, startedAt: new Date().toISOString(), cases: [], productionFilesUnchanged: null };
let browser;
let shotNumber = 0;
const clean = value => stripVTControlCharacters(String(value));
const slug = value => value.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 90);

async function makeCase(kind, language, width, options = {}) {
  const result = { id: `${kind}-${language}-${width}`, kind, language, width, checks: [], screenshots: [], downloads: [], geometry: [], actions: [], api: [], unexpectedRequests: [], mutations: [], runtimeErrors: [], consoleErrors: [], assetFailures: [] };
  results.cases.push(result);
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 800 : width === 390 ? 844 : width === 768 ? 1024 : width === 1024 ? 768 : 900 }, deviceScaleFactor: 1, isMobile: width <= 768, hasTouch: width <= 768, locale: language === 'te' ? 'te-IN' : 'en-IN', colorScheme: 'light', reducedMotion: options.motion ? 'no-preference' : 'reduce', acceptDownloads: true, serviceWorkers: 'block' });
  context.setDefaultTimeout(7000);
  context.setDefaultNavigationTimeout(25000);
  await context.addInitScript(({ language }) => {
    localStorage.setItem('stonedesk-language', language);
    window.__interfaceClipboard = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__interfaceClipboard.push(value); } } });
  }, { language });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const apiPath = url.pathname.replace(/^\/api(?=\/)/, '');
    const isApi = /^\/(auth|master-settings|dispatches|loading-lists|uploads)(\/|$)/.test(apiPath) || url.pathname.startsWith('/api/');
    const headers = { 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (isApi) {
      result.api.push({ method: request.method(), path: apiPath, stage: result.stage });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.method() !== 'GET') {
        result.mutations.push({ method: request.method(), path: apiPath, mocked: true });
        if (apiPath === '/auth/logout') return route.fulfill({ status: 200, headers, json: { ok: true } });
        result.unexpectedRequests.push({ method: request.method(), path: apiPath, reason: 'Mutation blocked' });
        return route.fulfill({ status: 403, headers, json: { error: 'Read-only interface validation blocks changes' } });
      }
      let body;
      if (apiPath === '/auth/me') body = { user: kind === 'landing' || kind === 'motion' ? null : user };
      else if (apiPath === `/master-settings/${settings.organizationId}`) body = settings;
      else if (apiPath === '/dispatches') body = options.empty ? { data: [], nextCursor: null } : url.searchParams.has('cursor') ? { data: records.slice(6), nextCursor: null } : { data: records.slice(0, 6), nextCursor: 'mock-next' };
      else if (apiPath === '/dispatches/analytics') body = analyticsMock(options.empty);
      else if (apiPath.startsWith('/dispatches/')) {
        body = records.find(record => record.id === apiPath.split('/')[2]);
        if (body && result.invoiceLogo) body = { ...body, businessSnapshot: { ...body.businessSnapshot, logoDataUrl: testLogo } };
        if (body && result.invoiceLarge) {
          const inventory = Array.from({ length: 20 }, (_, index) => ({ ...body.inventory[0], stoneType: `Sample stone row ${index + 1}`, measurementRows: body.inventory[0].measurementRows.map(row => ({ ...row, rowNo: index + 1 })) }));
          body = { ...body, inventory, summary: { totalPieces: 860, totalDispatchVolumeSqFt: 5370, baseMaterialTotal: 343680, loadingAndRoyaltyFees: 1200, netBillableAmount: 344880 } };
        }
      }
      else if (apiPath === '/auth/users') body = members;
      else if (apiPath === '/loading-lists') body = [];
      if (body !== undefined) return route.fulfill({ status: 200, headers, json: body });
      result.unexpectedRequests.push({ method: request.method(), path: apiPath, reason: 'Unknown API blocked' });
      return route.fulfill({ status: 501, headers, json: { error: 'No interface fixture for this endpoint' } });
    }
    const fontHost = ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
    const staticVite = url.origin === new URL(base).origin && !['fetch', 'xhr'].includes(request.resourceType());
    if (request.method() === 'GET' && (staticVite || fontHost)) return route.continue();
    result.unexpectedRequests.push({ method: request.method(), path: url.pathname, reason: 'Non-static network access blocked' });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', error => result.runtimeErrors.push({ stage: result.stage, message: error.message }));
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push({ stage: result.stage, message: message.text() }); });
  page.on('requestfailed', request => result.assetFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on('dialog', dialog => dialog.type() === 'confirm' && result.acceptConfirm ? dialog.accept() : dialog.dismiss());
  const t = (en, te) => language === 'te' ? te : en;
  async function capture(name, locator) {
    const filename = `${result.id}-${slug(name)}-${++shotNumber}.png`;
    await (locator || page).screenshot({ path: path.join(out, filename), ...(locator ? {} : { fullPage: true }), animations: 'disabled' });
    result.screenshots.push({ name, filename, path: path.join(out, filename) });
  }
  async function check(name, fn) {
    result.stage = name;
    try { await fn(); result.checks.push({ name, passed: true }); return true; }
    catch (error) {
      result.checks.push({ name, passed: false, error: clean(error.message) });
      console.log(`FAIL ${result.id}: ${name}: ${clean(error.message).split('\n').find(Boolean)}`);
      try { await capture(`failure-${name}`); } catch { /* Preserve the original failure. */ }
      await page.locator('dialog[open]').evaluateAll(elements => elements.forEach(element => element.close())).catch(() => {});
      return false;
    }
  }
  async function fonts() {
    await page.evaluate(async () => { await document.fonts.load('16px "Noto Telugu"', 'తెలుగు'); await document.fonts.ready; });
  }
  async function overflow(name, screenshot = false) {
    await check(`${name}: document overflow and named controls`, async () => {
      await fonts();
      const geometry = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const offenders = [...document.body.querySelectorAll('*')].filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.right > width + 1 || rect.left < -1) && element.checkVisibility() && !element.closest('dialog:not([open])');
        }).slice(0, 20).map(element => ({ tag: element.tagName, class: typeof element.className === 'string' ? element.className : '', right: Math.round(element.getBoundingClientRect().right), text: element.textContent.trim().slice(0, 70) }));
        return { width, htmlScroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, offenders };
      });
      result.geometry.push({ name, ...geometry });
      assert.ok(geometry.htmlScroll <= geometry.width + 1 && geometry.bodyScroll <= geometry.width + 1, JSON.stringify(geometry));
      const controls = await page.locator('button:visible, a[href]:visible, input:visible, select:visible, summary:visible').evaluateAll(elements => elements.map(element => ({ tag: element.tagName, name: (element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join(' ') || [...(element.labels || [])].map(label => label.textContent).join(' ') || element.textContent || '').trim().replace(/\s+/g, ' '), disabled: !!element.disabled })));
      result.actions.push({ name, controls });
      assert.deepEqual(controls.filter(control => !control.name), [], 'Visible controls must have accessible names');
      if (screenshot) { await page.evaluate(() => window.scrollTo(0, 0)); await capture(name); }
    });
  }
  async function view(name) { await expect(page.locator('#workspace-main')).toHaveAttribute('data-view', name); }
  async function nav(name) {
    const item = navigation.find(([key]) => key === name);
    if (width >= 1024) await page.locator('.workspace-sidebar nav').getByRole('link', { name: t(item[1], item[2]), exact: true }).click();
    else {
      await page.locator('.mobile-menu').click();
      await expect(page.locator('#workspace-navigation-dialog')).toBeVisible();
      await page.locator('#workspace-navigation-dialog nav').getByRole('link', { name: t(item[1], item[2]), exact: true }).click();
      await expect(page.locator('#workspace-navigation-dialog')).not.toBeVisible();
      await expect(page.locator('.mobile-menu')).toHaveAttribute('aria-expanded', 'false');
    }
    await view(name);
  }
  const main = () => page.locator('#workspace-main');
  const visibleRecords = () => width >= 1024 ? page.locator('.desktop-load-table tbody tr') : page.locator('.load-record:visible');
  async function oneCreate() { await expect(page.getByRole('button', { name: t('Create a new load', 'కొత్త లోడ్ సృష్టించండి'), exact: true })).toHaveCount(1); }
  async function finish() {
    await check('No runtime errors or unmocked API traffic', async () => {
      assert.deepEqual(result.runtimeErrors, []);
      assert.deepEqual(result.consoleErrors, []);
      assert.deepEqual(result.unexpectedRequests, []);
    });
    console.log(`CASE ${result.id}: ${result.checks.filter(item => item.passed).length}/${result.checks.length} checks; ${result.screenshots.length} screenshots; ${result.downloads.length} PDFs`);
    await context.close();
  }
  return { page, result, t, check, capture, overflow, view, nav, main, visibleRecords, oneCreate, finish, fonts };
}

async function landing(language, width) {
  const c = await makeCase('landing', language, width);
  const { page, result, t, check, capture, overflow } = c;
  await check('Guest landing opens', async () => { await page.goto(`${base}/#welcome`, { waitUntil: 'domcontentloaded' }); await expect(page.locator('.marketing')).toBeVisible(); await expect(page.locator('html')).toHaveAttribute('lang', language); });
  await overflow('landing-full', true);
  await check('CSS imports exist in correct integration order', async () => {
    const styles = await page.locator('style[data-vite-dev-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-vite-dev-id').replace(/\\/g, '/')));
    result.styles = styles;
    const order = ['/src/index.css', '/src/styles/workspace.css', '/src/styles/landing.css', '/src/styles/invoice.css', '/src/styles/a4Invoice.css'].map(suffix => styles.findIndex(name => name.endsWith(suffix)));
    assert.ok(order[0] >= 0 && order.every((value, index) => index === 0 || value > order[index - 1]), JSON.stringify(styles));
    await expect(page.locator('.mk-showcase-panel').first()).toHaveCSS('min-height', width < 640 ? '420px' : '384px');
  });
  await check('Public header has no language control', async () => {
    await expect(page.locator('.mk-public-header .mk-language')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
  });
  await check('Public anchors preserve the app hash and move focus', async () => {
    for (const [name, id] of [[t('Product', 'ఉత్పత్తి'), 'product'], [t('How it works', 'ఎలా పనిచేస్తుంది'), 'how-it-works'], [t('StoneDesk home', 'StoneDesk హోమ్'), 'marketing-main']]) {
      await page.locator('.mk-public-header').getByRole('link', { name, exact: true }).click();
      await expect(page.locator(`#${id}`)).toBeFocused();
      assert.equal(new URL(page.url()).hash, '#welcome');
    }
    await page.locator('.mk-skip-link').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#marketing-main')).toBeFocused(); assert.equal(new URL(page.url()).hash, '#welcome');
  });
  for (let index = 0; index < 1; index++) {
    await check(`Sample ${index + 1}: every tab, keyboard and row action`, async () => {
      const sample = page.locator('.mk-product-window').nth(index);
      const tabNames = [['Overview', 'సారాంశం'], ['Measure', 'కొలతలు'], ['Dispatch', 'డిస్పాచ్'], ['Bill', 'బిల్లు']];
      for (const [en, te] of tabNames) {
        const tab = sample.getByRole('tab', { name: t(en, te), exact: true }); await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(sample.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'));
        await expect(sample.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
        const widthCheck = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1); assert.ok(widthCheck);
      }
      const tabs = sample.getByRole('tab');
      await tabs.last().press('Home'); await expect(tabs.first()).toBeFocused();
      await tabs.first().press('End'); await expect(tabs.last()).toBeFocused();
      await tabs.last().press('ArrowRight'); await expect(tabs.first()).toBeFocused();
      await tabs.first().press('ArrowLeft'); await expect(tabs.last()).toBeFocused();
      await tabs.first().click(); await sample.locator('.mk-preview-row').first().click(); await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
      await tabs.first().click(); await sample.locator('.mk-preview-row').last().click(); await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await tabs.nth(index === 0 ? 0 : 1).click();
    });
  }
  await check('Every create-workspace CTA opens and closes auth without submitting', async () => {
    const buttons = page.locator('.mk-primary'); assert.equal(await buttons.count(), 3);
    for (let i = 0; i < 3; i++) {
      await buttons.nth(i).click(); const dialog = page.locator('.auth-screen'); await expect(dialog).toBeVisible();
      assert.equal(await dialog.evaluate(element => element.matches(':modal')), true);
      await expect(dialog.locator('input[name="email"]')).toHaveValue('');
      await dialog.getByRole('button', { name: t('Close', 'మూసివేయండి'), exact: true }).click(); await expect(dialog).not.toBeVisible();
    }
  });
  await check('Login, auth mode switch and Escape are local only', async () => {
    await page.locator('.mk-login').click(); const dialog = page.locator('.auth-screen'); await expect(dialog).toBeVisible();
    await dialog.locator('input[type="checkbox"]').check(); await expect(dialog.locator('input[name="password"]')).toHaveAttribute('type', 'text');
    await dialog.locator('input[type="checkbox"]').uncheck(); await expect(dialog.locator('input[name="password"]')).toHaveValue('');
    await dialog.getByRole('button', { name: t('New here? Create an account', 'కొత్తవారా? ఖాతా సృష్టించండి'), exact: true }).click();
    await expect(dialog.locator('input[name="name"]')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    assert.equal(result.mutations.length, 0);
  });
  await check('Privacy, Terms and Support native dialogs close and escape', async () => {
    const dialog = page.locator('.mk-dialog:not(.mk-bill-dialog)');
    for (const [en, te] of [['Privacy', 'గోప్యత'], ['Terms', 'నిబంధనలు'], ['Support', 'సహాయం']]) {
      const trigger = page.locator('footer').getByRole('button', { name: t(en, te), exact: true });
      await trigger.click(); await expect(dialog).toBeVisible(); assert.ok(await dialog.evaluate(element => element.matches(':modal')));
      await dialog.getByRole('button', { name: t('Close', 'మూసివేయండి'), exact: true }).click(); await expect(dialog).not.toBeVisible();
      await trigger.click(); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
    }
  });
  await check('Sample PDF download is not offered publicly', async () => {
    await expect(page.getByRole('button', { name: t('Download sample PDF', 'నమూనా PDF డౌన్‌లోడ్'), exact: true })).toHaveCount(0);
  });
  await check('Sample bill native dialog fits, closes and escapes', async () => {
    const trigger = page.getByRole('button', { name: t('Open sample bill', 'నమూనా బిల్లు తెరవండి'), exact: true }); const dialog = page.locator('.mk-bill-dialog');
    await trigger.click(); await expect(dialog).toBeVisible();
    assert.ok(await dialog.evaluate(element => element.matches(':modal') && element.getBoundingClientRect().width <= innerWidth));
    await expect(dialog.getByRole('img', { name: t('Business logo placeholder', 'వ్యాపార లోగో కోసం స్థలం'), exact: true })).toBeVisible();
    await expect(dialog.locator('.invoice-net-payable dd')).toHaveText('₹18,384.00');
    await capture('sample-bill-dialog');
    await dialog.getByRole('button', { name: t('Close sample preview', 'నమూనా ప్రివ్యూ మూసివేయండి'), exact: true }).click(); await expect(dialog).not.toBeVisible();
    await trigger.click(); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  });
  await check('No motion toggle is shown', async () => { await expect(page.locator('.mk-motion-toggle')).toHaveCount(0); });
  await c.finish();
}

async function workspace(language, width) {
  const c = await makeCase('workspace', language, width);
  const { page, result, t, check, capture, overflow, nav, view, main, visibleRecords, oneCreate } = c;
  await check('Mocked workspace opens with one global New load', async () => { await page.goto(`${base}/#home`, { waitUntil: 'domcontentloaded' }); await expect(page.locator('.dashboard-priority')).toBeVisible(); await oneCreate(); await expect(visibleRecords()).toHaveCount(5); });
  await overflow('dashboard', true);
  await check('Workspace stylesheet overrides are really applied', async () => {
    await expect(page.locator('.dashboard-priority')).toHaveCSS('border-radius', '16px');
    await expect(main()).toHaveCSS('padding-top', width < 768 ? '32px' : '40px');
    await expect(page.locator('.workspace-create-load')).toHaveCSS('border-radius', '999px');
    await expect(page.locator('.desktop-load-table')).toHaveCSS('display', width >= 1024 ? 'block' : 'none');
    await expect(page.locator('.mobile-load-record:visible')).toHaveCount(width >= 1024 ? 0 : 5);
  });
  await check('Header actions are visible, do not overlap and remain in viewport', async () => {
    const boxes = await page.locator('.mobile-menu:visible, .workspace-organization, .workspace-search, .workspace-create-load, .workspace-notifications').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { name: element.className, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    result.header = boxes; assert.ok(boxes.every(box => box.left >= -1 && box.right <= width + 1), JSON.stringify(boxes));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!(Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left) > 1 && Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top) > 1), `${boxes[i].name} overlaps ${boxes[j].name}`);
  });
  await check('Dashboard priority toggle filters drafts and restores recent loads', async () => {
    const trigger = page.locator('.dashboard-priority-action'); await expect(trigger).toHaveAttribute('aria-pressed', 'false'); await trigger.click();
    await expect(trigger).toHaveAttribute('aria-pressed', 'true'); await expect(visibleRecords()).toHaveCount(2);
    await expect(main().locator('.status-tag:visible:not(.status-draft)')).toHaveCount(0);
    await capture('dashboard-priority'); await trigger.click(); await expect(trigger).toHaveAttribute('aria-pressed', 'false'); await expect(visibleRecords()).toHaveCount(5);
  });
  await check('Refresh and both supporting metric navigation actions', async () => {
    await Promise.all([page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/dispatches')), main().getByRole('button', { name: t('Refresh', 'రిఫ్రెష్'), exact: true }).click()]);
    await expect(visibleRecords()).toHaveCount(5);
    await page.locator('.dashboard-metric-link').first().click(); await view('entries'); await expect(main().locator('.load-filter').nth(2)).toHaveAttribute('aria-pressed', 'true'); await expect(main().locator('.load-record')).toHaveCount(2); assert.equal(new URL(page.url()).hash, '#entries?status=Dispatched'); await oneCreate(); await nav('home');
    await page.locator('.dashboard-metric-link').last().click(); await view('entries'); await nav('home');
  });
  if (width < 1024) {
    await check('Mobile native navigation dialog: close, Escape, focus and aria-expanded', async () => {
      const trigger = page.locator('.mobile-menu'), drawer = page.locator('#workspace-navigation-dialog');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await trigger.click(); await expect(drawer).toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      assert.ok(await drawer.evaluate(element => element.matches(':modal') && element.contains(document.activeElement)));
      await expect(drawer.locator('nav button')).toHaveCount(5); await expect(drawer.getByRole('button', { name: t('Log out', 'లాగ్ అవుట్'), exact: true })).toBeVisible(); await capture('mobile-navigation');
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        // Chrome may focus its own browser UI at the end of a native dialog's
        // cycle (document.activeElement === body). Underlying app controls must
        // remain inert, but browser chrome is not an application focus leak.
        assert.ok(await drawer.evaluate(element => element.contains(document.activeElement) || document.activeElement === document.body));
      }
      await drawer.getByRole('button', { name: t('Close navigation', 'మెనూ మూసివేయండి'), exact: true }).focus();
      await drawer.getByRole('button', { name: t('Close navigation', 'మెనూ మూసివేయండి'), exact: true }).click(); await expect(drawer).not.toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(trigger).toBeFocused();
      await trigger.click(); await page.keyboard.press('Escape'); await expect(drawer).not.toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(trigger).toBeFocused();
      await trigger.click(); await drawer.evaluate(element => element.close()); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click(); const box = await drawer.boundingBox(); const viewport = page.viewportSize();
      assert.ok(box.width <= viewport.width * 0.85, `drawer ${box.width}px of ${viewport.width}px`);
      await page.mouse.click(viewport.width - 12, viewport.height / 2); await expect(drawer).not.toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    await check('Mobile navigation links retain full-width flex styling', async () => {
      await page.locator('.mobile-menu').click(); const drawer = page.locator('#workspace-navigation-dialog');
      const links = await drawer.locator('nav button').evaluateAll(elements => elements.map(element => ({ display: getComputedStyle(element).display, width: element.getBoundingClientRect().width, available: element.parentElement.clientWidth, minHeight: getComputedStyle(element).minHeight })));
      result.drawerLinks = links;
      assert.ok(links.every(link => link.display === 'flex' && link.width >= link.available - 2 && parseFloat(link.minHeight) >= 44), JSON.stringify(links));
    });
    if (await page.locator('#workspace-navigation-dialog').isVisible()) await page.keyboard.press('Escape');
  } else await check('Desktop has only the five sidebar navigation actions', async () => { await expect(page.locator('.workspace-sidebar nav button:visible')).toHaveCount(5); await expect(page.locator('.mobile-menu')).not.toBeVisible(); await expect(page.locator('.bottom-nav')).toHaveCount(0); });
  await check('Notifications native dialog close, Escape and task navigation', async () => {
    const trigger = page.locator('.workspace-notifications'), dialog = page.locator('dialog[aria-labelledby="attention-title"]');
    await trigger.click(); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: t('Close', 'మూసివేయండి'), exact: true }).click(); await expect(dialog).not.toBeVisible();
    await trigger.click(); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await trigger.click(); await dialog.getByRole('button', { name: t('View loading entries', 'లోడ్ వివరాలు చూడండి'), exact: true }).click(); await view('entries'); await expect(dialog).not.toBeVisible(); await nav('home');
  });
  await check('View all loads, all status filters and pagination', async () => {
    await main().getByRole('button', { name: t('View all loads', 'అన్ని లోడ్లు చూడండి'), exact: true }).click(); await view('entries'); await expect(main().locator('.load-record')).toHaveCount(6);
    const filters = main().locator('.load-filters button');
    for (let index = 1; index < 4; index++) { await filters.nth(index).click(); await expect(filters.nth(index)).toHaveAttribute('aria-pressed', 'true'); await expect(main().locator('.load-record')).toHaveCount(2); }
    await filters.first().click(); await expect(main().locator('.load-record')).toHaveCount(6);
    await main().getByRole('button', { name: t('Load more', 'మరిన్ని చూడండి'), exact: true }).click(); await expect(main().locator('.load-record')).toHaveCount(8);
    await expect(main().getByRole('button', { name: t('Load more', 'మరిన్ని చూడండి'), exact: true })).toHaveCount(0);
    await main().getByRole('button', { name: t('Refresh', 'రిఫ్రెష్'), exact: true }).click(); await expect(main().locator('.load-record')).toHaveCount(6);
  });
  await overflow('loading-entries', true);
  await check('Global search icon can be clicked without input interception', async () => {
    await nav('home');
    if (width < 768) await page.locator('.workspace-search-toggle').click();
    result.searchHitTarget = await page.locator('.workspace-search-submit').evaluate(element => {
      const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { hit: hit?.tagName, hitId: hit?.id, buttonZIndex: getComputedStyle(element).zIndex, inputPosition: getComputedStyle(document.getElementById('global-search')).position, inputZIndex: getComputedStyle(document.getElementById('global-search')).zIndex };
    });
    await page.locator('.workspace-search-submit').click(); await view('entries');
  });
  await check('Global search submit, no-results state and clearing', async () => {
    const input = page.locator('#global-search'); if (width < 768 && !(await input.isVisible())) await page.locator('.workspace-search-toggle').click();
    await input.fill('MOCK-LORRY-02'); await input.press('Enter'); await view('entries'); await expect(main().locator('.load-record')).toHaveCount(1);
    await input.fill('no-such-sample'); await expect(main().locator('.load-record')).toHaveCount(0); await expect(main().getByRole('heading', { name: t('No matching loads', 'లోడ్లు కనబడలేదు'), exact: true })).toBeVisible();
    await input.fill(''); await expect(main().locator('.load-record')).toHaveCount(6);
  });
  if (await page.locator('#global-search').isVisible()) await page.locator('#global-search').fill('');
  if (width < 768 && await page.locator('.workspace-search-close').isVisible()) await page.locator('.workspace-search-close').click();
  for (const name of ['entries', 'settings', 'home']) await check(`Visible ${name} navigation action and active state`, async () => {
    await nav(name); await oneCreate();
    if (width >= 1024) await expect(page.locator('.workspace-sidebar nav button[aria-current="page"]')).toHaveText(t(...navigation.find(([key]) => key === name).slice(1)));
    if (name !== 'home') await overflow(`nav-${name}`);
  });
  await check('Old monitor and invoices links open the combined page', async () => {
    await page.goto(`${base}/#monitor`, { waitUntil: 'domcontentloaded' }); await view('entries');
    await expect(main().locator('.load-filter').nth(2)).toHaveAttribute('aria-pressed', 'true'); await expect(main().locator('.load-record')).toHaveCount(2);
    await page.goto(`${base}/#invoices`, { waitUntil: 'domcontentloaded' }); await view('entries');
    await expect(main().locator('.load-filter').first()).toHaveAttribute('aria-pressed', 'true');
  });
  await check('Workspace skip link preserves the active route', async () => {
    await nav('entries'); const hash = new URL(page.url()).hash; await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(main()).toBeFocused(); assert.equal(new URL(page.url()).hash, hash);
  });
  await nav('home');
  await check('Saved draft never fabricates a final A4 invoice; continuation remains local', async () => {
    await (width >= 1024 ? page.locator('.table-open-button').first() : page.locator('.mobile-load-record').first().getByRole('button')).click(); await view('bill');
    await expect(main().getByRole('heading', { name: t('Saved draft', 'సేవ్ చేసిన డ్రాఫ్ట్'), exact: true })).toBeVisible();
    await expect(main().locator('.a4-preview-feedback')).toContainText(t('Complete this draft to see the final A4 invoice.', 'చివరి A4 బిల్లు చూడటానికి డ్రాఫ్ట్‌ను పూర్తి చేయండి.'));
    await expect(main().locator('.a4-invoice, .invoice-export-panel')).toHaveCount(0);
    await main().getByRole('button', { name: t('Continue this draft', 'డ్రాఫ్ట్ కొనసాగించండి'), exact: true }).click(); await view('load'); await expect(page.locator('.workspace-create-load')).toHaveCount(0);
    await main().getByRole('button', { name: t('Back to dashboard', 'డ్యాష్‌బోర్డ్‌కు వెళ్ళండి'), exact: true }).click(); await view('home');
  });
  await nav('settings');
  await overflow('settings', true);
  await check('Language switch lives in the menu; organization-copy action is mocked locally', async () => {
    await expect(main().locator('.language-switch, .settings-language-options')).toHaveCount(0);
    if (width < 1024) await page.locator('.mobile-menu').click();
    const languageSwitch = page.locator(width >= 1024 ? '.workspace-sidebar .language-switch' : '#workspace-navigation-dialog .language-switch');
    await languageSwitch.getByRole('button', { name: language === 'en' ? 'తెలుగు' : 'English', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('lang', language === 'en' ? 'te' : 'en');
    await languageSwitch.getByRole('button', { name: language === 'en' ? 'English' : 'తెలుగు', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(languageSwitch.locator('button[aria-pressed="true"]')).toHaveAttribute('lang', language);
    if (width < 1024) { await page.keyboard.press('Escape'); await expect(page.locator('#workspace-navigation-dialog')).not.toBeVisible(); }
    await main().getByRole('button', { name: t('Copy organization ID', 'సంస్థ ఐడీ కాపీ చేయండి'), exact: true }).click(); assert.deepEqual(await page.evaluate(() => window.__interfaceClipboard), [settings.organizationId]);
    await expect(main().locator('.settings-copy-button')).toHaveText(t('Copied', 'కాపీ అయింది'));
    await expect(main().locator('.settings-copy-button')).toHaveText(t('Copy organization ID', 'సంస్థ ఐడీ కాపీ చేయండి'), { timeout: 4000 });
  });
  await check('Settings is one simple page without section navigation', async () => {
    await expect(main().getByRole('tab')).toHaveCount(0);
    await expect(page.locator('.settings-jump, .sidebar-subnav')).toHaveCount(0);
    await expect(main().locator('.st-section')).toHaveCount(4);
    assert.equal(new URL(page.url()).hash, '#settings');
    await main().getByRole('button', { name: t('Delete…', 'తొలగించు…'), exact: true }).click();
    const deleteNow = main().getByRole('button', { name: t('Delete permanently', 'శాశ్వతంగా తొలగించు'), exact: true });
    await expect(deleteNow).toBeDisabled(); await main().locator('.st-danger-confirm input').fill('wrong@example.com'); await expect(deleteNow).toBeDisabled();
    await main().locator('.st-danger-confirm').getByRole('button', { name: t('Cancel', 'రద్దు'), exact: true }).click(); await expect(deleteNow).toHaveCount(0);
  });
  await check('Settings team and account sections show read-only actions', async () => {
    await expect(main().getByText('Sample Team Member', { exact: true })).toBeVisible();
    await main().getByRole('button', { name: t('Refresh', 'రిఫ్రెష్'), exact: true }).click();
    await expect(main().getByRole('status').filter({ hasText: t('Team list updated', 'బృందం జాబితా నవీకరించబడింది') })).toBeVisible();
    await expect(main().locator('select[name="role"] option')).toHaveCount(2);
    const saveAccess = main().getByRole('button', { name: t('Save access', 'యాక్సెస్ సేవ్ చేయండి'), exact: true }), accessBox = main().getByRole('switch', { name: t('Access', 'యాక్సెస్'), exact: true });
    await expect(saveAccess).toHaveCount(0); await accessBox.uncheck(); await expect(saveAccess).toBeEnabled();
    const dialogs = []; const onDialog = dialog => dialogs.push(dialog.type()); page.on('dialog', onDialog);
    await saveAccess.click(); await expect.poll(() => dialogs.length).toBe(1); page.off('dialog', onDialog);
    assert.deepEqual(dialogs, ['confirm']); await accessBox.check(); await expect(saveAccess).toHaveCount(0);
    const passwordToggle = main().locator('.password-toggle').first(), currentPassword = main().locator('input[name="currentPassword"]');
    await expect(currentPassword).toHaveAttribute('type', 'password'); await passwordToggle.click(); await expect(currentPassword).toHaveAttribute('type', 'text'); await expect(passwordToggle).toHaveAttribute('aria-pressed', 'true');
    await passwordToggle.click(); await expect(currentPassword).toHaveAttribute('type', 'password');
    await expect(main().locator('input[name="currentPassword"]')).toHaveValue(''); await expect(main().locator('input[name="password"]')).toHaveAttribute('minlength', '12'); await expect(main().getByRole('button', { name: t('Log out', 'లాగ్ అవుట్'), exact: true })).toHaveCount(0);
  });
  await check('Business profile opens; wizard navigation never submits to the API', async () => {
    await expect(main().getByRole('link', { name: t('Business profile & default charges', 'వ్యాపార వివరాలు మరియు డిఫాల్ట్ ఛార్జీలు') })).toHaveCount(0);
    await nav('profile');
    const navLinks = page.locator(width >= 1024 ? '.workspace-sidebar nav' : '#workspace-navigation-dialog nav');
    await expect(navLinks.getByRole('link', { name: t('Profile settings', 'ప్రొఫైల్ సెట్టింగ్స్'), exact: true, includeHidden: true })).toHaveAttribute('aria-current', 'page');
    await expect(navLinks.getByRole('link', { name: t('Settings', 'సెట్టింగ్స్'), exact: true, includeHidden: true })).not.toHaveAttribute('aria-current', 'page');
    await expect(main().getByRole('button', { name: t('Back', 'వెనక్కి'), exact: true })).toHaveCount(0);
    await expect(page.locator('.sidebar-subnav')).toHaveCount(0);
    await expect(main().locator('.setup-progress [aria-current="step"]')).toHaveCount(1);
    const continueBox = await main().locator('.setup-continue').boundingBox(); assert.ok(continueBox.height <= 56, `Setup Continue button is ${continueBox.height}px tall`);
    await main().getByRole('button', { name: t('Continue', 'కొనసాగించండి'), exact: true }).click(); await expect(main().locator('input[type="tel"]')).toBeVisible();
    await main().getByRole('button', { name: t('Continue', 'కొనసాగించండి'), exact: true }).click(); await expect(main().getByRole('button', { name: t('Save and continue', 'సేవ్ చేసి కొనసాగించండి'), exact: true })).toHaveCount(0);
    await expect(main().getByRole('button', { name: t('Save profile', 'ప్రొఫైల్ సేవ్ చేయండి'), exact: true })).toBeEnabled();
    await overflow('business-profile-defaults'); await main().getByRole('button', { name: t('Previous step', 'మునుపటి దశ'), exact: true }).click();
    await nav('settings');
  });
  const productsTab = (en, te) => main().getByRole('group', { name: t('Products & places sections', 'రకాలు మరియు ప్రదేశాల విభాగాలు'), exact: true }).getByRole('button', { name: t(en, te), exact: true });
  await check('Products edit/cancel and saved-reference tabs are local; remove is canceled', async () => {
    await nav('products');
    assert.equal(new URL(page.url()).hash, '#products');
    await expect(productsTab('Products', 'రకాలు')).toHaveAttribute('aria-pressed', 'true');
    await expect(main().getByLabel(t('Default loading / royalty charges (₹)', 'లోడింగ్ / రాయల్టీ ఛార్జీలు'))).toHaveCount(0);
    await main().getByRole('button', { name: t('Edit', 'మార్చండి'), exact: true }).first().click(); await expect(main().getByRole('button', { name: t('Update product', 'రకాన్ని మార్చండి'), exact: true })).toBeVisible();
    await main().getByRole('button', { name: t('Cancel edit', 'రద్దు చేయండి'), exact: true }).click();
    await main().getByRole('button', { name: t('Remove', 'తొలగించండి'), exact: true }).first().click(); await expect(main().locator('.product-record')).toHaveCount(2);
    await overflow('products'); await expect(main().getByRole('button', { name: t('Back', 'వెనక్కి'), exact: true })).toHaveCount(0);
    await productsTab('Trucks', 'లారీలు').click(); await view('products');
    await expect.poll(() => new URL(page.url()).hash).toBe('#products/trucks');
    await expect(productsTab('Trucks', 'లారీలు')).toHaveAttribute('aria-pressed', 'true');
    await expect(main().getByText('MOCK-LORRY-01', { exact: true })).toBeVisible();
    const plate = main().locator('.references-add input');
    await plate.fill('abc'); await plate.blur(); await expect(plate).toHaveValue('ABC'); await expect(plate).toHaveAttribute('aria-invalid', 'true');
    await expect(main().locator('.references-error')).toBeVisible(); await capture('saved-references-invalid');
    await plate.fill('tn01ab1234'); await expect(plate).not.toHaveAttribute('aria-invalid', 'true'); await expect(main().locator('.references-error')).toHaveCount(0);
    await plate.fill('');
    await productsTab('Destinations', 'గమ్యస్థానాలు').click(); await expect(main().getByText('Sample North Yard', { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe('#products/destinations');
    await expect(productsTab('Destinations', 'గమ్యస్థానాలు')).toHaveAttribute('aria-pressed', 'true');
    await overflow('saved-references');
    await page.goBack();
    await expect.poll(() => new URL(page.url()).hash).toBe('#products/trucks');
    await expect(productsTab('Trucks', 'లారీలు')).toHaveAttribute('aria-pressed', 'true');
    await nav('settings');
  });
  await check('Legacy #references route is replaced by the Trucks tab', async () => {
    await page.goto(`${base}/#references`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).hash).toBe('#products/trucks');
    await view('products');
    await expect(productsTab('Trucks', 'లారీలు')).toHaveAttribute('aria-pressed', 'true');
    await nav('settings');
  });
  await check('New load route hides global creation; local review/back actions are usable', async () => {
    result.acceptConfirm = true; await page.locator('.workspace-create-load').click();
    await view('load'); result.acceptConfirm = false;
    await expect(page.locator('.workspace-create-load')).toHaveCount(0); await expect(main().getByRole('heading', { name: t('New load', 'కొత్త లోడ్'), exact: true })).toBeVisible();
    await main().getByLabel(t('Party name', 'పార్టీ పేరు'), { exact: true }).fill('Sample Preview Buyer');
    await main().getByLabel(t('Truck number', 'లారీ నంబర్'), { exact: true }).fill('MOCK-PREVIEW-LORRY');
    await main().getByLabel(t('Destination', 'గమ్యస్థానం'), { exact: true }).fill('Sample North Yard');
    await main().getByLabel(t('Length (ft)', 'పొడవు'), { exact: true }).fill('3');
    const fractions = main().locator('.measurement-fractions').first(); await fractions.locator('summary').click();
    await fractions.getByRole('button', { name: t('Add ½ foot to length', 'పొడవుకు ½ అడుగు జోడించండి'), exact: true }).click();
    await main().getByLabel(t('Width (ft)', 'వెడల్పు'), { exact: true }).fill('2');
    await main().getByLabel(t('Quantity', 'ముక్కల సంఖ్య'), { exact: true }).fill('30');
    await main().getByRole('button', { name: t('Add entry', 'కొలత జోడించండి'), exact: true }).click(); await expect(main().locator('.measurement-record')).toHaveCount(1);
    await main().getByRole('button', { name: t('Edit entry', 'కొలత మార్చండి'), exact: true }).click(); await expect(main().locator('.measurement-record')).toHaveCount(0);
    await main().getByRole('button', { name: t('Add entry', 'కొలత జోడించండి'), exact: true }).click();
    await main().getByRole('button', { name: t('Review load', 'లోడ్ తనిఖీ చేయండి'), exact: true }).click(); await expect(main().getByRole('heading', { name: t('Review load', 'లోడ్ వివరాలు తనిఖీ చేయండి'), exact: true })).toBeVisible();
    await expect(main().getByRole('button', { name: t('Create invoice', 'ఖరారు చేసి పంపండి'), exact: true })).toBeEnabled(); await capture('new-load-review');
    await main().getByRole('button', { name: t('Back to edit', 'వివరాలు మార్చండి'), exact: true }).click();
    await main().getByRole('button', { name: t('Remove entry', 'కొలత తొలగించండి'), exact: true }).click(); await expect(main().locator('.measurement-record')).toHaveCount(0);
    await overflow('new-load', true); await expect(main().getByRole('button', { name: t('Save draft', 'డ్రాఫ్ట్ సేవ్ చేయండి'), exact: true })).toBeEnabled();
    await main().getByRole('button', { name: t('Back to dashboard', 'డ్యాష్‌బోర్డ్‌కు వెళ్ళండి'), exact: true }).click(); await view('home'); await oneCreate();
  });
  await check('Saved A4 bill, portable HTML, print and legacy exports use only mocked reads', async () => {
    await nav('entries'); await main().locator('.load-filter').nth(2).click(); await (width >= 1024 ? main().locator('.table-open-button').first() : main().locator('.load-record').first().getByRole('button')).click(); await view('bill');
    await expect(main().getByRole('heading', { name: t('Load bill', 'లోడ్ బిల్లు'), exact: true })).toBeVisible();
    await expect(main().locator('.a4-invoice .sample-sheet')).toHaveCount(1);
    if (width <= 390) {
      const { sheetWidth, tableWidth } = await main().locator('.a4-invoice .sample-sheet').evaluate(sheet => ({
        sheetWidth: sheet.getBoundingClientRect().width, tableWidth: sheet.querySelector('.row-table').getBoundingClientRect().width,
      }));
      assert.ok(tableWidth >= sheetWidth - 30, 'Mobile A4 preview must use the available width rather than print gutters');
    }
    await expect(main().locator('.a4-invoice [role="img"][aria-label="Business logo placeholder"]')).toBeVisible();
    await expect(main().locator('.a4-invoice .row-table tr[data-entry-id]')).toHaveCount(2);
    await expect(main().locator('.a4-invoice .invoice-summary')).toHaveCount(1);
    await expect(main().locator('.a4-invoice .settlement-net dd')).toHaveText('₹18,384.00');
    await expect(main().locator('.a4-invoice .settlement-rate dt')).toHaveText(t('Rate / sq ft', 'చ.అ. ధర'));
    await expect(main().locator('.a4-invoice [data-rate="sq-ft"]')).toHaveText('₹64.00');
    await expect(main().locator('input[name="invoice-export-document"][value="html"]')).toBeChecked();
    await expect(main().getByRole('button', { name: t('Print / PDF', 'ప్రింట్ / PDF'), exact: true })).toBeEnabled();
    await expect(main().getByRole('button', { name: t('Share document', 'పత్రం షేర్ చేయండి'), exact: true })).toBeEnabled();
    await main().getByRole('button', { name: t('Mark delivered', 'డెలివరీ పూర్తయింది'), exact: true }).click();
    await expect(main().getByRole('button', { name: t('Yes, delivered', 'అవును, చేరింది'), exact: true })).toBeVisible();
    await main().getByRole('button', { name: t('Not yet', 'ఇంకా లేదు'), exact: true }).click();
    await expect(main().getByRole('button', { name: t('Mark delivered', 'డెలివరీ పూర్తయింది'), exact: true })).toBeVisible();
    assert.equal(result.mutations.length, 0, 'Canceled delivery confirmation must not make a request');
    if (width === 390 || width === 1440) {
      const [htmlDownload] = await Promise.all([page.waitForEvent('download'), main().getByRole('button', { name: t('Download', 'డౌన్‌లోడ్'), exact: true }).click()]);
      const htmlFile = `${result.id}-${path.basename(htmlDownload.suggestedFilename())}`;
      const htmlPath = path.join(out, htmlFile);
      await htmlDownload.saveAs(htmlPath);
      const html = await fs.readFile(htmlPath, 'utf8');
      assert.ok(htmlFile.endsWith('.html') && html.startsWith('<!doctype html>') && html.includes('<style>') && html.includes('@page') && html.includes('₹18,384.00') && html.includes('data-rate="sq-ft">₹64.00'));
      assert.equal(await htmlDownload.failure(), null);
      result.downloads.push({ filename: htmlFile, path: htmlPath, bytes: Buffer.byteLength(html), kind: 'approved-html', pages: 1 });
      const [printPage] = await Promise.all([page.waitForEvent('popup'), main().getByRole('button', { name: t('Print / PDF', 'ప్రింట్ / PDF'), exact: true }).click()]);
      try {
        await expect(printPage.locator('.a4-invoice .sample-sheet')).toHaveCount(1);
        await expect(printPage.locator('.settlement-net dd')).toHaveText('₹18,384.00');
        await expect(printPage.locator('.settlement-rate dd')).toHaveText('₹64.00');
        await expect(printPage.locator('.invoice-export-panel')).toHaveCount(0);
        const bytes = await printPage.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
        const printFile = `${result.id}-approved-a4-print.pdf`;
        await fs.writeFile(path.join(out, printFile), bytes);
        const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
        try {
          const pdf = await task.promise;
          assert.equal(pdf.numPages, 1, 'The saved A4 print window must yield one physical page');
          assert.ok((await (await pdf.getPage(1)).getTextContent()).items.some(item => item.str.includes('₹18,384.00')));
        } finally { await task.destroy(); }
        result.downloads.push({ filename: printFile, path: path.join(out, printFile), bytes: bytes.length, kind: 'approved-a4-print', pages: 1 });
      } finally { await printPage.close(); }
      for (const kind of ['pdf', 'excel', 'driver']) {
        await main().locator(`input[name="invoice-export-document"][value="${kind}"]`).check();
        const [download] = await Promise.all([page.waitForEvent('download'), main().getByRole('button', { name: t('Download', 'డౌన్‌లోడ్'), exact: true }).click()]);
        const filename = `${result.id}-${kind}-${path.basename(download.suggestedFilename())}`, destination = path.join(out, filename);
        await download.saveAs(destination); const bytes = await fs.readFile(destination); assert.ok(bytes.length > 1000); assert.equal(await download.failure(), null);
        assert.equal(bytes.subarray(0, kind === 'excel' ? 2 : 5).toString('ascii'), kind === 'excel' ? 'PK' : '%PDF-');
        result.downloads.push({ filename, path: destination, bytes: bytes.length, kind, pages: kind === 'excel' ? undefined : (bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length });
      }
    }
    await overflow('final-bill', true); await main().getByRole('button', { name: t('Back to dashboard', 'డ్యాష్‌బోర్డ్‌కు వెళ్ళండి'), exact: true }).click(); await view('home');
  });
  await check('Saved business logo is embedded and historical identity remains stable', async () => {
    result.invoiceLogo = true;
    try {
      await page.goto(`${base}/#bill/mock-load-2`, { waitUntil: 'domcontentloaded' });
      // A hash change keeps the previously opened record in memory; reload to
      // request this independent saved-branding fixture, not live settings.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const image = main().locator('.a4-invoice .logo-placeholder img').first();
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('src', testLogo);
      await expect(image).toHaveCSS('object-fit', 'contain');
      await expect(main().locator('.a4-invoice .logo-placeholder[aria-label="Business logo placeholder"]')).toHaveCount(0);
      await expect(main().locator('.a4-invoice .business-name').first()).toHaveText(settings.businessName);
      assert.ok(await image.evaluate(element => element.complete && element.naturalWidth === 120 && element.naturalHeight === 48));
      await overflow('branded-invoice', true);
      await expect(main().locator('.a4-invoice .settlement-net dd')).toHaveText('₹18,384.00');
      if (width === 390 || width === 1440) {
        const [download] = await Promise.all([page.waitForEvent('download'), main().getByRole('button', { name: t('Download', 'డౌన్‌లోడ్'), exact: true }).click()]);
        const html = await fs.readFile(await download.path(), 'utf8');
        assert.ok(html.includes(testLogo), 'Portable HTML must embed the historical business logo');
        assert.ok(html.includes(settings.businessName.replace('&', '&amp;')), 'Portable HTML must safely encode the historical business name');
      }
    } finally { result.invoiceLogo = false; }
    await nav('home');
  });
  await check('Large saved invoice packs all twenty groups and keeps a single final summary', async () => {
    result.invoiceLarge = true;
    try {
      await page.goto(`${base}/#bill/mock-load-3`, { waitUntil: 'domcontentloaded' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(main().locator('.a4-invoice .business-name').first()).toBeVisible();
      const rows = main().locator('.a4-invoice .row-block');
      await expect(rows).toHaveCount(20);
      assert.deepEqual(await rows.evaluateAll(elements => elements.map(element => Number(element.querySelector('h3').firstChild.textContent.trim()))),
        Array.from({ length: 20 }, (_, index) => index + 1));
      await expect(main().locator('.a4-invoice .row-table tr[data-entry-id]')).toHaveCount(40);
      await expect(main().locator('.a4-invoice .invoice-summary')).toHaveCount(1);
      await expect(main().locator('.a4-invoice .sample-sheet:last-child .invoice-summary')).toHaveCount(1);
      await expect(main().locator('.a4-invoice .settlement-net dd')).toHaveText('₹344,880.00');
      await overflow('large-invoice');
      await page.emulateMedia({ media: 'print' });
      await expect(main().locator('.a4-invoice .row-block:visible')).toHaveCount(20);
      await expect(main().locator('.a4-invoice .detail-columns').first()).toHaveCSS('grid-template-columns', /px.*px.*px/);
      await expect(main().locator('.invoice-export-panel')).not.toBeVisible();
      await expect(main().locator('.invoice-view-switch')).toHaveCount(0);
    } finally { await page.emulateMedia({ media: 'screen' }); result.invoiceLarge = false; }
    await nav('home');
  });
  await check('Welcome/workspace switch retains integrated styles; logout is mocked only', async () => {
    await nav('settings'); await expect(main().getByRole('tab')).toHaveCount(0); await page.evaluate(() => { window.location.hash = 'welcome'; }); await expect(page.locator('.marketing')).toBeVisible(); await expect(page.locator('.mk-login')).toHaveCount(0);
    await page.locator('.mk-primary').first().click(); await view('home'); await expect(page.locator('.dashboard-priority')).toBeVisible(); await expect(page.locator('.dashboard-priority')).toHaveCSS('border-radius', '16px');
    const logoutName = { name: t('Log out', 'లాగ్ అవుట్'), exact: true };
    if (width >= 1024) await page.locator('.workspace-sidebar').getByRole('button', logoutName).click();
    else { await page.locator('.mobile-menu').click(); await page.locator('#workspace-navigation-dialog').getByRole('button', logoutName).click(); }
    await expect(page.locator('.marketing')).toBeVisible(); await expect(page.locator('.mk-login')).toBeVisible();
    assert.ok(result.mutations.every(mutation => mutation.path === '/auth/logout' && mutation.mocked));
  });
  await c.finish();
}

async function motion() {
  const c = await makeCase('motion', 'en', 1440, { motion: true });
  await c.check('Live motion renders without a toggle', async () => {
    await c.page.goto(`${base}/#welcome`, { waitUntil: 'domcontentloaded' }); await expect(c.page.locator('.mk-motion-toggle')).toHaveCount(0);
    await c.page.locator('.mk-hero').scrollIntoViewIfNeeded(); await expect(c.page.locator('.mk-hero-product')).toHaveCSS('opacity', '1'); await c.capture('landing-live-motion', c.page.locator('.mk-hero'));
  });
  await c.finish();
}
async function empty(language, width) {
  const c = await makeCase('empty', language, width, { empty: true });
  await c.check('Empty dashboard has one New load and a disabled priority action', async () => {
    await c.page.goto(`${base}/#home`, { waitUntil: 'domcontentloaded' }); await expect(c.page.locator('.dashboard-priority')).toBeVisible(); await c.oneCreate(); await expect(c.page.locator('.dashboard-priority-action')).toHaveCount(0); await expect(c.page.locator('.dashboard-empty')).toBeVisible();
  });
  await c.overflow('empty-dashboard', true); await c.finish();
}

try {
  browser = await chromium.launch({ executablePath: executable, headless: true });
  for (const language of languages) for (const width of widths) {
    if (phases.includes('landing')) await landing(language, width);
    if (phases.includes('workspace')) await workspace(language, width);
  }
  if (phases.includes('motion')) await motion();
  if (phases.includes('empty')) for (const language of languages) for (const width of [320, 1440]) await empty(language, width);
} catch (error) { results.fatal = clean(error.stack || error.message); console.error(`FATAL: ${clean(error.message)}`); }
finally {
  await browser?.close();
  const after = await productionSnapshot();
  results.changedProductionFiles = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name]);
  results.productionFilesUnchanged = results.changedProductionFiles.length === 0;
  results.finishedAt = new Date().toISOString();
  results.summary = { cases: results.cases.length, passed: results.cases.flatMap(item => item.checks).filter(item => item.passed).length, failed: results.cases.flatMap(item => item.checks).filter(item => !item.passed).length, screenshots: results.cases.reduce((sum, item) => sum + item.screenshots.length, 0), pdfs: results.cases.flatMap(item => item.downloads).filter(download => download.filename.endsWith('.pdf')).length, spreadsheets: results.cases.flatMap(item => item.downloads).filter(download => download.filename.endsWith('.xlsx')).length, runtimeErrors: results.cases.reduce((sum, item) => sum + item.runtimeErrors.length, 0), consoleErrors: results.cases.reduce((sum, item) => sum + item.consoleErrors.length, 0), blockedUnexpectedRequests: results.cases.reduce((sum, item) => sum + item.unexpectedRequests.length, 0) };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(results, null, 2));
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const rows = results.cases.map(item => `<tr><td>${escape(item.id)}</td><td>${item.checks.filter(check => check.passed).length}/${item.checks.length}</td><td>${item.checks.filter(check => !check.passed).map(check => `<details open><summary>${escape(check.name)}</summary><pre>${escape(check.error)}</pre></details>`).join('') || 'Pass'}</td></tr>`).join('');
  const shots = results.cases.flatMap(item => item.screenshots.map(shot => `<a href="${encodeURIComponent(shot.filename)}"><img loading="lazy" src="${encodeURIComponent(shot.filename)}" alt="${escape(`${item.id}: ${shot.name}`)}"><span>${escape(`${item.id}: ${shot.name}`)}</span></a>`)).join('');
  const pdfs = results.cases.flatMap(item => item.downloads.map(download => `<li><a href="${encodeURIComponent(download.filename)}">${escape(download.filename)}</a> · ${download.bytes} bytes · ${download.pages} page(s)</li>`)).join('');
  await fs.writeFile(path.join(out, 'report.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>StoneDesk interface validation</title><style>body{margin:32px;font:14px/1.6 system-ui;color:#203d36;background:#f7f9f8}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #d5e2db;text-align:left;vertical-align:top}pre{white-space:pre-wrap;max-width:80ch}.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}.shots a{padding:12px;background:white;color:inherit;text-decoration:none}.shots img{width:100%;height:280px;object-fit:contain;object-position:top}.shots span{display:block}summary{font-weight:600}</style><h1>StoneDesk interface validation</h1><p>All API/auth data synthetic. All output in TEMP. Production unchanged: ${results.productionFilesUnchanged}.</p><pre>${escape(JSON.stringify(results.summary, null, 2))}</pre><p><a href="report.json">Detailed JSON</a></p><table><tr><th>Case</th><th>Passes</th><th>Findings</th></tr>${rows}</table><h2>Downloaded sample PDFs</h2><ul>${pdfs}</ul><h2>Screenshots</h2><div class="shots">${shots}</div></html>`);
  console.log(`SUMMARY ${JSON.stringify(results.summary)}`);
  console.log(`PRODUCTION_FILES_UNCHANGED=${results.productionFilesUnchanged}`);
  console.log(`REPORT_HTML=${path.join(out, 'report.html')}`);
  console.log(`REPORT_JSON=${path.join(out, 'report.json')}`);
  for (const item of results.cases) for (const shot of item.screenshots.filter(shot => /failure|dashboard$|landing-full|settings-general|mobile-navigation/.test(shot.name))) console.log(`SCREENSHOT=${shot.path}`);
  if (results.fatal || results.summary.failed || !results.productionFilesUnchanged) process.exitCode = 1;
}