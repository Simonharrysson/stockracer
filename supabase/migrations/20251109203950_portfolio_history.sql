create table if not exists portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_worth numeric not null check (total_worth >= 0),
  primary key (user_id, date)
);

-- RLS
alter table portfolio_snapshots enable row level security;

create policy "read own"
on portfolio_snapshots for select
to authenticated
using (auth.uid() = user_id);
