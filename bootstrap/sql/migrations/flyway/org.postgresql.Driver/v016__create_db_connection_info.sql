-- Update BigQuery model for gcpCredentials to move `gcpCredentialsPath` value to `gcpCredentialsPath.path`
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,credentials,gcpCredentialsPath}', '{connection,config,credentials,gcpCredentialsPath.path}',
json#>'{connection,config,credentials,gcpCredentialsPath}')
where serviceType in ('BigQuery')
  and json#>'{connection,config,credentials,gcpCredentialsPath}' is not null;