-- =====================================================
-- THREAD_ENTITY OPTIMIZATIONS
-- =====================================================

-- Optimization 1: Add index for thread_entity to optimize queries filtering by type, resolved and ordering by createdAt
-- This fixes the "Out of sort memory" error for conversation queries
CREATE INDEX idx_thread_type_resolved_createdAt ON thread_entity(type, resolved, createdAt DESC);

-- Optimization 2: Add index for entityId lookups (many queries filter by entityId alone)
CREATE INDEX idx_thread_entity_entityId ON thread_entity(entityId);

-- Optimization 3: Add generated columns for frequently accessed JSON fields (announcement dates)
-- This improves performance for announcement overlap queries
ALTER TABLE thread_entity 
ADD COLUMN announcementStart BIGINT GENERATED ALWAYS AS (CAST(JSON_EXTRACT(json, '$.announcement.startTime') AS UNSIGNED)) STORED,
ADD COLUMN announcementEnd BIGINT GENERATED ALWAYS AS (CAST(JSON_EXTRACT(json, '$.announcement.endTime') AS UNSIGNED)) STORED;

-- Optimization 4: Add index for announcement date range queries
CREATE INDEX idx_thread_entity_type_announcementDates ON thread_entity(type, announcementStart, announcementEnd);

-- Optimization 5: Add index for createdBy + type combination queries
CREATE INDEX idx_thread_entity_createdBy_type ON thread_entity(createdBy, type);

-- Optimization 6: Add composite index for task status queries with ordering
CREATE INDEX idx_thread_entity_type_taskStatus_createdAt ON thread_entity(type, taskStatus, createdAt DESC);

-- Optimization 7: Remove redundant indexes
-- thread_type_index is redundant with thread_type_resolved_updatedAt_index
DROP INDEX IF EXISTS thread_type_index;

-- updated_at_index is redundant with thread_type_resolved_updatedAt_index
DROP INDEX IF EXISTS updated_at_index;

-- Note: Keeping created_at_index as some queries may still benefit from it

-- =====================================================
-- TABLE_ENTITY OPTIMIZATIONS
-- =====================================================

-- Fix "Out of sort memory" error for table_entity pagination queries
-- Split the composite index to handle LIKE queries better
-- Index 1: For queries filtering by deleted and using fqnHash LIKE pattern
CREATE INDEX idx_table_entity_deleted_fqnHash ON table_entity(deleted, fqnHash);

-- Index 2: For efficient sorting after filtering
CREATE INDEX idx_table_entity_name_id ON table_entity(name, id);

-- Drop redundant indexes
DROP INDEX IF EXISTS index_table_entity_deleted;
DROP INDEX IF EXISTS idx_table_entity_deleted_fqnHash_name_id;
DROP INDEX IF EXISTS idx_table_entity_deleted_name;

CREATE INDEX idx_dashboard_entity_deleted_name_id ON dashboard_entity(deleted, name, id);
DROP INDEX IF EXISTS index_dashboard_entity_deleted;

CREATE INDEX idx_pipeline_entity_deleted_name_id ON pipeline_entity(deleted, name, id);
DROP INDEX IF EXISTS index_pipeline_entity_deleted;

CREATE INDEX idx_chart_entity_deleted_name_id ON chart_entity(deleted, name, id);
DROP INDEX IF EXISTS index_chart_entity_deleted;

CREATE INDEX idx_topic_entity_deleted_name_id ON topic_entity(deleted, name, id);
DROP INDEX IF EXISTS index_topic_entity_deleted;

CREATE INDEX idx_ml_model_entity_deleted_name_id ON ml_model_entity(deleted, name, id);
DROP INDEX IF EXISTS index_ml_model_entity_deleted;

CREATE INDEX idx_storage_container_entity_deleted_name_id ON storage_container_entity(deleted, name, id);
DROP INDEX IF EXISTS index_storage_container_entity_deleted;

CREATE INDEX idx_database_entity_deleted_name_id ON database_entity(deleted, name, id);
DROP INDEX IF EXISTS index_database_entity_deleted;

CREATE INDEX idx_database_schema_entity_deleted_name_id ON database_schema_entity(deleted, name, id);
DROP INDEX IF EXISTS index_database_schema_entity_deleted;

CREATE INDEX idx_glossary_term_entity_deleted_name_id ON glossary_term_entity(deleted, name, id);
DROP INDEX IF EXISTS index_glossary_term_entity_deleted;

