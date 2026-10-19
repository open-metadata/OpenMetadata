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
ALTER TABLE entity_extension
  MODIFY COLUMN extension VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
