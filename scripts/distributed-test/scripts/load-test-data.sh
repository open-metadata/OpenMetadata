#!/bin/bash
# Load test data for distributed indexing testing
# Supports 30+ entity types including time-series data, lineage, and data quality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Default values (backward-compatible ~46k) ────────────────────────────────
SERVER_URL="http://localhost:8585"
NUM_TABLES=20000
NUM_TOPICS=3000
NUM_DASHBOARDS=5000
NUM_CHARTS=10000
NUM_PIPELINES=3000
NUM_STORED_PROCEDURES=0
NUM_CONTAINERS=2000
NUM_SEARCH_INDEXES=1000
NUM_MLMODELS=2000
NUM_QUERIES=0
NUM_DASHBOARD_DATA_MODELS=0
NUM_TEST_SUITES=0
NUM_TEST_CASES=0
NUM_GLOSSARY_TERMS=5000
NUM_GLOSSARIES=50
NUM_TAGS=1000
NUM_CLASSIFICATIONS=20
NUM_USERS=0
NUM_TEAMS=0
NUM_DOMAINS=0
NUM_DATA_PRODUCTS=0
NUM_API_COLLECTIONS=0
NUM_API_ENDPOINTS=0
NUM_LINEAGE_EDGES=0
NUM_TEST_CASE_RESULTS=0
NUM_ENTITY_REPORT_DATA=0
NUM_WEB_ANALYTIC_VIEWS=0
NUM_WEB_ANALYTIC_ACTIVITY=0
NUM_RAW_COST_ANALYSIS=0
NUM_AGG_COST_ANALYSIS=0
NUM_WORKERS=20
SCALE_APPLIED=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --scale)
            SCALE_APPLIED="$2"
            case $2 in
                xlarge)
                    NUM_TABLES=2500000; NUM_TOPICS=400000; NUM_DASHBOARDS=200000; NUM_CHARTS=400000
                    NUM_PIPELINES=100000; NUM_STORED_PROCEDURES=100000; NUM_CONTAINERS=75000
                    NUM_SEARCH_INDEXES=50000; NUM_MLMODELS=50000; NUM_QUERIES=100000
                    NUM_DASHBOARD_DATA_MODELS=50000; NUM_TEST_SUITES=1500; NUM_TEST_CASES=150000
                    NUM_GLOSSARY_TERMS=50000; NUM_GLOSSARIES=500; NUM_TAGS=10000; NUM_CLASSIFICATIONS=200
                    NUM_USERS=5000; NUM_TEAMS=500; NUM_DOMAINS=50; NUM_DATA_PRODUCTS=500
                    NUM_API_COLLECTIONS=500; NUM_API_ENDPOINTS=50000; NUM_LINEAGE_EDGES=200000
                    NUM_TEST_CASE_RESULTS=300000; NUM_ENTITY_REPORT_DATA=50000
                    NUM_WEB_ANALYTIC_VIEWS=100000; NUM_WEB_ANALYTIC_ACTIVITY=50000
                    NUM_RAW_COST_ANALYSIS=25000; NUM_AGG_COST_ANALYSIS=25000
                    ;;
                large)
                    NUM_TABLES=1000000; NUM_TOPICS=160000; NUM_DASHBOARDS=80000; NUM_CHARTS=160000
                    NUM_PIPELINES=40000; NUM_STORED_PROCEDURES=40000; NUM_CONTAINERS=30000
                    NUM_SEARCH_INDEXES=20000; NUM_MLMODELS=20000; NUM_QUERIES=40000
                    NUM_DASHBOARD_DATA_MODELS=20000; NUM_TEST_SUITES=600; NUM_TEST_CASES=60000
                    NUM_GLOSSARY_TERMS=20000; NUM_GLOSSARIES=200; NUM_TAGS=4000; NUM_CLASSIFICATIONS=80
                    NUM_USERS=2000; NUM_TEAMS=200; NUM_DOMAINS=20; NUM_DATA_PRODUCTS=200
                    NUM_API_COLLECTIONS=200; NUM_API_ENDPOINTS=20000; NUM_LINEAGE_EDGES=80000
                    NUM_TEST_CASE_RESULTS=120000; NUM_ENTITY_REPORT_DATA=20000
                    NUM_WEB_ANALYTIC_VIEWS=40000; NUM_WEB_ANALYTIC_ACTIVITY=20000
                    NUM_RAW_COST_ANALYSIS=10000; NUM_AGG_COST_ANALYSIS=10000
                    ;;
                medium)
                    NUM_TABLES=250000; NUM_TOPICS=40000; NUM_DASHBOARDS=20000; NUM_CHARTS=40000
                    NUM_PIPELINES=10000; NUM_STORED_PROCEDURES=10000; NUM_CONTAINERS=7500
                    NUM_SEARCH_INDEXES=5000; NUM_MLMODELS=5000; NUM_QUERIES=10000
                    NUM_DASHBOARD_DATA_MODELS=5000; NUM_TEST_SUITES=150; NUM_TEST_CASES=15000
                    NUM_GLOSSARY_TERMS=5000; NUM_GLOSSARIES=50; NUM_TAGS=1000; NUM_CLASSIFICATIONS=20
                    NUM_USERS=500; NUM_TEAMS=50; NUM_DOMAINS=5; NUM_DATA_PRODUCTS=50
                    NUM_API_COLLECTIONS=50; NUM_API_ENDPOINTS=5000; NUM_LINEAGE_EDGES=20000
                    NUM_TEST_CASE_RESULTS=30000; NUM_ENTITY_REPORT_DATA=5000
                    NUM_WEB_ANALYTIC_VIEWS=10000; NUM_WEB_ANALYTIC_ACTIVITY=5000
                    NUM_RAW_COST_ANALYSIS=2500; NUM_AGG_COST_ANALYSIS=2500
                    ;;
                small)
                    NUM_TABLES=25000; NUM_TOPICS=4000; NUM_DASHBOARDS=2000; NUM_CHARTS=4000
                    NUM_PIPELINES=1000; NUM_STORED_PROCEDURES=1000; NUM_CONTAINERS=750
                    NUM_SEARCH_INDEXES=500; NUM_MLMODELS=500; NUM_QUERIES=1000
                    NUM_DASHBOARD_DATA_MODELS=500; NUM_TEST_SUITES=15; NUM_TEST_CASES=1500
                    NUM_GLOSSARY_TERMS=500; NUM_GLOSSARIES=5; NUM_TAGS=100; NUM_CLASSIFICATIONS=2
                    NUM_USERS=50; NUM_TEAMS=5; NUM_DOMAINS=1; NUM_DATA_PRODUCTS=5
                    NUM_API_COLLECTIONS=5; NUM_API_ENDPOINTS=500; NUM_LINEAGE_EDGES=2000
                    NUM_TEST_CASE_RESULTS=3000; NUM_ENTITY_REPORT_DATA=500
                    NUM_WEB_ANALYTIC_VIEWS=1000; NUM_WEB_ANALYTIC_ACTIVITY=500
                    NUM_RAW_COST_ANALYSIS=250; NUM_AGG_COST_ANALYSIS=250
                    ;;
                *)
                    echo "Unknown scale: $2 (use small|medium|large|xlarge)"
                    exit 1
                    ;;
            esac
            shift 2
            ;;
        --tables) NUM_TABLES="$2"; shift 2 ;;
        --dashboards) NUM_DASHBOARDS="$2"; shift 2 ;;
        --charts) NUM_CHARTS="$2"; shift 2 ;;
        --pipelines) NUM_PIPELINES="$2"; shift 2 ;;
        --topics) NUM_TOPICS="$2"; shift 2 ;;
        --mlmodels) NUM_MLMODELS="$2"; shift 2 ;;
        --containers) NUM_CONTAINERS="$2"; shift 2 ;;
        --search-indexes) NUM_SEARCH_INDEXES="$2"; shift 2 ;;
        --stored-procedures) NUM_STORED_PROCEDURES="$2"; shift 2 ;;
        --queries) NUM_QUERIES="$2"; shift 2 ;;
        --data-models) NUM_DASHBOARD_DATA_MODELS="$2"; shift 2 ;;
        --test-suites) NUM_TEST_SUITES="$2"; shift 2 ;;
        --test-cases) NUM_TEST_CASES="$2"; shift 2 ;;
        --glossaries) NUM_GLOSSARIES="$2"; shift 2 ;;
        --glossary-terms) NUM_GLOSSARY_TERMS="$2"; shift 2 ;;
        --classifications) NUM_CLASSIFICATIONS="$2"; shift 2 ;;
        --tags) NUM_TAGS="$2"; shift 2 ;;
        --users) NUM_USERS="$2"; shift 2 ;;
        --teams) NUM_TEAMS="$2"; shift 2 ;;
        --domains) NUM_DOMAINS="$2"; shift 2 ;;
        --data-products) NUM_DATA_PRODUCTS="$2"; shift 2 ;;
        --api-collections) NUM_API_COLLECTIONS="$2"; shift 2 ;;
        --api-endpoints) NUM_API_ENDPOINTS="$2"; shift 2 ;;
        --lineage-edges) NUM_LINEAGE_EDGES="$2"; shift 2 ;;
        --test-case-results) NUM_TEST_CASE_RESULTS="$2"; shift 2 ;;
        --entity-report-data) NUM_ENTITY_REPORT_DATA="$2"; shift 2 ;;
        --web-analytic-views) NUM_WEB_ANALYTIC_VIEWS="$2"; shift 2 ;;
        --web-analytic-activity) NUM_WEB_ANALYTIC_ACTIVITY="$2"; shift 2 ;;
        --raw-cost-analysis) NUM_RAW_COST_ANALYSIS="$2"; shift 2 ;;
        --aggregated-cost-analysis) NUM_AGG_COST_ANALYSIS="$2"; shift 2 ;;
        --workers) NUM_WORKERS="$2"; shift 2 ;;
        --databases) shift 2 ;;  # ignored, auto-calculated now
        --terms-per-glossary) shift 2 ;;  # ignored, use --glossary-terms
        --tags-per-classification) shift 2 ;;  # ignored, use --tags
        --server) SERVER_URL="$2"; shift 2 ;;
        --quick)
            SCALE_APPLIED="quick"
            NUM_TABLES=3000; NUM_DASHBOARDS=1000; NUM_CHARTS=2000; NUM_PIPELINES=500
            NUM_TOPICS=500; NUM_MLMODELS=300; NUM_CONTAINERS=300; NUM_SEARCH_INDEXES=200
            NUM_STORED_PROCEDURES=200; NUM_QUERIES=200; NUM_DASHBOARD_DATA_MODELS=100
            NUM_TEST_SUITES=5; NUM_TEST_CASES=500; NUM_GLOSSARY_TERMS=500; NUM_GLOSSARIES=10
            NUM_TAGS=100; NUM_CLASSIFICATIONS=5; NUM_USERS=20; NUM_TEAMS=3; NUM_DOMAINS=1
            NUM_DATA_PRODUCTS=3; NUM_API_COLLECTIONS=3; NUM_API_ENDPOINTS=100
            NUM_LINEAGE_EDGES=500; NUM_TEST_CASE_RESULTS=1000; NUM_ENTITY_REPORT_DATA=100
            NUM_WEB_ANALYTIC_VIEWS=200; NUM_WEB_ANALYTIC_ACTIVITY=100
            NUM_RAW_COST_ANALYSIS=50; NUM_AGG_COST_ANALYSIS=50
            shift
            ;;
        -h|--help)
            cat << 'HELPEOF'
