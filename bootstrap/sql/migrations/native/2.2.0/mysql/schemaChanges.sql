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

-- Search reindex: entity types rewritten in their live index rather than a staged one, so every
-- server taking part in the job writes those types in place.
SET @search_index_job_in_place_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'search_index_job'
        AND column_name = 'inPlaceIndexMapping'
    ),
    'SELECT 1',
    'ALTER TABLE search_index_job ADD COLUMN inPlaceIndexMapping JSON DEFAULT NULL'
  )
);
PREPARE search_index_job_in_place_stmt FROM @search_index_job_in_place_ddl;
EXECUTE search_index_job_in_place_stmt;
DEALLOCATE PREPARE search_index_job_in_place_stmt;

-- Search reindex: the keyset cursor each partition starts after, recorded when the job is created.
-- Every server claiming the partition starts at that row; finding it again with OFFSET skips rows
-- once earlier rows are deleted during the run.
SET @search_index_partition_start_cursor_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'search_index_partition'
        AND column_name = 'startCursor'
    ),
    'SELECT 1',
    'ALTER TABLE search_index_partition ADD COLUMN startCursor TEXT DEFAULT NULL'
  )
);
PREPARE search_index_partition_start_cursor_stmt FROM @search_index_partition_start_cursor_ddl;
EXECUTE search_index_partition_start_cursor_stmt;
DEALLOCATE PREPARE search_index_partition_start_cursor_stmt;

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
SET @search_index_retry_next_attempt_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'search_index_retry_queue'
        AND column_name = 'nextAttemptAt'
    ),
    'SELECT 1',
    'ALTER TABLE search_index_retry_queue ADD COLUMN nextAttemptAt BIGINT NOT NULL DEFAULT 0'
  )
);
PREPARE search_index_retry_next_attempt_stmt FROM @search_index_retry_next_attempt_ddl;
EXECUTE search_index_retry_next_attempt_stmt;
DEALLOCATE PREPARE search_index_retry_next_attempt_stmt;

-- Scheduled search and RDF repairs: the window of changed rows each has checked, and when it last
-- swept for what remains of rows that are gone. One row per repair; any server may run the next pass.
CREATE TABLE IF NOT EXISTS projection_repair_state (
    name VARCHAR(64) NOT NULL,
    changedSince BIGINT NOT NULL,
    sweptAt BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (name)
);

-- Live RDF delivery: a dead letter replayed in the background stays until every failure since the
-- last repair has been replayed, so the projection is reported healthy only when nothing was lost.
SET @rdf_dead_letter_replayed_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'rdf_live_write_dead_letter'
        AND column_name = 'replayedAt'
    ),
    'SELECT 1',
    'ALTER TABLE rdf_live_write_dead_letter ADD COLUMN replayedAt BIGINT DEFAULT NULL'
  )
);
PREPARE rdf_dead_letter_replayed_stmt FROM @rdf_dead_letter_replayed_ddl;
EXECUTE rdf_dead_letter_replayed_stmt;
DEALLOCATE PREPARE rdf_dead_letter_replayed_stmt;
