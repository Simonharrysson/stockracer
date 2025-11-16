-- This REPLACES the old 'make_pick' function
CREATE OR REPLACE FUNCTION public.make_pick(
  game_id_to_pick_in uuid,
  symbol_to_pick text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  game_row public.games;
  current_user_id uuid := auth.uid();
  current_round int;
  current_pick_index int;
  member_count int;
  next_turn_user_id uuid;
  next_round int;
  next_pick_index int;
BEGIN
  -- 1. Lock the game row
  SELECT * INTO game_row
  FROM public.games
  WHERE id = game_id_to_pick_in
  FOR UPDATE;

  -- 2. Validations
  IF game_row.status != 'DRAFTING' THEN
    RAISE EXCEPTION 'Draft is not active';
  END IF;

  IF game_row.current_turn_user_id != current_user_id THEN
    RAISE EXCEPTION 'It is not your turn';
  END IF;
  
  -- (Removing deadline check based on your 'remove_pick_deadline_enforcement' migration)
  -- IF now() > game_row.pick_deadline THEN
  --   RAISE EXCEPTION 'Your time is up! The pick was auto-skipped.';
  -- END IF;

  current_round := game_row.current_pick_round;

  IF NOT EXISTS (
    SELECT 1
    FROM public.game_round_pools
    WHERE game_id = game_id_to_pick_in
      AND pick_round = current_round
      AND symbol = symbol_to_pick
  ) THEN
    RAISE EXCEPTION 'Stock is not in the draft pool for this round';
  END IF;
  
  -- 3. Insert the pick
  INSERT INTO public.game_picks (game_id, user_id, pick_round, symbol)
  VALUES (game_id_to_pick_in, current_user_id, current_round, symbol_to_pick);

  -- 5. Calculate the next turn
  current_pick_index := array_position(game_row.pick_order, current_user_id);
  member_count := array_length(game_row.pick_order, 1);

  IF current_pick_index < member_count THEN
    next_pick_index := current_pick_index + 1;
    next_round := current_round;
  ELSE
    next_pick_index := 1;
    next_round := current_round + 1;
  END IF;

  next_turn_user_id := game_row.pick_order[next_pick_index];

  -- 6. Update the game state
  IF next_round > 7 THEN
    UPDATE public.games
    SET
      status = 'ACTIVE',
      start_time = now(), -- Set the *actual* game start time
      end_time = now() + interval '1 month',
      current_turn_user_id = NULL,
      pick_deadline = NULL
    WHERE id = game_id_to_pick_in;
  ELSE
    UPDATE public.games
    SET
      current_pick_round = next_round,
      current_turn_user_id = next_turn_user_id,
      pick_deadline = now() + interval '1 minute'
    WHERE id = game_id_to_pick_in;
  END IF;

END;
$$;
