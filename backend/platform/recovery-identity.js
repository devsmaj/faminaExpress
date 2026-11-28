'use strict';
const {ApiError}=require('./supabase');
// verifyClaims must cryptographically validate JWT signature, issuer,
// audience and expiry against the configured Supabase project.
// issueOnce must atomically verify active session and pre-enrolled factor,
// enforce enrollment cooldown and reject reuse of the MFA event.
function createRecoveryIdentity({verifyClaims,issueOnce,clock=Date.now}){
 return {async verify({userId,sessionId,proof}){
  if(typeof proof!=='string'||proof.length>16384)throw new ApiError(403,'Recovery proof rejected.');
  const claims=await verifyClaims(proof);
  const now=Math.floor(clock()/1000);
  if(!claims||claims.sub!==userId||claims.session_id!==sessionId||claims.aal!=='aal2'||!Number.isFinite(claims.exp)||claims.exp<=now||!Array.isArray(claims.amr))throw new ApiError(403,'Recovery proof rejected.');
  const events=claims.amr.filter(e=>e&&e.method==='totp'&&Number.isSafeInteger(e.timestamp)&&e.timestamp<=now&&e.timestamp>=now-120);
  if(!events.length)throw new ApiError(403,'Fresh authenticator verification required.');
  const timestamp=Math.max(...events.map(e=>e.timestamp));
  return issueOnce({userId,sessionId,method:'totp',timestamp,expiresAt:(timestamp+120)*1000});
 }};
}
module.exports={createRecoveryIdentity};
