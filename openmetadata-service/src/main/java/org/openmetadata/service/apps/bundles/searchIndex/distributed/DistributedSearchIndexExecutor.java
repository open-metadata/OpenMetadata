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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.CompositeProgressListener;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;

/**
 * Executor for distributed search index jobs.
 *
 * <p>This class orchestrates the distributed indexing process: - Creates or joins an existing job -
 * Claims and processes partitions in parallel - Coordinates with other servers via the database -
 * Reports progress via WebSocket
 *
 * <p>Includes robust handling for:
 * <ul>
 *   <li>Concurrent job prevention via distributed locking with refresh</li>
 *   <li>Server crash detection and partition reassignment</li>
 *   <li>Process crash recovery via startup checks</li>
 * </ul>
 */
@Slf4j
public class DistributedSearchIndexExecutor {

  /**
   * Set of job IDs currently being coordinated by this server. Used to prevent
   * DistributedJobParticipant from joining jobs that this server is coordinating.
   */
  private static final Set<UUID> COORDINATED_JOBS =
      java.util.Collections.synchronizedSet(new java.util.HashSet<>());

  /** Check if a job is being coordinated by this server. */
  public static boolean isCoordinatingJob(UUID jobId) {
    return COORDINATED_JOBS.contains(jobId);
  }

  /** Maximum number of concurrent partition workers per server */
  private static final int MAX_WORKER_THREADS = 10;

  /** Time to wait for workers to finish on shutdown */
  private static final long SHUTDOWN_TIMEOUT_SECONDS = 60;

  /** Interval for checking stale partitions */
  private static final long STALE_CHECK_INTERVAL_MS = 30000;

  /** Interval for refreshing the distributed lock */
  private static final long LOCK_REFRESH_INTERVAL_MS = 60000;

  /** Interval for updating partition heartbeats */
  private static final long PARTITION_HEARTBEAT_INTERVAL_MS = 30000;

  private final CollectionDAO collectionDAO;
  private final DistributedSearchIndexCoordinator coordinator;
  private final JobRecoveryManager recoveryManager;
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  private final String serverId;
  private final CompositeProgressListener listeners = new CompositeProgressListener();

  @Getter private SearchIndexJob currentJob;
  private DistributedJobStatsAggregator statsAggregator;
  private ExecutorService workerExecutor;
  private final List<PartitionWorker> activeWorkers = new ArrayList<>();
  private Thread lockRefreshThread;
  private Thread partitionHeartbeatThread;

  // App context for WebSocket broadcasts
  private UUID appId;
  private Long appStartTime;

  // Notifier for alerting other servers when job starts
  private DistributedJobNotifier jobNotifier;

  // Job context for listener callbacks
  private ReindexingJobContext jobContext;

  // Failure recording
  private IndexingFailureRecorder failureRecorder;
  private BulkSink searchIndexSink;

  // Per-entity index promotion
  private EntityCompletionTracker entityTracker;
  private RecreateIndexHandler recreateIndexHandler;
  private ReindexContext recreateContext;

  // Reader stats tracking (accumulated across all worker threads)
  private final AtomicLong coordinatorReaderSuccess = new AtomicLong(0);
  private final AtomicLong coordinatorReaderFailed = new AtomicLong(0);
  private final AtomicLong coordinatorReaderWarnings = new AtomicLong(0);
  private final AtomicInteger coordinatorPartitionsCompleted = new AtomicInteger(0);
  private final AtomicInteger coordinatorPartitionsFailed = new AtomicInteger(0);

  public DistributedSearchIndexExecutor(CollectionDAO collectionDAO) {
    this(collectionDAO, 10000); // Default partition size
  }

  public DistributedSearchIndexExecutor(CollectionDAO collectionDAO, int partitionSize) {
    this.collectionDAO = collectionDAO;
    PartitionCalculator calculator = new PartitionCalculator(partitionSize);
    this.coordinator = new DistributedSearchIndexCoordinator(collectionDAO, calculator);
    this.recoveryManager = new JobRecoveryManager(collectionDAO, partitionSize);
    this.serverId = ServerIdentityResolver.getInstance().getServerId();
  }

