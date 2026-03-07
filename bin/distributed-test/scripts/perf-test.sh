#!/bin/bash
# Load test data for distributed indexing testing
# Supports 30+ entity types including time-series data, lineage, and data quality
# Includes benchmarking, latency tracking, and cluster sizing recommendations

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
ONLY_ENTITIES=""
OUTPUT_PATH=""
AUTH_TOKEN=""
RAMP_MODE=""
RAMP_BATCH=100
ADMIN_PORT=""
SKIP_READS=""
ONLY_READS=""
MIXED_MODE=""
MIXED_DURATION=60
READ_RATIO=80
REALISTIC_MODE=""

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
                10k)
                    NUM_TABLES=5000; NUM_TOPICS=800; NUM_DASHBOARDS=400; NUM_CHARTS=800
                    NUM_PIPELINES=200; NUM_STORED_PROCEDURES=200; NUM_CONTAINERS=150
                    NUM_SEARCH_INDEXES=100; NUM_MLMODELS=100; NUM_QUERIES=200
                    NUM_DASHBOARD_DATA_MODELS=100; NUM_TEST_SUITES=3; NUM_TEST_CASES=300
                    NUM_GLOSSARY_TERMS=100; NUM_GLOSSARIES=1; NUM_TAGS=20; NUM_CLASSIFICATIONS=1
                    NUM_USERS=10; NUM_TEAMS=1; NUM_DOMAINS=1; NUM_DATA_PRODUCTS=1
                    NUM_API_COLLECTIONS=1; NUM_API_ENDPOINTS=100; NUM_LINEAGE_EDGES=400
                    NUM_TEST_CASE_RESULTS=600; NUM_ENTITY_REPORT_DATA=100
                    NUM_WEB_ANALYTIC_VIEWS=200; NUM_WEB_ANALYTIC_ACTIVITY=100
                    NUM_RAW_COST_ANALYSIS=50; NUM_AGG_COST_ANALYSIS=50
                    ;;
                small|50k)
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
                100k)
                    NUM_TABLES=50000; NUM_TOPICS=8000; NUM_DASHBOARDS=4000; NUM_CHARTS=8000
                    NUM_PIPELINES=2000; NUM_STORED_PROCEDURES=2000; NUM_CONTAINERS=1500
                    NUM_SEARCH_INDEXES=1000; NUM_MLMODELS=1000; NUM_QUERIES=2000
                    NUM_DASHBOARD_DATA_MODELS=1000; NUM_TEST_SUITES=30; NUM_TEST_CASES=3000
                    NUM_GLOSSARY_TERMS=1000; NUM_GLOSSARIES=10; NUM_TAGS=200; NUM_CLASSIFICATIONS=4
                    NUM_USERS=100; NUM_TEAMS=10; NUM_DOMAINS=2; NUM_DATA_PRODUCTS=10
                    NUM_API_COLLECTIONS=10; NUM_API_ENDPOINTS=1000; NUM_LINEAGE_EDGES=4000
                    NUM_TEST_CASE_RESULTS=6000; NUM_ENTITY_REPORT_DATA=1000
                    NUM_WEB_ANALYTIC_VIEWS=2000; NUM_WEB_ANALYTIC_ACTIVITY=1000
                    NUM_RAW_COST_ANALYSIS=500; NUM_AGG_COST_ANALYSIS=500
                    ;;
                150k)
                    NUM_TABLES=75000; NUM_TOPICS=12000; NUM_DASHBOARDS=6000; NUM_CHARTS=12000
                    NUM_PIPELINES=3000; NUM_STORED_PROCEDURES=3000; NUM_CONTAINERS=2250
                    NUM_SEARCH_INDEXES=1500; NUM_MLMODELS=1500; NUM_QUERIES=3000
                    NUM_DASHBOARD_DATA_MODELS=1500; NUM_TEST_SUITES=45; NUM_TEST_CASES=4500
                    NUM_GLOSSARY_TERMS=1500; NUM_GLOSSARIES=15; NUM_TAGS=300; NUM_CLASSIFICATIONS=6
                    NUM_USERS=150; NUM_TEAMS=15; NUM_DOMAINS=3; NUM_DATA_PRODUCTS=15
                    NUM_API_COLLECTIONS=15; NUM_API_ENDPOINTS=1500; NUM_LINEAGE_EDGES=6000
                    NUM_TEST_CASE_RESULTS=9000; NUM_ENTITY_REPORT_DATA=1500
                    NUM_WEB_ANALYTIC_VIEWS=3000; NUM_WEB_ANALYTIC_ACTIVITY=1500
                    NUM_RAW_COST_ANALYSIS=750; NUM_AGG_COST_ANALYSIS=750
                    ;;
                200k)
                    NUM_TABLES=100000; NUM_TOPICS=16000; NUM_DASHBOARDS=8000; NUM_CHARTS=16000
                    NUM_PIPELINES=4000; NUM_STORED_PROCEDURES=4000; NUM_CONTAINERS=3000
                    NUM_SEARCH_INDEXES=2000; NUM_MLMODELS=2000; NUM_QUERIES=4000
                    NUM_DASHBOARD_DATA_MODELS=2000; NUM_TEST_SUITES=60; NUM_TEST_CASES=6000
                    NUM_GLOSSARY_TERMS=2000; NUM_GLOSSARIES=20; NUM_TAGS=400; NUM_CLASSIFICATIONS=8
                    NUM_USERS=200; NUM_TEAMS=20; NUM_DOMAINS=4; NUM_DATA_PRODUCTS=20
                    NUM_API_COLLECTIONS=20; NUM_API_ENDPOINTS=2000; NUM_LINEAGE_EDGES=8000
                    NUM_TEST_CASE_RESULTS=12000; NUM_ENTITY_REPORT_DATA=2000
                    NUM_WEB_ANALYTIC_VIEWS=4000; NUM_WEB_ANALYTIC_ACTIVITY=2000
                    NUM_RAW_COST_ANALYSIS=1000; NUM_AGG_COST_ANALYSIS=1000
                    ;;
                250k)
                    NUM_TABLES=125000; NUM_TOPICS=20000; NUM_DASHBOARDS=10000; NUM_CHARTS=20000
                    NUM_PIPELINES=5000; NUM_STORED_PROCEDURES=5000; NUM_CONTAINERS=3750
                    NUM_SEARCH_INDEXES=2500; NUM_MLMODELS=2500; NUM_QUERIES=5000
                    NUM_DASHBOARD_DATA_MODELS=2500; NUM_TEST_SUITES=75; NUM_TEST_CASES=7500
                    NUM_GLOSSARY_TERMS=2500; NUM_GLOSSARIES=25; NUM_TAGS=500; NUM_CLASSIFICATIONS=10
                    NUM_USERS=250; NUM_TEAMS=25; NUM_DOMAINS=5; NUM_DATA_PRODUCTS=25
                    NUM_API_COLLECTIONS=25; NUM_API_ENDPOINTS=2500; NUM_LINEAGE_EDGES=10000
                    NUM_TEST_CASE_RESULTS=15000; NUM_ENTITY_REPORT_DATA=2500
                    NUM_WEB_ANALYTIC_VIEWS=5000; NUM_WEB_ANALYTIC_ACTIVITY=2500
                    NUM_RAW_COST_ANALYSIS=1250; NUM_AGG_COST_ANALYSIS=1250
                    ;;
                300k)
                    NUM_TABLES=150000; NUM_TOPICS=24000; NUM_DASHBOARDS=12000; NUM_CHARTS=24000
                    NUM_PIPELINES=6000; NUM_STORED_PROCEDURES=6000; NUM_CONTAINERS=4500
                    NUM_SEARCH_INDEXES=3000; NUM_MLMODELS=3000; NUM_QUERIES=6000
                    NUM_DASHBOARD_DATA_MODELS=3000; NUM_TEST_SUITES=90; NUM_TEST_CASES=9000
                    NUM_GLOSSARY_TERMS=3000; NUM_GLOSSARIES=30; NUM_TAGS=600; NUM_CLASSIFICATIONS=12
                    NUM_USERS=300; NUM_TEAMS=30; NUM_DOMAINS=6; NUM_DATA_PRODUCTS=30
                    NUM_API_COLLECTIONS=30; NUM_API_ENDPOINTS=3000; NUM_LINEAGE_EDGES=12000
                    NUM_TEST_CASE_RESULTS=18000; NUM_ENTITY_REPORT_DATA=3000
                    NUM_WEB_ANALYTIC_VIEWS=6000; NUM_WEB_ANALYTIC_ACTIVITY=3000
                    NUM_RAW_COST_ANALYSIS=1500; NUM_AGG_COST_ANALYSIS=1500
                    ;;
                350k)
                    NUM_TABLES=175000; NUM_TOPICS=28000; NUM_DASHBOARDS=14000; NUM_CHARTS=28000
                    NUM_PIPELINES=7000; NUM_STORED_PROCEDURES=7000; NUM_CONTAINERS=5250
                    NUM_SEARCH_INDEXES=3500; NUM_MLMODELS=3500; NUM_QUERIES=7000
                    NUM_DASHBOARD_DATA_MODELS=3500; NUM_TEST_SUITES=105; NUM_TEST_CASES=10500
                    NUM_GLOSSARY_TERMS=3500; NUM_GLOSSARIES=35; NUM_TAGS=700; NUM_CLASSIFICATIONS=14
                    NUM_USERS=350; NUM_TEAMS=35; NUM_DOMAINS=7; NUM_DATA_PRODUCTS=35
                    NUM_API_COLLECTIONS=35; NUM_API_ENDPOINTS=3500; NUM_LINEAGE_EDGES=14000
                    NUM_TEST_CASE_RESULTS=21000; NUM_ENTITY_REPORT_DATA=3500
                    NUM_WEB_ANALYTIC_VIEWS=7000; NUM_WEB_ANALYTIC_ACTIVITY=3500
                    NUM_RAW_COST_ANALYSIS=1750; NUM_AGG_COST_ANALYSIS=1750
                    ;;
                400k)
                    NUM_TABLES=200000; NUM_TOPICS=32000; NUM_DASHBOARDS=16000; NUM_CHARTS=32000
                    NUM_PIPELINES=8000; NUM_STORED_PROCEDURES=8000; NUM_CONTAINERS=6000
                    NUM_SEARCH_INDEXES=4000; NUM_MLMODELS=4000; NUM_QUERIES=8000
                    NUM_DASHBOARD_DATA_MODELS=4000; NUM_TEST_SUITES=120; NUM_TEST_CASES=12000
                    NUM_GLOSSARY_TERMS=4000; NUM_GLOSSARIES=40; NUM_TAGS=800; NUM_CLASSIFICATIONS=16
                    NUM_USERS=400; NUM_TEAMS=40; NUM_DOMAINS=8; NUM_DATA_PRODUCTS=40
                    NUM_API_COLLECTIONS=40; NUM_API_ENDPOINTS=4000; NUM_LINEAGE_EDGES=16000
                    NUM_TEST_CASE_RESULTS=24000; NUM_ENTITY_REPORT_DATA=4000
                    NUM_WEB_ANALYTIC_VIEWS=8000; NUM_WEB_ANALYTIC_ACTIVITY=4000
                    NUM_RAW_COST_ANALYSIS=2000; NUM_AGG_COST_ANALYSIS=2000
                    ;;
                450k)
                    NUM_TABLES=225000; NUM_TOPICS=36000; NUM_DASHBOARDS=18000; NUM_CHARTS=36000
                    NUM_PIPELINES=9000; NUM_STORED_PROCEDURES=9000; NUM_CONTAINERS=6750
                    NUM_SEARCH_INDEXES=4500; NUM_MLMODELS=4500; NUM_QUERIES=9000
                    NUM_DASHBOARD_DATA_MODELS=4500; NUM_TEST_SUITES=135; NUM_TEST_CASES=13500
                    NUM_GLOSSARY_TERMS=4500; NUM_GLOSSARIES=45; NUM_TAGS=900; NUM_CLASSIFICATIONS=18
                    NUM_USERS=450; NUM_TEAMS=45; NUM_DOMAINS=9; NUM_DATA_PRODUCTS=45
                    NUM_API_COLLECTIONS=45; NUM_API_ENDPOINTS=4500; NUM_LINEAGE_EDGES=18000
                    NUM_TEST_CASE_RESULTS=27000; NUM_ENTITY_REPORT_DATA=4500
                    NUM_WEB_ANALYTIC_VIEWS=9000; NUM_WEB_ANALYTIC_ACTIVITY=4500
                    NUM_RAW_COST_ANALYSIS=2250; NUM_AGG_COST_ANALYSIS=2250
                    ;;
                500k)
                    NUM_TABLES=250000; NUM_TOPICS=40000; NUM_DASHBOARDS=20000; NUM_CHARTS=40000
                    NUM_PIPELINES=10000; NUM_STORED_PROCEDURES=10000; NUM_CONTAINERS=7500
                    NUM_SEARCH_INDEXES=5000; NUM_MLMODELS=5000; NUM_QUERIES=10000
                    NUM_DASHBOARD_DATA_MODELS=5000; NUM_TEST_SUITES=150; NUM_TEST_CASES=15000
                    NUM_GLOSSARY_TERMS=5000; NUM_GLOSSARIES=50; NUM_TAGS=1000; NUM_CLASSIFICATIONS=20
                    NUM_USERS=500; NUM_TEAMS=50; NUM_DOMAINS=10; NUM_DATA_PRODUCTS=50
                    NUM_API_COLLECTIONS=50; NUM_API_ENDPOINTS=5000; NUM_LINEAGE_EDGES=20000
                    NUM_TEST_CASE_RESULTS=30000; NUM_ENTITY_REPORT_DATA=5000
                    NUM_WEB_ANALYTIC_VIEWS=10000; NUM_WEB_ANALYTIC_ACTIVITY=5000
                    NUM_RAW_COST_ANALYSIS=2500; NUM_AGG_COST_ANALYSIS=2500
                    ;;
                *)
                    echo "Unknown scale: $2 (use 10k|50k|100k|150k|200k|250k|300k|350k|400k|450k|500k|small|medium|large|xlarge)"
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
        --only) ONLY_ENTITIES="$2"; shift 2 ;;
        --output) OUTPUT_PATH="$2"; shift 2 ;;
        --token) AUTH_TOKEN="$2"; shift 2 ;;
        --ramp) RAMP_MODE="true"; shift ;;
        --ramp-batch) RAMP_BATCH="$2"; shift 2 ;;
        --admin-port) ADMIN_PORT="$2"; shift 2 ;;
        --skip-reads) SKIP_READS="true"; shift ;;
        --only-reads) ONLY_READS="true"; shift ;;
        --mixed) MIXED_MODE="true"; shift ;;
        --mixed-duration) MIXED_DURATION="$2"; shift 2 ;;
        --read-ratio) READ_RATIO="$2"; shift 2 ;;
        --realistic) REALISTIC_MODE="true"; shift ;;
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
Usage: perf-test.sh [OPTIONS]

