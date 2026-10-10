import type { Lead } from "./gemini";

// Best-effort. Skipped silently when no token is set.
export async function createDeal(lead: Lead, caller: string | null): Promise<string | null> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return null;
  const dealname = [lead.name ?? "New lead", lead.property_type ?? lead.segment, lead.area_sqft ? `${lead.area_sqft} sq ft` : lead.location]
    .filter(Boolean)
    .join(" · ");
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      properties: {
        dealname,
        pipeline: "default",
        dealstage: "appointmentscheduled",
        description: `${lead.handoff_note}\n\nPhone: ${caller ?? "unknown"}`,
      },
    }),
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as any).id ?? null;
}