  /**
   * Add a progress listener to receive callbacks during job execution.
   *
   * @param listener The progress listener to add
   * @return This executor for method chaining
   */
  public DistributedSearchIndexExecutor addListener(ReindexingProgressListener listener) {
    listeners.addListener(listener);
    return this;
  }

  /**
   * Remove a progress listener.
   *
   * @param listener The progress listener to remove
   * @return This executor for method chaining
   */
  public DistributedSearchIndexExecutor removeListener(ReindexingProgressListener listener) {
    listeners.removeListener(listener);
    return this;
  }

  /**
   * Get the number of registered listeners.
   *
   * @return The listener count
   */
  public int getListenerCount() {
    return listeners.getListenerCount();
  }

  /**
   * Set the app context for WebSocket broadcasts. This allows the stats aggregator to include the
   * correct app ID and start time so the frontend can match WebSocket updates to existing records.
   *
   * @param appId The application ID
   * @param startTime The job start time (as recorded in the app run record)
   */
  public void setAppContext(UUID appId, Long startTime) {
    this.appId = appId;
    this.appStartTime = startTime;
  }

  /**
   * Set the job notifier for alerting other servers when a job starts. When set, other servers in
   * the cluster will be notified via Redis Pub/Sub (if available) or discovered via polling.
   *
   * @param notifier The job notifier
   */
  public void setJobNotifier(DistributedJobNotifier notifier) {
    this.jobNotifier = notifier;
  }

  /**
   * Create and initialize a new distributed indexing job.
   *
   * @param entities Set of entity types to index
   * @param jobConfiguration The job configuration
   * @param createdBy User who initiated the job
   * @return The created job
   */
  public SearchIndexJob createJob(
      Set<String> entities, EventPublisherJob jobConfiguration, String createdBy) {

    LOG.info("Creating distributed indexing job for {} entity types", entities.size());

    // First, check if there's already a blocking job (and try to recover orphaned ones)
    Optional<SearchIndexJob> blockingJob = recoveryManager.checkForBlockingJob();
    if (blockingJob.isPresent()) {
      SearchIndexJob blocker = blockingJob.get();
      throw new IllegalStateException(
          String.format(
              "Cannot start new reindexing job - another job is already %s: %s (started: %s)",
              blocker.getStatus().name().toLowerCase(),
              blocker.getId(),
              blocker.getStartedAt() != null
                  ? new java.util.Date(blocker.getStartedAt())
                  : "not started"));
    }

    // Try to acquire the global reindex lock
    UUID tempJobId = UUID.randomUUID();
    if (!coordinator.tryAcquireReindexLock(tempJobId)) {
      // Double-check for running jobs
      List<SearchIndexJob> runningJobs =
          coordinator.getRecentJobs(List.of(IndexJobStatus.RUNNING, IndexJobStatus.READY), 1);
      if (!runningJobs.isEmpty()) {
        throw new IllegalStateException(
            "A reindexing job is already running: " + runningJobs.getFirst().getId());
      }
      throw new IllegalStateException(
          "Failed to acquire reindex lock - another operation may be in progress");
    }

    try {
      // Create the job
      SearchIndexJob job = coordinator.createJob(entities, jobConfiguration, createdBy);

      // Initialize partitions
      currentJob = coordinator.initializePartitions(job.getId());

      // Atomically transfer lock to real job ID
      boolean transferred = coordinator.transferReindexLock(tempJobId, currentJob.getId());
      if (!transferred) {
        // Lock was lost - another server may have started a job
        // Mark our job as failed since we can't safely proceed without the lock
        markJobAsFailed(currentJob.getId(), "Failed to acquire lock - another job may be running");
        throw new IllegalStateException(
            "Failed to transfer reindex lock - another server may have started a conflicting job");
      }

      LOG.info(
          "Created job {} with {} total records across {} entity types",
          currentJob.getId(),
          currentJob.getTotalRecords(),
          entities.size());

      return currentJob;

    } catch (Exception e) {
      coordinator.releaseReindexLock(tempJobId);
      throw e;
    }
  }

