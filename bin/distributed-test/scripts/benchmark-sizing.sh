#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_TEST="$SCRIPT_DIR/perf-test.sh"

# ─── Defaults ───────────────────────────────────────────────────────────────────
SERVER="http://localhost:8585"
WORKERS=30
OUTPUT_DIR="./sizing-results"
START_SCALE="10k"
END_SCALE="xlarge"
MODES="seq,realistic"
ADMIN_PORT=""
TOKEN=""
RAMP=false
SKIP_EXISTING=false
MIXED=false
MIXED_DURATION=60
NO_BREAK=false

# ─── Scale Ladder (ordered) ────────────────────────────────────────────────────
ALL_SCALES=(10k 50k 100k 200k 500k large xlarge)

# ─── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Usage ──────────────────────────────────────────────────────────────────────
usage() {
    cat <<'EOF'
Usage: benchmark-sizing.sh [OPTIONS]

Progressive benchmark runner that loops through scale tiers, runs perf-test.sh
at each tier, captures JSON outputs, and generates a final comparison report.

Scale Ladder: 10k → 50k → 100k → 200k → 500k → large (~2M) → xlarge (~5M)

OPTIONS:
  --server URL            Target server (default: http://localhost:8585)
  --workers NUM           Worker count for all runs (default: 30)
  --output-dir DIR        Directory for JSON reports + final summary (default: ./sizing-results)
  --start-scale PRESET    First scale tier to run (default: 10k)
  --end-scale PRESET      Last scale tier to run (default: xlarge)
  --modes MODES           Comma-separated: seq, realistic, or both (default: seq,realistic)
  --admin-port PORT       Pass through to perf-test.sh for server diagnostics
  --token TOKEN           Auth token pass-through
  --ramp                  Run ramp test at first tier to find optimal workers
  --skip-existing         Skip tiers that already have JSON output in output-dir
  --mixed                 Also run mixed read/write workload at each tier
  --mixed-duration SECS   Duration for mixed workload (default: 60)
  --no-break              Don't stop at break-points, run all tiers regardless
  -h, --help              Show this help message

EXAMPLES:
  # Quick 2-tier test
  benchmark-sizing.sh --start-scale 10k --end-scale 50k

  # Full progressive benchmark with ramp and mixed workloads
  benchmark-sizing.sh --ramp --mixed --output-dir /data/sizing

  # Resume after failure (skips completed tiers)
  benchmark-sizing.sh --skip-existing --output-dir ./sizing-results

  # Single mode only
  benchmark-sizing.sh --modes realistic --end-scale 500k
EOF
    exit 0
}

# ─── Parse Arguments ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --server)       SERVER="$2"; shift 2 ;;
        --workers)      WORKERS="$2"; shift 2 ;;
        --output-dir)   OUTPUT_DIR="$2"; shift 2 ;;
        --start-scale)  START_SCALE="$2"; shift 2 ;;
        --end-scale)    END_SCALE="$2"; shift 2 ;;
        --modes)        MODES="$2"; shift 2 ;;
        --admin-port)   ADMIN_PORT="$2"; shift 2 ;;
        --token)        TOKEN="$2"; shift 2 ;;
        --ramp)         RAMP=true; shift ;;
        --skip-existing) SKIP_EXISTING=true; shift ;;
        --mixed)        MIXED=true; shift ;;
        --mixed-duration) MIXED_DURATION="$2"; shift 2 ;;
        --no-break)     NO_BREAK=true; shift ;;
        -h|--help)      usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

# ─── Validate ───────────────────────────────────────────────────────────────────
if [[ ! -f "$PERF_TEST" ]]; then
    echo -e "${RED}Error: perf-test.sh not found at $PERF_TEST${NC}"
    exit 1
fi

validate_scale() {
    local scale="$1"
    for s in "${ALL_SCALES[@]}"; do
        [[ "$s" == "$scale" ]] && return 0
    done
    echo -e "${RED}Error: Invalid scale '$scale'. Valid: ${ALL_SCALES[*]}${NC}"
    exit 1
}

validate_scale "$START_SCALE"
validate_scale "$END_SCALE"

