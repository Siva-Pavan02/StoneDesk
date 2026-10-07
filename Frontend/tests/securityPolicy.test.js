import test from 'node:test';
import assert from 'node:assert/strict';
import { contentPolicy, securityHeaders } from '../securityPolicy.js';

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
