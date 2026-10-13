import test from 'node:test';
import assert from 'node:assert/strict';
import { contentPolicy, securityHeaders } from '../securityPolicy.js';
import { readFileSync } from 'node:fs';

test('Vercel response headers match the shared policy and use Vercel backend rewrites', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.deepEqual(Object.fromEntries(config.headers[0].headers.map(h => [h.key,h.value])), securityHeaders('/api'));
  assert.equal(config.headers[0].source, '/(.*)');
  assert.deepEqual(config.rewrites, [
    { source: '/api/(.*)', destination: 'https://stonedesk-api.vercel.app/api/$1' },
    { source: '/uploads/(.*)', destination: 'https://stonedesk-api.vercel.app/uploads/$1' },
    { source: '/(.*)', destination: '/index.html' },
  ]);
  assert.ok(!JSON.stringify(config.rewrites).includes('onrender.com'));
});

test('production CSP constrains scripts while retaining fonts, logos and the configured API', () => {
  const local = contentPolicy('/api');
  assert.match(local, /script-src 'self';/);
  assert.ok(!local.includes('unsafe-eval'));
  assert.match(local, /img-src 'self' data: blob:/);
  assert.match(local, /font-src 'self' https:\/\/fonts.gstatic.com/);
  assert.match(local, /object-src 'none'/);
  assert.match(local, /base-uri 'none'/);
  const remote = contentPolicy('https://api.example.test/api');
  assert.ok(remote.includes("connect-src 'self' https://api.example.test"));
  assert.ok(remote.includes("img-src 'self' data: blob: https://api.example.test"));
  const headers = securityHeaders('/api');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(headers['X-Frame-Options'], 'DENY');
});

test('protocol-relative API bases retain the document scheme and explicit port', () => {
  for (const base of ['//api.example.test/api', '//api.example.test:8443/api']) {
    const host = new URL(base, 'https://yard.example').host;
    assert.ok(contentPolicy(base).includes(`connect-src 'self' ${host};`));
    assert.ok(contentPolicy(base).includes(`img-src 'self' data: blob: ${host};`));
  }
  assert.equal(contentPolicy(' https://api.example.test/api '), contentPolicy('https://api.example.test/api'));
});
