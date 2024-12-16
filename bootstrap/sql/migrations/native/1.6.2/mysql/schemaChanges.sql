-- add timestamp index for test case result reindex performance
ALTER TABLE data_quality_data_time_series ADD INDEX `idx_timestamp_desc` (timestamp DESC);