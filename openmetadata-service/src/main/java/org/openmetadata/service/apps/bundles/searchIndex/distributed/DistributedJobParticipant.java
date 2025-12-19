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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

/**
 * Background service that monitors for active distributed indexing jobs and joins them to help
 * process partitions.
 *
 * <p>In a clustered environment, only one server will trigger the SearchIndexApp via Quartz. This
 * service runs on all servers and allows non-triggering servers to discover and participate in
 * active jobs.
 */
@Slf4j
public class DistributedJobParticipant implements Managed {

  /** Check interval for active jobs */
  private static final long CHECK_INTERVAL_MS = 5000;

  /** Maximum workers per participating server */
  private static final int MAX_WORKERS = 4;

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final String serverId;
  private final DistributedSearchIndexCoordinator coordinator;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicBoolean participating = new AtomicBoolean(false);
  private ScheduledExecutorService scheduler;
  private UUID currentJobId;

  public DistributedJobParticipant(
      CollectionDAO collectionDAO, SearchRepository searchRepository, String serverId) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.serverId = serverId;
    this.coordinator = new DistributedSearchIndexCoordinator(collectionDAO);
  }

  /** Start the background job monitor. */
  public void start() {
    if (running.compareAndSet(false, true)) {
      scheduler =
          Executors.newSingleThreadScheduledExecutor(
              Thread.ofPlatform().name("distributed-job-participant").factory());

      scheduler.scheduleAtFixedRate(
          this::checkAndJoinActiveJob, CHECK_INTERVAL_MS, CHECK_INTERVAL_MS, TimeUnit.MILLISECONDS);

      LOG.info("Started distributed job participant on server {}", serverId);
    }
  }

  /** Stop the background monitor. */
  public void stop() {
    if (running.compareAndSet(true, false)) {
      if (scheduler != null) {
        scheduler.shutdown();
        try {
          if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
            scheduler.shutdownNow();
          }
        } catch (InterruptedException e) {
          scheduler.shutdownNow();
          Thread.currentThread().interrupt();
        }
      }
      LOG.info("Stopped distributed job participant on server {}", serverId);
    }
  }

  /** Check for active distributed jobs and join if found. */
  private void checkAndJoinActiveJob() {
    if (participating.get()) {
      // Already participating in a job
      return;
    }

    try {
      // Look for running jobs
      List<SearchIndexJob> runningJobs =
          coordinator.getRecentJobs(List.of(IndexJobStatus.RUNNING), 1);

      if (runningJobs.isEmpty()) {
        return;
      }

      SearchIndexJob activeJob = runningJobs.getFirst();

      // Check if this is a different job than we last participated in
      if (currentJobId != null && currentJobId.equals(activeJob.getId())) {
        // Same job, check if it's still running
        Optional<SearchIndexJob> jobOpt = coordinator.getJob(activeJob.getId());
        if (jobOpt.isEmpty() || jobOpt.get().isTerminal()) {
          currentJobId = null;
        }
        return;
      }

      // Check if there are pending partitions we can help with
      long pendingCount =
          coordinator.getPartitions(activeJob.getId(), PartitionStatus.PENDING).size();
      if (pendingCount == 0) {
        LOG.debug("No pending partitions to process for job {}", activeJob.getId());
        return;
      }

      LOG.info(
          "Found active distributed job {} with {} pending partitions, joining...",
          activeJob.getId(),
          pendingCount);

      joinAndProcessJob(activeJob);

    } catch (Exception e) {
      LOG.error("Error checking for active distributed jobs", e);
    }
  }

  /** Join an active job and help process partitions. */
  private void joinAndProcessJob(SearchIndexJob job) {
    if (!participating.compareAndSet(false, true)) {
      return;
    }

    currentJobId = job.getId();

    Thread.ofVirtual()
        .name("job-participant-" + job.getId().toString().substring(0, 8))
        .start(
            () -> {
              try {
                processJobPartitions(job);
              } finally {
                participating.set(false);
              }
            });
  }

  /** Process partitions for a job. */
  private void processJobPartitions(SearchIndexJob job) {
    LOG.info("Server {} joining distributed job {} to process partitions", serverId, job.getId());

    try {
      // Create bulk sink for this participation
      BulkSink bulkSink =
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

      // Create partition worker
      PartitionWorker worker = new PartitionWorker(coordinator, bulkSink, batchSize, null, false);

      int partitionsProcessed = 0;

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
          // No more partitions available
          LOG.info(
              "No more partitions to claim for job {}, processed {} partitions",
              job.getId(),
              partitionsProcessed);
          break;
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

          LOG.info(
              "Participant completed partition {} (success: {}, failed: {})",
              partition.getId(),
              result.successCount(),
              result.failedCount());

        } catch (Exception e) {
          LOG.error("Error processing partition {}", partition.getId(), e);
        }
      }

      LOG.info(
          "Server {} finished participating in job {}, processed {} partitions",
          serverId,
          job.getId(),
          partitionsProcessed);

    } catch (Exception e) {
      LOG.error("Error participating in job {}", job.getId(), e);
    }
  }

  /** Check if currently participating in a job. */
  public boolean isParticipating() {
    return participating.get();
  }

  /** Get the current job ID being processed, if any. */
  public UUID getCurrentJobId() {
    return currentJobId;
  }
}
