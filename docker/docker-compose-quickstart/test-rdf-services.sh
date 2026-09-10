#!/bin/bash
#
# Smoke tests for the RDF services (Apache Jena Fuseki + OpenSearch).
#
# Exits non-zero if any check fails, so it can gate a local deployment or CI job.
# The server-side timeout check is opt-in because it deliberately waits for the
# configured update deadline.

set -u

FUSEKI_URL="${FUSEKI_URL:-http://localhost:3030}"
FUSEKI_DATASET="${FUSEKI_DATASET:-openmetadata}"
FUSEKI_USER="${FUSEKI_USER:-admin}"
FUSEKI_PASSWORD="${FUSEKI_PASSWORD:-admin}"
# Quickstart compose names the container openmetadata_fuseki; the development compose
# uses openmetadata-fuseki. Probe both so the non-root check does not silently skip.
FUSEKI_CONTAINER="${FUSEKI_CONTAINER:-}"
FUSEKI_CONTAINER_CANDIDATES="openmetadata_fuseki openmetadata-fuseki"
OPENSEARCH_URL="${OPENSEARCH_URL:-http://localhost:9200}"
UPDATE_TIMEOUT_SECONDS="${UPDATE_TIMEOUT_SECONDS:-50}"
UPDATE_TIMEOUT_BUDGET_SECONDS="${UPDATE_TIMEOUT_BUDGET_SECONDS:-70}"

RUN_TIMEOUT_TEST=false
[ "${1:-}" = "--with-timeout-test" ] && RUN_TIMEOUT_TEST=true

FAILURES=0

pass() { echo "✓ $1"; }
fail() { echo "✗ $1"; FAILURES=$((FAILURES + 1)); }
skip() { echo "- $1 (skipped)"; }

echo "=== Testing RDF Services ==="
echo
echo "Testing Apache Jena Fuseki at ${FUSEKI_URL}..."

