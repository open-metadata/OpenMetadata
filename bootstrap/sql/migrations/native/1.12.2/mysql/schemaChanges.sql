-- Keyset pagination indexes for time-series tables used during search index reindexing
CREATE INDEX idx_entity_extension_ts_keyset ON entity_extension_time_series(timestamp, entityFQNHash);

CREATE INDEX idx_report_data_ts_keyset ON report_data_time_series(timestamp, entityFQNHash);

CREATE INDEX idx_data_quality_data_ts_keyset ON data_quality_data_time_series(timestamp, entityFQNHash);

CREATE INDEX idx_test_case_resolution_status_ts_keyset ON test_case_resolution_status_time_series(timestamp, entityFQNHash);

CREATE INDEX idx_query_cost_ts_keyset ON query_cost_time_series(timestamp, entityFQNHash);

-- Add entityStatus generated column to glossary_term_entity table for efficient filtering
-- This supports the entityStatus filtering in the search API endpoint
ALTER TABLE glossary_term_entity
  ADD COLUMN entityStatus VARCHAR(32)
  GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.entityStatus')))
  STORED;

-- Add index for efficient entityStatus filtering
CREATE INDEX idx_glossary_term_entity_status ON glossary_term_entity (entityStatus);