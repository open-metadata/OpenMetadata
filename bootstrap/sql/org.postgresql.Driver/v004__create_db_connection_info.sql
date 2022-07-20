UPDATE team_entity
SET json = JSONB_SET(json, '{teamType}', '"Department"', true);

ALTER TABLE team_entity
ADD teamType VARCHAR(64) GENERATED ALWAYS AS (json ->> 'teamType') STORED NOT NULL;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}'
where serviceType = 'DynamoDB';
