ALTER TABLE background_jobs
  ADD COLUMN progress int DEFAULT 0,
  ADD COLUMN total int DEFAULT 0,
  ADD COLUMN result longtext,
  ADD COLUMN error longtext,
  ADD COLUMN message varchar(2048),
  ADD COLUMN cancelRequested boolean DEFAULT false,
  ADD COLUMN completedAt bigint;

CREATE INDEX idx_background_jobs_job_type_created_by
  ON background_jobs (jobType, createdBy, createdAt);

CREATE INDEX idx_background_jobs_status_updated_at
  ON background_jobs (status, updatedAt);

CREATE TABLE IF NOT EXISTS background_job_logs (
  logId varchar(36) NOT NULL,
  jobId bigint unsigned NOT NULL,
  createdAt bigint NOT NULL,
  level varchar(16) NOT NULL,
  message varchar(4096) NOT NULL,
  PRIMARY KEY (logId),
  KEY idx_background_job_logs_job_id_created_at (jobId, createdAt),
  CONSTRAINT fk_background_job_logs_job_id
    FOREIGN KEY (jobId) REFERENCES background_jobs(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
