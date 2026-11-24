-- Logical suites select their tables through their test cases.
UPDATE entity_relationship AS relationship
JOIN test_suite AS suite ON suite.id = relationship.fromId
JOIN ingestion_pipeline_entity AS pipeline ON pipeline.id = relationship.toId
SET pipeline.json = JSON_REMOVE(pipeline.json, '$.sourceConfig.config.entityFullyQualifiedName')
WHERE relationship.fromEntity = 'testSuite'
  AND relationship.toEntity = 'ingestionPipeline'
  AND relationship.relation = 0
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(suite.json, '$.basic')), 'false') <> 'true'
  AND JSON_UNQUOTE(JSON_EXTRACT(pipeline.json, '$.pipelineType')) = 'TestSuite'
  AND JSON_CONTAINS_PATH(pipeline.json, 'one', '$.sourceConfig.config.entityFullyQualifiedName');