if curl -sf "${FUSEKI_URL}/\$/ping" > /dev/null 2>&1; then
    pass "health: /\$/ping"

    if curl -sf -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" "${FUSEKI_URL}/\$/datasets" | grep -q "${FUSEKI_DATASET}"; then
        pass "dataset '${FUSEKI_DATASET}' registered"
    else
        fail "dataset '${FUSEKI_DATASET}' not found"
    fi

    if curl -sf -X POST "${FUSEKI_URL}/${FUSEKI_DATASET}/sparql" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d 'query=SELECT ?s WHERE { ?s ?p ?o } LIMIT 1' 2>&1 | grep -q "results"; then
        pass "SPARQL query endpoint"
    else
        fail "SPARQL query endpoint not responding correctly"
    fi

    # Prometheus scrape target. It requires credentials by default, which is what a
    # scrape config must supply; an anonymous 200 here would mean auth was dropped.
    if curl -sf -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" "${FUSEKI_URL}/\$/metrics" \
        | grep -q "jvm_memory_max_bytes"; then
        pass "/\$/metrics exposes JVM gauges (Prometheus scrape target)"
    else
        fail "/\$/metrics unreachable or missing JVM gauges"
    fi

    # Jena 6.x requires Java 21 and ships the admin UI launcher; confirm the running
    # server is the version we expect rather than a stale image on the same volume.
    SERVER_VERSION=$(curl -sf -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" "${FUSEKI_URL}/\$/server" \
        | grep -o '"version"[^,]*' | head -1 | cut -d'"' -f4)
    if [ -n "${SERVER_VERSION}" ]; then
        pass "server version: ${SERVER_VERSION}"
    else
        fail "could not read server version from /\$/server"
    fi

    RUNNING_CONTAINER=""
    if command -v docker > /dev/null 2>&1; then
        for candidate in ${FUSEKI_CONTAINER:-${FUSEKI_CONTAINER_CANDIDATES}}; do
            if docker ps --format '{{.Names}}' | grep -q "^${candidate}$"; then
                RUNNING_CONTAINER="${candidate}"
                break
            fi
        done
    fi
    if [ -n "${RUNNING_CONTAINER}" ]; then
        CONTAINER_UID=$(docker exec "${RUNNING_CONTAINER}" id -u 2>/dev/null)
        if [ "${CONTAINER_UID}" = "1000" ]; then
            pass "container runs as non-root (uid ${CONTAINER_UID})"
        else
            fail "container runs as uid ${CONTAINER_UID:-unknown}, expected non-root 1000"
        fi
    else
        skip "non-root check (no Fuseki container from: ${FUSEKI_CONTAINER:-${FUSEKI_CONTAINER_CANDIDATES}})"
    fi

    # Generated bulk reconciliation uses one WHERE with VALUES for all sources. This
    # stays compatible with the Jena 6.2.0 update-timeout controller while retaining
    # one atomic delete+insert transaction.
    CHAINED_UPDATE='DELETE { GRAPH <urn:om:probe> { ?entity ?p ?o } } WHERE { GRAPH <urn:om:probe> { VALUES ?entity { <urn:om:s> <urn:om:x> } ?entity ?p ?o } }; INSERT DATA { GRAPH <urn:om:probe> { <urn:om:s> <urn:om:p> "ok" } }'
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
        -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" \
        -X POST "${FUSEKI_URL}/${FUSEKI_DATASET}/update" \
        -H "Content-Type: application/sparql-update" \
        --data "${CHAINED_UPDATE}")
    if [ "${HTTP_CODE}" = "204" ] || [ "${HTTP_CODE}" = "200" ]; then
        pass "single-WHERE reconcile update accepted (HTTP ${HTTP_CODE})"
    else
        fail "single-WHERE reconcile update rejected (HTTP ${HTTP_CODE})"
    fi

    if [ "${RUN_TIMEOUT_TEST}" = true ]; then
        echo "  running runaway-UPDATE abort check (expect an abort near ${UPDATE_TIMEOUT_SECONDS}s)..."
        SEED=$(for i in $(seq 1 500); do printf '<urn:om:n%s> ' "$i"; done)
        curl -s -o /dev/null -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" \
            -X POST "${FUSEKI_URL}/${FUSEKI_DATASET}/update" \
            -H "Content-Type: application/sparql-update" \
            --data "INSERT { GRAPH <urn:om:timeout-probe> { ?s <urn:om:p> ?s } } WHERE { VALUES ?s { ${SEED} } }"
        RUNAWAY_UPDATE='INSERT { GRAPH <urn:om:timeout-probe-out> { <urn:om:s> <urn:om:p> <urn:om:o> } } WHERE { GRAPH <urn:om:timeout-probe> { ?a ?p1 ?b . ?c ?p2 ?d . ?e ?p3 ?f . ?g ?p4 ?h } FILTER(STRLEN(CONCAT(STR(?a), STR(?c), STR(?e), STR(?g))) > 100000) }'
        START=$(date +%s)
        HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
            --max-time "${UPDATE_TIMEOUT_BUDGET_SECONDS}" \
            -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" \
            -X POST "${FUSEKI_URL}/${FUSEKI_DATASET}/update" \
            -H "Content-Type: application/sparql-update" \
            --data "${RUNAWAY_UPDATE}")
        ELAPSED=$(( $(date +%s) - START ))
        MIN_ELAPSED=$(( UPDATE_TIMEOUT_SECONDS * 80 / 100 ))
        if [ "${HTTP_CODE}" = "000" ]; then
            fail "runaway UPDATE ran past ${ELAPSED}s without a server-side abort"
        elif [ "${ELAPSED}" -lt "${MIN_ELAPSED}" ]; then
            fail "UPDATE ended after ${ELAPSED}s (HTTP ${HTTP_CODE}); expected the configured timeout"
        else
            pass "server aborted runaway UPDATE after ${ELAPSED}s (HTTP ${HTTP_CODE})"
        fi
        curl -s -o /dev/null -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" \
            -X POST "${FUSEKI_URL}/${FUSEKI_DATASET}/update" \
            -H "Content-Type: application/sparql-update" \
            --data 'DROP SILENT GRAPH <urn:om:timeout-probe>; DROP SILENT GRAPH <urn:om:timeout-probe-out>'
    else
        skip "runaway-UPDATE abort check (pass --with-timeout-test to run it)"
    fi
    curl -s -o /dev/null -u "${FUSEKI_USER}:${FUSEKI_PASSWORD}" \
        -X POST "${FUSEKI_URL}/${FUSEKI_DATASET}/update" \
        -H "Content-Type: application/sparql-update" \
        --data 'DROP SILENT GRAPH <urn:om:probe>'
else
    fail "Fuseki not responding at ${FUSEKI_URL}"
fi

echo
echo "Testing OpenSearch at ${OPENSEARCH_URL}..."
HEALTH=$(curl -s "${OPENSEARCH_URL}/_cluster/health" 2>/dev/null)
if echo "${HEALTH}" | grep -q "status"; then
    STATUS=$(echo "${HEALTH}" | grep -oE '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    pass "health: ${STATUS}"
    VERSION=$(curl -s "${OPENSEARCH_URL}" | grep -oE '"number"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    if [ -n "${VERSION}" ]; then
        pass "version: ${VERSION}"
    else
        fail "could not read OpenSearch version"
    fi
    INDICES=$(curl -s "${OPENSEARCH_URL}/_cat/indices?v" 2>/dev/null | wc -l)
    pass "indices: $((INDICES - 1))"
else
    fail "OpenSearch not responding at ${OPENSEARCH_URL}"
fi

echo
if [ "${FAILURES}" -eq 0 ]; then
    echo "=== All checks passed ==="
    exit 0
fi
echo "=== ${FAILURES} check(s) failed ==="
exit 1
