const { randomBytes } = require('node:crypto');

async function adminCookie(base) {
  const password = randomBytes(18).toString('hex');
  const response = await fetch(`${base}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Owner', createOrganization: true, businessName: 'Test Yard', email: 'owner@example.test', password }) });
  if (response.status !== 201) throw new Error(`Test signup failed: ${response.status}`);
  return response.headers.getSetCookie().find(value => value.startsWith('stonedesk_session=') && !value.startsWith('stonedesk_session=;')).split(';')[0];
}
module.exports = { adminCookie };
