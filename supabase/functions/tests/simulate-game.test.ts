// supabase/functions/tests/simulate-game.test.ts
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";

import { FunctionResponse as CreateLobbyResponse } from "../create-lobby/index.ts";
import { FunctionResponse as JoinGameResponse } from "../join-game/index.ts";
import { FunctionResponse as StartGameResponse } from "../start-game/index.ts";
import { FunctionResponse as MakePickResponse } from "../make-pick/index.ts";
import { createTestUserClient } from "../_shared/createTestUserClient.ts";

// --- Load Environment Variables ---
const SUPABASE_LOCAL_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const SERVICE_ROLE_LOCAL = Deno.env.get(
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
)!;

Deno.test("🏁 Full Game Simulation: 2 players draft 7 rounds", {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t) => {
  console.log("\n🚀 Starting full game simulation test...");

  const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);
  // Two players: host + joiner
  const { userClient: hostClient, user: hostUser } = await createTestUserClient(
    adminClient,
  );
  const { userClient: joinerClient, user: joinerUser } =
    await createTestUserClient(adminClient);

  let gameId = "";

  try {
    // 1) Host creates lobby
    await t.step("Create lobby", async () => {
      const { data } = await hostClient.functions.invoke("create-lobby", {
        body: { name: "Full Simulation Lobby" },
      });
      const res = data as CreateLobbyResponse;
      assert(res.success, `create-lobby failed: ${res.error}`);
      assertExists(res.data?.id);
      assertExists(res.data?.invite_code);
      gameId = res.data!.id;

      // Lobby exists and status LOBBY
      const { data: game, error } = await adminClient.from("games")
        .select()
        .eq("id", gameId)
        .single();
      assert(!error, `DB Error: ${error?.message}`);
      assertEquals(game!.status, "LOBBY");
    });

    // 2) Joiner joins
    await t.step("Joiner joins lobby", async () => {
      // fetch invite code (we can trust returned earlier too)
      const { data: game } = await adminClient.from("games").select(
        "invite_code",
      )
        .eq("id", gameId).single();
      const code = game!.invite_code as string;

      const { data } = await joinerClient.functions.invoke("join-game", {
        body: { invite_code: code },
      });
      const res = data as JoinGameResponse;
      assert(res.success, `join-game failed: ${res.error}`);

      // Members should be 2
      const { count, error } = await adminClient.from("game_members")
        .select("*", { count: "exact", head: true })
        .eq("game_id", gameId);
      assert(!error);
      assertEquals(count, 2);
    });

    // 3) Host starts game
    await t.step("Start game", async () => {
      const { data } = await hostClient.functions.invoke("start-game", {
        body: { game_id: gameId },
      });
      const res = data as StartGameResponse;
      assert(res.success, `start-game failed: ${res.error}`);

      const { data: game, error } = await adminClient.from("games")
        .select()
        .eq("id", gameId)
        .single();
      assert(!error);
      assertEquals(game!.status, "DRAFTING");
      assertEquals(game!.round_categories?.length, 7);
      assertEquals(game!.pick_order?.length, 2);
      assertExists(game!.current_turn_user_id);
    });

    // 4) Draft picks until completion (7 rounds x 2 players = 14 picks)
    await t.step("Draft all rounds", async () => {
      const maxIterations = 20; // safety guard
      let iterations = 0;

      while (iterations < maxIterations) {
        iterations++;

        const { data: game, error } = await adminClient.from("games")
          .select("id,status,current_pick_round,current_turn_user_id")
          .eq("id", gameId)
          .single();
        assert(!error, `DB Error (game read): ${error?.message}`);

        if (game!.status === "ACTIVE") {
          break; // draft over
        }

        const round = game!.current_pick_round as number;
        const turnUserId = game!.current_turn_user_id as string;

        // Get pool symbols for this round
        const { data: pool, error: poolErr } = await adminClient.from(
          "game_round_pools",
        ).select("symbol")
          .eq("game_id", gameId)
          .eq("pick_round", round);
        assert(!poolErr, `DB Error (pool read): ${poolErr?.message}`);
        assert(pool && pool.length > 0, "Empty draft pool for round");

        // Get taken symbols
        const { data: taken, error: takenErr } = await adminClient.from(
          "game_picks",
        ).select("symbol").eq("game_id", gameId);
        assert(!takenErr, `DB Error (picks read): ${takenErr?.message}`);
        const used = new Set((taken ?? []).map((r) => r.symbol));

        const candidate = pool!.map((r) => r.symbol).find((s) => !used.has(s));
        assertExists(candidate, "No available symbol in pool");

        const client = turnUserId === hostUser.id ? hostClient : joinerClient;
        const { data } = await client.functions.invoke("make-pick", {
          body: { game_id: gameId, symbol: candidate },
        });
        const res = data as MakePickResponse;
        assert(res.success, `make-pick failed: ${res.error}`);
      }

      // After loop, game should be ACTIVE and 14 picks total
      const { data: game2 } = await adminClient.from("games").select()
        .eq("id", gameId).single();
      assertEquals(game2!.status, "ACTIVE");
      assertEquals(game2!.current_turn_user_id, null);

      const { count: totalPicks } = await adminClient.from("game_picks")
        .select("*", { count: "exact", head: true })
        .eq("game_id", gameId);
      assertEquals(totalPicks, 14, "Expected 14 total picks (2 players * 7)");

      const { count: hostCount } = await adminClient.from("game_picks")
        .select("*", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("user_id", hostUser.id);
      const { count: joinerCount } = await adminClient.from("game_picks")
        .select("*", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("user_id", joinerUser.id);
      assertEquals(hostCount, 7, "Host should have 7 picks");
      assertEquals(joinerCount, 7, "Joiner should have 7 picks");
    });
  } finally {
    // Teardown users
    await t.step("Teardown users", async () => {
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
