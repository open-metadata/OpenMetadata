-- Schema changes for OpenMetadata 2.0.3

-- RDF reindexing runs on one server: Fuseki has a single writer, so partitioning the rebuild
-- across servers added coordination without adding throughput. Its job, partition and
-- per-server stats tables have no remaining reader or writer; rdf_reindex_lock stays and keeps
-- two reindex runs from overlapping.
DROP TABLE IF EXISTS rdf_index_partition;
DROP TABLE IF EXISTS rdf_index_job;
DROP TABLE IF EXISTS rdf_index_server_stats;
