import test from 'node:test';
import assert from 'node:assert/strict';
import { removeTruck } from '../src/lib/api.js';
import { createLoadingList } from '../src/lib/loadingListApi.js';
test('legacy APIs share credentials, safe URL segments and server errors', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async (url,options) => { calls.push({url,options}); return {ok:true,json:async()=>({_id:'record'})}; });
  await removeTruck('unit_04','AP/01'); await createLoadingList({supervisor:'Test'});
  assert.equal(calls[0].url,'/api/master-settings/unit_04/trucks/AP%2F01');
  assert.equal(calls[1].url,'/api/loading-lists');
  assert.ok(calls.every(c=>c.options.credentials==='include'));
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({error:'Record changed'})});
  await assert.rejects(createLoadingList({}), {message:'Record changed',status:409});
});
