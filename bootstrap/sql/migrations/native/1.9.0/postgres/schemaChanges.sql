-- Migrate domain to domains in all entity tables that had singular domain
-- Using the correct table names from existing migrations
UPDATE api_collection_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE api_endpoint_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE api_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE chart_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dashboard_data_model_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dashboard_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dashboard_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE database_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE database_schema_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dbservice_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE glossary_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE glossary_term_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE ingestion_pipeline_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE messaging_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE metadata_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE metric_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE ml_model_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE mlmodel_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE persona_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE pipeline_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE pipeline_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE query_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE report_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE search_index_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE search_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE storage_container_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE storage_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE stored_procedure_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE table_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE topic_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;

-- Note: user_entity and team_entity already had domains array, so they are not migrated

-- Clean old test connections
TRUNCATE automations_workflow;