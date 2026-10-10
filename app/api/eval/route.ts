import { NextRequest, NextResponse } from "next/server";
import { classify } from "@/lib/gemini";

export const maxDuration = 60;

// Dry run: no database row, no email, no CRM deal.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== process.env.VAANI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, transcript, now } = await req.json();
  try {
    const { lead } = await classify(String(transcript ?? ""), undefined, now);
    return NextResponse.json({ id, ...lead });
  } catch (e) {
    return NextResponse.json({ id, error: String(e) }, { status: 502 });
  }
}
