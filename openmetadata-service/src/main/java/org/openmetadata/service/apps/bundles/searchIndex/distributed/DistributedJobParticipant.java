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

import io.dropwizard.lifecycle.Managed;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

/**
 * Background service that monitors for active distributed indexing jobs and joins them to help
 * process partitions.
 *
 * <p>In a clustered environment, only one server will trigger the SearchIndexApp via Quartz. This
 * service runs on all servers and allows non-triggering servers to discover and participate in
 * active jobs.
 *
 * <p>Job discovery is handled by a {@link DistributedJobNotifier}:
 *
 * <ul>
 *   <li>When Redis is configured: Uses Redis Pub/Sub for instant notification
 *   <li>When Redis is not available: Falls back to database polling (30s interval)
 * </ul>
 */
@Slf4j
public class DistributedJobParticipant implements Managed {

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final String serverId;
  private final DistributedSearchIndexCoordinator coordinator;

  /**
   * -- GETTER --
   * Get the notifier being used (for testing/debugging).
   */
  @Getter private final DistributedJobNotifier notifier;

  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicBoolean participating = new AtomicBoolean(false);

  /**
   * -- GETTER --
   * Get the current job ID being processed, if any.
   */
  @Getter private UUID currentJobId;

  public DistributedJobParticipant(
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      String serverId,
      CacheConfig cacheConfig) {
    this(
        collectionDAO,
        searchRepository,
        serverId,
        DistributedJobNotifierFactory.create(cacheConfig, collectionDAO, serverId));
  }

