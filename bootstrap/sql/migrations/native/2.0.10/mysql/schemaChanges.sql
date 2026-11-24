CREATE TABLE IF NOT EXISTS sso_test_login_session (
    test_session_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    admin_principal VARCHAR(256) NOT NULL,
    protocol VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    pending_state MEDIUMTEXT,
    result MEDIUMTEXT,
    credentials_submitted_at BIGINT,
    expires_at BIGINT NOT NULL,
    PRIMARY KEY (test_session_id),
    INDEX idx_sso_test_login_session_admin (admin_principal, credentials_submitted_at),
    INDEX idx_sso_test_login_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
