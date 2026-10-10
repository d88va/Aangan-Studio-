import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default async function Dashboard() {
  const [{ data: days }, { data: calls }] = await Promise.all([
    db().from("daily_metrics").select("*").limit(30),
    db().from("calls").select("id,caller_number,started_at,after_hours,classification,fit_reason,asked_pricing,booked_slot,claimed_by,duration_sec,cost_voice_inr,cost_llm_inr").order("started_at", { ascending: false }).limit(25),
  ]);
  const sum = (k: string) => (days ?? []).reduce((a: number, d: any) => a + Number(d[k] ?? 0), 0);
  const tiles = [
    ["Calls", sum("calls")],
    ["After hours", sum("after_hours_calls")],
    ["Qualified", sum("qualified")],
    ["Booked", sum("booked")],
    ["Show-ups", sum("showed_up")],
    ["Won", sum("won")],
    ["Cost", inr(sum("cost_inr"))],
  ];
  const th = { textAlign: "left" as const, padding: "6px 8px", borderBottom: "1px solid #ddd", fontSize: 12, color: "#666" };
  const td = { padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 14, verticalAlign: "top" as const };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Aangan call agent · last 30 days</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, margin: "16px 0" }}>
        {tiles.map(([label, v]) => (
          <div key={String(label)} style={{ background: "#fff", border: "1px solid #e5e5e0", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 16 }}>Recent calls</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>{["When (IST)", "Caller", "Class", "Why", "Booked", "Claimed", "Cost"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(calls ?? []).map((c: any) => (
              <tr key={c.id}>
                <td style={td}>{c.started_at ? new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }) : "-"}{c.after_hours ? " 🌙" : ""}</td>
                <td style={td}>{c.caller_number ?? "-"}</td>
                <td style={td}><b>{c.classification ?? "-"}</b>{c.asked_pricing ? " · asked price" : ""}</td>
                <td style={{ ...td, maxWidth: 300 }}>{c.fit_reason}</td>
                <td style={td}>{c.booked_slot ? new Date(c.booked_slot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }) : "-"}</td>
                <td style={td}>{c.claimed_by ?? "-"}</td>
                <td style={td}>{inr(Number(c.cost_voice_inr) + Number(c.cost_llm_inr))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
