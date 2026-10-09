const { randomInt } = require('node:crypto');
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function organizationCode(name) {
  const prefix = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 22).replace(/-$/, '') || 'STONE-YARD';
  return `${prefix}-${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('')}`;
}
module.exports = { organizationCode };
