'use strict';
const {ApiError}=require('./supabase');
function mountPaymentStatus(app,{store,run}){
 app.get('/api/payments/:id',run(async(req,res)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw new ApiError(400,'Invalid payment identifier.');
  const row=await store.getOwned(req.user.id,req.params.id);
  if(!row)throw new ApiError(404,'Payment not found.');
  res.json({id:row.id,status:row.status,amount:row.amount,fee:row.fee,currency:row.currency});
 }));
}
module.exports={mountPaymentStatus};
