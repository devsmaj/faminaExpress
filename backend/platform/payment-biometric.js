'use strict';
const {ApiError}=require('./supabase');
const {intentDigest}=require('./payment-intent');
// verifier must be a vetted WebAuthn implementation validating signature,
// RP ID, origin, challenge, credential ownership and user verification.
// Store must atomically consume challenge and update credential counter.
function createBiometricAuthorization({store,verifier}){
 return async function authorize({userId,sessionId,transactionId,assertion}){
  const payment=await store.getAuthorizationContext({userId,sessionId,transactionId});
  if(!payment||payment.status!=='initiated'||payment.expiresAt<=Date.now())throw new ApiError(409,'Payment authorization unavailable.');
  const digest=intentDigest(userId,payment.quoteId,payment.intent);
  const challenge=await store.getChallenge({userId,sessionId,transactionId});
  if(!challenge||challenge.digest!==digest||challenge.expiresAt<=Date.now())throw new ApiError(403,'Invalid authorization challenge.');
  const result=await verifier.verify({assertion,challenge:challenge.value,userId,requireUserVerification:true});
  if(result?.verified!==true||result.userVerified!==true||typeof result.credentialId!=='string'||!Number.isSafeInteger(result.counter)||result.counter<0)throw new ApiError(403,'Device verification failed.');
  const authorized=await store.consumeAndAuthorize({userId,sessionId,transactionId,digest,challengeId:challenge.id,credentialId:result.credentialId,counter:result.counter});
  if(authorized!==true)throw new ApiError(409,'Authorization expired or already used.');
  return {ok:true};
 };
}
module.exports={createBiometricAuthorization};
