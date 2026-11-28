'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRecoveryIdentity}=require('./platform/recovery-identity');
const now=1795900000000;
const claims={sub:'user',session_id:'session',aal:'aal2',exp:now/1000+600,amr:[{method:'totp',timestamp:now/1000-10}]};
const args={userId:'user',sessionId:'session',proof:'token'};
function provider(c){return createRecoveryIdentity({verifyClaims:async()=>c,issueOnce:async x=>x,clock:()=>now});}
test('fresh MFA reaches atomic issuer',async()=>assert.equal((await provider(claims).verify(args)).method,'totp'));
test('wrong session rejected',async()=>assert.rejects(provider(claims).verify({...args,sessionId:'other'})));
test('aal1 rejected',async()=>assert.rejects(provider({...claims,aal:'aal1'}).verify(args)));
test('stale MFA rejected',async()=>assert.rejects(provider({...claims,amr:[{method:'totp',timestamp:now/1000-121}]}).verify(args)));
