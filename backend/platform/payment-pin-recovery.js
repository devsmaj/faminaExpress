'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {ApiError}=require('./supabase');
const scrypt=promisify(crypto.scrypt);
// proofVerifier must validate fresh independent identity proof and return a
// server-issued recovery grant bound to the authenticated user and session.
// store.consumeAndReplace must atomically consume the grant, replace the PIN,
// invalidate outstanding payment authorizations and record an audit event.
function createPinRecovery({env,proofVerifier,store}){
 return async function recover({userId,sessionId,proof,newPin}){
  if(typeof newPin!=='string'||!/^\d{6}$/.test(newPin))throw new ApiError(400,'PIN must contain six digits.');
  if(!userId||!sessionId||typeof env.FAMINA_PIN_PEPPER!=='string'||Buffer.byteLength(env.FAMINA_PIN_PEPPER)<32)throw new ApiError(503,'Recovery unavailable.');
  const grant=await proofVerifier.verify({userId,sessionId,proof});
  if(!grant||grant.userId!==userId||grant.sessionId!==sessionId||typeof grant.id!=='string'||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=Date.now())throw new ApiError(403,'Recovery proof rejected.');
  const salt=crypto.randomBytes(16);
  const hash=await scrypt(crypto.createHmac('sha256',env.FAMINA_PIN_PEPPER).update(newPin).digest(),salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  const changed=await store.consumeAndReplace({userId,sessionId,grantId:grant.id,hash:hash.toString('hex'),salt:salt.toString('hex')});
  if(changed!==true)throw new ApiError(409,'Recovery grant unavailable.');
  return {ok:true};
 };
}
module.exports={createPinRecovery};
