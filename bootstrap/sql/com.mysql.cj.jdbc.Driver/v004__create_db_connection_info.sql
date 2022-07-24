UPDATE team_entity
SET json = JSON_INSERT(json, '$.teamType', 'Department');

ALTER TABLE team_entity
ADD teamType VARCHAR(64) GENERATED ALWAYS AS (json ->> '$.teamType') NOT NULL;

UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.database')
WHERE serviceType = 'DynamoDB';

UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.connectionOptions')
WHERE serviceType = 'DeltaLake';
