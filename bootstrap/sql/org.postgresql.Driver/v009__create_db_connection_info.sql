-- Unique constraint for user email address
ALTER TABLE user_entity
ADD UNIQUE (email);


-- Remove classificationName in BigQuery
UPDATE dbservice_entity SET json = json #- '{connection,config,classificationName}' where serviceType in ('BigQuery');
drop table alert_entity;
drop table alert_action_def;

CREATE TABLE IF NOT EXISTS event_subscription_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSONB NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);