  /**
   * Perform startup recovery to handle any orphaned jobs from previous crashes.
   *
   * @return Recovery result with details of what was recovered/failed
   */
  public JobRecoveryManager.RecoveryResult performStartupRecovery() {
    return recoveryManager.performStartupRecovery();
  }

  /**
   * Join an existing distributed job instead of creating a new one.
   *
   * @param jobId The job ID to join
   * @return The job, or empty if not found
   */
  public Optional<SearchIndexJob> joinJob(UUID jobId) {
    Optional<SearchIndexJob> jobOpt = coordinator.getJob(jobId);
    if (jobOpt.isPresent()) {
      currentJob = jobOpt.get();
      LOG.info("Server {} joined job {}", serverId, jobId);
    }
    return jobOpt;
  }

  /**
   * Execute the distributed indexing job.
   *
   * <p>This method: 1. Starts the job if in READY state 2. Claims and processes partitions until
   * none remain 3. Coordinates with other servers for load balancing
   *
   * @param bulkSink The sink for writing to search index
   * @param recreateContext Context for index recreation, if applicable
   * @param recreateIndex Whether indices should be recreated
   * @return Execution result with statistics
   */
  public ExecutionResult execute(
      BulkSink bulkSink, ReindexContext recreateContext, boolean recreateIndex) {

    if (currentJob == null) {
      throw new IllegalStateException("No job to execute - call createJob() or joinJob() first");
    }

    UUID jobId = currentJob.getId();
    LOG.info("Server {} starting execution of job {}", serverId, jobId);

    // Start the job if in READY state
    if (currentJob.getStatus() == IndexJobStatus.READY) {
      coordinator.startJob(jobId);
      currentJob = coordinator.getJob(jobId).orElseThrow();

      // Notify other servers that a job has started so they can participate
      if (jobNotifier != null) {
        jobNotifier.notifyJobStarted(jobId, "SEARCH_INDEX");
        LOG.info("Notified other servers about job {} via {}", jobId, jobNotifier.getType());
      }
    }

    if (currentJob.getStatus() != IndexJobStatus.RUNNING) {
      throw new IllegalStateException(
          "Job must be in RUNNING state to execute. Current: " + currentJob.getStatus());
    }

    // Mark this job as being coordinated by this server (prevents participant from joining)
    COORDINATED_JOBS.add(jobId);
    LOG.debug("Marked job {} as coordinated by this server", jobId);

    // Create job context for listener callbacks
    jobContext = new DistributedJobContext(currentJob);

    // Notify listeners that job has started
    listeners.onJobStarted(jobContext);

    // Notify listeners with configuration
    if (currentJob.getJobConfiguration() != null) {
      ReindexingConfiguration config =
          ReindexingConfiguration.from(currentJob.getJobConfiguration());
      listeners.onJobConfigured(jobContext, config);
    }

    // Create stats aggregator with app context for proper WebSocket matching
    statsAggregator =
        new DistributedJobStatsAggregator(
            coordinator,
            jobId,
            appId,
            appStartTime,
            DistributedJobStatsAggregator.DEFAULT_POLL_INTERVAL_MS);

    // Set up progress listener on stats aggregator
    if (listeners.getListenerCount() > 0) {
      statsAggregator.setProgressListener(listeners, jobContext);
    }

    statsAggregator.start();

    // Store sink reference for stats persistence
    this.searchIndexSink = bulkSink;

    // Initialize failure recorder
    this.failureRecorder = new IndexingFailureRecorder(collectionDAO, jobId.toString(), serverId);

    // Set up failure callback on the sink to record sink failures
    bulkSink.setFailureCallback(
        (entityType, entityId, entityFqn, errorMessage) -> {
          if (failureRecorder != null) {
            failureRecorder.recordSinkFailure(entityType, entityId, entityFqn, errorMessage);
          }
        });

    // Stats are tracked per-entityType by StageStatsTracker in PartitionWorker
    // No need for redundant server-level stats persistence

    // Store recreate context for per-entity promotion
    this.recreateContext = recreateContext;

    // Initialize entity completion tracker for per-entity index promotion
    this.entityTracker = new EntityCompletionTracker(jobId);
    initializeEntityTracker(jobId, recreateIndex);
    coordinator.setEntityCompletionTracker(entityTracker);

    // Start lock refresh thread to prevent lock expiration during long-running jobs
    lockRefreshThread =
        Thread.ofVirtual()
            .name("lock-refresh-" + jobId.toString().substring(0, 8))
            .start(() -> runLockRefreshLoop(jobId));

    // Start partition heartbeat thread to keep owned partitions alive
    partitionHeartbeatThread =
        Thread.ofVirtual()
            .name("partition-heartbeat-" + jobId.toString().substring(0, 8))
            .start(() -> runPartitionHeartbeatLoop());

    // Calculate worker threads based on configuration
    int numWorkers =
        Math.min(
            currentJob.getJobConfiguration().getConsumerThreads() != null
                ? currentJob.getJobConfiguration().getConsumerThreads()
                : 4,
            MAX_WORKER_THREADS);

    workerExecutor =
        Executors.newFixedThreadPool(
            numWorkers, Thread.ofPlatform().name("partition-worker-", 0).factory());

    AtomicLong totalSuccess = new AtomicLong(0);
    AtomicLong totalFailed = new AtomicLong(0);
    CountDownLatch workerLatch = new CountDownLatch(numWorkers);

    // Start worker threads that continuously claim and process partitions
    int batchSize =
        currentJob.getJobConfiguration().getBatchSize() != null
            ? currentJob.getJobConfiguration().getBatchSize()
            : 500;

    for (int i = 0; i < numWorkers; i++) {
      final int workerId = i;
      workerExecutor.submit(
          () -> {
            try {
              runWorkerLoop(
                  workerId,
                  bulkSink,
                  batchSize,
                  recreateContext,
                  recreateIndex,
                  totalSuccess,
                  totalFailed);
            } finally {
              workerLatch.countDown();
            }
          });
    }

    // Start stale partition reclaimer in a separate thread
    Thread staleReclaimer =
        Thread.ofVirtual()
            .name("stale-reclaimer-" + jobId.toString().substring(0, 8))
            .start(() -> runStaleReclaimerLoop(jobId));

    try {
      // Wait for all workers to complete
      workerLatch.await();
      LOG.info("All workers completed for job {}", jobId);

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Execution interrupted for job {}", jobId);
    } finally {
      // Stop all background threads
      staleReclaimer.interrupt();
      if (lockRefreshThread != null) {
        lockRefreshThread.interrupt();
      }
      if (partitionHeartbeatThread != null) {
        partitionHeartbeatThread.interrupt();
      }

      // Shutdown executor
      workerExecutor.shutdown();
      try {
        if (!workerExecutor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
          workerExecutor.shutdownNow();
        }
      } catch (InterruptedException e) {
        workerExecutor.shutdownNow();
        Thread.currentThread().interrupt();
      }

      // Flush sink and wait for all pending bulk requests to complete
      if (searchIndexSink != null) {
        LOG.info("Flushing sink and waiting for pending requests");
        boolean completed = searchIndexSink.flushAndAwait(60);
        if (!completed) {
          LOG.warn("Sink flush timed out - some requests may not be reflected in final stats");
        }
      }

      // Stats are tracked per-entityType by StageStatsTracker in PartitionWorker
      // No need for redundant server-level stats persistence

      // Final stats broadcast and cleanup
      statsAggregator.forceUpdate();
      statsAggregator.stop();

      // Flush and close failure recorder
      if (failureRecorder != null) {
        failureRecorder.close();
      }

      // Clear failure callback from sink
      if (searchIndexSink != null) {
        searchIndexSink.setFailureCallback(null);
      }

      // Notify other servers that job has completed
      if (jobNotifier != null) {
        jobNotifier.notifyJobCompleted(jobId);
      }

      // Release lock
      coordinator.releaseReindexLock(jobId);

      // Remove from coordinated jobs set
      COORDINATED_JOBS.remove(jobId);
      LOG.debug("Removed job {} from coordinated jobs set", jobId);
    }

    // Get final job state
    currentJob = coordinator.getJobWithAggregatedStats(jobId);

    return new ExecutionResult(
        currentJob.getStatus(),
        currentJob.getTotalRecords(),
        currentJob.getSuccessRecords(),
        currentJob.getFailedRecords(),
        currentJob.getStartedAt(),
        currentJob.getCompletedAt());
  }

