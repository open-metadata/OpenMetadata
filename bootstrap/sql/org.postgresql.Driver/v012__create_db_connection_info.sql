-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = json::jsonb #- '{openMetadataServerConnection.secretsManagerCredentials}'
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,gitCredentials}', json#>'{connection,config,githubCredentials}')
    where serviceType = 'Looker'
  and json#>'{connection,config,githubCredentials}' is not null;

-- use FQN instead of name for Test Connection Definition
ALTER TABLE test_connection_definition
ADD fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
DROP COLUMN name;
