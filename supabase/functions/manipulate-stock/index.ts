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

      const { error: insErr } = await userClient.from("transactions").insert({
        user_id,
        symbol,
        side,
        quantity: qty,
        price,
        executed_at: body.executed_at ?? new Date().toISOString(),
      });
      if (insErr) {
        const errorBody: FunctionResponse = {
          success: false,
          error: "Failed to record transaction: " + insErr.message,
        };
        return errorBody;
      }

      // const admin = deps.adminClient();
      console.log(`Recalculating portfolio for user ${user_id}...`);
      const { data: txs, error: txErr } = await userClient
        .from("transactions")
        .select("symbol, side, quantity, price, executed_at")
        .eq("user_id", user_id)
        .order("executed_at", { ascending: true });

      if (txErr) {
        const errorBody: FunctionResponse = {
          success: false,
          error: "Failed to fetch transactions: " + txErr.message,
        };
        return errorBody;
      }

      type Lot = { qty: number; cost: number };
      const lots = new Map<string, Lot>();

      for (const t of txs ?? []) {
        const s = String(t.symbol).toUpperCase();
        const q = Number(t.quantity);
        const p = Number(t.price);
        const lot = lots.get(s) ?? { qty: 0, cost: 0 };

        if (t.side === "BUY") {
          lot.qty += q;
          lot.cost += q * p;
        } else {
          if (q > lot.qty) {
            const errorBody: FunctionResponse = {
              success: false,
              error:
                `Insufficient shares to sell for ${s}: trying to sell ${q}, but only have ${lot.qty}`,
            };
            return errorBody;
          }
          const avg = lot.qty > 0 ? lot.cost / lot.qty : 0;
          lot.qty -= q;
          lot.cost = avg * lot.qty;
        }
        lots.set(s, lot);
      }

      const openSymbols = [...lots.entries()]
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
          const errorBody: FunctionResponse = {
            success: false,
            error: "Failed to fetch quotes: " + qErr.message,
          };
          return errorBody;
        }

        const qMap = new Map(
          (quotes ?? []).map((r) => [String(r.symbol).toUpperCase(), r]),
        );

        for (const s of openSymbols) {
          const lot = lots.get(s)!;
          const q = qMap.get(s);
          const cp = Number(
            q?.current_price ??
              (lot.cost > 0 && lot.qty > 0 ? lot.cost / lot.qty : 0),
          );
          const pc = Number(q?.prev_close ?? cp);

          totalWorth += lot.qty * cp;
          yesterdayWorth += lot.qty * pc;
          totalInvested += lot.cost;
        }
      }

      const unrealized = totalWorth - totalInvested;
      const totalChangePct = totalInvested > 0
        ? (totalWorth - totalInvested) / totalInvested
        : 0;
      const lastChangePct = yesterdayWorth > 0
        ? (totalWorth - yesterdayWorth) / yesterdayWorth
        : 0;

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
        const errorBody: FunctionResponse = {
          success: false,
          error: "Failed to update portfolio: " + upErr.message,
        };
        return errorBody;
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