Usage: load-test-data.sh [OPTIONS]

Scale presets:
  --scale {small|medium|large|xlarge}   Apply a preset (see table below)
  --quick                               Quick mode (~10k entities)

Individual entity counts override any preset:
  --tables NUM                  --dashboards NUM            --charts NUM
  --pipelines NUM               --topics NUM                --mlmodels NUM
  --containers NUM              --search-indexes NUM        --stored-procedures NUM
  --queries NUM                 --data-models NUM           --test-suites NUM
  --test-cases NUM              --glossaries NUM            --glossary-terms NUM
  --classifications NUM         --tags NUM                  --users NUM
  --teams NUM                   --domains NUM               --data-products NUM
  --api-collections NUM         --api-endpoints NUM         --lineage-edges NUM

Time-series entity counts:
  --test-case-results NUM       --entity-report-data NUM
  --web-analytic-views NUM      --web-analytic-activity NUM
  --raw-cost-analysis NUM       --aggregated-cost-analysis NUM

Other:
  --server URL                  Target server URL (default: http://localhost:8585)
  --workers NUM                 Concurrent workers (default: 20)
  -h, --help                    Show this help message

Scale preset totals:
  xlarge  ~5M    large  ~2M    medium  ~500K    small  ~50K
HELPEOF
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Calculate total
TOTAL=$((NUM_TABLES + NUM_TOPICS + NUM_DASHBOARDS + NUM_CHARTS + NUM_PIPELINES + \
    NUM_STORED_PROCEDURES + NUM_CONTAINERS + NUM_SEARCH_INDEXES + NUM_MLMODELS + \
    NUM_QUERIES + NUM_DASHBOARD_DATA_MODELS + NUM_TEST_SUITES + NUM_TEST_CASES + \
    NUM_GLOSSARY_TERMS + NUM_GLOSSARIES + NUM_TAGS + NUM_CLASSIFICATIONS + \
    NUM_USERS + NUM_TEAMS + NUM_DOMAINS + NUM_DATA_PRODUCTS + \
    NUM_API_COLLECTIONS + NUM_API_ENDPOINTS + NUM_LINEAGE_EDGES + \
    NUM_TEST_CASE_RESULTS + NUM_ENTITY_REPORT_DATA + \
    NUM_WEB_ANALYTIC_VIEWS + NUM_WEB_ANALYTIC_ACTIVITY + \
    NUM_RAW_COST_ANALYSIS + NUM_AGG_COST_ANALYSIS))

echo "======================================"
echo "Loading Test Data for Distributed Indexing"
echo "======================================"
echo "Server: $SERVER_URL"
if [ -n "$SCALE_APPLIED" ]; then
    echo "Scale:  $SCALE_APPLIED"
fi
echo "Workers: $NUM_WORKERS"
echo ""
echo "Entity counts:"
printf "  %-26s %s\n" "Tables:" "$NUM_TABLES"
printf "  %-26s %s\n" "Topics:" "$NUM_TOPICS"
printf "  %-26s %s\n" "Dashboards:" "$NUM_DASHBOARDS"
printf "  %-26s %s\n" "Charts:" "$NUM_CHARTS"
printf "  %-26s %s\n" "Pipelines:" "$NUM_PIPELINES"
printf "  %-26s %s\n" "Stored Procedures:" "$NUM_STORED_PROCEDURES"
printf "  %-26s %s\n" "Containers:" "$NUM_CONTAINERS"
printf "  %-26s %s\n" "Search Indexes:" "$NUM_SEARCH_INDEXES"
printf "  %-26s %s\n" "ML Models:" "$NUM_MLMODELS"
printf "  %-26s %s\n" "Queries:" "$NUM_QUERIES"
printf "  %-26s %s\n" "Dashboard Data Models:" "$NUM_DASHBOARD_DATA_MODELS"
printf "  %-26s %s\n" "Test Suites:" "$NUM_TEST_SUITES"
printf "  %-26s %s\n" "Test Cases:" "$NUM_TEST_CASES"
printf "  %-26s %s\n" "Glossaries:" "$NUM_GLOSSARIES"
printf "  %-26s %s\n" "Glossary Terms:" "$NUM_GLOSSARY_TERMS"
printf "  %-26s %s\n" "Classifications:" "$NUM_CLASSIFICATIONS"
printf "  %-26s %s\n" "Tags:" "$NUM_TAGS"
printf "  %-26s %s\n" "Users:" "$NUM_USERS"
printf "  %-26s %s\n" "Teams:" "$NUM_TEAMS"
printf "  %-26s %s\n" "Domains:" "$NUM_DOMAINS"
printf "  %-26s %s\n" "Data Products:" "$NUM_DATA_PRODUCTS"
printf "  %-26s %s\n" "API Collections:" "$NUM_API_COLLECTIONS"
printf "  %-26s %s\n" "API Endpoints:" "$NUM_API_ENDPOINTS"
printf "  %-26s %s\n" "Lineage Edges:" "$NUM_LINEAGE_EDGES"
printf "  %-26s %s\n" "Test Case Results (TS):" "$NUM_TEST_CASE_RESULTS"
printf "  %-26s %s\n" "Entity Report Data (TS):" "$NUM_ENTITY_REPORT_DATA"
printf "  %-26s %s\n" "Web Analytic Views (TS):" "$NUM_WEB_ANALYTIC_VIEWS"
printf "  %-26s %s\n" "Web Analytic Activity (TS):" "$NUM_WEB_ANALYTIC_ACTIVITY"
printf "  %-26s %s\n" "Raw Cost Analysis (TS):" "$NUM_RAW_COST_ANALYSIS"
printf "  %-26s %s\n" "Agg Cost Analysis (TS):" "$NUM_AGG_COST_ANALYSIS"
echo "  --------------------------"
printf "  %-26s %s\n" "Total:" "$TOTAL"
echo ""

python3 << PYEOF
import urllib.request
import urllib.error
import json
import sys
import time
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

SERVER_URL = "${SERVER_URL}"
NUM_WORKERS = ${NUM_WORKERS}

# ── Entity counts ────────────────────────────────────────────────────────────
NUM_TABLES = ${NUM_TABLES}
NUM_TOPICS = ${NUM_TOPICS}
NUM_DASHBOARDS = ${NUM_DASHBOARDS}
NUM_CHARTS = ${NUM_CHARTS}
NUM_PIPELINES = ${NUM_PIPELINES}
NUM_STORED_PROCEDURES = ${NUM_STORED_PROCEDURES}
NUM_CONTAINERS = ${NUM_CONTAINERS}
NUM_SEARCH_INDEXES = ${NUM_SEARCH_INDEXES}
NUM_MLMODELS = ${NUM_MLMODELS}
NUM_QUERIES = ${NUM_QUERIES}
NUM_DASHBOARD_DATA_MODELS = ${NUM_DASHBOARD_DATA_MODELS}
NUM_TEST_SUITES = ${NUM_TEST_SUITES}
NUM_TEST_CASES = ${NUM_TEST_CASES}
NUM_GLOSSARY_TERMS = ${NUM_GLOSSARY_TERMS}
NUM_GLOSSARIES = ${NUM_GLOSSARIES}
NUM_TAGS = ${NUM_TAGS}
NUM_CLASSIFICATIONS = ${NUM_CLASSIFICATIONS}
NUM_USERS = ${NUM_USERS}
NUM_TEAMS = ${NUM_TEAMS}
NUM_DOMAINS = ${NUM_DOMAINS}
NUM_DATA_PRODUCTS = ${NUM_DATA_PRODUCTS}
NUM_API_COLLECTIONS = ${NUM_API_COLLECTIONS}
NUM_API_ENDPOINTS = ${NUM_API_ENDPOINTS}
NUM_LINEAGE_EDGES = ${NUM_LINEAGE_EDGES}
NUM_TEST_CASE_RESULTS = ${NUM_TEST_CASE_RESULTS}
NUM_ENTITY_REPORT_DATA = ${NUM_ENTITY_REPORT_DATA}
NUM_WEB_ANALYTIC_VIEWS = ${NUM_WEB_ANALYTIC_VIEWS}
NUM_WEB_ANALYTIC_ACTIVITY = ${NUM_WEB_ANALYTIC_ACTIVITY}
NUM_RAW_COST_ANALYSIS = ${NUM_RAW_COST_ANALYSIS}
NUM_AGG_COST_ANALYSIS = ${NUM_AGG_COST_ANALYSIS}

# Auto-calculate database/schema counts
NUM_DATABASES = max(1, NUM_TABLES // 50000)
SCHEMAS_PER_DB = min(20, max(1, NUM_TABLES // (NUM_DATABASES * 5000))) if NUM_TABLES > 0 else 1

print(f"Connecting to {SERVER_URL}...")
sys.stdout.flush()

# ── HTTP helper with retry ───────────────────────────────────────────────────
def make_request(url, data=None, method="GET", headers=None, retries=3):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    encoded = json.dumps(data).encode("utf-8") if data else None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=encoded, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8")
            except Exception:
                body = str(e)
            if e.code >= 500 and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            return e.code, body
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            return 0, str(e)
    return 0, "max retries exceeded"

# Admin JWT token
token = ("eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1Qi"
         "LCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi"
         "1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFk"
         "YXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d"
         "24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyN"
         "v_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkL"
         "XcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1"
         "mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg")
print("Using admin JWT token for authentication.")

headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

overall_start = time.time()
stats = {}

# ── Collected IDs for linking phases ─────────────────────────────────────────
collected_table_ids = []      # (id, fqn) tuples
collected_dashboard_ids = []  # (id, fqn) tuples
collected_pipeline_ids = []   # (id, fqn) tuples
collected_test_case_fqns = [] # fqn strings
collect_lock = threading.Lock()

# Cap collection sizes to bound memory
MAX_COLLECT = max(NUM_LINEAGE_EDGES * 2, NUM_TEST_CASE_RESULTS, 10000)

# ── Generic batch creator ────────────────────────────────────────────────────
def create_entity_batch(entity_name, count, payload_fn, workers=None, collect_fn=None,
                        log_interval=None):
    if count <= 0:
        return 0
    if workers is None:
        workers = NUM_WORKERS
    if log_interval is None:
        log_interval = max(1, count // 20)

    print(f"\nCreating {count} {entity_name}...")
    sys.stdout.flush()
    created = 0
    failed = 0
    start_time = time.time()
    counter_lock = threading.Lock()

    def _work(idx):
        nonlocal created, failed
        payload = payload_fn(idx)
        if payload is None:
            return
        url = payload.pop("__url__", None)
        method = payload.pop("__method__", "PUT")
        if url is None:
            return
        status, resp = make_request(url, data=payload, method=method, headers=headers)
        ok = status in [200, 201]
        with counter_lock:
            if ok:
                created += 1
            else:
                failed += 1
            total = created + failed
            if total % log_interval == 0 or total == count:
                elapsed = time.time() - start_time
                rate = total / elapsed if elapsed > 0 else 0
                print(f"  {entity_name}: {total}/{count} ({rate:.1f}/sec) - OK: {created}, Fail: {failed}")
                sys.stdout.flush()
        if ok and collect_fn and isinstance(resp, dict):
            collect_fn(idx, resp)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_work, i) for i in range(count)]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception:
                pass

    stats[entity_name] = created
    elapsed = time.time() - start_time
    print(f"{entity_name} done: {created} created, {failed} failed ({elapsed:.1f}s)")
    sys.stdout.flush()
    return created


# ── Helper to create a service ───────────────────────────────────────────────
def create_service(endpoint, data):
    status, resp = make_request(f"{SERVER_URL}/api/v1/services/{endpoint}", data=data,
                                method="PUT", headers=headers)
    if status in [200, 201] and isinstance(resp, dict):
        fqn = resp["fullyQualifiedName"]
        print(f"  Service created: {fqn}")
        return fqn
    print(f"  Failed to create service: {status} - {resp}")
    return None


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: Metadata (no dependencies)
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 1: Metadata (domains, classifications, glossaries, users, teams)")
print("=" * 60)

# ── Domains ──────────────────────────────────────────────────────────────────
domain_fqns = []

def domain_payload(idx):
    return {
        "__url__": f"{SERVER_URL}/api/v1/domains",
        "name": f"TestDomain_{idx:04d}",
        "domainType": "Aggregate",
        "description": f"Test domain {idx} for load testing",
    }

def collect_domain(idx, resp):
    with collect_lock:
        domain_fqns.append(resp.get("fullyQualifiedName", f"TestDomain_{idx:04d}"))

create_entity_batch("domains", NUM_DOMAINS, domain_payload, collect_fn=collect_domain)

# ── Classifications & Tags ───────────────────────────────────────────────────
classification_fqns = []
if NUM_CLASSIFICATIONS > 0:
    print(f"\nCreating {NUM_CLASSIFICATIONS} classifications...")
    sys.stdout.flush()
    for i in range(NUM_CLASSIFICATIONS):
        data = {
            "name": f"TestClassification_{i:04d}",
            "description": f"Test classification {i} for load testing",
        }
        status, resp = make_request(f"{SERVER_URL}/api/v1/classifications", data=data,
                                    method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            classification_fqns.append(resp["fullyQualifiedName"])
    stats["classifications"] = len(classification_fqns)
    print(f"classifications done: {len(classification_fqns)} created")

if NUM_TAGS > 0 and classification_fqns:
    tags_per_class = max(1, NUM_TAGS // len(classification_fqns))
    tag_assignments = []
    for cfqn in classification_fqns:
        for j in range(tags_per_class):
            tag_assignments.append((cfqn, j))
            if len(tag_assignments) >= NUM_TAGS:
                break
        if len(tag_assignments) >= NUM_TAGS:
            break

    def tag_payload(idx):
        cfqn, j = tag_assignments[idx]
        return {
            "__url__": f"{SERVER_URL}/api/v1/tags",
            "name": f"Tag_{j:05d}",
            "classification": cfqn,
            "description": f"Test tag {j}",
        }

    create_entity_batch("tags", len(tag_assignments), tag_payload)

# ── Glossaries & Terms ───────────────────────────────────────────────────────
glossary_fqns = []
if NUM_GLOSSARIES > 0:
    print(f"\nCreating {NUM_GLOSSARIES} glossaries...")
    sys.stdout.flush()
    for i in range(NUM_GLOSSARIES):
        data = {
            "name": f"TestGlossary_{i:04d}",
            "displayName": f"Test Glossary {i}",
            "description": f"Test glossary {i} for load testing",
        }
        status, resp = make_request(f"{SERVER_URL}/api/v1/glossaries", data=data,
                                    method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            glossary_fqns.append(resp["fullyQualifiedName"])
    stats["glossaries"] = len(glossary_fqns)
    print(f"glossaries done: {len(glossary_fqns)} created")

if NUM_GLOSSARY_TERMS > 0 and glossary_fqns:
    terms_per_glossary = max(1, NUM_GLOSSARY_TERMS // len(glossary_fqns))
    term_assignments = []
    for gfqn in glossary_fqns:
        for j in range(terms_per_glossary):
            term_assignments.append((gfqn, j))
            if len(term_assignments) >= NUM_GLOSSARY_TERMS:
                break
        if len(term_assignments) >= NUM_GLOSSARY_TERMS:
            break

    def term_payload(idx):
        gfqn, j = term_assignments[idx]
        return {
            "__url__": f"{SERVER_URL}/api/v1/glossaryTerms",
            "name": f"Term_{j:05d}",
            "glossary": gfqn,
            "displayName": f"Term {j}",
            "description": f"Test glossary term {j}",
        }

    create_entity_batch("glossaryTerms", len(term_assignments), term_payload)

# ── Users ────────────────────────────────────────────────────────────────────
def user_payload(idx):
    return {
        "__url__": f"{SERVER_URL}/api/v1/users",
        "name": f"testuser_{idx:05d}",
        "email": f"testuser_{idx:05d}@example.com",
        "displayName": f"Test User {idx}",
        "description": f"Test user {idx} for load testing",
    }

create_entity_batch("users", NUM_USERS, user_payload)

# ── Teams ────────────────────────────────────────────────────────────────────
def team_payload(idx):
    return {
        "__url__": f"{SERVER_URL}/api/v1/teams",
        "name": f"testteam_{idx:04d}",
        "displayName": f"Test Team {idx}",
        "description": f"Test team {idx} for load testing",
        "teamType": "Group",
    }

create_entity_batch("teams", NUM_TEAMS, team_payload)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Services
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 2: Services")
print("=" * 60)

db_service_fqn = create_service("databaseServices", {
    "name": "test-service-distributed",
    "serviceType": "Mysql",
    "connection": {"config": {"type": "Mysql", "username": "test",
                              "authType": {"password": "test"}, "hostPort": "localhost:3306"}},
})

dashboard_service_fqn = create_service("dashboardServices", {
    "name": "test-dashboard-service",
    "serviceType": "Looker",
    "connection": {"config": {"type": "Looker", "clientId": "test-client-id",
                              "clientSecret": "test-client-secret",
                              "hostPort": "https://looker.example.com"}},
})

pipeline_service_fqn = create_service("pipelineServices", {
    "name": "test-pipeline-service",
    "serviceType": "Airflow",
    "connection": {"config": {"type": "Airflow", "hostPort": "http://airflow.example.com:8080",
                              "connection": {"type": "BackendConnection"}}},
})

messaging_service_fqn = create_service("messagingServices", {
    "name": "test-messaging-service",
    "serviceType": "Kafka",
    "connection": {"config": {"type": "Kafka", "bootstrapServers": "localhost:9092"}},
})

mlmodel_service_fqn = create_service("mlmodelServices", {
    "name": "test-mlmodel-service",
    "serviceType": "Mlflow",
    "connection": {"config": {"type": "Mlflow", "trackingUri": "http://mlflow.example.com:5000",
                              "registryUri": "http://mlflow.example.com:5000"}},
})

storage_service_fqn = create_service("storageServices", {
    "name": "test-storage-service",
    "serviceType": "S3",
    "connection": {"config": {"type": "S3", "awsConfig": {
        "awsAccessKeyId": "test-key", "awsSecretAccessKey": "test-secret",
        "awsRegion": "us-east-1"}}},
})

search_service_fqn = create_service("searchServices", {
    "name": "test-search-service",
    "serviceType": "ElasticSearch",
    "connection": {"config": {"type": "ElasticSearch",
                              "hostPort": "http://elasticsearch.example.com:9200"}},
})

api_service_fqn = None
if NUM_API_COLLECTIONS > 0 or NUM_API_ENDPOINTS > 0:
    api_service_fqn = create_service("apiServices", {
        "name": "test-api-service",
        "serviceType": "REST",
        "connection": {"config": {"type": "REST",
                                  "openAPISchemaURL": "http://api.example.com/openapi.json"}},
    })

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Infrastructure (databases, schemas, apiCollections)
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 3: Infrastructure (databases, schemas, API collections)")
print("=" * 60)

# ── Databases & Schemas ──────────────────────────────────────────────────────
schema_fqns = []
if db_service_fqn and NUM_TABLES > 0:
    print(f"Creating {NUM_DATABASES} databases with {SCHEMAS_PER_DB} schemas each...")
    sys.stdout.flush()
    for i in range(NUM_DATABASES):
        db_data = {"name": f"test_db_{i:04d}", "service": db_service_fqn}
        status, resp = make_request(f"{SERVER_URL}/api/v1/databases", data=db_data,
                                    method="PUT", headers=headers)
        if status in [200, 201] and isinstance(resp, dict):
            db_fqn = resp["fullyQualifiedName"]
            for s in range(SCHEMAS_PER_DB):
                schema_name = f"schema_{s:03d}" if SCHEMAS_PER_DB > 1 else "public"
                s_data = {"name": schema_name, "database": db_fqn}
                s_status, s_resp = make_request(f"{SERVER_URL}/api/v1/databaseSchemas",
                                                data=s_data, method="PUT", headers=headers)
                if s_status in [200, 201] and isinstance(s_resp, dict):
                    schema_fqns.append(s_resp["fullyQualifiedName"])
    print(f"  Created {NUM_DATABASES} databases, {len(schema_fqns)} schemas")

# ── API Collections ──────────────────────────────────────────────────────────
api_collection_fqns = []
if api_service_fqn and NUM_API_COLLECTIONS > 0:
    def api_coll_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/apiCollections",
            "name": f"api_collection_{idx:04d}",
            "service": api_service_fqn,
            "displayName": f"API Collection {idx}",
            "description": f"Test API collection {idx}",
        }

    def collect_api_coll(idx, resp):
        with collect_lock:
            api_collection_fqns.append(resp.get("fullyQualifiedName",
                                                f"test-api-service.api_collection_{idx:04d}"))

    create_entity_batch("apiCollections", NUM_API_COLLECTIONS, api_coll_payload,
                        collect_fn=collect_api_coll)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: Core entities
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 4: Core entities")
print("=" * 60)

# ── Tables ───────────────────────────────────────────────────────────────────
if schema_fqns and NUM_TABLES > 0:
    def table_payload(idx):
        sfqn = schema_fqns[idx % len(schema_fqns)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/tables",
            "name": f"table_{idx:07d}",
            "databaseSchema": sfqn,
            "columns": [
                {"name": "id", "dataType": "BIGINT", "description": "Primary key"},
                {"name": "name", "dataType": "VARCHAR", "dataLength": 255},
                {"name": "created_at", "dataType": "TIMESTAMP"},
                {"name": "data", "dataType": "JSON"},
            ],
        }

    def collect_table(idx, resp):
        with collect_lock:
            if len(collected_table_ids) < MAX_COLLECT:
                collected_table_ids.append((resp["id"], resp.get("fullyQualifiedName", "")))

    create_entity_batch("tables", NUM_TABLES, table_payload, collect_fn=collect_table)

# ── Dashboards ───────────────────────────────────────────────────────────────
if dashboard_service_fqn and NUM_DASHBOARDS > 0:
    def dashboard_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dashboards",
            "name": f"dashboard_{idx:06d}",
            "service": dashboard_service_fqn,
            "displayName": f"Test Dashboard {idx}",
            "description": f"Test dashboard {idx}",
        }

    def collect_dashboard(idx, resp):
        with collect_lock:
            if len(collected_dashboard_ids) < MAX_COLLECT:
                collected_dashboard_ids.append((resp["id"], resp.get("fullyQualifiedName", "")))

    create_entity_batch("dashboards", NUM_DASHBOARDS, dashboard_payload,
                        collect_fn=collect_dashboard)

# ── Charts ───────────────────────────────────────────────────────────────────
if dashboard_service_fqn and NUM_CHARTS > 0:
    chart_types = ["Line", "Bar", "Pie", "Area", "Scatter", "Table"]

    def chart_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/charts",
            "name": f"chart_{idx:06d}",
            "service": dashboard_service_fqn,
            "displayName": f"Test Chart {idx}",
            "chartType": chart_types[idx % len(chart_types)],
            "description": f"Test chart {idx}",
        }

    create_entity_batch("charts", NUM_CHARTS, chart_payload)

# ── Topics ───────────────────────────────────────────────────────────────────
if messaging_service_fqn and NUM_TOPICS > 0:
    def topic_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/topics",
            "name": f"topic_{idx:06d}",
            "service": messaging_service_fqn,
            "partitions": 3,
            "replicationFactor": 1,
            "description": f"Test topic {idx}",
        }

    create_entity_batch("topics", NUM_TOPICS, topic_payload)

# ── Pipelines ────────────────────────────────────────────────────────────────
if pipeline_service_fqn and NUM_PIPELINES > 0:
    def pipeline_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/pipelines",
            "name": f"pipeline_{idx:06d}",
            "service": pipeline_service_fqn,
            "displayName": f"Test Pipeline {idx}",
            "description": f"Test pipeline {idx}",
        }

    def collect_pipeline(idx, resp):
        with collect_lock:
            if len(collected_pipeline_ids) < MAX_COLLECT:
                collected_pipeline_ids.append((resp["id"], resp.get("fullyQualifiedName", "")))

    create_entity_batch("pipelines", NUM_PIPELINES, pipeline_payload,
                        collect_fn=collect_pipeline)

# ── Stored Procedures ────────────────────────────────────────────────────────
if db_service_fqn and schema_fqns and NUM_STORED_PROCEDURES > 0:
    def stored_proc_payload(idx):
        sfqn = schema_fqns[idx % len(schema_fqns)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/storedProcedures",
            "name": f"stored_proc_{idx:06d}",
            "databaseSchema": sfqn,
            "storedProcedureCode": {
                "code": f"CREATE PROCEDURE sp_{idx}() BEGIN SELECT 1; END",
                "language": "SQL",
            },
            "description": f"Test stored procedure {idx}",
        }

    create_entity_batch("storedProcedures", NUM_STORED_PROCEDURES, stored_proc_payload)

# ── ML Models ────────────────────────────────────────────────────────────────
if mlmodel_service_fqn and NUM_MLMODELS > 0:
    algorithms = ["LinearRegression", "RandomForest", "XGBoost", "NeuralNetwork",
                  "SVM", "KMeans", "DecisionTree"]

    def mlmodel_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/mlmodels",
            "name": f"mlmodel_{idx:06d}",
            "service": mlmodel_service_fqn,
            "algorithm": algorithms[idx % len(algorithms)],
            "displayName": f"Test ML Model {idx}",
            "description": f"Test ML model {idx}",
        }

    create_entity_batch("mlmodels", NUM_MLMODELS, mlmodel_payload)

# ── Containers ───────────────────────────────────────────────────────────────
if storage_service_fqn and NUM_CONTAINERS > 0:
    def container_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/containers",
            "name": f"container_{idx:06d}",
            "service": storage_service_fqn,
            "displayName": f"Test Container {idx}",
            "description": f"Test container {idx}",
        }

    create_entity_batch("containers", NUM_CONTAINERS, container_payload)

