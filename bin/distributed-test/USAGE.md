# Distributed Indexing Load Test Scripts

Scripts for generating test data and triggering reindexing to load-test the OpenMetadata search indexing pipeline.

## Quick Start

```bash
# 1. Start the environment
./scripts/start.sh

# 2. Load test data (~50K entities)
./scripts/perf-test.sh --scale small --server http://localhost:8585

# 3. Trigger reindex
./scripts/trigger-reindex.sh

# 4. Monitor logs
./scripts/logs.sh

# 5. Stop the environment
./scripts/stop.sh
```

## perf-test.sh

Generates entities across 30+ entity types, including time-series data, lineage edges, and data quality entities. Uses concurrent workers for high throughput.

### Scale Presets

Use `--scale` to pick a preset:

| Preset | Approximate Total | Use Case |
|--------|-------------------|----------|
| `small` | ~50K | Quick smoke tests, CI |
| `medium` | ~500K | Integration testing |
| `large` | ~2M | Performance validation |
| `xlarge` | ~5M | Full-scale load testing |

```bash
# Small smoke test
./perf-test.sh --scale small --server http://localhost:8585

# Full 5M load test
./perf-test.sh --scale xlarge --server http://localhost:8585

# Quick mode (~10K, fastest)
./perf-test.sh --quick --server http://localhost:8585
```

Default (no `--scale` or `--quick`) produces ~46K entities for backward compatibility.

### Overriding Individual Counts

Any `--entity-type NUM` flag overrides the preset for that entity type:

```bash
# Small preset but with 100K tables
./perf-test.sh --scale small --tables 100000

# Only create tables and dashboards (everything else stays at preset counts)
./perf-test.sh --scale small --tables 50000 --dashboards 10000
```

### All Flags

#### Entity counts

| Flag | Default | Description |
|------|---------|-------------|
| `--tables NUM` | 20000 | Database tables |
| `--topics NUM` | 3000 | Kafka/messaging topics |
| `--dashboards NUM` | 5000 | Looker dashboards |
| `--charts NUM` | 10000 | Dashboard charts |
| `--pipelines NUM` | 3000 | Airflow pipelines |
| `--stored-procedures NUM` | 0 | Stored procedures |
| `--containers NUM` | 2000 | S3 containers |
| `--search-indexes NUM` | 1000 | Elasticsearch indexes |
| `--mlmodels NUM` | 2000 | ML models |
| `--queries NUM` | 0 | SQL queries |
| `--data-models NUM` | 0 | Dashboard data models |
| `--test-suites NUM` | 0 | Test suites |
| `--test-cases NUM` | 0 | Test cases (linked to tables) |
| `--glossaries NUM` | 50 | Glossaries |
| `--glossary-terms NUM` | 5000 | Glossary terms |
| `--classifications NUM` | 20 | Tag classifications |
| `--tags NUM` | 1000 | Tags |
| `--users NUM` | 0 | Users |
| `--teams NUM` | 0 | Teams |
| `--domains NUM` | 0 | Domains |
| `--data-products NUM` | 0 | Data products (need domains) |
| `--api-collections NUM` | 0 | API collections |
| `--api-endpoints NUM` | 0 | API endpoints (need collections) |
| `--lineage-edges NUM` | 0 | Lineage edges between entities |

#### Time-series entity counts

| Flag | Default | Description |
|------|---------|-------------|
| `--test-case-results NUM` | 0 | Test case results (need test cases) |
| `--entity-report-data NUM` | 0 | Entity report data insights |
| `--web-analytic-views NUM` | 0 | Web analytic entity view reports |
| `--web-analytic-activity NUM` | 0 | Web analytic user activity reports |
| `--raw-cost-analysis NUM` | 0 | Raw cost analysis reports |
| `--aggregated-cost-analysis NUM` | 0 | Aggregated cost analysis reports |

#### Other options

| Flag | Default | Description |
|------|---------|-------------|
| `--server URL` | `http://localhost:8585` | Target OpenMetadata server |
| `--workers NUM` | 20 | Concurrent HTTP workers |
| `--quick` | - | Quick mode preset (~10K entities) |
| `--scale PRESET` | - | Scale preset (small/medium/large/xlarge) |
| `--skip-reads` | - | Skip read benchmarking phase (Phase 8) |
| `--only-reads` | - | Skip write phases; discover existing entities and run reads only |
| `--mixed` | - | Run mixed read/write workload (Phase 9) |
| `--mixed-duration SECS` | 60 | Duration of mixed workload in seconds |
| `--read-ratio PCT` | 80 | Read percentage in mixed workload (0-100) |
| `--realistic` | - | Run Phase 4 entity creation concurrently across entity types using a shared worker pool |

### Entity Creation Order

The script creates entities in dependency order across up to 9 phases:

