begin;
create table public.famipay_recovery_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 session_id uuid not null,
 verified_at timestamptz not null,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 unique(user_id,session_id,verified_at),
 check(expires_at>verified_at and expires_at<=verified_at+interval '2 minutes')
);
alter table public.famipay_recovery_grants enable row level security;
revoke all on public.famipay_recovery_grants from public,anon,authenticated,service_role;
grant select,insert,update on public.famipay_recovery_grants to service_role;
-- Issuance and consumption RPCs require verified factor age and atomic PIN replacement.
commit;