  /**
   * Worker loop that continuously claims and processes partitions.
   */
  private void runWorkerLoop(
      int workerId,
      BulkSink bulkSink,
      int batchSize,
      ReindexContext recreateContext,
      boolean recreateIndex,
      AtomicLong totalSuccess,
      AtomicLong totalFailed) {

    LOG.info("Worker {} starting for job {}", workerId, currentJob.getId());

    PartitionWorker worker =
        new PartitionWorker(
            coordinator, bulkSink, batchSize, recreateContext, recreateIndex, failureRecorder);

    synchronized (activeWorkers) {
      activeWorkers.add(worker);
    }

    int claimAttempts = 0;

    try {
      while (!stopped.get()) {
        // Check if job is being stopped
        SearchIndexJob job = coordinator.getJob(currentJob.getId()).orElse(null);
        if (job == null || job.getStatus() == IndexJobStatus.STOPPING || job.isTerminal()) {
          LOG.info(
              "Worker {} stopping - job state: {}",
              workerId,
              job != null ? job.getStatus() : "null");
          break;
        }

        // Try to claim a partition
        claimAttempts++;
        Optional<SearchIndexPartition> partitionOpt =
            coordinator.claimNextPartition(currentJob.getId());

        if (partitionOpt.isEmpty()) {
          // No more partitions available - log at INFO level on first attempt
          if (claimAttempts == 1) {
            LOG.info("Worker {} could not claim partition on first attempt", workerId);
          } else {
            LOG.debug(
                "Worker {} found no available partitions (attempt {})", workerId, claimAttempts);
          }

          // Check if all partitions are done (not just unavailable)
          List<SearchIndexPartition> pending =
              coordinator.getPartitions(currentJob.getId(), PartitionStatus.PENDING);
          List<SearchIndexPartition> processing =
              coordinator.getPartitions(currentJob.getId(), PartitionStatus.PROCESSING);

          if (pending.isEmpty() && processing.isEmpty()) {
            // Log detailed info about partition state on exit
            List<SearchIndexPartition> completed =
                coordinator.getPartitions(currentJob.getId(), PartitionStatus.COMPLETED);
            List<SearchIndexPartition> failed =
                coordinator.getPartitions(currentJob.getId(), PartitionStatus.FAILED);
            LOG.info(
                "Worker {} exiting - all partitions complete (attempts: {}, completed: {}, failed: {})",
                workerId,
                claimAttempts,
                completed.size(),
                failed.size());
            break;
          }

          // Wait a bit before retrying (other servers might release partitions)
          try {
            Thread.sleep(1000);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
          }
          continue;
        }

        // Process the partition
        SearchIndexPartition partition = partitionOpt.get();
        LOG.info(
            "Worker {} processing partition {} for {}",
            workerId,
            partition.getId(),
            partition.getEntityType());

        PartitionWorker.PartitionResult result = worker.processPartition(partition);
        totalSuccess.addAndGet(result.successCount());
        totalFailed.addAndGet(result.failedCount());

        // Accumulate into coordinator stats for persistence
        // readerSuccess = entities successfully processed through reader
        // readerFailed = specifically reader failures (not sink failures)
        // readerWarnings = warnings from reader (e.g., stale references)
        coordinatorReaderSuccess.addAndGet(result.successCount());
        coordinatorReaderFailed.addAndGet(result.readerFailed());
        coordinatorReaderWarnings.addAndGet(result.readerWarnings());
        coordinatorPartitionsCompleted.incrementAndGet();

        LOG.info(
            "Worker {} completed partition {} (success: {}, failed: {}, readerFailed: {}, readerWarnings: {})",
            workerId,
            partition.getId(),
            result.successCount(),
            result.failedCount(),
            result.readerFailed(),
            result.readerWarnings());

        // Stats are tracked per-entityType by StageStatsTracker in PartitionWorker
      }
    } finally {
      synchronized (activeWorkers) {
        activeWorkers.remove(worker);
      }
      LOG.debug("Worker {} exiting", workerId);
    }
  }

