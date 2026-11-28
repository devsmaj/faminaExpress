'use strict';
function createRecoveryStore(db){
 return {async consumeAndReplace({userId,sessionId,grantId,hash,salt}){
  return (await db.rpc('famipay_recovery_consume',{p_user:userId,p_session:sessionId,p_grant:grantId,p_hash:hash,p_salt:salt},null,true))===true;
 }};
}
module.exports={createRecoveryStore};
