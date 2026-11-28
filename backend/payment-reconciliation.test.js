'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createPaymentReconciliation}=require('./platform/payment-reconciliation');
function fixture(status, mismatch=false){
 const row={id:'tx',service:'wallet',status:'pending',amount:5000,currency:'XAF'};
 const outcomes=[];let retries=0;
 const store={getPending:async()=>row,recordOutcome:async(id,outcome)=>{outcomes.push(outcome);row.status=outcome.status;},markForReconciliation:async()=>{retries++;}};
 const providers={get:()=>({status:async()=>({transactionId:'tx',amount:mismatch?1:5000,currency:'XAF',status,reference:'test'})})};
 return {reconcile:createPaymentReconciliation({store,providers}),outcomes,retries:()=>retries};
}
test('confirmed settlement recorded once',async()=>{const f=fixture('successful');assert.equal(await f.reconcile('tx'),true);assert.equal(await f.reconcile('tx'),false);assert.equal(f.outcomes.length,1);});
test('pending remains unresolved',async()=>{const f=fixture('pending');assert.equal(await f.reconcile('tx'),false);assert.equal(f.outcomes[0].status,'pending');});
test('mismatch cannot settle',async()=>{const f=fixture('successful',true);assert.equal(await f.reconcile('tx'),false);assert.equal(f.outcomes.length,0);assert.equal(f.retries(),1);});
