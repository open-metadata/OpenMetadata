-- Update BigQuery model for gcpCredentials to move `gcpCredentialsPath` value to `gcpCredentialsPath.path`
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.credentials.gcpCredentialsPath'),
    '$.connection.config.credentials.gcpCredentialsPath.path',
    JSON_EXTRACT(json, '$.connection.config.credentials.gcpCredentialsPath')
) where serviceType in ('BigQuery');