  /**
   * Periodically checks for and reclaims stale partitions.
   */
  private void runStaleReclaimerLoop(UUID jobId) {
    while (!stopped.get() && !Thread.currentThread().isInterrupted()) {
      try {
        Thread.sleep(STALE_CHECK_INTERVAL_MS);

        SearchIndexJob job = coordinator.getJob(jobId).orElse(null);
        if (job == null || job.isTerminal()) {
          break;
        }

        int reclaimed = coordinator.reclaimStalePartitions(jobId);
        if (reclaimed > 0) {
          LOG.info("Reclaimed {} stale partitions for job {}", reclaimed, jobId);
        }

      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      } catch (Exception e) {
        LOG.error("Error in stale reclaimer for job {}", jobId, e);
      }
    }
  }

  /**
   * Periodically refreshes the distributed lock to prevent expiration during long-running jobs.
   *
   * <p>This ensures that if a job runs longer than the lock timeout, the lock is refreshed
   * and other servers won't mistakenly think the lock is abandoned.
   */
  private void runLockRefreshLoop(UUID jobId) {
    while (!stopped.get() && !Thread.currentThread().isInterrupted()) {
      try {
        Thread.sleep(LOCK_REFRESH_INTERVAL_MS);

        SearchIndexJob job = coordinator.getJob(jobId).orElse(null);
        if (job == null || job.isTerminal()) {
          LOG.debug("Lock refresh loop exiting - job {} is terminal or not found", jobId);
          break;
        }

        boolean refreshed = coordinator.refreshReindexLock(jobId);
        if (refreshed) {
          LOG.debug("Refreshed reindex lock for job {}", jobId);
        } else {
          LOG.warn("Failed to refresh reindex lock for job {} - lock may have been stolen", jobId);
          // Mark the job as failed since we lost the lock
          markJobAsFailedDueToLostLock(jobId);
          stop();
          break;
        }

      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      } catch (Exception e) {
        LOG.error("Error refreshing lock for job {}", jobId, e);
      }
    }
  }

