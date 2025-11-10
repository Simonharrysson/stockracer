// supabase/functions/update-portfolio-value/index.test.ts
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { beforeAll } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";

// --- Load Environment Variables ---
const SUPABASE_LOCAL_URL = Deno.env.get("SUPABASE_LOCAL_URL")!;
const ANON_KEY = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_LOCAL = Deno.env.get("SUPABASE_LOCAL_SERVICE_ROLE_KEY")!;

beforeAll(() => {
  if (!SUPABASE_LOCAL_URL || !ANON_KEY || !SERVICE_ROLE_LOCAL) {
    throw new Error(
      "Missing one or more required environment variables: SUPABASE_LOCAL_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_LOCAL_SERVICE_ROLE_KEY",
    );
  }
});

// --- Test Helper (copied from your other test) ---
// This helper is still useful for creating users whose data we will test.
async function createTestUserClient(adminClient: SupabaseClient) {
  const testEmail = `test-user-${crypto.randomUUID()}@example.com`;
  const testPassword = "test-password-123";

  const { data: authData, error: authError } = await adminClient.auth.admin
    .createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

  assert(!authError, `Failed to create test user: ${authError?.message}`);
  assertExists(authData.user, "Test user was not created");
  const user = authData.user;
  console.log(`Created auth.users entry for \n${user.email}\n(${user.id})\n`);

  // We don't need to sign in as the user, since the cron job is admin-only
  // But we still return the user object
  return { user };
}

// --- Test Definition ---

Deno.test(
  "🗓️ Cron Job 'update-portfolio-value' integration test",
  async (t) => {
    console.log("\n\n🚀 Starting 'update-portfolio-value' integration test...");

    // 1. --- Setup: Create admin client and test users ---
    const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);

    const { user: userA } = await createTestUserClient(adminClient);
    const { user: userB } = await createTestUserClient(adminClient);

    // Get "yesterday's" date string, just like the function does
    const snapshotDate = new Date();
    snapshotDate.setUTCDate(snapshotDate.getUTCDate() - 1);
    const expectedDateString = snapshotDate.toISOString().split("T")[0];

    // Expected prices are from seed.sql
    const aaplPrevClose = 150.00;
    const msftPrevClose = 300.00;
    const googPrevClose = 175.00;

    // Expected costs for our test
    const userA_aaplCost = 140.00;
    const userA_msftCost = 280.00;
    const userB_googCost = 170.00;

    await t.step("Seed: Manually create positions for test users", async () => {
      const { error: posErr } = await adminClient
        .from("positions")
        .insert([
          // User A: 10 AAPL, 5 MSFT
          {
            user_id: userA.id,
            symbol: "AAPL",
            quantity: 10,
            average_cost: userA_aaplCost,
          },
          {
            user_id: userA.id,
            symbol: "MSFT",
            quantity: 5,
            average_cost: userA_msftCost,
          },
          // User B: 20 GOOG
          {
            user_id: userB.id,
            symbol: "GOOG",
            quantity: 20,
            average_cost: userB_googCost,
          },
        ]);
      assert(!posErr, `Failed to seed positions: ${posErr?.message}`);
    });

    await t.step(
      "Execute: Run the 'update-portfolio-value' function",
      async () => {
        // 2. --- Execute: Call the Edge Function as an admin ---
        // This function is not user-facing, so we invoke with the admin client
        const { data, error } = await adminClient.functions.invoke(
          "update-portfolio-value",
        );

        console.log(data, error);
        assert(!error, `Function returned an error: ${error?.message}`);
        // Successful function returns "OK"
        assert(data, "Function did not return a successful response");
      },
    );

    await t.step("Assert: Check 'investment_history' table", async () => {
      // 3. --- Assert (Database): Check the DB state ---
      const { data: history, error: historyErr } = await adminClient
        .from("investment_history")
        .select()
        .in("user_id", [userA.id, userB.id]);

      assert(!historyErr, `Error fetching history: ${historyErr?.message}`);
      assertEquals(
        history.length,
        2,
        "Should have created 2 history rows (one per user)",
      );

      // -- Check User A's snapshot --
      const userA_History = history.find((h) => h.user_id === userA.id);
      assertExists(userA_History, "Snapshot for User A was not created");

      // Expected Worth (A) = (10 * 150) + (5 * 300) = 1500 + 1500 = 3000
      const expectedWorthA = (10 * aaplPrevClose) + (5 * msftPrevClose);
      // Expected Invested (A) = (10 * 140) + (5 * 280) = 1400 + 1400 = 2800
      const expectedInvestedA = (10 * userA_aaplCost) + (5 * userA_msftCost);
      // Expected PNL (A) = 3000 - 2800 = 200
      const expectedPnlA = expectedWorthA - expectedInvestedA;

      assertEquals(userA_History.snapshot_date, expectedDateString);
      assertEquals(userA_History.total_worth, expectedWorthA);
      assertEquals(userA_History.total_invested, expectedInvestedA);
      assertEquals(userA_History.unrealized_pnl, expectedPnlA);

      // -- Check User B's snapshot --
      const userB_History = history.find((h) => h.user_id === userB.id);
      assertExists(userB_History, "Snapshot for User B was not created");

      // Expected Worth (B) = 20 * 175 = 3500
      const expectedWorthB = 20 * googPrevClose;
      // Expected Invested (B) = 20 * 170 = 3400
      const expectedInvestedB = 20 * userB_googCost;
      // Expected PNL (B) = 3500 - 3400 = 100
      const expectedPnlB = expectedWorthB - expectedInvestedB;

      assertEquals(userB_History.snapshot_date, expectedDateString);
      assertEquals(userB_History.total_worth, expectedWorthB);
      assertEquals(userB_History.total_invested, expectedInvestedB);
      assertEquals(userB_History.unrealized_pnl, expectedPnlB);
    });

    await t.step("Assert: Test Idempotency (run again)", async () => {
      // Run the function a second time on the same day
      const { error } = await adminClient.functions.invoke(
        "update-portfolio-value",
      );
      assert(
        !error,
        `Function returned an error on second run: ${error?.message}`,
      );

      // Check the count. It should still be 2, not 4, thanks to the upsert.
      const { count, error: countErr } = await adminClient
        .from("investment_history")
        .select("*", { count: "exact", head: true })
        .in("user_id", [userA.id, userB.id]);

      assert(!countErr, `Error counting history: ${countErr?.message}`);
      assertEquals(
        count,
        2,
        "Function was not idempotent (created duplicate rows)",
      );
    });

    await t.step("Teardown: Clean up test users", async () => {
      // 4. --- Teardown: Delete the test users ---
      console.log(`  🧹 Tearing down... deleting test users...`);
      await adminClient.auth.signOut();

      const { error: errA } = await adminClient.auth.admin.deleteUser(userA.id);
      const { error: errB } = await adminClient.auth.admin.deleteUser(userB.id);
      assert(!errA, `Failed to delete test user A: ${errA?.message}`);
      assert(!errB, `Failed to delete test user B: ${errB?.message}`);

      // Cascade delete should clean up positions and history
      console.log("\n🏁 Finished successfully!");
    });
    clearInterval();
    Deno.exit();
  },
);
