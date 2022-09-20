DELETE FROM entity_relationship
WHERE toEntity = 'ingestionPipeline'
AND toId NOT IN (
	SELECT DISTINCT id 
	FROM ingestion_pipeline_entity
);

CREATE TABLE IF NOT EXISTS user_tokens (
    token VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.token') STORED NOT NULL,
    userId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.userId') STORED NOT NULL,
    tokenType VARCHAR(50) GENERATED ALWAYS AS (json ->> '$.tokenType') STORED NOT NULL,
    json JSON NOT NULL,
    expiryDate BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.expiryDate') NOT NULL,
    PRIMARY KEY (token)
);

UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.metastoreHostPort'),
        '$.connection.config.metastoreConnection',
        JSON_OBJECT('metastoreHostPort', JSON_EXTRACT(json, '$.connection.config.metastoreHostPort'))
    )
where serviceType = 'DeltaLake'
  and JSON_EXTRACT(json, '$.connection.config.metastoreHostPort') is not null;

UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.metastoreFilePath'),
        '$.connection.config.metastoreConnection',
        JSON_OBJECT('metastoreFilePath', JSON_EXTRACT(json, '$.connection.config.metastoreFilePath'))
    )
where serviceType = 'DeltaLake'
  and JSON_EXTRACT(json, '$.connection.config.metastoreFilePath') is not null;
