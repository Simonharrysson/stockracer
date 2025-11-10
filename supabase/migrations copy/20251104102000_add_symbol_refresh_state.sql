create table if not exists public.symbol_refresh_state (
  id int primary key default 1,
  next_offset int not null default 0,
  last_run timestamptz,
  last_error text
);

insert into public.symbol_refresh_state (id)
values (1)
on conflict (id) do nothing;