# ── Search Indexes ───────────────────────────────────────────────────────────
if search_service_fqn and NUM_SEARCH_INDEXES > 0:
    def search_idx_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/searchIndexes",
            "name": f"search_index_{idx:06d}",
            "service": search_service_fqn,
            "displayName": f"Test Search Index {idx}",
            "description": f"Test search index {idx}",
            "fields": [
                {"name": "id", "dataType": "KEYWORD"},
                {"name": "content", "dataType": "TEXT"},
                {"name": "timestamp", "dataType": "DATE"},
            ],
        }

    create_entity_batch("searchIndexes", NUM_SEARCH_INDEXES, search_idx_payload)

# ── Queries ──────────────────────────────────────────────────────────────────
if NUM_QUERIES > 0:
    def query_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/queries",
            "__method__": "POST",
            "name": f"query_{idx:06d}",
            "query": f"SELECT * FROM table_{idx % max(1, NUM_TABLES):07d} WHERE id = {idx}",
            "description": f"Test query {idx}",
            "duration": random.uniform(0.1, 10.0),
        }

    create_entity_batch("queries", NUM_QUERIES, query_payload)

# ── Dashboard Data Models ────────────────────────────────────────────────────
if dashboard_service_fqn and NUM_DASHBOARD_DATA_MODELS > 0:
    dm_types = ["BigQuery", "Looker"]

    def data_model_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dashboard/datamodels",
            "name": f"data_model_{idx:06d}",
            "service": dashboard_service_fqn,
            "dataModelType": dm_types[idx % len(dm_types)],
            "displayName": f"Test Data Model {idx}",
            "description": f"Test dashboard data model {idx}",
            "columns": [
                {"name": "id", "dataType": "BIGINT"},
                {"name": "value", "dataType": "VARCHAR", "dataLength": 255},
            ],
        }

    create_entity_batch("dashboardDataModels", NUM_DASHBOARD_DATA_MODELS, data_model_payload)

