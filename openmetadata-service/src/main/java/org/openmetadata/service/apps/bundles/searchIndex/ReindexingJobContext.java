package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.UUID;

/**
 * Immutable context for a reindexing job, providing identity and metadata. This abstraction allows
 * the executor to work without Quartz dependencies.
 */
public interface ReindexingJobContext {

  /** Unique identifier for this job execution */
  UUID getJobId();

  /** Human-readable name for the job */
  String getJobName();

  /** Timestamp when the job started (milliseconds since epoch) */
  Long getStartTime();

  /** Application ID (for Quartz-based jobs, null for CLI/API) */
  UUID getAppId();

  /** Whether this is a distributed indexing job */
  boolean isDistributed();

  /** The source that triggered this job (e.g., "QUARTZ", "CLI", "API") */
  String getSource();
}
