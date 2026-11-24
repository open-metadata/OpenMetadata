CREATE TABLE IF NOT EXISTS sso_test_login_session (
    test_session_id VARCHAR(64) NOT NULL PRIMARY KEY,
    admin_principal VARCHAR(256) NOT NULL,
    protocol VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    pending_state TEXT,
    result TEXT,
    credentials_submitted_at BIGINT,
    expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sso_test_login_session_admin
    ON sso_test_login_session (admin_principal, credentials_submitted_at);
CREATE INDEX IF NOT EXISTS idx_sso_test_login_session_expires
    ON sso_test_login_session (expires_at);

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
