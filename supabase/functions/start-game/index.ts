// supabase/functions/start-game/index.ts
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../../../database.types.ts";

// --- Types & Environment ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// We don't need SERVICE_ROLE here, as the RPC runs as the user

type StartGamePayload = {
  game_id: string;
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
      const body: StartGamePayload = await req.json();
      const { game_id } = body;
      if (!game_id) {
        return { success: false, error: "Missing 'game_id'" };
      }

      // 3. Call the RPC function
      // This will automatically fail if the user is not the creator
      // (based on the validation we built into the SQL function)
      const { error: rpcError } = await userClient
        .rpc("start_game", {
          game_id_to_start: game_id,
        });

      if (rpcError) {
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
