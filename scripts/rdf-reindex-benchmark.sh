#!/usr/bin/env bash
#
# RDF reindex benchmark.
#
# Triggers a full RDF rebuild against a running OpenMetadata stack, measures
# wall-clock throughput, and reports the Fuseki-side cost of the run. Use it to
# turn the performance envelope in docs/rdf-production-setup.md into numbers for
# a specific deployment before tuning any defaults.
#
# Usage:
#   ./scripts/rdf-reindex-benchmark.sh
#   RUNS="gzip-off gzip-on" ./scripts/rdf-reindex-benchmark.sh   # A/B the request encoding
#   SEED_TABLES=100000 SEED_WIDE_EVERY=100 ./scripts/rdf-reindex-benchmark.sh
#
# Seeding is opt-in (SEED_TABLES) and delegates to scripts/ingest_100k_tables.py,
# which needs the `metadata` package (cd ingestion && make install_dev_env).
#
# Flipping gzip requires a server restart because RDF_GZIP_REQUESTS is read at
# startup; this script prints the instruction rather than restarting for you, so
# it never takes a deployment down on its own.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OM_URL="${OM_URL:-http://localhost:8585/api}"
OM_TOKEN="${OM_TOKEN:-}"
FUSEKI_URL="${FUSEKI_URL:-http://localhost:3030}"
FUSEKI_USER="${FUSEKI_USER:-admin}"
FUSEKI_PASSWORD="${FUSEKI_PASSWORD:-admin}"
FUSEKI_DATASET="${FUSEKI_DATASET:-openmetadata}"
APP_NAME="${APP_NAME:-RdfIndexApp}"
POLL_SECONDS="${POLL_SECONDS:-15}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-86400}"

SEED_TABLES="${SEED_TABLES:-0}"
SEED_WIDE_EVERY="${SEED_WIDE_EVERY:-100}"
SEED_WIDE_COLUMNS="${SEED_WIDE_COLUMNS:-500}"
SEED_WORKERS="${SEED_WORKERS:-10}"

BATCH_SIZE="${BATCH_SIZE:-100}"
PRODUCER_THREADS="${PRODUCER_THREADS:-2}"
CONSUMER_THREADS="${CONSUMER_THREADS:-3}"
USE_DISTRIBUTED="${USE_DISTRIBUTED:-false}"

if [ -z "${OM_TOKEN}" ]; then
    echo "OM_TOKEN is required (an admin or ingestion-bot JWT)." >&2
    exit 2
fi

om_get() { curl -sf -H "Authorization: Bearer ${OM_TOKEN}" "${OM_URL}$1"; }

fuseki_triples() {
    curl -sf -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" \
        --data-urlencode 'query=SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } }' \
        -H 'Accept: application/sparql-results+json' \
        "${FUSEKI_URL}/${FUSEKI_DATASET}/sparql" 2>/dev/null \
        | grep -o '"value"[[:space:]]*:[[:space:]]*"[0-9]*"' | head -1 | grep -o '[0-9]*' || echo "unknown"
}

# Prometheus counter for a Fuseki endpoint; used as a before/after delta.
fuseki_metric() {
    curl -sf -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" "${FUSEKI_URL}/\$/metrics" 2>/dev/null \
        | grep -E "^$1" | awk '{ sum += $NF } END { printf "%.0f", sum + 0 }' || echo 0
}

seed_catalog() {
    echo "Seeding ${SEED_TABLES} tables (every ${SEED_WIDE_EVERY}th with ${SEED_WIDE_COLUMNS} columns)..."
    python3 "${REPO_ROOT}/scripts/ingest_100k_tables.py" \
        --server "${OM_URL}" \
        --token "${OM_TOKEN}" \
        --tables "${SEED_TABLES}" \
        --workers "${SEED_WORKERS}" \
        --wide-every "${SEED_WIDE_EVERY}" \
        --wide-columns "${SEED_WIDE_COLUMNS}"
}

latest_run_field() {
    om_get "/v1/apps/name/${APP_NAME}/runs?limit=1" \
        | python3 -c "import json,sys; d=json.load(sys.stdin).get('data') or [{}]; print(d[0].get('$1',''))" 2>/dev/null || echo ""
}

