-- Temporarily relax draft deadlines until UX flow is finalized.
create or replace function public.make_pick(
  game_id_to_pick_in uuid,
  symbol_to_pick text
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
  insert into public.game_picks (game_id, user_id, pick_round, symbol)
  values (game_id_to_pick_in, current_user_id, current_round, symbol_to_pick);

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
