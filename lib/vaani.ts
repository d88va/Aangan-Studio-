// Vaani payloads are loosely documented, so every read here is defensive.

export type TranscriptLine = { t: string | null; role: "AGENT" | "USER"; text: string };

export function pick(obj: any, ...paths: string[]): any {
  for (const p of paths) {
    const v = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// "[hh:mm:ss] AGENT: text" lines -> structured array
export function parseTranscript(raw: unknown): TranscriptLine[] {
  if (Array.isArray(raw)) {
    return raw.map((r: any) => ({
      t: r.time ?? r.t ?? null,
      role: String(r.role ?? r.speaker ?? "").toUpperCase().startsWith("A") ? "AGENT" : "USER",
      text: String(r.text ?? r.content ?? ""),
    }));
  }
  if (typeof raw !== "string") return [];
  const out: TranscriptLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(?:\[(\d{1,2}:\d{2}:\d{2})\]\s*)?(AGENT|USER|FRONT DESK|CALLER)\s*:\s*(.*)$/i);
    if (m) {
      const r = m[2].toUpperCase();
      out.push({ t: m[1] ?? null, role: r === "AGENT" || r === "FRONT DESK" ? "AGENT" : "USER", text: m[3] });
    } else if (out.length && line.trim()) {
      out[out.length - 1].text += " " + line.trim();
    }
  }
  return out;
}

export function transcriptToText(lines: TranscriptLine[]) {
  return lines.map((l) => `${l.role}: ${l.text}`).join("\n");
}

// Vaani sends call_duration in milliseconds and sometimes omits it.
export function durationSec(durationMs: unknown, start?: string | null, end?: string | null) {
  const ms = Number(durationMs);
  if (ms > 0) return Math.round(ms / 1000);
  if (start && end) {
    const d = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    if (d > 0) return Math.round(d);
  }
  return 0;
}

// Office hours are 10:00-19:00 IST.
export function isAfterHours(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d));
  return h < 10 || h >= 19;
}
