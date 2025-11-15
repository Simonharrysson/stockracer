// supabase/functions/tests/make-pick.test.ts
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
import { FunctionResponse as CreateLobbyResponse } from "../create-lobby/index.ts";
import { FunctionResponse as MakePickResponse } from "../make-pick/index.ts";
import { createTestUserClient } from "../_shared/createTestUserClient.ts";

// --- Load Environment Variables ---
const SUPABASE_LOCAL_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const SERVICE_ROLE_LOCAL = Deno.env.get(
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
)!;

// ##################################################################
// ##
// ##  TEST: make-pick (Full Draft Logic)
// ##
// ##################################################################

Deno.test("✅ 🛡️ Happy Path & Failures - 'make-pick'", {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t) => {
  console.log("\n🚀 Starting 'make-pick' (Draft Logic) test...");
  const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);

  // We need two users
  const { userClient: hostClient, user: hostUser } = await createTestUserClient(
    adminClient,
  );
  const { userClient: joinerClient, user: joinerUser } =
    await createTestUserClient(adminClient);

  let gameId: string;
  let pickOrder: string[];
  let playerA: { client: SupabaseClient; id?: string },
    playerB: { client: SupabaseClient; id: string };
  let symbolFromPool: string;

  try {
    // --- 1. Setup: Create, Join, and Start a Game ---
    await t.step("Setup: Create, Join, and Start Game", async () => {
      // Host creates
      const { data: createData } = await hostClient.functions.invoke(
        "create-lobby",
        { body: { name: "Make-Pick Test Lobby" } },
      );
      gameId = (createData as CreateLobbyResponse).data!.id;
      const inviteCode = (createData as CreateLobbyResponse).data!.invite_code;

      // Joiner joins
      await joinerClient.functions.invoke("join-game", {
        body: { invite_code: inviteCode },
      });

      // Host starts
      await hostClient.functions.invoke("start-game", {
        body: { game_id: gameId },
      });

      // Get game state to see whose turn it is
      const { data: game, error } = await adminClient.from("games").select()
        .eq("id", gameId).single();
      assert(!error);
      pickOrder = game!.pick_order!;

      // Assign PlayerA and PlayerB based on the randomized draft order
      playerA = (pickOrder[0] === hostUser.id)
        ? { client: hostClient, id: hostUser.id }
        : { client: joinerClient, id: joinerUser.id };
      playerB = (pickOrder[1] === hostUser.id)
        ? { client: hostClient, id: hostUser.id }
        : { client: joinerClient, id: joinerUser.id };

      // Get a valid symbol from the draft pool for Round 1
      const { data: poolData } = await adminClient.from("game_round_pools")
        .select("symbol").eq("game_id", gameId).eq("pick_round", 1).limit(1)
        .single();
      symbolFromPool = poolData!.symbol;
    });

    // --- 2. Failure Case: Not Your Turn ---
    await t.step("Fail: 'make-pick' (Not Your Turn)", async () => {
      // It's Player A's turn. Player B tries to pick.
      const { data } = await playerB.client.functions.invoke("make-pick", {
        body: { game_id: gameId, symbol: symbolFromPool },
      });
      const res = data as MakePickResponse;
      assert(!res.success, "Function should have failed");
      assert(res.error?.includes("It is not your turn"));
    });

    // --- 3. Failure Case: Not in Draft Pool ---
    await t.step("Fail: 'make-pick' (Stock not in pool)", async () => {
      // Player A tries to pick a fake symbol
      const { data } = await playerA.client.functions.invoke("make-pick", {
        body: { game_id: gameId, symbol: "FAKESYMBOL" },
      });
      const res = data as MakePickResponse;
      assert(!res.success, "Function should have failed");
      assert(res.error?.includes("Stock is not in the draft pool"));
    });

    // --- 4. Happy Path: Player A makes a valid pick ---
    await t.step("Execute: Player A makes a valid pick", async () => {
      const { data } = await playerA.client.functions.invoke("make-pick", {
        body: { game_id: gameId, symbol: symbolFromPool },
      });
      const res = data as MakePickResponse;
      assert(res.success, `Function failed: ${res.error}`);
    });

    // --- 5. Assert: Turn has advanced ---
    await t.step("Assert: Turn has advanced to Player B", async () => {
      const { data: game, error } = await adminClient.from("games").select(
        "current_turn_user_id",
      ).eq("id", gameId).single();
      assert(!error);
      assertEquals(game!.current_turn_user_id, playerB.id);
    });

    // --- 6. Failure Case: Stock Already Taken ---
    await t.step("Fail: 'make-pick' (Stock already taken)", async () => {
      // It's Player B's turn. They try to pick the same stock as Player A.
      const { data } = await playerB.client.functions.invoke("make-pick", {
        body: { game_id: gameId, symbol: symbolFromPool },
      });
      const res = data as MakePickResponse;
      assert(!res.success, "Function should have failed");
      assert(
        res.error?.includes("unique constraint"),
        "Did not fail for unique pick",
      );
      assert(
        res.error?.includes("game_picks_game_id_symbol_key"),
        "Wrong unique constraint",
      );
    });
  } finally {
    // --- 7. Teardown ---
    await t.step("Teardown: Clean up test users", async () => {
      await hostClient.auth.signOut();
      await joinerClient.auth.signOut();
      await adminClient.auth.signOut();
      await Promise.all([
        adminClient.auth.admin.deleteUser(hostUser.id),
        adminClient.auth.admin.deleteUser(joinerUser.id),
      ]);
    });
  }
});
