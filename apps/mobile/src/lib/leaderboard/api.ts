import { supabase } from "../auth/supabase";

export type SymbolInsight = {
  symbol: string;
  companyName: string;
  logo?: string | null;
  marketCap?: number | null;
  price?: number | null;
};

export async function fetchSymbolInsights(
  symbols: string[],
): Promise<SymbolInsight[]> {
  const uniqueSymbols = Array.from(
    new Set(symbols.filter((symbol) => !!symbol?.trim())),
  );
  if (uniqueSymbols.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("symbols")
    .select("symbol, company_name, logo, marketCapitalization, current_price")
    .in("symbol", uniqueSymbols);

  if (error) {
    throw new Error(error.message);
  }

  const details = new Map((data ?? []).map((row) => [row.symbol, row]));

  return uniqueSymbols.map((symbol) => {
    const row = details.get(symbol);
    return {
      symbol,
      companyName: row?.company_name ?? symbol,
      logo: row?.logo ?? null,
      marketCap: row?.marketCapitalization ?? null,
      price: row?.current_price ?? null,
    };
  });
}
