import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
// Import types from the functions
import { FunctionResponse as CreateLobbyResponse } from "../create-lobby/index.ts";
import { FunctionResponse as JoinGameResponse } from "../join-game/index.ts";

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

/**
 * Helper to create a lobby and return its invite code
 */
async function createTestLobby(
  userClient: SupabaseClient,
): Promise<{ gameId: string; inviteCode: string }> {
  const { data } = await userClient.functions.invoke("create-lobby", {
    body: { name: "Test Lobby for Joining" },
  });
  const responseData = data as CreateLobbyResponse;
  assert(responseData.success, "Failed to create lobby for setup");
  return {
    gameId: responseData.data!.id,
    inviteCode: responseData.data!.invite_code,
  };
}

// ##################################################################
// ##
// ##  TEST: join-game
// ##
// ##################################################################

Deno.test("✅ Happy Path - 'join-game' (Multiple Joiners)", {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t) => {
  console.log("\n🚀 Starting 'join-game' Happy Path test...");
  const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);

  // We need THREE users
  const { userClient: hostClient, user: hostUser } = await createTestUserClient(
    adminClient,
  );
  const { userClient: joinerAClient, user: joinerAUser } =
    await createTestUserClient(adminClient);
  const { userClient: joinerBClient, user: joinerBUser } =
    await createTestUserClient(adminClient);

  try {
    // --- 1. Setup: Host creates a lobby ---
    const { gameId, inviteCode } = await createTestLobby(hostClient);
    assertExists(inviteCode);

    // --- 2. Execute: Joiner A uses the code ---
    await t.step("Execute: First member 'join-game'", async () => {
      const { data, error } = await joinerAClient.functions.invoke(
        "join-game",
        {
          body: { invite_code: inviteCode },
        },
      );
      const responseData = data as JoinGameResponse;
      assert(!error, `Function invocation failed: ${error?.message}`);
      assert(responseData.success, `Joiner A failed: ${responseData.error}`);
      assertEquals(responseData.data?.game_id, gameId);
    });

    // --- 3. Execute: Joiner B uses the same code ---
    await t.step("Execute: Second member 'join-game'", async () => {
      const { data, error } = await joinerBClient.functions.invoke(
        "join-game",
        {
          body: { invite_code: inviteCode },
        },
      );
      const responseData = data as JoinGameResponse;
      assert(!error, `Function invocation failed: ${error?.message}`);
      assert(responseData.success, `Joiner B failed: ${responseData.error}`);
      assertEquals(responseData.data?.game_id, gameId);
    });

    // --- 4. Assert Database (Admin) ---
    await t.step(
      "Assert: Verify all 3 members are in game_members",
      async () => {
        const { data: members, error } = await adminClient
          .from("game_members")
          .select()
          .eq("game_id", gameId);

        assert(!error, `DB Error: ${error?.message}`);
        assertExists(members);
        assertEquals(members.length, 3, "Game should have 3 members");

        const userIds = members.map((m) => m.user_id);
        assert(userIds.includes(hostUser.id), "Host is not in game");
        assert(userIds.includes(joinerAUser.id), "Joiner A is not in game");
        assert(userIds.includes(joinerBUser.id), "Joiner B is not in game");
      },
    );
  } finally {
    // --- 5. Teardown ---
    await t.step("Teardown: Clean up test users", async () => {
      await hostClient.auth.signOut();
      await joinerAClient.auth.signOut();
      await joinerBClient.auth.signOut();
      await adminClient.auth.signOut();
      await Promise.all([
        adminClient.auth.admin.deleteUser(hostUser.id),
        adminClient.auth.admin.deleteUser(joinerAUser.id),
        adminClient.auth.admin.deleteUser(joinerBUser.id),
      ]);
    });
  }
});

Deno.test("🛡️ Failure Cases - 'join-game'", {
  sanitizeResources: false,
  sanitizeOps: false,
}, async (t) => {
  console.log("\n🚀 Starting 'join-game' Failure Cases test...");
  const adminClient = createClient(SUPABASE_LOCAL_URL, SERVICE_ROLE_LOCAL);
  const { userClient, user } = await createTestUserClient(adminClient);

  try {
    // --- 1. Test: Bad Invite Code ---
    await t.step("Fail: Join with bad invite code", async () => {
      const { data } = await userClient.functions.invoke("join-game", {
        body: { invite_code: "XXXXXX" },
      });
      const responseData = data as JoinGameResponse;
      assert(!responseData.success, "Function should have failed");
      assertEquals(
        responseData.error,
        "Invalid or expired invite code",
      );
    });

    // --- 2. Test: Join Twice ---
    await t.step("Fail: Join a game twice", async () => {
      // First, create a game
      const { inviteCode } = await createTestLobby(userClient);

      // Now, try to join *again* (as the host, who is already a member)
      const { data } = await userClient.functions.invoke("join-game", {
        body: { invite_code: inviteCode },
      });

      const responseData = data as JoinGameResponse;
      assert(!responseData.success, "Function should have failed");
      assertEquals(
        responseData.error,
        "You are already in this game",
      );
    });

    // --- 3. Test: Join Started Game ---
    await t.step("Fail: Join a game that already started", async () => {
      // Create a game
      const { gameId, inviteCode } = await createTestLobby(userClient);

      // Manually set its status to 'DRAFTING' using admin
      await adminClient.from("games").update({ status: "DRAFTING" }).eq(
        "id",
        gameId,
      );

      // Try to join
      const { data } = await userClient.functions.invoke("join-game", {
        body: { invite_code: inviteCode },
      });

      const responseData = data as JoinGameResponse;
      assert(!responseData.success, "Function should have failed");
      assertEquals(
        responseData.error,
        "This game is not open for joining",
      );
    });
  } finally {
    // --- 4. Teardown ---
    await t.step("Teardown: Clean up test user", async () => {
      await userClient.auth.signOut();
      await adminClient.auth.signOut();
      await adminClient.auth.admin.deleteUser(user.id);
    });
  }
});
