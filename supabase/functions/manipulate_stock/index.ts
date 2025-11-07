// Supabase Edge Function (Deno)
// Inserts a BUY/SELL under RLS with the caller's JWT.
// Then recomputes the user's portfolio using service role.
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../../../database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Payload = {
  symbol: string; // e.g. "AMZN"
  side: "BUY" | "SELL";
  quantity: number; // > 0
  price: number; // >= 0
  executed_at?: string; // ISO optional
};

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") {
      return new Response("Only POST", { status: 405 });
    }

    const auth = req.headers.get("authorization") ??
      req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response("Missing Bearer token", { status: 401 });
    }

    const body = (await req.json()) as Payload;
    const symbol = body?.symbol?.trim()?.toUpperCase();
    const side = body?.side;
    const qty = Number(body?.quantity);
    const price = Number(body?.price);
    if (
      !symbol || (side !== "BUY" && side !== "SELL") || !qty || qty <= 0 ||
      isNaN(price) || price < 0
    ) {
      return new Response("Invalid payload", { status: 400 });
    }

    // User-scoped client: insert the transaction under RLS
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userRes, error: uerr } = await userClient.auth.getUser();
    if (uerr || !userRes?.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const user_id = userRes.user.id;

    const { error: insErr } = await userClient
      .from("transactions")
      .insert({
        user_id,
        symbol,
        side,
        quantity: qty,
        price,
        executed_at: body.executed_at ?? new Date().toISOString(),
      });
    if (insErr) {
      return new Response(`Insert failed: ${insErr.message}`, { status: 400 });
    }

    // Admin client: recompute portfolio
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Pull all transactions for this user, oldest first
    const { data: txs, error: txErr } = await admin
      .from("transactions")
      .select("symbol, side, quantity, price, executed_at")
      .eq("user_id", user_id)
      .order("executed_at", { ascending: true });
    if (txErr) throw txErr;

    // Build open positions with average-cost accounting
    type Lot = { qty: number; cost: number }; // cost is total basis for remaining qty
    const lots = new Map<string, Lot>();

    for (
      const t of (txs as
        | Array<
          Pick<
            Database["public"]["Tables"]["transactions"]["Row"],
            "symbol" | "side" | "quantity" | "price" | "executed_at"
          >
        >
        | null) ?? []
    ) {
      if (!t) continue;
      const s = String(t.symbol).toUpperCase();
      const q = Number(t.quantity);
      const p = Number(t.price);
      const lot = lots.get(s) ?? { qty: 0, cost: 0 };

      if (t.side === "BUY") {
        lot.qty += q;
        lot.cost += q * p; // grow basis
      } else {
        if (q > lot.qty) {
          return new Response("Sell exceeds position", { status: 400 });
        }
        const avg = lot.qty > 0 ? lot.cost / lot.qty : 0;
        lot.qty -= q;
        lot.cost = avg * lot.qty; // keep basis for remainder
      }
      lots.set(s, lot);
    }

    // Symbols that remain open
    const openSymbols = [...lots.entries()].filter(([, v]) => v.qty > 0).map((
      [s],
    ) => s);

    // Pull current and yesterday prices from your symbols table
    let totalWorth = 0;
    let yesterdayWorth = 0;
    let totalInvested = 0;

    if (openSymbols.length > 0) {
      const { data: quotes, error: qErr } = await admin
        .from("symbols")
        .select("symbol, current_price, prev_close")
        .in("symbol", openSymbols);
      if (qErr) throw qErr;

      const qMap = new Map<
        string,
        Pick<
          Database["public"]["Tables"]["symbols"]["Row"],
          "symbol" | "current_price" | "prev_close"
        >
      >(
        (quotes as
          | Array<
            Pick<
              Database["public"]["Tables"]["symbols"]["Row"],
              "symbol" | "current_price" | "prev_close"
            >
          >
          | null)
          ?.map((r) => [String(r.symbol).toUpperCase(), r]) ?? [],
      );

      for (const s of openSymbols) {
        const lot = lots.get(s)!;
        const q = qMap.get(s);
        // Fallback to average cost if no live quote
        const cp = Number(
          q?.current_price ??
            (lot.cost > 0 && lot.qty > 0 ? lot.cost / lot.qty : 0),
        );
        const pc = Number(q?.prev_close ?? cp);

        totalWorth += lot.qty * cp;
        yesterdayWorth += lot.qty * pc;
        totalInvested += lot.cost; // basis of remaining
      }
    }

    const unrealized = totalWorth - totalInvested;
    const totalChangePct = totalInvested > 0
      ? (totalWorth - totalInvested) / totalInvested
      : 0;
    const lastChangePct = yesterdayWorth > 0
      ? (totalWorth - yesterdayWorth) / yesterdayWorth
      : 0;

    // Upsert portfolio row
    const { error: upErr } = await admin
      .from("portfolios")
      .upsert({
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
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        ok: true,
        portfolio: {
          tickers: openSymbols,
          total_worth: totalWorth,
          total_invested: totalInvested,
          unrealized_pnl: unrealized,
          total_change_pct: totalChangePct,
          last_change_pct: lastChangePct,
          position_count: openSymbols.length,
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(`Error: ${message}`, { status: 500 });
  }
});
