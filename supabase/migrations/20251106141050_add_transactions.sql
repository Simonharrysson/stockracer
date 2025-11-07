
-- required in many Supabase projects for gen_random_uuid()
create extension if not exists pgcrypto;

-- enum for trade side
do $$
begin
  if not exists (select 1 from pg_type where typname = 'trade_side') then
    create type trade_side as enum ('BUY','SELL');
  end if;
end$$;

-- one portfolio row per user
create table if not exists public.portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tickers text[] not null default '{}',              -- derived from open positions
  total_worth numeric(18,6) not null default 0,      -- Σ qty * current_price
  total_invested numeric(18,6) not null default 0,   -- cost basis of open qty
  unrealized_pnl numeric(18,6) not null default 0,   -- total_worth - total_invested
  total_change_pct numeric(9,6) not null default 0,  -- unrealized / invested
  last_change_pct numeric(9,6) not null default 0,   -- today vs yesterday
  position_count int not null default 0,
  last_trade_at timestamptz,
  updated_at timestamptz not null default now()
);

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
alter table public.portfolios   enable row level security;
alter table public.transactions enable row level security;

-- policies
drop policy if exists "select own portfolio"    on public.portfolios;
create policy "select own portfolio" on public.portfolios
  for select using (user_id = auth.uid());

drop policy if exists "select own transactions" on public.transactions;
create policy "select own transactions" on public.transactions
  for select using (user_id = auth.uid());

drop policy if exists "insert own transactions" on public.transactions;
create policy "insert own transactions" on public.transactions
  for insert with check (user_id = auth.uid());
