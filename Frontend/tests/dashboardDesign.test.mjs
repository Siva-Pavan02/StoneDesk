// Run with Vite on port 5174. Reuses cached Playwright and installed Chrome.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const base = process.env.INTERFACE_BASE_URL || 'http://127.0.0.1:5174';
let chromium;
for (const dir of await fs.readdir(cache)) {
  try { ({ chromium } = await import(pathToFileURL(path.join(cache, dir, 'node_modules/playwright/index.mjs')))); break; } catch {}
}
assert.ok(chromium, 'Cached Playwright is required');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.route('**/dashboard-check', route => route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const [{default: Dashboard}, {default: Payments}] = await Promise.all([import('/src/components/pilot/DashboardAnalytics.jsx'), import('/src/components/pilot/PaymentsAnalytics.jsx')]);
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js'; const {createRoot} = ReactDOM;
    import '/src/index.css'; import '/src/styles/workspace.css';
    const data = {period:{from:'2026-10-07',to:'2026-10-09',granularity:'day'}, current:{billed:90000}, statusCounts:{Draft:2,Dispatched:3,Delivered:4}, trend:[{date:'2026-10-07',loads:2},{date:'2026-10-08',loads:0},{date:'2026-10-09',loads:5}], paymentAnalytics:{current:{received:45000,completedInvoiceTotal:30000,completedInvoices:2,outstanding:15000}, trend:[{date:'2026-10-07',received:15000,completedInvoiceTotal:15000,completedInvoices:1},{date:'2026-10-08',received:0,completedInvoiceTotal:0,completedInvoices:0},{date:'2026-10-09',received:30000,completedInvoiceTotal:15000,completedInvoices:1}], parties:Array.from({length:6},(_,i)=>({party:'Stone yard '+i,outstanding:1000*(i+1),unpaidInvoices:i%2===0?2:0,partialInvoices:i%2===1||i===2?1:0}))}};
    function App(){const [period,setPeriod]=React.useState('3');const [payments,setPayments]=React.useState(false);window.setPayments=setPayments;const analytics=window.mode==='loading'?{loading:true}:window.mode==='error'?{error:true}:{data:window.empty?{...data,trend:[],statusCounts:{},paymentAnalytics:{current:{received:0,completedInvoiceTotal:0,completedInvoices:0,outstanding:0},trend:[],parties:[]}}:data};return React.createElement('main',{className:'dashboard-home',style:{maxWidth:1100,margin:'auto',padding:24}},payments?React.createElement(Payments,{analytics,selectedPeriod:period,onPeriodChange:setPeriod,onViewParty:p=>window.party=p}):React.createElement(Dashboard,{analytics,selectedPeriod:period,onPeriodChange:setPeriod}));}
    createRoot(document.getElementById('root')).render(React.createElement(App));
  </script>` }));
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/dashboard-check`);
    await page.locator('.analytics-columns').waitFor();
    assert.equal(await page.locator('.analytics-volume-bar').count(), 3);
    const heights = await page.locator('.analytics-volume-bar').evaluateAll(elements => elements.map(element => Number(element.getAttribute('height'))));
    assert.ok(Math.abs(heights[0] - 57.6) < 0.001); assert.equal(heights[1], 0); assert.equal(heights[2], 144);
    assert.equal(await page.locator('.analytics-domain h3').textContent(), 'Logistics');
    assert.equal(await page.locator('.analytics-donut, .analytics-party-list, .analytics-money-bars').count(), 0);
    await page.locator('.analytics-columns g[tabindex]').first().focus();
    assert.match(await page.locator('.analytics-readout').textContent(), /2 loads/);
    await page.evaluate(() => window.setPayments(true));
    await page.locator('.payments-trend-chart').waitFor();
    assert.equal(await page.locator('.payments-summary > div').count(), 4);
    assert.equal(await page.locator('.payments-trend-bar').count(), 6);
    assert.equal(await page.locator('.payments-party-bars > li').count(), 6);
    assert.match(await page.locator('.payments-summary > div').last().textContent(), /All time/);
    assert.equal(await page.locator('.payments-summary').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), width <= 380 ? 2 : 4);
    assert.equal(await page.locator('.payments-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), width <= 760 ? 1 : 2);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'View invoices', exact: true }).first().click();
    assert.equal(await page.evaluate(() => window.party), 'Stone yard 0');
    await page.getByRole('button', { name: 'All time', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'All time', exact: true }).getAttribute('aria-pressed'), 'true');
  }
  await page.evaluate(() => { window.empty = true; window.setPayments(false); });
  await page.getByText('No dispatch history yet.', { exact: true }).waitFor();
  await page.evaluate(() => window.setPayments(true));
  await page.getByText('No payment activity in this period.', { exact: true }).waitFor();
  await page.getByText('No outstanding balances.', { exact: true }).waitFor();
  await page.evaluate(() => { window.mode = 'loading'; window.setPayments(false); });
  await page.getByText('Loading overview…', { exact: true }).waitFor();
  await page.evaluate(() => { window.mode = 'error'; window.setPayments(true); });
  await page.getByRole('button', { name: 'Try again' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Dashboard and Payments charts passed at 320, 768 and 1440px with no duplicated finance views or horizontal overflow.');
} finally { await browser.close(); }
