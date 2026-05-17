# `loadgen.py` — Configurable bulk load generator

`scripts/loadgen.py` produces a realistic, configurable asset mix in an
OpenMetadata instance for performance and soak testing. It is designed for
**large scale** (100k → 1M+ entities) and uses bulk endpoints, inline
enrichment, and adaptive throttling so it does not melt the server.

## When to use it

- Stress-testing search / reindex performance against realistic data shapes.
- Validating UI behavior (Explore filters, Lineage, DQ pages) under high
  asset counts.
- Reproducing customer-scale conditions for bug repros.
- Soak-testing a release branch before cutting (the cherry-pick that
  motivated this script — `#28064` — needs ≥100k entities, mixed types,
  and active DQ incidents to exercise the soft-delete script + time-series
  reindex paths).

For smaller, one-entity-type scenarios the older `ingest_100k_tables.py` /
`ingest_100k_containers.py` scripts are still fine and use the Python SDK.
`loadgen.py` talks REST directly so it doesn't require building the SDK.

## Prerequisites

- Python 3.10 or 3.11.
- `aiohttp` (install in your repo venv if missing: `pip install aiohttp`).
- A running OpenMetadata server (`./docker/run_local_docker.sh -m ui -d <db>`).
- A bearer token — see below.

## Authentication

Three modes, in precedence order:

| Mode | Flag(s) | Notes |
|---|---|---|
| Pass JWT directly | `--token <jwt>` or `OM_TOKEN=<jwt>` | Recommended for CI / bot tokens copied from the UI. Written to `--token-file` before run. |
| Login flow | `--email admin@open-metadata.org --password admin` | Exchanges credentials via `/v1/users/login` for a JWT. |
| Pre-populated file | `--token-file /path/to/jwt` | Useful when an external refresher rotates the token; the script re-reads the file every 30s. |

For long runs (>1 hour), the JWT obtained via `/v1/users/login` will expire.
Either keep an external refresher writing to `--token-file`, or use a longer-
lived bot token via `--token`.

## Quick starts

### Smoke (200 entities, ~1 min)

```bash
source env/bin/activate
python scripts/loadgen.py \
    --server http://localhost:8585/api \
    --token "$OM_JWT" \
    --total 200 --prefix smoketest --bulk-size 25 --concurrency 4
```

### 100k mixed assets on a local docker stack (~5 min)

```bash
python scripts/loadgen.py \
    --server http://localhost:8585/api \
    --email admin@open-metadata.org --password admin \
    --total 100000
```

### 500k stress test (~25–40 min)

```bash
python scripts/loadgen.py \
    --server http://localhost:8585/api \
    --token "$OM_JWT" \
    --total 500000 \
    --bulk-size 150 --concurrency 12 \
    --include-tests 0.05
```

### 1M asset soak

```bash
python scripts/loadgen.py \
    --server http://localhost:8585/api \
    --token "$OM_JWT" \
    --total 1000000 \
    --bulk-size 200 --concurrency 16 \
    --max-error-rate 0.03 --backoff-seconds 60
```

For an instance under 8 GB OpenSearch heap, expect 1M to take ~1–1.5h
end-to-end. Watch search node heap pressure (`docker stats`) — if you see
sustained heap > 90%, drop `--concurrency` or shrink `--mix` for the
heaviest types.

## Configuration

### Volume — `--total` and `--mix`

A single `--total` drives the dataset size. `--mix` declares the distribution
across entity types as a comma-separated list of `name:fraction` pairs that
must sum to ~1.0 (auto-normalized with a warning if off).

Default mix:

```
tables:0.55, containers:0.15, topics:0.05, dashboards:0.04,
pipelines:0.04, dashboardDataModels:0.04, charts:0.04, mlmodels:0.03,
searchIndexes:0.03, apiEndpoints:0.02, storedProcedures:0.01
```

Override to bias for what you care about:

```bash
# Dashboard-heavy test
--mix tables:0.30,dashboards:0.30,charts:0.20,dashboardDataModels:0.20

# Search-heavy test (lots of indexes, few tables)
--mix tables:0.10,searchIndexes:0.70,containers:0.20
```

### Inline enrichment — `--enrich-inline`

Tags and glossary terms attach to created entities at creation time (one
HTTP call, no follow-up PATCH wave). Format:
`tag-pct:0.10,cert-pct:0.05,glossary-pct:0.05`

| Key | Meaning |
|---|---|
| `tag-pct` | Fraction of entities that get a random `Tier.*` + `PII.*` pair |
| `glossary-pct` | Fraction that get a random glossary term |
| `cert-pct` | Fraction PATCHed with a `Certification.{Gold,Silver,Bronze}` certification after creation. **Capped at 2000** absolute PATCHes to protect the search bulk pipeline — set higher only if you've validated the server can handle it. |

### Bulk domain assignment — `--bulk-domain-pct`

Fraction of tables assigned to a domain (round-robin) via
`PUT /domains/{name}/assets/add` in batches of `--bulk-size`. Default 0.20.
Set 0 to skip.

