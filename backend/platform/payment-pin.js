'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError } = require('./supabase');
const scrypt = promisify(crypto.scrypt);
async function verifyPaymentPin({ db, env, userId, pin }) {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) throw new ApiError(400, 'PIN must contain six digits.');
  if (typeof env.FAMINA_PIN_PEPPER !== 'string' || Buffer.byteLength(env.FAMINA_PIN_PEPPER) < 32) throw new ApiError(503, 'Payment security is not configured.');
  const record = await db.rpc('famipay_pin_attempt', { p_user: userId }, null, true);
  if (record?.allowed !== true) throw new ApiError(429, 'PIN verification unavailable. Try again later.');
  if (!/^[a-f0-9]{128}$/.test(record.pin_hash || '') || !/^[a-f0-9]{32}$/.test(record.pin_salt || '')) throw new ApiError(409, 'Payment PIN is unavailable.');
  const hash = await scrypt(crypto.createHmac('sha256', env.FAMINA_PIN_PEPPER).update(pin).digest(), Buffer.from(record.pin_salt, 'hex'), 64, { N:32768, r:8, p:1, maxmem:64*1024*1024 });
  if (!crypto.timingSafeEqual(hash, Buffer.from(record.pin_hash, 'hex'))) throw new ApiError(403, 'Incorrect payment PIN.');
  // Caller must atomically check this version before granting authorization.
  return record.pin_hash;
}
module.exports = { verifyPaymentPin };
