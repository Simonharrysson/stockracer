import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import type { Database } from "../../../../../supabase/functions/_shared/database.types";
import { supabase } from "../../auth/supabase";

type GameRow = Database["public"]["Tables"]["games"]["Row"];

type NavigateOptions = {
  statusHint?: GameRow["status"];
  lobbyMeta?: { name?: string; inviteCode?: string };
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useNavigateToGame() {
  const navigation = useNavigation<Nav>();

  return useCallback(
    async (gameId: string, options?: NavigateOptions) => {
      const { statusHint, lobbyMeta } = options ?? {};
      let status = statusHint;
      if (!status) {
        try {
          const { data, error } = await supabase
            .from("games")
            .select("status")
            .eq("id", gameId)
            .single();
          if (!error) {
            status = data?.status as GameRow["status"] | undefined;
          }
        } catch (err) {
          console.warn(
            "Failed to fetch game status",
            err instanceof Error ? err.message : err,
          );
        }
      }

      if (status === "DRAFTING") {
        navigation.navigate("Draft", { gameId });
        return;
      }

      if (status === "ACTIVE") {
        navigation.navigate("Leaderboard", { gameId });
        return;
      }

      navigation.navigate("Lobby", {
        gameId,
        name: lobbyMeta?.name ?? "Lobby",
        inviteCode: lobbyMeta?.inviteCode,
      });
    },
    [navigation],
  );
}