  /**
   * Periodically updates heartbeats for partitions being processed by this server.
   *
   * <p>This ensures that if a partition takes a long time to process (but is still active),
   * other servers won't reclaim it as stale.
   */
  private void runPartitionHeartbeatLoop() {
    while (!stopped.get() && !Thread.currentThread().isInterrupted()) {
      try {
        Thread.sleep(PARTITION_HEARTBEAT_INTERVAL_MS);

        // Get all processing partitions assigned to this server
        if (currentJob == null || currentJob.isTerminal()) {
          break;
        }

        List<SearchIndexPartition> processing =
            coordinator.getPartitions(currentJob.getId(), PartitionStatus.PROCESSING);

        int updated = 0;
        long now = System.currentTimeMillis();
        for (SearchIndexPartition partition : processing) {
          if (serverId.equals(partition.getAssignedServer())) {
            // Update the heartbeat for this partition
            collectionDAO
                .searchIndexPartitionDAO()
                .updateHeartbeat(partition.getId().toString(), now);
            updated++;
          }
        }

        if (updated > 0) {
          LOG.debug("Updated heartbeats for {} partitions", updated);
        }

      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      } catch (Exception e) {
        LOG.error("Error updating partition heartbeats", e);
      }
    }
  }

  public IndexingFailureRecorder getFailureRecorder() {
    return failureRecorder;
  }

