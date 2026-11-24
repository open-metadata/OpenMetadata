-- Schema changes for OpenMetadata 2.0.3

-- RDF reindexing runs on one server: Fuseki has a single writer, so partitioning the rebuild
-- across servers added coordination without adding throughput. Its job, partition and
-- per-server stats tables have no remaining reader or writer; rdf_reindex_lock stays and keeps
-- two reindex runs from overlapping.
DROP TABLE IF EXISTS rdf_index_partition;
DROP TABLE IF EXISTS rdf_index_job;
DROP TABLE IF EXISTS rdf_index_server_stats;
-- Column extension keys hash every FQN segment separately and join the hashes with dots.
-- A fourth-level nested table column has eight segments and needs 263 characters.
-- VARCHAR(512) supports eleven column levels after the four-part table FQN while keeping
-- extension usable in the composite primary key; MySQL cannot fully index a TEXT value.
-- The column keeps its character set and collation: changing either makes MySQL copy the whole
-- table and block writes to it, while widening alone is done in place.
-- This block replaces the statement 2.0.3 first shipped, which also switched the column to
-- ascii_bin. Its new text makes it run again where the runner reprocesses 2.0.3; there the column
-- is already 512, so it does nothing and the column stays ascii_bin until #37180 aligns it with
-- its table. The guard stays in SQL, as an exception to
-- ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration, because it replaces this
-- file's statement. The runner retries a guarded block as one unit, per
-- ADR:2026-10-22-mysql-guarded-blocks-run-as-one-migration-unit.
SET @entity_extension_widen_ddl = (
  SELECT IF(
    c.CHARACTER_MAXIMUM_LENGTH < 512,
    CONCAT(
      'ALTER TABLE entity_extension MODIFY COLUMN extension VARCHAR(512) CHARACTER SET ',
      c.CHARACTER_SET_NAME, ' COLLATE ', c.COLLATION_NAME, ' NOT NULL'),
    'SELECT 1'
  )
  FROM information_schema.columns c
  WHERE c.table_schema = DATABASE()
    AND c.table_name = 'entity_extension'
    AND c.column_name = 'extension'
);
PREPARE entity_extension_widen_stmt FROM @entity_extension_widen_ddl;
EXECUTE entity_extension_widen_stmt;
DEALLOCATE PREPARE entity_extension_widen_stmt;