# ─── Resolve Scale Range ───────────────────────────────────────────────────────
resolve_scales() {
    local start="$1" end="$2"
    local collecting=false
    SCALES=()
    for s in "${ALL_SCALES[@]}"; do
        [[ "$s" == "$start" ]] && collecting=true
        if $collecting; then
            SCALES+=("$s")
        fi
        [[ "$s" == "$end" ]] && break
    done
    if [[ ${#SCALES[@]} -eq 0 ]]; then
        echo -e "${RED}Error: No scales resolved between $start and $end${NC}"
        exit 1
    fi
}

resolve_scales "$START_SCALE" "$END_SCALE"

# ─── Parse Modes ────────────────────────────────────────────────────────────────
IFS=',' read -ra MODE_LIST <<< "$MODES"
for m in "${MODE_LIST[@]}"; do
    if [[ "$m" != "seq" && "$m" != "realistic" ]]; then
        echo -e "${RED}Error: Invalid mode '$m'. Valid: seq, realistic${NC}"
        exit 1
    fi
done

# ─── Setup Output Directory ────────────────────────────────────────────────────
mkdir -p "$OUTPUT_DIR"
SUMMARY_CSV="$OUTPUT_DIR/.sizing-progress.csv"
SUMMARY_MD="$OUTPUT_DIR/SIZING-SUMMARY.md"
LOG_FILE="$OUTPUT_DIR/benchmark-sizing.log"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg" >> "$LOG_FILE"
    echo -e "$msg"
}

# ─── Print Banner ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  OpenMetadata Progressive Cluster Sizing Benchmark${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Server:       ${CYAN}$SERVER${NC}"
echo -e "  Workers:      ${CYAN}$WORKERS${NC}"
echo -e "  Scale range:  ${CYAN}${SCALES[*]}${NC}"
echo -e "  Modes:        ${CYAN}${MODE_LIST[*]}${NC}"
echo -e "  Output:       ${CYAN}$OUTPUT_DIR${NC}"
echo -e "  Ramp test:    ${CYAN}$RAMP${NC}"
echo -e "  Mixed:        ${CYAN}$MIXED${NC}"
echo -e "  No-break:     ${CYAN}$NO_BREAK${NC}"
[[ -n "$ADMIN_PORT" ]] && echo -e "  Admin port:   ${CYAN}$ADMIN_PORT${NC}"
echo ""

# ─── Connectivity Check ────────────────────────────────────────────────────────
log "Checking server connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SERVER/api/v1/system/version" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "000" ]]; then
    echo -e "${RED}Error: Cannot reach $SERVER (connection refused or timeout)${NC}"
    exit 1
elif [[ "$HTTP_CODE" -ge 400 ]]; then
    echo -e "${YELLOW}Warning: Server returned HTTP $HTTP_CODE (may need auth token)${NC}"
fi
log "Server reachable (HTTP $HTTP_CODE)"

# ─── Build perf-test.sh Base Args ──────────────────────────────────────────────
build_perf_args() {
    local scale="$1" mode="$2" output_file="$3"
    local args=()
    args+=(--server "$SERVER")
    args+=(--workers "$WORKERS")
    args+=(--scale "$scale")
    args+=(--output "$output_file")
    [[ -n "$ADMIN_PORT" ]] && args+=(--admin-port "$ADMIN_PORT")
    [[ -n "$TOKEN" ]] && args+=(--token "$TOKEN")
    [[ "$mode" == "realistic" ]] && args+=(--realistic)
    if $MIXED; then
        args+=(--mixed)
        args+=(--mixed-duration "$MIXED_DURATION")
    fi
    echo "${args[@]}"
}

# ─── Extract Metrics from JSON ──────────────────────────────────────────────────
extract_metrics() {
    local json_file="$1"
    if [[ ! -f "$json_file" ]]; then
        echo "N/A,0,0,0,0,0,N/A"
        return
    fi

    python3 -c "
import json, sys

with open('$json_file') as f:
    data = json.load(f)

overall = data.get('overall', {})
sizing = data.get('cluster_sizing', {})
server = data.get('server_info', {})

total = overall.get('total_entities_created', 0)
rps = overall.get('overall_throughput_rps', 0)
error_rate = overall.get('overall_error_rate_pct', 0)
wall_clock = overall.get('total_wall_clock_s', 0)
assessment = sizing.get('assessment', 'unknown')

# Find max p95 and p99 across write entities
max_p95 = 0
max_p99 = 0
entities = data.get('entities', {})
for name, ent in entities.items():
    if name.startswith('read_') or name.startswith('mixed_'):
        continue
    lat = ent.get('latency_ms', {})
    p95 = lat.get('p95', 0)
    p99 = lat.get('p99', 0)
    if p95 > max_p95:
        max_p95 = p95
    if p99 > max_p99:
        max_p99 = p99

print(f'{total},{rps:.1f},{max_p95:.0f},{max_p99:.0f},{error_rate:.2f},{wall_clock:.0f},{assessment}')
" 2>/dev/null || echo "N/A,0,0,0,0,0,error"
}

