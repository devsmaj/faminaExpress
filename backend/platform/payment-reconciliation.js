'use strict';
const { validateProviderOutcome } = require('./payment-provider');
// Worker-only entry point. Store must enforce monotonic, atomic settlement
// and persist pending transactions across process crashes.
function createPaymentReconciliation({store, providers}) {
  return async function reconcile(transactionId) {
    const row = await store.getPending(transactionId);
    if (!row || row.status !== 'pending') return false;
    let outcome;
    try {
      const adapter = providers.get(row.service);
      const response = await adapter.status({transactionId:row.id, idempotencyKey:row.id});
      outcome = validateProviderOutcome(response,{transactionId:row.id,amount:row.amount,currency:row.currency});
    } catch {
      await store.markForReconciliation(row.id);
      return false;
    }
    await store.recordOutcome(row.id,outcome);
    return outcome.status !== 'pending';
  };
}
module.exports = {createPaymentReconciliation};
