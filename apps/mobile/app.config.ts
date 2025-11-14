import path from "path";
import { config } from "dotenv";
import process from "node:process";

// Load envs from multiple locations so mobile builds always get the values.
const root = path.resolve(__dirname, "../../");
const mobileDir = __dirname;

// Base envs (remote keys etc.)
config({ path: path.join(root, "supabase/.env") });
config({ path: path.join(root, ".env") });

// Local overrides (take precedence)
config({ path: path.join(root, ".env.local"), override: true });
config({ path: path.join(mobileDir, ".env.local"), override: true });

export default {
  name: "StockRacer",
  slug: "stock-racer",
  extra: (() => {
    const APP_ENV = process.env.EXPO_APP_ENV ?? process.env.APP_ENV ?? "prod";
    const localUrl =
      (process.env.SUPABASE_LOCAL_URL || "http://127.0.0.1:54321").replace(
        /\/$/,
        "",
      );
    const prodUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const localAnon = process.env.SUPABASE_LOCAL_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const prodAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const SUPABASE_URL = APP_ENV === "local" ? localUrl : prodUrl;
    const SUPABASE_ANON_KEY = APP_ENV === "local" ? localAnon : prodAnon;

    // Ensure Expo PUBLIC envs are set for the bundle (Option 1 usage in client)
    if (SUPABASE_URL) process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    if (SUPABASE_ANON_KEY) {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY as string;
    }

    return {
      APP_ENV,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    } as const;
  })(),
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
};
