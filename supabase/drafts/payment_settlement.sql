begin;
create function public.famipay_payment_owned(p_user uuid,p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select to_jsonb(t) from public.famipay_payment_intents t where id=p_id and user_id=p_user $$;
create function public.famipay_payment_pending(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select to_jsonb(t) from public.famipay_payment_intents t where id=p_id and status='pending' $$;
create function public.famipay_payment_reconcile(p_id uuid) returns void language sql security invoker set search_path='' as $$ update public.famipay_payment_intents set reconciliation_required=true where id=p_id and status='pending' $$;
create function public.famipay_payment_claim(p_user uuid,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.famipay_payment_intents; total bigint;
begin
select * into t from public.famipay_payment_intents where id=p_id and user_id=p_user for update;
if not found or t.status<>'authorized' or t.expires_at<=now() then return null; end if;
-- No dispatch until risk limits and authorization issuance are implemented.
raise exception 'Payment execution disabled pending risk controls';
end $$;
create function public.famipay_payment_settle(p_id uuid,p_status text,p_reference text) returns void language plpgsql security invoker set search_path='' as $$
declare t public.famipay_payment_intents; total bigint;
begin
if p_status is null or p_status not in ('pending','successful','failed') or p_reference is null or length(p_reference) not between 1 and 256 then raise exception 'Invalid outcome'; end if;
select * into t from public.famipay_payment_intents where id=p_id for update;
if not found or t.status<>'pending' then return; end if;
if p_status='pending' then update public.famipay_payment_intents set reconciliation_required=true where id=p_id; return; end if;
total:=t.amount+t.fee;
if not exists(select 1 from public.famipay_wallet_journal where payment_id=p_id and phase='reserve' and reserved_delta=total) then raise exception 'Missing reservation'; end if;
update public.famipay_wallet_accounts set reserved=reserved-total,available=available+case when p_status='failed' then total else 0 end where user_id=t.user_id and reserved>=total;
if not found then raise exception 'Missing reserved funds'; end if;
insert into public.famipay_wallet_journal(payment_id,phase,available_delta,reserved_delta,clearing_delta) values(p_id,case when p_status='failed' then 'release' else 'settle' end,case when p_status='failed' then total else 0 end,-total,case when p_status='successful' then total else 0 end);
update public.famipay_payment_intents set status=p_status,provider_reference=p_reference,reconciliation_required=false where id=p_id;
end $$;
revoke all on function public.famipay_payment_owned(uuid,uuid),public.famipay_payment_pending(uuid),public.famipay_payment_reconcile(uuid),public.famipay_payment_claim(uuid,uuid),public.famipay_payment_settle(uuid,text,text) from public,anon,authenticated;
grant execute on function public.famipay_payment_owned(uuid,uuid),public.famipay_payment_pending(uuid),public.famipay_payment_reconcile(uuid),public.famipay_payment_claim(uuid,uuid),public.famipay_payment_settle(uuid,text,text) to service_role;
commit;
