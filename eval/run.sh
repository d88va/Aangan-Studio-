#!/usr/bin/env bash
# Usage: APP_URL=https://your-app.vercel.app TOKEN=<VAANI_WEBHOOK_SECRET> ./eval/run.sh [T01 T02 ...]
# Free Gemini tier is ~20 requests/day, so pass ids to run a subset. Needs curl + python3.
set -euo pipefail
cd "$(dirname "$0")"
: "${APP_URL:?set APP_URL}"; : "${TOKEN:?set TOKEN}"
python3 -I - "$@" <<'PY'
import json,sys,os,urllib.request,time
want=set(sys.argv[1:])
ok=tot=0
print(f"{'id':5} {'expected':10} {'got':10} price? reason")
for c in json.load(open("cases.json")):
    if want and c["id"] not in want: continue
    req=urllib.request.Request(f"{os.environ['APP_URL']}/api/eval?token={os.environ['TOKEN']}",
        data=json.dumps({"id":c["id"],"transcript":c["transcript"],"now":"2026-09-30T10:00:00+05:30"}).encode(),
        headers={"content-type":"application/json"})
    try: r=json.load(urllib.request.urlopen(req,timeout=90))
    except Exception as e: r={"classification":"ERROR","fit_reason":str(e)}
    good=r.get("classification")==c["expected"]
    tot+=1; ok+=good
    flag="" if good else (" (ambiguous)" if c["ambiguous"] else " <-- MISS")
    print(f"{c['id']:5} {c['expected']:10} {str(r.get('classification')):10} {str(r.get('asked_pricing')):6} {str(r.get('fit_reason'))[:80]}{flag}")
    time.sleep(4)
print(f"\n{ok}/{tot} match")
PY
