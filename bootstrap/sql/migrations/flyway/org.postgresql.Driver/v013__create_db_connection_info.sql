-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = json::jsonb #- '{openMetadataServerConnection.secretsManagerCredentials}'
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,githubCredentials}', '{connection,config,gitCredentials}', json#>'{connection,config,githubCredentials}')
    where serviceType = 'Looker'
  and json#>'{connection,config,githubCredentials}' is not null;

-- Rename gcsConfig in BigQuery to gcpConfig
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,credentials,gcsConfig}', '{connection,config,credentials,gcpConfig}',
json#>'{connection,config,credentials,gcsConfig}')
where serviceType in ('BigQuery')
  and json#>'{connection,config,credentials,gcsConfig}' is not null;

-- Rename gcsConfig in Datalake to gcpConfig
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,configSource,securityConfig,gcsConfig}', '{connection,config,configSource,securityConfig,gcpConfig}',
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
)
where json#>'{tasks}' is not null;


-- Modify migrations for service connection of postgres and mysql to move password under authType
UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,password}',
'{connection,config,authType}',
jsonb_build_object('password',json#>'{connection,config,password}')
)
WHERE serviceType IN ('Postgres', 'Mysql')
  and json#>'{connection,config,password}' is not null;

-- Clean old test connections
TRUNCATE automations_workflow;

-- Remove sourceUrl in pipeline_entity from DatabricksPipeline & Fivetran
UPDATE pipeline_entity
SET json = json::jsonb #- '{sourceUrl}'
where json #> '{serviceType}' in ('"DatabricksPipeline"','"Fivetran"');


-- Remove sourceUrl in dashboard_entity from Mode
UPDATE dashboard_entity
SET json = json::jsonb #- '{sourceUrl}'
where json #> '{serviceType}' in ('"Mode"');

CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
    installed_rank SERIAL,
    version VARCHAR(256) PRIMARY KEY,
    migrationFileName VARCHAR(256) NOT NULL,
    checksum VARCHAR(256) NOT NULL,
    installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SERVER_MIGRATION_SQL_LOGS (
    version VARCHAR(256) NOT NULL,
    sqlStatement VARCHAR(10000) NOT NULL,
    checksum VARCHAR(256) PRIMARY KEY,
    executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update test definition parameterValues
update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "minValueForMeanInCol", "dataType": "INT", "required": false, "description": "Expected mean value for the column to be greater or equal than", "displayName": "Min", "optionValues": []}, {"name": "maxValueForMeanInCol", "dataType": "INT", "required": false, "description": "Expected mean value for the column to be lower or equal than", "displayName": "Max", "optionValues": []}]'
        )
where name = 'columnValueMeanToBeBetween';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "minValueForMedianInCol", "dataType": "INT", "required": false, "description": "Expected median value for the column to be greater or equal than", "displayName": "Min", "optionValues": []}, {"name": "maxValueForMedianInCol", "dataType": "INT", "required": false, "description": "Expected median value for the column to be lower or equal than", "displayName": "Max", "optionValues": []}]'
        )
where name = 'columnValueMedianToBeBetween';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "minValueForStdDevInCol", "dataType": "INT", "required": false, "description": "Expected std. dev value for the column to be greater or equal than", "displayName": "Min", "optionValues": []}, {"name": "maxValueForStdDevInCol", "dataType": "INT", "required": false, "description": "Expected std. dev value for the column to be lower or equal than", "displayName": "Max", "optionValues": []}]'
        )
where name = 'columnValueStdDevToBeBetween';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "minLength", "dataType": "INT", "required": false, "description": "The {minLength} for the column value. If minLength is not included, maxLength is treated as upperBound and there will be no minimum value length", "displayName": "Min", "optionValues": []}, {"name": "maxLength", "dataType": "INT", "required": false, "description": "The {maxLength} for the column value. if maxLength is not included, minLength is treated as lowerBound and there will be no maximum value length", "displayName": "Max", "optionValues": []}]'
        )
where name = 'columnValueLengthsToBeBetween';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "minValue", "dataType": "INT", "required": false, "description": "The {minValue} value for the column entry. If minValue is not included, maxValue is treated as upperBound and there will be no minimum", "displayName": "Min", "optionValues": []}, {"name": "maxValue", "dataType": "INT", "required": false, "description": "The {maxValue} value for the column entry. if maxValue is not included, minValue is treated as lowerBound and there will be no maximum", "displayName": "Max", "optionValues": []}]'
        )
where name = 'columnValuesToBeBetween';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "columnNames", "dataType": "STRING", "required": true, "description": "Expected columns names of the table to match the ones in {Column Names} -- should be a coma separated string", "displayName": "Column Names", "optionValues": []}, {"name": "ordered", "dataType": "BOOLEAN", "required": false, "description": "Whether or not to considered the order of the list when performing the match check", "displayName": "Ordered", "optionValues": []}]'
        )
where name = 'tableColumnToMatchSet';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name": "minValue", "dataType": "INT", "required": false, "description": "Expected number of columns should be greater than or equal to {minValue}. If minValue is not included, maxValue is treated as upperBound and there will be no minimum", "displayName": "Min", "optionValues": []}, {"name": "maxValue", "dataType": "INT", "required": false, "description": "Expected number of columns should be less than or equal to {maxValue}. If maxValue is not included, minValue is treated as lowerBound and there will be no maximum", "displayName": "Max", "optionValues": []}]'
        )
where name = 'tableRowCountToBeBetween';

update test_definition 
set json = jsonb_set(
        json,
        '{parameterDefinition}',
        '[{"name":"sqlExpression","displayName":"SQL Expression","description":"SQL expression to run against the table","dataType":"STRING","required":"true"},{"name":"strategy","displayName":"Strategy","description":"Strategy to use to run the custom SQL query (i.e. `SELECT COUNT(<col>)` or `SELECT <col> (defaults to ROWS)","dataType":"ARRAY","optionValues":["ROWS","COUNT"],"required":false},{"name":"threshold","displayName":"Threshold","description":"Threshold to use to determine if the test passes or fails (defaults to 0).","dataType":"NUMBER","required":false}]'
        )
where name = 'tableCustomSQLQuery';

-- Modify migrations for service connection of airflow to move password under authType if 
-- Connection Type as Mysql or Postgres

UPDATE pipeline_service_entity
SET json =  jsonb_set(
json #-'{connection,config,connection,password}',
'{connection,config,connection,authType}',
jsonb_build_object('password',json#>'{connection,config,connection,password}')
)
WHERE serviceType = 'Airflow'
and json#>'{connection,config,connection,type}' IN ('"Mysql"', '"Postgres"')
and json#>'{connection,config,connection,password}' is not null;
