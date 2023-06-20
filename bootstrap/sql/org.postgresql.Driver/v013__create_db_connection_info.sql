-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = json::jsonb #- '{openMetadataServerConnection.secretsManagerCredentials}'
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,gitCredentials}', json#>'{connection,config,githubCredentials}')
    where serviceType = 'Looker'
  and json#>'{connection,config,githubCredentials}' is not null;

-- Rename gcsConfig in BigQuery to gcpConfig
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,credentials,gcpConfig}',
json#>'{connection,config,credentials,gcsConfig}')
where serviceType in ('BigQuery')
  and json#>'{connection,config,credentials,gcsConfig}' is not null;

-- Rename gcsConfig in Datalake to gcpConfig
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,configSource,securityConfig,gcpConfig}',
json#>'{connection,config,configSource,securityConfig,gcsConfig}')
where serviceType in ('Datalake')
  and json#>'{connection,config,configSource,securityConfig,gcsConfig}' is not null;

-- Rename gcsConfig in dbt to gcpConfig
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(json::jsonb #- '{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}', '{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcpConfig}', (json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}')::jsonb)
WHERE json#>>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig}' is not null and json#>>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}' is not null;


-- Rename dashboardUrl in dashboard_entity to sourceUrl
UPDATE dashboard_entity
SET json = jsonb_set(json::jsonb #- '{dashboardUrl}' , '{sourceUrl}',
json#>'{dashboardUrl}')
where json#>'{dashboardUrl}' is not null;

-- Rename chartUrl in chart_entity to sourceUr
UPDATE chart_entity
SET json = jsonb_set(json::jsonb #- '{chartUrl}' , '{sourceUrl}',
json#>'{chartUrl}')
where json#>'{chartUrl}' is not null;

-- Rename pipelineUrl in pipeline_entity to sourceUrl
UPDATE pipeline_entity
SET json = jsonb_set(json::jsonb #- '{pipelineUrl}' , '{sourceUrl}',
json#>'{pipelineUrl}')
where json#>'{pipelineUrl}' is not null;


-- Rename taskUrl in pipeline_entity to sourceUrl
UPDATE pipeline_entity
SET json = jsonb_set(
    json::jsonb - 'tasks',
    '{tasks}',
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'name', t ->> 'name',
                'sourceUrl', t ->> 'taskUrl',
                'taskType', t ->> 'taskType',
                'description', t ->> 'description',
                'displayName', t ->> 'displayName',
                'fullyQualifiedName', t ->> 'fullyQualifiedName',
                'downstreamTasks', (t -> 'downstreamTasks')::jsonb,
                'tags', (t ->> 'tags')::jsonb,
                'endDate', t ->> 'endDate',
                'startDate', t ->> 'startDate',
                'taskSQL', t ->> 'taskSQL'
            )
        )
        FROM jsonb_array_elements(json->'tasks') AS t
    )
);


-- Modify migrations for service connection of postgres and mysql to move password under authType
UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,password}',
'{connection,config,authType}',
jsonb_build_object('password',json#>'{connection,config,password}')
)
WHERE serviceType IN ('Postgres', 'Mysql')
  and json#>'{connection,config,password}' is not null;

DROP INDEX field_relationship_from_index, field_relationship_to_index;
ALTER TABLE field_relationship DROP CONSTRAINT field_relationship_pkey, ADD COLUMN fromFQNHash VARCHAR(256), ADD COLUMN toFQNHash VARCHAR(256),
     ADD CONSTRAINT  field_relationship_pkey PRIMARY KEY(fromFQNHash, toFQNHash, relation),
ALTER fromFQN TYPE VARCHAR(2096), ALTER toFQN TYPE VARCHAR(2096);
CREATE INDEX IF NOT EXISTS field_relationship_from_index ON field_relationship(fromFQNHash, relation);
CREATE INDEX IF NOT EXISTS field_relationship_to_index ON field_relationship(toFQNHash, relation);

ALTER TABLE entity_extension_time_series DROP COLUMN entityFQN, ADD COLUMN entityFQNHash VARCHAR (256) NOT NULL;

ALTER TABLE type_entity DROP CONSTRAINT type_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE event_subscription_entity DROP CONSTRAINT event_subscription_entity_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE test_definition DROP CONSTRAINT test_definition_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_suite DROP CONSTRAINT test_suite_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_case DROP COLUMN fullyQualifiedName,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
     ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);

ALTER TABLE web_analytic_event DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);
ALTER TABLE data_insight_chart DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);
ALTER TABLE kpi_entity  DROP CONSTRAINT kpi_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE classification  DROP CONSTRAINT tag_category_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);;

ALTER TABLE glossary_term_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE tag DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE tag_usage DROP CONSTRAINT tag_usage_source_tagfqn_targetfqn_key, DROP COLUMN targetFQN, ADD COLUMN tagFQNHash VARCHAR(256), ADD COLUMN targetFQNHash VARCHAR(256),
     ADD UNIQUE (source, tagFQNHash, targetFQNHash);

ALTER TABLE policy_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE role_entity DROP CONSTRAINT role_entity_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE automations_workflow DROP CONSTRAINT automations_workflow_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_connection_definition  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash),
    ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;


-- update services
ALTER TABLE dbservice_entity DROP CONSTRAINT dbservice_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE messaging_service_entity DROP CONSTRAINT messaging_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE dashboard_service_entity DROP CONSTRAINT dashboard_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE pipeline_service_entity DROP CONSTRAINT pipeline_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE storage_service_entity DROP CONSTRAINT storage_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE metadata_service_entity DROP CONSTRAINT metadata_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE mlmodel_service_entity DROP CONSTRAINT mlmodel_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);


-- all entity tables
ALTER TABLE database_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE database_schema_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE metric_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE report_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE ml_model_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE pipeline_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE topic_entity  DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE storage_container_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE dashboard_data_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE query_entity  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE team_entity DROP CONSTRAINT team_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE user_entity DROP CONSTRAINT user_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE bot_entity DROP CONSTRAINT bot_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE glossary_entity DROP CONSTRAINT glossary_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

-- Remove sourceUrl in pipeline_entity from DatabricksPipeline & Fivetran
UPDATE pipeline_entity
SET json = json::jsonb #- '{sourceUrl}'
where json #> '{serviceType}' in ('"DatabricksPipeline"','"Fivetran"');


-- Remove sourceUrl in dashboard_entity from Mode
UPDATE dashboard_entity
SET json = json::jsonb #- '{sourceUrl}'
where json #> '{serviceType}' in ('"Mode"');