```
Phase 1  Metadata         domains, classifications, tags, glossaries, terms, users, teams
Phase 2  Services         database, dashboard, pipeline, messaging, ML, storage, search, API
Phase 3  Infrastructure   databases, schemas, API collections
Phase 4  Core entities    tables, dashboards, charts, topics, pipelines, storedProcedures,
                          containers, searchIndexes, mlmodels, queries, dataModels,
                          apiEndpoints, dataProducts
Phase 5  Data Quality     testSuites, testCases
Phase 6  Lineage          table->table (60%), table->dashboard (25%), pipeline->table (15%)
Phase 7  Time-Series      testCaseResults, entityReportData, webAnalyticViews,
                          webAnalyticActivity, rawCostAnalysis, aggCostAnalysis
Phase 8  Read Benchmarks  entity fetch, paginated list, search queries, lineage traversal
Phase 9  Mixed Workload   concurrent reads + writes for configurable duration (--mixed)
```

Phases 8 and 9 are optional:
- Phase 8 runs automatically unless `--skip-reads` is passed
- Phase 9 only runs when `--mixed` is passed
- `--only-reads` skips phases 1-7, discovers existing entities, and runs Phase 8

### Entity Linking

- **Tables, dashboards, pipelines**: IDs collected during Phase 4 for use in lineage (Phase 6)
- **Test cases**: FQNs collected for testCaseResult creation (Phase 7)
- **Lineage edges**: Use collected UUIDs via `PUT /api/v1/lineage`
- Collections are capped at `max(lineage_edges * 2, test_case_results)` to bound memory

### Auto-Scaling Infrastructure

Databases and schemas scale automatically with table count:
- `NUM_DATABASES = max(1, tables / 50000)`
- `SCHEMAS_PER_DB = min(20, tables / (databases * 5000))`
- This keeps ~5000 tables per schema at any scale

### Retry Logic

HTTP requests retry up to 3 times with exponential backoff (1s, 2s, 4s) on:
- 5xx server errors
- Connection errors / timeouts

### Realistic Concurrent Workload (`--realistic`)

By default, `--workers N` creates N concurrent workers **per entity type**, but entity types run
sequentially (all tables first, then all dashboards, etc.). With `--realistic`, all Phase 4 entity
types are created concurrently through a **single shared worker pool**, simulating real-world traffic
where tables, dashboards, topics, and pipelines all hit the server at the same time.

This exposes contention patterns not visible in sequential mode:
- Cross-entity DB lock contention
- Shared thread pool pressure
- Connection pool exhaustion under mixed workloads

```bash
# Realistic mode: all entity types hit the server concurrently
./perf-test.sh --scale 10k --realistic --server http://localhost:8585

# Compare with sequential mode (default)
./perf-test.sh --scale 10k --server http://localhost:8585
```

The report includes a `realistic_combined` entry showing combined RPS and latency distribution
across all entity types, in addition to individual per-entity-type metrics.

### Performance Tips

- Use `--workers 30` or higher if the server can handle it
- Time-series and lineage phases use `min(10, workers)` to avoid overwhelming the server
- At `xlarge` scale, expect the script to run for several hours depending on server capacity
- Monitor server logs for 429/503 errors and reduce workers if needed

### Multi-Scale Benchmarking

Run benchmarks across multiple asset counts to compare performance at different scales:

```bash
# Benchmark at 10k, 50k, 100k, and 200k entities
for scale in 10k 50k 100k 200k; do
  ./scripts/perf-test.sh --scale "$scale" --server http://localhost:8585 \
    --output "/tmp/bench-${scale}.json" --workers 20 2>&1 | tee "/tmp/bench-${scale}.log"
done
```

With read and mixed workload benchmarks included:

```bash
for scale in 10k 50k 100k; do
  ./scripts/perf-test.sh --scale "$scale" --server http://localhost:8585 \
    --mixed --mixed-duration 30 \
    --output "/tmp/bench-${scale}.json" 2>&1 | tee "/tmp/bench-${scale}.log"
done
```

Compare results across scales:

```bash
for f in /tmp/bench-*.json; do
  echo "=== $(basename $f) ==="
  python3 -c "
import json
r = json.load(open('$f'))
o = r['overall']
print(f\"  Entities: {o['total_entities_created']:,}  RPS: {o['overall_throughput_rps']:.1f}\"
      f\"  Errors: {o['overall_error_rate_pct']:.1f}%  Time: {o['total_wall_clock_s']:.0f}s\")
"
done
```

## Verification After Loading

```bash
# 1. Trigger reindex
./scripts/trigger-reindex.sh

# 2. Check partition table for all entity types
mysql -e "SELECT DISTINCT entityType FROM search_index_partition ORDER BY entityType;"

# 3. Verify counts in UI
#    - Data Assets: tables, topics, dashboards, pipelines, etc.
#    - Data Quality: test suites and test cases
#    - Lineage: visible edges between tables/dashboards/pipelines
#    - Data Insights: time-series charts for entity reports, web analytics, cost analysis
```
