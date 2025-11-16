import type { Database } from "../../../../../supabase/functions/_shared/database.types";

export type GameRow = Database["public"]["Tables"]["games"]["Row"];

export type GamePreview = Pick<
  GameRow,
  | "id"
  | "name"
  | "status"
  | "invite_code"
  | "current_pick_round"
  | "start_time"
  | "end_time"
>;

export type Portfolio = GamePreview & { joined_at: string };

export type LobbyMember = {
  user_id: string;
  username?: string | null;
  joined_at?: string;
};

export type GamePickRow =
  Database["public"]["Tables"]["game_picks"]["Row"];

export type PickMap = Record<number, Record<string, GamePickRow>>;

export type GameState = {
  meta: {
    id: string;
    name: string;
    inviteCode?: string;
    status: GameRow["status"] | null;
    currentPickRound: number | null;
    currentTurnUserId: string | null;
    pickDeadline?: string | null;
    roundCategories: string[];
    pickOrder: string[];
  };
  members: {
    data: LobbyMember[];
    loading: boolean;
    error: string | null;
  };
  picks: {
    data: PickMap;
    loading: boolean;
  };
  usernames: Record<string, string>;
  loading: boolean;
  error: string | null;
};
