import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Diagnostics: reports which settings exist (never their values) and whether the database works.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.VAANI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const has = (k: string) => !!process.env[k];
  const out: Record<string, unknown> = {
    env: Object.fromEntries(
      [
        "AANGAN_SUPABASE_URL", "AANGAN_SUPABASE_KEY", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY",
        "GEMINI_API_KEY", "GEMINI_MODEL", "RESEND_API_KEY", "EMAIL_FROM", "FRONT_DESK_EMAIL",
        "APP_URL", "LINK_SECRET", "HUBSPOT_PRIVATE_APP_TOKEN", "DASHBOARD_PASSWORD",
      ].map((k) => [k, has(k)]),
    ),
    supabase_url_host: (process.env.AANGAN_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:\/\//, "").slice(0, 40),
    service_key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").slice(0, 8),
  };
  try {
    const d = await db().from("designers").select("id,email,active");
    out.designers = d.error ? { error: d.error.message, code: d.error.code } : { count: d.data?.length, rows: d.data };
    const w = await db().from("calls").upsert({ vaani_call_id: "health-check" }, { onConflict: "vaani_call_id" }).select("id");
    out.write_test = w.error ? { error: w.error.message, code: w.error.code } : "ok";
    await db().from("calls").delete().eq("vaani_call_id", "health-check");
  } catch (e) {
    out.exception = String(e);
  }
  return NextResponse.json(out);
}
