# Perf Tests

This directory contains locally runnable performance benchmarks for OpenMetadata.

## Lineage Benchmark

Use [benchmark_lineage.py](/Users/harsha/Code/dev/OpenMetadata/perf-tests/benchmark_lineage.py) to:

- discover lineaged assets across multiple entity types
- benchmark graph lineage APIs
- benchmark Impact Analysis table APIs
- benchmark Impact Analysis column-mode APIs for tables
- optionally capture Docker container stats snapshots before and after the run

The script uses only Python 3 standard library modules and writes a JSON report,
a Markdown summary, and CSV outputs under `perf-tests/results/`.

### Prerequisites

- Python 3.9+
- A running OpenMetadata instance
- A valid JWT or personal access token
- Optional: Docker CLI if you want container stats snapshots

### Recommended Local Docker Resources

For larger lineage graphs, increase local Docker memory and CPU before running
the benchmark. The exact values depend on the data volume, but a higher-memory
setup helps avoid Elasticsearch and OpenMetadata JVM throttling during larger
Impact Analysis runs.

For local Docker runs, the development compose now honors both:

- `OPENMETADATA_HEAP_OPTS`
- `ES_JAVA_OPTS`

Example:

```bash
export OPENMETADATA_HEAP_OPTS='-Xmx4G -Xms4G'
export ES_JAVA_OPTS='-Xms4g -Xmx4g'
./docker/run_local_docker.sh -m ui -d mysql -s false -i false -r true
```

### Basic Usage

```bash
OPENMETADATA_JWT_TOKEN="<token>" \
./perf-tests/benchmark_lineage.py \
  --base-url http://localhost:8585 \
  --warmup-runs 1 \
  --measured-runs 5
```

### Useful Options

```bash
./perf-tests/benchmark_lineage.py --help
```

Common options:

- `--search-indexes table,topic,dashboard,pipeline,mlmodel,container,searchIndex,dashboardDataModel,storedProcedure,apiEndpoint,metric,chart`
- `--benchmark-depth 2`
- `--impact-page-size 100`
- `--max-assets-per-type 10`
- `--entities-file perf-tests/my-assets.json`
- `--discovery-only`
- `--docker-containers openmetadata-server,elasticsearch`

### Example: Benchmark Specific Assets

Create a JSON file with explicit assets:

```json
[
  { "fqn": "sample_data.ecommerce_db.shopify.orders", "entityType": "table" },
  { "fqn": "sample_kafka.shopify.order_topic", "entityType": "topic" }
]
```

Then run:

```bash
OPENMETADATA_JWT_TOKEN="<token>" \
./perf-tests/benchmark_lineage.py \
  --base-url http://localhost:8585 \
  --entities-file perf-tests/my-assets.json
```

### Outputs

Each run creates a timestamped directory under `perf-tests/results/`, including:

- `assets.json`: discovered or supplied assets and lineage counts
- `results.json`: raw per-scenario benchmark results
- `summary.md`: human-readable report
- `scenario_summary.csv`: rollup per scenario
- `asset_results.csv`: rollup per asset and scenario

### Notes

- The script does not create lineage data. It benchmarks whatever lineage is
  already present in the target environment.
- Impact Analysis column-mode benchmarks are only executed for table assets.
- `getPaginationInfo` is used during discovery to identify assets that actually
  have lineage.

## Synthetic Lineage Seeding For Live Docker

Use [seed_lineage_topology.py](/Users/harsha/Code/dev/OpenMetadata/perf-tests/seed_lineage_topology.py)
to create a synthetic table-lineage graph directly in a running OpenMetadata
instance. This is the recommended path when you want to benchmark the branch
already deployed in local Docker instead of the heavier Testcontainers-based
integration benchmark.

The seeder creates:

- a synthetic Postgres service, database, and schema
- one root table
- `depth * width` downstream tables
- column lineage on every edge
- one classification tag and one glossary term on the benchmark column

### Example: Seed the 12x120 Topology

```bash
OPENMETADATA_JWT_TOKEN="<token>" \
./perf-tests/seed_lineage_topology.py \
  --base-url http://localhost:8585 \
  --depth 12 \
  --width 120 \
  --output-dir perf-tests/results/seed-depth12-width120
```

Outputs:

- `manifest.json`: root asset manifest compatible with `benchmark_lineage.py`
- `topology.json`: created entity details plus the glossary term FQN

### Example: Benchmark the Seeded 12x120 Topology

```bash
OPENMETADATA_JWT_TOKEN="<token>" \
./perf-tests/benchmark_lineage.py \
  --base-url http://localhost:8585 \
  --entities-file perf-tests/results/seed-depth12-width120/manifest.json \
  --benchmark-depth 13 \
  --impact-page-size 100 \
  --warmup-runs 1 \
  --measured-runs 5 \
  --docker-containers openmetadata_server,openmetadata_elasticsearch,openmetadata_mysql
```

Use `--benchmark-depth depth+1` for these seeded topologies when you want
`getPaginationInfo` to include the deepest downstream layer from the root. The
current pagination endpoint on the live stack requires one extra requested
depth to surface the full seeded depth.

For targeted filter runs, reuse the same seeded manifest and pass:

- `--query-filter` for structural or node-level table filtering
- `--column-filter` for Impact Analysis column filtering

## Synthetic Scale Benchmark

For controlled deep or wide Impact Analysis topologies, use the manual
integration benchmark:

[`LineageImpactAnalysisBenchmarkIT.java`](/Users/harsha/Code/dev/OpenMetadata/openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/LineageImpactAnalysisBenchmarkIT.java)

This benchmark provisions its own MySQL, Elasticsearch, and OpenMetadata test
environment with Testcontainers, creates synthetic table lineage, and logs
latency plus duplicate-count observations for:

- table view without filters
- table view with a structural filter
- table view with a node-level filter
- column view with a name filter
- column view with a tag and glossary filter

### Run a Single Scenario

The benchmark supports selecting scenarios with system properties:

```bash
mvn -pl openmetadata-integration-tests -P mysql-elasticsearch \
  -Dit.test=LineageImpactAnalysisBenchmarkIT \
  '-Djunit.jupiter.conditions.deactivate=*' \
  -Dlineage.benchmark.scenarios=depth12-width120 \
  -Dlineage.benchmark.warmupRuns=1 \
  -Dlineage.benchmark.measuredRuns=3 \
  -DfailIfNoTests=false \
  verify
```

Available scenario names:

- `depth12-width120`
- `depth12-width240`
- `depth12-width600`
- `depth24-width120`

This path is heavier than the Python benchmark because it creates the topology
before measuring it. Increase Docker memory and CPU before running the larger
scenarios.
