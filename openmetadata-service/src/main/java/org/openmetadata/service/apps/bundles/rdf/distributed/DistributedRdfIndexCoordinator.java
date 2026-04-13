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

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexJobDAO.RdfIndexJobRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfAggregatedStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfEntityStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfIndexPartitionRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfServerPartitionStatsRecord;

@Slf4j
public class DistributedRdfIndexCoordinator {
  private static final String REINDEX_LOCK_KEY = "RDF_REINDEX_LOCK";
  private static final long LOCK_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(5);
  private static final long PARTITION_STALE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(3);
  private static final int MAX_PARTITION_RETRIES = 3;
  private static final double IMMEDIATE_CLAIMABLE_PERCENT = 0.50;
  private static final long PARTITION_RELEASE_WINDOW_MS = TimeUnit.SECONDS.toMillis(5);

  private final CollectionDAO collectionDAO;
  private final RdfPartitionCalculator partitionCalculator;
  private final String serverId;
  private final AtomicLong lastClaimTimestamp = new AtomicLong(0);

  public DistributedRdfIndexCoordinator(CollectionDAO collectionDAO) {
    this(collectionDAO, new RdfPartitionCalculator());
  }

  public DistributedRdfIndexCoordinator(
      CollectionDAO collectionDAO, RdfPartitionCalculator partitionCalculator) {
    this.collectionDAO = collectionDAO;
    this.partitionCalculator = partitionCalculator;
    this.serverId = ServerIdentityResolver.getInstance().getServerId();
  }

  public CollectionDAO getCollectionDAO() {
    return collectionDAO;
  }

  public boolean tryAcquireReindexLock(UUID jobId) {
    long now = System.currentTimeMillis();
    return collectionDAO
        .rdfReindexLockDAO()
        .tryAcquireLock(REINDEX_LOCK_KEY, jobId.toString(), serverId, now, now + LOCK_TIMEOUT_MS);
  }

  public boolean transferReindexLock(UUID fromJobId, UUID toJobId) {
    long now = System.currentTimeMillis();
    return collectionDAO
        .rdfReindexLockDAO()
        .transferLock(
            REINDEX_LOCK_KEY,
            fromJobId.toString(),
            toJobId.toString(),
            serverId,
            now,
            now + LOCK_TIMEOUT_MS);
  }

  public void refreshReindexLock(UUID jobId) {
    long now = System.currentTimeMillis();
    collectionDAO
        .rdfReindexLockDAO()
        .updateHeartbeat(REINDEX_LOCK_KEY, jobId.toString(), now, now + LOCK_TIMEOUT_MS);
  }

  public void releaseReindexLock(UUID jobId) {
    collectionDAO.rdfReindexLockDAO().releaseLock(REINDEX_LOCK_KEY, jobId.toString());
  }

  public Optional<RdfIndexJob> getJob(UUID jobId) {
    RdfIndexJobRecord record = collectionDAO.rdfIndexJobDAO().findById(jobId.toString());
    return Optional.ofNullable(record).map(this::toJob);
  }

  public List<RdfIndexJob> getRecentJobs(List<IndexJobStatus> statuses, int limit) {
    List<String> statusNames = statuses.stream().map(Enum::name).toList();
    return collectionDAO.rdfIndexJobDAO().findByStatusesWithLimit(statusNames, limit).stream()
        .map(this::toJob)
        .toList();
  }

  public Optional<RdfIndexJob> getBlockingJob() {
    List<RdfIndexJob> jobs =
        getRecentJobs(
            List.of(IndexJobStatus.READY, IndexJobStatus.RUNNING, IndexJobStatus.STOPPING), 1);
    return jobs.stream().findFirst();
  }

