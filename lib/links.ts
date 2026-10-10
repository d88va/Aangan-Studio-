import { createHmac, timingSafeEqual } from "crypto";

export type LinkAction = "claim" | "reschedule";

function sign(action: LinkAction, callId: string, exp: number) {
  const secret = process.env.LINK_SECRET;
  if (!secret) throw new Error("LINK_SECRET not set");
  return createHmac("sha256", secret).update(`${action}:${callId}:${exp}`).digest("hex");
}

export function signedLink(action: LinkAction, callId: string, days = 14) {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const q = new URLSearchParams({ c: callId, e: String(exp), s: sign(action, callId, exp) });
  return `${process.env.APP_URL}/api/lead/${action}?${q}`;
}

export function verifyLink(action: LinkAction, callId: string, exp: string, sig: string) {
  const e = Number(exp);
  if (!callId || !e || !sig || e < Date.now() / 1000) return false;
  const a = Buffer.from(sign(action, callId, e));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
