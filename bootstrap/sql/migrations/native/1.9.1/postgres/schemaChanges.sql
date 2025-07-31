-- Add timestamp indexes for improved performance of event ordering queries
-- These indexes significantly improve performance of ORDER BY timestamp DESC queries
-- used in listAllEventsWithStatuses method for alert event retrieval

-- Add descending timestamp index for consumers_dlq table
-- This table stores failed event subscription events
CREATE INDEX IF NOT EXISTS idx_consumers_dlq_timestamp_desc ON consumers_dlq (timestamp DESC);

-- Add descending timestamp index for successful_sent_change_events table  
-- This table stores successfully sent event subscription events
CREATE INDEX IF NOT EXISTS idx_successful_events_timestamp_desc ON successful_sent_change_events (timestamp DESC);

-- Add composite index for better performance when filtering by subscription ID and ordering by timestamp
CREATE INDEX IF NOT EXISTS idx_successful_events_subscription_timestamp ON successful_sent_change_events (event_subscription_id, timestamp DESC);