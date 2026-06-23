-- Backfill the leading-`name` index on the context entity tables, which were introduced in
-- 2.0.0 (so they cannot be indexed in the 1.13.1 backfill, where the rest of the reindexable
-- entity tables are handled). The distributed reindex paginates every indexed entity type with
-- `... ORDER BY name, id` (EntityRepository.getCursorAtOffset for the partition-boundary cursor,
-- the coordinator boundary walk, and the keyset batch reads). `name` is a generated column
-- derived from `json`, so without a LEADING-`name` index that ORDER BY is a filesort that
-- materializes `name` from the `json` blob for every scanned row and can exhaust sort memory
-- (ER_OUT_OF_SORTMEMORY, "Out of sort memory, consider increasing server sort buffer size") on
-- large tables. `<table>_name_index(name)` (InnoDB appends the PK `id`) lets the cursor query
-- run index-only instead.
CREATE INDEX context_file_name_index ON context_file (name);
CREATE INDEX context_memory_name_index ON context_memory (name);
