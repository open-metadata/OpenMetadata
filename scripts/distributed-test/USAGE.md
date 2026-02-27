# Distributed Indexing Load Test Scripts

Scripts for generating test data and triggering reindexing to load-test the OpenMetadata search indexing pipeline.

## Quick Start

```bash
# 1. Start the environment
./scripts/start.sh

# 2. Load test data (~50K entities)
./scripts/load-test-data.sh --scale small --server http://localhost:8585

# 3. Trigger reindex
./scripts/trigger-reindex.sh

# 4. Monitor logs
./scripts/logs.sh

# 5. Stop the environment
./scripts/stop.sh
```

## load-test-data.sh

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
./load-test-data.sh --scale small --server http://localhost:8585

# Full 5M load test
./load-test-data.sh --scale xlarge --server http://localhost:8585

# Quick mode (~10K, fastest)
./load-test-data.sh --quick --server http://localhost:8585
```

Default (no `--scale` or `--quick`) produces ~46K entities for backward compatibility.

### Overriding Individual Counts

Any `--entity-type NUM` flag overrides the preset for that entity type:

```bash
# Small preset but with 100K tables
./load-test-data.sh --scale small --tables 100000

# Only create tables and dashboards (everything else stays at preset counts)
./load-test-data.sh --scale small --tables 50000 --dashboards 10000
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

### Entity Creation Order

The script creates entities in dependency order across 7 phases:

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
```

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

### Performance Tips

- Use `--workers 30` or higher if the server can handle it
- Time-series and lineage phases use `min(10, workers)` to avoid overwhelming the server
- At `xlarge` scale, expect the script to run for several hours depending on server capacity
- Monitor server logs for 429/503 errors and reduce workers if needed

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
