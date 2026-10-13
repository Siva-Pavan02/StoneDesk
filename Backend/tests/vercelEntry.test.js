const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
test('Vercel imports Express without opening a listener or connecting to the database', () => {
  const result = spawnSync(process.execPath, ['-e', `
    require.cache[require.resolve('./utils/prisma')] = { exports: { $connect() { throw Error('Unexpected eager connection'); } } };
    const app = require('./server');
    const server=app.listen(0,'127.0.0.1',async()=>{
      const base='http://127.0.0.1:'+server.address().port;
      for(const path of ['/healthz','/api/healthz','/api/auth/session']) {
        const response=await fetch(base+path);if(response.status!==200)process.exitCode=1;
      }
      server.close();
    });
  `], { cwd: require('node:path').join(__dirname,'..'), env: { ...process.env, VERCEL:'1', NODE_ENV:'production', LOGO_STORAGE:'supabase', SERVE_FRONTEND:'false', APP_ORIGIN:'https://yard.example' }, encoding:'utf8', timeout:15000 });
  assert.equal(result.status,0,result.stderr);
});
