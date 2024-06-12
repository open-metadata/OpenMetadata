ALTER TABLE ingestion_pipeline_entity ADD COLUMN appType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.sourceConfig.config.appConfig.type') STORED NULL;
ALTER TABLE ingestion_pipeline_entity ADD COLUMN pipelineType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.pipelineType') STORED NULL;

DELETE FROM event_subscription_entity WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.filteringRules.resources[0]')) = 'testSuite';
