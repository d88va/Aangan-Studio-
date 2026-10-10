import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { createDeal } from "@/lib/hubspot";

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
  // ?hubspot=test creates one clearly named test deal so the CRM connection can be checked.
  if (req.nextUrl.searchParams.get("hubspot") === "test") {
    try {
      const id = await createDeal(
        { classification: "qualified", fit_reason: "", asked_pricing: false, segment: "home", name: "Aangan connection test", property_type: "test", area_sqft: null, location: null, scope: null, timeline: null, decision_maker: null, volunteered_budget: null, source: null, handoff_note: "Connection test. Safe to delete." },
        null,
      );
      out.hubspot = id ? { created_deal_id: id } : "no token set";
    } catch (e) {
      out.hubspot = { error: String(e) };
    }
  }
  return NextResponse.json(out);
}
