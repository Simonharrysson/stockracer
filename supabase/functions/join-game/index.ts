// supabase/functions/join-game/index.ts
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import type { Database } from "../_shared/database.types.ts";

// --- Types & Environment ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY")!;

type JoinGamePayload = {
  invite_code: string;
};

export interface FunctionResponse {
  success: boolean;
  data?: {
    game_id: string;
    game_name: string;
  };
  error?: string;
}

// --- Dependency Injection ---
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
      const {
        data: { user },
        error: userErr,
      } = await userClient.auth.getUser();
      if (userErr || !user) {
        return { success: false, error: "Unauthorized access" };
      }

      // 2. Validate payload
      const body: JoinGamePayload = await req.json();
      const invite_code = body.invite_code?.trim().toUpperCase();
      if (!invite_code) {
        return { success: false, error: "Invalid 'invite_code'" };
      }

      // 3. Find the game (using Admin Client to bypass RLS)
      const adminClient = deps.adminClient();
      const { data: game, error: gameErr } = await adminClient
        .from("games")
        .select("id, name, status") // Only select what we need
        .eq("invite_code", invite_code)
        .single();

      if (gameErr || !game) {
        return { success: false, error: "Invalid or expired invite code" };
      }

      // 4. Check business logic (Game must be in 'LOBBY' status)
      // *** THIS IS THE FIX ***
      // We only check the status. We don't care about start_time here.
      if (game.status !== "LOBBY") {
        return { success: false, error: "This game is not open for joining" };
      }

      // 5. Try to insert the user into the game (as the user)
      const { error: memberErr } = await userClient
        .from("game_members")
        .insert({
          game_id: game.id,
          user_id: user.id,
        });

      if (memberErr) {
        if (memberErr.code === "23505") {
          // unique_violation
          return { success: false, error: "You are already in this game" };
        }
        return { success: false, error: `DB Error: ${memberErr.message}` };
      }

      // 6. Success
      return {
        success: true,
        data: { game_id: game.id, game_name: game.name },
      };
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
