# A Unity Catalog foreign key to a table written later is patched once every table is written

- **Status:** Accepted
- **Revisions:** v1 2026-11-15 (initial)
- **Deciders:** akashverma0786
- **Guard:** `ingestion/tests/unit/topology/database/test_unitycatalog_table_metadata.py`
- **Related:** ADR:2026-11-15-unity-catalog-table-types-come-from-the-securable-kind

## Context
A table's foreign keys are resolved when the table is written: each referred column is named by
its FQN. The server rejects a table whose key refers to a table it does not hold, so a key is sent
only once its referred table is in OpenMetadata. A referred table in a schema the walk reaches
later, or still in the sink's bulk buffer, was not there yet: the source dropped the key without a
log, and only the service's second run added it.

## Decision
- A key whose referred table is not in OpenMetadata when its table is written is held for the run.
- `yield_table_constraints`, which the database topology runs after every table node, first yields
  a `Barrier` so the sink flushes its bulk buffer, then adds the held keys by PATCH. The PATCH reads
  `tableConstraints` first, so the keys already stored, such as the primary key, are kept.
- The source sends that PATCH itself rather than through the sink, so it changes only
  `tableConstraints`: the sink's patch renumbers columns from 1, which would shift the 0-based
  column positions Unity Catalog reports.
- A held key whose referred table never arrives is dropped with a warning that names both tables.
- A failed lookup fails only its own table's keys; the other tables are still patched.

## Consequences
The first run of a service ingests every foreign key whose referred table it ingests, whatever the
order of the walk. A table whose keys are held gets one extra version from the PATCH. A key to a
table the run does not ingest, such as one excluded by a filter, is reported on every run.
