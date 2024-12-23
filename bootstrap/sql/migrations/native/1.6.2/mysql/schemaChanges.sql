-- add timestamp index for test case result reindex performance
ALTER TABLE data_quality_data_time_series ADD INDEX `idx_timestamp_desc` (timestamp DESC);

CREATE TABLE background_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_type VARCHAR(256) NOT NULL,
  method_name VARCHAR(256) NOT NULL,
  job_args JSON NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_by VARCHAR(256) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_status_created_at ON background_jobs (status, created_at);