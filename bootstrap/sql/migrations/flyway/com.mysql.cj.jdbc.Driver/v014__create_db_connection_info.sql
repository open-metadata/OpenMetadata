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
WHERE JSON_EXTRACT(json, '$.connection.config.scheme') IN ('impala', 'impala4')
AND serviceType = 'Hive';

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

-- remove keyfile from clickhouse
UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.keyfile')
WHERE serviceType = 'Clickhouse';

-- create app_marketplace
CREATE TABLE IF NOT EXISTS app_marketplace (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
);

-- create installed_applications
CREATE TABLE IF NOT EXISTS installed_application (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
);

-- create app_extension_time_series
CREATE TABLE IF NOT EXISTS app_extension_time_series (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
);

-- Clean old test connections
TRUNCATE automations_workflow;
