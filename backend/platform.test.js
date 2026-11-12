const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('PostgreSQL security and complete cash order lifecycle', async t => {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(fs.readFileSync(require.resolve('../supabase/migrations/202611120001_platform.sql'),'utf8'));
 async function as(uid,sql,params=[],role='authenticated') {
  await db.exec('begin');
  try { await db.exec(`set local role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid||'']);
   const result=await db.query(sql,params); await db.exec('commit'); return result.rows;
  } catch(e) {await db.exec('rollback');throw e;}
 }
 const rpc = (uid,name,args) => as(uid,`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as result`,args).then(rows=>rows[0].result);
 for(let n=1;n<=6;n++) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id(n),{name:'TEST FIXTURE '+n,role:'admin'}]);
 await db.query("update profiles set role=case id when $1 then 'admin' when $2 then 'restaurant_owner' when $3 then 'rider' else 'customer' end",[id(1),id(3),id(4)]);
 let restaurant, menu, address, quote, order;
 const route={type:'LineString',coordinates:[[20.83,13.83],[20.84,13.84]]};
 await t.test('metadata cannot promote a customer; direct financial writes denied',async()=>{
  assert.equal((await as(id(2),'select role from profiles where id=$1',[id(2)]))[0].role,'customer');
  await assert.rejects(as(id(2),"update profiles set role='admin' where id=$1",[id(2)]),/permission denied/);
  await assert.rejects(as(id(2),"insert into payments(order_id,method,amount) values($1,'cash_on_delivery',1)",[id(20)]),/permission denied/);
  await assert.rejects(rpc(id(2),'admin_action',['profile',id(6),{role:'admin'}]),/Admin access/);
 });
 await t.test('only admin can approve real catalog records',async()=>{
  restaurant=await rpc(id(1),'admin_action',['restaurant',null,{owner_id:id(3),name:'TEST RESTAURANT',image:'https://example.test/food.jpg',latitude:13.83,longitude:20.83,preparation_minutes:20,commission_bps:500,approved:false,available:true}]);
  assert.equal((await as(null,'select * from restaurants',[],'anon')).length,0);
  menu=await rpc(id(3),'save_menu',[null,restaurant.id,'TEST FOOD','TEST','Fixture','https://example.test/food.jpg',1500,true]);
  assert.equal(menu.verified,false);
  await assert.rejects(rpc(id(2),'save_menu',[menu.id,restaurant.id,'Hack','TEST','','https://example.test/a.jpg',1,true]),/access denied/);
  await rpc(id(1),'admin_action',['restaurant',restaurant.id,{...restaurant,approved:true}]);
  await rpc(id(1),'admin_action',['verify_menu',menu.id,{verified:true}]);
  assert.equal((await as(null,'select * from menu_items',[],'anon')).length,1);
 });
 await t.test('addresses stay private and validate Chad phone numbers',async()=>{
  await assert.rejects(as(id(2),'insert into addresses(label,address,phone,latitude,longitude) values($1,$2,$3,$4,$5)',['TEST','TEST address','+15551234',13.84,20.84]),/check constraint/);
  address=(await as(id(2),'insert into addresses(label,address,phone,latitude,longitude) values($1,$2,$3,$4,$5) returning *',['TEST','TEST address','+23566000000',13.84,20.84]))[0];
  assert.equal((await as(id(5),'select * from addresses')).length,0);
 });
 await t.test('cart quantities validated and persisted',async()=>{
  for(const qty of [-1,51,null]) await assert.rejects(rpc(id(2),'set_cart_item',[menu.id,qty,false]),/quantity/i);
  await rpc(id(2),'set_cart_item',[menu.id,2,false]);
  assert.equal((await as(id(2),'select * from cart_items'))[0].quantity,2);
  assert.equal((await as(id(5),'select * from cart_items')).length,0);
 });
 await t.test('only quote service can supply route; no zone means no checkout',async()=>{
  await assert.rejects(rpc(id(2),'create_quote',[id(2),address.id,2000,600,route]),/permission denied/);
  await assert.rejects(db.query('select create_quote($1,$2,$3,$4,$5)',[id(2),address.id,2000,600,route]),/Outside delivery zone/);
  await rpc(id(1),'admin_action',['zone',null,{name:'TEST ZONE',min_lat:13.8,max_lat:13.9,min_lng:20.8,max_lng:20.9,base_fee:500,per_km:100,max_distance_m:10000,active:true}]);
  quote=(await db.query('select to_jsonb(create_quote($1,$2,$3,$4,$5)) as q',[id(2),address.id,2000,600,route])).rows[0].q;
  assert.equal(quote.subtotal,3000);assert.equal(quote.delivery_fee,700);assert.equal(quote.total,3700);assert.equal(quote.commission,150);
 });
 await t.test('unapproved payments, quote theft and stale cart are rejected',async()=>{
  await assert.rejects(rpc(id(2),'checkout',[quote.id,id(100),'airtel_money']),/not activated/);
  await assert.rejects(rpc(id(2),'checkout',[quote.id,id(100),'moov_money']),/not activated/);
  await assert.rejects(rpc(id(5),'checkout',[quote.id,id(100),'cash_on_delivery']),/Quote expired or not found/);
  await rpc(id(2),'set_cart_item',[menu.id,1,false]);
  await assert.rejects(rpc(id(2),'checkout',[quote.id,id(100),'cash_on_delivery']),/Cart changed/);
  await rpc(id(2),'set_cart_item',[menu.id,2,false]);
 });
 await t.test('checkout commits once, snapshots prices and clears cart atomically',async()=>{
  order=await rpc(id(2),'checkout',[quote.id,id(100),'cash_on_delivery']);
  assert.equal(order.total,3700);assert.equal(order.status,'pending');
  assert.equal((await rpc(id(2),'checkout',[quote.id,id(100),'cash_on_delivery'])).id,order.id);
  await assert.rejects(rpc(id(2),'checkout',[quote.id,id(100),'moov_money']),/Idempotency conflict/);
  assert.equal((await as(id(2),'select * from cart_items')).length,0);
  assert.equal((await as(id(2),'select * from payments'))[0].status,'due');
  assert.equal((await as(id(5),'select * from orders')).length,0);
  assert.equal((await as(id(5),'select * from order_events')).length,0);
 });
 await t.test('transitions cannot be skipped or changed by a stranger',async()=>{
  await assert.rejects(rpc(id(2),'transition_order',[order.id,'delivered','','']),/Invalid order transition/);
  await assert.rejects(rpc(id(5),'transition_order',[order.id,'cancelled','TEST reason','']),/access denied/);
  await rpc(id(3),'transition_order',[order.id,'accepted','','']);
  await assert.rejects(rpc(id(2),'transition_order',[order.id,'cancelled','TEST reason','']),/Invalid order transition/);
  await rpc(id(1),'admin_action',['assign_rider',order.id,{rider_id:id(4)}]);
  await rpc(id(4),'share_location',[order.id,13.835,20.835,12]);
  assert.equal((await as(id(2),'select * from rider_locations')).length,1);
  assert.equal((await as(id(5),'select * from rider_locations')).length,0);
  await rpc(id(3),'transition_order',[order.id,'preparing','','']);await rpc(id(3),'transition_order',[order.id,'ready','','']);
  await rpc(id(4),'transition_order',[order.id,'picked_up','','']);
 });
 await t.test('delivery requires customer code; payment is collected, not falsely paid',async()=>{
  assert.equal(await rpc(id(4),'delivery_code',[order.id]),null);
  const code=await rpc(id(2),'delivery_code',[order.id]);assert.match(code,/^\d{6}$/);
  assert((await rpc(id(4),'transition_order',[order.id,'delivered','','wrong'])).error);
  assert.equal((await db.query('select attempts from private.delivery_codes')).rows[0].attempts,1);
  await rpc(id(4),'transition_order',[order.id,'delivered','',code]);
  assert.equal((await as(id(2),'select * from rider_locations')).length,0);
  await assert.rejects(rpc(id(4),'share_location',[order.id,13.84,20.84,10]),/Active assigned rider/);
  assert.equal((await as(id(2),'select * from payments'))[0].status,'collected');
  await rpc(id(1),'admin_action',['reconcile_cash',order.id,{}]);
  assert.equal((await as(id(2),'select * from payments'))[0].status,'paid');
  const refund=await rpc(id(2),'request_refund',[order.id,'TEST complaint']);
  await rpc(id(1),'admin_action',['review_refund',refund.id,{status:'reviewed'}]);
  assert.equal((await as(id(2),'select * from refunds'))[0].status,'reviewed');
  assert.equal((await as(id(2),'select * from payments'))[0].status,'paid');
 });
 await t.test('cancellation leaves unpaid order cancelled without inventing a refund',async()=>{
  await rpc(id(2),'set_cart_item',[menu.id,1,false]);
  const q=(await db.query('select to_jsonb(create_quote($1,$2,$3,$4,$5)) as q',[id(2),address.id,2000,600,route])).rows[0].q;
  const o=await rpc(id(2),'checkout',[q.id,id(101),'cash_on_delivery']);
  await rpc(id(2),'transition_order',[o.id,'cancelled','TEST changed mind','']);
  assert.equal((await as(id(2),'select * from payments where order_id=$1',[o.id]))[0].status,'cancelled');
  await assert.rejects(rpc(id(2),'request_refund',[o.id,'TEST refund']),/No refundable payment/);
  assert((await as(id(2),'select * from notifications')).length>0);
 });
 await t.test('price changes require reverification; inactive users lose access',async()=>{
  await rpc(id(3),'save_menu',[menu.id,restaurant.id,'TEST FOOD','TEST','Fixture','https://example.test/food.jpg',2000,true]);
  assert.equal((await as(null,'select * from menu_items',[],'anon')).length,0);
  await rpc(id(1),'admin_action',['profile',id(2),{active:false}]);
  assert.equal((await as(id(2),'select * from orders')).length,0);
  await assert.rejects(rpc(id(2),'set_cart_item',[menu.id,1,false]),/Customer access/);
 });
 await db.close();
});
