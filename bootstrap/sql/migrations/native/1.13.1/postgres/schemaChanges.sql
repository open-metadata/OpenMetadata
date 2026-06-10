-- ---------------------------------------------------------------------------
-- Backfill the per-entity `name` index on entity tables that were created
-- without one. The distributed reindex paginates every entity type with
-- `... ORDER BY name, id LIMIT 1 OFFSET :n` (EntityRepository.getCursorAtOffset).
-- Without a `name`-leading index that ORDER BY is a sort that can exhaust
-- work_mem on large tables; `<table>_name_index(name)` lets the cursor query run
-- index-only instead. Idempotent via IF NOT EXISTS. Covers only entity tables
-- that exist as of 1.13.1; later tables get the index in their own migration.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS directory_entity_name_index ON directory_entity (name);
CREATE INDEX IF NOT EXISTS drive_service_entity_name_index ON drive_service_entity (name);
CREATE INDEX IF NOT EXISTS file_entity_name_index ON file_entity (name);
CREATE INDEX IF NOT EXISTS spreadsheet_entity_name_index ON spreadsheet_entity (name);
CREATE INDEX IF NOT EXISTS worksheet_entity_name_index ON worksheet_entity (name);
-- learning_resource_entity is intentionally omitted: its `name` is varchar(3072), too
-- wide to fit a btree index row, and the table is small enough that the reindex cursor
-- sort is not a concern.
