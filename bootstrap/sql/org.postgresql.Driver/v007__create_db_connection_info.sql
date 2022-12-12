-- Remove markDeletedTablesFromFilterOnly 
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,markDeletedTablesFromFilterOnly}';

UPDATE data_insight_chart
SET json = jsonb_set(
        json,
        '{dimensions}',
        '[{"name":"entityFqn","chartDataType":"STRING"},{"name":"owner","chartDataType":"STRING"},{"name":"owner","entityType":"STRING"}]'
)
WHERE name = 'mostViewedEntities';