CREATE INDEX idx_metric_entity_deleted_name_id ON metric_entity(deleted, name, id);
DROP INDEX IF EXISTS index_metric_entity_deleted;

CREATE INDEX idx_report_entity_deleted_name_id ON report_entity(deleted, name, id);
DROP INDEX IF EXISTS index_report_entity_deleted;

CREATE INDEX idx_stored_procedure_entity_deleted_name_id ON stored_procedure_entity(deleted, name, id);
DROP INDEX IF EXISTS index_stored_procedure_entity_deleted;

CREATE INDEX idx_search_index_entity_deleted_name_id ON search_index_entity(deleted, name, id);
DROP INDEX IF EXISTS index_search_index_entity_deleted;

CREATE INDEX idx_api_endpoint_entity_deleted_name_id ON api_endpoint_entity(deleted, name, id);

CREATE INDEX idx_api_collection_entity_deleted_name_id ON api_collection_entity(deleted, name, id);

CREATE INDEX idx_dashboard_data_model_entity_deleted_name_id ON dashboard_data_model_entity(deleted, name, id);
DROP INDEX IF EXISTS index_dashboard_data_model_entity_deleted;

CREATE INDEX idx_dbservice_entity_deleted_name ON dbservice_entity(deleted, name);
DROP INDEX IF EXISTS index_dbservice_entity_deleted;

CREATE INDEX idx_dashboard_service_entity_deleted_name ON dashboard_service_entity(deleted, name);
DROP INDEX IF EXISTS index_dashboard_service_entity_deleted;

CREATE INDEX idx_messaging_service_entity_deleted_name ON messaging_service_entity(deleted, name);
DROP INDEX IF EXISTS index_messaging_service_entity_deleted;

CREATE INDEX idx_metadata_service_entity_deleted_name ON metadata_service_entity(deleted, name);
DROP INDEX IF EXISTS index_metadata_service_entity_deleted;

CREATE INDEX idx_mlmodel_service_entity_deleted_name ON mlmodel_service_entity(deleted, name);
DROP INDEX IF EXISTS index_mlmodel_service_entity_deleted;

CREATE INDEX idx_pipeline_service_entity_deleted_name ON pipeline_service_entity(deleted, name);
DROP INDEX IF EXISTS index_pipeline_service_entity_deleted;

CREATE INDEX idx_storage_service_entity_deleted_name ON storage_service_entity(deleted, name);
DROP INDEX IF EXISTS index_storage_service_entity_deleted;

CREATE INDEX idx_search_service_entity_deleted_name ON search_service_entity(deleted, name);
DROP INDEX IF EXISTS index_search_service_entity_deleted;

CREATE INDEX idx_api_service_entity_deleted_name ON api_service_entity(deleted, name);

CREATE INDEX idx_team_entity_deleted_name ON team_entity(deleted, name);
DROP INDEX IF EXISTS index_team_entity_deleted;

CREATE INDEX idx_role_entity_deleted_name ON role_entity(deleted, name);
DROP INDEX IF EXISTS index_role_entity_deleted;

CREATE INDEX idx_policy_entity_deleted_name_id ON policy_entity(deleted, name, id);
DROP INDEX IF EXISTS index_policy_entity_deleted;

CREATE INDEX idx_user_entity_deleted_name ON user_entity(deleted, name);
DROP INDEX IF EXISTS index_user_entity_deleted;

CREATE INDEX idx_glossary_entity_deleted_name ON glossary_entity(deleted, name);
DROP INDEX IF EXISTS index_glossary_entity_deleted;

CREATE INDEX idx_bot_entity_deleted_name ON bot_entity(deleted, name);
DROP INDEX IF EXISTS index_bot_entity_deleted;

CREATE INDEX idx_kpi_entity_deleted_name ON kpi_entity(deleted, name);
DROP INDEX IF EXISTS index_kpi_entity_deleted;

CREATE INDEX idx_ingestion_pipeline_entity_deleted_name_id ON ingestion_pipeline_entity(deleted, name, id);
DROP INDEX IF EXISTS index_ingestion_pipeline_entity_deleted;

CREATE INDEX idx_data_contract_entity_deleted_name_id ON data_contract_entity(deleted, name, id);
DROP INDEX IF EXISTS index_data_contract_entity_deleted;

CREATE INDEX idx_query_entity_deleted_checksum ON query_entity(deleted, checksum);