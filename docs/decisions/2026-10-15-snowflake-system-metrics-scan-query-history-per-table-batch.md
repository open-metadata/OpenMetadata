# Snowflake system metrics scan QUERY_HISTORY once per batch of tables

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial) · v2 2026-10-15 (release completed batches)
- **Deciders:** TeddyCr
- **Guard:** `ingestion/tests/unit/metadata/ingestion/source/database/snowflake/profiler/test_batched_system_metrics.py`, `TestFetchTableBatches` in `ingestion/tests/unit/observability/profiler/test_entity_fetcher.py`
- **Related:** open-metadata/openmetadata-collate#3029

## Context
Snowflake system metrics (inserts, updates, deletes) read `ACCOUNT_USAGE.QUERY_HISTORY`, and the
profiler built one computer per table, so a service with N tables ran N 24-hour scans filtered by
`QUERY_TEXT ILIKE '%<table>%'`. `DATABASE_NAME`/`SCHEMA_NAME` are the session context, not the
modified table, so the scan cannot be narrowed by them; and an unfiltered scan of all DML is not an
option, since a busy account logs millions of DML per day with arbitrarily long `QUERY_TEXT`.

## Decision
- `DatabaseFetcherStrategy` groups the tables of each database into batches and **registers a batch
  in `TABLE_BATCH_WINDOW` before yielding any of its tables**. The first table of a batch to compute
  system metrics scans `QUERY_HISTORY` once with one `ILIKE` per table of the batch; the other
  tables read the result.
- Each row is attributed to the one table its `QUERY_TEXT` resolves to and kept only if that table
  is in the batch, so a query matched by several patterns is counted once without tracking query ids.
- Memory is bounded: rows are streamed, `QUERY_TEXT` is dropped after resolution, and the window and
  the history index keep only the **2** most recent batches.
- The batch size is `systemMetricsBatchSize` on the Snowflake connection, **default 50, range
  1–500**. 50 cuts scans 50x while keeping the `OR` clause small; 500 keeps the statement far below
  Snowflake's query text limit and bounds the history held at once. It is a connection setting, not
  a profiler pipeline one, because the profiler form is shared by every database connector and only
  Snowflake batches.
- A table the window does not know (another entry point, or an FQN that does not match the
  runner's names) is scanned on its own, as before.

## Consequences
- Fewer scans: `ceil(N / batch size)` per database instead of N.
- The batching relies on the workflow processing records one at a time, in the order the fetcher
  yields them. Reading the fetcher ahead, or processing records in parallel, would evict batches
  before their tables run and silently fall back to one scan per table; revisit the 2-batch window
  first if that changes.
- Dynamic tables use the same batching on `DYNAMIC_TABLE_REFRESH_HISTORY`, matched exactly on
  database, schema and name.
- Another connector can opt in by adding `systemMetricsBatchSize` to its connection and reading
  `TABLE_BATCH_WINDOW` from its system metrics computer.

## Amendment v2 — Batch registration lifetime
The fetcher discards each registration after handing over its tables, including when the fetcher
is closed early. The window advertises only active batches, so a later standalone profile cannot
reuse the previous workflow's cached history. Discarding a batch preserves any newer registration
for the same table. The two-batch retention limit still protects callers that register directly.
