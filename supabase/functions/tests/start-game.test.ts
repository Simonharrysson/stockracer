// supabase/functions/tests/start-game-test.ts
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
// We need types from both functions
import { FunctionResponse as CreateLobbyResponse } from "../create-lobby/index.ts";
import { FunctionResponse as StartGameResponse } from "../start-game/index.ts";
import { FunctionResponse as JoinGameResponse } from "../join-game/index.ts";
import { createTestUserClient } from "../_shared/createTestUserClient.ts";
// --- Load Environment Variables ---
const SUPABASE_LOCAL_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_LOCAL = Deno.env.get("SERVICE_ROLE_KEY")!;

// ##################################################################
// ##
// ##  TEST: start-game (Happy Path)
// ##
// ##################################################################

Deno.test(
  "✅ Happy Path - 'start-game'",
  {
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async (t) => {
    console.log("\n🚀 Starting 'start-game' Happy Path test...");
    const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);

    // We need two users
    const { userClient: hostClient, user: hostUser } =
      await createTestUserClient(adminClient);
    const { userClient: joinerClient, user: joinerUser } =
      await createTestUserClient(adminClient);

    let gameId: string;

    try {
      // --- 1. Setup: Host creates lobby, Joiner joins ---
      await t.step("Setup: Create lobby and join", async () => {
        // Host creates
        const { data: createData } = await hostClient.functions.invoke(
          "create-lobby",
          { body: { name: "Test Lobby for Start" } },
        );
        const createResponse = createData as CreateLobbyResponse;
        assert(createResponse.success, "Failed to create lobby");
        gameId = createResponse.data!.id;
        const inviteCode = createResponse.data!.invite_code;

        // Joiner joins
        const { data: joinData } = await joinerClient.functions.invoke(
          "join-game",
          { body: { invite_code: inviteCode } },
        );
        const joinResponse = joinData as JoinGameResponse;
        assert(joinResponse.success, "Failed to join lobby");
      });

      // --- 2. Execute: Host starts the game ---
      await t.step("Execute: Host calls 'start-game'", async () => {
        const { data, error } = await hostClient.functions.invoke(
          "start-game",
          {
            body: { game_id: gameId },
          },
        );

        const responseData = data as StartGameResponse;
        assert(!error, `Function invocation failed: ${error?.message}`);
        assert(
          responseData.success,
          `Function logic failed: ${responseData.error}`,
        );
      });

      // --- 3. Assert Database (Admin) ---
      await t.step("Assert: Verify game state is 'DRAFTING'", async () => {
        const { data: game, error } = await adminClient
          .from("games")
          .select()
          .eq("id", gameId)
          .single();
        assert(!error, `DB Error: ${error?.message}`);
        assertExists(game, "Game not found in DB");

        assertEquals(
          game.status,
          "DRAFTING",
          "Game status was not set to DRAFTING",
        );
        assertEquals(
          game.round_categories?.length,
          7,
          "Categories were not set",
        );
        assertEquals(game.pick_order?.length, 2, "Pick order was not set");
        assert(
          game.pick_order.includes(hostUser.id),
          "Pick order doesn't include host",
        );
        assert(
          game.pick_order.includes(joinerUser.id),
          "Pick order doesn't include joiner",
        );
        assertEquals(
          game.current_turn_user_id,
          game.pick_order[0],
          "Current turn was not set to first player",
        );
        assertExists(game.pick_deadline, "Pick deadline was not set");
      });

      await t.step("Assert: Verify draft pools were created", async () => {
        const { count, error } = await adminClient
          .from("game_round_pools")
          .select("*", { count: "exact", head: true })
          .eq("game_id", gameId);

        console.log(count);

        assert(!error, `DB Error: ${error?.message}`);
        assertEquals(
          count,
          70,
          "Expected 70 (7 rounds * 10 stocks) rows in pool",
        );
      });
    } finally {
      // --- 4. Teardown ---
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
  },
);

// ##################################################################
// ##
// ##  TEST: start-game (Failure Cases)
// ##
// ##################################################################

Deno.test(
  "🛡️ Failure Case - 'start-game' (Auth & Logic)",
  {
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async (t) => {
    console.log("\n🚀 Starting 'start-game' Failure Cases test...");
    const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);

    // We need two users
    const { userClient: hostClient, user: hostUser } =
      await createTestUserClient(adminClient);
    const { userClient: joinerClient, user: joinerUser } =
      await createTestUserClient(adminClient);

    let gameId: string;

    try {
      // --- 1. Setup: Host creates, Joiner joins ---
      const { data: createData } = await hostClient.functions.invoke(
        "create-lobby",
        { body: { name: "Test Lobby for Failures" } },
      );
      gameId = (createData as CreateLobbyResponse).data!.id;
      const inviteCode = (createData as CreateLobbyResponse).data!.invite_code;
      await joinerClient.functions.invoke("join-game", {
        body: { invite_code: inviteCode },
      });

      // --- 2. Test: Non-creator tries to start ---
      await t.step("Fail: Joiner (non-creator) tries to start", async () => {
        const { data } = await joinerClient.functions.invoke("start-game", {
          body: { game_id: gameId },
        });
        const responseData = data as StartGameResponse;
        assert(!responseData.success, "Function should have failed");
        assertExists(responseData.error);
        assertEquals(
          responseData.error,
          "DB Error: Only the game creator can start the game",
        );
      });

      // --- 3. Test: Start with only 1 player ---
      await t.step("Fail: Host tries to start a 1-player game", async () => {
        // Create a new, separate lobby with only 1 player
        const { data: createData2 } = await hostClient.functions.invoke(
          "create-lobby",
          { body: { name: "1-Player Lobby" } },
        );
        const gameId2 = (createData2 as CreateLobbyResponse).data!.id;

        // Execute
        const { data } = await hostClient.functions.invoke("start-game", {
          body: { game_id: gameId2 },
        });

        const responseData = data as StartGameResponse;
        assert(!responseData.success, "Function should have failed");
        assertExists(responseData.error);
        assertEquals(
          responseData.error,
          "DB Error: You need at least 2 players to start a game",
        );
      });
    } finally {
      // --- 4. Teardown ---
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
  },
);
