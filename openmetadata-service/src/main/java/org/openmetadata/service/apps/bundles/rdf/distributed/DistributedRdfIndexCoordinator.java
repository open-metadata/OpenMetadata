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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexJobDAO.RdfIndexJobRecord;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO.RdfAggregatedStatsRecord;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO.RdfEntityStatsRecord;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO.RdfIndexPartitionRecord;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO.RdfServerPartitionStatsRecord;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class DistributedRdfIndexCoordinator {
  private static final String REINDEX_LOCK_KEY = "RDF_REINDEX_LOCK";
  private static final long LOCK_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(5);
  private static final long PARTITION_STALE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(3);
  private static final int MAX_PARTITION_RETRIES = 3;
  private static final double IMMEDIATE_CLAIMABLE_PERCENT = 0.50;
  private static final long PARTITION_RELEASE_WINDOW_MS = TimeUnit.SECONDS.toMillis(5);
  private static final int MAX_ERROR_SAMPLES = 5;
  private static final int MAX_ERROR_MESSAGE_LENGTH = 4000;
  private static final int MAX_IN_FLIGHT_PARTITIONS_PER_SERVER = 5;
  private static final int CURSOR_WALK_BATCH_SIZE = 10_000;

  private final CollectionDAO collectionDAO;
  private final RdfPartitionCalculator partitionCalculator;
  private final String serverId;
  private final AtomicLong lastClaimTimestamp = new AtomicLong(0);

  private final ConcurrentHashMap<UUID, Map<String, Map<Long, String>>> partitionStartCursors =
      new ConcurrentHashMap<>();

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
    precomputePartitionStartCursors(jobId, partitions);
    return updated;
  }

  public String getPartitionStartCursor(UUID jobId, String entityType, long rangeStart) {
    if (rangeStart <= 0 || jobId == null) {
      return null;
    }
    Map<String, Map<Long, String>> jobCache = partitionStartCursors.get(jobId);
    if (jobCache == null) {
      return null;
    }
    Map<Long, String> entityCursors = jobCache.get(entityType);
    if (entityCursors == null) {
      return null;
    }
    return entityCursors.get(rangeStart);
  }

  private void precomputePartitionStartCursors(UUID jobId, List<RdfIndexPartition> partitions) {
    Map<String, List<RdfIndexPartition>> byEntity =
        partitions.stream()
            .filter(p -> p.getEntityType() != null)
            .collect(Collectors.groupingBy(RdfIndexPartition::getEntityType));

    Map<String, Map<Long, String>> jobCache = new HashMap<>();
    for (Map.Entry<String, List<RdfIndexPartition>> e : byEntity.entrySet()) {
      try {
        jobCache.put(e.getKey(), walkBoundaries(e.getKey(), e.getValue()));
      } catch (Exception ex) {
        LOG.warn(
            "Failed to precompute RDF partition start cursors for entity {}; workers fall back to OFFSET path",
            e.getKey(),
            ex);
      }
    }
    partitionStartCursors.put(jobId, jobCache);
  }

  private Map<Long, String> walkBoundaries(
      String entityType, List<RdfIndexPartition> entityPartitions) {
    List<Long> sortedTargets =
        entityPartitions.stream()
            .map(RdfIndexPartition::getRangeStart)
            .filter(r -> r > 0)
            .sorted()
            .distinct()
            .collect(Collectors.toList());
    Map<Long, String> result = new HashMap<>();
    if (sortedTargets.isEmpty()) {
      return result;
    }
    EntityRepository<?> repo = Entity.getEntityRepository(entityType);
    walkAndRecord(repo, sortedTargets, result);
    LOG.debug("Precomputed {} RDF boundary cursors for entity {}", result.size(), entityType);
    return result;
  }

  private <T extends EntityInterface> void walkAndRecord(
      EntityRepository<T> repo, List<Long> sortedTargets, Map<Long, String> result) {
    ListFilter filter = new ListFilter(Include.ALL);
    String afterName = "";
    String afterId = "";
    long currentOffset = 0;
    int targetIdx = 0;
    long nextTarget = sortedTargets.get(targetIdx);
    T lastSeenEntity = null;

    while (targetIdx < sortedTargets.size()) {
      long need = nextTarget - currentOffset;
      if (need <= 0) {
        // Defensive: we walked past this target without recording it. Reuse the last
        // entity we saw and run it through the same cursor encoder as the regular
        // path, so quoted-name entities don't end up with a different cursor format.
        if (lastSeenEntity != null) {
          result.put(nextTarget, RestUtil.encodeCursor(repo.getCursorValue(lastSeenEntity)));
        }
        targetIdx++;
        nextTarget = (targetIdx < sortedTargets.size()) ? sortedTargets.get(targetIdx) : -1;
        continue;
      }
      int fetch = (int) Math.min(need, CURSOR_WALK_BATCH_SIZE);
      List<String> batch = repo.getDao().listAfter(filter, fetch, afterName, afterId);
      if (batch.isEmpty()) {
        break;
      }
      T lastEntity = repo.getEntityClass().cast(deserializeLast(repo, batch));
      lastSeenEntity = lastEntity;
      currentOffset += batch.size();
      afterName = FullyQualifiedName.unquoteName(lastEntity.getName());
      afterId = lastEntity.getId() == null ? "" : lastEntity.getId().toString();

      if (currentOffset >= nextTarget) {
        result.put(nextTarget, RestUtil.encodeCursor(repo.getCursorValue(lastEntity)));
        targetIdx++;
        nextTarget = (targetIdx < sortedTargets.size()) ? sortedTargets.get(targetIdx) : -1;
      }
      if (batch.size() < fetch) {
        break;
      }
    }
  }

  private <T extends EntityInterface> Object deserializeLast(
      EntityRepository<T> repo, List<String> batch) {
    return JsonUtils.readValue(batch.get(batch.size() - 1), repo.getEntityClass());
  }

  public RdfIndexPartition claimNextPartition(UUID jobId) {
    return claimNextPartition(jobId, serverId);
  }

  public RdfIndexPartition claimNextPartition(UUID jobId, String claimingServerId) {
    int inFlight =
        collectionDAO
            .rdfIndexPartitionDAO()
            .countInFlightPartitionsForServer(jobId.toString(), claimingServerId);
    if (inFlight >= MAX_IN_FLIGHT_PARTITIONS_PER_SERVER) {
      LOG.debug(
          "Server {} has {} in-flight RDF partitions (max {}), backing off",
          claimingServerId,
          inFlight,
          MAX_IN_FLIGHT_PARTITIONS_PER_SERVER);
      return null;
    }

    long claimAt = nextClaimTimestamp();
    int updated =
        collectionDAO
            .rdfIndexPartitionDAO()
            .claimNextPartitionAtomic(jobId.toString(), claimingServerId, claimAt);
    if (updated <= 0) {
      return null;
    }

    RdfIndexPartitionRecord record =
        collectionDAO
            .rdfIndexPartitionDAO()
            .findLatestClaimedPartition(jobId.toString(), claimingServerId, claimAt);
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
      UUID partitionId,
      long cursor,
      long processedCount,
      long successCount,
      long failedCount,
      String lastError) {
    RdfIndexPartition partition = getPartition(partitionId);
    long now = System.currentTimeMillis();
    int updated =
        collectionDAO
            .rdfIndexPartitionDAO()
            .updateIfProcessing(
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
                lastError,
                partition.getRetryCount());
    if (updated == 0) {
      // Stop or another participant already moved the row out of PROCESSING
      // (typically to CANCELLED). Don't bump server stats and don't overwrite
      // the authoritative status — the partition is done as far as this
      // worker is concerned.
      LOG.info(
          "Skipping completion of RDF partition {} — no longer PROCESSING (status overridden by stop/reclaim)",
          partitionId);
      return;
    }
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
    int updated =
        collectionDAO
            .rdfIndexPartitionDAO()
            .updateIfProcessing(
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
    if (updated == 0) {
      LOG.info(
          "Skipping failure of RDF partition {} — no longer PROCESSING (status overridden by stop/reclaim)",
          partitionId);
      return;
    }
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

  public int cancelInFlightPartitions(UUID jobId) {
    long now = System.currentTimeMillis();
    int cancelled =
        collectionDAO.rdfIndexPartitionDAO().cancelInFlightPartitions(jobId.toString(), now);
    if (cancelled > 0) {
      LOG.info("Cancelled {} in-flight RDF partitions for job {}", cancelled, jobId);
    }
    return cancelled;
  }

  public void requestStop(UUID jobId) {
    RdfIndexJob job = getJob(jobId).orElse(null);
    if (job == null) {
      LOG.warn("Cannot stop RDF job {} - not found", jobId);
      return;
    }
    if (job.isTerminal()) {
      LOG.warn("Cannot stop RDF job {} - already in terminal state: {}", jobId, job.getStatus());
      return;
    }

    updateJobStatus(jobId, IndexJobStatus.STOPPING, null);
    cancelInFlightPartitions(jobId);
    checkAndUpdateJobCompletion(jobId);
  }

  public void checkAndUpdateJobCompletion(UUID jobId) {
    RdfIndexJob job = refreshAggregatedJob(jobId);
    if (job == null || job.isTerminal()) {
      return;
    }

    String id = jobId.toString();
    int pending =
        collectionDAO
            .rdfIndexPartitionDAO()
            .countPartitionsByStatus(id, PartitionStatus.PENDING.name());
    int processing =
        collectionDAO
            .rdfIndexPartitionDAO()
            .countPartitionsByStatus(id, PartitionStatus.PROCESSING.name());

    if (pending > 0 || processing > 0) {
      return;
    }

    int failed =
        collectionDAO
            .rdfIndexPartitionDAO()
            .countPartitionsByStatus(id, PartitionStatus.FAILED.name());
    int cancelled =
        collectionDAO
            .rdfIndexPartitionDAO()
            .countPartitionsByStatus(id, PartitionStatus.CANCELLED.name());

    // A partition can finish COMPLETED but still carry a non-null lastError —
    // e.g. a relationship/lineage bulk write that failed without incrementing
    // the entity-level failedCount or marking the partition FAILED. Treat that
    // as an error signal too, otherwise the job appears clean despite real
    // Fuseki write failures.
    boolean hasPartitionLastError =
        !collectionDAO.rdfIndexPartitionDAO().findRecentPartitionErrors(id, 1).isEmpty();

    IndexJobStatus terminal;
    if (job.getStatus() == IndexJobStatus.STOPPING) {
      terminal = IndexJobStatus.STOPPED;
    } else if (failed > 0 || cancelled > 0 || job.getFailedRecords() > 0 || hasPartitionLastError) {
      terminal = IndexJobStatus.COMPLETED_WITH_ERRORS;
    } else {
      terminal = IndexJobStatus.COMPLETED;
    }

    String errorMessage = job.getErrorMessage();
    if (terminal == IndexJobStatus.COMPLETED_WITH_ERRORS
        && (errorMessage == null || errorMessage.isBlank())
        && hasPartitionLastError) {
      // Surface a representative error so the run record isn't blank when the
      // only signal was a partition lastError.
      java.util.List<String> samples =
          collectionDAO.rdfIndexPartitionDAO().findRecentPartitionErrors(id, MAX_ERROR_SAMPLES);
      errorMessage = "Partition errors: " + String.join(" | ", samples);
      if (errorMessage.length() > MAX_ERROR_MESSAGE_LENGTH) {
        errorMessage = errorMessage.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "...";
      }
    }

    updateJobStatus(jobId, terminal, errorMessage);
    partitionStartCursors.remove(jobId);
    LOG.info(
        "RDF job {} reached terminal state {} (success={}, failed={})",
        jobId,
        terminal,
        job.getSuccessRecords(),
        job.getFailedRecords());
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
    evictStaleCursorCacheEntries();
  }

  /**
   * Drop precomputed-cursor cache entries for jobs that no longer exist in the DB
   * or are already terminal. Without this a server that crashed mid-job before
   * {@link #refreshAggregatedJob} could mark the job terminal would leak the cache
   * entry until the process restarts.
   */
  private void evictStaleCursorCacheEntries() {
    if (partitionStartCursors.isEmpty()) {
      return;
    }
    partitionStartCursors
        .keySet()
        .removeIf(
            cachedJobId -> {
              RdfIndexJob job = getJob(cachedJobId).orElse(null);
              return job == null || job.isTerminal();
            });
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
      // Partition lastError is an additional error signal alongside
      // failedPartitions/failedRecords: a partition can finish COMPLETED but
      // still carry a non-null lastError (e.g. relationship/lineage bulk write
      // failures that don't bump failedRecords). Without this check the job
      // could be promoted straight to COMPLETED here, and the later
      // checkAndUpdateJobCompletion call would early-return because the job
      // is already terminal — silently dropping the error signal.
      boolean hasPartitionLastError =
          !collectionDAO
              .rdfIndexPartitionDAO()
              .findRecentPartitionErrors(jobId.toString(), 1)
              .isEmpty();
      if (status == IndexJobStatus.STOPPING) {
        status = IndexJobStatus.STOPPED;
      } else if (aggregate.failedPartitions() > 0
          || aggregate.failedRecords() > 0
          || hasPartitionLastError) {
        status = IndexJobStatus.COMPLETED_WITH_ERRORS;
        if (errorMessage == null || errorMessage.isBlank()) {
          errorMessage = aggregatePartitionErrors(jobId, aggregate);
        }
      } else if (status == IndexJobStatus.READY || status == IndexJobStatus.RUNNING) {
        status = IndexJobStatus.COMPLETED;
      }
    } else if (status == IndexJobStatus.READY) {
      status = IndexJobStatus.RUNNING;
    }

    Long completedAt = existing.getCompletedAt();
    boolean isTerminalNow =
        status == IndexJobStatus.COMPLETED
            || status == IndexJobStatus.COMPLETED_WITH_ERRORS
            || status == IndexJobStatus.FAILED
            || status == IndexJobStatus.STOPPED;
    if (completedAt == null && isTerminalNow) {
      completedAt = System.currentTimeMillis();
    }
    if (isTerminalNow) {
      partitionStartCursors.remove(jobId);
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

  private String aggregatePartitionErrors(UUID jobId, RdfAggregatedStatsRecord aggregate) {
    List<String> samples =
        collectionDAO
            .rdfIndexPartitionDAO()
            .findRecentPartitionErrors(jobId.toString(), MAX_ERROR_SAMPLES);
    StringBuilder summary = new StringBuilder();
    summary
        .append(aggregate.failedRecords())
        .append(" record(s) failed across ")
        .append(aggregate.failedPartitions())
        .append(" partition(s).");
    if (samples != null && !samples.isEmpty()) {
      summary.append(" Sample errors: ");
      summary.append(String.join(" | ", samples));
    }
    String message = summary.toString();
    return message.length() > MAX_ERROR_MESSAGE_LENGTH
        ? message.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
        : message;
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
