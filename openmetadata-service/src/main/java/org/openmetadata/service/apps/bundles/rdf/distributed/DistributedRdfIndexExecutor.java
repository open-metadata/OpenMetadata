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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;

@Slf4j
public class DistributedRdfIndexExecutor {
  private static final Set<UUID> COORDINATED_JOBS = ConcurrentHashMap.newKeySet();
  private static final long LOCK_REFRESH_INTERVAL_MS = TimeUnit.MINUTES.toMillis(1);
  private static final long STALE_CHECK_INTERVAL_MS = TimeUnit.SECONDS.toMillis(30);
  private static final long CLAIM_RETRY_SLEEP_MS = 1000;
  private static final long SHUTDOWN_TIMEOUT_SECONDS = 30;

  private final CollectionDAO collectionDAO;
  private final DistributedRdfIndexCoordinator coordinator;
  private final String serverId;
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  private final AtomicBoolean localExecutionCleaned = new AtomicBoolean(true);
  private final List<RdfPartitionWorker> activeWorkers = new CopyOnWriteArrayList<>();

  @Getter private volatile RdfIndexJob currentJob;
  private volatile ExecutorService workerExecutor;
  private volatile Thread lockRefreshThread;
  private volatile Thread staleReclaimerThread;
  private volatile boolean coordinatorOwnedJob;

  public DistributedRdfIndexExecutor(CollectionDAO collectionDAO, int partitionSize) {
    this(
        collectionDAO,
        new DistributedRdfIndexCoordinator(
            collectionDAO, new RdfPartitionCalculator(partitionSize)),
        ServerIdentityResolver.getInstance().getServerId());
  }

  DistributedRdfIndexExecutor(
      CollectionDAO collectionDAO, DistributedRdfIndexCoordinator coordinator, String serverId) {
    this.collectionDAO = collectionDAO;
    this.coordinator = coordinator;
    this.serverId = serverId;
  }

  public static boolean isCoordinatingJob(UUID jobId) {
    return COORDINATED_JOBS.contains(jobId);
  }

  public void performStartupRecovery() {
    coordinator.performStartupRecovery();
  }

  public RdfIndexJob createJob(
      Set<String> entities, EventPublisherJob jobConfiguration, String createdBy) {
    Optional<RdfIndexJob> blockingJob = coordinator.getBlockingJob();
    if (blockingJob.isPresent()) {
      throw new IllegalStateException(
          "Another RDF reindex job is already active: " + blockingJob.get().getId());
    }

    UUID tempJobId = UUID.randomUUID();
    if (!coordinator.tryAcquireReindexLock(tempJobId)) {
      throw new IllegalStateException("Failed to acquire RDF reindex lock");
    }

    try {
      currentJob = coordinator.createJob(entities, jobConfiguration, createdBy);
      currentJob = coordinator.initializePartitions(currentJob.getId());
      if (!coordinator.transferReindexLock(tempJobId, currentJob.getId())) {
        throw new IllegalStateException("Failed to transfer RDF reindex lock to job");
      }
      coordinatorOwnedJob = true;
      return currentJob;
    } catch (Exception e) {
      coordinator.releaseReindexLock(tempJobId);
      throw e;
    }
  }

  public void execute(EventPublisherJob jobConfiguration) throws InterruptedException {
    if (currentJob == null) {
      throw new IllegalStateException("RDF distributed job must be created before execution");
    }

    stopped.set(false);
    localExecutionCleaned.set(false);
    COORDINATED_JOBS.add(currentJob.getId());
    coordinator.updateJobStatus(currentJob.getId(), IndexJobStatus.RUNNING, null);
    currentJob = coordinator.getJobWithAggregatedStats(currentJob.getId());
    if (currentJob == null) {
      throw new IllegalStateException("Failed to load RDF distributed job state");
    }

    try {
      startCoordinatorThreads();
      runWorkers(jobConfiguration, true);
      finalizeCoordinatorJob();
    } finally {
      cleanupCoordinatorExecution();
    }
  }

  public void joinJob(RdfIndexJob job, EventPublisherJob jobConfiguration)
      throws InterruptedException {
    RdfRepository.getInstance().ensureStorageReady();
    currentJob = job;
    coordinatorOwnedJob = false;
    stopped.set(false);
    localExecutionCleaned.set(false);
    runWorkers(jobConfiguration, false);
  }

  public RdfIndexJob getJobWithFreshStats() {
    if (currentJob == null) {
      return null;
    }
    currentJob = coordinator.getJobWithAggregatedStats(currentJob.getId());
    return currentJob;
  }

  public void stop() {
    stopped.set(true);

    if (currentJob != null) {
      if (coordinatorOwnedJob) {
        coordinator.updateJobStatus(currentJob.getId(), IndexJobStatus.STOPPING, null);
        coordinator.cancelPendingPartitions(currentJob.getId());
        coordinator.releaseServerPartitions(currentJob.getId(), serverId, true, "Stopped by user");
      } else {
        coordinator.releaseServerPartitions(
            currentJob.getId(), serverId, false, "Worker server stopped participating");
      }
    }

    for (RdfPartitionWorker worker : activeWorkers) {
      worker.stop();
    }

    cleanupLocalExecution();
  }

