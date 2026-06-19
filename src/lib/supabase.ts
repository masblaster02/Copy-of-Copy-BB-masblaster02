import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Surfaces clearly in console + UI rather than a silent runtime crash.
  // eslint-disable-next-line no-console
  console.warn(
    "[fleet-guardian] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in values.",
  );
}

export const supabase = createClient(url ?? "https://placeholder.supabase.co", anon ?? "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "fg-admin-auth" },
});

export const hasSupabaseConfig = Boolean(url && anon);
