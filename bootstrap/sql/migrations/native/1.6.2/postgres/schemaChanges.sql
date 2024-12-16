-- add timestamp index for test case result reindex performance
CREATE INDEX idx_timestamp_desc ON data_quality_data_time_series (timestamp DESC);
