create table if not exists public.symbols (
  symbol text primary key,
  company_name text not null,
  currency text not null,
  description text not null,
  exchange text not null,
  logo text,
  "marketCapitalization" numeric
);
