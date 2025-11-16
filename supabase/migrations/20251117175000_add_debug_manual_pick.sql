-- Allow developers to manually submit a pick on behalf of whoever is on the clock.
create or replace function public.debug_make_pick_for_user(
  game_id_to_pick_in uuid,
  user_id_to_pick uuid,
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
  target_user_id uuid := user_id_to_pick;
  current_round int;
  current_pick_index int;
  member_count int;
  next_turn_user_id uuid;
  next_round int;
  next_pick_index int;
begin
  if target_user_id is null then
    raise exception 'Target user id is required';
  end if;

  select * into game_row
  from public.games
  where id = game_id_to_pick_in
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if game_row.status != 'DRAFTING' then
    raise exception 'Draft is not active';
  end if;

  if game_row.current_turn_user_id != target_user_id then
    raise exception 'Target user is not on the clock';
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

  insert into public.game_picks (game_id, user_id, pick_round, symbol, is_double_down)
  values (game_id_to_pick_in, target_user_id, current_round, symbol_to_pick, is_double_down);

  current_pick_index := array_position(game_row.pick_order, target_user_id);
  member_count := array_length(game_row.pick_order, 1);

  if current_pick_index < member_count then
    next_pick_index := current_pick_index + 1;
    next_round := current_round;
  else
    next_pick_index := 1;
    next_round := current_round + 1;
  end if;

  next_turn_user_id := game_row.pick_order[next_pick_index];

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

grant execute on function public.debug_make_pick_for_user(uuid, uuid, text, boolean) to authenticated;
