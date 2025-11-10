
-- required in many Supabase projects for gen_random_uuid()
create extension if not exists pgcrypto;

-- enum for trade side
do $$
begin
  if not exists (select 1 from pg_type where typname = 'trade_side') then
    create type trade_side as enum ('BUY','SELL');
  end if;
end$$;

-- immutable transaction log
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side trade_side not null,
  quantity numeric(18,6) not null check (quantity > 0),
  price numeric(18,6) not null check (price >= 0),
  executed_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  constraint transactions_symbol_upper_chk check (symbol = upper(symbol))
);

-- helpful indexes
create index if not exists trn_user_time   on public.transactions(user_id, executed_at desc);
create index if not exists trn_user_symbol on public.transactions(user_id, symbol);

-- RLS
alter table public.transactions enable row level security;

drop policy if exists "select own transactions" on public.transactions;
create policy "select own transactions" on public.transactions
  for select using (user_id = auth.uid());

drop policy if exists "insert own transactions" on public.transactions;
create policy "insert own transactions" on public.transactions
  for insert with check (user_id = auth.uid());
