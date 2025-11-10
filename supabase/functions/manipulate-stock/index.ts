// supabase/functions/trade/index.ts
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../../../database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type Payload = {
  symbol: string;
  side: Database["public"]["Enums"]["trade_side"];
  quantity: number;
  price: number;
  executed_at?: string;
};

export interface FunctionResponse {
  success: boolean;
  data?: {
    tickers: string[];
    total_worth: number;
    total_invested: number;
    unrealized_pnl: number;
    total_change_pct: number;
    last_change_pct: number;
    position_count: number;
  };
  error?: string;
}

// ---- Dependency injection (unchanged) ----
type Deps = {
  userClient: (authHeader: string) => SupabaseClient<Database>;
  adminClient: () => SupabaseClient<Database>;
};

const realDeps: Deps = {
  userClient: (auth) =>
    createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    }),
  adminClient: () => createClient<Database>(SUPABASE_URL, SERVICE_ROLE),
};

// ---- NEW, FASTER HANDLER LOGIC ----
function makeHandler(deps: Deps) {
  return async (req: Request): Promise<FunctionResponse> => {
    try {
      // 1. --- Auth and Payload Validation (unchanged from your file) ---
      if (req.method !== "POST") {
        return { success: false, error: "Only POST requests are allowed." };
      }

      const auth = req.headers.get("authorization") ??
        req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) {
        return {
          success: false,
          error: "Missing or invalid Authorization header.",
        };
      }
      console.log("Received request with authorization.");

      const body = (await req.json()) as Payload;
      const symbol = body?.symbol?.trim()?.toUpperCase();
      const side = body?.side;
      const qty = Number(body?.quantity);
      const price = Number(body?.price);

      if (
        !symbol || (side !== "BUY" && side !== "SELL") || !qty || qty <= 0 ||
        isNaN(price) || price < 0
      ) {
        console.error("Invalid payload:", body);
        return { success: false, error: "Invalid payload" };
      }

      console.log(`Processing trade: ${side} ${qty} ${symbol} @ ${price}...`);

      const userClient = deps.userClient(auth);
      const { data: userRes, error: uerr } = await userClient.auth.getUser();
      if (uerr || !userRes?.user) {
        console.error("Unauthorized access attempt.");
        return { success: false, error: "Unauthorized access" };
      }
      const user_id = userRes.user.id;

      // 2. --- Fetch Current Position (NEW FAST LOGIC) ---
      // Instead of scanning all transactions, we fetch one row from 'positions'.
      const { data: currentPos, error: posErr } = await userClient
        .from("positions")
        .select("quantity, average_cost")
        .eq("user_id", user_id)
        .eq("symbol", symbol)
        .single();

      // if (posErr && posErr.code !== "PGRST116") { // PGRST116 = no rows found
      //   return {
      //     success: false,
      //     error: "Failed to fetch current position: " + posErr.message,
      //   };
      // }

      // Initialize position if it doesn't exist
      const pos = currentPos
        ? {
          quantity: Number(currentPos.quantity),
          average_cost: Number(currentPos.average_cost),
        }
        : { quantity: 0, average_cost: 0 };

      // 3. --- Validate Trade (The Bug Fix) ---
      // We check *before* inserting the transaction.
      if (side === "SELL" && qty > pos.quantity) {
        console.error(
          `Insufficient shares for ${symbol}: trying ${qty}, have ${pos.quantity}`,
        );
        return {
          success: false,
          error:
            `Insufficient shares to sell for ${symbol}: trying to sell ${qty}, but only have ${pos.quantity}`,
        };
      }

      // 4. --- Insert Transaction (Log) ---
      // Validation passed, so we log the trade.
      console.log("Validation passed. Recording new transaction...");
      const { error: insErr } = await userClient.from("transactions").insert({
        user_id,
        symbol,
        side,
        quantity: qty,
        price,
        executed_at: body.executed_at ?? new Date().toISOString(),
      });
      if (insErr) {
        return {
          success: false,
          error: "Failed to record transaction: " + insErr.message,
        };
      }

      // 5. --- Recalculate and Upsert Position (The Core Logic) ---
      let newQty = pos.quantity;
      let newAvgCost = pos.average_cost;

      if (side === "BUY") {
        // Calculate the new total cost and divide by the new total quantity
        const newCost = (pos.average_cost * pos.quantity) + (price * qty);
        newQty += qty;
        newAvgCost = newQty > 0 ? newCost / newQty : 0;
      } else { // SELL
        newQty -= qty;
        if (newQty === 0) {
          newAvgCost = 0; // Reset cost basis if position is closed
        }
        // Note: Average cost does not change on a sale, so we don't recalculate it.
      }

      const { error: upErr } = await userClient
        .from("positions")
        .upsert({
          user_id,
          symbol,
          quantity: newQty,
          average_cost: newAvgCost,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id, symbol" }); // Use the constraint we created

      if (upErr) {
        return {
          success: false,
          error: "Failed to update position: " + upErr.message,
        };
      }

      // 6. --- Fetch Final Summary from VIEW (Simple) ---
      // The VIEW automatically calculates total_worth, pnl, etc.
      console.log(
        `Position updated. Fetching live portfolio for ${user_id}...`,
      );
      const { data: portfolioData, error: portfolioErr } = await userClient
        .from("portfolios") // This is now the VIEW
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (portfolioErr && portfolioErr.code !== "PGRST116") {
        // Handle errors, but ignore "no rows found"
        return {
          success: false,
          error: "Failed to read back portfolio: " + portfolioErr.message,
        };
      }

      // If the user sold their last position, the view might return no rows.
      // We should return 0s in that case.
      const resultData = portfolioData ?? {
        tickers: [],
        total_worth: 0,
        total_invested: 0,
        unrealized_pnl: 0,
        total_change_pct: 0,
        last_change_pct: 0,
        position_count: 0,
      };

      return {
        success: true,
        data: resultData as FunctionResponse["data"],
      };
    } catch (e: unknown) {
      console.error("Internal server error:", e);
      return { success: false, error: "Internal server error: " + String(e) };
    }
  };
}

// ---- Deno Serve (unchanged) ----
const handler = makeHandler(realDeps);
if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    const result = await handler(req);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200, // Always 200, error is in the JSON body
    });
  });
}
export { makeHandler };

// These helper functions are no longer needed
// function handleError(...) {}
// function handleUpdateHoldings(...) {}
