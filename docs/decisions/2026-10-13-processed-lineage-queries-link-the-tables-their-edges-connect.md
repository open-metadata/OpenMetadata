# A processed lineage query links the tables its edges connect and is skipped only while they exist

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `ingestion/tests/integration/lineage/test_query_lineage_rebuild.py` (edge restored after re-ingestion, only the affected query processed again, a third run processes nothing); `TestProcessedQueryLineage` in `ingestion/tests/unit/lineage/test_lineage_processors.py`; `test_soft_deleted_table_stays_indexed_until_hard_deleted` in `ingestion/tests/integration/ometa/test_ometa_es_api.py`
- **Related:** open-metadata/openmetadata-collate#5936, #29125 (same linkage for Snowflake ACCESS_HISTORY lineage, 1.12.11)

## Context
Query lineage skipped every logged query whose checksum belonged to a `Query` marked
`processedLineage`. The marker recorded nothing about the edges it stood for: hard-deleting a table
deletes its edges, and once the table was ingested again under a new id the surviving marker kept
the query from ever being processed again, so the edge never came back. The skip set was also cut
to the search API's default page of 10 checksums per service.

## Decision
- When `query_lineage_processor` stores a processed query, its `queryUsedIn` lists both ends of
  every edge derived from the query. `OMetaFQNLineageRequest` carries the resolved entity ids for
  this.
- A logged query is skipped only when its stored query is `processedLineage`, records at least one
  entity, and every recorded id is still in the table index. A soft-deleted table counts as present:
  its edges survive and come back on restore. Anything else, a failed lookup included, processes the
  query again.
- The lookups run once per processing chunk, by checksum and then by id, 100 terms per request
  (`SEARCH_TERMS_BATCH_SIZE`): the search API is a GET, and the server rejects request lines over
  8 KiB by default.

## Consequences
Re-creating a table reprocesses only the queries whose edges touched it, and every processed query
is processed once more after this change, because its stored query records no tables yet.

Processed lineage queries now appear on their tables' Queries tab, as usage queries do. The lineage
copy keeps the raw SQL, so a query with literals can be listed twice: masked from usage, raw from
lineage.

Two gaps remain. A search reindex between a hard delete and the next lineage run rebuilds
`queryUsedIn` from stored relationships, which no longer include the deleted table, so a query with
other recorded tables is still skipped. Lineage a query could not produce because a table was
missing at the time is not retried when the table appears. Revisit both if the server resets
`processedLineage` when an entity a query mentions is deleted.
