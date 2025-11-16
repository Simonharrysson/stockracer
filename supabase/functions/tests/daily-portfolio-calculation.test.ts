import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
import { Database } from "../_shared/database.types.ts";
import { createTestUserClient } from "../_shared/createTestUserClient.ts";

// --- Test Configuration ---
const SYMBOL_1 = "TEST-AAPL";
const SYMBOL_2 = "TEST-MSFT";

const SUPABASE_LOCAL_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const SERVICE_ROLE_LOCAL = Deno.env.get(
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
)!;

Deno.test(
  "daily-portfolio-calculation: calculates PNL for all members in active games",
  {
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async (t) => {
    const adminClient = createClient<Database>(
      SUPABASE_LOCAL_URL,
      SERVICE_ROLE_LOCAL,
    );

    const { userClient: user1Client, user: user1 } =
      await createTestUserClient(adminClient);
    const { userClient: user2Client, user: user2 } =
      await createTestUserClient(adminClient);

    let gameId: string | null = null;

    try {
      // 1. ARRANGE: Set up the database state

      await t.step("Arrange: Insert test symbols", async () => {
        const { error } = await adminClient.from("symbols").upsert([
          {
            symbol: SYMBOL_1,
            company_name: "Test Apple",
            currency: "USD",
            description: "",
            exchange: "NASDAQ",
            current_price: 150.0,
            day_change: 2.5,
          },
          {
            symbol: SYMBOL_2,
            company_name: "Test Microsoft",
            currency: "USD",
            description: "",
            exchange: "NASDAQ",
            current_price: 300.0,
            day_change: -1.25,
          },
        ]);
        assert(!error, `Failed to insert symbols: ${error?.message}`);
      });

      await t.step("Arrange: Manually insert profiles", async () => {
        const { error } = await adminClient.from("profiles").upsert([
          { id: user1.id, username: "testuser1" },
          { id: user2.id, username: "testuser2" },
        ]);
        assert(!error, `Failed to insert profiles: ${error?.message}`);
      });

      await t.step("Arrange: Insert test game and get ID", async () => {
        const { data, error } = await adminClient
          .from("games")
          .insert({
            name: "Portfolio Calc Test Game",
            invite_code: "CALCTEST",
            status: "ACTIVE",
          })
          .select("id")
          .single();

        assert(!error, `Failed to insert game: ${error?.message}`);
        assertExists(data?.id, "Game ID was not returned from insert");
        gameId = data.id;
      });

      await t.step("Arrange: Insert game members", async () => {
        const { error } = await adminClient.from("game_members").upsert([
          { game_id: gameId!, user_id: user1.id, pnl: 0 },
          { game_id: gameId!, user_id: user2.id, pnl: 0 },
        ]);
        assert(!error, `Failed to insert game members: ${error?.message}`);
      });

      await t.step("Arrange: Insert game picks", async () => {
        const { error } = await adminClient.from("game_picks").upsert([
          {
            game_id: gameId!,
            user_id: user1.id,
            symbol: SYMBOL_1,
            pick_round: 1,
            start_price: 140.0,
          },
          {
            game_id: gameId!,
            user_id: user2.id,
            symbol: SYMBOL_2,
            pick_round: 1,
            start_price: 305.0,
          },
        ]);
        assert(!error, `Failed to insert game picks: ${error?.message}`);
      });

      // 2. ACT: Invoke the function
      const { data: functionData, error: functionError } =
        await adminClient.functions.invoke("daily-portfolio-calculation");

      if (functionError) throw functionError;
      assertEquals(functionData.message, "Portfolio calculations complete.");

      // 3. ASSERT: Check the database
      await t.step("Assert: Check game_picks prices", async () => {
        const { data: picks, error: picksError } = await adminClient
          .from("game_picks")
          .select("*")
          .eq("game_id", gameId!);
        if (picksError) throw picksError;

        const user1Pick = picks.find((p) => p.symbol === SYMBOL_1);
        const user2Pick = picks.find((p) => p.symbol === SYMBOL_2);

        assertExists(user1Pick);
        assertExists(user2Pick);

        assertEquals(user1Pick.current_price, 150.0);
        assertEquals(user2Pick.current_price, 300.0);
      });

      await t.step("Assert: Check game_members pnl", async () => {
        const { data: members, error: membersError } = await adminClient
          .from("game_members")
          .select("*")
          .eq("game_id", gameId!);
        if (membersError) throw membersError;

        const user1Member = members.find((m) => m.user_id === user1.id);
        const user2Member = members.find((m) => m.user_id === user2.id);

        assertExists(user1Member);
        assertExists(user2Member);

        assertEquals(user1Member.pnl, 10);
        assertEquals(user2Member.pnl, -5);
        assertEquals(user1Member.pnl_daily_change, 2.5);
        assertEquals(user2Member.pnl_daily_change, -1.25);
      });
    } finally {
      if (gameId) {
        await adminClient.from("game_picks").delete().eq("game_id", gameId);
        await adminClient.from("game_members").delete().eq("game_id", gameId);
        await adminClient.from("games").delete().eq("id", gameId);
      }
      await adminClient
        .from("symbols")
        .delete()
        .in("symbol", [SYMBOL_1, SYMBOL_2]);

      await user1Client.auth.signOut();
      await user2Client.auth.signOut();
      await adminClient.auth.signOut();

      await Promise.all([
        adminClient.auth.admin.deleteUser(user1.id),
        adminClient.auth.admin.deleteUser(user2.id),
      ]);
    }
  },
);
