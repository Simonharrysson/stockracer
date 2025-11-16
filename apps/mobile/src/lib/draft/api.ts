import { supabase } from "../auth/supabase";

export type RoundOption = {
  symbol: string;
  name: string;
  price?: number | null;
};

export async function fetchRoundOptions(
  gameId: string,
  round: number,
): Promise<RoundOption[]> {
  const { data: poolRows, error: poolError } = await supabase
    .from("game_round_pools")
    .select("symbol")
    .eq("game_id", gameId)
    .eq("pick_round", round);
  if (poolError) throw new Error(poolError.message);

  const symbols = poolRows?.map((row) => row.symbol) ?? [];
  if (symbols.length === 0) return [];

  const { data: symbolRows, error: symbolError } = await supabase
    .from("symbols")
    .select("symbol, company_name, current_price")
    .in("symbol", symbols);
  if (symbolError) throw new Error(symbolError.message);

  const details = new Map(symbolRows?.map((row) => [row.symbol, row]) ?? []);
  return symbols.map((symbol) => {
    const info = details.get(symbol);
    return {
      symbol,
      name: info?.company_name ?? symbol,
      price: info?.current_price ?? null,
    };
  });
}
