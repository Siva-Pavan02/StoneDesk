const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Vercel's Express runtime resolves the first match of app/index/server (optionally
// under src/) and requires a default export or a port listener. app.js must therefore
// stay at the Backend root and keep exporting the application.
// https://vercel.com/docs/frameworks/backend/express
test('the Vercel entrypoint sits at a supported location and exports the Express app', () => {
  const entry = require('../app');
  assert.equal(typeof entry, 'function');
  assert.equal(typeof entry.listen, 'function');
  assert.equal(path.basename(require.resolve('../app')), 'app.js');
  assert.equal(path.dirname(require.resolve('../app')), path.join(__dirname, '..'));
});

test('Vercel imports Express without opening a listener or connecting to the database', () => {
  const result = spawnSync(process.execPath, ['-e', `
    require.cache[require.resolve('./utils/prisma')] = { exports: { $connect() { throw Error('Unexpected eager connection'); } } };
    const app = require('./app');
    const server=app.listen(0,'127.0.0.1',async()=>{
      const base='http://127.0.0.1:'+server.address().port;
      for(const path of ['/healthz','/api/healthz','/api/auth/session']) {
        const response=await fetch(base+path);if(response.status!==200)process.exitCode=1;
      }
      // Mounted but protected: a 404 here would mean the route never reached the entrypoint.
      for(const path of ['/api/dispatches','/api/loading-lists','/api/master-settings/x','/uploads/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png','/uploads/logos/'+'a'.repeat(64)+'.png']) {
        const response=await fetch(base+path);if(response.status!==401)process.exitCode=1;
      }
      server.close();
    });
  `], { cwd: require('node:path').join(__dirname,'..'), env: { ...process.env, VERCEL:'1', NODE_ENV:'production', LOGO_STORAGE:'supabase', SERVE_FRONTEND:'false', APP_ORIGIN:'https://yard.example' }, encoding:'utf8', timeout:15000 });
  assert.equal(result.status,0,result.stderr);
});
