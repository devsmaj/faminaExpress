'use strict';
const { createHash } = require('node:crypto');
const SERVICES = Object.freeze(['wallet','mobile_money','bank_transfer','card','qr','bill','airtime_data','merchant']);
function normalizeIntent(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Invalid payment intent');
  const { service, recipient, amount, fee, currency } = input;
  if (!SERVICES.includes(service)) throw new TypeError('Unsupported payment service');
  if (typeof recipient !== 'string' || !recipient.trim() || recipient.length > 256) throw new TypeError('Invalid recipient');
  if (currency !== 'XAF') throw new TypeError('Unsupported currency');
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(fee) || fee < 0 || !Number.isSafeInteger(amount + fee)) throw new TypeError('Invalid amount or fee');
  return Object.freeze({ service, recipient: recipient.trim(), amount, fee, currency, total: amount + fee });
}
// Call only with a server-priced, server-owned quote and authenticated user ID.
function intentDigest(userId, quoteId, input) {
  if (typeof userId !== 'string' || !userId || typeof quoteId !== 'string' || !quoteId) throw new TypeError('Missing identity or quote');
  return createHash('sha256').update(JSON.stringify([userId, quoteId, normalizeIntent(input)])).digest('hex');
}
module.exports = { SERVICES, normalizeIntent, intentDigest };
