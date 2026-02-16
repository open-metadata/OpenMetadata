-- Task System Redesign - OpenMetadata 2.0.0
-- This migration creates the new Task entity tables and related infrastructure

CREATE TABLE IF NOT EXISTS task_entity (
    id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    fqnhash character varying(768) NOT NULL,
    taskid character varying(20) GENERATED ALWAYS AS ((json ->> 'taskId'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    category character varying(32) GENERATED ALWAYS AS ((json ->> 'category'::text)) STORED NOT NULL,
    type character varying(64) GENERATED ALWAYS AS ((json ->> 'type'::text)) STORED NOT NULL,
    status character varying(32) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED NOT NULL,
    priority character varying(16) GENERATED ALWAYS AS (COALESCE((json ->> 'priority'::text), 'Medium'::text)) STORED,
    createdat bigint GENERATED ALWAYS AS (((json ->> 'createdAt'::text))::bigint) STORED NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    aboutfqnhash character varying(256) GENERATED ALWAYS AS ((json ->> 'aboutFqnHash'::text)) STORED,
    PRIMARY KEY (id),
    CONSTRAINT uk_task_fqn_hash UNIQUE (fqnhash)
);

CREATE INDEX IF NOT EXISTS idx_task_taskid ON task_entity (taskid);
CREATE INDEX IF NOT EXISTS idx_task_status ON task_entity (status);
CREATE INDEX IF NOT EXISTS idx_task_category ON task_entity (category);
CREATE INDEX IF NOT EXISTS idx_task_type ON task_entity (type);
CREATE INDEX IF NOT EXISTS idx_task_priority ON task_entity (priority);
CREATE INDEX IF NOT EXISTS idx_task_createdat ON task_entity (createdat);
CREATE INDEX IF NOT EXISTS idx_task_updatedat ON task_entity (updatedat);
CREATE INDEX IF NOT EXISTS idx_task_deleted ON task_entity (deleted);
CREATE INDEX IF NOT EXISTS idx_task_status_category ON task_entity (status, category);
CREATE INDEX IF NOT EXISTS idx_task_about_fqn_hash ON task_entity (aboutfqnhash);
CREATE INDEX IF NOT EXISTS idx_task_status_about ON task_entity (status, aboutfqnhash);

CREATE TABLE IF NOT EXISTS new_task_sequence (
    id bigint NOT NULL DEFAULT 0
);

INSERT INTO new_task_sequence (id) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM new_task_sequence);

-- =====================================================
-- ACTIVITY STREAM TABLE (Partitioned by time)
-- Lightweight, ephemeral activity notifications
-- NOT for audit/compliance - use entity version history
-- Partitions are managed dynamically by ActivityStreamPartitionManager
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_stream (
    id character varying(36) NOT NULL,
    eventtype character varying(64) NOT NULL,
    entitytype character varying(64) NOT NULL,
    entityid character varying(36) NOT NULL,
    entityfqnhash character varying(768),
    about character varying(2048),
    aboutfqnhash character varying(768),
    actorid character varying(36) NOT NULL,
    actorname character varying(256),
    timestamp bigint NOT NULL,
    summary character varying(500),
    fieldname character varying(256),
    oldvalue text,
    newvalue text,
    domains jsonb,
    json jsonb NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Default partition catches all data until monthly partitions are created
-- ActivityStreamPartitionManager will create monthly partitions and detach old ones
CREATE TABLE IF NOT EXISTS activity_stream_default PARTITION OF activity_stream DEFAULT;

-- Indexes for activity stream (created on parent, inherited by partitions)
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_stream (timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_stream (entitytype, entityid, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_stream (actorid, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_event_type ON activity_stream (eventtype, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_entity_fqn ON activity_stream (entityfqnhash, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_about ON activity_stream (aboutfqnhash, timestamp);

-- Activity stream configuration per domain
CREATE TABLE IF NOT EXISTS activity_stream_config (
    id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    scope character varying(32) GENERATED ALWAYS AS ((json ->> 'scope'::text)) STORED NOT NULL,
    domainid character varying(36) GENERATED ALWAYS AS ((json -> 'scopeReference' ->> 'id'::text)) STORED,
    enabled boolean GENERATED ALWAYS AS (((json ->> 'enabled'::text))::boolean) STORED,
    retentiondays integer GENERATED ALWAYS AS (((json ->> 'retentionDays'::text))::integer) STORED,
    PRIMARY KEY (id),
    CONSTRAINT uk_activity_domain_config UNIQUE (domainid)
);

CREATE INDEX IF NOT EXISTS idx_activity_config_scope ON activity_stream_config (scope);
CREATE INDEX IF NOT EXISTS idx_activity_config_enabled ON activity_stream_config (enabled);
