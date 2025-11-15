import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/index.js";
import SupabaseClient from "https://esm.sh/@supabase/supabase-js@2.45.3/dist/module/SupabaseClient.js";

const SUPABASE_LOCAL_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")!;

export async function createTestUserClient(adminClient: SupabaseClient) {
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
