'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIntent, intentDigest, SERVICES } = require('./platform/payment-intent');
const quote = { service: 'wallet', recipient: 'merchant', amount: 5000, fee: 100, currency: 'XAF' };
test('all payment services calculate integer totals', () => {
  for (const service of SERVICES) assert.equal(normalizeIntent({...quote, service}).total, 5100);
});
test('reject invalid payment values', () => {
  for (const patch of [{amount:0},{amount:-1},{amount:1.5},{fee:-1},{amount:Number.MAX_SAFE_INTEGER},{currency:'USD'},{recipient:' '},{service:'unknown'}]) assert.throws(() => normalizeIntent({...quote,...patch}));
});
test('digest binds user, quote, recipient, amount and fee', () => {
  const digest = intentDigest('user','quote',quote);
  assert.equal(digest,intentDigest('user','quote',{...quote}));
  assert.notEqual(digest,intentDigest('other','quote',quote));
  assert.notEqual(digest,intentDigest('user','other',quote));
  for (const patch of [{recipient:'other'},{amount:5001},{fee:101},{service:'card'}]) assert.notEqual(digest,intentDigest('user','quote',{...quote,...patch}));
});
