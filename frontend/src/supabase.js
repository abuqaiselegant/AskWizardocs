import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./config.js";

// One shared client for the whole app. Both values are checked for the same
// reason API_BASE is — createClient(undefined, undefined) throws from inside the
// library, which names supabase-js rather than the missing variable.
export const sb = createClient(
  requireEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  requireEnv("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY),
);
