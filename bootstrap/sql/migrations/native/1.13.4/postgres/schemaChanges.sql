-- Add a supporting index for the compute.percentile query on entity_usage. The 1.13 unique-key
-- reorder to (id, usageDate) sped up usage upserts (which look up by id) but left the percentile
-- UPDATE -- which filters by (usageDate, entityType) with no id -- without a usable index, forcing
-- a full-table scan that grows with history and times out on large catalogs. This supplementary
-- index restores the (usageDate, entityType) slice lookup. It deliberately excludes the mutable
-- count columns, so the count-update path optimized by the unique-key reorder is untouched.
-- Built CONCURRENTLY to avoid a write lock on this large, actively-written table.
DROP INDEX CONCURRENTLY IF EXISTS entity_usage_percentile_idx;
CREATE INDEX CONCURRENTLY IF NOT EXISTS entity_usage_percentile_idx ON entity_usage (usageDate, entityType);

-- Server-side ordering for the ingestion pipeline list (collate#3919).
-- The Name column renders `displayName ?? name`, so the list has to be orderable by that same
-- value; pipelines created from the UI get a machine-generated `name` (Automations use
-- OpenMetadata_application_<random>) that bears no relation to the label the user typed.
-- Not case-folded on purpose: ORDER BY and the keyset-cursor comparison then share the column's
-- own collation, so the cursor value can be carried verbatim in Java with no risk of Java and SQL
-- disagreeing on case-folding at a page boundary. Sort-only column, never rendered.
-- left(..., 256) is load-bearing, not cosmetic: displayName has no maxLength in the schema, and a
-- STORED column is materialised for every existing row, so without it a single longer value aborts
-- this ALTER ("value too long for type character varying(256)") and blocks the whole upgrade.
-- Truncating keeps the column total; ties break on id.
ALTER TABLE ingestion_pipeline_entity
    ADD COLUMN IF NOT EXISTS displayNameSort VARCHAR(256)
    GENERATED ALWAYS AS (left(COALESCE(NULLIF(json ->> 'displayName', ''), json ->> 'name'), 256)) STORED;
CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_display_sort ON ingestion_pipeline_entity (deleted, displayNameSort, id);
