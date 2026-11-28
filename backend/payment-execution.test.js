'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createPaymentExecution}=require('./platform/payment-execution');
const {createProviderRegistry}=require('./platform/payment-provider');
function fixture(fail=false){
 let row={id:'tx',service:'wallet',status:'authorized',recipient:'merchant',amount:5000,currency:'XAF'}, calls=0, reconcile=0;
 const store={
  async getOwned(user,id){return user==='owner'&&id==='tx'?{...row}:null;},
  async claim(user,id){if(user!=='owner'||id!=='tx'||row.status!=='authorized')return null;row.status='pending';return {...row};},
  async markForReconciliation(){reconcile++;},
  async recordOutcome(id,outcome){row.status=outcome.status;}
 };
 const providers=createProviderRegistry({wallet:{async execute(input){calls++;assert.equal(input.idempotencyKey,'tx');if(fail)throw Error('timeout');return {transactionId:'tx',amount:5000,currency:'XAF',status:'successful',reference:'test'};},async status(){}}});
 return {execute:createPaymentExecution({store,providers}),counts:()=>({calls,reconcile})};
}
const request={userId:'owner',transactionId:'tx'};
test('concurrent requests dispatch once',async()=>{const f=fixture();await Promise.all([f.execute(request),f.execute(request)]);assert.equal(f.counts().calls,1);assert.equal((await f.execute(request)).status,'successful');});
test('uncertain outcome remains pending',async()=>{const f=fixture(true);assert.equal((await f.execute(request)).status,'pending');assert.deepEqual(f.counts(),{calls:1,reconcile:1});await f.execute(request);assert.equal(f.counts().calls,1);});
test('other users cannot execute',async()=>{const f=fixture();assert.equal(await f.execute({...request,userId:'other'}),null);assert.equal(f.counts().calls,0);});
