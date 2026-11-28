'use strict';
const { SERVICES } = require('./payment-intent');
const { ApiError } = require('./supabase');
function createProviderRegistry(adapters = {}) {
  const registry = new Map();
  for (const [service, adapter] of Object.entries(adapters)) {
    if (!SERVICES.includes(service) || !adapter || typeof adapter.execute !== 'function' || typeof adapter.status !== 'function') throw new TypeError('Invalid payment adapter');
    registry.set(service, adapter);
  }
  return Object.freeze({
    get(service) {
      const adapter = registry.get(service);
      if (!adapter) throw new ApiError(503, 'Payment service is not activated.');
      return adapter;
    },
    enabled(service) { return registry.has(service); }
  });
}
function validateProviderOutcome(result, expected) {
  if (!result || !['successful','pending','failed'].includes(result.status) ||
      result.transactionId !== expected.transactionId || result.amount !== expected.amount ||
      result.currency !== expected.currency || typeof result.reference !== 'string' ||
      !result.reference.trim() || result.reference.length > 256) {
    throw new ApiError(502, 'Provider outcome requires reconciliation.');
  }
  return Object.freeze({status:result.status,reference:result.reference});
}
// Adapter must authenticate provider responses before calling this validator.
// Transport failures and ambiguous outcomes must remain pending, never release funds.
module.exports = { createProviderRegistry, validateProviderOutcome };
