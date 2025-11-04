alter table public.symbols
  add column if not exists day_open  numeric,
  add column if not exists day_high  numeric,
  add column if not exists day_low   numeric;
  add column if not exists d numeric,
  add column if not exists dp numeric;
