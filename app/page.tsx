import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : "–";

const STATUS: Record<string, { label: string; dot: string }> = {
  qualified: { label: "Qualified", dot: "#3F6B52" },
  not_fit: { label: "Not a fit", dot: "#8A8A84" },
  complaint: { label: "Complaint", dot: "#B4533A" },
  unclear: { label: "Unclear", dot: "#A8832A" },
};

const css = `
.dash{--ink:#1C1C1A;--muted:#5E5E58;--line:#D9D7D0;--sage:#3F6B52;background:#F6F5F1;color:var(--ink);min-height:100vh;padding:56px 24px 72px;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.dash *{box-sizing:border-box}
.wrap{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:64px}
.top{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px}
.brand{display:flex;align-items:baseline;gap:12px}
.brand b{font-size:22px;font-weight:600;letter-spacing:-.01em}
.muted{color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px}
.stat{border-top:1px solid var(--line);padding-top:16px;display:flex;flex-direction:column;gap:6px}
.stat .n{font-size:56px;font-weight:300;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.small{font-size:13px;color:var(--muted)}
.minor{display:flex;flex-wrap:wrap;gap:8px 40px;font-size:14px;color:var(--muted);margin-top:40px}
.minor b{color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums}
h2{margin:0 0 20px;font-size:15px;font-weight:500}
.fun{display:flex;flex-direction:column;gap:16px}
.frow{display:flex;align-items:center;gap:16px;font-size:14px}
.frow .l{width:110px;flex-shrink:0;color:var(--muted)}
.bar{flex-grow:1;height:8px;background:#E7E5DE;border-radius:4px;overflow:hidden}
.bar i{display:block;height:8px;background:var(--sage);border-radius:4px}
.frow .v{width:28px;text-align:right;font-weight:500;font-variant-numeric:tabular-nums}
.row{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 24px;padding:16px 0;border-top:1px solid var(--line);font-size:14px}
.row .w{width:120px;flex-shrink:0;color:var(--muted)}
.row .s{width:130px;flex-shrink:0;display:flex;align-items:center;gap:8px;font-weight:500}
.row .s i{width:8px;height:8px;border-radius:50%;display:inline-block}
.row .r{flex:1 1 260px;line-height:1.5;color:#3A3A36}
.row .x{color:var(--muted);white-space:nowrap}
.empty{padding:24px 0;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
.foot{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:20px}
@media (max-width:560px){.dash{padding:32px 16px 48px}.stat .n{font-size:44px}}
`;

export default async function Dashboard() {
  const [{ data: days }, { data: calls }] = await Promise.all([
    db().from("daily_metrics").select("*").limit(30),
    db()
      .from("calls")
      .select("id,caller_number,started_at,after_hours,classification,fit_reason,asked_pricing,booked_slot,claimed_by")
      .order("started_at", { ascending: false })
      .limit(20),
  ]);
  const sum = (k: string) => (days ?? []).reduce((a: number, d: any) => a + Number(d[k] ?? 0), 0);
  const total = sum("calls");
  const qualified = sum("qualified");
  const booked = sum("booked");

  const headline = [
    { label: "Calls answered", value: total, note: "Every call picked up" },
    { label: "After hours", value: sum("after_hours_calls"), note: "Outside 10 am to 7 pm" },
    { label: "Qualified", value: qualified, note: "Sent to a designer" },
    { label: "Booked", value: booked, note: "Consultation slot set" },
  ];
  const funnel = [
    { label: "Calls", value: total },
    { label: "Qualified", value: qualified },
    { label: "Booked", value: booked },
  ];
  const pct = (v: number) => (total ? `${Math.round((v / total) * 100)}%` : "0%");

  return (
    <main className="dash">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="wrap">
        <div className="top">
          <div className="brand">
            <b>Aangan</b>
            <span className="muted">Call agent</span>
          </div>
          <span className="small" style={{ fontSize: 14 }}>Last 30 days</span>
        </div>

        <section>
          <div className="stats">
            {headline.map((s) => (
              <div className="stat" key={s.label}>
                <span className="muted" style={{ fontSize: 14 }}>{s.label}</span>
                <span className="n">{s.value}</span>
                <span className="small">{s.note}</span>
              </div>
            ))}
          </div>
          <div className="minor">
            <span>Show-ups <b>{sum("showed_up")}</b></span>
            <span>Projects won <b>{sum("won")}</b></span>
            <span>Running cost <b>{inr(sum("cost_inr"))}</b></span>
          </div>
        </section>

        <section>
          <h2>From call to consultation</h2>
          <div className="fun">
            {funnel.map((f) => (
              <div className="frow" key={f.label}>
                <span className="l">{f.label}</span>
                <div className="bar"><i style={{ width: pct(f.value) }} /></div>
                <span className="v">{f.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ marginBottom: 12 }}>Recent calls</h2>
          {(calls ?? []).length === 0 && <div className="empty">No calls yet. They will appear here as they come in.</div>}
          {(calls ?? []).map((c: any) => {
            const st = STATUS[c.classification] ?? { label: "Processing", dot: "#8A8A84" };
            const extra = c.booked_slot ? when(c.booked_slot) : c.claimed_by ? `Claimed by ${c.claimed_by}` : "";
            return (
              <div className="row" key={c.id}>
                <span className="w">{when(c.started_at)}{c.after_hours ? " · night" : ""}</span>
                <span className="s"><i style={{ background: st.dot }} />{st.label}</span>
                <span className="r">{c.fit_reason}{c.asked_pricing ? " Asked about price." : ""}</span>
                <span className="x">{extra}</span>
              </div>
            );
          })}
        </section>

        <div className="foot">The agent never quotes a price. Pricing is for the designer to discuss at the consultation.</div>
      </div>
    </main>
  );
}
