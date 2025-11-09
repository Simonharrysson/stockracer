import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertExists,
} from "https://deno.land/std/assert/mod.ts";
import {
  afterAll,
  beforeAll,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
import { FunctionResponse, Payload } from "../manipulate-stock/index.ts";

// --- Load Environment Variables ---
console.log("🌲 Loading environment variables...");

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

afterAll(() => {
  // release resources, if any
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

  // 2. Create their initial portfolio entry
  const { error: portfolioError } = await adminClient.from("portfolios")
    .insert({
      user_id: user.id,
      // Add other defaults if needed
    });
  assert(!portfolioError, "Failed to create initial portfolio for user");

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

Deno.test("📈 Stock 'manipulate-stock' function integration test", {
  sanitizeResources: false,
}, async (t) => {
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

    // Check that the portfolio was updated
    const { data: portfolioData, error: portfolioErr } = await adminClient
      .from("portfolios")
      .select()
      .eq("user_id", user.id)
      .single();

    assert(!portfolioErr, "Error fetching portfolio");
    assertExists(portfolioData, "Portfolio was not found");
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
      price: aaplPrice,
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

    // Check that the portfolio cost basis was reduced
    const { data: portfolioData, error: portfolioErr } = await adminClient
      .from("portfolios")
      .select()
      .eq("user_id", user.id)
      .single();

    assert(!portfolioErr);
    assertExists(portfolioData);

    // Assuming cost basis is reduced proportionally
    // (10 - 3) shares remain.
    const expectedRemainingCost = aaplPrice * (buyQuantity - sellQuantity);

    assertEquals(
      portfolioData.total_invested,
      expectedRemainingCost,
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

  await t.step("Sell too many (failure case)", async () => {
    const body: Payload = {
      symbol: symbolToTest,
      quantity: 1000, // Too many
      side: "SELL",
      price: aaplPrice,
    };

    // Attempt to sell more shares than owned
    const { data } = await userClient.functions.invoke(
      "manipulate-stock",
      { body },
    );
    assert(
      data.error,
      "Function should have returned an error when selling too many shares",
    );
  });

  await t.step("Invalid symbol payload (failure case)", async () => {
    const body = {
      symbol: "", // Invalid symbol
      quantity: 1, // Valid quantity
      side: "BUY", // Valid side
      price: 100, // Valid price
    };

    // Call function with invalid payload
    const { data } = await userClient.functions.invoke(
      "manipulate-stock",
      { body },
    );
    assert(
      data.error,
      "Function should have returned an error for invalid payload",
    );
  });

  await t.step("Invalid quantity payload (failure case)", async () => {
    const body = {
      symbol: symbolToTest,
      quantity: -1, // Invalid quantity
      side: "BUY", // Invalid side
      price: 100, // Invalid price
    };

    // Call function with invalid payload
    const { data } = await userClient.functions.invoke(
      "manipulate-stock",
      { body },
    );
    assert(
      data.error,
      "Function should have returned an error for invalid payload",
    );
  });

  await t.step("Invalid side payload (failure case)", async () => {
    const body = {
      symbol: symbolToTest,
      quantity: 1, // Invalid quantity
      side: "TEST", // Invalid side
      price: 100, // Invalid price
    };

    // Call function with invalid payload
    const { data } = await userClient.functions.invoke(
      "manipulate-stock",
      { body },
    );
    assert(
      data.error,
      "Function should have returned an error for invalid payload: " +
        data.error,
    );
  });

  await t.step("Invalid price payload (failure case)", async () => {
    const body = {
      symbol: symbolToTest,
      quantity: 1, // Invalid quantity
      side: "BUY", // Invalid side
      price: -100, // Invalid price
    };

    // Call function with invalid payload
    const { data } = await userClient.functions.invoke(
      "manipulate-stock",
      { body },
    );
    assert(
      data.error,
      "Function should have returned an error for invalid payload: " +
        data.error,
    );
  });

  await t.step("Teardown: Clean up test user", async () => {
    console.log(`  🧹 Tearing down... deleting test user ${user.id}...`);

    // 7. --- Teardown: Delete the test user ---
    await userClient.auth.signOut();

    // RLS and "on delete cascade" will clean up portfolio and transactions
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    assert(!error, `Failed to delete test user: ${error?.message}`);
  });

  clearInterval(); // Stop Deno test runner from hanging

  console.log("\n🏁 Test finished successfully!");
  Deno.exit();
});
