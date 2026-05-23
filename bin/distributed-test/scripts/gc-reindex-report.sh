#!/bin/bash
# Captures GC pause statistics during a reindex run and compares them to a saved baseline.
#
# Usage:
#   ./gc-reindex-report.sh --token TOKEN [--server URL] [--gclog PATH] [--save-baseline]
#
# What it does:
#   1. Reads the server's GC log (or polls /api/v1/system/metrics for JVM stats if no GC log)
#   2. Triggers a full reindex
#   3. Polls until the reindex finishes
#   4. Summarises: total STW pause time, max pause, p99 pause, probe failures, throughput
#   5. Optionally saves the result as a baseline for future comparison
#
# GC log note:
#   Start the server with:  -Xlog:gc*:file=/tmp/om-gc.log:time,uptime,tags:filecount=5,filesize=20m
#   Then pass --gclog /tmp/om-gc.log to this script.
#
# Without --gclog the script uses the Prometheus /metrics endpoint to estimate GC pressure.

set -euo pipefail

SERVER_URL="http://localhost:8585"
TOKEN=""
GC_LOG=""
SAVE_BASELINE=false
BASELINE_FILE="$(dirname "$0")/../gc-baseline.json"
POLL_INTERVAL=10   # seconds between status polls

while [[ $# -gt 0 ]]; do
  case $1 in
    --server)       SERVER_URL="$2";  shift 2 ;;
    --token)        TOKEN="$2";       shift 2 ;;
    --gclog)        GC_LOG="$2";      shift 2 ;;
    --save-baseline) SAVE_BASELINE=true; shift ;;
    --baseline)     BASELINE_FILE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# //;s/^#//'
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: --token is required"; exit 1
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ── helpers ───────────────────────────────────────────────────────────────────

jq_required() {
  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required. Install with: brew install jq"; exit 1
  fi
}

curl_json() {
  curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" "$@"
}

# ── capture GC snapshot via /metrics ─────────────────────────────────────────

gc_metrics_snapshot() {
  local label="$1"
  local result
  # Try Prometheus endpoint first (if enabled)
  if result=$(curl -sf -H "$AUTH_HEADER" "${SERVER_URL}/api/v1/system/metrics" 2>/dev/null); then
    local gc_count gc_time
    gc_count=$(echo "$result" | grep '^jvm_gc_pause_seconds_count' | awk '{s+=$NF} END{print int(s)}' || echo 0)
    gc_time=$(echo  "$result" | grep '^jvm_gc_pause_seconds_sum'   | awk '{s+=$NF} END{printf "%.3f", s}' || echo "0.000")
    echo "${label}:gc_count=${gc_count},gc_time_s=${gc_time}"
  else
    echo "${label}:gc_count=N/A,gc_time_s=N/A"
  fi
}

# ── parse GC log (G1GC format) ────────────────────────────────────────────────

parse_gc_log() {
  local logfile="$1"
  if [[ ! -f "$logfile" ]]; then
    echo "GC_LOG_NOT_FOUND"; return
  fi

  python3 - "$logfile" <<'PYEOF'
import re, sys, statistics

log_file = sys.argv[1]
pauses = []

# Match G1GC pause lines: [0.123s][info][gc] GC(0) Pause ... 12.345ms
pause_re = re.compile(r'Pause (?:Young|Full|Initial Mark|Remark|Cleanup)[^0-9]*(\d+\.\d+)ms', re.IGNORECASE)
# Also match: GC(N) Pause ... Nms
generic_re = re.compile(r'\bPause\b.*?(\d+\.\d+)ms')

with open(log_file) as f:
    for line in f:
        m = pause_re.search(line) or generic_re.search(line)
        if m:
            pauses.append(float(m.group(1)))

if not pauses:
    print("no_pauses_found")
    sys.exit(0)

pauses.sort()
p99_idx = max(0, int(len(pauses) * 0.99) - 1)
print(f"count={len(pauses)}")
print(f"total_ms={sum(pauses):.1f}")
print(f"max_ms={max(pauses):.1f}")
print(f"p99_ms={pauses[p99_idx]:.1f}")
print(f"mean_ms={statistics.mean(pauses):.1f}")
PYEOF
}

