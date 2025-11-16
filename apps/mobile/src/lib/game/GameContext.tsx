import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import type { GameRow, GameState, LobbyMember, PickMap } from "./types";
import {
  fetchGameMeta,
  fetchLobbyMembers,
  fetchGamePicks,
  subscribeToGameChannels,
  startGameRpc,
  invokeMakePick,
  invokeDebugPickForUser,
} from "./data";

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
  submitPick: (symbol: string) => Promise<void>;
  debugPickForUser: (userId: string, symbol: string) => Promise<void>;
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
      const data = await fetchGameMeta(gameId);
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
      const { members: membersList, usernames: profileMap } =
        await fetchLobbyMembers(gameId);
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
      const map = await fetchGamePicks(gameId);
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
    const unsubscribe = subscribeToGameChannels(gameId, {
      onGameChange: () => {
        void refreshGame();
      },
      onMemberChange: () => {
        void refreshMembers();
      },
      onPickChange: () => {
        void refreshPicks();
      },
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [gameId, refreshGame, refreshMembers, refreshPicks]);

  const startGame = useCallback(async () => {
    await startGameRpc(gameId);
    await refreshGame();
  }, [gameId, refreshGame]);

  const submitPick = useCallback(
    async (symbol: string) => {
      await invokeMakePick(gameId, symbol);
      await Promise.all([refreshPicks(), refreshGame()]);
    },
    [gameId, refreshGame, refreshPicks],
  );

  const debugPickForUser = useCallback(
    async (userId: string, symbol: string) => {
      await invokeDebugPickForUser(gameId, userId, symbol);
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
