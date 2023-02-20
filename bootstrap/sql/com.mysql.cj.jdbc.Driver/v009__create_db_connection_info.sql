-- Unique constraint for user email address
ALTER TABLE user_entity
ADD UNIQUE (email);


-- Remove classificationName in BigQuery
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,classificationName}', 'null', false)
where serviceType in ('BigQuery') and json#>'{connection,config,classificationName}' is not null;
