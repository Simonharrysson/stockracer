import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { beforeAll } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3";
import { FunctionResponse, Payload } from "../manipulate-stock/index.ts";

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

// --- Test Helper ---
async function createTestUserClient(adminClient: SupabaseClient) {
  const testEmail = `test-user-${crypto.randomUUID()}@example.com`;
  const testPassword = "test-password-123";

  // 1. Create the user in auth.users
  const { data: authData, error: authError } = await adminClient.auth.admin
    .createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email for testing
    });

  assert(!authError, `Failed to create test user: ${authError?.message}`);
  assertExists(authData.user, "Test user was not created");
  const user = authData.user;
  console.log(`Created auth.users entry for \n${user.email}\n(${user.id})\n`);

  // 2. --- CHANGE: NO PORTFOLIO INSERT NEEDED ---
  // We no longer insert into 'portfolios'. The VIEW will exist
  // and the 'positions' table will be populated by the first trade.

  // 3. Create a new client and sign in as the user
  const userClient = createClient(SUPABASE_LOCAL_URL, ANON_KEY);
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  assert(
    !signInError,
    `Failed to sign in as test user: ${signInError?.message}`,
  );

  return { userClient, user };
}

// --- Test Definition ---

Deno.test(
  "📈 Stock 'manipulate-stock' function integration test",
  async (t) => {
    console.log("\n\n🚀 Starting 'manipulate-stock' integration test...");

    // 1. --- Setup: Create admin client and test user ---
    const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);
    const { userClient, user } = await createTestUserClient(adminClient);

    // --- Test Data ---
    const symbolToTest = "AAPL"; // This symbol exists in your seed.sql
    const buyQuantity = 10;
    const sellQuantity = 3;

    // Get the current price for our assertions
    const { data: symbolData, error: symbolErr } = await adminClient
      .from("symbols")
      .select("current_price")
      .eq("symbol", symbolToTest)
      .single();

    assert(!symbolErr, "Could not fetch symbol data");
    assertExists(symbolData, "Test symbol 'AAPL' not found in DB");

    const aaplPrice = symbolData.current_price as number;
    const expectedBuyCost = aaplPrice * buyQuantity;

    await t.step("'BUY' 10 shares of AAPL", async () => {
      const body: Payload = {
        symbol: symbolToTest,
        quantity: buyQuantity,
        side: "BUY",
        price: aaplPrice,
      };

      // 2. --- Execute: Call the Edge Function as the user ---
      const { data } = await userClient.functions.invoke(
        "manipulate-stock",
        {
          body,
        },
      );

      // 3. --- Assert (Response): Check function return ---
      const responseData = data as FunctionResponse;
      assert(
        !!responseData && !responseData.error,
        `Function returned an error: ${responseData.error}`,
      );
      assertEquals(
        !!responseData && responseData.success,
        true,
        "Function did not return success=true",
      );
    });

    await t.step("Verify 'BUY' transaction", async () => {
      // 4. --- Assert (Database): Check the DB state ---

      // Check that the transaction was logged
      const { data: txData, error: txErr } = await adminClient
        .from("transactions")
        .select()
        .eq("user_id", user.id)
        .eq("symbol", symbolToTest)
        .single();

      assert(!txErr, "Error fetching transaction");
      assertExists(txData, "Transaction was not created");
      assertEquals(txData.side, "BUY");
      assertEquals(txData.quantity, buyQuantity);
      assertEquals(txData.price, aaplPrice);

      // --- NEW: Check the 'positions' table (the source of truth) ---
      const { data: posData, error: posErr } = await adminClient
        .from("positions")
        .select()
        .eq("user_id", user.id)
        .eq("symbol", symbolToTest)
        .single();

      assert(!posErr, "Error fetching position");
      assertExists(posData, "Position was not created");
      assertEquals(posData.quantity, buyQuantity);
      assertEquals(posData.average_cost, aaplPrice);

      // Check that the 'portfolios' VIEW reflects the change
      const { data: portfolioData, error: portfolioErr } = await adminClient
        .from("portfolios") // This is now a VIEW
        .select()
        .eq("user_id", user.id)
        .single();

      assert(!portfolioErr, "Error fetching portfolio view");
      assertExists(portfolioData, "Portfolio view was not found");
      assertEquals(portfolioData.position_count, 1);
      assertEquals(
        Math.round(portfolioData.total_invested),
        Math.round(expectedBuyCost),
      );
      assertArrayIncludes(portfolioData.tickers, [symbolToTest]);
    });

    await t.step("'SELL' 3 shares of AAPL", async () => {
      const body: Payload = {
        symbol: symbolToTest,
        quantity: sellQuantity,
        side: "SELL",
        price: aaplPrice, // Sell price doesn't affect cost basis
      };

      // 5. --- Execute: Sell some of the shares ---
      const { data } = await userClient.functions.invoke(
        "manipulate-stock",
        {
          body,
        },
      );

      const responseData = data as FunctionResponse;
      assert(
        !responseData.error,
        `Function returned an error on SELL: ${responseData.error}`,
      );
      assertEquals(
        !!responseData && responseData.success,
        true,
        "SELL Function did not return success=true",
      );
    });

    await t.step("Verify 'SELL' transaction", async () => {
      // 6. --- Assert (Database): Check state after SELL ---

      // Check for the new SELL transaction
      const { count: txCount, error: txCountErr } = await adminClient
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      assert(!txCountErr);
      assertEquals(
        txCount,
        2,
        "Should be two transactions total (1 BUY, 1 SELL)",
      );

      // --- NEW: Check the 'positions' table ---
      const { data: posData, error: posErr } = await adminClient
        .from("positions")
        .select()
        .eq("user_id", user.id)
        .eq("symbol", symbolToTest)
        .single();

      assert(!posErr, "Error fetching position after sell");
      assertExists(posData, "Position was not found after sell");
      // Quantity should be reduced
      assertEquals(posData.quantity, buyQuantity - sellQuantity);
      // Average cost should be unchanged
      assertEquals(posData.average_cost, aaplPrice);

      // Check the 'portfolios' VIEW
      const { data: portfolioData, error: portfolioErr } = await adminClient
        .from("portfolios")
        .select()
        .eq("user_id", user.id)
        .single();

      assert(!portfolioErr);
      assertExists(portfolioData);

      // total_invested = new_quantity * average_cost
      const expectedRemainingCost = (buyQuantity - sellQuantity) * aaplPrice;

      assertEquals(
        Math.round(portfolioData.total_invested),
        Math.round(expectedRemainingCost),
        "Portfolio cost basis (total_invested) was not updated correctly after sell",
      );
      assertEquals(
        portfolioData.position_count,
        1,
        "Position count should still be 1",
      );
      assertArrayIncludes(
        portfolioData.tickers,
        [symbolToTest],
        "Ticker should still be in portfolio",
      );
    });

    // --- Failure cases (unchanged, still valid) ---
    await t.step("Sell too many (failure case)", async () => {
      const body: Payload = {
        symbol: symbolToTest,
        quantity: 1000, // Too many
        side: "SELL",
        price: aaplPrice,
      };
      const { data } = await userClient.functions.invoke(
        "manipulate-stock",
        { body },
      );
      assert(
        data.error,
        "Function should have returned an error when selling too many shares",
      );
      assert(data.error.includes("Insufficient shares"));
    });

    await t.step("Invalid symbol payload (failure case)", async () => {
      const body = { symbol: "", quantity: 1, side: "BUY", price: 100 };
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body,
      });
      assert(
        data.error,
        "Function should have returned an error for invalid payload",
      );
    });

    await t.step("Invalid quantity payload (failure case)", async () => {
      const body = {
        symbol: symbolToTest,
        quantity: -1,
        side: "BUY",
        price: 100,
      };
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body,
      });
      assert(
        data.error,
        "Function should have returned an error for invalid payload",
      );
    });

    await t.step("Invalid side payload (failure case)", async () => {
      const body = {
        symbol: symbolToTest,
        quantity: 1,
        side: "TEST",
        price: 100,
      };
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body,
      });
      assert(
        data.error,
        "Function should have returned an error for invalid payload: " +
          data.error,
      );
    });

    await t.step("Invalid price payload (failure case)", async () => {
      const body = {
        symbol: symbolToTest,
        quantity: 1,
        side: "BUY",
        price: -100,
      };
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body,
      });
      assert(
        data.error,
        "Function should have returned an error for invalid payload: " +
          data.error,
      );
    });

    await t.step("Check transactions (after failures)", async () => {
      // Extra check: Fetch all transactions and verify counts
      // The failed tests should NOT have created transactions
      const { data: allTxData, error: allTxErr } = await adminClient
        .from("transactions")
        .select()
        .eq("user_id", user.id);

      assert(!allTxErr, "Error fetching all transactions");
      assertExists(allTxData, "No transactions found for user");
      assertEquals(
        allTxData.length,
        2,
        "There should be exactly 2 transactions (1 BUY, 1 SELL)",
      );
    });

    await t.step("Teardown: Clean up test user", async () => {
      console.log(`  🧹 Tearing down... deleting test user ${user.id}...`);
      await userClient.auth.signOut();
      await adminClient.auth.signOut();
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      assert(!error, `Failed to delete test user: ${error?.message}`);
      console.log("\n🏁 Finished successfully!");
    });
  },
);

