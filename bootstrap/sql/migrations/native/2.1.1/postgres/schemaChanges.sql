-- The released test_suite table has no index beginning with id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_suite_id ON test_suite (id);

-- Logical suites select their tables through their test cases.
UPDATE ingestion_pipeline_entity AS pipeline
SET json = pipeline.json::jsonb #- '{sourceConfig,config,entityFullyQualifiedName}'
FROM entity_relationship AS relationship
JOIN test_suite AS suite ON suite.id = relationship.fromId
WHERE pipeline.id = relationship.toId
  AND relationship.fromEntity = 'testSuite'
  AND relationship.toEntity = 'ingestionPipeline'
  AND relationship.relation = 0
  AND (suite.json ->> 'basic') IS DISTINCT FROM 'true'
  AND pipeline.json ->> 'pipelineType' = 'TestSuite'
  AND pipeline.json::jsonb #> '{sourceConfig,config,entityFullyQualifiedName}' IS NOT NULL;
