-- MCP Server Governance Tables
-- Version 2.0.0

-- Create mcp_server_entity table for MCP Server governance
CREATE TABLE IF NOT EXISTS mcp_server_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS mcp_server_name_index ON mcp_server_entity(name);
CREATE INDEX IF NOT EXISTS mcp_server_deleted_index ON mcp_server_entity(deleted);

COMMENT ON TABLE mcp_server_entity IS 'MCP Server entities for AI governance';

-- Create mcp_execution_entity table for tracking MCP server executions
CREATE TABLE IF NOT EXISTS mcp_execution_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    serverId VARCHAR(36) GENERATED ALWAYS AS (json->>'serverId') STORED NOT NULL,
    json JSONB NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json->>'timestamp')::bigint) STORED NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS mcp_execution_server_index ON mcp_execution_entity(serverId);
CREATE INDEX IF NOT EXISTS mcp_execution_timestamp_index ON mcp_execution_entity(timestamp);

COMMENT ON TABLE mcp_execution_entity IS 'MCP Server Execution logs';
