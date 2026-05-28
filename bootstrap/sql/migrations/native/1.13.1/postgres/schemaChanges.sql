ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS message character varying(2048),
  ADD COLUMN IF NOT EXISTS cancelRequested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completedAt bigint;

CREATE INDEX IF NOT EXISTS idx_background_jobs_job_type_created_by
  ON background_jobs (jobType, createdBy, createdAt);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status_updated_at
  ON background_jobs (status, updatedAt);

CREATE TABLE IF NOT EXISTS background_job_logs (
  logId character varying(36) NOT NULL,
  jobId bigint NOT NULL,
  createdAt bigint NOT NULL,
  level character varying(16) NOT NULL,
  message character varying(4096) NOT NULL,
  PRIMARY KEY (logId),
  CONSTRAINT fk_background_job_logs_job_id
    FOREIGN KEY (jobId) REFERENCES background_jobs(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_background_job_logs_job_id_created_at
  ON background_job_logs (jobId, createdAt);
