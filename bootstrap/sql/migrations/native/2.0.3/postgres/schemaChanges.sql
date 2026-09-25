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
-- Keep the width aligned with MySQL: 512 supports eleven column levels after the four-part
-- table FQN.
ALTER TABLE entity_extension ALTER COLUMN extension TYPE VARCHAR(512);
