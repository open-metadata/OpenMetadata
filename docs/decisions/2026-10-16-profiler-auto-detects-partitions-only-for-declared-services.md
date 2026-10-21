# The profiler auto-detects partitions only for services that declare support, on by default

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `ingestion/tests/unit/test_partition.py`
- **Related:** open-metadata/openmetadata-collate#3048

## Context
Twelve sources store partition metadata on `Table.tablePartition`, but only BigQuery used it to scope
the profiler; every other partitioned table was profiled in full. The metadata is not uniformly
trustworthy: Postgres, CockroachDB and Greenplum report every range partition as `TIME-UNIT`, Doris and
StarRocks report every partition key that way, Redshift stores no partition metadata, and the date
arithmetic filter only compiles on some dialects.

## Decision
- A connection opts in with the `supportsAutoPartitionDetection` capability (BigQuery, Postgres,
  Greenplum, CockroachDB, TimescaleDB, Doris, StarRocks). The profiler infers a partition only when
  that capability and the profiler pipeline's `enableAutoPartitionDetection` are both true.
- `enableAutoPartitionDetection` defaults to `true`, for existing pipelines too. BigQuery keeps its
  previous behavior; the other services start profiling recent partitions after upgrade, which is called
  out in the release notes.
- Only the first partition column is used. `TIME-UNIT` is applied only on DATE/DATETIME/TIMESTAMP(Z)
  columns, with the BigQuery granularity windows (3 days by default); `INTEGER-RANGE` only on numeric
  columns, with the 1–10000 range. Everything else is skipped.
- Precedence: workflow table config > table profiler config > inference. Athena's injected-partition
  validation runs before inference.
- Test suites and auto classification keep the BigQuery-only inference, so data quality results are
  not silently scoped to recent data.
- Table-level metrics (row count, size) are still computed on the full table; only column metrics are
  scoped.

## Consequences
Adding a service is a schema change (the capability) plus confirming its dialect compiles the date
filter. Revisit the default if users rely on full-table profiles for the newly enabled services, and
the test-suite exclusion if data quality should follow the profiler's scope.
