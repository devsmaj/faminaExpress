const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFirebaseHandler } = require('./firebase-session');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('rejects missing and forged tokens without issuing a session', async () => {
  let signed = false;
  const handler = createFirebaseHandler({ verifyIdToken: async () => { throw Error('invalid signature'); }, sign: () => { signed = true; } });
  const missing = response();
  await handler({ body: {} }, missing);
  assert.equal(missing.statusCode, 400);
  const forged = response();
  await handler({ body: { idToken: 'forged' } }, forged);
  assert.equal(forged.statusCode, 401);
  assert.equal(signed, false);
});
for (const provider of ['google.com', 'phone']) {
  test(`creates a customer session from verified ${provider} claims only`, async () => {
    let payload;
    const handler = createFirebaseHandler({
      verifyIdToken: async () => ({ uid: 'uid-123', name: 'Customer', email: provider === 'google.com' ? 'test@example.com' : undefined,
        email_verified: true, phone_number: provider === 'phone' ? '+971501234567' : undefined, firebase: { sign_in_provider: provider } }),
      sign: (claims, secret, options) => { payload = claims; assert.equal(secret, 'test-secret'); assert.equal(options.expiresIn, '7d'); return 'signed-session'; },
      secret: 'test-secret'
    });
    const res = response();
    await handler({ body: { idToken: 'verified', role: 'restaurant_owner', email: 'attacker@example.com' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.id, 'firebase:uid-123');
    assert.equal(payload.role, 'customer');
    assert.equal(res.body.token, 'signed-session');
    if (provider === 'phone') assert.equal(res.body.user.email, null);
  });
}
test('rejects unsupported providers and unverified identities', async () => {
  for (const identity of [
    { uid: 'x', firebase: { sign_in_provider: 'password' } },
    { uid: 'x', email: 'x@example.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } },
    { uid: 'x', firebase: { sign_in_provider: 'phone' } }
  ]) {
    const handler = createFirebaseHandler({ verifyIdToken: async () => identity, sign: () => assert.fail('must not sign') });
    const res = response();
    await handler({ body: { idToken: 'token' } }, res);
    assert.equal(res.statusCode, 401);
  }
});
