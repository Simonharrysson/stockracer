import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "../auth/supabase";
import type { GameRow, GameState, LobbyMember, PickMap } from "./types";

type MakePickResponse = {
  success: boolean;
  error?: string;
};

type GameContextValue = {
  gameId: string;
  name: string;
  inviteCode?: string;
  status: GameRow["status"] | null;
  currentPickRound: number | null;
  currentTurnUserId: string | null;
  pickDeadline?: string | null;
  roundCategories: string[];
  pickOrder: string[];
  picks: PickMap;
  picksLoading: boolean;
  members: LobbyMember[];
  membersLoading: boolean;
  membersError: string | null;
  usernames: Record<string, string>;
  gameLoading: boolean;
  gameError: string | null;
  refreshGame: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshPicks: () => Promise<void>;
  startGame: () => Promise<void>;
  submitPick: (
    symbol: string,
    options?: { doubleDown?: boolean },
  ) => Promise<void>;
  debugPickForUser: (
    userId: string,
    symbol: string,
    options?: { doubleDown?: boolean },
  ) => Promise<void>;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

type GameProviderProps = {
  gameId: string;
  initialName?: string;
  initialInviteCode?: string;
  initialPickOrder?: string[];
  initialUsernames?: Record<string, string>;
  children: ReactNode;
};

type GameAction =
  | { type: "meta"; payload: Partial<GameState["meta"]> }
  | { type: "members"; payload: LobbyMember[] }
  | { type: "membersLoading"; payload: boolean }
  | { type: "membersError"; payload: string | null }
  | { type: "picks"; payload: PickMap }
  | { type: "picksLoading"; payload: boolean }
  | { type: "usernames"; payload: Record<string, string> }
  | { type: "loading"; payload: boolean }
  | { type: "error"; payload: string | null };

function createInitialState(props: GameProviderProps): GameState {
  return {
    meta: {
      id: props.gameId,
      name: props.initialName ?? "Lobby",
      inviteCode: props.initialInviteCode,
      status: null,
      currentPickRound: null,
      currentTurnUserId: null,
      pickDeadline: null,
      roundCategories: [],
      pickOrder: props.initialPickOrder ?? [],
    },
    members: { data: [], loading: true, error: null },
    picks: { data: {}, loading: true },
    usernames: props.initialUsernames ?? {},
    loading: true,
    error: null,
  };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "meta":
      return { ...state, meta: { ...state.meta, ...action.payload } };
    case "members":
      return { ...state, members: { ...state.members, data: action.payload } };
    case "membersLoading":
      return {
        ...state,
        members: { ...state.members, loading: action.payload },
      };
    case "membersError":
      return {
        ...state,
        members: { ...state.members, error: action.payload },
      };
    case "picks":
      return { ...state, picks: { ...state.picks, data: action.payload } };
    case "picksLoading":
      return { ...state, picks: { ...state.picks, loading: action.payload } };
    case "usernames":
      return {
        ...state,
        usernames: { ...state.usernames, ...action.payload },
      };
    case "loading":
      return { ...state, loading: action.payload };
    case "error":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export function GameProvider(props: GameProviderProps) {
  const { gameId, children } = props;
  const [state, dispatch] = useReducer(gameReducer, createInitialState(props));

  const refreshGame = useCallback(async () => {
    dispatch({ type: "error", payload: null });
    dispatch({ type: "loading", payload: true });
    try {
      const { data, error } = await supabase
        .from("games")
        .select(
          "name, invite_code, status, round_categories, pick_order, current_pick_round, current_turn_user_id, pick_deadline",
        )
        .eq("id", gameId)
        .single();
      if (error) throw new Error(error.message);
      dispatch({
        type: "meta",
        payload: {
          id: gameId,
          name: data.name ?? state.meta.name,
          inviteCode: data.invite_code ?? state.meta.inviteCode,
          status: data.status ?? null,
          currentPickRound: data.current_pick_round ?? null,
          currentTurnUserId: data.current_turn_user_id ?? null,
          pickDeadline: data.pick_deadline ?? null,
          roundCategories:
            ((data.round_categories as GameRow["round_categories"]) ??
              []) as string[],
          pickOrder: ((data.pick_order as GameRow["pick_order"]) ??
            []) as string[],
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load game data";
      dispatch({ type: "error", payload: message });
    } finally {
      dispatch({ type: "loading", payload: false });
    }
  }, [gameId, state.meta.inviteCode, state.meta.name]);

  const refreshMembers = useCallback(async () => {
    dispatch({ type: "membersLoading", payload: true });
    dispatch({ type: "membersError", payload: null });
    try {
      const { data: memberRows, error: memberError } = await supabase
        .from("game_members")
        .select("user_id, joined_at")
        .eq("game_id", gameId)
        .order("joined_at", { ascending: true });
      if (memberError) throw new Error(memberError.message);
      const membersList: LobbyMember[] =
        memberRows?.map((row) => ({
          user_id: row.user_id,
          joined_at: row.joined_at,
        })) ?? [];
      if (membersList.length === 0) {
        dispatch({ type: "members", payload: [] });
        dispatch({ type: "membersLoading", payload: false });
        return;
      }
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .in(
          "id",
          membersList.map((row) => row.user_id),
        );
      if (profileError) throw new Error(profileError.message);
      const profileMap: Record<string, string> = {};
      profileRows?.forEach((profile) => {
        profileMap[profile.id] = profile.username;
      });
      dispatch({
        type: "members",
        payload: membersList.map((member) => ({
          ...member,
          username: profileMap[member.user_id],
        })),
      });
      dispatch({ type: "usernames", payload: profileMap });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load players";
      dispatch({ type: "members", payload: [] });
      dispatch({ type: "membersError", payload: message });
    } finally {
      dispatch({ type: "membersLoading", payload: false });
    }
  }, [gameId]);

  const refreshPicks = useCallback(async () => {
    dispatch({ type: "picksLoading", payload: true });
    try {
      const { data, error } = await supabase
        .from("game_picks")
        .select(
          "id, game_id, created_at, user_id, pick_round, symbol, is_double_down",
        )
        .eq("game_id", gameId)
        .order("pick_round", { ascending: true });
      if (error) throw new Error(error.message);
      const map: PickMap = {};
      data?.forEach((pick) => {
        const round = pick.pick_round ?? 0;
        if (!map[round]) map[round] = {};
        map[round][pick.user_id] = pick;
      });
      dispatch({ type: "picks", payload: map });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load picks";
      console.warn(message);
    } finally {
      dispatch({ type: "picksLoading", payload: false });
    }
  }, [gameId]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await Promise.all([refreshGame(), refreshMembers(), refreshPicks()]);
      if (!isMounted) return;
    })();
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
        () => {
          void refreshGame();
        },
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
        () => {
          void refreshMembers();
        },
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
        () => {
          void refreshPicks();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(gameChannel);
      void supabase.removeChannel(memberChannel);
      void supabase.removeChannel(picksChannel);
    };
  }, [gameId, refreshGame, refreshMembers, refreshPicks]);

  const startGame = useCallback(async () => {
    const { error } = await supabase.rpc("start_game", {
      game_id_to_start: gameId,
    });
    if (error) throw new Error(error.message);
    await refreshGame();
  }, [gameId, refreshGame]);

  const submitPick = useCallback(
    async (symbol: string, options?: { doubleDown?: boolean }) => {
      const { data, error } = await supabase.functions.invoke<MakePickResponse>(
        "make-pick",
        {
          body: {
            game_id: gameId,
            symbol,
            is_double_down: options?.doubleDown ?? false,
          },
        },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) {
        throw new Error(data?.error ?? "Failed to submit pick");
      }
      await Promise.all([refreshPicks(), refreshGame()]);
    },
    [gameId, refreshGame, refreshPicks],
  );

  const debugPickForUser = useCallback(
    async (
      userId: string,
      symbol: string,
      options?: { doubleDown?: boolean },
    ) => {
      const { error } = await supabase.rpc("debug_make_pick_for_user", {
        game_id_to_pick_in: gameId,
        user_id_to_pick: userId,
        symbol_to_pick: symbol,
        is_double_down: options?.doubleDown ?? false,
      });
      if (error) throw new Error(error.message);
      await Promise.all([refreshPicks(), refreshGame()]);
    },
    [gameId, refreshGame, refreshPicks],
  );

  const value: GameContextValue = {
    gameId,
    name: state.meta.name,
    inviteCode: state.meta.inviteCode,
    status: state.meta.status,
    currentPickRound: state.meta.currentPickRound,
    currentTurnUserId: state.meta.currentTurnUserId,
    pickDeadline: state.meta.pickDeadline,
    roundCategories: state.meta.roundCategories,
    pickOrder: state.meta.pickOrder,
    picks: state.picks.data,
    picksLoading: state.picks.loading,
    members: state.members.data,
    membersLoading: state.members.loading,
    membersError: state.members.error,
    usernames: state.usernames,
    gameLoading: state.loading,
    gameError: state.error,
    refreshGame,
    refreshMembers,
    refreshPicks,
    startGame,
    submitPick,
    debugPickForUser,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within a GameProvider");
  return ctx;
}