  /**
   * Mark a job as failed with a custom error message.
   *
   * @param jobId The job ID
   * @param errorMessage The error message
   */
  private void markJobAsFailed(UUID jobId, String errorMessage) {
    try {
      CollectionDAO.SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
      CollectionDAO.SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

      CollectionDAO.SearchIndexPartitionDAO.AggregatedStatsRecord stats =
          partitionDAO.getAggregatedStats(jobId.toString());

      long now = System.currentTimeMillis();

      jobDAO.update(
          jobId.toString(),
          IndexJobStatus.FAILED.name(),
          stats != null ? stats.processedRecords() : 0,
          stats != null ? stats.successRecords() : 0,
          stats != null ? stats.failedRecords() : 0,
          null,
          null,
          now,
          now,
          errorMessage);

      partitionDAO.cancelPendingPartitions(jobId.toString());

      LOG.error("Job {} marked as FAILED: {}", jobId, errorMessage);
    } catch (Exception e) {
      LOG.error("Error marking job {} as failed", jobId, e);
    }
  }

  /**
   * Mark a job as failed because we lost the distributed lock.
   *
   * @param jobId The job ID
   */
  private void markJobAsFailedDueToLostLock(UUID jobId) {
    try {
      CollectionDAO.SearchIndexJobDAO jobDAO = collectionDAO.searchIndexJobDAO();
      CollectionDAO.SearchIndexPartitionDAO partitionDAO = collectionDAO.searchIndexPartitionDAO();

      CollectionDAO.SearchIndexPartitionDAO.AggregatedStatsRecord stats =
          partitionDAO.getAggregatedStats(jobId.toString());

      long now = System.currentTimeMillis();

      jobDAO.update(
          jobId.toString(),
          IndexJobStatus.FAILED.name(),
          stats != null ? stats.processedRecords() : 0,
          stats != null ? stats.successRecords() : 0,
          stats != null ? stats.failedRecords() : 0,
          null,
          null,
          now,
          now,
          "Lost distributed lock - another server may have taken over or lock expired");

      partitionDAO.cancelPendingPartitions(jobId.toString());

      LOG.error("Job {} marked as FAILED due to lost distributed lock", jobId);
    } catch (Exception e) {
      LOG.error("Error marking job {} as failed", jobId, e);
    }
  }

  /**
   * Request to stop the current job execution.
   */
  public void stop() {
    if (stopped.compareAndSet(false, true)) {
      LOG.info("Stop requested for distributed executor");

      // Stop all active workers
      synchronized (activeWorkers) {
        for (PartitionWorker worker : activeWorkers) {
          worker.stop();
        }
      }

      // Request job stop via coordinator
      if (currentJob != null) {
        coordinator.requestStop(currentJob.getId());
      }
    }
  }

  /**
   * Check if stop has been requested.
   *
   * @return true if stop was requested
   */
  public boolean isStopped() {
    return stopped.get();
  }

  /**
   * Get fresh job stats from the database.
   *
   * <p>Unlike getCurrentJob() which returns a cached reference, this method queries the database
   * for the latest aggregated statistics.
   *
   * @return The job with current aggregated stats, or null if no job is active
   */
  public SearchIndexJob getJobWithFreshStats() {
    if (currentJob == null) {
      return null;
    }
    return coordinator.getJobWithAggregatedStats(currentJob.getId());
  }

  /**
   * Get the entity completion tracker for checking which entities have been promoted.
   *
   * @return The entity completion tracker, or null if not initialized
   */
  public EntityCompletionTracker getEntityTracker() {
    return entityTracker;
  }