# ── API Endpoints ────────────────────────────────────────────────────────────
if api_service_fqn and api_collection_fqns and NUM_API_ENDPOINTS > 0:
    http_methods = ["GET", "POST", "PUT", "DELETE", "PATCH"]

    def api_endpoint_payload(idx):
        coll_fqn = api_collection_fqns[idx % len(api_collection_fqns)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/apiEndpoints",
            "name": f"endpoint_{idx:06d}",
            "apiCollection": coll_fqn,
            "endpointURL": f"https://api.example.com/v1/resource_{idx}",
            "requestMethod": http_methods[idx % len(http_methods)],
            "displayName": f"Test Endpoint {idx}",
            "description": f"Test API endpoint {idx}",
        }

    create_entity_batch("apiEndpoints", NUM_API_ENDPOINTS, api_endpoint_payload)

# ── Data Products ────────────────────────────────────────────────────────────
if NUM_DATA_PRODUCTS > 0 and domain_fqns:
    def data_product_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataProducts",
            "name": f"data_product_{idx:04d}",
            "domain": domain_fqns[idx % len(domain_fqns)],
            "displayName": f"Test Data Product {idx}",
            "description": f"Test data product {idx}",
        }

    create_entity_batch("dataProducts", NUM_DATA_PRODUCTS, data_product_payload)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: Data Quality (test suites, test cases)
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 5: Data Quality (test suites, test cases)")
print("=" * 60)

