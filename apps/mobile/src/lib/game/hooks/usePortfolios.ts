import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../auth/supabase";
import type { Portfolio } from "../types";

type MemberWithGame = {
  joined_at: string;
  games: Portfolio | null;
};

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolios = useCallback(async () => {
    try {
      setError(null);
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) {
        setPortfolios([]);
        setError(userError.message);
        return;
      }
      const user = userData.user;
      if (!user) {
        setPortfolios([]);
        return;
      }
      const { data, error } = await supabase
        .from("game_members")
        .select(
          "joined_at, games ( id, name, status, invite_code, current_pick_round, start_time, end_time )",
        )
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .returns<MemberWithGame[]>();

      if (error) {
        setError(error.message);
        return;
      }

      const mapped =
        data
          ?.map((entry) =>
            entry.games ? { ...entry.games, joined_at: entry.joined_at } : null,
          )
          .filter((entry): entry is Portfolio => entry !== null) ?? [];

      setPortfolios(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
      setPortfolios([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await loadPortfolios();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadPortfolios]);

  const refreshPortfolios = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPortfolios();
    } finally {
      setRefreshing(false);
    }
  }, [loadPortfolios]);

  const watchedIds = useMemo(
    () =>
      Array.from(new Set(portfolios.map((portfolio) => portfolio.id))).sort(),
    [portfolios],
  );

  useEffect(() => {
    if (watchedIds.length === 0) return;
    const filterValues = watchedIds.map((id) => `'${id}'`).join(",");
    const channel = supabase
      .channel(`portfolio-games-${watchedIds.join("-")}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=in.(${filterValues})`,
        },
        () => {
          void loadPortfolios();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [watchedIds, loadPortfolios]);

  return {
    portfolios,
    loading,
    refreshing,
    error,
    refreshPortfolios,
    reloadPortfolios: loadPortfolios,
  };
}
