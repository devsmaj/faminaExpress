-- Guest carts contain IDs/quantities only. Import is atomic, authenticated and retry-safe.
begin;
create table public.cart_imports (
 customer_id uuid not null references public.profiles,
 import_key uuid not null, items jsonb not null, created_at timestamptz not null default now(),
 primary key(customer_id,import_key)
);
alter table public.cart_imports enable row level security;
revoke all on public.cart_imports from public,anon,authenticated;
create function public.merge_guest_cart(p_key uuid,p_items jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare entry jsonb; previous jsonb;
begin
 if not private.has_role('customer') then raise exception 'Customer access required' using errcode='42501'; end if;
 if p_key is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>20 or jsonb_array_length(p_items)<1 then raise exception 'Invalid guest cart'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select items into previous from public.cart_imports where customer_id=auth.uid() and import_key=p_key;
 if found then
  if previous is distinct from p_items then raise exception 'Cart import conflict'; end if;
  return;
 end if;
 if (select count(distinct candidate.value->>'itemId') from jsonb_array_elements(p_items) candidate(value))<>jsonb_array_length(p_items) then raise exception 'Duplicate guest item'; end if;
 for entry in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(entry->'quantity') is distinct from 'number' or (entry->>'quantity') !~ '^[0-9]+$' or (entry->>'quantity')::integer<1 then raise exception 'Invalid guest quantity'; end if;
  perform public.set_cart_item((entry->>'itemId')::uuid,(entry->>'quantity')::integer,true);
 end loop;
 insert into public.cart_imports(customer_id,import_key,items) values(auth.uid(),p_key,p_items);
end $$;
revoke all on function public.merge_guest_cart(uuid,jsonb) from public,anon;
grant execute on function public.merge_guest_cart(uuid,jsonb) to authenticated;
commit;
