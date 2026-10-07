const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('./database');
const app = require('../server');
test('loading lists retain IDs, validate JSON and persist updates', async t => {
  await database.setup(t);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const cookie = await require('./authHelper').adminCookie(base);
  async function call(method, route, body) {
    const r = await fetch(base + '/api/loading-lists' + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  }
  const body = { supervisor: 'Test', buyerDestination: 'Kadapa', stoneType: 'Stone', finish: 'Honed', requirements: [{ lengthFt: 3, widthFt: 2, requiredQuantity: 19 }] };
  const created = await call('POST', '', body);
  assert.equal(created.status, 201);
  const id = created.data._id;
  assert.ok(id);
  assert.equal(created.data.requirements[0].balance, 19);
  const changed = await call('PUT', '/' + id, { requirements: [{ ...created.data.requirements[0], loadedQuantity: 1, loadedPieces: [{ lengthFt: 3, widthFt: 2, sqFt: 100 }] }] });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.requirements[0].loadedPieces[0].sqFt, 6);
  assert.equal(changed.data.requirements[0].balance, 18);
  assert.equal((await call('PUT', '/' + id, { requirements: [{ lengthFt: -1, widthFt: 2, requiredQuantity: 1 }] })).status, 400);
  assert.equal((await call('GET', '/' + id)).data._id, id);
  assert.equal((await call('DELETE', '/' + id)).status, 200);
  assert.equal((await call('GET', '/' + id)).status, 404);
});
