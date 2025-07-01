-- Optimization 1: Add index for thread_entity to optimize queries filtering by type, resolved and ordering by createdAt
-- This fixes the "Out of sort memory" error for conversation queries
CREATE INDEX idx_thread_type_resolved_createdAt ON thread_entity(type, resolved, createdAt DESC);
-- Optimization 2: Add index for entityId lookups (many queries filter by entityId alone)
CREATE INDEX idx_thread_entity_entityId ON thread_entity(entityId);
-- Optimization 3: Add generated columns for frequently accessed JSON fields (announcement dates)
-- This improves performance for announcement overlap queries
ALTER TABLE thread_entity 
ADD COLUMN announcementStart BIGINT GENERATED ALWAYS AS (CAST(json #>> '{announcement,startTime}' AS BIGINT)) STORED,
ADD COLUMN announcementEnd BIGINT GENERATED ALWAYS AS (CAST(json #>> '{announcement,endTime}' AS BIGINT)) STORED;
-- Optimization 4: Add index for announcement date range queries
CREATE INDEX idx_thread_entity_type_announcementDates ON thread_entity(type, announcementStart, announcementEnd);
-- Optimization 5: Add index for createdBy + type combination queries
CREATE INDEX idx_thread_entity_createdBy_type ON thread_entity(createdBy, type);
-- Optimization 6: Add composite index for task status queries with ordering
CREATE INDEX idx_thread_entity_type_taskStatus_createdAt ON thread_entity(type, taskStatus, createdAt DESC);
-- Optimization 7: Remove redundant indexes
-- thread_type_index is redundant with thread_type_resolved_updatedAt_index
DROP INDEX IF EXISTS thread_type_index;
-- updated_at_index is redundant with thread_type_resolved_updatedAt_index
DROP INDEX IF EXISTS updated_at_index;