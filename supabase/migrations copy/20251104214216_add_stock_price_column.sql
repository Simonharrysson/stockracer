alter table public.symbols
  add column if not exists last_price numeric,
  add column if not exists prev_close numeric,
  add column if not exists price_time timestamptz,
  add column if not exists day_change numeric,
  add column if not exists day_change_pct numeric;
