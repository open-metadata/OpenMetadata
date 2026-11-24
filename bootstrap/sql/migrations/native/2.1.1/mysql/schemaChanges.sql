-- The released test_suite table has no index beginning with id.
SET @logical_suite_index_sql = (
    SELECT IF(EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'test_suite'
          AND index_name = 'idx_test_suite_id'
    ), 'SELECT 1', 'CREATE INDEX idx_test_suite_id ON test_suite (id)')
);
PREPARE logical_suite_index_stmt FROM @logical_suite_index_sql;
EXECUTE logical_suite_index_stmt;
DEALLOCATE PREPARE logical_suite_index_stmt;

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
