-- Add a supporting index for the compute.percentile query on entity_usage. The 1.13 unique-key
-- reorder to (id, usageDate) sped up usage upserts (which look up by id) but left the percentile
-- UPDATE -- which filters by (usageDate, entityType) with no id -- without a usable index, forcing
-- a full-table scan that grows with history and times out on large catalogs. This supplementary,
-- non-unique index restores the (usageDate, entityType) slice lookup. It deliberately excludes the
-- mutable count columns, so the count-update path optimized by the unique-key reorder is untouched.
-- Plain ALTER: InnoDB ADD INDEX is online + atomic, and the migration runner skips already-applied
-- statements by hash, so re-runs are a no-op without an information_schema pre-check.
ALTER TABLE entity_usage ADD INDEX entity_usage_percentile_idx (usageDate, entityType);

-- Server-side ordering for the ingestion pipeline list (collate#3919).
-- The Name column renders `displayName ?? name`, so the list has to be orderable by that same
-- value; pipelines created from the UI get a machine-generated `name` (Automations use
-- OpenMetadata_application_<random>) that bears no relation to the label the user typed.
-- Not case-folded on purpose: ORDER BY and the keyset-cursor comparison then share the column's
-- own collation (utf8mb4_0900_ai_ci is already case-insensitive), so the cursor value can be
-- carried verbatim in Java. VIRTUAL is indexable and avoids a table rewrite; Postgres uses STORED
-- because it has no VIRTUAL.
-- LEFT(..., 256) is load-bearing, not cosmetic: displayName has no maxLength in the schema, so
-- without it a pre-existing longer value aborts the CREATE INDEX below on upgrade (ERROR 1406) and
-- every later write of one fails the same way. Truncating keeps the column total; ties break on id.
ALTER TABLE ingestion_pipeline_entity
    ADD COLUMN displayNameSort VARCHAR(256)
    GENERATED ALWAYS AS (LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')), ''), JSON_UNQUOTE(JSON_EXTRACT(json, '$.name'))), 256)) VIRTUAL;
CREATE INDEX idx_ingestion_pipeline_display_sort ON ingestion_pipeline_entity (deleted, displayNameSort, id);
