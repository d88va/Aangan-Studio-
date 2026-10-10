import { NextRequest } from "next/server";
import { db } from "./supabase";
import { LinkAction, verifyLink } from "./links";

const page = (title: string, inner: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center"><h2>${title}</h2>${inner}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

// GET only shows a confirm page, so email link scanners can't trigger anything. POST records the action.
export function leadHandlers(action: LinkAction) {
  const verb = action === "claim" ? "Claim this lead" : "Request a reschedule";
  const valid = (p: URLSearchParams) => verifyLink(action, p.get("c") ?? "", p.get("e") ?? "", p.get("s") ?? "");

  return {
    GET(req: NextRequest) {
      const p = req.nextUrl.searchParams;
      if (!valid(p)) return page("Link invalid or expired", "", 400);
      return page(
        verb,
        `<form method="POST" action="?${p}">
          ${action === "claim" ? `<input name="name" placeholder="Your name" required style="padding:10px;width:80%;margin:8px 0"><br>` : ""}
          <button style="padding:10px 18px;border:0;border-radius:8px;background:#1f6f4a;color:#fff;font-size:16px">Confirm</button></form>`,
      );
    },
    async POST(req: NextRequest) {
      const p = req.nextUrl.searchParams;
      if (!valid(p)) return page("Link invalid or expired", "", 400);
      const id = p.get("c")!;
      if (action === "claim") {
        const name = String((await req.formData()).get("name") ?? "").slice(0, 80) || "designer";
        const { data } = await db().from("calls").select("claimed_by").eq("id", id).single();
        if (data?.claimed_by) return page("Already claimed", `<p>Claimed by ${data.claimed_by.replace(/[<>&]/g, "")}.</p>`);
        await db().from("calls").update({ claimed_by: name, claimed_at: new Date().toISOString() }).eq("id", id);
        return page("Lead claimed", "<p>It's yours. Please call the lead.</p>");
      }
      await db().from("calls").update({ reschedule_requested_at: new Date().toISOString() }).eq("id", id);
      return page("Reschedule requested", "<p>The front desk has been notified.</p>");
    },
  };
}
