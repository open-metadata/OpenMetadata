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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.AggregatedStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.EntityStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.ServerStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO;

/**
 * Coordinates distributed search index jobs across multiple OpenMetadata server instances.
 *
 * <p>This coordinator handles: - Creating and initializing distributed indexing jobs - Partition
 * creation and assignment - Progress tracking and aggregation - Job lifecycle management
 *
 * <p>Uses database-backed coordination with optimistic locking for partition claiming to ensure
 * exactly-once processing semantics. Partition claiming is atomic using FOR UPDATE SKIP LOCKED,
 * which naturally load-balances work across servers (faster servers claim more partitions).
 */
@Slf4j
public class DistributedSearchIndexCoordinator {

  /** Lock key for exclusive reindexing operations */
  private static final String REINDEX_LOCK_KEY = "SEARCH_REINDEX_LOCK";

  /** Lock timeout in milliseconds (5 minutes) */
  private static final long LOCK_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(5);

  /** Partition claim timeout - how long before an unresponsive partition can be reclaimed */
  private static final long PARTITION_CLAIM_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(3);

  /**
   * Percentage of partitions to make immediately claimable (50%).
   * Increased from 20% to give single-server deployments faster startup.
   */
  private static final double IMMEDIATE_CLAIMABLE_PERCENT = 0.50;

  /**
   * Time window over which to stagger partition release (5 seconds).
   * Reduced from 30 seconds - the MAX_IN_FLIGHT limit provides the primary fairness mechanism,
   * while this short window gives late-joining servers a brief opportunity to claim fresh work.
   * 5 seconds is enough for Redis notification latency but short enough for single-server.
   */
  private static final long PARTITION_RELEASE_WINDOW_MS = TimeUnit.SECONDS.toMillis(5);

  /** Maximum number of retries for a failed partition */
  private static final int MAX_PARTITION_RETRIES = 3;

  /**
   * Maximum in-flight partitions per server. Prevents one server from hoarding too many partitions
   * while processing. Once a server finishes processing, it can claim more partitions.
   * This is the primary mechanism for fair work distribution across servers.
   */
  private static final int MAX_IN_FLIGHT_PARTITIONS_PER_SERVER = 5;

  private final CollectionDAO collectionDAO;
  private final PartitionCalculator partitionCalculator;
  private final String serverId;
  private EntityCompletionTracker entityTracker;

  public DistributedSearchIndexCoordinator(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
    this.partitionCalculator = new PartitionCalculator();
    this.serverId = ServerIdentityResolver.getInstance().getServerId();
  }

  public DistributedSearchIndexCoordinator(
      CollectionDAO collectionDAO, PartitionCalculator partitionCalculator) {
    this.collectionDAO = collectionDAO;
    this.partitionCalculator = partitionCalculator;
    this.serverId = ServerIdentityResolver.getInstance().getServerId();
  }

  public CollectionDAO getCollectionDAO() {
    return collectionDAO;
  }

  /**
   * Set the entity completion tracker for per-entity index promotion.
   *
   * @param tracker The entity completion tracker
   */
  public void setEntityCompletionTracker(EntityCompletionTracker tracker) {
    this.entityTracker = tracker;
  }

  /**
   * Create a new distributed indexing job.
   *
   * @param entities Set of entity types to index
   * @param jobConfiguration The job configuration
   * @param createdBy User who initiated the job
   * @return The created job
   */
  public SearchIndexJob createJob(
      Set<String> entities, EventPublisherJob jobConfiguration, String createdBy) {

    UUID jobId = UUID.randomUUID();
    long now = System.currentTimeMillis();

    // Calculate entity statistics
    Map<String, Long> entityCounts = partitionCalculator.getEntityCounts(entities);
    long totalRecords = entityCounts.values().stream().mapToLong(Long::longValue).sum();

    // Build entity stats map
    Map<String, SearchIndexJob.EntityTypeStats> entityStats = new HashMap<>();
    for (String entityType : entities) {
      long count = entityCounts.getOrDefault(entityType, 0L);
      entityStats.put(
          entityType,
          SearchIndexJob.EntityTypeStats.builder()
              .entityType(entityType)
              .totalRecords(count)
              .processedRecords(0)
              .successRecords(0)
              .failedRecords(0)
              .totalPartitions(0)
              .completedPartitions(0)
              .failedPartitions(0)
              .build());
    }

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.INITIALIZING)
            .jobConfiguration(jobConfiguration)
            .targetIndexPrefix(generateTargetIndexPrefix())
            .totalRecords(totalRecords)
            .processedRecords(0)
            .successRecords(0)
            .failedRecords(0)
            .entityStats(entityStats)
            .createdBy(createdBy)
            .createdAt(now)
            .updatedAt(now)
            .build();

