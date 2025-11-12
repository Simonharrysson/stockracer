// supabase/functions/create-lobby/index.ts
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../../../database.types.ts";

// --- Types & Environment ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type CreateLobbyPayload = {
  name: string;
};

export interface FunctionResponse {
  success: boolean;
  data?: Database["public"]["Tables"]["games"]["Row"];
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

// --- Helper Functions ---
function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
      const body: CreateLobbyPayload = await req.json();
      const name = body.name;
      if (!name || typeof name !== "string" || name.length < 3) {
        return { success: false, error: "Invalid game name" };
      }

      // 3. Create Game (as an RPC to make it atomic)
      // We'll use the "atomic" RPC pattern we discussed.
      // It's the best way to create the game AND add the member.
      const { data: newGame, error: rpcError } = await userClient
        .rpc("create_lobby_and_add_creator", {
          game_name: name,
          invite_code: generateInviteCode(),
        })
        .single();

      if (rpcError) {
        if (rpcError.code === "23505") { // unique_violation
          return {
            success: false,
            error: "Failed to create lobby, please try again",
          };
        }
        return { success: false, error: `DB Error: ${rpcError.message}` };
      }

      return { success: true, data: newGame };
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
