import { supabase } from "../auth/supabase";
import type { LobbyMember, PickMap } from "./types";

export async function fetchGameMeta(gameId: string) {
  const { data, error } = await supabase
    .from("games")
    .select(
      "name, invite_code, status, round_categories, pick_order, current_pick_round, current_turn_user_id, pick_deadline",
    )
    .eq("id", gameId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchLobbyMembers(gameId: string) {
  const { data: memberRows, error: memberError } = await supabase
    .from("game_members")
    .select("user_id, joined_at, pnl, pnl_daily_change")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });
  if (memberError) throw new Error(memberError.message);

  const members: LobbyMember[] =
    memberRows?.map((row) => ({
      user_id: row.user_id,
      joined_at: row.joined_at,
      pnl: row.pnl ?? 0,
      pnl_daily_change: row.pnl_daily_change ?? 0,
    })) ?? [];

  if (members.length === 0) {
    return { members: [], usernames: {} };
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in(
      "id",
      members.map((row) => row.user_id),
    );
  if (profileError) throw new Error(profileError.message);

  const usernames: Record<string, string> = {};
  profileRows?.forEach((profile) => {
    usernames[profile.id] = profile.username;
  });

  return { members, usernames };
}

export async function fetchGamePicks(gameId: string): Promise<PickMap> {
  const { data: pickRows, error } = await supabase
    .from("game_picks")
    .select(
      "game_id, user_id, pick_round, symbol, id, created_at, start_price, current_price",
    )
    .eq("game_id", gameId);
  if (error) throw new Error(error.message);
  const map: PickMap = {};
  pickRows?.forEach((pick) => {
    const round = pick.pick_round;
    if (!map[round]) map[round] = {};
    map[round][pick.user_id] = pick;
  });
  return map;
}

type ChannelHandlers = {
  onGameChange: () => void;
  onMemberChange: () => void;
  onPickChange: () => void;
};

export function subscribeToGameChannels(
  gameId: string,
  handlers: ChannelHandlers,
) {
  const gameChannel = supabase
    .channel(`game-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      },
      handlers.onGameChange,
    )
    .subscribe();

  const memberChannel = supabase
    .channel(`game-members-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_members",
        filter: `game_id=eq.${gameId}`,
      },
      handlers.onMemberChange,
    )
    .subscribe();

  const picksChannel = supabase
    .channel(`game-picks-${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_picks",
        filter: `game_id=eq.${gameId}`,
      },
      handlers.onPickChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(gameChannel);
    void supabase.removeChannel(memberChannel);
    void supabase.removeChannel(picksChannel);
  };
}

export async function startGameRpc(gameId: string) {
  const { error } = await supabase.rpc("start_game", {
    game_id_to_start: gameId,
  });
  if (error) throw new Error(error.message);
}

type MakePickResponse = {
  success: boolean;
  error?: string;
};

export async function invokeMakePick(gameId: string, symbol: string) {
  const { data, error } = await supabase.functions.invoke<MakePickResponse>(
    "make-pick",
    {
      body: {
        game_id: gameId,
        symbol,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to submit pick");
  }
}

export async function invokeDebugPickForUser(
  gameId: string,
  userId: string,
  symbol: string,
) {
  const { error } = await supabase.rpc("debug_make_pick_for_user", {
    game_id_to_pick_in: gameId,
    user_id_to_pick: userId,
    symbol_to_pick: symbol,
  });
  if (error) throw new Error(error.message);
}
