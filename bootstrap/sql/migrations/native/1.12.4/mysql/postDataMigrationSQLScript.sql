UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.threadCount')
WHERE pipelineType = 'profiler'
  AND JSON_EXTRACT(json, '$.sourceConfig.config.threadCount') = 5;