test_suite_fqns = []

if NUM_TEST_SUITES > 0:
    def test_suite_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testSuites",
            "name": f"testSuite_{idx:04d}",
            "displayName": f"Test Suite {idx}",
            "description": f"Test suite {idx} for load testing",
        }

    def collect_test_suite(idx, resp):
        with collect_lock:
            test_suite_fqns.append(resp.get("fullyQualifiedName",
                                            f"testSuite_{idx:04d}"))

    create_entity_batch("testSuites", NUM_TEST_SUITES, test_suite_payload,
                        collect_fn=collect_test_suite)

if NUM_TEST_CASES > 0 and collected_table_ids:
    test_definitions = [
        "columnValuesToBeBetween",
        "columnValuesToBeNotNull",
        "columnValuesToBeUnique",
        "tableRowCountToEqual",
        "tableColumnCountToEqual",
    ]

    def test_case_payload(idx):
        table_id, table_fqn = collected_table_ids[idx % len(collected_table_ids)]
        payload = {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testCases",
            "name": f"testCase_{idx:06d}",
            "entityLink": f"<#E::table::{table_fqn}>",
            "testDefinition": test_definitions[idx % len(test_definitions)],
            "testSuite": test_suite_fqns[idx % len(test_suite_fqns)] if test_suite_fqns else f"testSuite_0000",
            "description": f"Test case {idx}",
            "parameterValues": [],
        }
        return payload

    def collect_test_case(idx, resp):
        with collect_lock:
            if len(collected_test_case_fqns) < MAX_COLLECT:
                fqn = resp.get("fullyQualifiedName")
                if fqn:
                    collected_test_case_fqns.append(fqn)

    create_entity_batch("testCases", NUM_TEST_CASES, test_case_payload,
                        collect_fn=collect_test_case)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6: Lineage
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 6: Lineage")
print("=" * 60)

