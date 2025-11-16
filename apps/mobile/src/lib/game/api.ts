import { supabase } from "../auth/supabase";

export type CreateLobbyResult = {
  id: string;
  name: string;
  invite_code: string;
};

export async function createLobby(name: string): Promise<CreateLobbyResult> {
  const { data, error } = await supabase.functions.invoke("create-lobby", {
    body: { name },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to create lobby");
  }
  return data.data as CreateLobbyResult;
}

export type JoinGameResult = {
  game_id: string;
  game_name: string;
};

export async function joinGame(inviteCode: string): Promise<JoinGameResult> {
  const { data, error } = await supabase.functions.invoke("join-game", {
    body: { invite_code: inviteCode },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to join game");
  }
  return data.data as JoinGameResult;
}
