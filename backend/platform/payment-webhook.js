'use strict';
const crypto=require('node:crypto');
// Only for providers explicitly using this signature protocol.
// Provider-specific adapters must implement their documented protocol.
function verifyWebhook({rawBody,timestamp,signature,secret,now=Date.now()}){
 if(!Buffer.isBuffer(rawBody)||rawBody.length>65536||typeof secret!=='string'||Buffer.byteLength(secret)<32)return false;
 if(typeof timestamp!=='string'||!/^\d{10}$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000)return false;
 if(typeof signature!=='string'||! /^[a-f0-9]{64}$/i.test(signature))return false;
 const expected=crypto.createHmac('sha256',secret).update(timestamp+'.').update(rawBody).digest();
 return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
// Persist unique provider event IDs atomically before processing settlement.
module.exports={verifyWebhook};