if NUM_LINEAGE_EDGES > 0 and collected_table_ids:
    # 60% table->table, 25% table->dashboard, 15% pipeline->table
    n_t2t = int(NUM_LINEAGE_EDGES * 0.60)
    n_t2d = int(NUM_LINEAGE_EDGES * 0.25)
    n_p2t = NUM_LINEAGE_EDGES - n_t2t - n_t2d

    lineage_tasks = []
    # table -> table
    for i in range(n_t2t):
        from_idx = i % len(collected_table_ids)
        to_idx = (i + 1) % len(collected_table_ids)
        lineage_tasks.append(("table", collected_table_ids[from_idx][0],
                              "table", collected_table_ids[to_idx][0]))
    # table -> dashboard
    if collected_dashboard_ids:
        for i in range(n_t2d):
            from_idx = i % len(collected_table_ids)
            to_idx = i % len(collected_dashboard_ids)
            lineage_tasks.append(("table", collected_table_ids[from_idx][0],
                                  "dashboard", collected_dashboard_ids[to_idx][0]))
    else:
        n_t2t += n_t2d
        n_t2d = 0

    # pipeline -> table
    if collected_pipeline_ids:
        for i in range(n_p2t):
            from_idx = i % len(collected_pipeline_ids)
            to_idx = (i + len(collected_table_ids) // 2) % len(collected_table_ids)
            lineage_tasks.append(("pipeline", collected_pipeline_ids[from_idx][0],
                                  "table", collected_table_ids[to_idx][0]))
    else:
        n_t2t += n_p2t
        n_p2t = 0

    actual_edges = len(lineage_tasks)

    def lineage_payload(idx):
        if idx >= len(lineage_tasks):
            return None
        from_type, from_id, to_type, to_id = lineage_tasks[idx]
        return {
            "__url__": f"{SERVER_URL}/api/v1/lineage",
            "__method__": "PUT",
            "edge": {
                "fromEntity": {"id": from_id, "type": from_type},
                "toEntity": {"id": to_id, "type": to_type},
            },
        }

    create_entity_batch("lineageEdges", actual_edges, lineage_payload,
                        workers=min(10, NUM_WORKERS))
elif NUM_LINEAGE_EDGES > 0:
    print("Skipping lineage: no table IDs collected")
    stats["lineageEdges"] = 0

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7: Time-Series Data
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("PHASE 7: Time-Series Data")
print("=" * 60)

ts_workers = min(10, NUM_WORKERS)
base_ts = int(time.time() * 1000)

# ── Test Case Results ────────────────────────────────────────────────────────
if NUM_TEST_CASE_RESULTS > 0 and collected_test_case_fqns:
    statuses = ["Success", "Failed", "Aborted"]

    def tc_result_payload(idx):
        fqn = collected_test_case_fqns[idx % len(collected_test_case_fqns)]
        ts = base_ts - (idx * 3600000)  # 1 hour apart
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testCases/testCaseResults",
            "__method__": "POST",
            "testCaseFQN": fqn,
            "result": f"Test result {idx}",
            "testCaseStatus": statuses[idx % len(statuses)],
            "timestamp": ts,
            "testResultValue": [{"name": "value", "value": str(random.uniform(0, 100))}],
        }

    create_entity_batch("testCaseResults", NUM_TEST_CASE_RESULTS, tc_result_payload,
                        workers=ts_workers)
