CREATE OR REPLACE FUNCTION public.create_lobby_and_add_creator(
  game_name text,
  invite_code text
)
RETURNS public.games -- Returns the new game row
AS $$
DECLARE
  new_game public.games;
BEGIN
  -- 1. Insert the new game
  INSERT INTO public.games (name, invite_code, created_by)
  VALUES (game_name, invite_code, auth.uid())
  RETURNING * INTO new_game; -- Store the new game in a variable

  -- 2. Add the creator as the first member
  INSERT INTO public.game_members (game_id, user_id)
  VALUES (new_game.id, auth.uid());

  -- 3. Return the game
  RETURN new_game;
END;
$$ LANGUAGE plpgsql;