-- Remove markDeletedTablesFromFilterOnly 
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json ,'$.sourceConfig.config.markDeletedTablesFromFilterOnly');

UPDATE data_insight_chart 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.dimensions'),
	'$.dimensions',
	JSON_ARRAY(
		JSON_OBJECT('name', 'entityFqn', 'chartDataType', 'STRING'),
		JSON_OBJECT('name', 'owner', 'chartDataType', 'STRING'),
		JSON_OBJECT('name', 'entityType', 'chartDataType', 'STRING')
		)
)
WHERE name = 'mostViewedEntities';