  public RdfIndexJob createJob(
      Set<String> entities, EventPublisherJob jobConfiguration, String createdBy) {
    UUID jobId = UUID.randomUUID();
    long now = System.currentTimeMillis();

    Map<String, RdfIndexJob.EntityTypeStats> entityStats = new HashMap<>();
    long totalRecords = 0;
    for (String entityType : entities) {
      long count = partitionCalculator.getEntityCount(entityType);
      totalRecords += count;
      entityStats.put(
          entityType,
          RdfIndexJob.EntityTypeStats.builder()
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

    RdfIndexJob job =
        RdfIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.INITIALIZING)
            .jobConfiguration(jobConfiguration)
            .totalRecords(totalRecords)
            .processedRecords(0)
            .successRecords(0)
            .failedRecords(0)
            .entityStats(entityStats)
            .createdBy(createdBy)
            .createdAt(now)
            .updatedAt(now)
            .build();

    collectionDAO
        .rdfIndexJobDAO()
        .insert(
            jobId.toString(),
            job.getStatus().name(),
            JsonUtils.pojoToJson(jobConfiguration),
            job.getTotalRecords(),
            0,
            0,
            0,
            serializeEntityStats(entityStats),
            createdBy,
            now,
            now);
    return job;
  }

  public RdfIndexJob initializePartitions(UUID jobId) {
    RdfIndexJob job =
        getJob(jobId).orElseThrow(() -> new IllegalStateException("RDF job not found: " + jobId));
    Set<String> entityTypes = Set.copyOf(job.getJobConfiguration().getEntities());
    List<RdfIndexPartition> partitions =
        partitionCalculator.calculatePartitions(jobId, entityTypes);
    long now = System.currentTimeMillis();
    int immediateCount =
        Math.max(1, (int) Math.ceil(partitions.size() * IMMEDIATE_CLAIMABLE_PERCENT));

    for (int i = 0; i < partitions.size(); i++) {
      RdfIndexPartition partition = partitions.get(i);
      long claimableAt;
      if (i < immediateCount) {
        claimableAt = now;
      } else {
        int remainingIndex = i - immediateCount;
        int remainingCount = Math.max(1, partitions.size() - immediateCount);
        claimableAt = now + (remainingIndex * PARTITION_RELEASE_WINDOW_MS) / remainingCount;
      }
      insertPartition(partition.withClaimableAt(claimableAt));
    }

    Map<String, RdfIndexJob.EntityTypeStats> entityStats = new HashMap<>(job.getEntityStats());
    for (String entityType : entityTypes) {
      int totalPartitions =
          (int)
              partitions.stream()
                  .filter(partition -> entityType.equals(partition.getEntityType()))
                  .count();
      RdfIndexJob.EntityTypeStats existing = entityStats.get(entityType);
      if (existing != null) {
        entityStats.put(entityType, existing.toBuilder().totalPartitions(totalPartitions).build());
      }
    }

    long totalRecords = partitions.stream().mapToLong(RdfIndexPartition::getEstimatedCount).sum();
    RdfIndexJob updated =
        job.toBuilder()
            .status(IndexJobStatus.READY)
            .totalRecords(totalRecords)
            .entityStats(entityStats)
            .updatedAt(System.currentTimeMillis())
            .build();
    updateJob(updated);
    return updated;
  }

  public RdfIndexPartition claimNextPartition(UUID jobId) {
    long claimAt = nextClaimTimestamp();
    int updated =
        collectionDAO
            .rdfIndexPartitionDAO()
            .claimNextPartitionAtomic(jobId.toString(), serverId, claimAt);
    if (updated <= 0) {
      return null;
    }

    RdfIndexPartitionRecord record =
        collectionDAO
            .rdfIndexPartitionDAO()
            .findLatestClaimedPartition(jobId.toString(), serverId, claimAt);
    if (record == null) {
      LOG.warn(
          "Claimed RDF partition for job {} but could not retrieve the record; it may require stale recovery",
          jobId);
      return null;
    }

    return toPartition(record);
  }

  public void updatePartitionProgress(RdfIndexPartition partition) {
    collectionDAO
        .rdfIndexPartitionDAO()
        .updateProgress(
            partition.getId().toString(),
            partition.getCursor(),
            partition.getProcessedCount(),
            partition.getSuccessCount(),
            partition.getFailedCount(),
            System.currentTimeMillis());
  }

  public void completePartition(
      UUID partitionId, long cursor, long processedCount, long successCount, long failedCount) {
    RdfIndexPartition partition = getPartition(partitionId);
    long now = System.currentTimeMillis();
    collectionDAO
        .rdfIndexPartitionDAO()
        .update(
            partitionId.toString(),
            PartitionStatus.COMPLETED.name(),
            cursor,
            processedCount,
            successCount,
            failedCount,
            partition.getAssignedServer(),
            partition.getClaimedAt(),
            partition.getStartedAt(),
            now,
            now,
            null,
            partition.getRetryCount());
    incrementServerStats(partition, processedCount, successCount, failedCount, 1, 0);
    refreshAggregatedJob(jobIdFrom(partition));
  }

  public void failPartition(
      UUID partitionId,
      long cursor,
      long processedCount,
      long successCount,
      long failedCount,
      String errorMessage) {
    RdfIndexPartition partition = getPartition(partitionId);
    long now = System.currentTimeMillis();
    collectionDAO
        .rdfIndexPartitionDAO()
        .update(
            partitionId.toString(),
            PartitionStatus.FAILED.name(),
            cursor,
            processedCount,
            successCount,
            failedCount,
            partition.getAssignedServer(),
            partition.getClaimedAt(),
            partition.getStartedAt(),
            now,
            now,
            errorMessage,
            partition.getRetryCount() + 1);
    incrementServerStats(partition, processedCount, successCount, failedCount, 0, 1);
    refreshAggregatedJob(jobIdFrom(partition));
  }

  public int reclaimStalePartitions(UUID jobId) {
    long staleThreshold = System.currentTimeMillis() - PARTITION_STALE_TIMEOUT_MS;
    int reclaimed =
        collectionDAO
            .rdfIndexPartitionDAO()
            .reclaimStalePartitionsForRetry(
                jobId.toString(), staleThreshold, MAX_PARTITION_RETRIES);
    int failed =
        collectionDAO
            .rdfIndexPartitionDAO()
            .failStalePartitionsExceedingRetries(
                jobId.toString(),
                staleThreshold,
                MAX_PARTITION_RETRIES,
                System.currentTimeMillis());
    if (reclaimed > 0 || failed > 0) {
      LOG.info(
          "Recovered RDF job {} partitions: reclaimed={}, failed={}", jobId, reclaimed, failed);
      refreshAggregatedJob(jobId);
    }
    return reclaimed + failed;
  }

  public void cancelPendingPartitions(UUID jobId) {
    collectionDAO.rdfIndexPartitionDAO().cancelPendingPartitions(jobId.toString());
    refreshAggregatedJob(jobId);
  }

  public void releaseServerPartitions(UUID jobId, String serverId, boolean stopJob, String reason) {
    long now = System.currentTimeMillis();
    collectionDAO
        .rdfIndexPartitionDAO()
        .releaseProcessingPartitions(
            jobId.toString(),
            serverId,
            stopJob ? PartitionStatus.CANCELLED.name() : PartitionStatus.PENDING.name(),
            reason,
            now,
            stopJob ? now : null);
    refreshAggregatedJob(jobId);
  }

  public void updateJobStatus(UUID jobId, IndexJobStatus status, String errorMessage) {
    RdfIndexJob job =
        getJob(jobId).orElseThrow(() -> new IllegalStateException("RDF job not found: " + jobId));
    long now = System.currentTimeMillis();
    Long startedAt = job.getStartedAt();
    Long completedAt = job.getCompletedAt();

    if (status == IndexJobStatus.RUNNING && startedAt == null) {
      startedAt = now;
    }
    if (status == IndexJobStatus.STOPPED
        || status == IndexJobStatus.COMPLETED
        || status == IndexJobStatus.COMPLETED_WITH_ERRORS
        || status == IndexJobStatus.FAILED) {
      completedAt = completedAt != null ? completedAt : now;
    }

    collectionDAO
        .rdfIndexJobDAO()
        .update(
            jobId.toString(),
            status.name(),
            job.getProcessedRecords(),
            job.getSuccessRecords(),
            job.getFailedRecords(),
            serializeEntityStats(job.getEntityStats()),
            startedAt,
            completedAt,
            now,
            errorMessage);
  }

  public RdfIndexJob getJobWithAggregatedStats(UUID jobId) {
    return refreshAggregatedJob(jobId);
  }

  public boolean hasClaimableWork(UUID jobId) {
    RdfIndexJob job = refreshAggregatedJob(jobId);
    if (job == null || job.isTerminal()) {
      return false;
    }

    String id = jobId.toString();

    return collectionDAO.rdfIndexPartitionDAO().countPendingPartitions(id) > 0
        || collectionDAO.rdfIndexPartitionDAO().countInFlightPartitions(id) > 0;
  }

  public void performStartupRecovery() {
    for (RdfIndexJob job :
        getRecentJobs(
            List.of(IndexJobStatus.READY, IndexJobStatus.RUNNING, IndexJobStatus.STOPPING), 20)) {
      reclaimStalePartitions(job.getId());
      refreshAggregatedJob(job.getId());
    }
  }

  private RdfIndexJob refreshAggregatedJob(UUID jobId) {
    RdfIndexJob existing = getJob(jobId).orElse(null);
    if (existing == null) {
      return null;
    }

    RdfAggregatedStatsRecord aggregate =
        collectionDAO.rdfIndexPartitionDAO().getAggregatedStats(jobId.toString());
    Map<String, RdfIndexJob.EntityTypeStats> entityStats =
        collectionDAO.rdfIndexPartitionDAO().getEntityStats(jobId.toString()).stream()
            .collect(
                Collectors.toMap(
                    RdfEntityStatsRecord::entityType,
                    record ->
                        RdfIndexJob.EntityTypeStats.builder()
                            .entityType(record.entityType())
                            .totalRecords(record.totalRecords())
                            .processedRecords(record.processedRecords())
                            .successRecords(record.successRecords())
                            .failedRecords(record.failedRecords())
                            .totalPartitions(record.totalPartitions())
                            .completedPartitions(record.completedPartitions())
                            .failedPartitions(record.failedPartitions())
                            .build(),
                    (left, right) -> right,
                    HashMap::new));
    Map<String, RdfIndexJob.ServerStats> serverStats =
        collectionDAO.rdfIndexPartitionDAO().getServerStats(jobId.toString()).stream()
            .collect(
                Collectors.toMap(
                    RdfServerPartitionStatsRecord::serverId,
                    record ->
                        RdfIndexJob.ServerStats.builder()
                            .serverId(record.serverId())
                            .processedRecords(record.processedRecords())
                            .successRecords(record.successRecords())
                            .failedRecords(record.failedRecords())
                            .totalPartitions(record.totalPartitions())
                            .completedPartitions(record.completedPartitions())
                            .processingPartitions(record.processingPartitions())
                            .build(),
                    (left, right) -> right,
                    HashMap::new));

    IndexJobStatus status = existing.getStatus();
    String errorMessage = existing.getErrorMessage();
    if (aggregate.pendingPartitions() == 0 && aggregate.processingPartitions() == 0) {
      if (status == IndexJobStatus.STOPPING) {
        status = IndexJobStatus.STOPPED;
      } else if (aggregate.failedPartitions() > 0 || aggregate.failedRecords() > 0) {
        status = IndexJobStatus.COMPLETED_WITH_ERRORS;
      } else if (status == IndexJobStatus.READY || status == IndexJobStatus.RUNNING) {
        status = IndexJobStatus.COMPLETED;
      }
    } else if (status == IndexJobStatus.READY) {
      status = IndexJobStatus.RUNNING;
    }

    Long completedAt = existing.getCompletedAt();
    if (completedAt == null
        && (status == IndexJobStatus.COMPLETED
            || status == IndexJobStatus.COMPLETED_WITH_ERRORS
            || status == IndexJobStatus.FAILED
            || status == IndexJobStatus.STOPPED)) {
      completedAt = System.currentTimeMillis();
    }

    RdfIndexJob refreshed =
        existing.toBuilder()
            .status(status)
            .processedRecords(aggregate.processedRecords())
            .successRecords(aggregate.successRecords())
            .failedRecords(aggregate.failedRecords())
            .entityStats(entityStats)
            .serverStats(serverStats)
            .updatedAt(System.currentTimeMillis())
            .errorMessage(errorMessage)
            .completedAt(completedAt)
            .build();

    updateJob(refreshed);
    return refreshed;
  }

  private void incrementServerStats(
      RdfIndexPartition partition,
      long processedCount,
      long successCount,
      long failedCount,
      int partitionsCompleted,
      int partitionsFailed) {
    String assignedServer =
        partition.getAssignedServer() != null ? partition.getAssignedServer() : serverId;
    collectionDAO
        .rdfIndexServerStatsDAO()
        .incrementStats(
            UUID.randomUUID().toString(),
            partition.getJobId().toString(),
            assignedServer,
            partition.getEntityType(),
            processedCount,
            successCount,
            failedCount,
            partitionsCompleted,
            partitionsFailed,
            System.currentTimeMillis());
  }

  private long nextClaimTimestamp() {
    return lastClaimTimestamp.updateAndGet(
        previous -> {
          long now = System.currentTimeMillis();
          return now > previous ? now : previous + 1;
        });
  }

  private void insertPartition(RdfIndexPartition partition) {
    collectionDAO
        .rdfIndexPartitionDAO()
        .insert(
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

  private void updateJob(RdfIndexJob job) {
    collectionDAO
        .rdfIndexJobDAO()
        .update(
            job.getId().toString(),
            job.getStatus().name(),
            job.getProcessedRecords(),
            job.getSuccessRecords(),
            job.getFailedRecords(),
            serializeEntityStats(job.getEntityStats()),
            job.getStartedAt(),
            job.getCompletedAt(),
            job.getUpdatedAt(),
            job.getErrorMessage());
  }

  private RdfIndexPartition getPartition(UUID partitionId) {
    RdfIndexPartitionRecord record =
        collectionDAO.rdfIndexPartitionDAO().findById(partitionId.toString());
    if (record == null) {
      throw new IllegalStateException("RDF partition not found: " + partitionId);
    }
    return toPartition(record);
  }

  private UUID jobIdFrom(RdfIndexPartition partition) {
    return partition.getJobId();
  }

  private String serializeEntityStats(Map<String, RdfIndexJob.EntityTypeStats> entityStats) {
    return JsonUtils.pojoToJson(entityStats != null ? entityStats : Map.of());
  }

  private RdfIndexJob toJob(RdfIndexJobRecord record) {
    Map<String, RdfIndexJob.EntityTypeStats> entityStats =
        record.stats() != null && !record.stats().isBlank()
            ? JsonUtils.readValue(
                record.stats(), new TypeReference<Map<String, RdfIndexJob.EntityTypeStats>>() {})
            : new HashMap<>();

    EventPublisherJob jobConfiguration =
        record.jobConfiguration() != null
            ? JsonUtils.readValue(record.jobConfiguration(), EventPublisherJob.class)
            : new EventPublisherJob();

    return RdfIndexJob.builder()
        .id(UUID.fromString(record.id()))
        .status(IndexJobStatus.valueOf(record.status()))
        .jobConfiguration(jobConfiguration)
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
        .build();
  }

  private RdfIndexPartition toPartition(RdfIndexPartitionRecord record) {
    return RdfIndexPartition.builder()
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
