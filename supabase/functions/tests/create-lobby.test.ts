// supabase/functions/tests/create-lobby-test.ts
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
import { FunctionResponse } from "../create-lobby/index.ts";

// --- Load Environment Variables ---
const SUPABASE_LOCAL_URL = Deno.env.get("SUPABASE_LOCAL_URL")!;
const ANON_KEY = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_LOCAL = Deno.env.get("SUPABASE_LOCAL_SERVICE_ROLE_KEY")!;

// --- Test Helper (Reusable) ---
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
  const user = authData.user!;

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

// ##################################################################
// ##
// ##  TEST: create-lobby
// ##
// ##################################################################

Deno.test("✅ Happy Path - 'create-lobby'", {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t) => {
  console.log("\n🚀 Starting 'create-lobby' Happy Path test...");
  const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);
  const { userClient, user } = await createTestUserClient(adminClient);

  try {
    // --- 1. Execute Function ---
    await t.step("Execute: 'create-lobby' function", async () => {
      const { data, error } = await userClient.functions.invoke(
        "create-lobby",
        {
          body: { name: "Test Lobby" },
        },
      );

      const responseData = data as FunctionResponse;
      assert(!error, `Function invocation failed: ${error?.message}`);
      assert(
        responseData.success,
        `Function logic failed: ${responseData.error}`,
      );
      assertExists(responseData.data?.id, "Function did not return a game ID");
      assertExists(
        responseData.data?.invite_code,
        "Function did not return an invite code",
      );
      assertEquals(responseData.data?.name, "Test Lobby");
      assertEquals(responseData.data?.status, "LOBBY"); // Verify default status
    });

    // --- 2. Assert Database (Admin) ---
    await t.step("Assert: Verify database state", async () => {
      // Check that the game exists
      const { data: game, error: gameErr } = await adminClient.from("games")
        .select()
        .eq("created_by", user.id)
        .single();

      assert(!gameErr, `DB Error: ${gameErr?.message}`);
      assertExists(game, "Game was not created in database");
      assertEquals(game.name, "Test Lobby");

      // Check that the user was added as a member
      const { data: member, error: memberErr } = await adminClient.from(
        "game_members",
      )
        .select()
        .eq("game_id", game.id)
        .eq("user_id", user.id)
        .single();

      assert(!memberErr, `DB Error: ${memberErr?.message}`);
      assertExists(member, "Creator was not added to game_members");
    });
  } finally {
    // --- 3. Teardown ---
    await t.step("Teardown: Clean up test user", async () => {
      console.log(`  🧹 Tearing down user ${user.id}...`);
      await userClient.auth.signOut();
      await adminClient.auth.signOut();
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      assert(!error, `Failed to delete test user: ${error?.message}`);
    });
  }
});
