import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { Database } from "../_shared/database.types.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ message: "Not a post req. method" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const supabaseAdmin = createClient<Database>(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Get all active games
    const { data: activeGames, error: gamesError } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("status", "ACTIVE");

    if (gamesError) throw gamesError;
    if (!activeGames || activeGames.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active games found." }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const activeGameIds = activeGames.map((g) => g.id);

    // 2. Get all unique symbols from picks in active games
    const { data: picksData, error: picksError } = await supabaseAdmin
      .from("game_picks")
      .select("symbol")
      .in("game_id", activeGameIds);

    if (picksError) throw picksError;

    const uniqueSymbols = [...new Set(picksData.map((p) => p.symbol))];
    if (uniqueSymbols.length === 0) {
      return new Response(
        JSON.stringify({ message: "No symbols found in active games." }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // 3. Fetch current prices AND day_change from 'symbols' table
    const { data: symbolsData, error: symbolsError } = await supabaseAdmin
      .from("symbols")
      .select("symbol, current_price, day_change")
      .in("symbol", uniqueSymbols)
      .not("current_price", "is", null);

    if (symbolsError) throw symbolsError;

    const priceCache = new Map<string, number>();
    const symbolDailyChangeMap = new Map<string, number>();
    for (const symbol of symbolsData) {
      priceCache.set(symbol.symbol, symbol.current_price!);
      if (typeof symbol.day_change === "number") {
        symbolDailyChangeMap.set(symbol.symbol, symbol.day_change);
      }
    }

    // 4. Batch update 'current_price' in game_picks
    const pickUpdatePromises = [];
    for (const [symbol, price] of priceCache.entries()) {
      pickUpdatePromises.push(
        supabaseAdmin
          .from("game_picks")
          .update({ current_price: price })
          .eq("symbol", symbol)
          .in("game_id", activeGameIds),
      );
    }
    await Promise.all(pickUpdatePromises);

    // 5. Fetch all picks (now with updated current_price)
    const { data: updatedPicks, error: updatedPicksError } = await supabaseAdmin
      .from("game_picks")
      // --- THIS IS THE FIX ---
      .select("game_id, user_id, start_price, current_price, symbol")
      // --- END FIX ---
      .in("game_id", activeGameIds);

    if (updatedPicksError) throw updatedPicksError;

    // 6. Calculate PNL for each member in memory
    const memberPnlMap = new Map<string, number>();
    const memberDailyPnlMap = new Map<string, number>();

    for (const pick of updatedPicks) {
      const key = `${pick.game_id}:${pick.user_id}`;

      // 1. Calculate Total PNL
      if (
        typeof pick.start_price === "number" &&
        typeof pick.current_price === "number"
      ) {
        const pickPnl = pick.current_price - pick.start_price;
        const currentPnl = memberPnlMap.get(key) || 0;
        memberPnlMap.set(key, currentPnl + pickPnl);
      }

      // 2. Calculate Daily PNL (this line will now work)
      const dailyChange = symbolDailyChangeMap.get(pick.symbol) || 0;
      const currentDailyPnl = memberDailyPnlMap.get(key) || 0;
      memberDailyPnlMap.set(key, currentDailyPnl + dailyChange);
    }

    // 7. Batch-update the 'pnl' in game_members
    const memberUpdates = Array.from(memberPnlMap.keys()).map((key) => {
      const [game_id, user_id] = key.split(":");
      return {
        game_id,
        user_id,
        pnl: memberPnlMap.get(key) || 0,
        pnl_daily_change: memberDailyPnlMap.get(key) || 0,
      };
    });

    if (memberUpdates.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("game_members")
        .upsert(memberUpdates, { onConflict: "game_id, user_id" });

      if (upsertError) throw upsertError;
    }

    return new Response(
      JSON.stringify({ message: "Portfolio calculations complete." }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Function failed:", error);
    return new Response(JSON.stringify({ error: error }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
