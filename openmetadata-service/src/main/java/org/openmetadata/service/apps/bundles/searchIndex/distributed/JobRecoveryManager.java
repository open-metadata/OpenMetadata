/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO;

/**
 * Manages recovery of distributed indexing jobs after server crashes or restarts.
 *
 * <p>This manager handles:
 * <ul>
 *   <li>Detection of orphaned jobs (RUNNING but lock expired or owned by crashed server)</li>
 *   <li>Cleanup of stale locks left by crashed servers</li>
 *   <li>Recovery decision: resume job or mark as FAILED</li>
 *   <li>Validation that no concurrent jobs can run</li>
 * </ul>
 *
 * <p>Should be invoked during server startup before accepting new indexing requests.
 */
@Slf4j
public class JobRecoveryManager {

  /** Grace period before considering a lock as abandoned (should be > LOCK_TIMEOUT_MS) */
  private static final long ABANDONED_LOCK_THRESHOLD_MS = TimeUnit.MINUTES.toMillis(10);

  /** Maximum age for a job to be considered for recovery vs marking as failed */
  private static final long RECOVERY_WINDOW_MS = TimeUnit.HOURS.toMillis(1);

  private final CollectionDAO collectionDAO;
  private final DistributedSearchIndexCoordinator coordinator;
  private final String serverId;

  public JobRecoveryManager(CollectionDAO collectionDAO) {
    this(collectionDAO, 10000); // Default partition size
  }

  public JobRecoveryManager(CollectionDAO collectionDAO, int partitionSize) {
    this.collectionDAO = collectionDAO;
    PartitionCalculator calculator = new PartitionCalculator(partitionSize);
    this.coordinator = new DistributedSearchIndexCoordinator(collectionDAO, calculator);
    this.serverId = ServerIdentityResolver.getInstance().getServerId();
  }

  /**
   * Perform startup recovery checks.
   *
   * <p>This should be called during server initialization to:
   * <ul>
   *   <li>Clean up any stale locks from crashed servers</li>
   *   <li>Detect orphaned jobs and decide whether to recover or fail them</li>
   *   <li>Ensure system is in a consistent state before accepting new jobs</li>
   * </ul>
   *
   * @return Recovery result with details of what was done
   */
  public RecoveryResult performStartupRecovery() {
    LOG.info("Performing startup recovery for distributed indexing jobs...");

    RecoveryResult.Builder resultBuilder = RecoveryResult.builder();

    try {
      // Step 1: Clean up expired locks
      int cleanedLocks = cleanupExpiredLocks();
      resultBuilder.expiredLocksCleanedUp(cleanedLocks);

      // Step 2: Find orphaned RUNNING/INITIALIZING jobs
      List<SearchIndexJob> orphanedJobs = findOrphanedJobs();
      resultBuilder.orphanedJobsFound(orphanedJobs.size());

      // Step 3: Process each orphaned job
      for (SearchIndexJob job : orphanedJobs) {
        processOrphanedJob(job, resultBuilder);
      }

      RecoveryResult result = resultBuilder.build();
      LOG.info(
          "Startup recovery completed: {} locks cleaned, {} orphaned jobs processed "
              + "({} recovered, {} marked failed)",
          result.expiredLocksCleanedUp(),
          result.orphanedJobsFound(),
          result.jobsRecovered(),
          result.jobsMarkedFailed());

      return result;

    } catch (Exception e) {
      LOG.error("Error during startup recovery", e);
      return resultBuilder.error(e.getMessage()).build();
    }
  }

  /**
   * Check if a new job can be started.
   *
   * <p>Validates that:
   * <ul>
   *   <li>No other job is currently running</li>
   *   <li>No active lock exists (or lock is stale and can be cleaned)</li>
   * </ul>
   *
   * @return Optional containing the blocking job if one exists, empty if can proceed
   */
  public Optional<SearchIndexJob> checkForBlockingJob() {
    // Check for any running or ready jobs
    List<SearchIndexJob> activeJobs =
        coordinator.getRecentJobs(
            List.of(
                IndexJobStatus.INITIALIZING,
                IndexJobStatus.READY,
                IndexJobStatus.RUNNING,
                IndexJobStatus.STOPPING),
            1);

    if (!activeJobs.isEmpty()) {
      SearchIndexJob blockingJob = activeJobs.getFirst();

      // Check if the blocking job is actually orphaned
      if (isJobOrphaned(blockingJob)) {
        LOG.warn(
            "Found orphaned blocking job {}, attempting recovery before allowing new job",
            blockingJob.getId());

        // Try to recover/fail the orphaned job
        RecoveryResult.Builder builder = RecoveryResult.builder();
        processOrphanedJob(blockingJob, builder);

        // Re-check if there's still a blocking job
        activeJobs =
            coordinator.getRecentJobs(
                List.of(
                    IndexJobStatus.INITIALIZING,
                    IndexJobStatus.READY,
                    IndexJobStatus.RUNNING,
                    IndexJobStatus.STOPPING),
                1);

        if (activeJobs.isEmpty()) {
          return Optional.empty();
        }
      }

      return Optional.of(activeJobs.getFirst());
    }

    return Optional.empty();
  }

