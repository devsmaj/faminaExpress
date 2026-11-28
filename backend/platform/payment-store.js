'use strict';
// Requires reviewed database RPCs; no direct balance mutation or client access.
function createPaymentStore(db) {
 const rpc=(name,args)=>db.rpc(name,args,null,true);
 return Object.freeze({
  getOwned:(userId,id)=>rpc('famipay_payment_owned',{p_user:userId,p_id:id}),
  claim:(userId,id)=>rpc('famipay_payment_claim',{p_user:userId,p_id:id}),
  getPending:id=>rpc('famipay_payment_pending',{p_id:id}),
  markForReconciliation:id=>rpc('famipay_payment_reconcile',{p_id:id}),
  recordOutcome:(id,outcome)=>rpc('famipay_payment_settle',{p_id:id,p_status:outcome.status,p_reference:outcome.reference})
 });
}
module.exports={createPaymentStore};
