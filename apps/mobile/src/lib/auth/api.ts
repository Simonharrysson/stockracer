import { supabase } from "./supabase";

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
}

export type SignUpResult =
  | { status: "session"; userId: string }
  | { status: "confirmation_required" };

export async function signUpWithUsername(
  email: string,
  password: string,
  username: string,
): Promise<SignUpResult> {
  const trimmedUsername = username.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: trimmedUsername },
    },
  });
  if (error) throw new Error(error.message);

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        username: trimmedUsername,
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(profileError.message);
  }

  if (data.session && data.user) {
    return { status: "session", userId: data.user.id };
  }
  return { status: "confirmation_required" };
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(
  callback: Parameters<typeof supabase.auth.onAuthStateChange>[0],
) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function signOut() {
  await supabase.auth.signOut();
}
