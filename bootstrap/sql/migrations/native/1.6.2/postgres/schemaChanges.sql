-- add timestamp index for test case result reindex performance
CREATE INDEX idx_timestamp_desc ON data_quality_data_time_series (timestamp DESC);

CREATE TABLE background_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type VARCHAR(256) NOT NULL,
  method_name VARCHAR(256) NOT NULL,
  job_args JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_by VARCHAR(256) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_created_at ON background_jobs (status, created_at);
