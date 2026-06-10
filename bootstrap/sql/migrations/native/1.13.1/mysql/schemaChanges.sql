-- Backfill the per-entity `name` index on entity tables that were created without
-- one. The distributed reindex paginates every entity type with
-- `... ORDER BY name, id LIMIT 1 OFFSET :n` (EntityRepository.getCursorAtOffset);
-- without a leading-`name` index that ORDER BY is a filesort that can exhaust sort
-- memory (ER_OUT_OF_SORTMEMORY, "Out of sort memory, consider increasing server sort
-- buffer size") on large tables. `<table>_name_index(name)` (InnoDB appends the PK
-- `id`) lets the cursor query run index-only instead. Covers entity tables that exist
-- as of 1.13.1; tables introduced later get the index in their own migration.
CREATE INDEX directory_entity_name_index ON directory_entity (name);
CREATE INDEX drive_service_entity_name_index ON drive_service_entity (name);
CREATE INDEX file_entity_name_index ON file_entity (name);
CREATE INDEX spreadsheet_entity_name_index ON spreadsheet_entity (name);
CREATE INDEX worksheet_entity_name_index ON worksheet_entity (name);
-- learning_resource_entity is intentionally omitted: its `name` is varchar(3072),
-- which exceeds MySQL's 3072-byte index key limit (utf8mb4), and the table is small
-- enough that the reindex cursor sort is not a concern.
