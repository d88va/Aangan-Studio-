import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Server-only, service-role access. RLS is on and no policies exist, so nothing else can read.
export function db(): SupabaseClient {
  if (!client) {
    // The Vercel Supabase integration names these NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
    // AANGAN_* names win so a Vercel integration pointing at another project can't override them.
    const url = process.env.AANGAN_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.AANGAN_SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
