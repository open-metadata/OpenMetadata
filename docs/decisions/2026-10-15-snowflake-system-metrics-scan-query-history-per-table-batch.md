# Snowflake system metrics scan QUERY_HISTORY once per batch of tables

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial) · v2 2026-10-15 (release completed batches) · v3 2026-10-15 (byte budget and per-table fallback) · v4 2026-10-15 (protect active batch history)
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

## Amendment v3 — Shared history budget and per-table fallback
The two-batch retention limit bounds table count but not the number of history records. Both
`QUERY_HISTORY` and `DYNAMIC_TABLE_REFRESH_HISTORY` now share one byte budget per ingestion
process, including any batch being built. `OM_SNOWFLAKE_SYSTEM_METRICS_CACHE_MAX_BYTES` configures it; the default is **32 MiB
(33,554,432 bytes)** and zero disables batch caching. This is a conservative starting cap for an
optional cache, not a measured guarantee for every container; operators can lower it for smaller
containers. No history is written to disk.

Each cached index first reserves **1 KiB** for its dictionary and accounting metadata. Each retained
record then reserves space before insertion, accounting for Python objects, values and container
overhead. Shared values and spare container capacity are deliberately overcounted. This is
accounting for cached history, not a cap on process RSS, driver result buffers, or a table's
final metrics. History builds share one lock so reservations across both views cannot race.

When space runs short, older cached indexes are evicted first. If the current batch still exceeds
the budget, its stream is closed and its partial index is discarded. A bounded marker makes all
remaining tables of that batch use individual-table scans without retrying the oversized batch.
Each table still reuses its own history for inserts, updates and deletes. No records are truncated.

This sacrifices scan reduction for oversized histories: a batch can cost one interrupted scan plus
one scan per table. Individual-table histories remain unconstrained by this shared cache budget,
so one extremely busy table can still require substantial memory.

## Amendment v4 — Protect the batch's other history view
Budget eviction is restricted to strictly older batch IDs. The other history view of the batch
being built, and any newer batch's history, remain cached. If the remaining budget cannot hold the
new view, it records its per-table fallback marker instead. This prevents alternating regular and
dynamic tables from repeatedly evicting each other's indexes and rescanning the entire batch.

`test_mixed_batch_preserves_the_other_views_history_and_falls_back` guards both table orderings,
metric values and scan counts. The older-batch eviction test still verifies that completed history
can release capacity.