  private void runWorkers(EventPublisherJob jobConfiguration, boolean coordinatorMode)
      throws InterruptedException {
    activeWorkers.clear();

    int workerCount =
        Math.max(
            1,
            Math.min(
                jobConfiguration.getConsumerThreads() != null
                    ? jobConfiguration.getConsumerThreads()
                    : Runtime.getRuntime().availableProcessors(),
                Runtime.getRuntime().availableProcessors() * 2));
    int batchSize = jobConfiguration.getBatchSize() != null ? jobConfiguration.getBatchSize() : 100;
    RdfBatchProcessor batchProcessor =
        new RdfBatchProcessor(collectionDAO, RdfRepository.getInstance());

    workerExecutor =
        Executors.newFixedThreadPool(
            workerCount,
            Thread.ofPlatform()
                .name(
                    coordinatorMode
                        ? "rdf-distributed-coordinator-"
                        : "rdf-distributed-participant-",
                    0)
                .factory());
    try {
      for (int i = 0; i < workerCount; i++) {
        RdfPartitionWorker worker = new RdfPartitionWorker(coordinator, batchProcessor, batchSize);
        activeWorkers.add(worker);
        workerExecutor.submit(() -> workerLoop(worker));
      }

      workerExecutor.shutdown();
      workerExecutor.awaitTermination(Long.MAX_VALUE, TimeUnit.MILLISECONDS);
    } finally {
      activeWorkers.clear();
      if (workerExecutor != null && !workerExecutor.isShutdown()) {
        shutdownWorkerExecutor();
      }
    }
  }

  private void workerLoop(RdfPartitionWorker worker) {
    while (!stopped.get() && !Thread.currentThread().isInterrupted()) {
      RdfIndexJob latestJob = getJobWithFreshStats();
      if (latestJob == null
          || latestJob.isTerminal()
          || latestJob.getStatus() == IndexJobStatus.STOPPING) {
        return;
      }

      RdfIndexPartition partition = coordinator.claimNextPartition(latestJob.getId());
      if (partition == null) {
        try {
          TimeUnit.MILLISECONDS.sleep(CLAIM_RETRY_SLEEP_MS);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          return;
        }
        continue;
      }

      worker.processPartition(partition);
    }
  }

  private void finalizeCoordinatorJob() {
    currentJob = coordinator.getJobWithAggregatedStats(currentJob.getId());
    if (currentJob == null) {
      return;
    }

    if (stopped.get()) {
      coordinator.updateJobStatus(currentJob.getId(), IndexJobStatus.STOPPED, null);
    } else if (!currentJob.isTerminal()) {
      IndexJobStatus terminalStatus =
          currentJob.getFailedRecords() > 0
              ? IndexJobStatus.COMPLETED_WITH_ERRORS
              : IndexJobStatus.COMPLETED;
      coordinator.updateJobStatus(currentJob.getId(), terminalStatus, currentJob.getErrorMessage());
    }

    currentJob = coordinator.getJobWithAggregatedStats(currentJob.getId());
  }

  private void startCoordinatorThreads() {
    lockRefreshThread =
        Thread.ofVirtual()
            .name("rdf-lock-refresh-" + currentJob.getId().toString().substring(0, 8))
            .start(
                () -> {
                  while (!stopped.get() && !Thread.currentThread().isInterrupted()) {
                    try {
                      coordinator.refreshReindexLock(currentJob.getId());
                      TimeUnit.MILLISECONDS.sleep(LOCK_REFRESH_INTERVAL_MS);
                    } catch (InterruptedException e) {
                      Thread.currentThread().interrupt();
                      return;
                    } catch (Exception e) {
                      LOG.warn("Failed to refresh RDF reindex lock for {}", currentJob.getId(), e);
                    }
                  }
                });

    staleReclaimerThread =
        Thread.ofVirtual()
            .name("rdf-stale-reclaimer-" + currentJob.getId().toString().substring(0, 8))
            .start(
                () -> {
                  while (!stopped.get() && !Thread.currentThread().isInterrupted()) {
                    try {
                      coordinator.reclaimStalePartitions(currentJob.getId());
                      TimeUnit.MILLISECONDS.sleep(STALE_CHECK_INTERVAL_MS);
                    } catch (InterruptedException e) {
                      Thread.currentThread().interrupt();
                      return;
                    } catch (Exception e) {
                      LOG.warn(
                          "Failed to reclaim stale RDF partitions for {}", currentJob.getId(), e);
                    }
                  }
                });
  }

  private void shutdownWorkerExecutor() {
    if (workerExecutor == null || workerExecutor.isShutdown()) {
      return;
    }

    workerExecutor.shutdownNow();
    try {
      if (!workerExecutor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        LOG.warn("Timed out waiting for RDF distributed workers to stop");
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    } finally {
      workerExecutor = null;
    }
  }

  private void interruptThread(Thread thread) {
    if (thread == null) {
      return;
    }
    thread.interrupt();
    try {
      thread.join(5_000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private void cleanupLocalExecution() {
    if (!localExecutionCleaned.compareAndSet(false, true)) {
      return;
    }

    shutdownWorkerExecutor();
    interruptThread(lockRefreshThread);
    interruptThread(staleReclaimerThread);
    lockRefreshThread = null;
    staleReclaimerThread = null;
    activeWorkers.clear();
  }

  private void cleanupCoordinatorExecution() {
    UUID jobId = currentJob != null ? currentJob.getId() : null;

    cleanupLocalExecution();

    if (jobId != null && coordinatorOwnedJob) {
      try {
        coordinator.releaseReindexLock(jobId);
      } catch (Exception e) {
        LOG.warn("Failed to release RDF reindex lock for {}", jobId, e);
      }
    }
    if (jobId != null) {
      COORDINATED_JOBS.remove(jobId);
    }
  }
}
