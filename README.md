# Aangan Studio: AI call agent (Case 03)

Vaani answers and qualifies calls → this Next.js app logs them in Supabase, classifies them with Gemini against `knowledge/qualified.md` + `knowledge/services.md`, emails qualified leads to a designer (Resend), creates a HubSpot deal, and shows results and cost on a dashboard.

**The Cut:** the agent never quotes a price. `pricing.md` is not in this repo and is git-ignored. A code-level filter (`stripPrices` in `lib/gemini.ts`) removes price lines from AI output; a caller's own volunteered budget passes through.

## Nine Checks
Kill switches: problem real (48% of ~200 monthly enquiries unanswered in 48h), workflow repeated (~200 calls/month), input available (services + qualified). Sizing: valuable (₹8-14 lakh projects), measurable (response time, bookings, show-ups), ROI worth it. Boundary: failure risk OK except pricing; judgment partly protected (quotes, site-visit/date commitments, complaints stay human); owner clear (agent qualifies and books, designer owns the relationship, Nikhil owns price).

## Component map
```
Caller → Vaani → /api/vaani/webhook?token=…  (call_started, call_postprocessing)
  → Supabase calls → Gemini classify → qualified: designer email + HubSpot deal
                                       complaint: front-desk email
                                       not_fit / unclear: logged only
  → / dashboard (basic auth)      /api/eval (dry run)      /api/lead/claim|reschedule (GET confirm, POST act)
```

## Setup
1. Run `supabase/migrations/001_init.sql` in Supabase → SQL Editor (edit the designer email first).
2. Import this repo in Vercel; set the variables from `.env.example` in Vercel yourself; redeploy after any change.
3. Configure Vaani with `vaani/agent-setup.md`.

## Eval
```bash
APP_URL=https://<app>.vercel.app TOKEN=<VAANI_WEBHOOK_SECRET> ./eval/run.sh T01 T02 T03
```
`eval/cases.json` holds the September phone transcripts with expected classes. T15, T16, T18 are judgement calls (flagged `ambiguous`); T08 is a missed call with no transcript. Gemini's free tier is ~20 requests/day.