  /**
   * Clean up expired locks from the lock table.
   *
   * @return Number of locks cleaned up
   */
  private int cleanupExpiredLocks() {
    SearchReindexLockDAO lockDAO = collectionDAO.searchReindexLockDAO();
    long expirationThreshold = System.currentTimeMillis() - ABANDONED_LOCK_THRESHOLD_MS;

    int cleaned = lockDAO.cleanupExpiredLocks(expirationThreshold);
    if (cleaned > 0) {
      LOG.info("Cleaned up {} expired reindex locks", cleaned);
    }

    return cleaned;
  }

  /**
   * Find jobs that are in a running state but appear to be orphaned.
   *
   * @return List of orphaned jobs
   */
  private List<SearchIndexJob> findOrphanedJobs() {
    List<SearchIndexJob> runningJobs =
        coordinator.getRecentJobs(
            List.of(
                IndexJobStatus.INITIALIZING,
                IndexJobStatus.READY,
                IndexJobStatus.RUNNING,
                IndexJobStatus.STOPPING),
            10);

    return runningJobs.stream().filter(this::isJobOrphaned).toList();
  }

  /**
   * Check if a job is orphaned (no active lock holder or lock expired).
   *
   * @param job The job to check
   * @return true if the job is orphaned
   */
  private boolean isJobOrphaned(SearchIndexJob job) {
    SearchReindexLockDAO lockDAO = collectionDAO.searchReindexLockDAO();

    // Check if there's a valid lock for this job
    SearchReindexLockDAO.LockInfo lockInfo = lockDAO.getLockInfo("SEARCH_REINDEX_LOCK");

    if (lockInfo == null) {
      // No lock exists - job is orphaned
      return true;
    }

    // Check if lock is for this job
    if (!lockInfo.jobId().equals(job.getId().toString())) {
      // Lock is for a different job - this job is orphaned
      return true;
    }

    // Check if lock is expired
    long now = System.currentTimeMillis();
    if (lockInfo.expiresAt() < now) {
      // Lock is expired - job is orphaned
      return true;
    }

    // Check if the lock holder server is still responsive
    // We consider a job orphaned if it hasn't been updated recently
    long lastUpdateThreshold = now - ABANDONED_LOCK_THRESHOLD_MS;
    if (job.getUpdatedAt() < lastUpdateThreshold) {
      // Job hasn't been updated recently - likely orphaned
      LOG.debug(
          "Job {} last updated {} ms ago, considering orphaned",
          job.getId(),
          now - job.getUpdatedAt());
      return true;
    }

    return false;
  }

  /**
   * Process an orphaned job, either recovering it or marking it as failed.
   *
   * @param job The orphaned job
   * @param resultBuilder Builder to record the action taken
   */
  private void processOrphanedJob(SearchIndexJob job, RecoveryResult.Builder resultBuilder) {
    LOG.info("Processing orphaned job {} (status: {})", job.getId(), job.getStatus());

    long now = System.currentTimeMillis();
    long jobAge = now - (job.getStartedAt() != null ? job.getStartedAt() : job.getCreatedAt());

    // Decide whether to recover or fail based on job state and age
    boolean shouldRecover = shouldRecoverJob(job, jobAge);

    if (shouldRecover) {
      recoverJob(job);
      resultBuilder.incrementRecovered();
      LOG.info("Job {} has been marked for recovery (will resume processing)", job.getId());
    } else {
      failJob(job, "Job abandoned due to server crash or shutdown");
      resultBuilder.incrementFailed();
      LOG.info("Job {} has been marked as FAILED", job.getId());
    }
  }

  /**
   * Determine if a job should be recovered or marked as failed.
   *
   * @param job The job to evaluate
   * @param jobAge Age of the job in milliseconds
   * @return true if job should be recovered
   */
  private boolean shouldRecoverJob(SearchIndexJob job, long jobAge) {
    // Don't recover very old jobs
    if (jobAge > RECOVERY_WINDOW_MS) {
      LOG.debug("Job {} is too old for recovery ({} ms)", job.getId(), jobAge);
      return false;
    }

    // Jobs in INITIALIZING state haven't started - just fail them
    if (job.getStatus() == IndexJobStatus.INITIALIZING) {
      LOG.debug("Job {} in INITIALIZING state - will be failed", job.getId());
      return false;
    }

    // Jobs in READY state can be recovered (haven't done any work yet)
    if (job.getStatus() == IndexJobStatus.READY) {
      return true;
    }

    if (job.getStatus() == IndexJobStatus.RUNNING) {
      List<SearchIndexPartition> pending =
          coordinator.getPartitions(job.getId(), PartitionStatus.PENDING);
      List<SearchIndexPartition> processing =
          coordinator.getPartitions(job.getId(), PartitionStatus.PROCESSING);

      return !pending.isEmpty() || !processing.isEmpty();
    }

    return false;
  }

