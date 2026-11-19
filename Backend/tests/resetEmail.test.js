const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { sendPasswordResetEmail, isEmailConfigured } = require('../utils/email');
const { buildResetUrl } = require('../utils/authFlags');

test('reset email requires configuration and supplies a real sender and usable link', async t => {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true });
  let message;
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(isEmailConfigured(), false);
    await assert.rejects(sendPasswordResetEmail('recipient@example.test', 'https://app.test'), /not configured/);
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'user', SMTP_PASS: 'test-only', SMTP_FROM: 'StoneDesk <sender@example.test>' });
    assert.equal(isEmailConfigured(), true);
    t.mock.method(nodemailer, 'createTransport', options => {
      assert.equal(options.secure, false);
      assert.ok(options.connectionTimeout > 0);
      return { sendMail: async mail => { message = mail; return stream.sendMail(mail); } };
    });
    const link = buildResetUrl('https://stone-desk.vercel.app', 'ab'.repeat(32), 'recipient@example.test');
    await sendPasswordResetEmail('recipient@example.test', link, 'Test Yard');
    const result = await stream.sendMail(message);
    assert.equal(result.envelope.from, 'sender@example.test');
    assert.match(result.message.toString(), /^From: StoneDesk <sender@example.test>/m);
    assert.ok(message.text.includes(link));
    assert.ok(message.html.includes(`href="${link}"`));
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    stream.close();
  }
});
