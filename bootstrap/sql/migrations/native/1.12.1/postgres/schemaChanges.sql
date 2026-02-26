-- Incremental Search Retry Queue
-- Stores failed live-indexing operations for async background catch-up.
-- Keep this table intentionally minimal: entityId, entityFqn, failureReason, status.
CREATE TABLE IF NOT EXISTS search_index_retry_queue (
    entityId VARCHAR(36) NOT NULL DEFAULT '',
    entityFqn VARCHAR(1024) NOT NULL DEFAULT '',
    failureReason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (entityId, entityFqn)
);

CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_status
ON search_index_retry_queue(status);
