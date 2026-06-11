-- IntakeForm entity table: per-entity-type governance-required-field configuration
CREATE TABLE IF NOT EXISTS intake_form_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.id'))) STORED NOT NULL,
  name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.name'))) VIRTUAL NOT NULL,
  fqnHash varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entityType varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.entityType'))) VIRTUAL NOT NULL,
  json json NOT NULL,
  updatedAt bigint UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedAt'))) VIRTUAL NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedBy'))) VIRTUAL NOT NULL,
  deleted TINYINT(1) GENERATED ALWAYS AS (IF(json_extract(json,'$.deleted') = TRUE, 1, 0)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY fqnHash (fqnHash),
  UNIQUE KEY intake_form_entity_type_unique (entityType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
