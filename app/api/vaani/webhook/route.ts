import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { classify } from "@/lib/gemini";
import { emailDesigner, emailFrontDesk } from "@/lib/email";
import { createDeal } from "@/lib/hubspot";
import { durationSec, isAfterHours, parseTranscript, pick, transcriptToText } from "@/lib/vaani";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.VAANI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const event = String(pick(body, "event", "event_type", "type") ?? "").toLowerCase();
  const callId = String(pick(body, "call_id", "data.call_id", "id", "data.id") ?? "");
  if (!callId) return NextResponse.json({ error: "no call id" }, { status: 400 });
  const d = body.data ?? body;

  if (event.includes("started")) {
    await db().from("calls").upsert(
      {
        vaani_call_id: callId,
        caller_number: pick(d, "caller_number", "from_number", "from", "phone_number") ?? null,
        started_at: pick(d, "start_time", "started_at", "call_start_time") ?? new Date().toISOString(),
        status: "started",
      },
      { onConflict: "vaani_call_id", ignoreDuplicates: true },
    );
    return NextResponse.json({ ok: true });
  }

  if (!event.includes("postprocessing") && !event.includes("post_processing") && !event.includes("ended")) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  // --- call_postprocessing ---
  const { data: existing } = await db().from("calls").select("*").eq("vaani_call_id", callId).maybeSingle();
  if (existing?.classification) return NextResponse.json({ ok: true, duplicate: true }); // idempotent

  const lines = parseTranscript(pick(d, "transcript", "transcription"));
  const text = transcriptToText(lines);
  const summary = pick(d, "summary", "call_summary") as string | undefined;
  const startedAt = existing?.started_at ?? pick(d, "start_time", "started_at") ?? null;
  const endedAt = pick(d, "end_time", "ended_at") ?? new Date().toISOString();
  const secs = durationSec(pick(d, "call_duration", "duration"), startedAt, endedAt);
  const caller = existing?.caller_number ?? pick(d, "caller_number", "from_number", "from") ?? null;
  const entities = pick(d, "entities", "extracted_data", "collected") ?? {};
  const bookedSlot = pick(entities, "booked_slot") ?? pick(d, "booked_slot") ?? null;
  const costVoice = (secs / 60) * Number(process.env.VAANI_RATE_INR_PER_MIN ?? 0);

  const base = {
    vaani_call_id: callId,
    caller_number: caller,
    started_at: startedAt,
    ended_at: endedAt,
    duration_sec: secs,
    after_hours: isAfterHours(startedAt),
    recording_url: pick(d, "recording_url", "recording") ?? null,
    summary: summary ?? null,
    collected: entities,
    transcript: lines,
    cost_voice_inr: costVoice,
    status: "completed",
  };

  // Never lose a lead: if classification fails, store the raw call and email the transcript.
  let lead, llmCost;
  try {
    ({ lead, costInr: llmCost } = await classify(text, summary, startedAt ?? undefined));
  } catch (err) {
    await db().from("calls").upsert({ ...base, classification: "unclear", fit_reason: `AI step failed: ${String(err)}` }, { onConflict: "vaani_call_id" });
    await emailFrontDesk(`[Aangan] AI step failed, please read manually (${caller ?? "unknown"})`, `Error: ${err}\n\n${text || summary || "(no transcript)"}`).catch(() => {});
    return NextResponse.json({ ok: true, classified: false });
  }

  const { data: row, error: rowErr } = await db()
    .from("calls")
    .upsert(
      {
        ...base,
        classification: lead.classification,
        fit_reason: lead.fit_reason,
        asked_pricing: lead.asked_pricing,
        handoff_note: lead.handoff_note,
        booked_slot: bookedSlot,
        cost_llm_inr: llmCost,
      },
      { onConflict: "vaani_call_id" },
    )
    .select("id")
    .single();
  if (rowErr || !row) {
    await emailFrontDesk(`[Aangan] Could not save call ${callId} to the database`, `${rowErr?.message ?? "no row returned"}\n\n${lead.handoff_note}`).catch(() => {});
  }
  const rowId = row?.id as string;

  // Outputs are independent and best-effort.
  if (lead.classification === "qualified") {
    let designerId: string | null = null;
    const email = await (async () => {
      const { data: ds, error: dsErr } = await db().from("designers").select("*").eq("active", true);
      if (dsErr) throw new Error(`designers query failed: ${dsErr.message}`);
      const d1 = ds?.find((x) => lead.segment && x.specialties?.includes(lead.segment) && x.email) ?? ds?.find((x) => x.email);
      if (!d1) throw new Error("no active designer with email");
      designerId = d1.id;
      return emailDesigner({ to: d1.email, callId: rowId, caller, lead, bookedSlot, recordingUrl: base.recording_url });
    })().catch((e) => ({ error: String(e) }));
    const deal = await createDeal(lead, caller).catch((e) => ({ error: String(e) }));
    await db().from("calls").update({
      designer_id: designerId,
      email_message_id: typeof email === "string" ? email : null,
      hubspot_deal_id: typeof deal === "string" ? deal : null,
    }).eq("id", rowId);
    if (typeof email !== "string") {
      await emailFrontDesk(`[Aangan] Designer email failed for ${lead.name ?? caller}`, `${(email as any)?.error ?? ""}\n\n${lead.handoff_note}`).catch(() => {});
    }
  } else if (lead.classification === "complaint") {
    await emailFrontDesk(`[Aangan] COMPLAINT call from ${caller ?? "unknown"}: needs a human`, `${lead.fit_reason}\n\n${lead.handoff_note}\n\n${text}`).catch(() => {});
  }

  return NextResponse.json({ ok: true, classification: lead.classification });
}
