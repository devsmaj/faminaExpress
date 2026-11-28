begin;
create function public.famipay_recovery_consume(p_user uuid,p_session uuid,p_grant uuid,p_hash text,p_salt text) returns boolean language plpgsql security definer set search_path='' as $$
begin
if p_hash is null or p_salt is null or p_hash !~ '^[a-f0-9]{128}$' or p_salt !~ '^[a-f0-9]{32}$' then raise exception 'Invalid PIN format'; end if;
update public.famipay_recovery_grants set consumed_at=now() where id=p_grant and user_id=p_user and session_id=p_session and consumed_at is null and expires_at>now() and verified_at<=now();
if not found then return false; end if;
update private.account_pins set pin_hash=p_hash,pin_salt=p_salt where user_id=p_user;
if not found then raise exception 'PIN record unavailable'; end if;
return true;
end $$;
revoke all on function public.famipay_recovery_consume(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.famipay_recovery_consume(uuid,uuid,uuid,text,text) to service_role;
commit;
