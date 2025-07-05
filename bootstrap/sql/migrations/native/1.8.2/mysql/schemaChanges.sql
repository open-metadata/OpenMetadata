CREATE INDEX idx_thread_type_resolved_createdAt ON thread_entity(type, resolved, createdAt DESC);
CREATE INDEX idx_thread_entity_entityId ON thread_entity(entityId);

CREATE INDEX idx_thread_entity_type_announcementDates ON thread_entity(type, announcementStart, announcementEnd);
CREATE INDEX idx_thread_entity_createdBy_type ON thread_entity(createdBy, type);
CREATE INDEX idx_thread_entity_type_taskStatus_createdAt ON thread_entity(type, taskStatus, createdAt DESC);
DROP INDEX  thread_type_index on thread_entity;
DROP INDEX  updated_at_index on thread_entity;
CREATE INDEX idx_table_entity_deleted_fqnHash ON table_entity(deleted, fqnHash);
CREATE INDEX idx_table_entity_name_id ON table_entity(name, id);

CREATE INDEX idx_dashboard_entity_deleted_name_id ON dashboard_entity(deleted, name, id);
DROP INDEX index_dashboard_entity_deleted on dashboard_entity;

CREATE INDEX idx_pipeline_entity_deleted_name_id ON pipeline_entity(deleted, name, id);
DROP INDEX index_pipeline_entity_deleted ON pipeline_entity;

CREATE INDEX idx_chart_entity_deleted_name_id ON chart_entity(deleted, name, id);
DROP INDEX index_chart_entity_deleted on chart_entity;

CREATE INDEX idx_topic_entity_deleted_name_id ON topic_entity(deleted, name, id);
DROP INDEX index_topic_entity_deleted on topic_entity;

CREATE INDEX idx_ml_model_entity_deleted_name_id ON ml_model_entity(deleted, name, id);
DROP INDEX index_ml_model_entity_deleted on ml_model_entity;

CREATE INDEX idx_storage_container_entity_deleted_name_id ON storage_container_entity(deleted, name, id);
DROP INDEX index_storage_container_entity_deleted ON storage_container_entity;

CREATE INDEX idx_database_entity_deleted_name_id ON database_entity(deleted, name, id);
DROP INDEX index_database_entity_deleted ON database_entity;

CREATE INDEX idx_database_schema_entity_deleted_name_id ON database_schema_entity(deleted, name, id);
DROP INDEX index_database_schema_entity_deleted ON database_schema_entity;

CREATE INDEX idx_glossary_term_entity_deleted_name_id ON glossary_term_entity(deleted, name, id);
DROP INDEX index_glossary_term_entity_deleted ON glossary_term_entity;

CREATE INDEX idx_metric_entity_deleted_name_id ON metric_entity(deleted, name, id);
DROP INDEX index_metric_entity_deleted on metric_entity;

CREATE INDEX idx_report_entity_deleted_name_id ON report_entity(deleted, name, id);
DROP INDEX index_report_entity_deleted ON report_entity;

CREATE INDEX idx_stored_procedure_entity_deleted_name_id ON stored_procedure_entity(deleted, name, id);
DROP INDEX index_stored_procedure_entity_deleted ON stored_procedure_entity;

CREATE INDEX idx_search_index_entity_deleted_name_id ON search_index_entity(deleted, name, id);
DROP INDEX index_search_index_entity_deleted ON search_index_entity;

CREATE INDEX idx_api_endpoint_entity_deleted_name_id ON api_endpoint_entity(deleted, name, id);

CREATE INDEX idx_api_collection_entity_deleted_name_id ON api_collection_entity(deleted, name, id);

CREATE INDEX idx_dashboard_data_model_entity_deleted_name_id ON dashboard_data_model_entity(deleted, name, id);
DROP INDEX index_dashboard_data_model_entity_deleted ON dashboard_data_model_entity;

CREATE INDEX idx_dbservice_entity_deleted_name ON dbservice_entity(deleted, name);
DROP INDEX index_dbservice_entity_deleted ON dbservice_entity;

CREATE INDEX idx_dashboard_service_entity_deleted_name ON dashboard_service_entity(deleted, name);
DROP INDEX index_dashboard_service_entity_deleted ON dashboard_service_entity;

CREATE INDEX idx_messaging_service_entity_deleted_name ON messaging_service_entity(deleted, name);
DROP INDEX index_messaging_service_entity_deleted ON messaging_service_entity;

CREATE INDEX idx_metadata_service_entity_deleted_name ON metadata_service_entity(deleted, name);
DROP INDEX index_metadata_service_entity_deleted ON metadata_service_entity;

CREATE INDEX idx_mlmodel_service_entity_deleted_name ON mlmodel_service_entity(deleted, name);
DROP INDEX index_mlmodel_service_entity_deleted ON mlmodel_service_entity;

CREATE INDEX idx_pipeline_service_entity_deleted_name ON pipeline_service_entity(deleted, name);
DROP INDEX index_pipeline_service_entity_deleted ON pipeline_service_entity;

CREATE INDEX idx_storage_service_entity_deleted_name ON storage_service_entity(deleted, name);
DROP INDEX index_storage_service_entity_deleted ON storage_service_entity;

CREATE INDEX idx_search_service_entity_deleted_name ON search_service_entity(deleted, name);
DROP INDEX index_search_service_entity_deleted ON search_service_entity;

CREATE INDEX idx_api_service_entity_deleted_name ON api_service_entity(deleted, name);

CREATE INDEX idx_team_entity_deleted_name ON team_entity(deleted, name);
DROP INDEX index_team_entity_deleted ON team_entity;

CREATE INDEX idx_role_entity_deleted_name ON role_entity(deleted, name);
DROP INDEX index_role_entity_deleted ON role_entity;

CREATE INDEX idx_policy_entity_deleted_name_id ON policy_entity(deleted, name, id);
DROP INDEX index_policy_entity_deleted ON policy_entity;

CREATE INDEX idx_user_entity_deleted_name ON user_entity(deleted, name);
DROP INDEX index_user_entity_deleted ON user_entity;

CREATE INDEX idx_glossary_entity_deleted_name ON glossary_entity(deleted, name);
DROP INDEX index_glossary_entity_deleted ON glossary_entity;

CREATE INDEX idx_bot_entity_deleted_name ON bot_entity(deleted, name);
DROP INDEX index_bot_entity_deleted ON bot_entity;

CREATE INDEX idx_kpi_entity_deleted_name ON kpi_entity(deleted, name);
DROP INDEX index_kpi_entity_deleted ON kpi_entity;

CREATE INDEX idx_ingestion_pipeline_entity_deleted_name_id ON ingestion_pipeline_entity(deleted, name, id);
DROP INDEX index_ingestion_pipeline_entity_deleted ON ingestion_pipeline_entity;

CREATE INDEX idx_data_contract_entity_deleted_name_id ON data_contract_entity(deleted, name, id);
DROP INDEX index_data_contract_entity_deleted ON data_contract_entity;
