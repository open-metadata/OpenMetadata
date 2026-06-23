-- Backfill the per-entity `name` index on the remaining reindexable entity tables that were
-- created without one. The distributed reindex paginates every indexed entity type with
-- `... ORDER BY name, id` (EntityRepository.getCursorAtOffset for the partition-boundary cursor,
-- the coordinator boundary walk, and the keyset batch reads). `name` is a generated column derived
-- from `json`, so without a LEADING-`name` index that ORDER BY is a filesort that materializes
-- `name` from the `json` blob for every scanned row and can exhaust sort memory (ER_OUT_OF_SORTMEMORY,
-- "Out of sort memory, consider increasing server sort buffer size") on large tables (the cost
-- scales with the OFFSET). `<table>_name_index(name)` (InnoDB appends the PK `id`) lets those
-- queries run index-only instead.
--
-- #28888 fixed the covering cursor query and indexed the entity tables it audited, but these
-- searchable entity tables still lacked a leading-`name` index on MySQL — several have only a
-- `(deleted, name, id)` composite whose leading `deleted` column cannot serve the unfiltered
-- reindex `ORDER BY name, id`, and the rest had no name index at all (their Postgres counterparts
-- were indexed but the MySQL migrations diverged). Tables that already have a `UNIQUE (name)`
-- constraint (e.g. security_service_entity) are omitted — that unique index already orders by name.
CREATE INDEX api_collection_entity_name_index ON api_collection_entity (name);
CREATE INDEX api_endpoint_entity_name_index ON api_endpoint_entity (name);
CREATE INDEX api_service_entity_name_index ON api_service_entity (name);
CREATE INDEX context_file_name_index ON context_file (name);
CREATE INDEX context_memory_name_index ON context_memory (name);
CREATE INDEX data_product_entity_name_index ON data_product_entity (name);
CREATE INDEX domain_entity_name_index ON domain_entity (name);
CREATE INDEX search_index_entity_name_index ON search_index_entity (name);
CREATE INDEX search_service_entity_name_index ON search_service_entity (name);
CREATE INDEX stored_procedure_entity_name_index ON stored_procedure_entity (name);