# ─── Extract Config Summary from JSON ───────────────────────────────────────────
extract_config() {
    local json_file="$1"
    if [[ ! -f "$json_file" ]]; then
        echo "N/A"
        return
    fi

    python3 -c "
import json
with open('$json_file') as f:
    data = json.load(f)
cs = data.get('cluster_sizing', {}).get('config_summary', [])
print('; '.join(cs) if cs else 'N/A')
" 2>/dev/null || echo "N/A"
}

# ─── Extract Server Info ────────────────────────────────────────────────────────
extract_server_info() {
    local json_file="$1"
    python3 -c "
import json
with open('$json_file') as f:
    data = json.load(f)
si = data.get('server_info', {})
version = si.get('version', 'unknown')
diag = data.get('diagnostics_before', {})
jvm = diag.get('jvm', {})
heap_max = jvm.get('heap_max_bytes', 0)
heap_gb = heap_max / (1024**3) if heap_max else 0
jetty = diag.get('jetty', {})
max_threads = jetty.get('threads_max', 'unknown')
db = diag.get('database', {})
db_pool = db.get('pool_max', 'unknown')
print(f'Version: {version}')
print(f'Heap: {heap_gb:.1f}GB')
print(f'Threads: {max_threads}')
print(f'DB Pool: {db_pool}')
" 2>/dev/null || echo "Version: unknown"
}

# ─── Break-point Detection ──────────────────────────────────────────────────────
PREV_RPS_PER_ENTITY=""

is_broken() {
    local metrics="$1"
    IFS=',' read -r total rps p95 p99 error_rate wall_clock assessment <<< "$metrics"

    [[ "$assessment" == "undersized" ]] && return 0

    if python3 -c "exit(0 if float('$error_rate') > 10 else 1)" 2>/dev/null; then
        return 0
    fi

    if python3 -c "exit(0 if float('$p95') > 10000 else 1)" 2>/dev/null; then
        return 0
    fi

    if [[ -n "$PREV_RPS_PER_ENTITY" && "$total" != "0" && "$total" != "N/A" ]]; then
        if python3 -c "
curr_rpe = float('$rps') / max(float('$total'), 1)
prev_rpe = float('$PREV_RPS_PER_ENTITY')
exit(0 if prev_rpe > 0 and curr_rpe / prev_rpe < 0.5 else 1)
" 2>/dev/null; then
            return 0
        fi
    fi

    return 1
}

# ─── Results Tracking ──────────────────────────────────────────────────────────
declare -a RESULT_LINES=()
BREAK_SCALE=""
BREAK_MODE=""
BREAK_REASON=""

add_result() {
    local scale="$1" mode="$2" metrics="$3" config="$4"
    RESULT_LINES+=("$scale,$mode,$metrics,$config")
}

