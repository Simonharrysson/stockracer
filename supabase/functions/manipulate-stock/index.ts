// supabase/functions/trade/index.ts
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../../../database.types.ts";
import { PostgrestError } from "https://esm.sh/@supabase/postgrest-js@1.15.8/dist/cjs/types.js";

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

type Holding = { qty: number; cost: number };

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

// ---- Dependency injection för tester ----
type Deps = {
  userClient: (authHeader: string) => SupabaseClient<Database>;
  adminClient: () => SupabaseClient<Database>;
};

// Produktion: riktiga klienter
const realDeps: Deps = {
  userClient: (auth) =>
    createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    }),
  adminClient: () => createClient<Database>(SUPABASE_URL, SERVICE_ROLE),
};

// Gör handler testbar
function makeHandler(deps: Deps) {
  return async (req: Request): Promise<FunctionResponse> => {
    try {
      if (req.method !== "POST") {
        const errorBody: FunctionResponse = {
          success: false,
          error: "Only POST requests are allowed.",
        };
        return errorBody;
      }

      const auth = req.headers.get("authorization") ??
        req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) {
        const errorBody: FunctionResponse = {
          success: false,
          error: "Missing or invalid Authorization header.",
        };
        return errorBody;
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
        const errorBody: FunctionResponse = {
          success: false,
          error: "Invalid payload",
        };
        return errorBody;
      }

      console.log(`Processing trade: ${side} ${qty} ${symbol} @ ${price}...`);

      const userClient = deps.userClient(auth);

      const { data: userRes, error: uerr } = await userClient.auth.getUser();
      if (uerr || !userRes?.user) {
        console.error("Unauthorized access attempt.");
        const errorBody: FunctionResponse = {
          success: false,
          error: "Unauthorized access",
        };
        return errorBody;
      }
      const user_id = userRes.user.id;

      type Holding = { qty: number; cost: number };
      const holdings = new Map<string, Holding>();

      // Build current holdings from existing transactions.
      const { data: txs, error: txErr } = await userClient
        .from("transactions")
        .select("symbol, side, quantity, price, executed_at")
        .eq("user_id", user_id)
        .order("executed_at", { ascending: true });

      if (txErr) {
        const errorBody: FunctionResponse = {
          success: false,
          error: "Failed to fetch transactions for validation: " +
            txErr.message,
        };
        return errorBody;
      }

      // 1. If we are selling shares, exit early if we don't have enough shares
      if (side === "SELL") {
        // If we can't find any transactions for this symbol, we can't be selling it
        if (
          !txs ||
          !txs.find((t) =>
            String(t.symbol).toUpperCase() === symbol.toUpperCase()
          )
        ) {
          const errorBody: FunctionResponse = {
            success: false,
            error:
              `Insufficient shares to sell for ${symbol}: trying to sell ${qty}, but have 0`,
          };

          return errorBody;
        }
      }

      // 2. Calculate current holdings from existing transactions.
      handleUpdateHoldings(txs, holdings);

      // 3. VALIDATE the new trade against the current holdings.
      if (side === "SELL") {
        const currentHolding = holdings.get(symbol) ?? { qty: 0, cost: 0 };
        if (qty > currentHolding.qty) {
          console.error(
            `Insufficient shares for ${symbol}: trying ${qty}, have ${currentHolding.qty}`,
          );
          const errorBody: FunctionResponse = {
            success: false,
            error:
              `Insufficient shares to sell for ${symbol}: trying to sell ${qty}, but only have ${currentHolding.qty}`,
          };
          return errorBody;
        }
      }

      // 4. If validation passed, NOW insert the new transaction.
      const { error: insErr } = await userClient.from("transactions").insert({
        user_id,
        symbol,
        side,
        quantity: qty,
        price,
        executed_at: body.executed_at ?? new Date().toISOString(),
      });
      if (insErr) {
        return handleError(insErr);
      }

      // 5. Update the in-memory 'holdings' map with the new, valid trade.
      const holding = holdings.get(symbol) ?? { qty: 0, cost: 0 };
      if (side === "BUY") {
        holding.qty += qty;
        holding.cost += qty * price; // Corrected logic
      } else {
        // We already know this is safe from step 3.
        holding.qty -= qty;
        holding.cost -= qty * price;
      }
      holdings.set(symbol, holding);
      console.log("after", holdings);

      // The rest of the logic continues from here, using the updated 'holdings' map.
      const openSymbols = [...holdings.entries()]
        .filter(([, v]) => v.qty > 0)
        .map(([s]) => s);

      let totalWorth = 0;
      let yesterdayWorth = 0;
      let totalInvested = 0;

      if (openSymbols.length > 0) {
        const { data: quotes, error: qErr } = await userClient
          .from("symbols")
          .select("symbol, current_price, prev_close")
          .in("symbol", openSymbols);
        if (qErr) {
          return handleError(qErr);
        }

        const qMap = new Map(
          (quotes ?? []).map((r) => [String(r.symbol).toUpperCase(), r]),
        );

        for (const s of openSymbols) {
          const holding = holdings.get(s)!;
          const quote = qMap.get(s);

          if (!quote?.current_price || !quote?.prev_close) {
            return handleError(
              new Error("Missing current price or prev_close for " + s),
            );
          }

          const current_price = quote.current_price;
          const prev_close = quote.prev_close;

          totalWorth += holding.qty * current_price;
          yesterdayWorth += holding.qty * prev_close;
          totalInvested += holding.cost;
        }
      }

      const unrealized = totalWorth - totalInvested;

      if (totalInvested < 0) {
        return handleError(new Error("Negative investet amount"));
      }

      const totalChangePct = totalInvested > 0
        ? (totalWorth - totalInvested) / totalInvested
        : 0;

      const lastChangePct = yesterdayWorth > 0
        ? (totalWorth - yesterdayWorth) / yesterdayWorth
        : 0;

      console.log(
        "totalChangePct: ",
        totalChangePct,
        "lastChangePct: ",
        lastChangePct,
      );

      const { error: upErr } = await userClient.from("portfolios").upsert({
        user_id,
        tickers: openSymbols,
        total_worth: Number(totalWorth.toFixed(6)),
        total_invested: Number(totalInvested.toFixed(6)),
        unrealized_pnl: Number(unrealized.toFixed(6)),
        total_change_pct: Number(totalChangePct.toFixed(6)),
        last_change_pct: Number(lastChangePct.toFixed(6)),
        position_count: openSymbols.length,
        last_trade_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (upErr) {
        return handleError(upErr);
      }

      console.log(`Portfolio updated successfully for user ${user_id}`);

      return {
        success: true,
        error: undefined,
        data: {
          tickers: openSymbols,
          total_worth: totalWorth,
          total_invested: totalInvested,
          unrealized_pnl: unrealized,
          total_change_pct: totalChangePct,
          last_change_pct: lastChangePct,
          position_count: openSymbols.length,
        },
      };
    } catch (e: unknown) {
      const errorBody: FunctionResponse = {
        success: false,
        error: "Internal server error: " + String(e),
      };
      return errorBody;
    }
  };
}

const handler = makeHandler(realDeps);
if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    const result = await handler(req);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  });
}
export { makeHandler };

function handleError(Err: PostgrestError | Error) {
  const errorBody: FunctionResponse = {
    success: false,
    error: "Failed with error message: " + Err.message,
  };
  return errorBody;
}

function handleUpdateHoldings(
  txs: Payload[],
  holdings: Map<string, { qty: number; cost: number }>,
) {
  for (const t of txs ?? []) {
    const symbol = String(t.symbol).toUpperCase();
    const quantity = Number(t.quantity);
    const price = Number(t.price);
    const holding = holdings.get(symbol) ?? { qty: 0, cost: 0 };
    console.log(t);
    if (t.side === "BUY") {
      holding.qty += quantity;
      // This is the corrected cost logic
      holding.cost += quantity * price;
    } else if (t.side === "SELL") {
      // Get average cost *before* changing quantity

      holding.qty -= quantity;

      // New cost is the new quantity * the old average cost
      holding.cost -= quantity * price;
    }
    holdings.set(symbol, holding);
  }
  console.log("before:", holdings);
}
