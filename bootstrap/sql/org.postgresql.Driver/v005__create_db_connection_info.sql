DELETE FROM entity_relationship
WHERE toEntity = 'ingestionPipeline'
AND toId NOT IN (
	SELECT DISTINCT id 
	FROM ingestion_pipeline_entity
);

CREATE TABLE IF NOT EXISTS user_tokens (
    token VARCHAR(36) GENERATED ALWAYS AS (json ->> 'token') STORED NOT NULL,
    userId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'userId') STORED NOT NULL,
    tokenType VARCHAR(50) GENERATED ALWAYS AS (json ->> 'tokenType') STORED NOT NULL,
    json JSONB NOT NULL,
    expiryDate BIGINT GENERATED ALWAYS AS ((json ->> 'expiryDate')::bigint) STORED NOT NULL,
    PRIMARY KEY (token)
);