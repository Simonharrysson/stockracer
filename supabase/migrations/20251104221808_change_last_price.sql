alter table public.symbols rename column last_price to current_price;

alter table public.symbols
  add column if not exists prev_close      numeric,
  add column if not exists day_open        numeric,
  add column if not exists day_high        numeric,
  add column if not exists day_low         numeric,
  add column if not exists day_change      numeric,
  add column if not exists day_change_pct  numeric, -- percent units from Finnhub `dp`
  add column if not exists price_time      timestamptz;