// --- CHANGED: Renamed test and fixed logic ---
Deno.test("🌪️ Stateful - Trading Frenzy & Cost Basis (Average Cost)", async (t) => {
  console.log("\n🚀 Starting 'Trading Frenzy' (Average Cost) test...");
  const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);
  const { userClient, user } = await createTestUserClient(adminClient);

  const symbol = "MSFT"; // Use a different symbol for a clean test
  let expectedTotalInvested = 0;
  let expectedPositionCount = 0;
  let expectedTickerList: string[] = [];

  try {
    // --- Transaction 1: Buy 10 @ $100 ---
    await t.step("Execute: Buy 10 @ $100", async () => {
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body: { symbol, quantity: 10, side: "BUY", price: 100 },
      });
      assert(!data.error, data.error);
    });

    await t.step("Assert: Portfolio has 10 shares", async () => {
      expectedTotalInvested = 1000; // 10 * 100
      expectedPositionCount = 1;
      expectedTickerList = ["MSFT"];

      const { data: p } = await adminClient.from("portfolios").select()
        .eq("user_id", user.id).single();
      assertEquals(p.total_invested, expectedTotalInvested);
      assertEquals(p.position_count, expectedPositionCount);
      assertArrayIncludes(p.tickers, expectedTickerList);

      // Check positions table
      const { data: pos } = await adminClient.from("positions").select()
        .eq("user_id", user.id).single();
      assertEquals(pos.quantity, 10);
      assertEquals(pos.average_cost, 100);
    });

    // --- Transaction 2: Buy 5 @ $110 ---
    await t.step("Execute: Buy 5 @ $110", async () => {
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body: { symbol, quantity: 5, side: "BUY", price: 110 },
      });
      assert(!data.error, data.error);
    });

    await t.step("Assert: Portfolio has 15 shares", async () => {
      // (10 * 100) + (5 * 110) = 1000 + 550 = 1550
      expectedTotalInvested = 1550;
      // New Average Cost = 1550 / 15 = 103.333...
      const expectedAvgCost = 1550 / 15;

      const { data: p } = await adminClient.from("portfolios").select()
        .eq("user_id", user.id).single();
      assertEquals(
        p.total_invested.toFixed(6),
        expectedTotalInvested.toFixed(6),
      );
      assertEquals(p.position_count, expectedPositionCount); // Still 1

      // Check positions table
      const { data: pos } = await adminClient.from("positions").select()
        .eq("user_id", user.id).single();
      assertEquals(pos.quantity, 15);
      assertEquals(pos.average_cost.toFixed(6), expectedAvgCost.toFixed(6));
    });

    // --- Transaction 3: Sell 8 @ $120 (Average Cost) ---
    await t.step("Execute: Sell 8 @ $120 (Average Cost)", async () => {
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body: { symbol, quantity: 8, side: "SELL", price: 120 },
      });
      assert(!data.error, `Function failed on a valid sell: ${data.error}`);
      assertEquals(data.success, true);
    });

    await t.step("Assert: Portfolio has 7 shares", async () => {
      // 7 shares remain. Average cost is unchanged.
      // New total_invested = 7 * (1550 / 15) = 723.333...
      const expectedAvgCost = 1550 / 15;
      expectedTotalInvested = expectedAvgCost * 7;

      const { data: p } = await adminClient.from("portfolios").select()
        .eq("user_id", user.id).single();
      assertEquals(
        p.total_invested.toFixed(6),
        expectedTotalInvested.toFixed(6),
      );
      assertEquals(p.position_count, expectedPositionCount);

      // Check positions table
      const { data: pos } = await adminClient.from("positions").select()
        .eq("user_id", user.id).single();
      assertEquals(pos.quantity, 7);
      assertEquals(pos.average_cost.toFixed(6), expectedAvgCost.toFixed(6));
    });

    // --- Transaction 4: Sell 7 @ $120 ---
    await t.step("Execute: Sell remaining 7 shares", async () => {
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body: { symbol, quantity: 7, side: "SELL", price: 120 },
      });
      assert(
        !data.error,
        `Function failed to sell all remaining shares: ${data.error}`,
      );
      assertEquals(data.success, true);
    });

    await t.step("Assert: Portfolio is empty", async () => {
      expectedTotalInvested = 0;
      expectedPositionCount = 0;
      expectedTickerList = [];

      const { data: p } = await adminClient.from("portfolios").select()
        .eq("user_id", user.id).single();

      // The VIEW will return NULL data if no positions match.
      // The function handles this, but a direct adminClient query might return null.
      if (p) { // If user has other positions
        assertEquals(p.total_invested, expectedTotalInvested);
        assertEquals(p.position_count, expectedPositionCount);
        assertEquals(p.tickers.length, 0);
      }

      // Check positions table (this is the real test)
      const { data: pos } = await adminClient.from("positions").select()
        .eq("user_id", user.id).eq("symbol", symbol).single();
      assertEquals(pos.quantity, 0);
      assertEquals(pos.average_cost, 0);
    });

    // --- Transaction 5: FINAL CHECK (Over-sell) ---
    await t.step("Fail: Sell 1 share from empty portfolio", async () => {
      const { data } = await userClient.functions.invoke("manipulate-stock", {
        body: { symbol, quantity: 1, side: "SELL", price: 120 },
      });
      assert(data.error, "Function did not return an error");
      assertEquals(data.success, false);
      assert(data.error.includes("Insufficient shares"));
    });

    // Add this inside the first Deno.test block
    await t.step("Fail: Sell symbol not in portfolio", async () => {
      const body: Payload = {
        symbol: "MSFT", // User owns AAPL, not MSFT
        quantity: 1,
        side: "SELL",
        price: 100,
      };

      // Attempt to sell a stock they never bought
      const { data } = await userClient.functions.invoke(
        "manipulate-stock",
        { body },
      );
      assert(
        data.error,
        "Function should have failed when selling a symbol not owned",
      );
      assert(data.error.includes("Insufficient shares"));
    });
  } finally {
    // --- Teardown ---
    await t.step("Teardown: Clean up test user", async () => {
      console.log(`  🧹 Tearing down user ${user.id}...`);
      await userClient.auth.signOut();
      await adminClient.auth.signOut();
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      assert(!error, `Failed to delete test user: ${error?.message}`);
      console.log("\n🏁 Finished successfully!");
    });
  }
});
