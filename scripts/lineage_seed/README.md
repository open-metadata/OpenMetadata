# Lineage scale seed

`seed_lineage_graph.py` loads a realistic, hierarchical lineage graph of any size, up to millions
of data assets, into an OpenMetadata server. Use it to check by hand that the lineage map stays
smooth at scale, or to give `LineageScenePerformanceScaleIT` a large graph to measure
(issue #32050). It needs only the Python 3.10+ standard library: no virtualenv and no `metadata`
package.

## What it builds

The data platform of a fictional company:

- **Governance.** Ten business domains (Sales, Marketing, Finance, Customer, Supply Chain,
  Product, People, Risk & Compliance, Platform, Data Science). Each has 2–4 data products and an
  owning team.
- **Services.** 37 in total, kept under the scene API's 200-node layer cap:
  - 25 operational databases (Postgres, MySQL, Oracle, SQL Server);
  - 2 Kafka clusters;
  - 5 warehouse accounts (Snowflake ×2, Redshift, Databricks, BigQuery);
  - Fivetran, dbt Cloud, Airflow and Spark;
  - Looker, Tableau, Power BI and Superset;
  - MLflow and SageMaker.
- **Assets.** Assets move through a medallion flow:
  - operational tables → Debezium CDC topics → `raw`;
  - `raw` → dbt `staging` views → `core` dimensions and facts;
  - `core` → `marts` → BI semantic models → dashboards;
  - `core` and `marts` → ML models.
  - In a 2M-asset graph that is 1.77M tables in 163 databases and 8,572 schemas.
- **Metadata on every asset.**
  - Every table and column has a description written for its business concept.
  - PII columns carry `PII.Sensitive` or `PII.NonSensitive`.
  - Models are tiered, and hub dimensions are `Tier1`.
  - Owners, domains and data products are set at create time.
  - Staging views have their SQL definition.
- **Lineage.**
  - Edges carry column-level mappings on full column FQNs, including SUM, AVG and COUNT for
    mart aggregates.
  - They also carry a short SQL statement.
  - Fivetran and Airflow edges name the pipeline that carries them, the way those connectors do.
  - Upstream picks are skewed, so a few dimensions fan out to thousands of consumers. That is the
    shape that makes the map work hard.
  - About 10% of marts read across domains.
- **A non-admin user**, `lineage.viewer@open-metadata.org` / `Lineage#Viewer2026`. A non-admin's
  root scene skips the admin cache and is the heaviest path, so check the map as this user too.

The graph is a pure function of `--assets`, `--prefix` and `--seed`: the same arguments always
build the same graph.

## Use it

```bash
# What would be created, without a server
python3 scripts/lineage_seed/seed_lineage_graph.py plan --assets 2000000

# Seed. admin/admin by default; pass --token <JWT> for a bot token instead
python3 scripts/lineage_seed/seed_lineage_graph.py seed --server http://localhost:8585 --assets 200000

# Interrupted, or some requests failed? Run the same command again: done work is skipped,
# failed units are retried. --fresh ignores the saved progress.

# Remove everything it created (prints the plan without --yes)
python3 scripts/lineage_seed/seed_lineage_graph.py cleanup --server http://localhost:8585 --yes
```

It needs a server built from `main`, because the hierarchical lineage scene API is not in `2.0.x`.
Progress prints every 15 seconds with a rate and an ETA.

When it finishes, the script writes `manifest.json` under its state directory
(`~/.cache/openmetadata-lineage-seed/<prefix>-<assets>-<seed>/`) and prints what to open:

| | |
|---|---|
| `platformLineage` | `/lineage`: the root LAYER scene over every service, domain or data product |
| `hubOnPlatformLineage` | the busiest hub dimension, focused on the map |
| `hubLineageTab` | the same hub's lineage tab on its table page |
| `leafDashboard` | a dashboard at the far end of the flow |

Switch the lens between **service**, **domain** and **data product**, then drill from a service into
databases, schemas and tables. Open a table to reach the **FIELD** band and its column-level edges,
and click an edge to see its SQL and column mappings.

## Before a big run: time and disk

Measured on one Docker Desktop stack: MySQL 8, Elasticsearch 9.3 with a 768 MB heap, and the server
with a 1.2 GB heap, on a 6-vCPU / 7.75 GiB VM. The host was shared with other builds, so treat these
as ranges, not constants:

| measurement | value | conditions |
|---|---|---|
| tables, bulk create | 463/s | 20k-asset run, 8 workers, quiet host |
| tables, bulk create | 99 / 113 per s | 10k-asset runs, 8 / 16 workers, host busy with another build |
| lineage edges | 119/s | 20k-asset run, 24 workers |
| lineage edges | 61 / 86 per s | 10k-asset runs, 24 / 48 workers, host busy with another build |
| lineage edges, re-PUT | 87 / 146 / 191 per s | 12 / 24 / 48 workers |
| MySQL data | +2.3 GB | 20k assets and 30k edges, 60% of it change-event and audit bookkeeping |
| MySQL binlog | +1.1 GB | same run, binlog on (the MySQL 8 default) |
| Elasticsearch | +0.4 GB | same run; the column index is half of it |

Extrapolating linearly to 2M assets and 3.06M edges is a **projection, not tested**. Expect:

- **Time:** roughly 1–5 h of tables and 4.5–14 h of lineage.
- **Disk:**
  - about 230 GB of MySQL data, plus about 110 GB of binlog when binlog is on;
  - about 40 GB of Elasticsearch, or about 20 GB with column indexing off.

A default laptop Docker VM does not have that. Before a 2M run:

- **Lineage is the long pole**, and it is server-bound: each edge PUT runs an Elasticsearch
  `update_by_query` with `refresh=true`. See *Known risks* in
  [`docs/perf/lineage-scale-validation.md`](../../docs/perf/lineage-scale-validation.md). More
  `--edge-workers` helps up to about 48.
- **Give Docker the disk**, or seed a bigger box. 200k assets is about a tenth of every figure above.
- **Turn MySQL binlog off** for a throwaway local database (`--disable-log-bin`).
- **Turn column indexing off** in *Settings → Search*; the lineage map does not read the column index.
- **Purge event bookkeeping afterwards** with the *Data Retention* application.

## Benchmark the seeded graph

`LineageScenePerformanceScaleIT` can measure this graph instead of seeding its own:

```bash
export OM_URL=http://localhost:8585 OM_ADMIN_TOKEN=<admin JWT>
LINEAGE_SEED_MANIFEST=$HOME/.cache/openmetadata-lineage-seed/acme-2000000-32050/manifest.json \
LINEAGE_OUTPUT=/tmp/lineage-bench/run-1 ./scripts/lineage-scale-benchmark.sh
```

- **What it does:** it builds the modules the IT needs, then measures the scene API at every level,
  the other lineage read APIs, first render and the map's drill, zoom and fit interactions. Pass
  `BUILD=false` on later runs to skip the build.
- **What it reads:** the hub, leaf and container FQNs from the manifest. It never deletes the graph.
- **What it writes to `LINEAGE_OUTPUT`:**
  - `lineage-scene-scale-<tables>.json`, every scenario's p50/p95;
  - `api-latency-*.json`, every API route the run called;
  - `manifest.json`, the graph's shape.

To follow your runs over time, record each run into a history of your own. It gets the nightly's
`TRENDS.md` and charts, and from the fifth run on it flags regressions:

```bash
python3 .github/scripts/benchmark_trend.py --reports /tmp/lineage-bench/run-1 \
  --history ~/lineage-bench-history --ref local --record --write-trends --summary-out /dev/stdout
```

Compare two runs with `.github/scripts/compare_benchmark_metrics.py --baseline <run> --candidate <run>`.

For a single scene, time the API directly. Of 20 sorted calls, the 19th is the p95:

```bash
URL="$OM_URL/api/v1/lineage/scene?lens=service&band=ASSET&size=200&entityType=databaseSchema&focusFqn=<schema FQN>"
for i in $(seq 1 20); do
  curl -s -o /dev/null -w '%{time_total}\n' -H "Authorization: Bearer $OM_ADMIN_TOKEN" "$URL"
done | sort -n
```

- **Focused scenes** (a service, database, schema or table) are never cached, so every call
  is cold.
- **The unfocused root scene** is cached for admins after the first call. Use the viewer
  account, or change `size` on each call, to measure it cold.

## How it works

| file | |
|---|---|
| `vocabulary.py` | domains, systems, business concepts, column kinds and description templates |
| `catalog.py` | the deterministic model: every asset's place, name, columns and upstream edges, addressed by `(layer, domain, index)` |
| `payloads.py` | create-request and lineage bodies built from the model |
| `client.py` | keep-alive HTTP per thread; backoff on 429/5xx; re-login on 401 |
| `seed_lineage_graph.py` | phases, resumable state, progress, manifest, cleanup |

- **Phases:** governance roots, databases, schemas, pipelines, tables (`PUT /v1/tables/bulk`),
  topics (one PUT each, as there is no bulk endpoint), data models, dashboards, ML models, then
  lineage (`PUT /v1/lineage/{type}/name/{fqn}/{type}/name/{fqn}`, so no entity ids are needed).
- **Resume:** each phase is split into units of up to `--batch-size` assets. Only fully successful
  units are recorded in `state.json`, and that is what lets a re-run resume or retry.
- **Load spread:** lineage units are interleaved across domains and layers, so concurrent writes
  update different service and data-product edges rather than queueing on the same refcount rows.
- **No dbt pipeline on edges:** dbt edges carry no pipeline reference, as with the dbt connector.
  Naming one shared pipeline service on millions of edges would funnel every write through the same
  two service-hop rows.

| flag | default | |
|---|---:|---|
| `--assets` | 2000000 | data assets to create; at least 1000 |
| `--prefix` | `acme` | prefix of every service, domain, data product and team |
| `--seed` | 32050 | the graph is identical for the same seed |
| `--workers` | 16 | parallel bulk requests |
| `--edge-workers` | 48 | parallel lineage PUTs |
| `--batch-size` | 100 | assets per bulk request |
| `--skip` | | skip a phase; repeatable |
| `--state-dir` | `~/.cache/...` | resume state and manifest |
| `--fresh` | | ignore saved progress |
| `--no-viewer` | | do not create the non-admin user |

The tests run without a server: `python3 -m pytest scripts/lineage_seed/tests`.
