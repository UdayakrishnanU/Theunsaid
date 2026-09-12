import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/** Client for use in the browser / client components — anon key, RLS-restricted. */
export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. See DEPLOY.md.");
  }
  browserClient = createClient(url, key);
  return browserClient;
}

/** Client for use only in server code (route handlers, server components) —
 * service role key, bypasses RLS. Never import this into client components. */
export function supabaseAdmin(): SupabaseClient {
  if (serverClient) return serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. See DEPLOY.md.");
  }
  serverClient = createClient(url, key, { auth: { persistSession: false } });
  return serverClient;
}
