-- Facts and consumer progress are separate so one target cannot acknowledge another.
CREATE TABLE IF NOT EXISTS metadata_projection_mutation (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    formatVersion INTEGER NOT NULL,
    mutationType VARCHAR(32) NOT NULL,
    entityType VARCHAR(128),
    entityId VARCHAR(36),
    operation VARCHAR(16),
    beforeFqn MEDIUMTEXT,
    afterFqn MEDIUMTEXT,
    beforeFqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin,
    afterFqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin,
    createdAt BIGINT NOT NULL,
    INDEX projection_locator_before (entityType, beforeFqnHash, entityId),
    INDEX projection_locator_after (entityType, afterFqnHash, entityId),
    INDEX projection_entity_history (entityType, entityId, id)
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
    lastError MEDIUMTEXT,
    PRIMARY KEY (mutationId, target),
    INDEX projection_consumer_pending (target, completed, nextAttemptAt, leaseUntil, mutationId),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);

-- Keep revision state after completion: deleting it would allow an old write to win again.
-- Generation identity must not be merged by case, accent or trailing-space folding.
CREATE TABLE IF NOT EXISTS metadata_projection_work (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    target VARCHAR(16) NOT NULL,
    generation VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    entityType VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    entityId VARCHAR(36) NOT NULL,
    dirtyEpoch BIGINT NOT NULL,
    writeRevision BIGINT NOT NULL DEFAULT 0,
    appliedEpoch BIGINT NOT NULL DEFAULT 0,
    pending BOOLEAN NOT NULL DEFAULT TRUE,
    leaseToken VARCHAR(36),
    leaseUntil BIGINT NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    nextAttemptAt BIGINT NOT NULL DEFAULT 0,
    lastError MEDIUMTEXT,
    uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (target, generation, entityType, entityId),
    INDEX projection_work_pending (target, generation, pending, nextAttemptAt, leaseUntil, id)
);

-- A relationship batch retains membership in SQL; expansion reads bounded pages by id.
CREATE TABLE IF NOT EXISTS metadata_projection_relationship (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
    INDEX projection_relationship_page (mutationId, id),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);

-- Preserve association locators before glossary/tag cleanup or a prefix rename removes them.
CREATE TABLE IF NOT EXISTS metadata_projection_tag_usage (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mutationId BIGINT NOT NULL,
    source INTEGER NOT NULL,
    tagFQN VARCHAR(512) NOT NULL,
    tagFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin,
    targetFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin,
    INDEX projection_tag_usage_page (mutationId, id),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);

-- Retain field dependencies and metadata before cleanup or a prefix rename removes them.
CREATE TABLE IF NOT EXISTS metadata_projection_field_relationship (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mutationId BIGINT NOT NULL,
    fromFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    toFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    fromFQN VARCHAR(3072) NOT NULL,
    toFQN VARCHAR(3072) NOT NULL,
    fromType VARCHAR(256) NOT NULL,
    toType VARCHAR(256) NOT NULL,
    relation INTEGER NOT NULL,
    jsonSchema VARCHAR(256),
    json JSON,
    INDEX projection_field_relationship_page (mutationId, id),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);

-- Cross-entity extension removal retains owner UUIDs without copying extension JSON.
CREATE TABLE IF NOT EXISTS metadata_projection_extension (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mutationId BIGINT NOT NULL,
    entityId VARCHAR(36) NOT NULL,
    INDEX projection_extension_page (mutationId, id),
    FOREIGN KEY (mutationId) REFERENCES metadata_projection_mutation(id)
);
