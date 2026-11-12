-- Empty production catalog. Never seed business partnerships, tariffs or GPS data.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', phone text,
 role text not null default 'customer' check(role in ('customer','restaurant_owner','rider','admin')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,phone) values(new.id, left(coalesce(new.raw_user_meta_data->>'name',''),100),new.phone);
 return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function private.new_user();
insert into public.profiles(id,name,phone) select id,left(coalesce(raw_user_meta_data->>'name',''),100),phone from auth.users on conflict do nothing;
create function private.has_role(wanted text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role=wanted)
$$;
create function private.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active)
$$;

create table public.restaurants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles,
 name text not null check(length(name) between 1 and 100), description text not null default '', cuisine text not null default '',
 image text not null check(image ~ '^https://'), latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 approved boolean not null default false, available boolean not null default false,
 preparation_minutes integer not null check(preparation_minutes between 1 and 240),
 commission_bps integer not null default 0 check(commission_bps between 0 and 10000),
 created_at timestamptz not null default now()
);
create table public.menu_items (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants,
 name text not null check(length(name) between 1 and 100), description text not null default '', category text not null,
 image text not null check(image ~ '^https://'), price integer not null check(price between 1 and 10000000),
 currency text not null default 'XAF' check(currency='XAF'), verified boolean not null default false,
 available boolean not null default false, updated_at timestamptz not null default now()
);
create table public.addresses (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null default auth.uid() references public.profiles,
 label text not null check(length(label) between 1 and 80), address text not null check(length(address) between 3 and 500),
 phone text not null check(phone ~ '^\+235[0-9]{8}$'), instructions text not null default '' check(length(instructions)<=1000),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180)
);
create table public.delivery_zones (
 id uuid primary key default gen_random_uuid(), name text not null,
 min_lat double precision not null, max_lat double precision not null,
 min_lng double precision not null, max_lng double precision not null,
 base_fee integer not null check(base_fee between 0 and 100000), per_km integer not null check(per_km between 0 and 100000),
 max_distance_m integer not null check(max_distance_m between 100 and 100000), active boolean not null default false,
 check(min_lat<max_lat and min_lng<max_lng and min_lat>=-90 and max_lat<=90 and min_lng>=-180 and max_lng<=180)
);
create table public.cart_items (
 customer_id uuid not null references public.profiles, item_id uuid not null references public.menu_items,
 quantity integer not null check(quantity between 1 and 50), primary key(customer_id,item_id)
);
create table public.quotes (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles,
 restaurant_id uuid not null references public.restaurants, address_id uuid not null references public.addresses,
 items jsonb not null, address jsonb not null, subtotal integer not null, delivery_fee integer not null,
 total integer not null check(total>0), commission integer not null check(commission>=0),
 distance_m integer not null check(distance_m>=0), duration_s integer not null check(duration_s>=0),
 route jsonb not null, expires_at timestamptz not null default now()+interval '5 minutes'
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles,
 restaurant_id uuid not null references public.restaurants, rider_id uuid references public.profiles,
 quote_id uuid not null unique references public.quotes, idempotency_key uuid not null,
 status text not null default 'pending' check(status in ('pending','accepted','preparing','ready','picked_up','delivered','cancelled')),
 address jsonb not null, subtotal integer not null check(subtotal>0), delivery_fee integer not null check(delivery_fee>=0),
 total integer not null check(total=subtotal+delivery_fee), currency text not null default 'XAF' check(currency='XAF'),
 commission integer not null check(commission between 0 and subtotal), distance_m integer not null, duration_s integer not null,
 route jsonb not null, payment_method text not null check(payment_method in ('cash_on_delivery','airtel_money','moov_money')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), delivered_at timestamptz,
 unique(customer_id,idempotency_key)
);
create table public.order_items (
 order_id uuid not null references public.orders, item_id uuid not null references public.menu_items,
 name text not null, image text not null, price integer not null check(price>0), quantity integer not null check(quantity between 1 and 50),
 primary key(order_id,item_id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders,
 method text not null, amount integer not null check(amount>0), currency text not null default 'XAF' check(currency='XAF'),
 status text not null default 'due' check(status in ('due','collected','paid','cancelled','refund_pending','refunded')),
 provider_reference text unique, reconciled_by uuid references public.profiles, updated_at timestamptz not null default now()
);
create table public.refunds (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders,
 amount integer not null check(amount>0), reason text not null check(length(reason) between 3 and 500),
 status text not null default 'requested' check(status in ('requested','reviewed','refunded','rejected')),
 created_at timestamptz not null default now()
);
create table public.order_events (
 id bigint generated always as identity primary key, order_id uuid not null references public.orders,
 actor_id uuid references public.profiles, status text not null, note text not null default '', created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 order_id uuid not null references public.orders, message text not null, created_at timestamptz not null default now()
);
create table public.rider_locations (
 order_id uuid primary key references public.orders, rider_id uuid not null references public.profiles,
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 accuracy double precision not null check(accuracy between 0 and 1000), recorded_at timestamptz not null default now()
);
create table private.delivery_codes (order_id uuid primary key references public.orders, code text not null, attempts integer not null default 0);

create index orders_customer on public.orders(customer_id,created_at desc);
create index orders_restaurant on public.orders(restaurant_id,status);
create index orders_rider on public.orders(rider_id,status);
create index events_order on public.order_events(order_id,id);
create index menu_restaurant on public.menu_items(restaurant_id);
create index restaurants_owner on public.restaurants(owner_id);
create index notifications_user on public.notifications(user_id,created_at desc);

create function private.owns_restaurant(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role('restaurant_owner') and exists(select 1 from public.restaurants where id=rid and owner_id=auth.uid())
$$;
create function private.can_read_order(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.orders o where o.id=oid and
 (o.customer_id=auth.uid() or private.has_role('admin') or private.owns_restaurant(o.restaurant_id) or (o.rider_id=auth.uid() and private.has_role('rider'))))
$$;
create function private.order_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.status<>old.status or new.rider_id is distinct from old.rider_id then
  insert into public.order_events(order_id,actor_id,status) values(new.id,auth.uid(),new.status);
  insert into public.notifications(user_id,order_id,message)
   select distinct recipient,new.id,new.status from unnest(array[new.customer_id,new.rider_id,(select owner_id from public.restaurants where id=new.restaurant_id)]) recipient where recipient is not null;
 end if;
 return new;
end $$;
create trigger emit_order_event after insert or update on public.orders for each row execute function private.order_event();

-- Every business table is default deny. Only explicit SELECT and address writes are granted.
do $$ declare t text; begin
 foreach t in array array['profiles','restaurants','menu_items','addresses','delivery_zones','cart_items','quotes','orders','order_items','payments','refunds','order_events','notifications','rider_locations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.restaurants,public.menu_items to anon;
grant insert,update,delete on public.addresses to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.has_role('admin'));
create policy restaurant_read on public.restaurants for select to anon,authenticated using(approved or private.owns_restaurant(id) or private.has_role('admin'));
create policy menu_read on public.menu_items for select to anon,authenticated using(
 (verified and exists(select 1 from public.restaurants r where r.id=restaurant_id and approved)) or private.owns_restaurant(restaurant_id) or private.has_role('admin'));
create policy addresses_own on public.addresses for all to authenticated using(customer_id=auth.uid() and private.is_active()) with check(customer_id=auth.uid() and private.is_active());
create policy zones_read on public.delivery_zones for select to authenticated using(active or private.has_role('admin'));
create policy cart_read on public.cart_items for select to authenticated using(customer_id=auth.uid() and private.is_active());
create policy quotes_read on public.quotes for select to authenticated using(customer_id=auth.uid() and private.is_active());
create policy orders_read on public.orders for select to authenticated using(private.can_read_order(id));
create policy items_read on public.order_items for select to authenticated using(private.can_read_order(order_id));
create policy payments_read on public.payments for select to authenticated using(private.can_read_order(order_id));
create policy refunds_read on public.refunds for select to authenticated using(private.can_read_order(order_id));
create policy events_read on public.order_events for select to authenticated using(private.can_read_order(order_id));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and private.is_active());
create policy locations_read on public.rider_locations for select to authenticated using(private.can_read_order(order_id) and exists(select 1 from public.orders where id=order_id and status not in ('delivered','cancelled')));

create function public.set_cart_item(p_item uuid,p_quantity integer,p_add boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare rid uuid; other uuid; n integer;
begin
 if not private.has_role('customer') then raise exception 'Customer access required' using errcode='42501'; end if;
 if p_quantity is null or p_quantity<0 or p_quantity>50 then raise exception 'Invalid quantity'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if p_quantity=0 then delete from public.cart_items where customer_id=auth.uid() and item_id=p_item; return; end if;
 select m.restaurant_id into rid from public.menu_items m join public.restaurants r on r.id=m.restaurant_id
 where m.id=p_item and m.available and m.verified and r.approved and r.available;
 if rid is null then raise exception 'Item unavailable'; end if;
 select m.restaurant_id into other from public.cart_items c join public.menu_items m on m.id=c.item_id where c.customer_id=auth.uid() and m.restaurant_id<>rid limit 1;
 if other is not null then raise exception 'One restaurant per order'; end if;
 select quantity into n from public.cart_items where customer_id=auth.uid() and item_id=p_item;
 n:=case when p_add then coalesce(n,0)+p_quantity else p_quantity end;
 if n>50 then raise exception 'Quantity limit exceeded'; end if;
 insert into public.cart_items values(auth.uid(),p_item,n) on conflict(customer_id,item_id) do update set quantity=excluded.quantity;
end $$;
create function private.cart_snapshot(uid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_agg(jsonb_build_object('item_id',m.id,'restaurant_id',m.restaurant_id,'name',m.name,'image',m.image,'price',m.price,'quantity',c.quantity) order by m.id)
 from public.cart_items c join public.menu_items m on m.id=c.item_id join public.restaurants r on r.id=m.restaurant_id
 where c.customer_id=uid and m.available and m.verified and r.available and r.approved
$$;
-- Only the Node quote service can supply road distance. User JWTs cannot call this RPC.
create function public.create_quote(p_customer uuid,p_address uuid,p_distance integer,p_duration integer,p_route jsonb) returns public.quotes language plpgsql security definer set search_path='' as $$
declare items jsonb; a public.addresses; r public.restaurants; z public.delivery_zones; q public.quotes; sub integer;
begin
 if p_distance is null or p_duration is null or p_distance<0 or p_duration<0 or p_route->>'type'<>'LineString' then raise exception 'Invalid road route'; end if;
 if not exists(select 1 from public.profiles where id=p_customer and active and role='customer') then raise exception 'Customer access required'; end if;
 select * into a from public.addresses where id=p_address and customer_id=p_customer;
 if a.id is null then raise exception 'Address not found'; end if;
 items:=private.cart_snapshot(p_customer);
 if items is null or jsonb_array_length(items)<>(select count(*) from public.cart_items where customer_id=p_customer) then raise exception 'Cart is empty or contains unavailable items'; end if;
 if (select count(distinct i->>'restaurant_id') from jsonb_array_elements(items) i)<>1 then raise exception 'One restaurant per order'; end if;
 select * into r from public.restaurants where id=(items->0->>'restaurant_id')::uuid;
 select * into z from public.delivery_zones where active and a.latitude between min_lat and max_lat and a.longitude between min_lng and max_lng
 and r.latitude between min_lat and max_lat and r.longitude between min_lng and max_lng and p_distance<=max_distance_m order by id limit 1;
 if z.id is null then raise exception 'Outside delivery zone'; end if;
 select sum((i->>'price')::integer*(i->>'quantity')::integer) into sub from jsonb_array_elements(items) i;
 insert into public.quotes(customer_id,restaurant_id,address_id,items,address,subtotal,delivery_fee,total,commission,distance_m,duration_s,route)
 values(p_customer,r.id,a.id,items,to_jsonb(a),sub,z.base_fee+ceil(p_distance/1000.0*z.per_km)::integer,
 sub+z.base_fee+ceil(p_distance/1000.0*z.per_km)::integer,floor(sub*r.commission_bps/10000.0)::integer,p_distance,p_duration+r.preparation_minutes*60,p_route) returning * into q;
 return q;
end $$;
create function public.checkout(p_quote uuid,p_key uuid,p_method text) returns public.orders language plpgsql security definer set search_path='' as $$
declare q public.quotes; o public.orders; snapshot jsonb;
begin
 if not private.has_role('customer') then raise exception 'Customer access required' using errcode='42501'; end if;
 if p_key is null then raise exception 'Idempotency key required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select * into o from public.orders where customer_id=auth.uid() and idempotency_key=p_key;
 if o.id is not null then
  if o.quote_id<>p_quote or o.payment_method<>p_method then raise exception 'Idempotency conflict'; end if;
  return o;
 end if;
 if p_method is distinct from 'cash_on_delivery' then raise exception 'Mobile money is not activated'; end if;
 select * into q from public.quotes where id=p_quote and customer_id=auth.uid() for update;
 if q.id is null or q.expires_at<=now() then raise exception 'Quote expired or not found'; end if;
 perform 1 from public.restaurants where id=q.restaurant_id for share;
 perform 1 from public.menu_items where id in(select item_id from public.cart_items where customer_id=auth.uid()) order by id for share;
 snapshot:=private.cart_snapshot(auth.uid());
 if snapshot is distinct from q.items then raise exception 'Cart changed; request a new quote'; end if;
 if not exists(select 1 from public.addresses where id=q.address_id and to_jsonb(addresses)=q.address) then raise exception 'Address changed; request a new quote'; end if;
 insert into public.orders(customer_id,restaurant_id,quote_id,idempotency_key,address,subtotal,delivery_fee,total,commission,distance_m,duration_s,route,payment_method)
 values(auth.uid(),q.restaurant_id,q.id,p_key,q.address,q.subtotal,q.delivery_fee,q.total,q.commission,q.distance_m,q.duration_s,q.route,p_method) returning * into o;
 insert into public.order_items(order_id,item_id,name,image,price,quantity)
 select o.id,(i->>'item_id')::uuid,i->>'name',i->>'image',(i->>'price')::integer,(i->>'quantity')::integer from jsonb_array_elements(q.items) i;
 insert into public.payments(order_id,method,amount) values(o.id,p_method,o.total);
 insert into private.delivery_codes(order_id,code) values(o.id,lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)%1000000)::text,6,'0'));
 delete from public.cart_items where customer_id=auth.uid();
 return o;
