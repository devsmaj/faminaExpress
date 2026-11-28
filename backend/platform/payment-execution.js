'use strict';
const { validateProviderOutcome } = require('./payment-provider');
// Store contract: claim atomically verifies owner, authorization, limits and
// balance, reserves funds, and returns a single execution claim. Duplicate
// requests must return null. Settlement must be atomic and idempotent.
function createPaymentExecution({ store, providers }) {
  return async function execute({ userId, transactionId }) {
    const intent = await store.getOwned(userId, transactionId);
    if (!intent) return null;
    if (intent.status !== 'authorized') return intent;
    const adapter = providers.get(intent.service);
    const claim = await store.claim(userId, transactionId);
    if (!claim) return store.getOwned(userId, transactionId);
    let outcome;
    try {
      const response = await adapter.execute({
        transactionId: claim.id, idempotencyKey: claim.id,
        recipient: claim.recipient, amount: claim.amount, currency: claim.currency
      });
      outcome = validateProviderOutcome(response, {
        transactionId: claim.id, amount: claim.amount, currency: claim.currency
      });
    } catch {
      // A timeout is not evidence of failure. Keep reservation intact.
      await store.markForReconciliation(claim.id);
      return store.getOwned(userId, transactionId);
    }
    await store.recordOutcome(claim.id, outcome);
    return store.getOwned(userId, transactionId);
  };
}
module.exports = { createPaymentExecution };