    // Persist job
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
    insertJob(jobDAO, job);

    LOG.info(
        "Created distributed indexing job {} with {} entities ({} total records)",
        jobId,
        entities.size(),
        totalRecords);

    return job;
  }

  /**
   * Initialize partitions for a job.
   *
   * @param jobId The job ID
   * @return Updated job with partition information
   */
  public SearchIndexJob initializePartitions(UUID jobId) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    SearchIndexJob job = getJobById(jobDAO, jobId);

    if (job.getStatus() != IndexJobStatus.INITIALIZING) {
      throw new IllegalStateException(
          "Job must be in INITIALIZING state to create partitions. Current: " + job.getStatus());
    }

    // Get entity types from job configuration
    Set<String> entityTypes = Set.copyOf(job.getJobConfiguration().getEntities());

    // Calculate partitions
    List<SearchIndexPartition> partitions =
        partitionCalculator.calculatePartitions(jobId, entityTypes);

    if (partitions.isEmpty()) {
      LOG.warn(
          "No partitions created for job {} - this may indicate no entities to index for types: {}",
          jobId,
          entityTypes);
    } else {
      LOG.info(
          "Calculated {} partitions for job {} across {} entity types",
          partitions.size(),
          jobId,
          entityTypes.size());
    }

    // Calculate staggered claimableAt timestamps for partitions
    // 50% immediately claimable, remaining 50% staggered over 5 seconds
    // This balances single-server performance with multi-server fairness
    long now = System.currentTimeMillis();
    int totalPartitions = partitions.size();
    int immediateCount = Math.max(1, (int) (totalPartitions * IMMEDIATE_CLAIMABLE_PERCENT));

    for (int i = 0; i < partitions.size(); i++) {
      SearchIndexPartition partition = partitions.get(i);

      long claimableAt;
      if (i < immediateCount) {
        claimableAt = now; // Immediately claimable
      } else {
        // Distribute remaining partitions evenly over the release window
        int remainingIndex = i - immediateCount;
        int remainingCount = totalPartitions - immediateCount;
        long delayMs = (remainingIndex * PARTITION_RELEASE_WINDOW_MS) / Math.max(1, remainingCount);
        claimableAt = now + delayMs;
      }

      SearchIndexPartition partitionWithClaimable =
          partition.toBuilder().claimableAt(claimableAt).build();
      insertPartition(partitionDAO, partitionWithClaimable);
    }

    LOG.info(
        "Initialized {} partitions for job {} ({} immediately claimable, {} staggered over {}s)",
        partitions.size(),
        jobId,
        immediateCount,
        totalPartitions - immediateCount,
        PARTITION_RELEASE_WINDOW_MS / 1000);

    // Update entity stats with partition counts
    Map<String, SearchIndexJob.EntityTypeStats> updatedStats = new HashMap<>(job.getEntityStats());
    for (String entityType : entityTypes) {
      long partitionCount =
          partitions.stream().filter(p -> p.getEntityType().equals(entityType)).count();

      SearchIndexJob.EntityTypeStats stats = updatedStats.get(entityType);
      if (stats != null) {
        updatedStats.put(
            entityType,
            SearchIndexJob.EntityTypeStats.builder()
                .entityType(stats.getEntityType())
                .totalRecords(stats.getTotalRecords())
                .processedRecords(stats.getProcessedRecords())
                .successRecords(stats.getSuccessRecords())
                .failedRecords(stats.getFailedRecords())
                .totalPartitions((int) partitionCount)
                .completedPartitions(stats.getCompletedPartitions())
                .failedPartitions(stats.getFailedPartitions())
                .build());
      }
    }

    // Update job status
    SearchIndexJob updatedJob =
        job.toBuilder()
            .status(IndexJobStatus.READY)
            .entityStats(updatedStats)
            .updatedAt(System.currentTimeMillis())
            .build();

    updateJob(jobDAO, updatedJob);

    return updatedJob;
  }

  /**
   * Claim the next available partition for processing.
   *
   * <p>Uses an atomic UPDATE with FOR UPDATE SKIP LOCKED to avoid race conditions where two
   * servers could claim the same partition. This ensures exactly-once claiming semantics and
   * naturally load-balances work across servers (faster servers claim more partitions).
   *
   * <p>The only limit enforced is the in-flight limit: each server can have at most
   * MAX_IN_FLIGHT_PARTITIONS_PER_SERVER partitions in PROCESSING state at once. This prevents one
   * server from hoarding partitions while processing.
   *
   * @param jobId The job ID
   * @return The claimed partition, or empty if no partitions available or in-flight limit reached
   */
  public Optional<SearchIndexPartition> claimNextPartition(UUID jobId) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    // Get in-flight count for this server
    int inFlightCount = partitionDAO.countInFlightPartitions(jobId.toString(), serverId);

    // Check if this server already has too many in-flight partitions
    if (inFlightCount >= MAX_IN_FLIGHT_PARTITIONS_PER_SERVER) {
      LOG.debug(
          "Server {} has {} in-flight partitions (max {}), waiting for some to complete",
          serverId,
          inFlightCount,
          MAX_IN_FLIGHT_PARTITIONS_PER_SERVER);
      return Optional.empty();
    }

    long claimTime = System.currentTimeMillis();

    // Atomically claim a partition - FOR UPDATE SKIP LOCKED ensures no race condition
    int claimed = partitionDAO.claimNextPartitionAtomic(jobId.toString(), serverId, claimTime);
    if (claimed == 0) {
      LOG.debug("No partitions available to claim for server {} on job {}", serverId, jobId);
      return Optional.empty();
    }

    // Fetch the partition we just claimed
    SearchIndexPartitionRecord record =
        partitionDAO.findLatestClaimedPartition(jobId.toString(), serverId);
    if (record == null) {
      LOG.warn("Claimed partition but couldn't find it - this shouldn't happen");
      return Optional.empty();
    }

    SearchIndexPartition partition = recordToPartition(record);

    LOG.debug(
        "Server {} claimed partition {} for entity type {} (in-flight: {}/{})",
        serverId,
        partition.getId(),
        partition.getEntityType(),
        inFlightCount + 1,
        MAX_IN_FLIGHT_PARTITIONS_PER_SERVER);

    return Optional.of(partition);
  }

  /**
   * Update partition progress.
   *
   * @param partition The partition with updated progress
   */
  public void updatePartitionProgress(SearchIndexPartition partition) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    long now = System.currentTimeMillis();
    partitionDAO.updateProgress(
        partition.getId().toString(),
        partition.getCursor(),
        partition.getProcessedCount(),
        partition.getSuccessCount(),
        partition.getFailedCount(),
        now);

    LOG.debug(
        "Updated progress for partition {}: cursor={}, processed={}, success={}, failed={}",
        partition.getId(),
        partition.getCursor(),
        partition.getProcessedCount(),
        partition.getSuccessCount(),
        partition.getFailedCount());
  }

  /**
   * Mark a partition as completed.
   *
   * @param partitionId The partition ID
   * @param successCount Number of successfully indexed entities
   * @param failedCount Number of failed entities
   */
  public void completePartition(UUID partitionId, long successCount, long failedCount) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    SearchIndexPartitionRecord record = partitionDAO.findById(partitionId.toString());
    if (record == null) {
      LOG.warn("Partition not found for completion: {}", partitionId);
      return;
    }

    long now = System.currentTimeMillis();
    partitionDAO.update(
        partitionId.toString(),
        PartitionStatus.COMPLETED.name(),
        record.rangeEnd(),
        successCount + failedCount,
        successCount,
        failedCount,
        record.assignedServer(),
        record.claimedAt(),
        record.startedAt(),
        now,
        now,
        record.lastError(),
        record.retryCount());

    LOG.info(
        "Completed partition {} for entity type {} (success: {}, failed: {})",
        partitionId,
        record.entityType(),
        successCount,
        failedCount);

    // Record partition completion for per-entity index promotion
    if (entityTracker != null) {
      LOG.debug(
          "Recording partition completion for entity '{}' (failed={}) in tracker",
          record.entityType(),
          failedCount > 0);
      entityTracker.recordPartitionComplete(record.entityType(), failedCount > 0);
    } else {
      LOG.debug("Entity tracker is null, skipping per-entity completion tracking");
    }

    // Check if job should be marked as complete
    checkAndUpdateJobCompletion(UUID.fromString(record.jobId()));
  }

  /**
   * Mark a partition as failed.
   *
   * @param partitionId The partition ID
   * @param errorMessage Error message describing the failure
   */
  public void failPartition(UUID partitionId, String errorMessage) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    SearchIndexPartitionRecord record = partitionDAO.findById(partitionId.toString());
    if (record == null) {
      LOG.warn("Partition not found for failure: {}", partitionId);
      return;
    }

    long now = System.currentTimeMillis();

    // Check if we should retry
    if (record.retryCount() < MAX_PARTITION_RETRIES) {
      // Reset to pending for retry
      partitionDAO.update(
          partitionId.toString(),
          PartitionStatus.PENDING.name(),
          record.cursor(),
          record.processedCount(),
          record.successCount(),
          record.failedCount(),
          null,
          null,
          null,
          null,
          now,
          errorMessage,
          record.retryCount() + 1);

      LOG.warn(
          "Partition {} failed, queued for retry ({}/{}): {}",
          partitionId,
          record.retryCount() + 1,
          MAX_PARTITION_RETRIES,
          errorMessage);
    } else {
      // Mark as permanently failed
      partitionDAO.update(
          partitionId.toString(),
          PartitionStatus.FAILED.name(),
          record.cursor(),
          record.processedCount(),
          record.successCount(),
          record.failedCount(),
          record.assignedServer(),
          record.claimedAt(),
          record.startedAt(),
          now,
          now,
          errorMessage,
          record.retryCount());

      LOG.error(
          "Partition {} permanently failed after {} retries: {}",
          partitionId,
          MAX_PARTITION_RETRIES,
          errorMessage);

      // Record partition completion (with failure) for per-entity index promotion
      if (entityTracker != null) {
        entityTracker.recordPartitionComplete(record.entityType(), true);
      }

      checkAndUpdateJobCompletion(UUID.fromString(record.jobId()));
    }
  }

  /**
   * Start a job that is in READY state.
   *
   * @param jobId The job ID
   */
  public void startJob(UUID jobId) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();

    SearchIndexJob job = getJobById(jobDAO, jobId);

    if (job.getStatus() != IndexJobStatus.READY) {
      throw new IllegalStateException(
          "Job must be in READY state to start. Current: " + job.getStatus());
    }

    SearchIndexJob started =
        job.toBuilder()
            .status(IndexJobStatus.RUNNING)
            .startedAt(System.currentTimeMillis())
            .updatedAt(System.currentTimeMillis())
            .build();

    updateJob(jobDAO, started);
    LOG.info("Started job {}", jobId);
  }

  /**
   * Get all participating servers for a job (derived from partition assignments).
   *
   * @param jobId The job ID
   * @return List of server IDs that have claimed partitions
   */
  public List<String> getParticipatingServers(UUID jobId) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();
    return partitionDAO.getAssignedServers(jobId.toString());
  }

  /**
   * Request to stop a running job.
   *
   * @param jobId The job ID
   */
  public void requestStop(UUID jobId) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();

    SearchIndexJob job = getJobById(jobDAO, jobId);

    if (job.isTerminal()) {
      LOG.warn("Cannot stop job {} - already in terminal state: {}", jobId, job.getStatus());
      return;
    }

    SearchIndexJob stopping =
        job.toBuilder()
            .status(IndexJobStatus.STOPPING)
            .updatedAt(System.currentTimeMillis())
            .build();

    updateJob(jobDAO, stopping);

    // Cancel all pending partitions
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();
    partitionDAO.cancelPendingPartitions(jobId.toString());

    LOG.info("Requested stop for job {}", jobId);
  }

  /**
   * Get the current state of a job.
   *
   * @param jobId The job ID
   * @return The job, or empty if not found
   */
  public Optional<SearchIndexJob> getJob(UUID jobId) {
    SearchIndexJobRecord record = collectionDAO.searchIndexJobDAO().findById(jobId.toString());
    if (record == null) {
      return Optional.empty();
    }
    return Optional.of(recordToJob(record));
  }

  /**
   * Get aggregated statistics for a job by querying the database.
   *
   * @param jobId The job ID
   * @return Updated job with aggregated statistics
   */
  public SearchIndexJob getJobWithAggregatedStats(UUID jobId) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    SearchIndexJob job = getJobById(jobDAO, jobId);

    // Get aggregated stats from database
    AggregatedStatsRecord stats = partitionDAO.getAggregatedStats(jobId.toString());

    // Get per-entity stats
    List<EntityStatsRecord> entityStatsList = partitionDAO.getEntityStats(jobId.toString());

    Map<String, SearchIndexJob.EntityTypeStats> entityStatsMap = new HashMap<>();
    // Calculate totals from entity stats for consistency (entity stats are always accurate)
    long totalProcessed = 0;
    long totalSuccess = 0;
    long totalFailed = 0;

    for (EntityStatsRecord es : entityStatsList) {
      entityStatsMap.put(
          es.entityType(),
          SearchIndexJob.EntityTypeStats.builder()
              .entityType(es.entityType())
              .totalRecords(es.totalRecords())
              .processedRecords(es.processedRecords())
              .successRecords(es.successRecords())
              .failedRecords(es.failedRecords())
              .totalPartitions(es.totalPartitions())
              .completedPartitions(es.completedPartitions())
              .failedPartitions(es.failedPartitions())
              .build());
      totalProcessed += es.processedRecords();
      totalSuccess += es.successRecords();
      totalFailed += es.failedRecords();
    }

    // Get per-server stats for distributed visibility
    List<ServerStatsRecord> serverStatsList = partitionDAO.getServerStats(jobId.toString());
    LOG.info("Fetched server stats for job {}: {} records from DB", jobId, serverStatsList.size());
    Map<String, SearchIndexJob.ServerStats> serverStatsMap = new HashMap<>();
    for (ServerStatsRecord ss : serverStatsList) {
      LOG.debug(
          "Server stats record: server={}, processed={}, success={}, failed={}",
          ss.serverId(),
          ss.processedRecords(),
          ss.successRecords(),
          ss.failedRecords());
      serverStatsMap.put(
          ss.serverId(),
          SearchIndexJob.ServerStats.builder()
              .serverId(ss.serverId())
              .processedRecords(ss.processedRecords())
              .successRecords(ss.successRecords())
              .failedRecords(ss.failedRecords())
              .totalPartitions(ss.totalPartitions())
              .completedPartitions(ss.completedPartitions())
              .processingPartitions(ss.processingPartitions())
              .build());
    }

    // Use entity stats sum for job-level stats (more reliable than single aggregation query)
    return job.toBuilder()
        .processedRecords(totalProcessed)
        .successRecords(totalSuccess)
        .failedRecords(totalFailed)
        .entityStats(entityStatsMap)
        .serverStats(serverStatsMap)
        .build();
  }

  /**
   * Get partitions for a job, optionally filtered by status.
   *
   * @param jobId The job ID
   * @param status Optional status filter
   * @return List of partitions
   */
  public List<SearchIndexPartition> getPartitions(UUID jobId, PartitionStatus status) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    List<SearchIndexPartitionRecord> records;
    if (status != null) {
      records = partitionDAO.findByJobIdAndStatus(jobId.toString(), status.name());
    } else {
      records = partitionDAO.findByJobId(jobId.toString());
    }

    return records.stream().map(this::recordToPartition).collect(Collectors.toList());
  }

  /**
   * Check if a job should be marked as complete and update its status. This method is idempotent —
   * if the job is already in a terminal state, it returns immediately.
   *
   * @param jobId The job ID
   */
  public void checkAndUpdateJobCompletion(UUID jobId) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    SearchIndexJobRecord jobRecord = jobDAO.findById(jobId.toString());
    if (jobRecord == null) {
      return;
    }
    SearchIndexJob job = recordToJob(jobRecord);
    if (job.isTerminal()) {
      return;
    }

    // Count partitions by status
    List<SearchIndexPartitionRecord> pending =
        partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name());
    List<SearchIndexPartitionRecord> processing =
        partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name());
    List<SearchIndexPartitionRecord> failed =
        partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.FAILED.name());

    if (pending.isEmpty() && processing.isEmpty()) {
      // All partitions are done
      IndexJobStatus newStatus;
      if (!failed.isEmpty()) {
        newStatus = IndexJobStatus.COMPLETED_WITH_ERRORS;
      } else if (job.getStatus() == IndexJobStatus.STOPPING) {
        newStatus = IndexJobStatus.STOPPED;
      } else {
        newStatus = IndexJobStatus.COMPLETED;
      }

      // Get final aggregated stats
      AggregatedStatsRecord stats = partitionDAO.getAggregatedStats(jobId.toString());

      SearchIndexJob completed =
          job.toBuilder()
              .status(newStatus)
              .processedRecords(stats != null ? stats.processedRecords() : 0)
              .successRecords(stats != null ? stats.successRecords() : 0)
              .failedRecords(stats != null ? stats.failedRecords() : 0)
              .completedAt(System.currentTimeMillis())
              .updatedAt(System.currentTimeMillis())
              .build();

      updateJob(jobDAO, completed);

      LOG.info(
          "Job {} completed with status {} (success: {}, failed: {})",
          jobId,
          newStatus,
          completed.getSuccessRecords(),
          completed.getFailedRecords());
    }
  }

  /**
   * Reclaim stale partitions that have not been updated within the timeout period.
   *
   * <p>Partitions that can still be retried are reset to PENDING. Partitions that have exceeded
   * the max retry limit are marked as FAILED to prevent infinite retry loops.
   *
   * @param jobId The job ID
   * @return Number of partitions reclaimed for retry
   */
  public int reclaimStalePartitions(UUID jobId) {
    SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

    long staleThreshold = System.currentTimeMillis() - PARTITION_CLAIM_TIMEOUT_MS;
    long now = System.currentTimeMillis();

    // First, fail partitions that have exceeded max retries
    int failed =
        partitionDAO.failStalePartitionsExceedingRetries(
            jobId.toString(), staleThreshold, MAX_PARTITION_RETRIES, now);
    if (failed > 0) {
      LOG.warn(
          "Marked {} stale partitions as FAILED for job {} (exceeded {} retries)",
          failed,
          jobId,
          MAX_PARTITION_RETRIES);
      checkAndUpdateJobCompletion(jobId);
    }

    // Then, reclaim partitions that can still be retried
    int reclaimed =
        partitionDAO.reclaimStalePartitionsForRetry(
            jobId.toString(), staleThreshold, MAX_PARTITION_RETRIES);

    if (reclaimed > 0) {
      LOG.info("Reclaimed {} stale partitions for job {}", reclaimed, jobId);
    }

    return reclaimed;
  }

  /**
   * Try to acquire the global reindex lock.
   *
   * @param jobId The job ID requesting the lock
   * @return true if lock was acquired
   */
  public boolean tryAcquireReindexLock(UUID jobId) {
    SearchReindexLockDAO lockDAO = collectionDAO.searchReindexLockDAO();

    long now = System.currentTimeMillis();
    long expiresAt = now + LOCK_TIMEOUT_MS;

    try {
      return lockDAO.tryAcquireLock(REINDEX_LOCK_KEY, jobId.toString(), serverId, now, expiresAt);
    } catch (Exception e) {
      LOG.debug("Failed to acquire reindex lock: {}", e.getMessage());
      return false;
    }
  }

  /**
   * Release the global reindex lock.
   *
   * @param jobId The job ID holding the lock
   */
  public void releaseReindexLock(UUID jobId) {
    SearchReindexLockDAO lockDAO = collectionDAO.searchReindexLockDAO();
    lockDAO.releaseLock(REINDEX_LOCK_KEY, jobId.toString());
    LOG.debug("Released reindex lock for job {}", jobId);
  }

  /**
   * Refresh the reindex lock to prevent expiration.
   *
   * @param jobId The job ID holding the lock
   * @return true if lock was refreshed
   */
  public boolean refreshReindexLock(UUID jobId) {
    SearchReindexLockDAO lockDAO = collectionDAO.searchReindexLockDAO();

    long now = System.currentTimeMillis();
    long expiresAt = now + LOCK_TIMEOUT_MS;

    return lockDAO.refreshLock(REINDEX_LOCK_KEY, jobId.toString(), serverId, now, expiresAt);
  }

  /**
   * Atomically transfer the reindex lock from one job ID to another.
   *
   * @param fromJobId The current job ID holding the lock
   * @param toJobId The new job ID to transfer the lock to
   * @return true if transfer succeeded, false if lock was lost
   */
  public boolean transferReindexLock(UUID fromJobId, UUID toJobId) {
    SearchReindexLockDAO lockDAO = collectionDAO.searchReindexLockDAO();

    long now = System.currentTimeMillis();
    long expiresAt = now + LOCK_TIMEOUT_MS;

    boolean transferred =
        lockDAO.transferLock(
            REINDEX_LOCK_KEY, fromJobId.toString(), toJobId.toString(), serverId, now, expiresAt);

    if (!transferred) {
      LOG.error(
          "Failed to transfer reindex lock from {} to {} - lock was lost to another server",
          fromJobId,
          toJobId);
    } else {
      LOG.debug("Transferred reindex lock from {} to {}", fromJobId, toJobId);
    }
    return transferred;
  }

  /**
   * Generate a unique prefix for staged indices during recreation.
   *
   * @return The target index prefix
   */
  private String generateTargetIndexPrefix() {
    return "staged_" + System.currentTimeMillis() + "_";
  }

  /**
   * Get recent jobs, optionally filtered by status.
   *
   * @param statuses Optional list of statuses to filter by
   * @param limit Maximum number of jobs to return
   * @return List of recent jobs
   */
  public List<SearchIndexJob> getRecentJobs(List<IndexJobStatus> statuses, int limit) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();

    List<SearchIndexJobRecord> records;
    if (statuses != null && !statuses.isEmpty()) {
      List<String> statusNames = statuses.stream().map(Enum::name).toList();
      records = jobDAO.findByStatusesWithLimit(statusNames, limit);
    } else {
      records = jobDAO.listRecent(limit);
    }

    return records.stream().map(this::recordToJob).collect(Collectors.toList());
  }

  /**
   * Update the staged index mapping for a job. This mapping tells participant servers which staged
   * index to write to for each entity type during index recreation.
   *
   * @param jobId The job ID
   * @param stagedIndexMapping Map of entity type to staged index name
   */
  public void updateStagedIndexMapping(UUID jobId, Map<String, String> stagedIndexMapping) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
    String mappingJson =
        stagedIndexMapping != null ? JsonUtils.pojoToJson(stagedIndexMapping) : null;
    jobDAO.updateStagedIndexMapping(jobId.toString(), mappingJson, System.currentTimeMillis());
    LOG.info("Updated staged index mapping for job {}: {}", jobId, stagedIndexMapping);
  }

  /**
   * Delete a job and all its partitions.
   *
   * @param jobId The job ID
   */
  public void deleteJob(UUID jobId) {
    SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();

    SearchIndexJobRecord record = jobDAO.findById(jobId.toString());
    if (record == null) {
      LOG.warn("Job not found for deletion: {}", jobId);
      return;
    }

    SearchIndexJob job = recordToJob(record);
    if (!job.isTerminal()) {
      throw new IllegalStateException(
          "Cannot delete job in non-terminal state: " + job.getStatus());
    }

    // Partitions are deleted via CASCADE
    jobDAO.delete(jobId.toString());

    LOG.info("Deleted job {} and its partitions", jobId);
  }

  // ========== Helper methods for record/domain conversion ==========

  private SearchIndexJob getJobById(SearchIndexJobDAO jobDAO, UUID jobId) {
    SearchIndexJobRecord record = jobDAO.findById(jobId.toString());
    if (record == null) {
      throw new IllegalArgumentException("Job not found: " + jobId);
    }
    return recordToJob(record);
  }

  private void insertJob(SearchIndexJobDAO jobDAO, SearchIndexJob job) {
    String jobConfigJson = JsonUtils.pojoToJson(job.getJobConfiguration());
    String statsJson =
        job.getEntityStats() != null ? JsonUtils.pojoToJson(job.getEntityStats()) : null;

    jobDAO.insert(
        job.getId().toString(),
        job.getStatus().name(),
        jobConfigJson,
        job.getTargetIndexPrefix(),
        job.getTotalRecords(),
        job.getProcessedRecords(),
        job.getSuccessRecords(),
        job.getFailedRecords(),
        statsJson,
        job.getCreatedBy(),
        job.getCreatedAt(),
        job.getUpdatedAt(),
        null);
  }

  private void updateJob(SearchIndexJobDAO jobDAO, SearchIndexJob job) {
    String statsJson =
        job.getEntityStats() != null ? JsonUtils.pojoToJson(job.getEntityStats()) : null;

    jobDAO.update(
        job.getId().toString(),
        job.getStatus().name(),
        job.getProcessedRecords(),
        job.getSuccessRecords(),
        job.getFailedRecords(),
        statsJson,
        job.getStartedAt(),
        job.getCompletedAt(),
        job.getUpdatedAt(),
        job.getErrorMessage());
  }

  @SuppressWarnings("unchecked")
  private SearchIndexJob recordToJob(SearchIndexJobRecord record) {
    EventPublisherJob jobConfig =
        JsonUtils.readValue(record.jobConfiguration(), EventPublisherJob.class);

    Map<String, SearchIndexJob.EntityTypeStats> entityStats = null;
    Map<String, String> stagedIndexMapping = null;

    // Parse staged index mapping from dedicated column
    if (record.stagedIndexMapping() != null) {
      stagedIndexMapping = JsonUtils.readValue(record.stagedIndexMapping(), Map.class);
    }

    // Parse entity stats
    if (record.stats() != null) {
      Map<String, Object> statsMap = JsonUtils.readValue(record.stats(), Map.class);
      entityStats = new HashMap<>();

      for (Map.Entry<String, Object> entry : statsMap.entrySet()) {
        Map<String, Object> es = (Map<String, Object>) entry.getValue();
        entityStats.put(
            entry.getKey(),
            SearchIndexJob.EntityTypeStats.builder()
                .entityType((String) es.get("entityType"))
                .totalRecords(((Number) es.getOrDefault("totalRecords", 0)).longValue())
                .processedRecords(((Number) es.getOrDefault("processedRecords", 0)).longValue())
                .successRecords(((Number) es.getOrDefault("successRecords", 0)).longValue())
                .failedRecords(((Number) es.getOrDefault("failedRecords", 0)).longValue())
                .totalPartitions(((Number) es.getOrDefault("totalPartitions", 0)).intValue())
                .completedPartitions(
                    ((Number) es.getOrDefault("completedPartitions", 0)).intValue())
                .failedPartitions(((Number) es.getOrDefault("failedPartitions", 0)).intValue())
                .build());
      }
    }

    return SearchIndexJob.builder()
        .id(UUID.fromString(record.id()))
        .status(IndexJobStatus.valueOf(record.status()))
        .jobConfiguration(jobConfig)
        .targetIndexPrefix(record.targetIndexPrefix())
        .stagedIndexMapping(stagedIndexMapping)
        .totalRecords(record.totalRecords())
        .processedRecords(record.processedRecords())
        .successRecords(record.successRecords())
        .failedRecords(record.failedRecords())
        .entityStats(entityStats)
        .createdBy(record.createdBy())
        .createdAt(record.createdAt())
        .startedAt(record.startedAt())
        .completedAt(record.completedAt())
        .updatedAt(record.updatedAt())
        .errorMessage(record.errorMessage())
        .registrationDeadline(record.registrationDeadline())
        .registeredServerCount(record.registeredServerCount())
        .build();
  }

  private void insertPartition(
      SearchIndexPartitionDAO partitionDAO, SearchIndexPartition partition) {
    partitionDAO.insert(
        partition.getId().toString(),
        partition.getJobId().toString(),
        partition.getEntityType(),
        partition.getPartitionIndex(),
        partition.getRangeStart(),
        partition.getRangeEnd(),
        partition.getEstimatedCount(),
        partition.getWorkUnits(),
        partition.getPriority(),
        partition.getStatus().name(),
        partition.getCursor(),
        partition.getClaimableAt());
  }

  private SearchIndexPartition recordToPartition(SearchIndexPartitionRecord record) {
    return SearchIndexPartition.builder()
        .id(UUID.fromString(record.id()))
        .jobId(UUID.fromString(record.jobId()))
        .entityType(record.entityType())
        .partitionIndex(record.partitionIndex())
        .rangeStart(record.rangeStart())
        .rangeEnd(record.rangeEnd())
        .estimatedCount(record.estimatedCount())
        .workUnits(record.workUnits())
        .priority(record.priority())
        .status(PartitionStatus.valueOf(record.status()))
        .cursor(record.cursor())
        .processedCount(record.processedCount())
        .successCount(record.successCount())
        .failedCount(record.failedCount())
        .assignedServer(record.assignedServer())
        .claimedAt(record.claimedAt())
        .startedAt(record.startedAt())
        .completedAt(record.completedAt())
        .lastUpdateAt(record.lastUpdateAt())
        .lastError(record.lastError())
        .retryCount(record.retryCount())
        .claimableAt(record.claimableAt())
        .build();
  }
}