elif NUM_TEST_CASE_RESULTS > 0:
    print("Skipping testCaseResults: no test case FQNs collected")
    stats["testCaseResults"] = 0

# ── Entity Report Data ───────────────────────────────────────────────────────
if NUM_ENTITY_REPORT_DATA > 0:
    entity_types_for_report = ["table", "topic", "dashboard", "pipeline", "mlmodel"]

    def entity_report_payload(idx):
        ts = base_ts - (idx * 86400000)  # 1 day apart
        e_type = entity_types_for_report[idx % len(entity_types_for_report)]
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "reportDataType": "entityReportData",
            "data": [{
                "timestamp": ts,
                "entityType": e_type,
                "entityTier": f"Tier.Tier{(idx % 5) + 1}",
                "completedDescriptions": random.randint(0, 100),
                "missingDescriptions": random.randint(0, 50),
                "hasOwner": random.random() > 0.3,
                "entityCount": random.randint(1, 1000),
            }],
        }

    create_entity_batch("entityReportData", NUM_ENTITY_REPORT_DATA, entity_report_payload,
                        workers=ts_workers)

# ── Web Analytic Entity Views ────────────────────────────────────────────────
if NUM_WEB_ANALYTIC_VIEWS > 0:
    def web_view_payload(idx):
        ts = base_ts - (idx * 60000)  # 1 minute apart
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "reportDataType": "webAnalyticEntityViewReportData",
            "data": [{
                "timestamp": ts,
                "entityType": "table",
                "entityFqn": f"test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}",
                "views": random.randint(1, 500),
                "sessionId": f"session_{idx:06d}",
            }],
        }

    create_entity_batch("webAnalyticViews", NUM_WEB_ANALYTIC_VIEWS, web_view_payload,
                        workers=ts_workers)

