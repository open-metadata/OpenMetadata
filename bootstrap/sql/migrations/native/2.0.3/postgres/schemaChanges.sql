-- Backfill the per-entity `name` index on the remaining reindexable entity tables that were
-- created without one. The distributed reindex paginates every indexed entity type with
-- `... ORDER BY name, id` (EntityRepository.getCursorAtOffset for the partition-boundary cursor,
-- the coordinator boundary walk, and the keyset batch reads). `name` is a generated column derived
-- from `json`, so without a LEADING-`name` index that ORDER BY is a sort that materializes `name`
-- from the `json` blob for every scanned row and can spill / blow past work_mem on large tables
-- (the cost scales with the OFFSET). `<table>_name_index(name)` lets those queries run index-only
-- instead.
--
-- #28888 fixed the covering cursor query and indexed the entity tables it audited, but these
-- searchable entity tables still lacked a leading-`name` index on Postgres — the api_* tables have
-- only a `(deleted, name, id)` composite whose leading `deleted` column cannot serve the unfiltered
-- reindex `ORDER BY name, id`, and the context tables had no name index at all. Tables that already
-- have a `UNIQUE (name)` constraint (e.g. security_service_entity) are omitted — that unique index
-- already orders by name.
CREATE INDEX IF NOT EXISTS api_collection_entity_name_index ON api_collection_entity (name);
CREATE INDEX IF NOT EXISTS api_endpoint_entity_name_index ON api_endpoint_entity (name);
CREATE INDEX IF NOT EXISTS api_service_entity_name_index ON api_service_entity (name);
CREATE INDEX IF NOT EXISTS context_file_name_index ON context_file (name);
CREATE INDEX IF NOT EXISTS context_memory_name_index ON context_memory (name);