  /**
   * Update the staged index mapping for the current job. This mapping tells participant servers
   * which staged index to write to for each entity type during index recreation.
   *
   * @param stagedIndexMapping Map of entity type to staged index name
   */
  public void updateStagedIndexMapping(Map<String, String> stagedIndexMapping) {
    if (currentJob == null) {
      LOG.warn("Cannot update staged index mapping - no current job");
      return;
    }
    coordinator.updateStagedIndexMapping(currentJob.getId(), stagedIndexMapping);
  }

  /**
   * Initialize the entity completion tracker with partition counts and promotion callback.
   */
  private void initializeEntityTracker(UUID jobId, boolean recreateIndex) {
    // Count partitions per entity
    Map<String, Integer> partitionCountByEntity = new HashMap<>();
    List<SearchIndexPartition> allPartitions = coordinator.getPartitions(jobId, null);
    for (SearchIndexPartition p : allPartitions) {
      partitionCountByEntity.merge(p.getEntityType(), 1, Integer::sum);
    }

    // Initialize tracking for each entity
    for (Map.Entry<String, Integer> entry : partitionCountByEntity.entrySet()) {
      entityTracker.initializeEntity(entry.getKey(), entry.getValue());
    }

    LOG.info(
        "Initialized entity tracker for job {} with {} entity types: {}",
        jobId,
        partitionCountByEntity.size(),
        partitionCountByEntity);

    // Set up per-entity promotion callback if recreating indices
    if (recreateIndex && recreateContext != null) {
      this.recreateIndexHandler = Entity.getSearchRepository().createReindexHandler();
      entityTracker.setOnEntityComplete(
          (entityType, success) -> promoteEntityIndex(entityType, success));
      LOG.info(
          "Per-entity promotion callback SET for job {} (recreateIndex={}, recreateContext entities={})",
          jobId,
          recreateIndex,
          recreateContext.getEntities());
    } else {
      LOG.info(
          "Per-entity promotion callback NOT set for job {} (recreateIndex={}, recreateContext={})",
          jobId,
          recreateIndex,
          recreateContext != null ? "present" : "null");
    }
  }

  /**
   * Promote a single entity's index when all its partitions complete.
   */
  private void promoteEntityIndex(String entityType, boolean success) {
    if (recreateIndexHandler == null || recreateContext == null) {
      LOG.warn(
          "Cannot promote index for entity '{}' - no recreateIndexHandler or recreateContext",
          entityType);
      return;
    }

    Optional<String> stagedIndexOpt = recreateContext.getStagedIndex(entityType);
    if (stagedIndexOpt.isEmpty()) {
      LOG.debug("No staged index for entity '{}', skipping promotion", entityType);
      return;
    }

    try {
      EntityReindexContext entityContext =
          EntityReindexContext.builder()
              .entityType(entityType)
              .originalIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
              .canonicalIndex(recreateContext.getCanonicalIndex(entityType).orElse(null))
              .activeIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
              .stagedIndex(stagedIndexOpt.get())
              .canonicalAliases(recreateContext.getCanonicalAlias(entityType).orElse(null))
              .existingAliases(recreateContext.getExistingAliases(entityType))
              .parentAliases(
                  new HashSet<>(listOrEmpty(recreateContext.getParentAliases(entityType))))
              .build();

      if (recreateIndexHandler instanceof DefaultRecreateHandler defaultHandler) {
        LOG.info("Promoting index for entity '{}' (success={})", entityType, success);
        defaultHandler.promoteEntityIndex(entityContext, success);
      } else {
        recreateIndexHandler.finalizeReindex(entityContext, success);
      }
    } catch (Exception e) {
      LOG.error("Failed to promote index for entity '{}'", entityType, e);
    }
  }

  /**
   * Result of job execution.
   */
  public record ExecutionResult(
      IndexJobStatus status,
      long totalRecords,
      long successRecords,
      long failedRecords,
      Long startedAt,
      Long completedAt) {

    public double getSuccessRate() {
      if (totalRecords == 0) return 0.0;
      return (successRecords * 100.0) / totalRecords;
    }

    public long getDurationMs() {
      if (startedAt == null || completedAt == null) return 0;
      return completedAt - startedAt;
    }
  }
}
