-- Enable RLS and add policies for core game tables.
-- Also re-declare RPCs as SECURITY DEFINER with a safe search_path.

-- 1) Enable RLS on game tables
alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.game_round_pools enable row level security;
alter table public.game_picks enable row level security;

-- 2) Helper function to avoid policy recursion

-- SECURITY DEFINER helper to check membership without triggering RLS recursion.
create or replace function public.is_member(_game_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.game_members gm
    where gm.game_id = _game_id
      and gm.user_id = _user_id
  );
$$;

grant execute on function public.is_member(uuid, uuid) to authenticated;

-- games: allow all authenticated users to read all games
drop policy if exists select_games_member_or_creator on public.games;
create policy select_games_read_all
on public.games for select
to authenticated
using (true);


-- game_members: allow all authenticated users to read all memberships
drop policy if exists select_game_members_for_my_games on public.game_members;
create policy select_game_members_read_all
on public.game_members for select
to authenticated
using (true);

-- game_members: allow any authenticated user to join any game as themselves
drop policy if exists insert_self_into_lobby on public.game_members;
create policy insert_self_relaxed
on public.game_members for insert
to authenticated
with check (user_id = auth.uid());

-- game_round_pools: allow all authenticated users to read all pools
drop policy if exists select_round_pools_for_members on public.game_round_pools;
create policy select_round_pools_read_all
on public.game_round_pools for select
to authenticated
using (true);

-- game_picks: allow all authenticated users to read all picks
drop policy if exists select_picks_for_members on public.game_picks;
create policy select_picks_read_all
on public.game_picks for select
to authenticated
using (true);


-- 3) Re-declare RPCs as SECURITY DEFINER with safe search_path

-- create_lobby_and_add_creator
create or replace function public.create_lobby_and_add_creator(
  game_name text,
  invite_code text
)
returns public.games
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_game public.games;
begin
  -- 1. Insert the new game
  insert into public.games (name, invite_code, created_by)
  values (game_name, invite_code, auth.uid())
  returning * into new_game;

  -- 2. Add the creator as the first member
  insert into public.game_members (game_id, user_id)
  values (new_game.id, auth.uid());

  -- 3. Return the game
  return new_game;
end;
$$;

-- start_game
create or replace function public.start_game(
  game_id_to_start uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  game_creator_id uuid;
  member_count int;
  shuffled_member_ids uuid[];
  game_categories text[] := '{"Technology", "Health Care", "Financial Services", "Energy", "Retail", "Semiconductors", "Large Cap"}';
  round_index int;
  category_name text;
begin
  -- 1. VALIDATION
  select created_by into game_creator_id
  from public.games
  where id = game_id_to_start;
  if game_creator_id is null then raise exception 'Game not found'; end if;
  if game_creator_id != auth.uid() then raise exception 'Only the game creator can start the game'; end if;

  select count(*) into member_count
  from public.game_members
  where game_id = game_id_to_start;
  if member_count < 2 then raise exception 'You need at least 2 players to start a game'; end if;

  -- 2. GENERATE DRAFT ORDER
  select array_agg(user_id)
  into shuffled_member_ids
  from (
    select user_id from public.game_members
    where game_id = game_id_to_start
    order by random()
  ) as shuffled;

  -- 3. GENERATE DRAFT POOLS
  round_index := 1;
  foreach category_name in array game_categories
  loop
    insert into public.game_round_pools (game_id, pick_round, symbol)
    select
      game_id_to_start,
      round_index,
      s.symbol
    from public.symbols s
    where case
      when category_name = 'Large Cap' then s."marketCapitalization" >= 200000
      else s.description = category_name
    end
    order by random()
    limit 10;

    round_index := round_index + 1;
  end loop;

  -- 4. UPDATE THE GAME
  update public.games
  set
    status = 'DRAFTING',
    start_time = now() + (member_count * 7 * interval '1 minute'),
    end_time = now() + interval '1 month',
    round_categories = game_categories,
    pick_order = shuffled_member_ids,
    current_turn_user_id = shuffled_member_ids[1],
    pick_deadline = now() + interval '1 minute'
  where id = game_id_to_start;
end;
$$;

-- make_pick
create or replace function public.make_pick(
  game_id_to_pick_in uuid,
  symbol_to_pick text,
  is_double_down boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  game_row public.games;
  current_user_id uuid := auth.uid();
  current_round int;
  current_pick_index int;
  member_count int;
  next_turn_user_id uuid;
  next_round int;
  next_pick_index int;
begin
  -- 1. Lock the game row
  select * into game_row
  from public.games
  where id = game_id_to_pick_in
  for update;

  -- 2. Validations
  if game_row.status != 'DRAFTING' then
    raise exception 'Draft is not active';
  end if;

  if game_row.current_turn_user_id != current_user_id then
    raise exception 'It is not your turn';
  end if;

  if now() > game_row.pick_deadline then
    raise exception 'Your time is up! The pick was auto-skipped.';
  end if;

  current_round := game_row.current_pick_round;

  if not exists (
    select 1 from public.game_round_pools
    where game_id = game_id_to_pick_in
      and pick_round = current_round
      and symbol = symbol_to_pick
  ) then
    raise exception 'Stock is not in the draft pool for this round';
  end if;

  -- 3. Insert the pick
  insert into public.game_picks (game_id, user_id, pick_round, symbol, is_double_down)
  values (game_id_to_pick_in, current_user_id, current_round, symbol_to_pick, is_double_down);

  -- 4. Next turn
  current_pick_index := array_position(game_row.pick_order, current_user_id);
  member_count := array_length(game_row.pick_order, 1);

  if current_pick_index < member_count then
    next_pick_index := current_pick_index + 1;
    next_round := current_round;
  else
    next_pick_index := 1;
    next_round := current_round + 1;
  end if;

  next_turn_user_id := game_row.pick_order[next_pick_index];

  -- 5. Update game
  if next_round > 7 then
    update public.games
    set status = 'ACTIVE',
        current_turn_user_id = null,
        pick_deadline = null
    where id = game_id_to_pick_in;
  else
    update public.games
    set current_pick_round = next_round,
        current_turn_user_id = next_turn_user_id,
        pick_deadline = now() + interval '1 minute'
    where id = game_id_to_pick_in;
  end if;
end;
$$;

-- 4) Ensure RPCs are executable by authenticated users
grant execute on function public.create_lobby_and_add_creator(text, text) to authenticated;
grant execute on function public.start_game(uuid) to authenticated;
grant execute on function public.make_pick(uuid, text, boolean) to authenticated;
