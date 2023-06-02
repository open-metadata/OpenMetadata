-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection.secretsManagerCredentials')
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.githubCredentials'),
        '$.connection.config.gitCredentials',
        JSON_EXTRACT(json, '$.connection.config.githubCredentials')
    )
WHERE serviceType = 'Looker'
  AND JSON_EXTRACT(json, '$.connection.config.githubCredentials') IS NOT NULL;