# ── probe health once ─────────────────────────────────────────────────────────

probe_health() {
  local http_code
  http_code=$(curl -o /dev/null -sf -w "%{http_code}" \
    --max-time 1 \
    -H "$AUTH_HEADER" \
    "${SERVER_URL}/api/v1/system/health" 2>/dev/null || echo "000")
  echo "$http_code"
}

# ── trigger reindex ───────────────────────────────────────────────────────────

trigger_reindex() {
  local payload='{"recreateIndex":false}'
  curl_json -X POST \
    "${SERVER_URL}/api/v1/apps/trigger/SearchIndexingApplication" \
    -d "$payload" > /dev/null 2>&1 || true
  echo "Reindex triggered"
}

# ── poll reindex status ───────────────────────────────────────────────────────

STATS_FILE="/tmp/om-reindex-stats-$$.txt"

poll_until_done() {
  local start_ts
  start_ts=$(date +%s)
  local probe_failures=0
  local probe_total=0
  local max_latency_ms=0
  local probes_over_1000=0
  local consecutive_slow=0
  local max_consecutive_slow=0
  local last_probe_ts=0

  echo ""
  echo "Polling reindex status every ${POLL_INTERVAL}s ..."
  echo "  (probing /system/health every 10s — k8s periodSeconds=10, failureThreshold=3)"
  echo ""

  while true; do
    sleep "$POLL_INTERVAL"
    local now
    now=$(date +%s)

    # Probe health every 10s (k8s default periodSeconds)
    if (( now - last_probe_ts >= 10 )); then
      local t0 code latency
      t0=$(python3 -c "import time; print(int(time.time()*1000))")
      code=$(probe_health)
      latency=$(( $(python3 -c "import time; print(int(time.time()*1000))") - t0 ))
      probe_total=$(( probe_total + 1 ))
      last_probe_ts=$now

      if (( latency > max_latency_ms )); then max_latency_ms=$latency; fi
      if (( latency > 1000 )); then
        probes_over_1000=$(( probes_over_1000 + 1 ))
        consecutive_slow=$(( consecutive_slow + 1 ))
        if (( consecutive_slow > max_consecutive_slow )); then
          max_consecutive_slow=$consecutive_slow
        fi
      else
        consecutive_slow=0
      fi

      if [[ "$code" != "200" ]]; then
        probe_failures=$(( probe_failures + 1 ))
        echo "  [$(date +%H:%M:%S)] PROBE FAIL  code=$code latency=${latency}ms  consecutive=${consecutive_slow}" >&2
      elif (( latency > 1000 )); then
        echo "  [$(date +%H:%M:%S)] SLOW PROBE  latency=${latency}ms  *** >1000ms (k8s timeout risk) consecutive=${consecutive_slow}" >&2
      else
        echo "  [$(date +%H:%M:%S)] probe ok    latency=${latency}ms" >&2
      fi

      if (( max_consecutive_slow >= 3 )); then
        echo "  *** WARNING: ${max_consecutive_slow} consecutive slow probes — k8s WOULD RESTART POD ***" >&2
      fi
    fi

    # Check app status
    local status_json
    status_json=$(curl_json "${SERVER_URL}/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=1" 2>/dev/null || echo '{}')
    local app_status
    app_status=$(echo "$status_json" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  runs=d.get('data',[])
  if runs: print(runs[0].get('status','unknown'))
  else: print('pending')
except: print('unknown')
" 2>/dev/null || echo "unknown")

    if [[ "$app_status" == "success" || "$app_status" == "failed" ]]; then
      local elapsed=$(( now - start_ts ))
      echo "" >&2
      echo "  Reindex finished: status=$app_status  elapsed=${elapsed}s" >&2
      # Write structured results to stats file (not stdout)
      {
        echo "PROBE_FAILURES=$probe_failures"
        echo "PROBE_TOTAL=$probe_total"
        echo "MAX_LATENCY_MS=$max_latency_ms"
        echo "PROBES_OVER_1000=$probes_over_1000"
        echo "MAX_CONSECUTIVE_SLOW=$max_consecutive_slow"
        echo "ELAPSED_S=$elapsed"
      } > "$STATS_FILE"
      return
    fi
  done
}

# ── main ──────────────────────────────────────────────────────────────────────

jq_required

echo "═══════════════════════════════════════════════════════════════"
echo "  GC / Reindex Report  —  $(date)"
echo "  Server: $SERVER_URL"
echo "═══════════════════════════════════════════════════════════════"

# Snapshot before
METRICS_BEFORE=$(gc_metrics_snapshot "before")
GC_LOG_LINES_BEFORE=0
if [[ -n "$GC_LOG" && -f "$GC_LOG" ]]; then
  GC_LOG_LINES_BEFORE=$(wc -l < "$GC_LOG")
  echo "GC log: $GC_LOG  (current lines: $GC_LOG_LINES_BEFORE)"
fi

trigger_reindex

# Poll — probe lines print live to stderr, structured results written to STATS_FILE
poll_until_done

PROBE_FAILURES=$(grep '^PROBE_FAILURES='       "$STATS_FILE" | cut -d= -f2)
PROBE_TOTAL=$(grep    '^PROBE_TOTAL='          "$STATS_FILE" | cut -d= -f2)
MAX_LATENCY=$(grep    '^MAX_LATENCY_MS='       "$STATS_FILE" | cut -d= -f2)
PROBES_OVER_1000=$(grep '^PROBES_OVER_1000='   "$STATS_FILE" | cut -d= -f2)
MAX_CONSECUTIVE=$(grep '^MAX_CONSECUTIVE_SLOW=' "$STATS_FILE" | cut -d= -f2)
ELAPSED_S=$(grep      '^ELAPSED_S='            "$STATS_FILE" | cut -d= -f2)
rm -f "$STATS_FILE"

# Snapshot after
METRICS_AFTER=$(gc_metrics_snapshot "after")

# GC log delta
GC_LOG_STATS=""
if [[ -n "$GC_LOG" && -f "$GC_LOG" ]]; then
  # Extract only lines added since reindex started
  TMPLOG="/tmp/om-gc-run-${TIMESTAMP}.log"
  tail -n "+${GC_LOG_LINES_BEFORE}" "$GC_LOG" > "$TMPLOG"
  GC_LOG_STATS=$(parse_gc_log "$TMPLOG")
  rm -f "$TMPLOG"
fi

# Parse metrics delta
GC_COUNT_BEFORE=$(echo "$METRICS_BEFORE" | sed 's/.*gc_count=\([^,]*\).*/\1/')
GC_TIME_BEFORE=$(echo  "$METRICS_BEFORE" | sed 's/.*gc_time_s=\([^,]*\).*/\1/')
GC_COUNT_AFTER=$(echo  "$METRICS_AFTER"  | sed 's/.*gc_count=\([^,]*\).*/\1/')
GC_TIME_AFTER=$(echo   "$METRICS_AFTER"  | sed 's/.*gc_time_s=\([^,]*\).*/\1/')

# Compute deltas if numeric
GC_COUNT_DELTA="N/A"
GC_TIME_DELTA="N/A"
if [[ "$GC_COUNT_BEFORE" =~ ^[0-9]+$ && "$GC_COUNT_AFTER" =~ ^[0-9]+$ ]]; then
  GC_COUNT_DELTA=$(( GC_COUNT_AFTER - GC_COUNT_BEFORE ))
fi
if [[ "$GC_TIME_BEFORE" =~ ^[0-9.]+$ && "$GC_TIME_AFTER" =~ ^[0-9.]+$ ]]; then
  GC_TIME_DELTA=$(python3 -c "print(f'{float('$GC_TIME_AFTER') - float('$GC_TIME_BEFORE'):.3f}')")
fi

echo ""
echo "══════════════════ RESULTS ════════════════════════════════════"
echo ""
printf "  %-30s  %s\n" "Reindex duration"          "${ELAPSED_S}s"
printf "  %-30s  %s\n" "Health probe total"        "${PROBE_TOTAL}"
printf "  %-30s  %s\n" "Probe failures (non-200)"  "${PROBE_FAILURES:-0}  $([ "${PROBE_FAILURES:-0}" -eq 0 ] && echo '✓ none' || echo '⚠ k8s would have restarted pod')"
printf "  %-30s  %s\n" "Probes >1000ms"            "${PROBES_OVER_1000:-0}  $([ "${PROBES_OVER_1000:-0}" -eq 0 ] && echo '✓ none' || echo '⚠ GC pressure detected')"
printf "  %-30s  %s\n" "Max consecutive >1000ms"   "${MAX_CONSECUTIVE:-0}  $([ "${MAX_CONSECUTIVE:-0}" -lt 3 ] && echo '✓ ok' || echo '*** k8s WOULD RESTART POD ***')"
printf "  %-30s  %s\n" "Max probe latency"         "${MAX_LATENCY:-0}ms  $([ "${MAX_LATENCY:-0}" -lt 1000 ] && echo '✓ ok' || echo '⚠ high')"
echo ""
printf "  %-30s  %s\n" "GC collections (delta)"  "$GC_COUNT_DELTA"
printf "  %-30s  %s\n" "GC pause time (delta)"   "${GC_TIME_DELTA}s"
echo ""

if [[ -n "$GC_LOG_STATS" && "$GC_LOG_STATS" != "no_pauses_found" && "$GC_LOG_STATS" != "GC_LOG_NOT_FOUND" ]]; then
  echo "  GC log pause breakdown:"
  echo "$GC_LOG_STATS" | sed 's/^/    /'
  echo ""
fi

# Build JSON result
RESULT_JSON=$(python3 -c "
import json, sys
result = {
  'timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
  'server': '$SERVER_URL',
  'elapsed_s': int('${ELAPSED_S:-0}'),
  'probe_total': int('${PROBE_TOTAL:-0}'),
  'probe_failures': int('${PROBE_FAILURES:-0}'),
  'probes_over_1000ms': int('${PROBES_OVER_1000:-0}'),
  'max_consecutive_slow': int('${MAX_CONSECUTIVE:-0}'),
  'max_probe_latency_ms': int('${MAX_LATENCY:-0}'),
  'gc_collections_delta': '${GC_COUNT_DELTA}',
  'gc_pause_time_delta_s': '${GC_TIME_DELTA}',
  'gc_log_stats': '${GC_LOG_STATS:-none}'
}
print(json.dumps(result, indent=2))
")

# Compare to baseline
if [[ -f "$BASELINE_FILE" ]]; then
  echo "  Comparison to baseline ($BASELINE_FILE):"
  python3 - "$BASELINE_FILE" <<PYEOF
import json, sys

with open(sys.argv[1]) as f:
    baseline = json.load(f)

current = $RESULT_JSON

def pct(new, old):
    if old == 0: return '+∞%'
    delta = new - old
    return f'{delta/old*100:+.1f}%'

print(f"    {'Metric':<30}  {'Baseline':>12}  {'Current':>12}  {'Change':>10}")
print(f"    {'-'*30}  {'-'*12}  {'-'*12}  {'-'*10}")
for k in ['elapsed_s','probe_failures','probes_over_1000ms','max_consecutive_slow','max_probe_latency_ms']:
    b = baseline.get(k, 'N/A')
    c = current.get(k, 'N/A')
    change = pct(c, b) if isinstance(b, (int,float)) and isinstance(c, (int,float)) else 'N/A'
    print(f"    {k:<30}  {str(b):>12}  {str(c):>12}  {change:>10}")
PYEOF
  echo ""
fi

# Save result
OUT_FILE="gc-report-${TIMESTAMP}.json"
echo "$RESULT_JSON" > "$OUT_FILE"
echo "  Report saved to: $OUT_FILE"

if [[ "$SAVE_BASELINE" == "true" ]]; then
  cp "$OUT_FILE" "$BASELINE_FILE"
  echo "  Saved as baseline: $BASELINE_FILE"
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  Tip: Run once with --save-baseline to record a baseline, then"
echo "       run again after code changes to see the delta."
echo ""