Scale presets:
  --scale {10k|50k|100k|...|500k|small|medium|large|xlarge}
                                        Apply a preset (see table below)
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

Benchmarking & filtering:
  --only ENTITIES               Comma-separated entity types to create (e.g. tables,charts,topics)
                                When specified, only listed entities run. Prerequisites auto-enabled.
                                Valid names: tables, topics, dashboards, charts, pipelines,
                                  storedProcedures, containers, searchIndexes, mlmodels, queries,
                                  dashboardDataModels, testSuites, testCases, glossaries,
                                  glossaryTerms, users, teams, domains, dataProducts,
                                  apiCollections, apiEndpoints, lineageEdges, testCaseResults,
                                  entityReportData, webAnalyticViews, webAnalyticActivity,
                                  rawCostAnalysis, aggCostAnalysis
  --output PATH                 Write JSON benchmark report to PATH
                                (default: benchmark-report-{timestamp}.json in current dir)
  --token TOKEN                 Auth token (overrides hardcoded default)
  --ramp                        Run concurrency ramp test before main load
  --ramp-batch NUM              Entities per ramp level (default: 100)
  --admin-port PORT             Admin port for Prometheus metrics scraping

Read & mixed workload benchmarking:
  --skip-reads                  Skip read benchmarking phase (Phase 8)
  --only-reads                  Skip write phases; discover existing entities and run reads only
  --mixed                       Run mixed read/write workload (Phase 9)
  --mixed-duration SECS         Duration of mixed workload in seconds (default: 60)
  --read-ratio PCT              Read percentage in mixed workload (default: 80)
  --realistic                   Run Phase 4 with all entity types concurrently in a shared worker pool

