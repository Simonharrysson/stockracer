// supabase/functions/fetch-symbols/index.ts
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";

const CSV_SOURCE =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";
const FINNHUB_KEY = Deno.env.get("FINNHUB_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const JSON_HEADERS = { "content-type": "application/json" };
const DEFAULT_LIMIT = 2;
const RATE_LIMIT_DELAY_MS = 1_100;
const STATE_ROW_ID = 1;

type TickerSummary = {
  symbol: string;
  ticker: string;
  name: string;
  currency: string;
  exchange: string;
  logo: string;
  marketcap: number | null;
  description: string;
};

function extractTickers(csvText: string): string[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  // Skip the header row and keep the first column (Symbol) from each line.
  return lines.slice(1).map((line) => {
    const [symbol] = line.split(",");
    return symbol.replace(/"/g, "").trim();
  }).filter(Boolean);
}

async function fetchProfile(symbol: string) {
  if (!FINNHUB_KEY) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  const profileUrl =
    `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`;

  const response = await fetch(profileUrl);
  if (!response.ok) {
    throw new Error(`Finnhub returned status ${response.status}`);
  }

  return await response.json();
}

function formatTicker(
  symbol: string,
  profile: Record<string, unknown>,
): TickerSummary {
  const name =
    typeof profile.name === "string" && profile.name.trim().length > 0
      ? profile.name.trim()
      : symbol;
  const currency =
    typeof profile.currency === "string" && profile.currency.trim().length > 0
      ? profile.currency.trim()
      : "USD";
  const exchange = typeof profile.exchange === "string"
    ? profile.exchange.trim()
    : "";
  const logo = typeof profile.logo === "string" ? profile.logo.trim() : "";
  const marketcap = typeof profile.marketCapitalization === "number"
    ? profile.marketCapitalization
    : null;
  const description = typeof profile.finnhubIndustry === "string" &&
      profile.finnhubIndustry.trim().length > 0
    ? profile.finnhubIndustry.trim()
    : name;

  return {
    symbol,
    ticker: typeof profile.ticker === "string" ? profile.ticker.trim() : symbol,
    name,
    currency,
    exchange,
    logo,
    marketcap,
    description,
  };
}

function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing; cannot save to database",
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function fetchRefreshOffset(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("symbol_refresh_state")
    .select("next_offset")
    .eq("id", STATE_ROW_ID)
    .maybeSingle();
  console.log("Fetched refresh state:", { data, error });
  if (error) throw new Error(`read symbol_refresh_state: ${error.message}`);
  return Math.max(0, Math.floor((data?.next_offset ?? 0) as number));
}

async function updateRefreshState(
  supabase: SupabaseClient,
  next_offset?: number,
  last_error?: string | null,
) {
  console.log("Updating refresh state with:", { next_offset, last_error });
  const { error } = await supabase.from("symbol_refresh_state").upsert({
    id: STATE_ROW_ID,
    next_offset: Math.max(0, Math.floor(next_offset ?? 0)),
    last_run: new Date().toISOString(),
    last_error,
  });
  if (error) console.error("update symbol_refresh_state:", error.message);
}

async function saveTicker(
  supabase: SupabaseClient,
  summary: TickerSummary,
) {
  const { error } = await supabase.from("symbols").upsert(
    {
      symbol: summary.symbol,
      company_name: summary.name,
      currency: summary.currency,
      description: summary.description,
      exchange: summary.exchange,
      logo: summary.logo,
      marketCapitalization: summary.marketcap,
    },
    { onConflict: "symbol" },
  );

  if (error) {
    throw new Error(`Failed to save ticker to symbols table: ${error.message}`);
  }
}

Deno.serve(async (request) => {
  try {
    const response = await fetch(CSV_SOURCE);
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Unable to fetch S&P 500 CSV",
          status: response.status,
        }),
        { status: response.status, headers: JSON_HEADERS },
      );
    }

    const csvText = await response.text();
    const tickers = extractTickers(csvText);

    if (tickers.length === 0) {
      throw new Error("No tickers found in S&P 500 CSV");
    }

    const supabase = getSupabaseClient();
    const params = new URL(request.url).searchParams;

    const qpOff = Number(params.get("offset"));
    const qpLim = Number(params.get("limit"));

    const manualOffset = qpOff >= 0 ? Math.floor(qpOff) : 0;

    const shouldPersistOffset = manualOffset === 0;

    console.log(
      "manualOffset:",
      manualOffset,
      "shouldPersistOffset:",
      shouldPersistOffset,
    );

    const requestedLimit = qpLim > 1 ? Math.floor(qpLim) : DEFAULT_LIMIT;

    const currentOffset = shouldPersistOffset
      ? await fetchRefreshOffset(supabase)
      : manualOffset;

    console.log("Current offset:", currentOffset);

    const maxAvailable = Math.max(tickers.length - currentOffset, 0);

    if (maxAvailable === 0) {
      if (shouldPersistOffset) await updateRefreshState(supabase, 0, null);
      return new Response(
        JSON.stringify({
          ok: true,
          processed: [],
          count: tickers.length,
          offset: currentOffset,
          limit: 0,
          next_offset: shouldPersistOffset ? 0 : currentOffset,
          message: "Offset beyond ticker list; nothing to process.",
        }),
        { status: 200, headers: JSON_HEADERS },
      );
    }

    const limit = Math.max(
      1,
      Math.min(requestedLimit, maxAvailable),
    );

    console.log("Requested limit:", requestedLimit, "Effective limit:", limit);

    const slice = tickers.slice(currentOffset, currentOffset + limit);
    const processed: string[] = [];

    for (const symbol of slice) {
      const ticker = symbol.trim();

      const tickerjson = await fetchProfile(ticker);
      const summary = formatTicker(ticker, tickerjson);
      await saveTicker(supabase, summary);
      console.log(`Processed ticker: ${ticker}`);
      // finnhub rate limit: 60 requests per minute
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      processed.push(ticker);
    }

    console.log(
      `Processed ${processed.length} tickers (offset ${currentOffset}, limit ${limit}).`,
    );

    if (shouldPersistOffset) {
      const nextOffset = (currentOffset + processed.length) % tickers.length;
      await updateRefreshState(supabase, nextOffset, null);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        count: tickers.length,
        offset: currentOffset,
        limit,
        next_offset: shouldPersistOffset
          ? (currentOffset + processed.length) % tickers.length
          : currentOffset,
      }),
      { status: 200, headers: JSON_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = getSupabaseClient();
        await updateRefreshState(supabase, undefined, message);
      } catch (_) { /* ignore */ }
    }
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
