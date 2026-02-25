-- Keyset pagination indexes for time-series tables used during search index reindexing
CREATE INDEX IF NOT EXISTS idx_entity_extension_ts_keyset
  ON entity_extension_time_series(timestamp, entityFQNHash);

CREATE INDEX IF NOT EXISTS idx_report_data_ts_keyset
  ON report_data_time_series(timestamp, entityFQNHash);

CREATE INDEX IF NOT EXISTS idx_data_quality_data_ts_keyset
  ON data_quality_data_time_series(timestamp, entityFQNHash);

CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_ts_keyset
  ON test_case_resolution_status_time_series(timestamp, entityFQNHash);

CREATE INDEX IF NOT EXISTS idx_query_cost_ts_keyset
  ON query_cost_time_series(timestamp, entityFQNHash);
