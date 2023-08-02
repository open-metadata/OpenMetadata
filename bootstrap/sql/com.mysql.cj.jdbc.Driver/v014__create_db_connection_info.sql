-- create domain entity table
CREATE TABLE IF NOT EXISTS domain_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

-- create data product entity table
CREATE TABLE IF NOT EXISTS data_product_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

-- Rename includeTempTables with includeTransTables
UPDATE dbservice_entity
SET json = JSON_REMOVE(
    JSON_SET(
        json,
        '$.connection.config.includeTransientTables',
        JSON_EXTRACT(json, '$.connection.config.includeTempTables')
    ),
    '$.connection.config.includeTempTables'
)
WHERE serviceType in ('Snowflake') AND JSON_EXTRACT(json, '$.connection.config.includeTempTables') IS NOT NULL;

UPDATE dbservice_entity
SET json = JSON_REPLACE(json, '$.connection.config.scheme', 'hive')
WHERE JSON_EXTRACT(json, '$.connection.config.scheme') IN ('impala', 'impala4');

-- remove the dataModel references from Data Models
UPDATE dashboard_data_model_entity
SET json = JSON_REMOVE(json, '$.dataModels');

-- migrate ingestAllDatabases in mssql
UPDATE dbservice_entity de2 
SET json = JSON_REPLACE(
    JSON_INSERT(json, 
      '$.connection.config.database', 
      (select JSON_EXTRACT(json, '$.name') 
        from database_entity de 
        where id = (select er.toId 
            from entity_relationship er 
            where er.fromId = de2.id 
              and er.toEntity = 'database' 
            LIMIT 1
          ))
    ), '$.connection.config.ingestAllDatabases', 
    true
  ) 
where de2.serviceType = 'Mssql' 
  and JSON_EXTRACT(json, '$.connection.config.database') is NULL;

-- column deleted not needed for entities that don't support soft delete
ALTER TABLE query_entity DROP COLUMN deleted;
ALTER TABLE event_subscription_entity DROP COLUMN deleted;

-- remove keyfile from clickhouse
UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.keyfile')
WHERE serviceType = 'Clickhouse';

-- Clean old test connections
TRUNCATE automations_workflow;