end $$;

create function public.transition_order(p_order uuid,p_status text,p_reason text default '',p_code text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; allowed boolean:=false; d private.delivery_codes;
begin
 select * into o from public.orders where id=p_order for update;
 if o.id is null or not private.can_read_order(o.id) then raise exception 'Order access denied' using errcode='42501'; end if;
 if o.status=p_status then return jsonb_build_object('id',o.id,'status',o.status); end if;
 if p_status='cancelled' then
  allowed:=(o.customer_id=auth.uid() and o.status='pending') or ((private.has_role('admin') or private.owns_restaurant(o.restaurant_id)) and o.status in ('pending','accepted','preparing','ready'));
  if length(trim(p_reason))<3 or length(p_reason)>500 then raise exception 'Cancellation reason required'; end if;
 elsif private.owns_restaurant(o.restaurant_id) then
  allowed:=(o.status='pending' and p_status='accepted') or (o.status='accepted' and p_status='preparing') or (o.status='preparing' and p_status='ready');
 elsif o.rider_id=auth.uid() and private.has_role('rider') then
  allowed:=(o.status='ready' and p_status='picked_up') or (o.status='picked_up' and p_status='delivered');
 end if;
 if not allowed then raise exception 'Invalid order transition' using errcode='42501'; end if;
 if p_status='delivered' then
  select * into d from private.delivery_codes where order_id=o.id for update;
  if d.attempts>=5 then raise exception 'Delivery code locked; contact admin'; end if;
  if p_code is distinct from d.code then
   update private.delivery_codes set attempts=attempts+1 where order_id=o.id;
   return jsonb_build_object('error','Invalid delivery code');
  end if;
  update public.payments set status='collected',updated_at=now() where order_id=o.id and status='due' and method='cash_on_delivery';
 end if;
 update public.orders set status=p_status,updated_at=now(),delivered_at=case when p_status='delivered' then now() else delivered_at end where id=o.id;
 if p_status='cancelled' then
  update public.payments set status=case when status in ('paid','collected') then 'refund_pending' else 'cancelled' end,updated_at=now() where order_id=o.id;
  insert into public.refunds(order_id,amount,reason) select o.id,o.total,p_reason where exists(select 1 from public.payments where order_id=o.id and status='refund_pending') on conflict do nothing;
  update public.order_events set note=p_reason where id=(select max(id) from public.order_events where order_id=o.id);
 end if;
 if p_status in ('delivered','cancelled') then delete from public.rider_locations where order_id=o.id; end if;
 return jsonb_build_object('id',o.id,'status',p_status);
end $$;
create function public.delivery_code(p_order uuid) returns text language sql stable security definer set search_path='' as $$
 select d.code from private.delivery_codes d join public.orders o on o.id=d.order_id where o.id=p_order and o.customer_id=auth.uid() and private.is_active() and o.status not in ('cancelled','delivered')
$$;
create function public.share_location(p_order uuid,p_lat double precision,p_lng double precision,p_accuracy double precision) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role('rider') or not exists(select 1 from public.orders where id=p_order and rider_id=auth.uid() and status in ('accepted','preparing','ready','picked_up')) then raise exception 'Active assigned rider required' using errcode='42501'; end if;
 insert into public.rider_locations values(p_order,auth.uid(),p_lat,p_lng,p_accuracy,now()) on conflict(order_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,recorded_at=now();
end $$;
create function public.request_refund(p_order uuid,p_reason text) returns public.refunds language plpgsql security definer set search_path='' as $$
declare o public.orders; r public.refunds;
begin
 select * into o from public.orders where id=p_order and customer_id=auth.uid() for update;
 if o.id is null or not private.is_active() then raise exception 'Order access denied' using errcode='42501'; end if;
 if o.status not in ('cancelled','delivered') or not exists(select 1 from public.payments where order_id=o.id and status in ('paid','collected','refund_pending')) then raise exception 'No refundable payment'; end if;
 insert into public.refunds(order_id,amount,reason) values(o.id,o.total,p_reason) on conflict(order_id) do update set order_id=excluded.order_id returning * into r;
 return r;
end $$;

create function public.save_menu(p_id uuid,p_restaurant uuid,p_name text,p_category text,p_description text,p_image text,p_price integer,p_available boolean) returns public.menu_items language plpgsql security definer set search_path='' as $$
declare m public.menu_items;
begin
 if not private.owns_restaurant(p_restaurant) and not private.has_role('admin') then raise exception 'Restaurant access denied' using errcode='42501'; end if;
 if p_id is null then
  insert into public.menu_items(restaurant_id,name,category,description,image,price,available) values(p_restaurant,p_name,p_category,p_description,p_image,p_price,p_available) returning * into m;
 else
  update public.menu_items set name=p_name,category=p_category,description=p_description,image=p_image,price=p_price,available=p_available,
  verified=case when (name,category,description,image,price) is distinct from (p_name,p_category,p_description,p_image,p_price) then false else verified end,updated_at=now()
  where id=p_id and restaurant_id=p_restaurant returning * into m;
  if m.id is null then raise exception 'Menu item not found'; end if;
 end if;
 return m;
end $$;

create function public.admin_action(p_action text,p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.restaurants; z public.delivery_zones; o public.orders;
begin
 if not private.has_role('admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 case p_action
 when 'profile' then
  if p_id=auth.uid() then raise exception 'Cannot change own access'; end if;
  update public.profiles set role=coalesce(p_data->>'role',role),active=coalesce((p_data->>'active')::boolean,active) where id=p_id;
 when 'restaurant' then
  if not exists(select 1 from public.profiles where id=(p_data->>'owner_id')::uuid and active and role='restaurant_owner') then raise exception 'Verified owner required'; end if;
  insert into public.restaurants(id,owner_id,name,cuisine,description,image,latitude,longitude,preparation_minutes,commission_bps,approved,available)
  values(coalesce(p_id,gen_random_uuid()),(p_data->>'owner_id')::uuid,p_data->>'name',coalesce(p_data->>'cuisine',''),coalesce(p_data->>'description',''),p_data->>'image',
  (p_data->>'latitude')::double precision,(p_data->>'longitude')::double precision,(p_data->>'preparation_minutes')::integer,(p_data->>'commission_bps')::integer,
  coalesce((p_data->>'approved')::boolean,false),coalesce((p_data->>'available')::boolean,false))
  on conflict(id) do update set owner_id=excluded.owner_id,name=excluded.name,cuisine=excluded.cuisine,description=excluded.description,image=excluded.image,latitude=excluded.latitude,longitude=excluded.longitude,
  preparation_minutes=excluded.preparation_minutes,commission_bps=excluded.commission_bps,approved=excluded.approved,available=excluded.available returning * into r;
  return to_jsonb(r);
 when 'verify_menu' then update public.menu_items set verified=(p_data->>'verified')::boolean where id=p_id;
 when 'zone' then
  insert into public.delivery_zones(id,name,min_lat,max_lat,min_lng,max_lng,base_fee,per_km,max_distance_m,active)
  values(coalesce(p_id,gen_random_uuid()),p_data->>'name',(p_data->>'min_lat')::double precision,(p_data->>'max_lat')::double precision,(p_data->>'min_lng')::double precision,(p_data->>'max_lng')::double precision,
  (p_data->>'base_fee')::integer,(p_data->>'per_km')::integer,(p_data->>'max_distance_m')::integer,(p_data->>'active')::boolean)
  on conflict(id) do update set name=excluded.name,min_lat=excluded.min_lat,max_lat=excluded.max_lat,min_lng=excluded.min_lng,max_lng=excluded.max_lng,base_fee=excluded.base_fee,per_km=excluded.per_km,max_distance_m=excluded.max_distance_m,active=excluded.active returning * into z;
  return to_jsonb(z);
 when 'assign_rider' then
  if not exists(select 1 from public.profiles where id=(p_data->>'rider_id')::uuid and role='rider' and active) then raise exception 'Active rider required'; end if;
  select * into o from public.orders where id=p_id for update;
  if o.status not in ('accepted','preparing','ready') then raise exception 'Order not assignable'; end if;
  update public.orders set rider_id=(p_data->>'rider_id')::uuid,updated_at=now() where id=p_id;
  delete from public.rider_locations where order_id=p_id;
 when 'reconcile_cash' then
  update public.payments set status='paid',reconciled_by=auth.uid(),updated_at=now() where order_id=p_id and method='cash_on_delivery' and status='collected';
  if not found then raise exception 'No collected cash to reconcile'; end if;
 when 'review_refund' then
  update public.refunds set status=case when p_data->>'status'='rejected' then 'rejected' else 'reviewed' end where id=p_id and status='requested';
  -- Reviewing a refund never claims money was returned. Provider/manual proof integration is gated.
 else raise exception 'Unknown admin action';
 end case;
 return jsonb_build_object('ok',true);
end $$;

-- Helpers may be used by policies but may never mutate privileged state from the public API.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.has_role(text),private.is_active(),private.owns_restaurant(uuid),private.can_read_order(uuid) to anon,authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.set_cart_item(uuid,integer,boolean),public.checkout(uuid,uuid,text),public.transition_order(uuid,text,text,text),public.delivery_code(uuid),public.share_location(uuid,double precision,double precision,double precision),public.request_refund(uuid,text),public.save_menu(uuid,uuid,text,text,text,text,integer,boolean),public.admin_action(text,uuid,jsonb) to authenticated;
grant execute on function public.create_quote(uuid,uuid,integer,integer,jsonb) to service_role;
-- Supabase Realtime respects SELECT RLS for every subscriber.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['orders','order_events','rider_locations','notifications'] loop
   execute format('alter publication supabase_realtime add table public.%I',t);
  end loop;
 end if;
end $$;
commit;
