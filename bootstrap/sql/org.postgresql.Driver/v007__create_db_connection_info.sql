-- Remove markDeletedTablesFromFilterOnly 
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,markDeletedTablesFromFilterOnly}';

UPDATE data_insight_chart
SET json = jsonb_set(
        json,
        '{dimensions}',
        '[{"name":"entityFqn","chartDataType":"STRING"},{"name":"entityType","chartDataType":"STRING"},{"name":"owner","chartDataType":"STRING"},{"name":"entityHref","chartDataType":"STRING"}]'
)
WHERE name = 'mostViewedEntities';

DROP TABLE webhook_entity;

CREATE TABLE IF NOT EXISTS alert_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSONB NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS alert_action_def (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    alertActionType VARCHAR(36) GENERATED ALWAYS AS (json ->> 'alertActionType') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSONB NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);