Other:
  --server URL                  Target server URL (default: https://mohitcorp.getcollate.io)
  --workers NUM                 Concurrent workers (default: 20)
  -h, --help                    Show this help message

Scale preset totals (numeric):
  10k  ~10K     50k  ~50K      100k  ~100K    150k  ~150K    200k  ~200K
  250k  ~250K   300k  ~300K    350k  ~350K    400k  ~400K    450k  ~450K
  500k  ~500K

Scale preset totals (named):
  xlarge  ~5M    large  ~2M    medium  ~500K    small  ~50K

Examples:
  # Quick benchmark with just tables
  ./perf-test.sh --only tables --tables 100 --workers 5

  # Full benchmark with JSON output
  ./perf-test.sh --quick --workers 10 --output /tmp/bench.json

  # Only tables and charts, custom counts
  ./perf-test.sh --only tables,charts --tables 5000 --charts 2000

  # Ramp test to find optimal concurrency
  ./perf-test.sh --ramp --only tables --tables 500 --workers 32

  # Full benchmark with Prometheus metrics from admin port
  ./perf-test.sh --quick --workers 10 --admin-port 8586 --output /tmp/bench.json

  # Read benchmarks after write load
  ./perf-test.sh --scale 10k --server http://localhost:8585 --output /tmp/bench.json

  # Read-only benchmark (discover existing entities)
  ./perf-test.sh --only-reads --server http://localhost:8585

  # Mixed read/write workload for 2 minutes, 80% reads
  ./perf-test.sh --scale 10k --mixed --mixed-duration 120 --read-ratio 80

  # Realistic concurrent workload (all entity types hit server simultaneously)
  ./perf-test.sh --scale 10k --realistic --server http://localhost:8585
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
if [ -n "$ONLY_ENTITIES" ]; then
    echo "Only:   $ONLY_ENTITIES"
fi
if [ -n "$RAMP_MODE" ]; then
    echo "Ramp:   enabled (batch=$RAMP_BATCH)"
fi
if [ -n "$ADMIN_PORT" ]; then
    echo "Admin:  port $ADMIN_PORT (Prometheus metrics)"
fi
if [ -n "$SKIP_READS" ]; then
    echo "Reads:  skipped"
fi
if [ -n "$ONLY_READS" ]; then
    echo "Mode:   read-only (discover existing entities)"
fi
if [ -n "$MIXED_MODE" ]; then
    echo "Mixed:  enabled (${MIXED_DURATION}s, ${READ_RATIO}% reads)"
fi
if [ -n "$REALISTIC_MODE" ]; then
    echo "Mode:   realistic (concurrent cross-entity workload)"
fi
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
import uuid
import threading
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

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

ONLY_ENTITIES_RAW = "${ONLY_ENTITIES}"
OUTPUT_PATH_RAW = "${OUTPUT_PATH}"
AUTH_TOKEN_RAW = "${AUTH_TOKEN}"
SCALE_APPLIED = "${SCALE_APPLIED}" or "default"
RAMP_MODE = "${RAMP_MODE}" == "true"
RAMP_BATCH = ${RAMP_BATCH}
ADMIN_PORT_RAW = "${ADMIN_PORT}"
SKIP_READS = "${SKIP_READS}" == "true"
ONLY_READS = "${ONLY_READS}" == "true"
MIXED_MODE = "${MIXED_MODE}" == "true"
MIXED_DURATION = ${MIXED_DURATION}
READ_RATIO = ${READ_RATIO}
REALISTIC_MODE = "${REALISTIC_MODE}" == "true"

# Auto-calculate database/schema counts
NUM_DATABASES = max(1, NUM_TABLES // 50000)
SCHEMAS_PER_DB = min(20, max(1, NUM_TABLES // (NUM_DATABASES * 5000))) if NUM_TABLES > 0 else 1

# ── Entity filter (--only) ───────────────────────────────────────────────────
ONLY_ENTITIES = set()
if ONLY_ENTITIES_RAW.strip():
    ONLY_ENTITIES = {e.strip() for e in ONLY_ENTITIES_RAW.split(",") if e.strip()}

ENTITY_PREREQUISITES = {
    "tables": {"_services_db", "_infra_db"},
    "storedProcedures": {"_services_db", "_infra_db"},
    "queries": {"_services_db"},
    "dashboards": {"_services_dashboard"},
    "charts": {"_services_dashboard"},
    "dashboardDataModels": {"_services_dashboard"},
    "topics": {"_services_messaging"},
    "pipelines": {"_services_pipeline"},
    "mlmodels": {"_services_mlmodel"},
    "containers": {"_services_storage"},
    "searchIndexes": {"_services_search"},
    "apiCollections": {"_services_api"},
    "apiEndpoints": {"_services_api", "apiCollections"},
    "dataProducts": {"domains"},
    "glossaryTerms": {"glossaries"},
    "tags": {"classifications"},
    "testCases": {"tables", "_services_db", "_infra_db"},
    "testCaseResults": {"testCases", "tables", "_services_db", "_infra_db"},
    "lineageEdges": {"tables", "_services_db", "_infra_db"},
}

def _resolve_prerequisites(entities):
    resolved = set(entities)
    changed = True
    while changed:
        changed = False
        for e in list(resolved):
            for prereq in ENTITY_PREREQUISITES.get(e, set()):
                if prereq not in resolved:
                    resolved.add(prereq)
                    changed = True
    return resolved

if ONLY_ENTITIES:
    _resolved = _resolve_prerequisites(ONLY_ENTITIES)
    _infra_needed = {p for p in _resolved if p.startswith("_")}
    _resolved -= _infra_needed
else:
    _resolved = set()
    _infra_needed = set()

def should_run(entity_name):
    if ONLY_READS:
        return False
    if not ONLY_ENTITIES:
        return True
    return entity_name in ONLY_ENTITIES or entity_name in _resolved

def _need_infra(tag):
    if ONLY_READS:
        return False
    if not ONLY_ENTITIES:
        return True
    return tag in _infra_needed

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
                body = resp.read().decode("utf-8")
                try:
                    parsed = json.loads(body) if body.strip() else {}
                except json.JSONDecodeError:
                    parsed = body
                return resp.status, parsed
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

# ── Auth token ───────────────────────────────────────────────────────────────
if AUTH_TOKEN_RAW.strip():
    token = AUTH_TOKEN_RAW.strip()
    print("Using token from --token argument.")
else:
    token = ("eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg")
    print("Using default admin JWT token for authentication.")

headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

# ── Output path ──────────────────────────────────────────────────────────────
if OUTPUT_PATH_RAW.strip():
    output_path = OUTPUT_PATH_RAW.strip()
else:
    ts_str = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_path = f"benchmark-report-{ts_str}.json"

# ══════════════════════════════════════════════════════════════════════════════
# SERVER INTROSPECTION
# ══════════════════════════════════════════════════════════════════════════════

class ServerIntrospector:
    def __init__(self, server_url, req_headers, admin_port=None):
        self.server_url = server_url
        self.req_headers = req_headers
        self.admin_port = admin_port
        self.info = {}

    def _parse_url_host(self):
        from urllib.parse import urlparse
        parsed = urlparse(self.server_url)
        return parsed.hostname or "localhost"

    def collect(self):
        print("Collecting server introspection data...")
        sys.stdout.flush()

        status, resp = make_request(
            f"{self.server_url}/api/v1/system/version",
            method="GET", headers=self.req_headers, retries=2,
        )
        if status == 200 and isinstance(resp, dict):
            self.info["version"] = resp.get("version", "unknown")
            self.info["revision"] = resp.get("revision", "unknown")
            print(f"  Server version: {self.info['version']} (rev: {self.info['revision']})")
        else:
            self.info["version"] = "unreachable"
            self.info["revision"] = "unknown"
            print(f"  Could not fetch version (status={status})")

        status, resp = make_request(
            f"{self.server_url}/api/v1/system/status",
            method="GET", headers=self.req_headers, retries=2,
        )
        if status == 200 and isinstance(resp, dict):
            self.info["status"] = resp
            healthy_components = sum(1 for v in resp.values() if isinstance(v, dict) and v.get("passed"))
            total_components = sum(1 for v in resp.values() if isinstance(v, dict))
            print(f"  Component health: {healthy_components}/{total_components} healthy")
        else:
            self.info["status"] = {"error": f"status={status}"}
            print(f"  Could not fetch status (status={status})")

        status, resp = make_request(
            f"{self.server_url}/api/v1/system/entities/count",
            method="GET", headers=self.req_headers, retries=2,
        )
        if status == 200 and isinstance(resp, dict):
            self.info["entity_counts"] = resp
            total_entities = sum(v for v in resp.values() if isinstance(v, (int, float)))
            print(f"  Pre-existing entities: {total_entities:,}")
        else:
            self.info["entity_counts"] = {}
            print(f"  Could not fetch entity counts (status={status})")

        status, resp = make_request(
            f"{self.server_url}/api/v1/system/services/count",
            method="GET", headers=self.req_headers, retries=2,
        )
        if status == 200 and isinstance(resp, dict):
            self.info["service_counts"] = resp
        else:
            self.info["service_counts"] = {}

        if self.admin_port:
            self._scrape_prometheus("before")

        self.collect_diagnostics("before")

        sys.stdout.flush()
        return self.info

    def _scrape_prometheus(self, label):
        host = self._parse_url_host()
        prom_url = f"http://{host}:{self.admin_port}/prometheus"
        print(f"  Scraping Prometheus metrics ({label}) from {prom_url}...")
        sys.stdout.flush()
        try:
            req = urllib.request.Request(prom_url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
            metrics = self._parse_prometheus(body)
            key = f"prometheus_{label}"
            self.info[key] = metrics
            heap_used = metrics.get("jvm_memory_bytes_used_heap", "N/A")
            heap_max = metrics.get("jvm_memory_bytes_max_heap", "N/A")
            if isinstance(heap_used, (int, float)) and isinstance(heap_max, (int, float)):
                print(f"    JVM heap: {heap_used / 1048576:.0f}MB / {heap_max / 1048576:.0f}MB")
            thread_count = metrics.get("jvm_threads_current", "N/A")
            print(f"    JVM threads: {thread_count}")
            db_active = metrics.get("hikaricp_connections_active", "N/A")
            db_idle = metrics.get("hikaricp_connections_idle", "N/A")
            db_total = metrics.get("hikaricp_connections_total", "N/A")
            print(f"    DB pool: active={db_active}, idle={db_idle}, total={db_total}")
        except Exception as e:
            self.info[f"prometheus_{label}"] = {"error": str(e)}
            print(f"    Failed to scrape Prometheus: {e}")
        sys.stdout.flush()

    def collect_diagnostics(self, label):
        diag_url = f"{self.server_url}/api/v1/system/diagnostics"
        print(f"  Collecting diagnostics ({label}) from {diag_url}...")
        sys.stdout.flush()
        try:
            status, resp = make_request(diag_url, method="GET", headers=self.req_headers, retries=2)
            if status == 200 and isinstance(resp, dict):
                self.info[f"diagnostics_{label}"] = resp
                jvm = resp.get("jvm", {})
                jetty = resp.get("jetty", {})
                db = resp.get("database", {})
                bulk = resp.get("bulk_executor", {})
                heap_pct = jvm.get("heap_usage_pct", "N/A")
                print(f"    JVM heap: {heap_pct}% used, GC pauses: {jvm.get('gc_pause_total_ms', 0)}ms")
                print(f"    Jetty: {jetty.get('threads_busy', '?')}/{jetty.get('threads_max', '?')} "
                      f"threads busy ({jetty.get('utilization_pct', 0)}%), "
                      f"queue: {jetty.get('queue_size', 0)}")
                print(f"    DB pool: {db.get('pool_active', '?')}/{db.get('pool_max', '?')} "
                      f"active ({db.get('pool_usage_pct', 0)}%), "
                      f"pending: {db.get('pool_pending', 0)}")
                print(f"    Bulk executor: queue {bulk.get('queue_depth', 0)}/{bulk.get('queue_capacity', '?')} "
                      f"({bulk.get('queue_usage_pct', 0)}%)")
                return resp
            else:
                print(f"    Diagnostics endpoint returned status={status} (may not be available)")
                self.info[f"diagnostics_{label}"] = None
                return None
        except Exception as e:
            print(f"    Failed to collect diagnostics: {e}")
            self.info[f"diagnostics_{label}"] = None
            return None

    def scrape_after(self):
        if self.admin_port:
            self._scrape_prometheus("after")

    @staticmethod
    def _parse_prometheus(text):
        metrics = {}
        target_prefixes = [
            "jvm_memory_bytes_used", "jvm_memory_bytes_max",
            "jvm_threads_current", "jvm_threads_daemon",
            "hikaricp_connections_active", "hikaricp_connections_idle",
            "hikaricp_connections_total", "hikaricp_connections_pending",
            "io_dropwizard_jetty_MutableServletContextHandler_percent",
            "io_dropwizard_jetty_MutableServletContextHandler_requests",
        ]
        for line in text.split("\n"):
            if line.startswith("#") or not line.strip():
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            metric_name = parts[0]
            try:
                value = float(parts[1])
            except ValueError:
                continue
            for prefix in target_prefixes:
                if metric_name.startswith(prefix):
                    if 'area="heap"' in metric_name:
                        if "bytes_used" in metric_name:
                            metrics["jvm_memory_bytes_used_heap"] = value
                        elif "bytes_max" in metric_name:
                            metrics["jvm_memory_bytes_max_heap"] = value
                    elif 'area="nonheap"' not in metric_name:
                        simple_name = metric_name.split("{")[0]
                        if simple_name not in metrics:
                            metrics[simple_name] = value
                    break
        return metrics

    def report_section(self):
        return dict(self.info)


introspector = ServerIntrospector(
    SERVER_URL, dict(headers),
    admin_port=ADMIN_PORT_RAW.strip() if ADMIN_PORT_RAW.strip() else None,
)
server_info = introspector.collect()

# ══════════════════════════════════════════════════════════════════════════════
# BENCHMARK INFRASTRUCTURE
# ══════════════════════════════════════════════════════════════════════════════

class BenchmarkCollector:
    def __init__(self, entity_name, requested_count):
        self.entity_name = entity_name
        self.requested = requested_count
        self.latencies = []
        self.errors = []
        self.created = 0
        self.failed = 0
        self.start_time = None
        self.end_time = None
        self.lock = threading.Lock()
        self.window_counts = []

    def record_success(self, latency_s):
        with self.lock:
            self.latencies.append(latency_s)
            self.created += 1

    def record_failure(self, latency_s, status, error):
        with self.lock:
            self.latencies.append(latency_s)
            self.failed += 1
            if len(self.errors) < 50:
                self.errors.append({"status": status, "error": str(error)[:200]})

    def _error_breakdown(self):
        breakdown = {}
        for e in self.errors:
            code = e.get("status", 0)
            if code == 0:
                key = "connection_error"
            else:
                key = str(code)
            breakdown[key] = breakdown.get(key, 0) + 1
        return breakdown

    def _latency_analysis(self):
        if len(self.latencies) < 10:
            return {}
        s = sorted(self.latencies)
        n = len(s)
        p50 = s[int(n * 0.50)] * 1000
        p90 = s[min(int(n * 0.90), n - 1)] * 1000
        p95 = s[min(int(n * 0.95), n - 1)] * 1000
        p99 = s[min(int(n * 0.99), n - 1)] * 1000

        p90_p50_ratio = round(p90 / p50, 1) if p50 > 0 else 0
        p99_p95_ratio = round(p99 / p95, 1) if p95 > 0 else 0

        bimodal = p90_p50_ratio > 5.0

        degradation_pct = 0.0
        if n >= 20:
            chunk = max(1, n // 5)
            first_20 = s[:chunk]
            last_20 = s[-chunk:]
            avg_first = sum(first_20) / len(first_20) if first_20 else 0
            avg_last = sum(last_20) / len(last_20) if last_20 else 0
            if avg_first > 0:
                degradation_pct = round((avg_last / avg_first - 1) * 100, 1)

        result = {
            "bimodal": bimodal,
            "p90_p50_ratio": p90_p50_ratio,
            "p99_p95_ratio": p99_p95_ratio,
            "degradation_pct": degradation_pct,
        }

        findings = []
        if bimodal:
            findings.append(
                f"Bimodal latency distribution (p50={p50:.0f}ms, p90={p90:.0f}ms, "
                f"ratio={p90_p50_ratio}x) -- likely DB connection pool or thread pool wait"
            )
        if p99_p95_ratio > 3.0:
            findings.append(
                f"Extreme tail latency (p95={p95:.0f}ms, p99={p99:.0f}ms, "
                f"ratio={p99_p95_ratio}x) -- possible GC pauses or lock contention"
            )
        if degradation_pct > 100.0:
            findings.append(
                f"Sustained load degradation: last 20% of requests {degradation_pct:.0f}% "
                f"slower than first 20% -- resource exhaustion"
            )
        result["findings"] = findings
        return result

    def percentile(self, p):
        if not self.latencies:
            return 0
        s = sorted(self.latencies)
        k = int(len(s) * p / 100)
        return s[min(k, len(s) - 1)]

    def _throughput_windows(self):
        if not self.window_counts or len(self.window_counts) < 2:
            return []
        buckets = []
        bucket_size = 5
        start_ts = self.window_counts[0][0]
        i = 0
        while i < len(self.window_counts):
            bucket_start = start_ts + len(buckets) * bucket_size
            bucket_end = bucket_start + bucket_size
            count_at_start = self.window_counts[i][1] if i == 0 else None
            count_at_end = None
            for j in range(i, len(self.window_counts)):
                if self.window_counts[j][0] >= bucket_end:
                    break
                count_at_end = self.window_counts[j][1]
                if count_at_start is None:
                    count_at_start = self.window_counts[j][1]
                i = j + 1
            if count_at_start is not None and count_at_end is not None:
                delta = count_at_end - count_at_start
                rps = delta / bucket_size if bucket_size > 0 else 0
                buckets.append({
                    "elapsed_s": round(bucket_end - start_ts, 1),
                    "rps": round(rps, 1),
                })
            else:
                i += 1
        return buckets

    def summary(self):
        n = len(self.latencies)
        if n == 0:
            return None
        elapsed = (self.end_time or time.time()) - self.start_time if self.start_time else 0
        s = sorted(self.latencies)
        result = {
            "requested": self.requested,
            "total_requests": n,
            "created": self.created,
            "failed": self.failed,
            "error_rate_pct": round(self.failed / n * 100, 2) if n > 0 else 0,
            "wall_clock_s": round(elapsed, 2),
            "throughput_rps": round(n / elapsed, 2) if elapsed > 0 else 0,
            "latency_ms": {
                "min": round(s[0] * 1000, 1),
                "p50": round(self.percentile(50) * 1000, 1),
                "p75": round(self.percentile(75) * 1000, 1),
                "p90": round(self.percentile(90) * 1000, 1),
                "p95": round(self.percentile(95) * 1000, 1),
                "p99": round(self.percentile(99) * 1000, 1),
                "max": round(s[-1] * 1000, 1),
                "avg": round(sum(s) / len(s) * 1000, 1),
            },
            "throughput_over_time": self._throughput_windows(),
            "errors_sample": self.errors[:10],
            "latency_analysis": self._latency_analysis(),
            "error_breakdown": self._error_breakdown(),
        }
        return result


class HealthMonitor:
    def __init__(self, server_url, req_headers, interval=5, diagnostics_interval=10):
        self.server_url = server_url
        self.req_headers = req_headers
        self.interval = interval
        self.diagnostics_interval = diagnostics_interval
        self.samples = []
        self.diagnostics_samples = []
        self.running = True
        self.start_time = time.time()
        self._last_diag_time = 0
        self._thread = threading.Thread(target=self._poll, daemon=True)
        self._thread.start()

    def _poll(self):
        while self.running:
            t0 = time.time()
            try:
                status, _ = make_request(
                    f"{self.server_url}/api/v1/system/version",
                    method="GET", headers=self.req_headers, retries=1,
                )
            except Exception:
                status = 0
            latency = (time.time() - t0) * 1000
            self.samples.append({
                "timestamp": time.time(),
                "elapsed_s": round(time.time() - self.start_time, 1),
                "latency_ms": round(latency, 1),
                "status": status,
                "healthy": status == 200,
            })
            now = time.time()
            if now - self._last_diag_time >= self.diagnostics_interval:
                self._last_diag_time = now
                self._sample_diagnostics()
            time.sleep(self.interval)

    def _sample_diagnostics(self):
        diag_url = f"{self.server_url}/api/v1/system/diagnostics"
        try:
            status, resp = make_request(diag_url, method="GET", headers=self.req_headers, retries=1)
            if status == 200 and isinstance(resp, dict):
                resp["_sample_elapsed_s"] = round(time.time() - self.start_time, 1)
                self.diagnostics_samples.append(resp)
        except Exception:
            pass

    def stop(self):
        self.running = False
        self._thread.join(timeout=self.interval + 2)

    def summary(self):
        if not self.samples:
            return {
                "total_checks": 0, "healthy": 0, "unhealthy": 0,
                "health_latency_ms": {}, "timeline": [],
            }
        healthy = [s for s in self.samples if s["healthy"]]
        unhealthy = [s for s in self.samples if not s["healthy"]]
        latencies = sorted([s["latency_ms"] for s in self.samples])
        n = len(latencies)
        result = {
            "total_checks": n,
            "healthy": len(healthy),
            "unhealthy": len(unhealthy),
            "health_latency_ms": {
                "min": round(latencies[0], 1),
                "avg": round(sum(latencies) / n, 1),
                "p95": round(latencies[min(int(n * 0.95), n - 1)], 1),
                "max": round(latencies[-1], 1),
            },
            "timeline": self.samples,
        }
        if self.diagnostics_samples:
            result["diagnostics_during"] = self.diagnostics_samples
        return result


# ── Start health monitor ────────────────────────────────────────────────────
health_monitor = HealthMonitor(SERVER_URL, dict(headers), interval=5)

overall_start = time.time()
stats = {}
benchmarks = {}
phase_timings = {}

# ── Collected IDs for linking phases ─────────────────────────────────────────
collected_table_ids = []
collected_dashboard_ids = []
collected_pipeline_ids = []
collected_test_case_fqns = []
collect_lock = threading.Lock()

MAX_COLLECT = max(NUM_LINEAGE_EDGES * 2, NUM_TEST_CASE_RESULTS, 10000)

# ── Generic batch creator (with benchmarking) ───────────────────────────────
def create_entity_batch(entity_name, count, payload_fn, workers=None, collect_fn=None,
                        log_interval=None):
    if count <= 0:
        return 0, None
    if workers is None:
        workers = NUM_WORKERS
    if log_interval is None:
        log_interval = max(1, count // 20)

    bench = BenchmarkCollector(entity_name, count)
    bench.start_time = time.time()

    print(f"\nCreating {count} {entity_name}...")
    sys.stdout.flush()

    counter_lock = threading.Lock()
    sample_running = True

    def _sampler():
        while sample_running:
            with counter_lock:
                total = bench.created + bench.failed
            bench.window_counts.append((time.time(), total))
            time.sleep(1)

    sampler_thread = threading.Thread(target=_sampler, daemon=True)
    sampler_thread.start()

    def _work(idx):
        t0 = time.time()
        payload = payload_fn(idx)
        if payload is None:
            return
        url = payload.pop("__url__", None)
        method = payload.pop("__method__", "PUT")
        if url is None:
            return
        status, resp = make_request(url, data=payload, method=method, headers=headers)
        latency = time.time() - t0
        ok = status in [200, 201]
        if ok:
            bench.record_success(latency)
        else:
            bench.record_failure(latency, status, resp)
        with counter_lock:
            total = bench.created + bench.failed
            if total % log_interval == 0 or total == count:
                elapsed = time.time() - bench.start_time
                rate = total / elapsed if elapsed > 0 else 0
                print(f"  {entity_name}: {total}/{count} ({rate:.1f}/sec) - OK: {bench.created}, Fail: {bench.failed}")
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

    sample_running = False
    bench.end_time = time.time()
    stats[entity_name] = bench.created
    benchmarks[entity_name] = bench
    elapsed = time.time() - bench.start_time
    p50 = bench.percentile(50) * 1000
    p95 = bench.percentile(95) * 1000
    print(f"{entity_name} done: {bench.created} created, {bench.failed} failed "
          f"({elapsed:.1f}s, p50={p50:.0f}ms, p95={p95:.0f}ms)")
    sys.stdout.flush()
    return bench.created, bench


# ── Generic batch reader (with benchmarking) ─────────────────────────────────
def read_entity_batch(entity_name, items, url_fn, workers=None, log_interval=None):
    count = len(items)
    if count <= 0:
        return 0, None
    if workers is None:
        workers = NUM_WORKERS
    if log_interval is None:
        log_interval = max(1, count // 20)

    bench = BenchmarkCollector(entity_name, count)
    bench.start_time = time.time()

    print(f"\nReading {count} {entity_name}...")
    sys.stdout.flush()

    counter_lock = threading.Lock()
    sample_running = True

    def _sampler():
        while sample_running:
            with counter_lock:
                total = bench.created + bench.failed
            bench.window_counts.append((time.time(), total))
            time.sleep(1)

    sampler_thread = threading.Thread(target=_sampler, daemon=True)
    sampler_thread.start()

    def _work(idx):
        t0 = time.time()
        url = url_fn(idx)
        if url is None:
            return
        status, resp = make_request(url, method="GET", headers=headers)
        latency = time.time() - t0
        ok = status == 200
        if ok:
            bench.record_success(latency)
        else:
            bench.record_failure(latency, status, resp)
        with counter_lock:
            total = bench.created + bench.failed
            if total % log_interval == 0 or total == count:
                elapsed = time.time() - bench.start_time
                rate = total / elapsed if elapsed > 0 else 0
                print(f"  {entity_name}: {total}/{count} ({rate:.1f}/sec) - OK: {bench.created}, Fail: {bench.failed}")
                sys.stdout.flush()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_work, i) for i in range(count)]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception:
                pass

    sample_running = False
    bench.end_time = time.time()
    benchmarks[f"read_{entity_name}"] = bench
    elapsed = time.time() - bench.start_time
    p50 = bench.percentile(50) * 1000
    p95 = bench.percentile(95) * 1000
    print(f"read_{entity_name} done: {bench.created} OK, {bench.failed} failed "
          f"({elapsed:.1f}s, p50={p50:.0f}ms, p95={p95:.0f}ms)")
    sys.stdout.flush()
    return bench.created, bench


# ── Mixed workload runner ────────────────────────────────────────────────────
def run_mixed_workload(duration_s, read_ratio_pct, workers, table_ids, schema_fqns_list):
    read_bench = BenchmarkCollector("mixed_reads", 0)
    write_bench = BenchmarkCollector("mixed_writes", 0)
    read_bench.start_time = time.time()
    write_bench.start_time = time.time()

    stop_event = threading.Event()
    ops_counter = [0]
    ops_lock = threading.Lock()

    search_terms = ["table", "test", "data", "pipeline", "report", "analytics", "cost", "model"]

    def _worker():
        while not stop_event.is_set():
            is_read = random.randint(1, 100) <= read_ratio_pct
            t0 = time.time()
            if is_read and table_ids:
                op_type = random.choice(["get_by_id", "list", "search"])
                if op_type == "get_by_id":
                    tid, _ = random.choice(table_ids)
                    url = f"{SERVER_URL}/api/v1/tables/{tid}"
                    status, resp = make_request(url, method="GET", headers=headers)
                elif op_type == "list":
                    offset = random.randint(0, max(1, len(table_ids) - 10))
                    url = f"{SERVER_URL}/api/v1/tables?limit=10&offset={offset}"
                    status, resp = make_request(url, method="GET", headers=headers)
                else:
                    term = random.choice(search_terms)
                    url = f"{SERVER_URL}/api/v1/search/query?q={term}&index=table_search_index&from=0&size=10"
                    status, resp = make_request(url, method="GET", headers=headers)
                latency = time.time() - t0
                if status == 200:
                    read_bench.record_success(latency)
                else:
                    read_bench.record_failure(latency, status, resp)
            elif schema_fqns_list:
                with ops_lock:
                    idx = ops_counter[0]
                    ops_counter[0] += 1
                sfqn = schema_fqns_list[idx % len(schema_fqns_list)]
                payload = {
                    "name": f"mixed_table_{idx:07d}",
                    "databaseSchema": sfqn,
                    "columns": [
                        {"name": "id", "dataType": "BIGINT"},
                        {"name": "name", "dataType": "VARCHAR", "dataLength": 255},
                    ],
                }
                url = f"{SERVER_URL}/api/v1/tables"
                status, resp = make_request(url, data=payload, method="PUT", headers=headers)
                latency = time.time() - t0
                if status in [200, 201]:
                    write_bench.record_success(latency)
                else:
                    write_bench.record_failure(latency, status, resp)

    print(f"\nMixed workload: {workers} workers, {duration_s}s, {read_ratio_pct}% reads")
    sys.stdout.flush()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_worker) for _ in range(workers)]
        start = time.time()
        last_log = start
        while time.time() - start < duration_s:
            time.sleep(1)
            now = time.time()
            if now - last_log >= 10:
                last_log = now
                elapsed = now - start
                r_total = read_bench.created + read_bench.failed
                w_total = write_bench.created + write_bench.failed
                combined_rps = (r_total + w_total) / elapsed if elapsed > 0 else 0
                print(f"  Mixed [{elapsed:.0f}s]: reads={r_total}, writes={w_total}, "
                      f"combined={combined_rps:.1f} rps")
                sys.stdout.flush()
        stop_event.set()
        for f in futures:
            try:
                f.result(timeout=10)
            except Exception:
                pass

    read_bench.end_time = time.time()
    write_bench.end_time = time.time()
    r_total = read_bench.created + read_bench.failed
    w_total = write_bench.created + write_bench.failed
    elapsed = read_bench.end_time - read_bench.start_time
    print(f"Mixed workload done: {r_total} reads, {w_total} writes in {elapsed:.1f}s")
    sys.stdout.flush()
    return read_bench, write_bench


# ── Realistic concurrent workload runner ─────────────────────────────────
def run_realistic_phase(entity_configs, workers):
    """Run all entity types concurrently through a single shared worker pool.

    entity_configs: list of {"name": str, "count": int, "payload_fn": fn, "collect_fn": fn|None}
    workers: shared thread pool size
    """
    entity_configs = [c for c in entity_configs if c["count"] > 0]
    if not entity_configs:
        return

    total_items = sum(c["count"] for c in entity_configs)
    print(f"\nREALISTIC CONCURRENT WORKLOAD: {len(entity_configs)} entity types, "
          f"{total_items} total items, {workers} shared workers")
    sys.stdout.flush()

    per_entity_bench = {}
    combined_bench = BenchmarkCollector("realistic_combined", total_items)
    for cfg in entity_configs:
        per_entity_bench[cfg["name"]] = BenchmarkCollector(cfg["name"], cfg["count"])

    work_queue = []
    for cfg in entity_configs:
        for idx in range(cfg["count"]):
            work_queue.append((cfg["name"], idx, cfg["payload_fn"], cfg["collect_fn"]))

    random.shuffle(work_queue)

    counter_lock = threading.Lock()
    completed_count = [0]
    combined_bench.start_time = time.time()
    for b in per_entity_bench.values():
        b.start_time = combined_bench.start_time

    sample_running = True
    log_interval = max(1, total_items // 20)

    def _sampler():
        while sample_running:
            with counter_lock:
                total = completed_count[0]
            combined_bench.window_counts.append((time.time(), total))
            time.sleep(1)

    sampler_thread = threading.Thread(target=_sampler, daemon=True)
    sampler_thread.start()

    def _work(item):
        entity_name, idx, payload_fn, collect_fn = item
        t0 = time.time()
        payload = payload_fn(idx)
        if payload is None:
            return
        url = payload.pop("__url__", None)
        method = payload.pop("__method__", "PUT")
        if url is None:
            return
        status, resp = make_request(url, data=payload, method=method, headers=headers)
        latency = time.time() - t0
        ok = status in [200, 201]
        eb = per_entity_bench[entity_name]
        if ok:
            eb.record_success(latency)
            combined_bench.record_success(latency)
        else:
            eb.record_failure(latency, status, resp)
            combined_bench.record_failure(latency, status, resp)
        with counter_lock:
            completed_count[0] += 1
            total = completed_count[0]
            if total % log_interval == 0 or total == len(work_queue):
                elapsed = time.time() - combined_bench.start_time
                rate = total / elapsed if elapsed > 0 else 0
                per_type_str = ", ".join(
                    f"{n}={b.created}" for n, b in per_entity_bench.items() if b.created > 0
                )
                print(f"  realistic: {total}/{len(work_queue)} ({rate:.1f}/sec) [{per_type_str}]")
                sys.stdout.flush()
        if ok and collect_fn and isinstance(resp, dict):
            collect_fn(idx, resp)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_work, item) for item in work_queue]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception:
                pass

    sample_running = False
    now = time.time()
    combined_bench.end_time = now
    for b in per_entity_bench.values():
        b.end_time = now

    for name, b in per_entity_bench.items():
        stats[name] = b.created
        benchmarks[name] = b

    benchmarks["realistic_combined"] = combined_bench
    stats["realistic_combined"] = combined_bench.created

    elapsed = now - combined_bench.start_time
    p50 = combined_bench.percentile(50) * 1000
    p95 = combined_bench.percentile(95) * 1000
    print(f"Realistic workload done: {combined_bench.created} created, "
          f"{combined_bench.failed} failed ({elapsed:.1f}s, p50={p50:.0f}ms, p95={p95:.0f}ms)")
    for name, b in per_entity_bench.items():
        if b.created > 0 or b.failed > 0:
            bp50 = b.percentile(50) * 1000
            bp95 = b.percentile(95) * 1000
            print(f"  {name}: {b.created} created, {b.failed} failed "
                  f"(p50={bp50:.0f}ms, p95={bp95:.0f}ms)")
    sys.stdout.flush()


# ── Ramp tester ──────────────────────────────────────────────────────────────
class RampTester:
    def __init__(self, server_url, req_headers, max_workers, batch_size=100):
        self.server_url = server_url
        self.req_headers = req_headers
        self.max_workers = max_workers
        self.batch_size = batch_size
        self.levels = []
        self.optimal_workers = 1
        self.saturation_point = None

    def _ramp_levels(self):
        levels = []
        w = 1
        while w <= self.max_workers:
            levels.append(w)
            w *= 2
        if levels and levels[-1] != self.max_workers and self.max_workers > levels[-1]:
            levels.append(self.max_workers)
        return levels

    def run(self, entity_type="tables", schema_fqns_list=None, service_fqn=None):
        levels = self._ramp_levels()
        print(f"\nRAMP TEST ({entity_type}, {self.batch_size} entities per level)")
        print(f"{'Workers':>7}  {'RPS':>7}  {'p50ms':>7}  {'p95ms':>7}  {'p99ms':>7}  {'Errors':>6}")
        sys.stdout.flush()

        best_rps = 0
        best_workers = 1
        prev_p95 = 0

        for worker_count in levels:
            level_result = self._run_level(worker_count, entity_type, schema_fqns_list, service_fqn)
            self.levels.append(level_result)

            marker = ""
            if level_result["rps"] > best_rps:
                best_rps = level_result["rps"]
                best_workers = worker_count
            if level_result["rps"] >= best_rps:
                self.optimal_workers = worker_count

            if (prev_p95 > 0 and level_result["p95_ms"] > prev_p95 * 3
                    and self.saturation_point is None):
                self.saturation_point = worker_count
                marker = " <- saturation"
            elif level_result["rps"] >= best_rps and level_result["errors"] == 0:
                marker = " <- optimal"

            prev_p95 = level_result["p95_ms"] if level_result["p95_ms"] > 0 else prev_p95

            print(f"{worker_count:>7}  {level_result['rps']:>7.1f}  {level_result['p50_ms']:>7.0f}  "
                  f"{level_result['p95_ms']:>7.0f}  {level_result['p99_ms']:>7.0f}  "
                  f"{level_result['errors']:>6}{marker}")
            sys.stdout.flush()

        self.optimal_workers = best_workers
        print(f"Optimal concurrency: {self.optimal_workers} workers "
              f"({best_rps:.1f} rps, p95={self._get_p95_for(self.optimal_workers):.0f}ms)")
        if self.saturation_point:
            print(f"Saturation point: {self.saturation_point} workers")
        print("")
        sys.stdout.flush()

    def _get_p95_for(self, workers):
        for level in self.levels:
            if level["workers"] == workers:
                return level["p95_ms"]
        return 0

    def _run_level(self, worker_count, entity_type, schema_fqns_list, service_fqn):
        latencies = []
        errors = 0
        error_lock = threading.Lock()
        ramp_suffix = f"_ramp_{worker_count}w"

        def _payload_fn(idx):
            if entity_type == "tables" and schema_fqns_list:
                sfqn = schema_fqns_list[idx % len(schema_fqns_list)] if schema_fqns_list else "default"
                return {
                    "__url__": f"{self.server_url}/api/v1/tables",
                    "name": f"ramp_table_{worker_count}w_{idx:07d}",
                    "databaseSchema": sfqn,
                    "columns": [
                        {"name": "id", "dataType": "BIGINT"},
                        {"name": "name", "dataType": "VARCHAR", "dataLength": 255},
                    ],
                }
            elif entity_type == "topics" and service_fqn:
                return {
                    "__url__": f"{self.server_url}/api/v1/topics",
                    "name": f"ramp_topic_{worker_count}w_{idx:06d}",
                    "service": service_fqn,
                    "partitions": 3,
                    "replicationFactor": 1,
                }
            else:
                if schema_fqns_list:
                    sfqn = schema_fqns_list[idx % len(schema_fqns_list)]
                    return {
                        "__url__": f"{self.server_url}/api/v1/tables",
                        "name": f"ramp_table_{worker_count}w_{idx:07d}",
                        "databaseSchema": sfqn,
                        "columns": [
                            {"name": "id", "dataType": "BIGINT"},
                            {"name": "name", "dataType": "VARCHAR", "dataLength": 255},
                        ],
                    }
                return None

        def _work(idx):
            nonlocal errors
            t0 = time.time()
            payload = _payload_fn(idx)
            if payload is None:
                return
            url = payload.pop("__url__", None)
            method = payload.pop("__method__", "PUT")
            if url is None:
                return
            status, resp = make_request(url, data=payload, method=method,
                                         headers=self.req_headers)
            latency = time.time() - t0
            with error_lock:
                latencies.append(latency)
                if status not in [200, 201]:
                    errors += 1

        start = time.time()
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = [executor.submit(_work, i) for i in range(self.batch_size)]
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception:
                    with error_lock:
                        errors += 1
        elapsed = time.time() - start

        if not latencies:
            return {"workers": worker_count, "rps": 0, "p50_ms": 0, "p95_ms": 0,
                    "p99_ms": 0, "errors": errors}

        s = sorted(latencies)
        n = len(s)
        return {
            "workers": worker_count,
            "rps": round(n / elapsed, 1) if elapsed > 0 else 0,
            "p50_ms": round(s[int(n * 0.50)] * 1000, 0),
            "p95_ms": round(s[min(int(n * 0.95), n - 1)] * 1000, 0),
            "p99_ms": round(s[min(int(n * 0.99), n - 1)] * 1000, 0),
            "errors": errors,
        }

    def report_section(self):
        if not self.levels:
            return None
        analysis_parts = []
        if self.optimal_workers:
            opt = next((l for l in self.levels if l["workers"] == self.optimal_workers), None)
            if opt:
                analysis_parts.append(
                    f"Throughput peaks at {self.optimal_workers} workers ({opt['rps']} rps)."
                )
        if self.saturation_point:
            sat = next((l for l in self.levels if l["workers"] == self.saturation_point), None)
            if sat:
                analysis_parts.append(
                    f"At {self.saturation_point}+ workers, p95 exceeds {sat['p95_ms']:.0f}ms "
                    f"and errors appear -- thread pool saturation."
                )
        return {
            "batch_size": self.batch_size,
            "levels": self.levels,
            "optimal_workers": self.optimal_workers,
            "saturation_point": self.saturation_point,
            "analysis": " ".join(analysis_parts) if analysis_parts else "Ramp test completed.",
        }


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


if ONLY_READS:
    print("\n--only-reads mode: skipping write phases 1-7")
    schema_fqns = []

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: Metadata (no dependencies)
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 1: Metadata (domains, classifications, glossaries, users, teams)")
print("=" * 60)

# ── Domains ──────────────────────────────────────────────────────────────────
domain_fqns = []

if should_run("domains") and NUM_DOMAINS > 0:
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
if should_run("classifications") and NUM_CLASSIFICATIONS > 0:
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

if should_run("tags") and NUM_TAGS > 0 and classification_fqns:
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
if should_run("glossaries") and NUM_GLOSSARIES > 0:
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

if should_run("glossaryTerms") and NUM_GLOSSARY_TERMS > 0 and glossary_fqns:
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
if should_run("users") and NUM_USERS > 0:
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
if should_run("teams") and NUM_TEAMS > 0:
    def team_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/teams",
            "name": f"testteam_{idx:04d}",
            "displayName": f"Test Team {idx}",
            "description": f"Test team {idx} for load testing",
            "teamType": "Group",
        }

    create_entity_batch("teams", NUM_TEAMS, team_payload)

phase_timings["phase_1_metadata"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Services
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 2: Services")
print("=" * 60)

db_service_fqn = None
dashboard_service_fqn = None
pipeline_service_fqn = None
messaging_service_fqn = None
mlmodel_service_fqn = None
storage_service_fqn = None
search_service_fqn = None
api_service_fqn = None

need_db_svc = (should_run("tables") or should_run("storedProcedures") or should_run("queries")
               or should_run("testCases") or should_run("testCaseResults")
               or should_run("lineageEdges") or _need_infra("_services_db"))
need_dashboard_svc = (should_run("dashboards") or should_run("charts")
                      or should_run("dashboardDataModels") or _need_infra("_services_dashboard"))
need_pipeline_svc = should_run("pipelines") or _need_infra("_services_pipeline")
need_messaging_svc = should_run("topics") or _need_infra("_services_messaging")
need_mlmodel_svc = should_run("mlmodels") or _need_infra("_services_mlmodel")
need_storage_svc = should_run("containers") or _need_infra("_services_storage")
need_search_svc = should_run("searchIndexes") or _need_infra("_services_search")
need_api_svc = (should_run("apiCollections") or should_run("apiEndpoints")
                or _need_infra("_services_api"))

if need_db_svc:
    db_service_fqn = create_service("databaseServices", {
        "name": "test-service-distributed",
        "serviceType": "Mysql",
        "connection": {"config": {"type": "Mysql", "username": "test",
                                  "authType": {"password": "test"}, "hostPort": "localhost:3306"}},
    })

if need_dashboard_svc:
    dashboard_service_fqn = create_service("dashboardServices", {
        "name": "test-dashboard-service",
        "serviceType": "Looker",
        "connection": {"config": {"type": "Looker", "clientId": "test-client-id",
                                  "clientSecret": "test-client-secret",
                                  "hostPort": "https://looker.example.com"}},
    })

if need_pipeline_svc:
    pipeline_service_fqn = create_service("pipelineServices", {
        "name": "test-pipeline-service",
        "serviceType": "Airflow",
        "connection": {"config": {"type": "Airflow", "hostPort": "http://airflow.example.com:8080",
                                  "connection": {"type": "Backend"}}},
    })

if need_messaging_svc:
    messaging_service_fqn = create_service("messagingServices", {
        "name": "test-messaging-service",
        "serviceType": "Kafka",
        "connection": {"config": {"type": "Kafka", "bootstrapServers": "localhost:9092"}},
    })

if need_mlmodel_svc:
    mlmodel_service_fqn = create_service("mlmodelServices", {
        "name": "test-mlmodel-service",
        "serviceType": "Mlflow",
        "connection": {"config": {"type": "Mlflow", "trackingUri": "http://mlflow.example.com:5000",
                                  "registryUri": "http://mlflow.example.com:5000"}},
    })

if need_storage_svc:
    storage_service_fqn = create_service("storageServices", {
        "name": "test-storage-service",
        "serviceType": "S3",
        "connection": {"config": {"type": "S3", "awsConfig": {
            "awsAccessKeyId": "test-key", "awsSecretAccessKey": "test-secret",
            "awsRegion": "us-east-1"}}},
    })

if need_search_svc:
    search_service_fqn = create_service("searchServices", {
        "name": "test-search-service",
        "serviceType": "ElasticSearch",
        "connection": {"config": {"type": "ElasticSearch",
                                  "hostPort": "http://elasticsearch.example.com:9200"}},
    })

if need_api_svc:
    api_service_fqn = create_service("apiServices", {
        "name": "test-api-service",
        "serviceType": "Rest",
        "connection": {"config": {"type": "Rest",
                                  "openAPISchemaConnection": {
                                      "openAPISchemaURL": "http://api.example.com/openapi.json"}}},
    })

phase_timings["phase_2_services"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Infrastructure (databases, schemas, apiCollections)
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 3: Infrastructure (databases, schemas, API collections)")
print("=" * 60)

# ── Databases & Schemas ──────────────────────────────────────────────────────
schema_fqns = []
need_db_infra = (should_run("tables") or should_run("storedProcedures") or should_run("queries")
                 or should_run("testCases") or should_run("testCaseResults")
                 or should_run("lineageEdges") or _need_infra("_infra_db"))

if db_service_fqn and need_db_infra and NUM_TABLES > 0:
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
if should_run("apiCollections") and api_service_fqn and NUM_API_COLLECTIONS > 0:
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

phase_timings["phase_3_infrastructure"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# RAMP TEST (if enabled)
# ══════════════════════════════════════════════════════════════════════════════
ramp_result = None
if RAMP_MODE and not ONLY_READS:
    ramp_tester = RampTester(SERVER_URL, dict(headers), max_workers=NUM_WORKERS,
                             batch_size=RAMP_BATCH)
    ramp_entity_type = "tables"
    if ONLY_ENTITIES:
        for candidate in ["tables", "topics", "dashboards", "pipelines"]:
            if candidate in ONLY_ENTITIES:
                ramp_entity_type = candidate
                break

    ramp_schema_fqns = schema_fqns if schema_fqns else None
    ramp_service_fqn = None
    if ramp_entity_type == "topics":
        ramp_service_fqn = messaging_service_fqn
    elif ramp_entity_type == "dashboards":
        ramp_service_fqn = dashboard_service_fqn
    elif ramp_entity_type == "pipelines":
        ramp_service_fqn = pipeline_service_fqn

    ramp_tester.run(entity_type=ramp_entity_type, schema_fqns_list=ramp_schema_fqns,
                    service_fqn=ramp_service_fqn)
    ramp_result = ramp_tester.report_section()
    if ramp_result:
        ramp_result["entity_type"] = ramp_entity_type

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: Core entities
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 4: Core entities")
if REALISTIC_MODE:
    print("  (realistic mode: all entity types run concurrently)")
print("=" * 60)

_phase4_entity_configs = []

# ── Tables ───────────────────────────────────────────────────────────────────
if should_run("tables") and schema_fqns and NUM_TABLES > 0:
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

    _phase4_entity_configs.append({"name": "tables", "count": NUM_TABLES, "payload_fn": table_payload, "collect_fn": collect_table})
    if not REALISTIC_MODE:
        create_entity_batch("tables", NUM_TABLES, table_payload, collect_fn=collect_table)

# ── Dashboards ───────────────────────────────────────────────────────────────
if should_run("dashboards") and dashboard_service_fqn and NUM_DASHBOARDS > 0:
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

    _phase4_entity_configs.append({"name": "dashboards", "count": NUM_DASHBOARDS, "payload_fn": dashboard_payload, "collect_fn": collect_dashboard})
    if not REALISTIC_MODE:
        create_entity_batch("dashboards", NUM_DASHBOARDS, dashboard_payload,
                            collect_fn=collect_dashboard)

# ── Charts ───────────────────────────────────────────────────────────────────
if should_run("charts") and dashboard_service_fqn and NUM_CHARTS > 0:
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

    _phase4_entity_configs.append({"name": "charts", "count": NUM_CHARTS, "payload_fn": chart_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("charts", NUM_CHARTS, chart_payload)

# ── Topics ───────────────────────────────────────────────────────────────────
if should_run("topics") and messaging_service_fqn and NUM_TOPICS > 0:
    def topic_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/topics",
            "name": f"topic_{idx:06d}",
            "service": messaging_service_fqn,
            "partitions": 3,
            "replicationFactor": 1,
            "description": f"Test topic {idx}",
        }

    _phase4_entity_configs.append({"name": "topics", "count": NUM_TOPICS, "payload_fn": topic_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("topics", NUM_TOPICS, topic_payload)

# ── Pipelines ────────────────────────────────────────────────────────────────
if should_run("pipelines") and pipeline_service_fqn and NUM_PIPELINES > 0:
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

    _phase4_entity_configs.append({"name": "pipelines", "count": NUM_PIPELINES, "payload_fn": pipeline_payload, "collect_fn": collect_pipeline})
    if not REALISTIC_MODE:
        create_entity_batch("pipelines", NUM_PIPELINES, pipeline_payload,
                            collect_fn=collect_pipeline)

# ── Stored Procedures ────────────────────────────────────────────────────────
if should_run("storedProcedures") and db_service_fqn and schema_fqns and NUM_STORED_PROCEDURES > 0:
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

    _phase4_entity_configs.append({"name": "storedProcedures", "count": NUM_STORED_PROCEDURES, "payload_fn": stored_proc_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("storedProcedures", NUM_STORED_PROCEDURES, stored_proc_payload)

# ── ML Models ────────────────────────────────────────────────────────────────
if should_run("mlmodels") and mlmodel_service_fqn and NUM_MLMODELS > 0:
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

    _phase4_entity_configs.append({"name": "mlmodels", "count": NUM_MLMODELS, "payload_fn": mlmodel_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("mlmodels", NUM_MLMODELS, mlmodel_payload)

# ── Containers ───────────────────────────────────────────────────────────────
if should_run("containers") and storage_service_fqn and NUM_CONTAINERS > 0:
    def container_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/containers",
            "name": f"container_{idx:06d}",
            "service": storage_service_fqn,
            "displayName": f"Test Container {idx}",
            "description": f"Test container {idx}",
        }

    _phase4_entity_configs.append({"name": "containers", "count": NUM_CONTAINERS, "payload_fn": container_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("containers", NUM_CONTAINERS, container_payload)

# ── Search Indexes ───────────────────────────────────────────────────────────
if should_run("searchIndexes") and search_service_fqn and NUM_SEARCH_INDEXES > 0:
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

    _phase4_entity_configs.append({"name": "searchIndexes", "count": NUM_SEARCH_INDEXES, "payload_fn": search_idx_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("searchIndexes", NUM_SEARCH_INDEXES, search_idx_payload)

# ── Queries ──────────────────────────────────────────────────────────────────
if should_run("queries") and NUM_QUERIES > 0 and db_service_fqn:
    def query_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/queries",
            "name": f"query_{idx:06d}",
            "query": f"SELECT * FROM table_{idx % max(1, NUM_TABLES):07d} WHERE id = {idx}",
            "service": db_service_fqn,
            "description": f"Test query {idx}",
        }

    _phase4_entity_configs.append({"name": "queries", "count": NUM_QUERIES, "payload_fn": query_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("queries", NUM_QUERIES, query_payload)

# ── Dashboard Data Models ────────────────────────────────────────────────────
if should_run("dashboardDataModels") and dashboard_service_fqn and NUM_DASHBOARD_DATA_MODELS > 0:
    dm_types = ["MetabaseDataModel", "SupersetDataModel", "TableauDataModel"]

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

    _phase4_entity_configs.append({"name": "dashboardDataModels", "count": NUM_DASHBOARD_DATA_MODELS, "payload_fn": data_model_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("dashboardDataModels", NUM_DASHBOARD_DATA_MODELS, data_model_payload)

# ── API Endpoints ────────────────────────────────────────────────────────────
if should_run("apiEndpoints") and api_service_fqn and api_collection_fqns and NUM_API_ENDPOINTS > 0:
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

    _phase4_entity_configs.append({"name": "apiEndpoints", "count": NUM_API_ENDPOINTS, "payload_fn": api_endpoint_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("apiEndpoints", NUM_API_ENDPOINTS, api_endpoint_payload)

# ── Data Products ────────────────────────────────────────────────────────────
if should_run("dataProducts") and NUM_DATA_PRODUCTS > 0 and domain_fqns:
    def data_product_payload(idx):
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataProducts",
            "name": f"data_product_{idx:04d}",
            "domains": [domain_fqns[idx % len(domain_fqns)]],
            "displayName": f"Test Data Product {idx}",
            "description": f"Test data product {idx}",
        }

    _phase4_entity_configs.append({"name": "dataProducts", "count": NUM_DATA_PRODUCTS, "payload_fn": data_product_payload, "collect_fn": None})
    if not REALISTIC_MODE:
        create_entity_batch("dataProducts", NUM_DATA_PRODUCTS, data_product_payload)

if REALISTIC_MODE and _phase4_entity_configs:
    run_realistic_phase(_phase4_entity_configs, NUM_WORKERS)

phase_timings["phase_4_core_entities"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: Data Quality (test suites, test cases)
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 5: Data Quality (test suites, test cases)")
print("=" * 60)

test_suite_fqns = []

if should_run("testSuites") and NUM_TEST_SUITES > 0:
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

if should_run("testCases") and NUM_TEST_CASES > 0 and collected_table_ids:
    table_level_defs = [
        ("tableRowCountToEqual", [{"name": "value", "value": "100"}]),
        ("tableColumnCountToEqual", [{"name": "columnCount", "value": "4"}]),
    ]
    column_level_defs = [
        ("columnValuesToBeNotNull", []),
        ("columnValuesToBeUnique", []),
    ]
    column_names = ["id", "name", "created_at", "data"]

    def test_case_payload(idx):
        table_id, table_fqn = collected_table_ids[idx % len(collected_table_ids)]
        if idx % 3 == 0:
            defn, params = table_level_defs[idx % len(table_level_defs)]
            entity_link = f"<#E::table::{table_fqn}>"
        else:
            defn, params = column_level_defs[idx % len(column_level_defs)]
            col = column_names[idx % len(column_names)]
            entity_link = f"<#E::table::{table_fqn}::columns::{col}>"
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testCases",
            "name": f"testCase_{idx:06d}",
            "entityLink": entity_link,
            "testDefinition": defn,
            "parameterValues": params,
        }

    def collect_test_case(idx, resp):
        with collect_lock:
            if len(collected_test_case_fqns) < MAX_COLLECT:
                fqn = resp.get("fullyQualifiedName")
                if fqn:
                    collected_test_case_fqns.append(fqn)

    create_entity_batch("testCases", NUM_TEST_CASES, test_case_payload,
                        collect_fn=collect_test_case)

phase_timings["phase_5_data_quality"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6: Lineage
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 6: Lineage")
print("=" * 60)

if should_run("lineageEdges") and NUM_LINEAGE_EDGES > 0 and collected_table_ids:
    n_t2t = int(NUM_LINEAGE_EDGES * 0.60)
    n_t2d = int(NUM_LINEAGE_EDGES * 0.25)
    n_p2t = NUM_LINEAGE_EDGES - n_t2t - n_t2d

    lineage_tasks = []
    for i in range(n_t2t):
        from_idx = i % len(collected_table_ids)
        to_idx = (i + 1) % len(collected_table_ids)
        lineage_tasks.append(("table", collected_table_ids[from_idx][0],
                              "table", collected_table_ids[to_idx][0]))
    if collected_dashboard_ids:
        for i in range(n_t2d):
            from_idx = i % len(collected_table_ids)
            to_idx = i % len(collected_dashboard_ids)
            lineage_tasks.append(("table", collected_table_ids[from_idx][0],
                                  "dashboard", collected_dashboard_ids[to_idx][0]))
    else:
        n_t2t += n_t2d
        n_t2d = 0

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
elif should_run("lineageEdges") and NUM_LINEAGE_EDGES > 0:
    print("Skipping lineage: no table IDs collected")
    stats["lineageEdges"] = 0

phase_timings["phase_6_lineage"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7: Time-Series Data
# ══════════════════════════════════════════════════════════════════════════════
phase_start = time.time()
print("\n" + "=" * 60)
print("PHASE 7: Time-Series Data")
print("=" * 60)

ts_workers = min(10, NUM_WORKERS)
base_ts = int(time.time() * 1000)

# ── Test Case Results ────────────────────────────────────────────────────────
if should_run("testCaseResults") and NUM_TEST_CASE_RESULTS > 0 and collected_test_case_fqns:
    statuses = ["Success", "Failed", "Aborted"]

    def tc_result_payload(idx):
        fqn = collected_test_case_fqns[idx % len(collected_test_case_fqns)]
        encoded_fqn = urllib.request.quote(fqn, safe="")
        ts = base_ts - (idx * 3600000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/dataQuality/testCases/testCaseResults/{encoded_fqn}",
            "__method__": "POST",
            "timestamp": ts,
            "testCaseStatus": statuses[idx % len(statuses)],
            "result": f"Test result {idx}",
            "testResultValue": [{"name": "value", "value": str(round(random.uniform(0, 100), 2))}],
        }

    create_entity_batch("testCaseResults", NUM_TEST_CASE_RESULTS, tc_result_payload,
                        workers=ts_workers)
elif should_run("testCaseResults") and NUM_TEST_CASE_RESULTS > 0:
    print("Skipping testCaseResults: no test case FQNs collected")
    stats["testCaseResults"] = 0

# ── Entity Report Data ───────────────────────────────────────────────────────
if should_run("entityReportData") and NUM_ENTITY_REPORT_DATA > 0:
    entity_types_for_report = ["table", "topic", "dashboard", "pipeline", "mlmodel"]

    def entity_report_payload(idx):
        ts = base_ts - (idx * 86400000)
        e_type = entity_types_for_report[idx % len(entity_types_for_report)]
        entity_count = random.randint(1, 1000)
        has_owner = random.randint(0, entity_count)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "entityReportData",
            "data": {
                "entityType": e_type,
                "entityTier": f"Tier.Tier{(idx % 5) + 1}",
                "serviceName": "test-service-distributed",
                "completedDescriptions": random.randint(0, 100),
                "missingDescriptions": random.randint(0, 50),
                "hasOwner": has_owner,
                "missingOwner": entity_count - has_owner,
                "entityCount": entity_count,
            },
        }

    create_entity_batch("entityReportData", NUM_ENTITY_REPORT_DATA, entity_report_payload,
                        workers=ts_workers)

# ── Web Analytic Entity Views ────────────────────────────────────────────────
if should_run("webAnalyticViews") and NUM_WEB_ANALYTIC_VIEWS > 0:
    def web_view_payload(idx):
        ts = base_ts - (idx * 60000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "webAnalyticEntityViewReportData",
            "data": {
                "entityType": "table",
                "entityFqn": f"test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}",
                "entityHref": f"{SERVER_URL}/table/test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}",
                "owner": f"user_{idx % 50}",
                "views": random.randint(1, 500),
            },
        }

    create_entity_batch("webAnalyticViews", NUM_WEB_ANALYTIC_VIEWS, web_view_payload,
                        workers=ts_workers)

# ── Web Analytic User Activity ───────────────────────────────────────────────
if should_run("webAnalyticActivity") and NUM_WEB_ANALYTIC_ACTIVITY > 0:
    def web_activity_payload(idx):
        ts = base_ts - (idx * 60000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "webAnalyticUserActivityReportData",
            "data": {
                "userName": f"testuser_{idx % max(1, NUM_USERS):05d}",
                "userId": str(uuid.uuid4()),
                "team": "test-team",
                "totalSessions": random.randint(1, 20),
                "totalSessionDuration": random.randint(10, 3600),
                "totalPageView": random.randint(1, 100),
                "lastSession": ts,
            },
        }

    create_entity_batch("webAnalyticActivity", NUM_WEB_ANALYTIC_ACTIVITY,
                        web_activity_payload, workers=ts_workers)

# ── Raw Cost Analysis ────────────────────────────────────────────────────────
if should_run("rawCostAnalysis") and NUM_RAW_COST_ANALYSIS > 0:
    def raw_cost_payload(idx):
        ts = base_ts - (idx * 86400000)
        if collected_table_ids:
            table_id, table_fqn = collected_table_ids[idx % len(collected_table_ids)]
        else:
            table_id = str(uuid.uuid4())
            table_fqn = f"test-service-distributed.test_db_0000.public.table_{idx % max(1, NUM_TABLES):07d}"
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "rawCostAnalysisReportData",
            "data": {
                "entity": {
                    "id": table_id,
                    "type": "table",
                    "fullyQualifiedName": table_fqn,
                },
                "sizeInByte": round(random.uniform(100.0, 100000.0), 2),
            },
        }

    create_entity_batch("rawCostAnalysis", NUM_RAW_COST_ANALYSIS, raw_cost_payload,
                        workers=ts_workers)

# ── Aggregated Cost Analysis ─────────────────────────────────────────────────
if should_run("aggCostAnalysis") and NUM_AGG_COST_ANALYSIS > 0:
    def agg_cost_payload(idx):
        ts = base_ts - (idx * 86400000)
        return {
            "__url__": f"{SERVER_URL}/api/v1/analytics/dataInsights/data",
            "__method__": "POST",
            "timestamp": ts,
            "reportDataType": "aggregatedCostAnalysisReportData",
            "data": {
                "entityType": "table",
                "serviceName": "test-service-distributed",
                "serviceType": "BigQuery",
                "totalSize": round(random.uniform(1000.0, 1000000.0), 2),
                "totalCount": random.randint(100, 100000),
                "unusedDataAssets": {
                    "count": {"threeDays": random.randint(1, 50), "sevenDays": random.randint(1, 40),
                              "fourteenDays": random.randint(1, 30), "thirtyDays": random.randint(1, 20),
                              "sixtyDays": random.randint(1, 10)},
                    "size": {"threeDays": random.randint(100, 10000), "sevenDays": random.randint(100, 9000),
                             "fourteenDays": random.randint(100, 8000), "thirtyDays": random.randint(100, 7000),
                             "sixtyDays": random.randint(100, 6000)},
                    "totalSize": random.randint(1000, 50000),
                    "totalCount": random.randint(1, 50),
                },
                "frequentlyUsedDataAssets": {
                    "count": {"threeDays": random.randint(1, 10), "sevenDays": random.randint(1, 20),
                              "fourteenDays": random.randint(1, 30), "thirtyDays": random.randint(1, 40),
                              "sixtyDays": random.randint(1, 50)},
                    "size": {"threeDays": random.randint(1000, 50000), "sevenDays": random.randint(1000, 60000),
                             "fourteenDays": random.randint(1000, 70000), "thirtyDays": random.randint(1000, 80000),
                             "sixtyDays": random.randint(1000, 90000)},
                    "totalSize": random.randint(1000, 100000),
                    "totalCount": random.randint(1, 50),
                },
            },
        }

    create_entity_batch("aggCostAnalysis", NUM_AGG_COST_ANALYSIS, agg_cost_payload,
                        workers=ts_workers)

phase_timings["phase_7_time_series"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8: Read benchmarks (unless --skip-reads)
# ══════════════════════════════════════════════════════════════════════════════
if ONLY_READS and not collected_table_ids:
    print("\n--only-reads: discovering existing tables...")
    status, resp = make_request(f"{SERVER_URL}/api/v1/tables?limit=100&fields=id", method="GET", headers=headers)
    if status == 200 and isinstance(resp, dict):
        for item in resp.get("data", []):
            collected_table_ids.append((item["id"], item.get("fullyQualifiedName", "")))
    print(f"  Discovered {len(collected_table_ids)} tables")
    sys.stdout.flush()

if not SKIP_READS and collected_table_ids:
    phase_start = time.time()
    print("\n" + "=" * 60)
    print("PHASE 8: Read benchmarks")
    print("=" * 60)

    read_sample = collected_table_ids[:1000]

    # 8a: Entity fetch by ID
    read_entity_batch(
        "entity_fetch", read_sample,
        lambda idx: f"{SERVER_URL}/api/v1/tables/{read_sample[idx][0]}",
    )

    # 8b: Paginated list
    list_count = min(200, len(read_sample))
    list_items = list(range(list_count))
    read_entity_batch(
        "paginated_list", list_items,
        lambda idx: f"{SERVER_URL}/api/v1/tables?limit=10&offset={idx * 10}",
    )

    # 8c: Search queries
    search_terms = ["table", "test", "data", "pipeline", "report", "analytics", "cost", "model"]
    search_count = min(200, len(read_sample))
    search_items = list(range(search_count))
    read_entity_batch(
        "search_queries", search_items,
        lambda idx: f"{SERVER_URL}/api/v1/search/query?q={search_terms[idx % len(search_terms)]}&index=table_search_index&from=0&size=10",
    )

    # 8d: Lineage traversal (if lineage was created)
    if should_run("lineageEdges") and NUM_LINEAGE_EDGES > 0:
        lineage_sample = read_sample[:min(100, len(read_sample))]
        read_entity_batch(
            "lineage_traversal", lineage_sample,
            lambda idx: f"{SERVER_URL}/api/v1/lineage/getLineage?fqn={lineage_sample[idx][1]}&type=table",
        )

    phase_timings["phase_8_reads"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 9: Mixed workload (if --mixed)
# ══════════════════════════════════════════════════════════════════════════════
mixed_read_bench = None
mixed_write_bench = None
if MIXED_MODE and collected_table_ids:
    phase_start = time.time()
    print("\n" + "=" * 60)
    print("PHASE 9: Mixed workload")
    print("=" * 60)

    mixed_schema_fqns = schema_fqns if schema_fqns else None
    mixed_read_bench, mixed_write_bench = run_mixed_workload(
        MIXED_DURATION, READ_RATIO, NUM_WORKERS,
        collected_table_ids, mixed_schema_fqns,
    )
    benchmarks["mixed_reads"] = mixed_read_bench
    benchmarks["mixed_writes"] = mixed_write_bench

    phase_timings["phase_9_mixed"] = {"wall_clock_s": round(time.time() - phase_start, 2)}

# ══════════════════════════════════════════════════════════════════════════════
# STOP HEALTH MONITOR & BUILD REPORT
# ══════════════════════════════════════════════════════════════════════════════
health_monitor.stop()
introspector.scrape_after()
introspector.collect_diagnostics("after")
overall_elapsed = time.time() - overall_start
total_created = sum(v for k, v in stats.items() if k != "realistic_combined")


# ── Cluster sizing analysis ──────────────────────────────────────────────────
def generate_cluster_sizing(report, ramp_data=None):
    findings = []
    recommendations = {}
    config_summary = []

    entity_data = report.get("entities", {})
    health = report.get("server_health", {})
    measured_workers = report["metadata"]["workers"]

    max_p95 = 0
    avg_latency_ms = 0
    total_latency_entries = 0
    has_503 = False
    has_504_or_timeout = False
    has_conn_refused = False
    has_bimodal = False

    _skip_in_sizing = {"realistic_combined"}
    for entity, data in entity_data.items():
        if not data or entity in _skip_in_sizing:
            continue
        p95 = data.get("latency_ms", {}).get("p95", 0)
        avg = data.get("latency_ms", {}).get("avg", 0)
        if p95 > max_p95:
            max_p95 = p95
        total_latency_entries += 1
        avg_latency_ms += avg
        if p95 > 5000:
            findings.append(f"{entity} PUT p95={p95:.0f}ms -- severe bottleneck")
        elif p95 > 1000:
            findings.append(f"{entity} PUT p95={p95:.0f}ms -- moderate latency")

        latency_analysis = data.get("latency_analysis", {})
        if latency_analysis.get("bimodal"):
            has_bimodal = True
        for finding in latency_analysis.get("findings", []):
            findings.append(f"{entity}: {finding}")

        error_breakdown = data.get("error_breakdown", {})
        for code, count in error_breakdown.items():
            if code == "503":
                has_503 = True
                findings.append(
                    f"{entity}: {count}x HTTP 503 -- admission control rejection "
                    f"(BulkExecutor queue full)"
                )
            elif code in ("504", "timeout"):
                has_504_or_timeout = True
                findings.append(
                    f"{entity}: {count}x HTTP {code} -- request timeout, "
                    f"thread pool likely exhausted"
                )
            elif code == "connection_error":
                has_conn_refused = True
                findings.append(
                    f"{entity}: {count}x connection refused/reset -- "
                    f"server accept queue full"
                )
            elif code == "500":
                findings.append(f"{entity}: {count}x HTTP 500 -- internal server error, check logs")
            elif code == "429":
                findings.append(f"{entity}: {count}x HTTP 429 -- rate limited")

    if total_latency_entries > 0:
        avg_latency_ms = avg_latency_ms / total_latency_entries

    total_checks = health.get("total_checks", 0)
    unhealthy_count = health.get("unhealthy", 0)
    if unhealthy_count > 0 and total_checks > 0:
        pct = unhealthy_count / total_checks * 100
        findings.append(f"Health check failed {unhealthy_count} times ({pct:.0f}%) -- server overwhelmed")

    for entity, data in entity_data.items():
        if not data or entity in _skip_in_sizing:
            continue
        windows = data.get("throughput_over_time", [])
        if len(windows) >= 4:
            q_len = max(1, len(windows) // 4)
            first_q = [w["rps"] for w in windows[:q_len]]
            last_q = [w["rps"] for w in windows[-q_len:]]
            if first_q and last_q:
                avg_first = sum(first_q) / len(first_q)
                avg_last = sum(last_q) / len(last_q)
                if avg_first > 0 and avg_last / avg_first < 0.5:
                    degradation = (1 - avg_last / avg_first) * 100
                    findings.append(
                        f"{entity}: throughput degraded {degradation:.0f}% "
                        f"({avg_first:.0f} rps -> {avg_last:.0f} rps) -- resource exhaustion"
                    )

    rc_data = entity_data.get("realistic_combined")
    if rc_data:
        rc_p95 = rc_data.get("latency_ms", {}).get("p95", 0)
        rc_p50 = rc_data.get("latency_ms", {}).get("p50", 0)
        rc_rps = rc_data.get("throughput_rps", 0)
        rc_err = rc_data.get("error_rate_pct", 0)
        findings.append(
            f"REALISTIC MODE: {rc_data.get('created', 0)} entities across "
            f"{len([k for k in entity_data if k not in _skip_in_sizing and not k.startswith('read_') and not k.startswith('mixed_')])} "
            f"types at combined {rc_rps:.0f} rps (p50={rc_p50:.0f}ms, p95={rc_p95:.0f}ms, errors={rc_err:.1f}%)"
        )
        if rc_p95 > max_p95 * 1.5 and max_p95 > 0:
            findings.append(
                f"Cross-entity contention: combined p95 ({rc_p95:.0f}ms) is "
                f"{rc_p95/max_p95:.1f}x the worst individual entity p95 ({max_p95:.0f}ms) "
                f"-- shared resource contention (DB pool, thread pool, or locks)"
            )
        rc_analysis = rc_data.get("latency_analysis", {})
        if rc_analysis.get("bimodal"):
            has_bimodal = True
            findings.append(
                "Realistic workload shows bimodal latency -- "
                "cross-entity lock contention or connection pool exhaustion"
            )
        if rc_p95 > max_p95:
            max_p95 = rc_p95

    overall_rps = report.get("overall", {}).get("overall_throughput_rps", 0)
    effective_capacity = int(150 / (avg_latency_ms / 1000)) if avg_latency_ms > 0 else 0

    recommendations["server_threads"] = {
        "analysis": (
            f"{measured_workers} concurrent writers with 150 max server threads. "
            f"Each PUT holds a thread for ~{avg_latency_ms:.0f}ms avg. "
            f"Effective capacity: ~{effective_capacity} rps. "
            f"Measured: {overall_rps:.0f} rps"
            + (" -- threads are blocked on DB/search." if overall_rps < effective_capacity * 0.5 else ".")
        ),
        "current_env": "SERVER_MAX_THREADS=150",
        "recommended_env": "SERVER_MAX_THREADS=300" if max_p95 > 2000 or has_504_or_timeout else "SERVER_MAX_THREADS=150",
        "yaml_path": "server.applicationConnectors[0].maxThreads",
    }
    if max_p95 > 2000 or has_504_or_timeout:
        config_summary.append("SERVER_MAX_THREADS=300")

    recommendations["virtual_threads"] = {
        "analysis": "Java 21 virtual threads can eliminate thread pool as bottleneck for I/O-bound workloads.",
        "current_env": "SERVER_ENABLE_VIRTUAL_THREAD=false",
        "recommended_env": "SERVER_ENABLE_VIRTUAL_THREAD=true",
        "yaml_path": "server.enableVirtualThreads",
    }
    config_summary.append("SERVER_ENABLE_VIRTUAL_THREAD=true")

    db_pool_rec = 100
    if measured_workers > 15 or has_bimodal:
        db_pool_rec = 150
    if max_p95 > 5000:
        db_pool_rec = 200
    si_data = report.get("server_info", {})
    diag_after_db = (si_data.get("diagnostics_after") or {}).get("database", {})
    measured_acquire_ms = diag_after_db.get("connection_acquire_avg_ms", 0)
    if measured_acquire_ms > 0:
        acquire_note = f"Measured connection acquire time: {measured_acquire_ms:.1f}ms avg."
    else:
        acquire_note = "Connection wait time may add 50-200ms."
    recommendations["db_pool"] = {
        "analysis": (
            f"{measured_workers} concurrent writers with 100 max DB connections. "
            f"Each PUT does multiple DB round-trips. "
            f"At {measured_workers} concurrent, pool utilization ~{min(99, measured_workers * 100 // 100)}%. "
            f"{acquire_note}"
        ),
        "current_env": "DB_CONNECTION_POOL_MAX_SIZE=100",
        "recommended_env": f"DB_CONNECTION_POOL_MAX_SIZE={db_pool_rec}",
        "yaml_path": "database.hikari.maximumPoolSize",
    }
    if db_pool_rec > 100:
        config_summary.append(f"DB_CONNECTION_POOL_MAX_SIZE={db_pool_rec}")

    if has_bimodal:
        recommendations["db_connection_timeout"] = {
            "analysis": (
                "Connection timeout 30s. If pool is exhausted, requests wait up to 30s "
                "for a connection -- this explains the bimodal latency pattern."
            ),
            "current_env": "DB_CONNECTION_TIMEOUT=30000",
            "recommended_env": "DB_CONNECTION_TIMEOUT=10000",
            "note": "Fail faster to prevent cascading timeouts",
        }
        config_summary.append("DB_CONNECTION_TIMEOUT=10000")

    if max_p95 > 2000 or measured_workers > 10:
        recommendations["search_connections"] = {
            "analysis": (
                "Search max connections: 30 total, 10 per route. "
                "Async indexing means search rarely blocks PUTs directly, "
                "but under heavy write load the search queue can back up."
            ),
            "current_env": "ELASTICSEARCH_MAX_CONN_TOTAL=30",
            "recommended_env": "ELASTICSEARCH_MAX_CONN_TOTAL=50",
        }
        config_summary.append("ELASTICSEARCH_MAX_CONN_TOTAL=50")

    if has_503:
        recommendations["bulk_operation"] = {
            "analysis": "HTTP 503 errors indicate BulkExecutor queue is full.",
            "current_env": "BULK_OPERATION_QUEUE_SIZE=1000, BULK_OPERATION_MAX_THREADS=10",
            "recommended_env": "BULK_OPERATION_QUEUE_SIZE=2000, BULK_OPERATION_MAX_THREADS=20",
        }
        config_summary.append("BULK_OPERATION_QUEUE_SIZE=2000")
        config_summary.append("BULK_OPERATION_MAX_THREADS=20")

    if has_conn_refused:
        recommendations["accept_queue"] = {
            "analysis": "Connection refused/reset errors indicate server accept queue is full.",
            "current_env": "SERVER_ACCEPT_QUEUE_SIZE=256",
            "recommended_env": "SERVER_ACCEPT_QUEUE_SIZE=512",
        }
        config_summary.append("SERVER_ACCEPT_QUEUE_SIZE=512")

    ramp_optimal = None
    if ramp_data:
        ramp_optimal = ramp_data.get("optimal_workers", measured_workers)
        recommendations["api_concurrency"] = {
            "current": measured_workers,
            "recommended": ramp_optimal,
            "reason": f"Ramp test shows optimal throughput at {ramp_optimal} workers",
        }
    else:
        if max_p95 > 5000:
            rec_workers = max(2, measured_workers // 4)
        elif max_p95 > 2000:
            rec_workers = max(2, measured_workers // 2)
        else:
            rec_workers = measured_workers
        recommendations["api_concurrency"] = {
            "current": measured_workers,
            "recommended": rec_workers,
            "reason": f"Max p95 latency {max_p95:.0f}ms across entity types",
        }

    if overall_rps > 0:
        rec_rps = overall_rps
        if ramp_optimal and ramp_optimal != measured_workers:
            scale_factor = ramp_optimal / measured_workers if measured_workers > 0 else 1
            rec_rps = overall_rps * max(0.5, min(2.0, scale_factor))
        estimates = {}
        for target in [50000, 250000, 1000000, 5000000]:
            secs = target / rec_rps
            label = f"{target // 1000}k_entities"
            if secs < 3600:
                estimates[label] = f"~{secs / 60:.0f} min"
            else:
                estimates[label] = f"~{secs / 3600:.1f} hours"
        recommendations["estimated_times"] = estimates

    if max_p95 > 5000 or (unhealthy_count / max(1, total_checks)) > 0.1 or has_503:
        assessment = "undersized"
    elif max_p95 > 2000 or has_bimodal:
        assessment = "marginal"
    else:
        assessment = "adequate"

    server_side = _build_server_side_analysis(report, findings, recommendations, config_summary)

    return {
        "assessment": assessment,
        "findings": findings,
        "recommendations": recommendations,
        "config_summary": config_summary,
        "server_side_analysis": server_side,
    }


def _build_server_side_analysis(report, findings, recommendations, config_summary):
    si = report.get("server_info", {})
    diag_before = si.get("diagnostics_before")
    diag_after = si.get("diagnostics_after")
    if not diag_after:
        return {"available": False}

    analysis = {"available": True, "bottlenecks": [], "latency_breakdown": {}}

    jvm = diag_after.get("jvm", {})
    jetty = diag_after.get("jetty", {})
    db = diag_after.get("database", {})
    bulk = diag_after.get("bulk_executor", {})
    req_latency = diag_after.get("request_latency", {})

    analysis["snapshot_after"] = {
        "jvm_heap_pct": jvm.get("heap_usage_pct", 0),
        "gc_pause_total_ms": jvm.get("gc_pause_total_ms", 0),
        "jetty_utilization_pct": jetty.get("utilization_pct", 0),
        "jetty_queue_size": jetty.get("queue_size", 0),
        "db_pool_usage_pct": db.get("pool_usage_pct", 0),
        "db_pool_pending": db.get("pool_pending", 0),
        "bulk_queue_usage_pct": bulk.get("queue_usage_pct", 0),
    }

    if diag_before:
        jvm_before = diag_before.get("jvm", {})
        gc_before = jvm_before.get("gc_pause_total_ms", 0)
        gc_after = jvm.get("gc_pause_total_ms", 0)
        analysis["gc_pause_delta_ms"] = gc_after - gc_before

    for ep_key, ep_data in req_latency.items():
        db_pct = ep_data.get("db_pct", 0)
        search_pct = ep_data.get("search_pct", 0)
        internal_pct = ep_data.get("internal_pct", 0)
        db_pool_pct = db.get("pool_usage_pct", 0)

        if db_pct > 60 and db_pool_pct > 80:
            bottleneck = (f"DB bottleneck on {ep_key}: {db_pct}% of request time in DB, "
                          f"pool at {db_pool_pct}% utilization")
            analysis["bottlenecks"].append(bottleneck)
            findings.append(bottleneck)
            if "db_pool_increase" not in recommendations:
                recommendations["db_pool_increase"] = {
                    "analysis": f"DB pool at {db_pool_pct}% with {db_pct}% of latency in DB",
                    "recommended_env": "DB_CONNECTION_POOL_MAX_SIZE=150",
                }
                config_summary.append("DB_CONNECTION_POOL_MAX_SIZE=150")

        if search_pct > 30:
            bottleneck = f"Search pressure on {ep_key}: {search_pct}% of request time in search"
            analysis["bottlenecks"].append(bottleneck)
            findings.append(bottleneck)

        analysis["latency_breakdown"][ep_key] = {
            "avg_total_ms": ep_data.get("avg_total_ms", 0),
            "db_pct": db_pct,
            "search_pct": search_pct,
            "internal_pct": internal_pct,
        }

    jetty_util = jetty.get("utilization_pct", 0)
    jetty_queue = jetty.get("queue_size", 0)
    if jetty_util > 90 and jetty_queue > 0:
        queue_time = jetty.get("queue_time_avg_ms", 0)
        bottleneck = (f"Thread pool saturated: {jetty_util}% utilization, "
                      f"{jetty_queue} requests queued, avg queue wait {queue_time}ms")
        analysis["bottlenecks"].append(bottleneck)
        findings.append(bottleneck)

    bulk_queue_pct = bulk.get("queue_usage_pct", 0)
    if bulk_queue_pct > 70:
        bottleneck = f"Bulk executor queue at {bulk_queue_pct}%, near rejection threshold"
        analysis["bottlenecks"].append(bottleneck)
        findings.append(bottleneck)
        if "bulk_operation" not in recommendations:
            recommendations["bulk_operation"] = {
                "analysis": f"Bulk executor queue at {bulk_queue_pct}%",
                "recommended_env": "BULK_OPERATION_QUEUE_SIZE=2000, BULK_OPERATION_MAX_THREADS=20",
            }
            config_summary.append("BULK_OPERATION_QUEUE_SIZE=2000")
            config_summary.append("BULK_OPERATION_MAX_THREADS=20")

    heap_pct = jvm.get("heap_usage_pct", 0)
    if heap_pct > 85:
        bottleneck = f"JVM heap at {heap_pct}%, GC pressure likely causing tail latency"
        analysis["bottlenecks"].append(bottleneck)
        findings.append(bottleneck)

    db_queries = diag_after.get("database_queries", {})
    if db_queries:
        analysis["database_queries"] = db_queries
        for qtype in ["select", "insert", "update", "delete"]:
            qdata = db_queries.get(qtype, {})
            p95 = qdata.get("p95_ms", 0)
            if p95 > 100:
                bottleneck = (f"Slow DB {qtype} queries: p95={p95:.1f}ms "
                              f"(count={qdata.get('count', 0)}, mean={qdata.get('mean_ms', 0):.1f}ms)")
                analysis["bottlenecks"].append(bottleneck)
                findings.append(bottleneck)

    conn_acquire_avg = db.get("connection_acquire_avg_ms", 0)
    conn_acquire_max = db.get("connection_acquire_max_ms", 0)
    if conn_acquire_avg > 0:
        analysis["connection_acquire_avg_ms"] = conn_acquire_avg
        analysis["connection_acquire_max_ms"] = conn_acquire_max
        analysis["connection_acquire_count"] = db.get("connection_acquire_count", 0)
        if conn_acquire_avg > 50:
            bottleneck = (f"Connection pool contention: avg acquire time {conn_acquire_avg:.1f}ms "
                          f"(max {conn_acquire_max:.1f}ms)")
            analysis["bottlenecks"].append(bottleneck)
            findings.append(bottleneck)

    return analysis


# ── Build report ─────────────────────────────────────────────────────────────
entity_summaries = {}
for name, bench in benchmarks.items():
    s = bench.summary()
    if s:
        entity_summaries[name] = s

report = {
    "metadata": {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "server_url": SERVER_URL,
        "workers": NUM_WORKERS,
        "scale": SCALE_APPLIED,
        "only_entities": list(ONLY_ENTITIES) if ONLY_ENTITIES else None,
        "realistic_mode": REALISTIC_MODE,
        "script_version": "3.0",
    },
    "server_info": introspector.report_section(),
    "server_health": health_monitor.summary(),
    "entities": entity_summaries,
    "phases": phase_timings,
    "overall": {
        "total_entities_created": total_created,
        "total_wall_clock_s": round(overall_elapsed, 2),
        "overall_throughput_rps": round(total_created / overall_elapsed, 2) if overall_elapsed > 0 else 0,
        "total_errors": sum(b.failed for k, b in benchmarks.items() if k != "realistic_combined"),
        "overall_error_rate_pct": round(
            sum(b.failed for k, b in benchmarks.items() if k != "realistic_combined") /
            max(1, sum(len(b.latencies) for k, b in benchmarks.items() if k != "realistic_combined")) * 100, 2
        ),
    },
}

if ramp_result:
    report["ramp_test"] = ramp_result

si = introspector.report_section()
if si.get("diagnostics_before"):
    report["diagnostics_before"] = si["diagnostics_before"]
if si.get("diagnostics_after"):
    report["diagnostics_after"] = si["diagnostics_after"]

report["cluster_sizing"] = generate_cluster_sizing(report, ramp_data=ramp_result)

# ── Write JSON report ────────────────────────────────────────────────────────
report_for_file = json.loads(json.dumps(report))
if "server_health" in report_for_file and "timeline" in report_for_file["server_health"]:
    del report_for_file["server_health"]["timeline"]

try:
    with open(output_path, "w") as f:
        json.dump(report_for_file, f, indent=2)
    print(f"\nJSON report written to: {output_path}")
except Exception as e:
    print(f"\nFailed to write JSON report: {e}")


# ── Pretty-print summary table ──────────────────────────────────────────────
def print_summary_table(report):
    print("")
    print("\u2550" * 70)
    print("BENCHMARK RESULTS")
    print("\u2550" * 70)

    si = report.get("server_info", {})
    if si.get("version"):
        print(f"Server: {si.get('version', '?')} (rev: {si.get('revision', '?')[:8]})")
    print("")

    header = f"{'Entity':<22} {'Count':>7} {'Rate/s':>8} {'p50ms':>7} {'p95ms':>7} {'p99ms':>7} {'Errors':>7}"
    print(header)
    print("\u2500" * 70)

    write_entries = {k: v for k, v in report["entities"].items()
                     if not k.startswith("read_") and not k.startswith("mixed_")
                     and k != "realistic_combined"}
    read_entries = {k: v for k, v in report["entities"].items() if k.startswith("read_")}
    mixed_entries = {k: v for k, v in report["entities"].items() if k.startswith("mixed_")}
    realistic_combined = report["entities"].get("realistic_combined")

    if realistic_combined:
        print("  [REALISTIC CONCURRENT WORKLOAD - shared worker pool]")
        print("")

    for name, data in write_entries.items():
        count = data["created"]
        rps = data["throughput_rps"]
        p50 = data["latency_ms"]["p50"]
        p95 = data["latency_ms"]["p95"]
        p99 = data["latency_ms"]["p99"]
        err_pct = data["error_rate_pct"]
        err_str = f"{err_pct:.1f}%" if err_pct > 0 else "0.0%"
        print(f"{name:<22} {count:>7} {rps:>8.1f} {p50:>7.0f} {p95:>7.0f} {p99:>7.0f} {err_str:>7}")

    if realistic_combined:
        print("\u2500" * 70)
        rc = realistic_combined
        rc_count = rc["created"]
        rc_rps = rc["throughput_rps"]
        rc_p50 = rc["latency_ms"]["p50"]
        rc_p95 = rc["latency_ms"]["p95"]
        rc_p99 = rc["latency_ms"]["p99"]
        rc_err = rc["error_rate_pct"]
        rc_err_str = f"{rc_err:.1f}%" if rc_err > 0 else "0.0%"
        print(f"{'realistic_combined':<22} {rc_count:>7} {rc_rps:>8.1f} {rc_p50:>7.0f} {rc_p95:>7.0f} {rc_p99:>7.0f} {rc_err_str:>7}")

    print("\u2500" * 70)
    overall = report["overall"]
    total = overall["total_entities_created"]
    overall_rps = overall["overall_throughput_rps"]
    overall_err = overall["overall_error_rate_pct"]
    err_str = f"{overall_err:.1f}%" if overall_err > 0 else "0.0%"
    print(f"{'Overall':<22} {total:>7} {overall_rps:>8.1f} {'':>7} {'':>7} {'':>7} {err_str:>7}")
    print("")

    if read_entries:
        print("READ BENCHMARKS:")
        print(f"{'Endpoint':<22} {'Count':>7} {'Rate/s':>8} {'p50ms':>7} {'p95ms':>7} {'p99ms':>7} {'Errors':>7}")
        print("\u2500" * 70)
        for name, data in read_entries.items():
            display_name = name.replace("read_", "")
            count = data["created"]
            rps = data["throughput_rps"]
            p50 = data["latency_ms"]["p50"]
            p95 = data["latency_ms"]["p95"]
            p99 = data["latency_ms"]["p99"]
            err_pct = data["error_rate_pct"]
            err_str = f"{err_pct:.1f}%" if err_pct > 0 else "0.0%"
            print(f"{display_name:<22} {count:>7} {rps:>8.1f} {p50:>7.0f} {p95:>7.0f} {p99:>7.0f} {err_str:>7}")
        print("")

    if mixed_entries:
        print("MIXED WORKLOAD:")
        mr = mixed_entries.get("mixed_reads", {})
        mw = mixed_entries.get("mixed_writes", {})
        r_count = mr.get("total_requests", 0)
        w_count = mw.get("total_requests", 0)
        combined = r_count + w_count
        r_rps = mr.get("throughput_rps", 0)
        w_rps = mw.get("throughput_rps", 0)
        print(f"  Total operations: {combined} (reads={r_count}, writes={w_count})")
        print(f"  Combined RPS: {r_rps + w_rps:.1f} (reads={r_rps:.1f}, writes={w_rps:.1f})")
        if mr.get("latency_ms"):
            print(f"  Read  p50={mr['latency_ms']['p50']:.0f}ms  p95={mr['latency_ms']['p95']:.0f}ms")
        if mw.get("latency_ms"):
            print(f"  Write p50={mw['latency_ms']['p50']:.0f}ms  p95={mw['latency_ms']['p95']:.0f}ms")
        print("")

    has_error_breakdowns = False
    for name, data in report["entities"].items():
        eb = data.get("error_breakdown", {})
        if eb:
            if not has_error_breakdowns:
                print("ERROR BREAKDOWN:")
                has_error_breakdowns = True
            codes = ", ".join(f"{code}={cnt}" for code, cnt in sorted(eb.items()))
            print(f"  {name}: {codes}")
    if has_error_breakdowns:
        print("")

    has_latency_findings = False
    for name, data in report["entities"].items():
        la = data.get("latency_analysis", {})
        for finding in la.get("findings", []):
            if not has_latency_findings:
                print("LATENCY ANALYSIS:")
                has_latency_findings = True
            print(f"  {name}: {finding}")
    if has_latency_findings:
        print("")

    health = report["server_health"]
    total_checks = health["total_checks"]
    healthy = health["healthy"]
    if total_checks > 0:
        health_pct = healthy / total_checks * 100
        health_p95 = health.get("health_latency_ms", {}).get("p95", 0)
        print(f"Server Health: {healthy}/{total_checks} checks healthy ({health_pct:.1f}%)")
        print(f"Health p95 latency: {health_p95:.0f}ms")
    else:
        print("Server Health: no checks recorded")
    print("")

    sizing = report.get("cluster_sizing", {})
    assessment = sizing.get("assessment", "unknown")
    indicator = {"undersized": "!! UNDERSIZED", "marginal": "?  MARGINAL", "adequate": "OK ADEQUATE"}.get(
        assessment, f"   {assessment.upper()}"
    )
    print(f"CLUSTER SIZING: {indicator}")
    for finding in sizing.get("findings", []):
        print(f"  - {finding}")
    recs = sizing.get("recommendations", {})
    concurrency = recs.get("api_concurrency", {})
    if concurrency:
        print(f"  - Recommend: {concurrency.get('recommended', '?')} workers "
              f"(currently {concurrency.get('current', '?')})")
    estimates = recs.get("estimated_times", {})
    if "1000k_entities" in estimates:
        print(f"  - At current rate: 1M entities = {estimates['1000k_entities']}")
    print("")

    ssa = sizing.get("server_side_analysis", {})
    if ssa.get("available"):
        print("SERVER-SIDE BREAKDOWN (from /api/v1/system/diagnostics):")
        snap = ssa.get("snapshot_after", {})
        gc_delta = ssa.get("gc_pause_delta_ms", 0)
        si_info = report.get("server_info", {})
        diag_after = si_info.get("diagnostics_after") or {}
        jvm_d = diag_after.get("jvm", {})
        jetty_d = diag_after.get("jetty", {})
        db_d = diag_after.get("database", {})
        bulk_d = diag_after.get("bulk_executor", {})

        heap_used_gb = jvm_d.get("heap_used_bytes", 0) / (1024**3)
        heap_max_gb = jvm_d.get("heap_max_bytes", 0) / (1024**3)
        print(f"  JVM:  heap {heap_used_gb:.1f}GB/{heap_max_gb:.1f}GB "
              f"({snap.get('jvm_heap_pct', 0)}%), "
              f"GC pauses +{gc_delta}ms during load")
        print(f"  Jetty: {jetty_d.get('threads_busy', '?')}/{jetty_d.get('threads_max', '?')} "
              f"threads busy ({snap.get('jetty_utilization_pct', 0)}%), "
              f"queue depth: {snap.get('jetty_queue_size', 0)}")
        conn_acquire = db_d.get("connection_acquire_avg_ms", 0)
        conn_acquire_str = f", acquire avg {conn_acquire:.1f}ms" if conn_acquire > 0 else ""
        print(f"  DB Pool: {db_d.get('pool_active', '?')}/{db_d.get('pool_max', '?')} "
              f"active ({snap.get('db_pool_usage_pct', 0)}%), "
              f"{snap.get('db_pool_pending', 0)} pending connections{conn_acquire_str}")
        print(f"  Bulk Executor: queue {bulk_d.get('queue_depth', 0)}/"
              f"{bulk_d.get('queue_capacity', '?')} "
              f"({snap.get('bulk_queue_usage_pct', 0)}%)")

        db_queries = ssa.get("database_queries", {})
        total_db_ops = db_queries.get("total_operations", 0)
        if total_db_ops > 0:
            print("")
            print(f"  DB Query Profile (total operations: {total_db_ops:,}):")
            print(f"    {'Type':<12} {'Count':>10} {'Mean':>10} {'Max':>10}")
            for qtype in ["select", "insert", "update", "delete"]:
                qdata = db_queries.get(qtype, {})
                if qdata:
                    qcount = qdata.get("count", 0)
                    qmean = qdata.get("mean_ms", 0)
                    qmax = qdata.get("max_ms", 0)
                    print(f"    {qtype:<12} {qcount:>10,} {qmean:>9.1f}ms {qmax:>9.1f}ms")

        breakdown = ssa.get("latency_breakdown", {})
        put_entries = {k: v for k, v in breakdown.items() if k.startswith("PUT")}
        get_entries = {k: v for k, v in breakdown.items() if k.startswith("GET")}
        if put_entries:
            print("")
            print("  Latency Breakdown (PUT endpoints):")
            print(f"    {'Endpoint':<30} {'Total':>8} {'DB%':>6} {'Search%':>9} {'Internal%':>11}")
            for ep, bd in sorted(put_entries.items()):
                ep_short = ep.replace("PUT ", "")[:28]
                print(f"    {ep_short:<30} {bd['avg_total_ms']:>7.0f}ms "
                      f"{bd['db_pct']:>5.1f}% {bd['search_pct']:>8.1f}% "
                      f"{bd['internal_pct']:>10.1f}%")
        if get_entries:
            print("")
            print("  Latency Breakdown (GET endpoints):")
            print(f"    {'Endpoint':<30} {'Total':>8} {'DB%':>6} {'Search%':>9} {'Internal%':>11}")
            for ep, bd in sorted(get_entries.items()):
                ep_short = ep.replace("GET ", "")[:28]
                print(f"    {ep_short:<30} {bd['avg_total_ms']:>7.0f}ms "
                      f"{bd['db_pct']:>5.1f}% {bd['search_pct']:>8.1f}% "
                      f"{bd['internal_pct']:>10.1f}%")

        bottlenecks = ssa.get("bottlenecks", [])
        if bottlenecks:
            print("")
            primary = bottlenecks[0]
            print(f"  BOTTLENECK: {primary}")
        print("")

    config_summary = sizing.get("config_summary", [])
    if config_summary:
        print("RECOMMENDED CONFIGURATION:")
        for env_line in config_summary:
            print(f"  export {env_line}")
        print("")

    print(f"Full report: {output_path}")
    print(f"Total time: {overall['total_wall_clock_s']:.1f}s")

print_summary_table(report)

print("")
print("Collected IDs for linking:")
print(f"  Table IDs:      {len(collected_table_ids)}")
print(f"  Dashboard IDs:  {len(collected_dashboard_ids)}")
print(f"  Pipeline IDs:   {len(collected_pipeline_ids)}")
print(f"  Test Case FQNs: {len(collected_test_case_fqns)}")
PYEOF

echo ""
echo "Test data loaded. You can now trigger reindexing with: ./scripts/trigger-reindex.sh"
