begin;
create table public.famipay_wallet_accounts (
 user_id uuid primary key references auth.users(id),
 available bigint not null default 0 check (available between 0 and 9007199254740991),
 reserved bigint not null default 0 check (reserved between 0 and 9007199254740991),
 currency text not null default 'XAF' check (currency='XAF')
);
create table public.famipay_payment_intents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.famipay_wallet_accounts(user_id),
 idempotency_key uuid not null,
 service text not null check(service in ('wallet','mobile_money','bank_transfer','card','qr','bill','airtime_data','merchant')),
 recipient text not null check(length(recipient) between 1 and 256),
 amount bigint not null check(amount between 1 and 9007199254740991),
 fee bigint not null check(fee between 0 and 9007199254740991),
 currency text not null default 'XAF' check(currency='XAF'),
 status text not null default 'initiated' check(status in ('initiated','authorized','pending','successful','failed')),
 expires_at timestamptz not null,
 provider_reference text,
 reconciliation_required boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id,idempotency_key),
 check(amount+fee <= 9007199254740991)
);
create table public.famipay_wallet_journal (
 payment_id uuid not null references public.famipay_payment_intents(id),
 phase text not null check(phase in ('reserve','settle','release')),
 available_delta bigint not null,
 reserved_delta bigint not null,
 clearing_delta bigint not null,
 created_at timestamptz not null default now(),
 primary key(payment_id,phase),
 check(available_delta+reserved_delta+clearing_delta=0)
);
alter table public.famipay_wallet_accounts enable row level security;
alter table public.famipay_payment_intents enable row level security;
alter table public.famipay_wallet_journal enable row level security;
revoke all on public.famipay_wallet_accounts,public.famipay_payment_intents,public.famipay_wallet_journal from public,anon,authenticated,service_role;
grant select,insert,update on public.famipay_wallet_accounts,public.famipay_payment_intents to service_role;
grant select,insert on public.famipay_wallet_journal to service_role;
create index famipay_pending_idx on public.famipay_payment_intents(created_at) where status='pending';
-- Draft only: funding, authorization, limits, settlement RPCs and concurrency
-- tests must be implemented before this schema is promoted to migrations.
commit;
