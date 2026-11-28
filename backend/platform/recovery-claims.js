'use strict';
// Supabase Auth validates the token remotely before any claims are trusted.
function createRecoveryClaims({url,key,fetchImpl=fetch}){
 const base=new URL(url);
 if(base.protocol!=='https:'||!key)throw new Error('Invalid Auth configuration');
 return async token=>{
  if(typeof token!=='string'||token.length>16384||token.split('.').length!==3)return null;
  const response=await fetchImpl(new URL('/auth/v1/user',base),{headers:{apikey:key,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const user=await response.json();
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{return null;}
  if(!claims||claims.sub!==user.id||claims.iss!==new URL('/auth/v1',base).href||claims.aud!=='authenticated'||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000)return null;
  return claims;
 };
}
module.exports={createRecoveryClaims};
