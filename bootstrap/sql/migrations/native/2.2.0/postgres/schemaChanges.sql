-- Facts and consumer progress are separate so one target cannot acknowledge another.
CREATE TABLE IF NOT EXISTS metadata_projection_mutation (
    id BIGSERIAL PRIMARY KEY,
    formatVersion INTEGER NOT NULL,
    mutationType VARCHAR(32) NOT NULL,
    entityType VARCHAR(128),
    entityId VARCHAR(36),
    operation VARCHAR(16),
    beforeFqn TEXT,
    afterFqn TEXT,
    beforeFqnHash VARCHAR(768),
    afterFqnHash VARCHAR(768),
    createdAt BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS metadata_projection_consumer (
    mutationId BIGINT NOT NULL,
    target VARCHAR(16) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    cursorValue VARCHAR(2048),
    leaseToken VARCHAR(36),
    leaseUntil BIGINT NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    nextAttemptAt BIGINT NOT NULL DEFAULT 0,
    lastError TEXT,
    PRIMARY KEY (mutationId, target),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);

CREATE INDEX IF NOT EXISTS projection_consumer_pending
    ON metadata_projection_consumer (target, completed, nextAttemptAt, leaseUntil, mutationId);

-- Keep revision state after completion: deleting it would allow an old write to win again.
CREATE TABLE IF NOT EXISTS metadata_projection_work (
    id BIGSERIAL PRIMARY KEY,
    target VARCHAR(16) NOT NULL,
    generation VARCHAR(128) NOT NULL,
    entityType VARCHAR(128) NOT NULL,
    entityId VARCHAR(36) NOT NULL,
    dirtyEpoch BIGINT NOT NULL,
    writeRevision BIGINT NOT NULL DEFAULT 0,
    appliedEpoch BIGINT NOT NULL DEFAULT 0,
    pending BOOLEAN NOT NULL DEFAULT TRUE,
    leaseToken VARCHAR(36),
    leaseUntil BIGINT NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    nextAttemptAt BIGINT NOT NULL DEFAULT 0,
    lastError TEXT,
    uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (target, generation, entityType, entityId)
);

CREATE INDEX IF NOT EXISTS projection_work_pending
    ON metadata_projection_work (target, generation, pending, nextAttemptAt, leaseUntil, id);

CREATE INDEX IF NOT EXISTS projection_locator_before ON metadata_projection_mutation (entityType, beforeFqnHash, entityId);
CREATE INDEX IF NOT EXISTS projection_locator_after ON metadata_projection_mutation (entityType, afterFqnHash, entityId);
CREATE INDEX IF NOT EXISTS projection_entity_history ON metadata_projection_mutation (entityType, entityId, id);

-- A relationship batch retains membership in SQL; expansion reads bounded pages by id.
CREATE TABLE IF NOT EXISTS metadata_projection_relationship (
    id BIGSERIAL PRIMARY KEY,
    mutationId BIGINT NOT NULL,
    fromId VARCHAR(36) NOT NULL,
    toId VARCHAR(36) NOT NULL,
    fromEntity VARCHAR(256) NOT NULL,
    toEntity VARCHAR(256) NOT NULL,
    relation INTEGER NOT NULL,
    relationType VARCHAR(256) NOT NULL,
    relationshipId VARCHAR(36),
    relationshipTypeId VARCHAR(36),
    pipelineId VARCHAR(36),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);
CREATE INDEX IF NOT EXISTS projection_relationship_page
    ON metadata_projection_relationship (mutationId, id);

-- Preserve association locators before glossary/tag cleanup or a prefix rename removes them.
CREATE TABLE IF NOT EXISTS metadata_projection_tag_usage (
    id BIGSERIAL PRIMARY KEY,
    mutationId BIGINT NOT NULL,
    source INTEGER NOT NULL,
    tagFQN VARCHAR(512) NOT NULL,
    tagFQNHash VARCHAR(768),
    targetFQNHash VARCHAR(768),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);
CREATE INDEX IF NOT EXISTS projection_tag_usage_page
    ON metadata_projection_tag_usage (mutationId, id);

-- Retain field dependencies and metadata before cleanup or a prefix rename removes them.
CREATE TABLE IF NOT EXISTS metadata_projection_field_relationship (
    id BIGSERIAL PRIMARY KEY,
    mutationId BIGINT NOT NULL,
    fromFQNHash VARCHAR(768) NOT NULL,
    toFQNHash VARCHAR(768) NOT NULL,
    fromFQN VARCHAR(3072) NOT NULL,
    toFQN VARCHAR(3072) NOT NULL,
    fromType VARCHAR(256) NOT NULL,
    toType VARCHAR(256) NOT NULL,
    relation INTEGER NOT NULL,
    jsonSchema VARCHAR(256),
    json JSONB,
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);
CREATE INDEX IF NOT EXISTS projection_field_relationship_page
    ON metadata_projection_field_relationship (mutationId, id);

-- Cross-entity extension removal retains owner UUIDs without copying extension JSON.
CREATE TABLE IF NOT EXISTS metadata_projection_extension (
    id BIGSERIAL PRIMARY KEY,
    mutationId BIGINT NOT NULL REFERENCES metadata_projection_mutation(id),
    entityId VARCHAR(36) NOT NULL
);
CREATE INDEX IF NOT EXISTS projection_extension_page ON metadata_projection_extension(mutationId, id);

-- Search reindex: entity types rewritten in their live index rather than a staged one, so every
-- server taking part in the job writes those types in place.
ALTER TABLE search_index_job ADD COLUMN IF NOT EXISTS inPlaceIndexMapping JSONB NULL;

-- Search reindex: the keyset cursor each partition starts after, recorded when the job is created.
-- Every server claiming the partition starts at that row; finding it again with OFFSET skips rows
-- once earlier rows are deleted during the run.
ALTER TABLE search_index_partition ADD COLUMN IF NOT EXISTS startCursor TEXT NULL;

-- Search reindex: where live writes for an entity index go while a reindex builds its replacement.
-- Every server reads these rows, so a write handled by any of them reaches the index being built.
-- A row whose owner stops renewing it lapses at leaseExpiresAt.
CREATE TABLE IF NOT EXISTS search_index_write_route (
    canonicalIndex VARCHAR(255) NOT NULL,
    stagedIndex VARCHAR(255) NOT NULL,
    ownerId VARCHAR(255) NOT NULL,
    leaseExpiresAt BIGINT NOT NULL,
    PRIMARY KEY (canonicalIndex)
);

-- Search live indexing: when a failed retry may be claimed again. Each failure doubles the wait, up
-- to an hour, so an overloaded or flapping cluster is retried for about a day before dead-lettering.
ALTER TABLE search_index_retry_queue ADD COLUMN IF NOT EXISTS nextAttemptAt BIGINT NOT NULL DEFAULT 0;
