const { randomBytes } = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');

async function adminCookie(base) {
  await User.deleteMany({}); await Session.deleteMany({});
  await User.init();
  const password = randomBytes(18).toString('hex');
  const response = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Owner', email: 'owner@example.test', password }) });
  if (response.status !== 201) throw new Error(`Test signup failed: ${response.status}`);
  return response.headers.getSetCookie().find(value => value.startsWith('granitesync_session=') && !value.startsWith('granitesync_session=;')).split(';')[0];
}
module.exports = { adminCookie };
