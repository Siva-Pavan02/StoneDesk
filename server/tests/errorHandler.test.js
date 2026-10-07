const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../utils/errorHandler');
test('Prisma and malformed-body errors become safe HTTP responses', () => {
  for (const [error, expected] of [[{code:'P2002'},409],[{code:'P2025'},404],[{code:'P2034'},409],[{code:'P2024'},503],[{code:'P1001'},503],[{name:'PrismaClientValidationError'},400],[{code:'P2003'},400],[{type:'entity.parse.failed',message:'secret input'},400],[{status:413},413]]) {
    let status, body;
    handler(error, {path:'/api/dispatches'}, {status(value){status=value;return this},json(value){body=value}}, () => {});
    assert.equal(status, expected); assert.equal(typeof body.error, 'string'); assert.ok(!body.error.includes('secret'));
  }
});
