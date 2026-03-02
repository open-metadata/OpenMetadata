UPDATE ingestion_pipeline_entity
SET json = json #- '{sourceConfig,config,computeMetrics}'
WHERE json -> 'sourceConfig' -> 'config' -> 'computeMetrics' IS NOT NULL
AND pipelineType = 'profiler';