### Data quality — `--include-tests` / `--failed-fraction`

`--include-tests 0.05` creates a `tableColumnCountToBeBetween` test case on
5% of tables, then writes 5 results per test (the last result is `Failed`
on `--failed-fraction` of them, which auto-opens an incident).

Roughly 90% of failed incidents are progressed through stages, distributed
evenly across `Ack`, `Assigned`, `Resolved` (the remaining 10% stay `New`).

### Throughput — `--bulk-size`, `--concurrency`

| Flag | Default | Tuning |
|---|---|---|
| `--bulk-size` | 100 | Entities per bulk PUT body. 50–200 sweet spot; >300 risks per-batch timeouts. |
| `--concurrency` | 10 | Concurrent in-flight bulk requests. 8–16 fits a 2-CPU local docker; 32+ for production-scale servers. |

### Adaptive throttling — `--max-error-rate`, `--backoff-seconds`

If the rolling 5xx/timeout rate exceeds `--max-error-rate` (default 5%), the
client pauses for `--backoff-seconds` (default 30) before resuming. This
prevents the retry-storm death spiral seen with naive parallel loaders.

If you see frequent backoffs in the log, the server is the bottleneck —
lower `--concurrency` or `--bulk-size`.

### Governance — domains / data products / glossary

| Flag | Default |
|---|---|
| `--domains` | 20 |
| `--data-products-per-domain` | 10 |
| `--glossaries` | 10 |
| `--terms-per-glossary` | 200 |

### Idempotency — `--prefix`

All created entities are namespaced under `--prefix` (default `loadgen`).
PUT semantics mean re-running with the same prefix upserts (no duplicates).
Bump the prefix for an independent dataset, e.g. `--prefix soak_run_2`.

### Determinism — `--seed`

Random choices (which entities get which tags, which test cases fail, etc.)
are seeded from `--seed` (default 42), so re-runs with the same flags hit
the same entities.

## What gets created

Roughly, at `--total 100000` with defaults:

| Entity type | Count |
|---|---|
| Tables | 55,000 |
| Containers | 15,000 |
| Topics | 5,000 |
| Dashboards | 4,000 |
| Pipelines | 4,000 |
| Dashboard Data Models | 4,000 |
| Charts | 4,000 |
| MlModels | 3,000 |
| SearchIndexes | 3,000 |
| API Endpoints | 2,000 |
| Stored Procedures | 1,000 |
| Plus | 8 services, 20 domains, 200 data products, 10 glossaries, 2,000 glossary terms, lineage chains, ~5,000 test cases with mixed results, ~1,800 incidents at all 4 lifecycle stages |

## Architecture notes

The script uses three OM patterns that scale well:

1. **Bulk creation endpoints** (`PUT /tables/bulk`, `/containers/bulk`,
   `/pipelines/bulk`, etc.) accept a raw JSON array of create requests. The
   server processes them as a single transaction → one search bulk index
   request → one ChangeEvent per batch. ~100x fewer side-effects than
   per-entity PUT.
2. **Inline enrichment** for tags/glossary terms — the `CreateTable` and
   sibling schemas accept `tags` directly. No follow-up PATCH wave required
   (the wave was what saturated the server in early iterations of this
   loader at 400k tables).
3. **Bulk asset assignment** (`PUT /domains/{name}/assets/add`) replaces
   per-entity domain PATCHes. Look-up of asset IDs is the unavoidable
   overhead but it's a single GET per asset and runs at half concurrency.

The one type that genuinely can't be batched is **certification** —
`CreateTable` does not accept a `certification` field, so we PATCH after
creation. Hence the absolute cap on PATCHes.

## Cleaning up a load test

The simplest way is to recreate the docker stack:

```bash
docker compose -f docker/development/docker-compose-postgres.yml down --remove-orphans
docker volume rm development_postgresql-data development_es-data
./docker/run_local_docker.sh -m ui -d postgresql
```

Or delete specific services by prefix via the API:

```bash
for svc in db storage messaging dashboard pipeline mlmodel search api; do
  curl -X DELETE -H "Authorization: Bearer $OM_JWT" \
    "http://localhost:8585/api/v1/services/${svc}Services/name/loadgen_${svc}_svc?recursive=true&hardDelete=true"
done
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Expired token!` mid-run | JWT TTL elapsed (login tokens are typically 1h) | Use `--token` with a long-lived bot token, or run an external refresher writing to `--token-file` |
| Many 5xx + adaptive backoffs | Server saturated | Lower `--concurrency` to 4–6, lower `--bulk-size` to 50, or shrink `--total` |
| `Invalid request format` on `/tables/bulk` | `CreateTable` doesn't accept some inline field | Check the schema; `certification` notably can't be inline |
| OpenSearch yellow → red during run | Heap pressure from bulk index | Set `ES_JAVA_OPTS=-Xms4g -Xmx4g` in compose for OS, restart, retry |
| `query param id must not be null` on `/domains/.../assets/add` | Asset references missing `id` | The script handles this — re-pull `scripts/loadgen.py` if you see it |
