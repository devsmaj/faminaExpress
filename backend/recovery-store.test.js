'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRecoveryStore}=require('./platform/recovery-store');
test('consumption binds user session and grant',async()=>{
 const store=createRecoveryStore({rpc:async(name,args,token,privileged)=>{
 assert.equal(name,'famipay_recovery_consume');assert.deepEqual(args,{p_user:'u',p_session:'s',p_grant:'g',p_hash:'h',p_salt:'x'});assert.equal(privileged,true);return true;
 }});
 assert.equal(await store.consumeAndReplace({userId:'u',sessionId:'s',grantId:'g',hash:'h',salt:'x'}),true);
});