  /**
   * Recover a job by making it available for processing.
   *
   * @param job The job to recover
   */
  private void recoverJob(SearchIndexJob job) {
    boolean lockAcquired = coordinator.tryAcquireReindexLock(job.getId());
    if (!lockAcquired) {
      LOG.warn(
          "Could not acquire lock for job {} during recovery - another server may have claimed it",
          job.getId());
      return;
    }

    try {
      List<SearchIndexPartition> processing =
          coordinator.getPartitions(job.getId(), PartitionStatus.PROCESSING);

      for (SearchIndexPartition partition : processing) {
        resetPartitionForRetry(partition);
      }

      LOG.info(
          "Recovered job {}: reset {} processing partitions to pending",
          job.getId(),
          processing.size());
    } finally {
      coordinator.releaseReindexLock(job.getId());
    }
  }

  /**
   * Reset a partition for retry by clearing its assignment.
   *
   * @param partition The partition to reset
   */
  private void resetPartitionForRetry(SearchIndexPartition partition) {
    CollectionDAO.SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    partitionDAO.update(
        partition.getId().toString(),
        PartitionStatus.PENDING.name(),
        partition.getCursor(), // Keep cursor for resume
        partition.getProcessedCount(),
        partition.getSuccessCount(),
        partition.getFailedCount(),
        null, // Clear assigned server
        null, // Clear claimed at
        null, // Clear started at
        null, // Clear completed at
        System.currentTimeMillis(),
        "Reset for recovery after server crash",
        partition.getRetryCount() + 1);

    LOG.debug("Reset partition {} for retry", partition.getId());
  }

  /**
   * Mark a job as failed.
   *
   * @param job The job to fail
   * @param errorMessage Error message explaining the failure
   */
  private void failJob(SearchIndexJob job, String errorMessage) {
    CollectionDAO.SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();

    // Get final stats if available
    CollectionDAO.SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();
    CollectionDAO.SearchIndexPartitionDAO.AggregatedStatsRecord stats =
        partitionDAO.getAggregatedStats(job.getId().toString());

    long now = System.currentTimeMillis();

    jobDAO.update(
        job.getId().toString(),
        IndexJobStatus.FAILED.name(),
        stats != null ? stats.processedRecords() : job.getProcessedRecords(),
        stats != null ? stats.successRecords() : job.getSuccessRecords(),
        stats != null ? stats.failedRecords() : job.getFailedRecords(),
        null, // stats JSON
        job.getStartedAt(),
        now, // completedAt
        now, // updatedAt
        errorMessage);

    // Cancel any remaining partitions
    partitionDAO.cancelPendingPartitions(job.getId().toString());

    // Release any lock held by this job
    collectionDAO.searchReindexLockDAO().releaseLock("SEARCH_REINDEX_LOCK", job.getId().toString());

    LOG.info(
        "Marked job {} as FAILED: {} (processed: {}, success: {}, failed: {})",
        job.getId(),
        errorMessage,
        stats != null ? stats.processedRecords() : 0,
        stats != null ? stats.successRecords() : 0,
        stats != null ? stats.failedRecords() : 0);
  }

  /**
   * Result of the recovery process.
   */
  public record RecoveryResult(
      int expiredLocksCleanedUp,
      int orphanedJobsFound,
      int jobsRecovered,
      int jobsMarkedFailed,
      String error) {

    public boolean hasError() {
      return error != null && !error.isEmpty();
    }

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private int expiredLocksCleanedUp;
      private int orphanedJobsFound;
      private int jobsRecovered;
      private int jobsMarkedFailed;
      private String error;

      public Builder expiredLocksCleanedUp(int count) {
        this.expiredLocksCleanedUp = count;
        return this;
      }

      public Builder orphanedJobsFound(int count) {
        this.orphanedJobsFound = count;
        return this;
      }

      public Builder incrementRecovered() {
        this.jobsRecovered++;
        return this;
      }

      public Builder incrementFailed() {
        this.jobsMarkedFailed++;
        return this;
      }

      public Builder error(String error) {
        this.error = error;
        return this;
      }

      public RecoveryResult build() {
        return new RecoveryResult(
            expiredLocksCleanedUp, orphanedJobsFound, jobsRecovered, jobsMarkedFailed, error);
      }
    }
  }
}
