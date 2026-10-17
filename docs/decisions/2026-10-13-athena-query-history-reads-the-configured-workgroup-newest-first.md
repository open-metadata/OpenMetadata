# Athena query history reads the configured workgroup, newest first, until resultLimit user queries

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `ingestion/tests/unit/source/database/athena/test_query_history.py`
- **Related:** open-metadata/openmetadata-collate#5934

## Context
Athena usage and lineage listed every enabled workgroup even when the connection named one, and
applied `resultLimit` per workgroup, as a count of 50-execution pages that still held failed
queries and the ones OpenMetadata ran itself. A run could emit `resultLimit` times the number of
workgroups, or no user query at all when the first pages were OpenMetadata's.

## Decision
- With `workgroup` set, only that workgroup's history is read and `ListWorkGroups` is not called.
  With it empty, every enabled workgroup is read, and the default workgroup when they cannot be
  listed.
- `resultLimit` is one budget for the whole run, spent only on successful queries of the query log
  window that neither OpenMetadata nor dbt ran. Usage and lineage both take their queries from
  `AthenaQueryParserSource.get_queries`, so they read the same history.
- A workgroup's history stops being read at the first page submitted entirely before the window,
  because `ListQueryExecutions` returns the most recent executions first. AWS does not document that
  order; the page-count limit this replaces relied on it as well.

## Consequences
Failed and connector-generated queries no longer use up the budget, and reading stops once it is
spent, so the first workgroup listed can take all of it. If AWS ever listed executions in another
order, history would be cut short at the window boundary; reading the full 45-day history and
sorting by submission time would then be the fix.