trigger_reindex() {
    curl -sf -X POST -H "Authorization: Bearer ${OM_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"entities\":[\"all\"],\"recreateIndex\":true,\"batchSize\":${BATCH_SIZE},\"producerThreads\":${PRODUCER_THREADS},\"consumerThreads\":${CONSUMER_THREADS},\"useDistributedIndexing\":${USE_DISTRIBUTED}}" \
        "${OM_URL}/v1/apps/trigger/${APP_NAME}" > /dev/null
}

run_benchmark() {
    local label="$1"
    echo
    echo "=== run: ${label} ==="
    local triples_before requests_before start_epoch
    triples_before="$(fuseki_triples)"
    requests_before="$(fuseki_metric 'fuseki_requests_total')"
    local previous_start
    previous_start="$(latest_run_field startTime)"

    start_epoch=$(date +%s)
    trigger_reindex
    echo "triggered; polling every ${POLL_SECONDS}s..."

    local status="" start_time="" waited=0
    while [ "${waited}" -lt "${MAX_WAIT_SECONDS}" ]; do
        sleep "${POLL_SECONDS}"
        waited=$(( $(date +%s) - start_epoch ))
        start_time="$(latest_run_field startTime)"
        status="$(latest_run_field status)"
        # Ignore the previous run's record until the new one appears.
        if [ -n "${start_time}" ] && [ "${start_time}" != "${previous_start}" ]; then
            case "${status}" in
                success|completed|failed|stopped|activeError) break ;;
            esac
            printf '  %ss elapsed, status=%s\r' "${waited}" "${status}"
        fi
    done
    echo

    # Stats live under successContext.stats.jobStats (failureContext on a failed run).
    local total success failed elapsed rate stats
    stats="$(om_get "/v1/apps/name/${APP_NAME}/runs?limit=1" \
        | python3 -c "
import json,sys
run = (json.load(sys.stdin).get('data') or [{}])[0]
ctx = run.get('successContext') or run.get('failureContext') or {}
job = ((ctx.get('stats') or {}).get('jobStats')) or {}
print(job.get('totalRecords', 0), job.get('successRecords', 0), job.get('failedRecords', 0))
" 2>/dev/null || echo '0 0 0')"
    total="$(echo "${stats}" | cut -d' ' -f1)"
    success="$(echo "${stats}" | cut -d' ' -f2)"
    failed="$(echo "${stats}" | cut -d' ' -f3)"
    elapsed="${waited}"
    rate="$(python3 -c "print(f'{(${success:-0})/max(${elapsed},1):.1f}')" 2>/dev/null || echo '?')"

    local triples_after requests_after
    triples_after="$(fuseki_triples)"
    requests_after="$(fuseki_metric 'fuseki_requests_total')"

    printf '%-14s %-10s %-10s %-9s %-9s %-11s %-12s %s\n' \
        "${label}" "${status}" "${elapsed}s" "${success}" "${failed}" "${rate}/s" \
        "${triples_after}" "$(python3 -c "print(int(${requests_after:-0}) - int(${requests_before:-0}))" 2>/dev/null || echo '?')"
}

echo "=== RDF reindex benchmark ==="
echo "OpenMetadata: ${OM_URL}"
echo "Fuseki:       ${FUSEKI_URL}/${FUSEKI_DATASET}"
echo

if [ "${SEED_TABLES}" -gt 0 ]; then
    seed_catalog
fi

printf '%-14s %-10s %-10s %-9s %-9s %-11s %-12s %s\n' \
    "RUN" "STATUS" "WALL" "SUCCESS" "FAILED" "RATE" "TRIPLES" "FUSEKI_REQS"

for run in ${RUNS:-default}; do
    case "${run}" in
        gzip-on)
            echo "NOTE: set RDF_GZIP_REQUESTS=true and restart the server before this run." >&2
            ;;
        gzip-off)
            echo "NOTE: set RDF_GZIP_REQUESTS=false and restart the server before this run." >&2
            ;;
    esac
    run_benchmark "${run}"
done

echo
echo "Compare against the envelope in docs/rdf-production-setup.md."
echo "Per-request latency: scrape rdf.fuseki.request from the OpenMetadata metrics endpoint."