# ── Web Analytic User Activity ───────────────────────────────────────────────
if NUM_WEB_ANALYTIC_ACTIVITY > 0:
    def web_activity_payload(idx):
        ts = base_ts - (idx * 60000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "reportDataType": "webAnalyticUserActivityReportData",
            "data": [{
                "timestamp": ts,
                "userName": f"testuser_{idx % max(1, NUM_USERS):05d}",
                "pageViews": random.randint(1, 100),
                "sessions": random.randint(1, 20),
                "sessionDuration": random.uniform(10, 3600),
                "lastSession": ts,
            }],
        }

    create_entity_batch("webAnalyticActivity", NUM_WEB_ANALYTIC_ACTIVITY,
                        web_activity_payload, workers=ts_workers)

# ── Raw Cost Analysis ────────────────────────────────────────────────────────
if NUM_RAW_COST_ANALYSIS > 0:
    def raw_cost_payload(idx):
        ts = base_ts - (idx * 86400000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "reportDataType": "rawCostAnalysisReportData",
            "data": [{
                "timestamp": ts,
                "entity": {
                    "fullyQualifiedName": f"test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}",
                    "entityType": "table",
                },
                "totalCost": round(random.uniform(0.01, 100.0), 2),
                "count": random.randint(1, 10000),
            }],
        }

    create_entity_batch("rawCostAnalysis", NUM_RAW_COST_ANALYSIS, raw_cost_payload,
                        workers=ts_workers)

# ── Aggregated Cost Analysis ─────────────────────────────────────────────────
if NUM_AGG_COST_ANALYSIS > 0:
    def agg_cost_payload(idx):
        ts = base_ts - (idx * 86400000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "reportDataType": "aggregatedCostAnalysisReportData",
            "data": [{
                "timestamp": ts,
                "entityType": "table",
                "serviceName": "test-service-distributed",
                "totalCost": round(random.uniform(1.0, 1000.0), 2),
                "totalCount": random.randint(100, 100000),
                "unusedDataCount": random.randint(0, 1000),
                "frequentlyUsedDataCount": random.randint(0, 5000),
            }],
        }

    create_entity_batch("aggCostAnalysis", NUM_AGG_COST_ANALYSIS, agg_cost_payload,
                        workers=ts_workers)

# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
overall_elapsed = time.time() - overall_start
total_created = sum(stats.values())

print("")
print("=" * 60)
print("Test Data Loading Complete!")
print("=" * 60)
print("")
print("Summary:")
for name, count in sorted(stats.items()):
    if count > 0:
        print(f"  {name + ':':<30} {count:>8}")
print(f"  {'─' * 38}")
print(f"  {'Total:':<30} {total_created:>8}")
print("")
print(f"Time: {overall_elapsed:.1f} seconds")
if overall_elapsed > 0:
    print(f"Rate: {total_created/overall_elapsed:.1f} entities/second")
print("")
print("Collected IDs for linking:")
print(f"  Table IDs:      {len(collected_table_ids)}")
print(f"  Dashboard IDs:  {len(collected_dashboard_ids)}")
print(f"  Pipeline IDs:   {len(collected_pipeline_ids)}")
print(f"  Test Case FQNs: {len(collected_test_case_fqns)}")
PYEOF

echo ""
echo "Test data loaded. You can now trigger reindexing with: ./scripts/trigger-reindex.sh"
