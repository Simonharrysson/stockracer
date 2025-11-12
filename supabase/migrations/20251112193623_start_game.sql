CREATE OR REPLACE FUNCTION public.start_game(
  game_id_to_start uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  game_creator_id uuid;
  member_count int;
  shuffled_member_ids uuid[];
  -- *** FIX: These names now EXACTLY match your seed.sql descriptions ***
  game_categories text[] := '{"Technology", "Health Care", "Financial Services", "Energy", "Retail", "Semiconductors", "Large Cap"}';
  round_index int;
  category_name text;
BEGIN
  -- 1. VALIDATION (Same as before)
  SELECT created_by INTO game_creator_id
  FROM public.games
  WHERE id = game_id_to_start;
  IF game_creator_id IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF game_creator_id != auth.uid() THEN RAISE EXCEPTION 'Only the game creator can start the game'; END IF;

  SELECT count(*) INTO member_count
  FROM public.game_members
  WHERE game_id = game_id_to_start;
  IF member_count < 2 THEN RAISE EXCEPTION 'You need at least 2 players to start a game'; END IF;

  -- 3. GENERATE DRAFT ORDER (Same as before)
  SELECT array_agg(user_id)
  INTO shuffled_member_ids
  FROM (
    SELECT user_id FROM public.game_members
    WHERE game_id = game_id_to_start
    ORDER BY RANDOM()
  ) AS shuffled;

  -- 4. GENERATE DRAFT POOLS (This logic is now fixed)
  round_index := 1;
  FOREACH category_name IN ARRAY game_categories
  LOOP
    INSERT INTO public.game_round_pools (game_id, pick_round, symbol)
    SELECT
      game_id_to_start,
      round_index,
      s.symbol
    FROM public.symbols s
    -- *** FIX: This CASE statement correctly handles different category types ***
    WHERE CASE
      WHEN category_name = 'Large Cap' THEN s."marketCapitalization" >= 200000 -- 200B
      -- Add more special cases here if needed (e.g., 'Small Cap')
      ELSE s.description = category_name
    END
    ORDER BY RANDOM()
    LIMIT 10;
    
    round_index := round_index + 1;
  END LOOP;

  -- 5. UPDATE THE GAME (Same as before)
  UPDATE public.games
  SET
    status = 'DRAFTING',
    start_time = now() + (member_count * 7 * interval '1 minute'),
    end_time = now() + interval '1 month',
    round_categories = game_categories,
    pick_order = shuffled_member_ids,
    current_turn_user_id = shuffled_member_ids[1],
    pick_deadline = now() + interval '1 minute'
  WHERE
    id = game_id_to_start;
END;
$$;