import type { Lead } from "./gemini";
import { signedLink } from "./links";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function send(to: string, subject: string, html: string): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as any).id ?? null;
}

export async function emailDesigner(opts: {
  to: string;
  callId: string;
  caller: string | null;
  lead: Lead;
  bookedSlot?: string | null;
  recordingUrl?: string | null;
}) {
  const { lead: l } = opts;
  const slot = opts.bookedSlot
    ? new Date(opts.bookedSlot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    : null;
  const title = `${l.name ?? "New lead"} · ${l.property_type ?? l.segment ?? "enquiry"} · ${l.location ?? "Pune"}`;
  const btn = (href: string, label: string, bg: string) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 16px;border-radius:8px;background:${bg};color:#fff;text-decoration:none;font-weight:600">${label}</a>`;
  const booking = process.env.CALCOM_BOOKING_URL;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 4px">${esc(title)}</h2>
  <p style="margin:0 0 12px;color:#555">${slot ? `Consultation slot: <b>${esc(slot)}</b>` : "No slot captured on the call"}
  ${opts.caller ? ` · Phone: <b>${esc(opts.caller)}</b>` : ""}</p>
  <pre style="white-space:pre-wrap;font:14px/1.5 system-ui;background:#f6f6f4;padding:12px;border-radius:8px">${esc(l.handoff_note)}</pre>
  ${l.asked_pricing ? `<p style="color:#8a5a00">Caller asked about pricing. The agent deflected to you on the consultation.</p>` : ""}
  <p style="color:#555">Why qualified: ${esc(l.fit_reason)}</p>
  <p>${btn(signedLink("claim", opts.callId), "Claim this lead", "#1f6f4a")}
     ${btn(signedLink("reschedule", opts.callId), "Reschedule", "#8a5a00")}
     ${booking ? btn(booking, "Booking link", "#333") : ""}</p>
  ${opts.recordingUrl ? `<p><a href="${esc(opts.recordingUrl)}">Call recording</a></p>` : ""}
</div>`;
  return send(opts.to, `New qualified lead: ${title}${slot ? ` (${slot})` : ""}`, html);
}

export async function emailFrontDesk(subject: string, body: string) {
  const to = process.env.FRONT_DESK_EMAIL;
  if (!to) throw new Error("FRONT_DESK_EMAIL not set");
  return send(to, subject, `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui">${esc(body)}</pre>`);
}