  /**
   * Constructor that allows injection of a custom notifier (for testing).
   *
   * @param collectionDAO The collection DAO
   * @param searchRepository The search repository
   * @param serverId The server ID
   * @param notifier The job notifier to use
   */
  DistributedJobParticipant(
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      String serverId,
      DistributedJobNotifier notifier) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.serverId = serverId;
    this.coordinator = new DistributedSearchIndexCoordinator(collectionDAO);
    this.notifier = notifier;
  }

  /** Start the background job monitor. */
  @Override
  public void start() {
    if (running.compareAndSet(false, true)) {
      // Register callback to receive job start notifications
      notifier.onJobStarted(this::onJobDiscovered);

      // Start the notifier (Redis subscription or polling)
      notifier.start();

      LOG.info(
          "Started distributed job participant on server {} using {} notifier",
          serverId,
          notifier.getType());
    }
  }

  /** Stop the background monitor. */
  @Override
  public void stop() {
    if (running.compareAndSet(true, false)) {
      notifier.stop();
      LOG.info("Stopped distributed job participant on server {}", serverId);
    }
  }

  /**
   * Called when a job is discovered (either via Redis notification or polling).
   *
   * @param jobId The discovered job ID
   */
  private void onJobDiscovered(UUID jobId) {
    if (participating.get()) {
      LOG.debug("Already participating in a job, ignoring notification for {}", jobId);
      return;
    }

    try {
      Optional<SearchIndexJob> jobOpt = coordinator.getJob(jobId);
      if (jobOpt.isEmpty()) {
        LOG.warn("Job {} not found", jobId);
        return;
      }

      SearchIndexJob job = jobOpt.get();

      // Check if job is still running
      if (job.isTerminal()) {
        LOG.debug("Job {} is already terminal, ignoring", jobId);
        return;
      }

      if (job.getStatus() != IndexJobStatus.RUNNING) {
        LOG.debug("Job {} is not in RUNNING state ({}), ignoring", jobId, job.getStatus());
        return;
      }

      // Check if this server is coordinating this job (don't participate in our own job)
      if (DistributedSearchIndexExecutor.isCoordinatingJob(jobId)) {
        LOG.debug("Job {} is being coordinated by this server, participant will not join", jobId);
        return;
      }

      // Check if there are pending partitions we can help with
      long pendingCount = coordinator.getPartitions(job.getId(), PartitionStatus.PENDING).size();
      if (pendingCount == 0) {
        LOG.debug("No pending partitions to process for job {}", job.getId());
        return;
      }

      LOG.info(
          "Discovered active distributed job {} with {} pending partitions, joining...",
          job.getId(),
          pendingCount);

      joinAndProcessJob(job);

    } catch (Exception e) {
      LOG.error("Error handling job discovery for {}", jobId, e);
    }
  }

  /** Join an active job and help process partitions. */
  private void joinAndProcessJob(SearchIndexJob job) {
    if (!participating.compareAndSet(false, true)) {
      return;
    }

    currentJobId = job.getId();

    // Update polling notifier to use faster interval while participating
    if (notifier instanceof PollingJobNotifier pollingNotifier) {
      pollingNotifier.setParticipating(true);
    }

    Thread.ofVirtual()
        .name("job-participant-" + job.getId().toString().substring(0, 8))
        .start(
            () -> {
              try {
                processJobPartitions(job);
              } finally {
                participating.set(false);
                currentJobId = null;

                // Reset polling notifier to idle interval
                if (notifier instanceof PollingJobNotifier pollingNotifier) {
                  pollingNotifier.setParticipating(false);
                }
              }
            });
  }

  /** Process partitions for a job. */
  private void processJobPartitions(SearchIndexJob job) {
    LOG.info("Server {} joining distributed job {} to process partitions", serverId, job.getId());

    BulkSink bulkSink = null;
    IndexingFailureRecorder failureRecorder = null;
    try {
      // Create failure recorder for this participation
      failureRecorder =
          new IndexingFailureRecorder(collectionDAO, job.getId().toString(), serverId);

      // Create bulk sink for this participation
      bulkSink =
          searchRepository.createBulkSink(
              job.getJobConfiguration().getBatchSize() != null
                  ? job.getJobConfiguration().getBatchSize()
                  : 100,
              job.getJobConfiguration().getMaxConcurrentRequests() != null
                  ? job.getJobConfiguration().getMaxConcurrentRequests()
                  : 100,
              job.getJobConfiguration().getPayLoadSize() != null
                  ? job.getJobConfiguration().getPayLoadSize()
                  : 104857600L);

      int batchSize =
          job.getJobConfiguration().getBatchSize() != null
              ? job.getJobConfiguration().getBatchSize()
              : 100;

      // Check if this job is doing index recreation
      boolean recreateIndex = Boolean.TRUE.equals(job.getJobConfiguration().getRecreateIndex());
      org.openmetadata.service.search.ReindexContext recreateContext = null;

      if (recreateIndex && job.getStagedIndexMapping() != null) {
        // Reconstruct context from job's staged index mapping
        recreateContext =
            org.openmetadata.service.search.ReindexContext.fromStagedIndexMapping(
                job.getStagedIndexMapping());
        LOG.info(
            "Participant using staged index mapping from job {}: {}",
            job.getId(),
            job.getStagedIndexMapping());
      }

      // Set up failure callback on bulk sink to record sink failures
      final IndexingFailureRecorder recorder = failureRecorder;
      bulkSink.setFailureCallback(
          (entityType, entityId, entityFqn, errorMessage) -> {
            if (recorder != null) {
              recorder.recordSinkFailure(entityType, entityId, entityFqn, errorMessage);
            }
          });

      // Create partition worker with recreate context and failure recorder
      PartitionWorker worker =
          new PartitionWorker(
              coordinator, bulkSink, batchSize, recreateContext, recreateIndex, failureRecorder);

      int partitionsProcessed = 0;
      long totalReaderSuccess = 0;
      long totalReaderFailed = 0;
      long totalReaderWarnings = 0;
      final BulkSink sinkForStats = bulkSink;

      // Process partitions until none are available or job completes
      while (running.get()) {
        // Check if job is still running
        Optional<SearchIndexJob> currentJob = coordinator.getJob(job.getId());
        if (currentJob.isEmpty() || currentJob.get().isTerminal()) {
          LOG.info("Job {} is no longer active, stopping participation", job.getId());
          break;
        }

        // Try to claim a partition
        Optional<SearchIndexPartition> partitionOpt = coordinator.claimNextPartition(job.getId());

        if (partitionOpt.isEmpty()) {
          // No partition available - check if job is complete
          long pendingCount =
              coordinator.getPartitions(job.getId(), PartitionStatus.PENDING).size();
          long processingCount =
              coordinator.getPartitions(job.getId(), PartitionStatus.PROCESSING).size();

          if (pendingCount == 0 && processingCount == 0) {
            LOG.info(
                "No more partitions to claim for job {}, processed {} partitions",
                job.getId(),
                partitionsProcessed);
            break;
          }

          // Some partitions still processing (by other servers) - wait and retry
          try {
            Thread.sleep(1000);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
          }
          continue;
        }

        SearchIndexPartition partition = partitionOpt.get();
        LOG.info(
            "Participant server {} claimed partition {} for entity type {}",
            serverId,
            partition.getId(),
            partition.getEntityType());

        try {
          PartitionWorker.PartitionResult result = worker.processPartition(partition);
          partitionsProcessed++;
          totalReaderSuccess += result.successCount();
          totalReaderFailed += result.readerFailed();
          totalReaderWarnings += result.readerWarnings();

          LOG.info(
              "Participant completed partition {} (success: {}, failed: {}, readerFailed: {}, readerWarnings: {})",
              partition.getId(),
              result.successCount(),
              result.failedCount(),
              result.readerFailed(),
              result.readerWarnings());

          // Stats are tracked per-entityType by StageStatsTracker in PartitionWorker

        } catch (Exception e) {
          LOG.error("Error processing partition {}", partition.getId(), e);
        }
      }

      // Flush sink and wait for all pending bulk requests to complete
      if (sinkForStats != null) {
        LOG.info("Flushing sink and waiting for pending requests");
        boolean completed = sinkForStats.flushAndAwait(60);
        if (!completed) {
          LOG.warn("Sink flush timed out - some requests may not be reflected in final stats");
        }
      }

      // Stats are tracked per-entityType by StageStatsTracker in PartitionWorker
      // No need for participant-level aggregation - it causes double-counting

      LOG.info(
          "Server {} finished participating in job {}, processed {} partitions",
          serverId,
          job.getId(),
          partitionsProcessed);

    } catch (Exception e) {
      LOG.error("Error participating in job {}", job.getId(), e);
    } finally {
      // Flush and close the failure recorder first (before closing sink)
      if (failureRecorder != null) {
        try {
          failureRecorder.close();
        } catch (Exception e) {
          LOG.warn("Error closing failure recorder", e);
        }
      }
      // Close the bulk sink
      if (bulkSink != null) {
        try {
          bulkSink.close();
        } catch (Exception e) {
          LOG.warn("Error closing bulk sink", e);
        }
      }
    }
  }

  /** Check if currently participating in a job. */
  public boolean isParticipating() {
    return participating.get();
  }
}
