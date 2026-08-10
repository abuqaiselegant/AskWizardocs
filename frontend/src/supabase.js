import { createClient } from "@supabase/supabase-js";

// One shared client for the whole app.
export const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
