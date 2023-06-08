-- use FQN instead of name for Test Connection Definition
ALTER TABLE test_connection_definition
ADD fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
DROP COLUMN name;
