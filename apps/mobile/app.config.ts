import path from "path";
import { config } from "dotenv";
import process from "node:process";

// --- DEBUGGING ---
console.log("--- app.config.ts running ---");
const root = path.resolve(__dirname, "../../");
console.log("Project root path resolved to:", root);
// --- END DEBUGGING ---

// Read the APP_ENV set by the start script. Default to 'prod'.
const APP_ENV = process.env.EXPO_APP_ENV ?? "prod";
console.log(`APP_ENV is: ${APP_ENV}`);

// Load the correct .env file based on the environment
const envFilePath =
  APP_ENV === "local"
    ? path.join(root, "supabase/.env") // For local, use supabase/.env
    : path.join(root, ".env.prod"); // For prod, use root .env

console.log(`Attempting to load .env file from: ${envFilePath}`);
const loadResult = config({ path: envFilePath });

if (loadResult.error) {
  console.warn(`dotenv error: Failed to load ${envFilePath}`, loadResult.error);
} else {
  console.log(
    "dotenv success. Found variables:",
    Object.keys(loadResult.parsed || {}),
  );
}
// --- END DEBUGGING ---

// Now, read the variables using the standard names
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// --- This is for Expo's build process ---
if (SUPABASE_URL) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL;
}
if (SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY as string;
}

export default {
  name: "StockRacer",
  slug: "stock-racer",
  extra: {
    APP_ENV,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  },
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
};
