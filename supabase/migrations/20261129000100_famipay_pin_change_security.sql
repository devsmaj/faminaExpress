create table if not exists private.famipay_pin_limits(user_id uuid primary key, attempts integer not null, expires_at timestamptz not null);
alter table private.famipay_pin_limits enable row level security;
revoke all on private.famipay_pin_limits from public, anon, authenticated;
create or replace function public.famipay_pin_attempt(p_user uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer; h text; s text;
begin
insert into private.famipay_pin_limits as l values(p_user,1,now()+interval '15 minutes') on conflict(user_id) do update set attempts=case when l.expires_at<=now() then 1 else least(l.attempts+1,6) end, expires_at=case when l.expires_at<=now() then now()+interval '15 minutes' else l.expires_at end returning attempts into n;
if n>5 then return jsonb_build_object('allowed',false); end if;
select pin_hash,pin_salt into h,s from private.account_pins where user_id=p_user;
return jsonb_build_object('allowed',h is not null,'pin_hash',h,'pin_salt',s);
end $$;
create or replace function public.famipay_pin_replace(p_user uuid,p_expected_hash text,p_hash text,p_salt text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
if p_hash is null or p_salt is null or p_hash !~ '^[a-f0-9]{128}$' or p_salt !~ '^[a-f0-9]{32}$' then raise exception 'Invalid PIN format'; end if;
update private.account_pins set pin_hash=p_hash,pin_salt=p_salt where user_id=p_user and pin_hash=p_expected_hash;
if not found then return jsonb_build_object('changed',false); end if;
return jsonb_build_object('changed',true);
end $$;
revoke all on function public.famipay_pin_attempt(uuid), public.famipay_pin_replace(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.famipay_pin_attempt(uuid), public.famipay_pin_replace(uuid,text,text,text) to service_role;