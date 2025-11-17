import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

// Read from the 'extra' config we set up in app.config.ts
const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY;

console.log("Connecting to Supabase at:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing SUPABASE_URL or SUPABASE_ANON_KEY. Check app.config.ts or .env files. (URL: ${supabaseUrl})`,
  );
}

console.log("supabaseUrl:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
