// supabase/functions/update-portfolio-value/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../../../database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create a new admin client to bypass RLS
const adminClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (_) => {
  try {
    console.log("Starting daily history snapshot job...");

    // We use 'yesterday's' date because 'prev_close' refers to the
    // closing price of the previous market day.
    const snapshotDate = new Date();
    snapshotDate.setUTCDate(snapshotDate.getUTCDate() - 1);
    const dateString = snapshotDate.toISOString().split("T")[0];

    console.log(`Calculating snapshots for date: ${dateString}`);

    // 1. Fetch all symbols and their closing prices.
    const { data: symbols, error: symbolErr } = await adminClient
      .from("symbols")
      .select("symbol, prev_close");

    if (symbolErr) {
      throw new Error(`Failed to fetch symbols: ${symbolErr.message}`);
    }

    // Create a simple map for fast price lookups
    const priceMap = new Map<string, number>(
      symbols.map((s) => [s.symbol, Number(s.prev_close ?? 0)]),
    );

    // 2. Get all current positions for all users.
    const { data: positions, error: posErr } = await adminClient
      .from("positions")
      .select("user_id, symbol, quantity, average_cost")
      .gt("quantity", 0); // Only get positions they actually own

    if (posErr) {
      throw new Error(`Failed to fetch positions: ${posErr.message}`);
    }

    // 3. Process the data and aggregate by user
    type UserStats = {
      total_worth: number;
      total_invested: number;
    };
    const historyMap = new Map<string, UserStats>();

    for (const pos of positions) {
      // Use the closing price from our map
      const closingPrice = priceMap.get(pos.symbol) ?? 0;
      const quantity = Number(pos.quantity);
      const avgCost = Number(pos.average_cost);

      // Get or initialize the stats for this user
      const stats = historyMap.get(pos.user_id) ?? {
        total_worth: 0,
        total_invested: 0,
      };

      // Add this position's value to the user's total
      stats.total_worth += quantity * closingPrice;
      stats.total_invested += quantity * avgCost;

      historyMap.set(pos.user_id, stats);
    }

    // 4. Batch insert into 'investment_history'
    if (historyMap.size === 0) {
      console.log("No active positions found. Job complete.");
      return new Response("No active positions to snapshot.", { status: 200 });
    }

    const historyToInsert = [];
    for (const [userId, stats] of historyMap.entries()) {
      historyToInsert.push({
        user_id: userId,
        snapshot_date: dateString,
        total_worth: stats.total_worth,
        total_invested: stats.total_invested,
        unrealized_pnl: stats.total_worth - stats.total_invested,
      });
    }

    console.log(`Inserting ${historyToInsert.length} history snapshots...`);

    // Use upsert to be safe. If the job runs twice, it won't create duplicates.
    const { error: insertError } = await adminClient
      .from("investment_history")
      .upsert(historyToInsert, { onConflict: "user_id, snapshot_date" });

    if (insertError) {
      throw new Error(`Failed to insert history: ${insertError.message}`);
    }

    console.log("Successfully inserted snapshots. Job complete.");
    return new Response("OK", { status: 200 });
  } catch (e: unknown) {
    console.error("Cron job failed: " + String(e));
    return new Response("Internal Server Error: " + String(e), { status: 500 });
  }
});
