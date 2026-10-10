import { readFileSync } from "fs";
import path from "path";

export type Classification = "qualified" | "not_fit" | "complaint" | "unclear";

export type Lead = {
  classification: Classification;
  fit_reason: string;
  asked_pricing: boolean;
  segment: "home" | "office" | null;
  name: string | null;
  property_type: string | null;
  area_sqft: number | null;
  location: string | null;
  scope: string | null;
  timeline: string | null;
  decision_maker: string | null;
  volunteered_budget: string | null;
  source: string | null;
  handoff_note: string;
};

// pricing.md is deliberately never read, here or anywhere.
function knowledge() {
  const dir = path.join(process.cwd(), "knowledge");
  return {
    qualified: readFileSync(path.join(dir, "qualified.md"), "utf8"),
    services: readFileSync(path.join(dir, "services.md"), "utf8"),
  };
}

const RULES = `You classify inbound enquiries to Aangan Studio, a Pune interior design studio, for a designer.
Use ONLY the two documents below as the rubric.

Classes:
- qualified: passes the five criteria (real project with execution; Pune/PCMC; realistic timeline; budget not clearly too low if volunteered; decision-maker on the call or represented). Unclear budget or decision-maker still means qualified, with the doubt stated in handoff_note. A rented flat with no structural changes and a single room with execution are fine.
- not_fit: outside Pune/PCMC, advice/ideas/decor only, restaurants/hotels/retail/gyms, structural work, standalone furniture or Vastu-only, a project that must be ready in under 6 weeks from today, or a volunteered budget clearly too low for the scope.
- complaint: an existing client with a problem, or an angry/upset caller. A human handles it.
- unclear: dropped call or almost no usable information.
Asking about price NEVER disqualifies; set asked_pricing=true and classify on the other criteria.

Output JSON only, with exactly these keys:
classification, fit_reason (name the deciding criterion in one sentence), asked_pricing (bool), segment ("home"|"office"|null), name, property_type, area_sqft (number|null), location, scope, timeline, decision_maker, volunteered_budget (only if the caller said it), source (how they heard of us), handoff_note.
handoff_note: at most 8 short lines for a designer reading on a phone. Plain facts: who, what, where, size, timeline, who decides, open doubts, what was promised. NEVER include any price, rate, per-sq-ft figure, range or estimate of what Aangan would charge. Only repeat a budget if the caller volunteered it, and label it "Caller's budget".`;

// Gemini occasionally returns malformed JSON or a transient error, so try twice before giving up.
export async function classify(transcript: string, summary?: string, nowIso = new Date().toISOString()) {
  try {
    return await classifyOnce(transcript, summary, nowIso);
  } catch {
    return await classifyOnce(transcript, summary, nowIso);
  }
}

async function classifyOnce(transcript: string, summary: string | undefined, nowIso: string) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model) throw new Error("GEMINI_API_KEY / GEMINI_MODEL not set");
  const k = knowledge();
  const today = new Date(nowIso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full" });

  const prompt = `${RULES}

TODAY (IST): ${today}

=== qualified.md ===
${k.qualified}

=== services.md ===
${k.services}

=== CALL TRANSCRIPT ===
${transcript || "(empty)"}
${summary ? `\n=== VAANI SUMMARY ===\n${summary}` : ""}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j: any = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  let parsed: any = JSON.parse(text.replace(/^```json|```$/g, "").trim());
  if (Array.isArray(parsed)) parsed = parsed[0];
  if (parsed?.result && !parsed.classification) parsed = parsed.result;
  if (!parsed?.classification) throw new Error(`Gemini returned no classification: ${text.slice(0, 200)}`);
  const lead = parsed as Lead;

  const inTok = j?.usageMetadata?.promptTokenCount ?? 0;
  const outTok = j?.usageMetadata?.candidatesTokenCount ?? 0;
  const costInr =
    (inTok / 1e6) * Number(process.env.GEMINI_INR_PER_M_INPUT ?? 0) +
    (outTok / 1e6) * Number(process.env.GEMINI_INR_PER_M_OUTPUT ?? 0);

  return { lead: sanitize(lead), costInr };
}

// --- The Cut: code-level price filter -------------------------------------------------------
const PRICE_RE =
  /(₹|\brs\.?\s*\d|\binr\b|\blakhs?\b|\blacs?\b|\bcrores?\b|\bper\s*(sq\.?\s*ft|sqft|square)|\/\s*(sq\.?\s*ft|sqft)|\bcost[s]?\s+(around|about|approx|roughly|between)|\bestimate[ds]?\b|\bquote[ds]?\b|\bapprox(imately)?\s+\d+\s*k\b)/i;
const VOLUNTEERED_RE = /(caller|customer|client|they|she|he)\b.*\b(budget|said|mentioned|volunteered|has)\b|^caller'?s? budget/i;

export function stripPrices(text: string): string {
  return (text ?? "")
    .split("\n")
    .filter((l) => !PRICE_RE.test(l) || VOLUNTEERED_RE.test(l.trim()))
    .join("\n");
}

function sanitize(l: Lead): Lead {
  const ok: Classification[] = ["qualified", "not_fit", "complaint", "unclear"];
  return {
    ...l,
    classification: ok.includes(l.classification) ? l.classification : "unclear",
    asked_pricing: !!l.asked_pricing,
    fit_reason: stripPrices(l.fit_reason ?? ""),
    handoff_note: stripPrices(l.handoff_note ?? ""),
  };
}
