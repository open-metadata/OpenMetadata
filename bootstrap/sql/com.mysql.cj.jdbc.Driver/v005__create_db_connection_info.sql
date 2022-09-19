DELETE FROM entity_relationship
WHERE toEntity = 'ingestionPipeline'
AND toId NOT IN (
	SELECT DISTINCT id 
	FROM ingestion_pipeline_entity
);