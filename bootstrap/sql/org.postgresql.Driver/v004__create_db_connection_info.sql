UPDATE team_entity
SET json = JSONB_SET(json, '{teamType}', '"Department"', true);

ALTER TABLE team_entity
ADD teamType VARCHAR(64) GENERATED ALWAYS AS (json ->> 'teamType') STORED NOT NULL;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}'
where serviceType = 'DynamoDB';

UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,clientId}', json#>'{connection,config,username}')
WHERE serviceType = 'Looker'
  and json#>'{connection,config,username}' is not null;

UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,clientSecret}', json#>'{connection,config,password}')
WHERE serviceType = 'Looker'
  and json#>'{connection,config,password}' is not null;

UPDATE dashboard_service_entity
SET json = json::jsonb #- '{connection,config,username}' #- '{connection,config,password}' #- '{connection,config,env}'
WHERE serviceType = 'Looker';
