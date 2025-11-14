// supabase/functions/make-pick/index.ts
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../_shared/database.types.ts";

// --- Types & Environment ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// We don't need SERVICE_ROLE here, as the RPC runs as the user

type MakePickPayload = {
  game_id: string;
  symbol: string;
  is_double_down?: boolean;
};

export interface FunctionResponse {
  success: boolean;
  error?: string;
}

// --- Dependency Injection ---
type Deps = {
  userClient: (authHeader: string) => SupabaseClient<Database>;
};

const realDeps: Deps = {
  userClient: (auth) =>
    createClient<Database>(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    }),
};

// --- Main Handler ---
function makeHandler(deps: Deps) {
  return async (req: Request): Promise<FunctionResponse> => {
    try {
      if (req.method !== "POST") {
        return { success: false, error: "Only POST requests are allowed" };
      }

      // 1. Authenticate user
      const authHeader = req.headers.get("Authorization")!;
      const userClient = deps.userClient(authHeader);
      const { data: { user }, error: userErr } = await userClient.auth
        .getUser();
      if (userErr || !user) {
        return { success: false, error: "Unauthorized access" };
      }

      // 2. Validate payload
      const body: MakePickPayload = await req.json();
      const { game_id, symbol, is_double_down = false } = body;
      if (!game_id || !symbol) {
        return { success: false, error: "Missing 'game_id' or 'symbol'" };
      }

      // 3. Call the ATOMIC SQL Function
      // All logic (auth, validation, picking, turn-advancing)
      // is handled inside the database function.
      const { error: rpcError } = await userClient
        .rpc("make_pick", {
          game_id_to_pick_in: game_id,
          symbol_to_pick: symbol,
          is_double_down: is_double_down,
        });

      if (rpcError) {
        // The RPC will raise an exception (e.g., "It is not your turn")
        // which will be returned here as an error message.
        return { success: false, error: `DB Error: ${rpcError.message}` };
      }

      // 4. Success
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: "Internal server error: " + String(e) };
    }
  };
}

// --- Deno Serve ---
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
