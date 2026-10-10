import type { Lead } from "./gemini";

const API = "https://api.hubapi.com";

async function hs(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<any>;
}

// Accounts differ in pipeline and stage names, so use the account's first pipeline and its first stage.
async function firstStage(token: string) {
  const j = await hs("/crm/v3/pipelines/deals", token);
  const pipeline = [...(j.results ?? [])].sort((a: any, b: any) => a.displayOrder - b.displayOrder)[0];
  const stage = [...(pipeline?.stages ?? [])].sort((a: any, b: any) => a.displayOrder - b.displayOrder)[0];
  if (!pipeline || !stage) throw new Error("HubSpot: no deal pipeline or stage found");
  return { pipeline: pipeline.id as string, stage: stage.id as string };
}

// Best-effort. Skipped silently when no token is set; throws on failure so the caller can report it.
export async function createDeal(lead: Lead, caller: string | null): Promise<string | null> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return null;
  const dealname = [lead.name ?? "New lead", lead.property_type ?? lead.segment, lead.area_sqft ? `${lead.area_sqft} sq ft` : lead.location]
    .filter(Boolean)
    .join(" · ");
  const { pipeline, stage } = await firstStage(token);
  const j = await hs("/crm/v3/objects/deals", token, {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname,
        pipeline,
        dealstage: stage,
        description: `${lead.handoff_note}\n\nPhone: ${caller ?? "unknown"}`,
      },
    }),
  });
  return j.id ?? null;
}
