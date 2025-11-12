-- 1. Create extension
create extension if not exists pgcrypto with schema extensions;

-- 2. Create a 'game_status' enum type
create type public.game_status as enum ('LOBBY', 'DRAFTING', 'ACTIVE', 'FINISHED');

-- 3. Create tables
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  invite_code text not null unique,
  status public.game_status not null default 'LOBBY',
  start_time timestamptz,
  end_time timestamptz,
  round_categories text[],
  current_pick_round smallint not null default 1,
  pick_order uuid[],
  current_turn_user_id uuid references auth.users(id),
  pick_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.game_members (
  game_id uuid references public.games(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  has_used_double_down boolean not null default false,
  primary key (game_id, user_id)
);

create table if not exists public.game_round_pools (
  game_id uuid not null references public.games(id) on delete cascade,
  pick_round smallint not null,
  symbol text not null,
  primary key (game_id, pick_round, symbol)
);

create table if not exists public.game_picks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  user_id uuid not null,
  pick_round smallint not null,
  symbol text not null,
  is_double_down boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, user_id, pick_round),
  unique (game_id, symbol),
  foreign key (game_id, user_id) references public.game_members(game_id, user_id) on delete cascade
);

-- 4. Create indexes
create index if not exists idx_games_invite_code on public.games(invite_code);
create index if not exists idx_game_members_user_id on public.game_members(user_id);
create index if not exists idx_game_picks_game_user on public.game_picks(game_id, user_id);

-- 5. RLS is DISABLED for simple testing
alter table public.games disable row level security;
alter table public.game_members disable row level security;
alter table public.game_picks disable row level security;
alter table public.game_round_pools disable row level security;