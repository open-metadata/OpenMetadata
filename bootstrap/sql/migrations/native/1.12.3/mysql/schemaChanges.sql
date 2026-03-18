-- Incremental Search Retry Queue
-- Stores failed live-indexing operations for async background catch-up.
-- Keep this table intentionally minimal: entityId, entityFqn, failureReason, status.
CREATE TABLE IF NOT EXISTS search_index_retry_queue (
    entityId VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    entityFqn VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    failureReason LONGTEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    entityType VARCHAR(256) NOT NULL DEFAULT '',
    retryCount INT NOT NULL DEFAULT 0,
    claimedAt TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (entityId, entityFqn),
    INDEX idx_search_index_retry_queue_status (status),
    INDEX idx_search_index_retry_queue_claimed (claimedAt)
);