# ─── Optional Ramp Test ────────────────────────────────────────────────────────
if $RAMP; then
    FIRST_SCALE="${SCALES[0]}"
    log "${BOLD}Running ramp test at scale $FIRST_SCALE to find optimal workers...${NC}"
    RAMP_OUTPUT="$OUTPUT_DIR/sizing-${FIRST_SCALE}-ramp.json"

    RAMP_ARGS=(--server "$SERVER" --workers "$WORKERS" --scale "$FIRST_SCALE" --ramp --output "$RAMP_OUTPUT")
    [[ -n "$ADMIN_PORT" ]] && RAMP_ARGS+=(--admin-port "$ADMIN_PORT")
    [[ -n "$TOKEN" ]] && RAMP_ARGS+=(--token "$TOKEN")

    if $SKIP_EXISTING && [[ -f "$RAMP_OUTPUT" ]]; then
        log "Ramp output exists, skipping (--skip-existing)"
    else
        log "Running: perf-test.sh ${RAMP_ARGS[*]}"
        if "$PERF_TEST" "${RAMP_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"; then
            OPTIMAL=$(python3 -c "
import json
with open('$RAMP_OUTPUT') as f:
    data = json.load(f)
rt = data.get('ramp_test', {})
print(rt.get('optimal_workers', $WORKERS))
" 2>/dev/null || echo "$WORKERS")
            log "${GREEN}Ramp test complete. Optimal workers: $OPTIMAL${NC}"
            echo -e "\n${YELLOW}Ramp test suggests $OPTIMAL workers. Current setting: $WORKERS${NC}"
            echo -e "${YELLOW}To use the suggested value, re-run with --workers $OPTIMAL${NC}\n"
        else
            log "${YELLOW}Ramp test failed, continuing with $WORKERS workers${NC}"
        fi
    fi
fi

# ─── Main Benchmark Loop ──────────────────────────────────────────────────────
BENCHMARK_START=$(date +%s)
TOTAL_TIERS=${#SCALES[@]}
TIER_NUM=0
BROKEN=false

for scale in "${SCALES[@]}"; do
    TIER_NUM=$((TIER_NUM + 1))

    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  Tier $TIER_NUM/$TOTAL_TIERS: scale=$scale${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    for mode in "${MODE_LIST[@]}"; do
        OUTPUT_FILE="$OUTPUT_DIR/sizing-${scale}-${mode}.json"
        MODE_LABEL=$([[ "$mode" == "seq" ]] && echo "sequential" || echo "realistic")

        log "  [$scale / $MODE_LABEL] Starting..."

        if $SKIP_EXISTING && [[ -f "$OUTPUT_FILE" ]]; then
            log "  [$scale / $MODE_LABEL] Output exists, skipping (--skip-existing)"
            METRICS=$(extract_metrics "$OUTPUT_FILE")
            CONFIG=$(extract_config "$OUTPUT_FILE")
            add_result "$scale" "$mode" "$METRICS" "$CONFIG"

            IFS=',' read -r _total _rps _p95 _p99 _err _wall _assess <<< "$METRICS"
            echo -e "  ${GREEN}[SKIP]${NC} $scale/$MODE_LABEL: ${_total} entities, ${_rps} RPS, p95=${_p95}ms, err=${_err}%, ${_assess}"
            continue
        fi

        PERF_ARGS=$(build_perf_args "$scale" "$mode" "$OUTPUT_FILE")
        log "  Running: perf-test.sh $PERF_ARGS"

        RUN_START=$(date +%s)
        EXIT_CODE=0
        # shellcheck disable=SC2086
        "$PERF_TEST" $PERF_ARGS 2>&1 | tee -a "$LOG_FILE" || EXIT_CODE=$?
        RUN_END=$(date +%s)
        RUN_DURATION=$((RUN_END - RUN_START))

        if [[ $EXIT_CODE -ne 0 ]]; then
            log "  ${RED}[$scale / $MODE_LABEL] FAILED (exit code $EXIT_CODE) after ${RUN_DURATION}s${NC}"
            add_result "$scale" "$mode" "FAILED,0,0,0,100,${RUN_DURATION},failed" "N/A"
            BREAK_SCALE="$scale"
            BREAK_MODE="$mode"
            BREAK_REASON="perf-test.sh exited with code $EXIT_CODE"
            BROKEN=true
            break
        fi

        METRICS=$(extract_metrics "$OUTPUT_FILE")
        CONFIG=$(extract_config "$OUTPUT_FILE")
        add_result "$scale" "$mode" "$METRICS" "$CONFIG"

        IFS=',' read -r _total _rps _p95 _p99 _err _wall _assess <<< "$METRICS"
        log "  ${GREEN}[$scale / $MODE_LABEL] Done:${NC} ${_total} entities, ${_rps} RPS, p95=${_p95}ms, err=${_err}%, ${_assess} (${RUN_DURATION}s)"

        if is_broken "$METRICS"; then
            if [[ "$_assess" == "undersized" ]]; then
                reason="Cluster assessed as undersized"
            elif python3 -c "exit(0 if float('$_err') > 10 else 1)" 2>/dev/null; then
                reason="Error rate ${_err}% exceeds 10% threshold"
            elif python3 -c "exit(0 if float('$_p95') > 10000 else 1)" 2>/dev/null; then
                reason="p95 latency ${_p95}ms exceeds 10s threshold"
            else
                reason="Throughput degraded >50% from previous tier"
            fi

            if $NO_BREAK; then
                echo -e "\n  ${YELLOW}${BOLD}BREAK-POINT WOULD FIRE at $scale/$MODE_LABEL: $reason (--no-break, continuing)${NC}\n"
                log "BREAK-POINT SUPPRESSED at $scale/$MODE_LABEL: $reason (--no-break)"
                if [[ -z "$BREAK_SCALE" ]]; then
                    BREAK_SCALE="$scale"
                    BREAK_MODE="$mode"
                    BREAK_REASON="$reason (continued with --no-break)"
                fi
            else
                BREAK_SCALE="$scale"
                BREAK_MODE="$mode"
                BREAK_REASON="$reason"
                echo -e "\n  ${RED}${BOLD}BREAK-POINT DETECTED at $scale/$MODE_LABEL: $BREAK_REASON${NC}\n"
                log "BREAK-POINT DETECTED at $scale/$MODE_LABEL: $BREAK_REASON"
                BROKEN=true
                break
            fi
        fi

        if [[ "$_total" != "0" && "$_total" != "N/A" ]]; then
            PREV_RPS_PER_ENTITY=$(python3 -c "print(float('$_rps') / max(float('$_total'), 1))" 2>/dev/null || echo "")
        fi
    done

    if $BROKEN; then
        break
    fi

    # Tier comparison
    if [[ ${#MODE_LIST[@]} -gt 1 ]]; then
        SEQ_FILE="$OUTPUT_DIR/sizing-${scale}-seq.json"
        REAL_FILE="$OUTPUT_DIR/sizing-${scale}-realistic.json"
        if [[ -f "$SEQ_FILE" && -f "$REAL_FILE" ]]; then
            echo ""
            echo -e "  ${CYAN}Tier $scale comparison:${NC}"
            SEQ_M=$(extract_metrics "$SEQ_FILE")
            REAL_M=$(extract_metrics "$REAL_FILE")
            IFS=',' read -r s_total s_rps s_p95 s_p99 s_err s_wall s_assess <<< "$SEQ_M"
            IFS=',' read -r r_total r_rps r_p95 r_p99 r_err r_wall r_assess <<< "$REAL_M"
            printf "  %-12s  %8s  %8s  %8s  %8s  %10s\n" "" "Entities" "RPS" "p95ms" "Errors%" "Assessment"
            printf "  %-12s  %8s  %8s  %8s  %8s  %10s\n" "Sequential" "$s_total" "$s_rps" "$s_p95" "${s_err}%" "$s_assess"
            printf "  %-12s  %8s  %8s  %8s  %8s  %10s\n" "Realistic" "$r_total" "$r_rps" "$r_p95" "${r_err}%" "$r_assess"
            echo ""
        fi
    fi
done

BENCHMARK_END=$(date +%s)
BENCHMARK_DURATION=$((BENCHMARK_END - BENCHMARK_START))

# ─── Generate SIZING-SUMMARY.md ────────────────────────────────────────────────
log "Generating $SUMMARY_MD..."

# Try to get server info from the first available JSON
SERVER_INFO=""
for scale in "${SCALES[@]}"; do
    for mode in "${MODE_LIST[@]}"; do
        F="$OUTPUT_DIR/sizing-${scale}-${mode}.json"
        if [[ -f "$F" ]]; then
            SERVER_INFO=$(extract_server_info "$F")
            break 2
        fi
    done
done

{
    echo "# OpenMetadata Cluster Sizing Summary"
    echo ""
    echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Total benchmark time: ${BENCHMARK_DURATION}s ($((BENCHMARK_DURATION / 60))m $((BENCHMARK_DURATION % 60))s)"
    echo ""
    echo "## Server Configuration"
    echo ""
    echo '```'
    echo "Server: $SERVER"
    echo "Workers: $WORKERS"
    if [[ -n "$SERVER_INFO" ]]; then
        echo "$SERVER_INFO"
    fi
    echo '```'
    echo ""
    echo "## Progressive Results"
    echo ""
    echo "| Scale | Mode | Entities | RPS | p95 (ms) | p99 (ms) | Errors % | Assessment | Duration |"
    echo "|-------|------|----------|-----|----------|----------|----------|------------|----------|"

    LAST_ADEQUATE_SCALE=""
    LAST_ADEQUATE_CONFIG=""

    for line in "${RESULT_LINES[@]}"; do
        IFS=',' read -r scale mode total rps p95 p99 err wall assess config <<< "$line"
        mode_label=$([[ "$mode" == "seq" ]] && echo "Sequential" || echo "Realistic")

        # Format duration
        if [[ "$wall" =~ ^[0-9]+$ ]]; then
            duration="${wall}s"
        else
            duration="$wall"
        fi

        # Assessment emoji
        case "$assess" in
            adequate)  assess_fmt="$assess" ;;
            marginal)  assess_fmt="$assess" ;;
            undersized) assess_fmt="$assess" ;;
            failed)    assess_fmt="FAILED" ;;
            *)         assess_fmt="$assess" ;;
        esac

        echo "| $scale | $mode_label | $total | $rps | $p95 | $p99 | $err | $assess_fmt | $duration |"

        if [[ "$assess" == "adequate" || "$assess" == "marginal" ]]; then
            LAST_ADEQUATE_SCALE="$scale"
            LAST_ADEQUATE_CONFIG="$config"
        fi
    done

    echo ""

    # Break-point section
    if [[ -n "$BREAK_SCALE" ]]; then
        echo "## Break-Point Detected"
        echo ""
        echo "**Scale:** $BREAK_SCALE  "
        echo "**Mode:** $([[ "$BREAK_MODE" == "seq" ]] && echo "Sequential" || echo "Realistic")  "
        echo "**Reason:** $BREAK_REASON"
        echo ""
        if [[ -n "$LAST_ADEQUATE_SCALE" ]]; then
            echo "The cluster handled **$LAST_ADEQUATE_SCALE** scale adequately but broke at **$BREAK_SCALE**."
            echo ""
        fi
    else
        echo "## Result"
        echo ""
        echo "No break-point detected. The cluster handled all tested scales up to **${SCALES[${#SCALES[@]}-1]}**."
        echo ""
    fi

    # Recommended configuration
    if [[ -n "$LAST_ADEQUATE_CONFIG" && "$LAST_ADEQUATE_CONFIG" != "N/A" ]]; then
        echo "## Recommended Configuration"
        echo ""
        echo "Based on the last adequate tier ($LAST_ADEQUATE_SCALE):"
        echo ""
        echo '```bash'
        IFS=';' read -ra CONFIGS <<< "$LAST_ADEQUATE_CONFIG"
        for cfg in "${CONFIGS[@]}"; do
            cfg_trimmed=$(echo "$cfg" | xargs)
            [[ -n "$cfg_trimmed" ]] && echo "export $cfg_trimmed"
        done
        echo '```'
        echo ""
    fi

    # Sequential vs Realistic comparison
    if [[ ${#MODE_LIST[@]} -gt 1 ]]; then
        echo "## Sequential vs Realistic Comparison"
        echo ""
        echo "| Scale | Seq RPS | Real RPS | RPS Diff | Seq p95 | Real p95 | p95 Diff |"
        echo "|-------|---------|----------|----------|---------|----------|----------|"

        for scale in "${SCALES[@]}"; do
            SEQ_FILE="$OUTPUT_DIR/sizing-${scale}-seq.json"
            REAL_FILE="$OUTPUT_DIR/sizing-${scale}-realistic.json"
            if [[ -f "$SEQ_FILE" && -f "$REAL_FILE" ]]; then
                python3 -c "
import json
with open('$SEQ_FILE') as f:
    seq = json.load(f)
with open('$REAL_FILE') as f:
    real = json.load(f)
s_rps = seq.get('overall', {}).get('overall_throughput_rps', 0)
r_rps = real.get('overall', {}).get('overall_throughput_rps', 0)
rps_diff = ((r_rps - s_rps) / s_rps * 100) if s_rps > 0 else 0

# Max p95
def max_p95(data):
    mx = 0
    for name, ent in data.get('entities', {}).items():
        if name.startswith('read_') or name.startswith('mixed_'):
            continue
        p = ent.get('latency_ms', {}).get('p95', 0)
        if p > mx:
            mx = p
    return mx

s_p95 = max_p95(seq)
r_p95 = max_p95(real)
p95_diff = ((r_p95 - s_p95) / s_p95 * 100) if s_p95 > 0 else 0

print(f'| $scale | {s_rps:.1f} | {r_rps:.1f} | {rps_diff:+.1f}% | {s_p95:.0f} | {r_p95:.0f} | {p95_diff:+.1f}% |')
" 2>/dev/null || true
            fi
        done

        echo ""
        echo "> **Sequential** runs entity types one at a time. **Realistic** runs all concurrently through a shared worker pool, exposing cross-entity contention."
        echo ""
    fi

    # Individual tier details
    echo "## Tier Details"
    echo ""
    for scale in "${SCALES[@]}"; do
        for mode in "${MODE_LIST[@]}"; do
            F="$OUTPUT_DIR/sizing-${scale}-${mode}.json"
            [[ ! -f "$F" ]] && continue
            mode_label=$([[ "$mode" == "seq" ]] && echo "Sequential" || echo "Realistic")
            echo "### $scale ($mode_label)"
            echo ""
            python3 -c "
import json
with open('$F') as f:
    data = json.load(f)

entities = data.get('entities', {})
print('| Entity | Count | RPS | p50 | p95 | p99 | Errors % |')
print('|--------|-------|-----|-----|-----|-----|----------|')
for name, ent in sorted(entities.items()):
    count = ent.get('created', ent.get('total_requests', 0))
    rps = ent.get('throughput_rps', 0)
    lat = ent.get('latency_ms', {})
    p50 = lat.get('p50', 0)
    p95 = lat.get('p95', 0)
    p99 = lat.get('p99', 0)
    err = ent.get('error_rate_pct', 0)
    print(f'| {name} | {count} | {rps:.1f} | {p50:.0f} | {p95:.0f} | {p99:.0f} | {err:.2f} |')

# Sizing findings
sizing = data.get('cluster_sizing', {})
findings = sizing.get('findings', [])
if findings:
    print()
    print('**Findings:**')
    for f in findings:
        print(f'- {f}')
" 2>/dev/null || echo "_Failed to parse results_"
            echo ""
        done
    done

    echo "---"
    echo ""
    echo "Generated by \`benchmark-sizing.sh\` on $(date '+%Y-%m-%d %H:%M:%S')"

} > "$SUMMARY_MD"

# ─── Final Console Summary ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  SIZING BENCHMARK COMPLETE${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo ""

printf "  %-8s  %-12s  %8s  %8s  %8s  %8s  %10s\n" "Scale" "Mode" "Entities" "RPS" "p95ms" "Errors%" "Assessment"
printf "  %-8s  %-12s  %8s  %8s  %8s  %8s  %10s\n" "────────" "────────────" "────────" "────────" "────────" "────────" "──────────"

for line in "${RESULT_LINES[@]}"; do
    IFS=',' read -r scale mode total rps p95 p99 err wall assess config <<< "$line"
    mode_label=$([[ "$mode" == "seq" ]] && echo "Sequential" || echo "Realistic")

    case "$assess" in
        adequate)   color="$GREEN" ;;
        marginal)   color="$YELLOW" ;;
        undersized) color="$RED" ;;
        failed)     color="$RED" ;;
        *)          color="$NC" ;;
    esac

    printf "  %-8s  %-12s  %8s  %8s  %8s  %8s  ${color}%10s${NC}\n" \
        "$scale" "$mode_label" "$total" "$rps" "$p95" "${err}%" "$assess"
done

echo ""

if [[ -n "$BREAK_SCALE" ]]; then
    echo -e "  ${RED}${BOLD}Break-point: $BREAK_SCALE ($BREAK_MODE) — $BREAK_REASON${NC}"
    if [[ -n "$LAST_ADEQUATE_SCALE" ]]; then
        echo -e "  ${GREEN}Last adequate scale: $LAST_ADEQUATE_SCALE${NC}"
    fi
else
    echo -e "  ${GREEN}No break-point detected — cluster handled all scales through ${SCALES[${#SCALES[@]}-1]}${NC}"
fi

echo ""
echo -e "  Total time: ${BENCHMARK_DURATION}s ($((BENCHMARK_DURATION / 60))m $((BENCHMARK_DURATION % 60))s)"
echo -e "  Summary:    ${CYAN}$SUMMARY_MD${NC}"
echo -e "  Log:        ${CYAN}$LOG_FILE${NC}"
echo ""
