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
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

/**
 * Tracks partition completion per entity type during distributed reindexing.
 * When all partitions for an entity complete, triggers a callback to promote
 * that entity's index immediately rather than waiting for the entire job to finish.
 */
@Slf4j
public class EntityCompletionTracker {
  private final Map<String, AtomicInteger> totalPartitions = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> completedPartitions = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> failedPartitions = new ConcurrentHashMap<>();
  private final Set<String> promotedEntities = ConcurrentHashMap.newKeySet();
  private volatile BiConsumer<String, Boolean> onEntityComplete;
  private final UUID jobId;

  public EntityCompletionTracker(UUID jobId) {
    this.jobId = jobId;
  }

  /**
   * Initialize tracking for an entity type with its partition count.
   *
   * @param entityType The entity type to track
   * @param partitionCount The total number of partitions for this entity
   */
  public void initializeEntity(String entityType, int partitionCount) {
    totalPartitions.put(entityType, new AtomicInteger(partitionCount));
    completedPartitions.put(entityType, new AtomicInteger(0));
    failedPartitions.put(entityType, new AtomicInteger(0));
    LOG.debug(
        "Initialized tracking for entity '{}' with {} partitions (job {})",
        entityType,
        partitionCount,
        jobId);
  }

  /**
   * Set the callback to invoke when all partitions for an entity complete.
   *
   * @param callback BiConsumer receiving (entityType, allPartitionsSucceeded)
   */
  public void setOnEntityComplete(BiConsumer<String, Boolean> callback) {
    this.onEntityComplete = callback;
  }

  /**
   * Record that a partition has completed (either successfully or with failure).
   *
   * @param entityType The entity type of the completed partition
   * @param partitionFailed Whether this partition failed (vs. completed successfully)
   */
  public void recordPartitionComplete(String entityType, boolean partitionFailed) {
    AtomicInteger completed = completedPartitions.get(entityType);
    AtomicInteger total = totalPartitions.get(entityType);

    if (completed == null || total == null) {
      LOG.warn(
          "Received partition completion for untracked entity '{}' (job {})", entityType, jobId);
      return;
    }

    if (partitionFailed) {
      AtomicInteger failed = failedPartitions.get(entityType);
      if (failed != null) {
        failed.incrementAndGet();
      }
    }

    int newCompleted = completed.incrementAndGet();
    int totalCount = total.get();

    LOG.debug(
        "Entity '{}' partition completed: {}/{} (failed: {}, job {})",
        entityType,
        newCompleted,
        totalCount,
        partitionFailed,
        jobId);

    if (newCompleted >= totalCount) {
      AtomicInteger failed = failedPartitions.get(entityType);
      boolean hasFailed = failed != null && failed.get() > 0;
      promoteIfReady(entityType, hasFailed);
    }
  }

  /**
   * Check if an entity has already been promoted.
   *
   * @param entityType The entity type to check
   * @return true if the entity was already promoted
   */
  public boolean isPromoted(String entityType) {
    return promotedEntities.contains(entityType);
  }

  /**
   * Get all entities that have been promoted.
   *
   * @return Immutable set of promoted entity types
   */
  public Set<String> getPromotedEntities() {
    return Set.copyOf(promotedEntities);
  }

  /**
   * Get the job ID this tracker is associated with.
   *
   * @return The job UUID
   */
  public UUID getJobId() {
    return jobId;
  }

  /**
   * Reconcile entity completion state from the database. This catches completions that were missed
   * by in-memory tracking (e.g., partitions completed by participant servers or failed by the stale
   * reclaimer SQL, both of which bypass the in-memory EntityCompletionTracker).
   *
   * @param partitions All partitions for the job (from DB)
   */
  public void reconcileFromDatabase(List<SearchIndexPartition> partitions) {
    Map<String, List<SearchIndexPartition>> byEntity =
        partitions.stream().collect(Collectors.groupingBy(SearchIndexPartition::getEntityType));

    for (Map.Entry<String, List<SearchIndexPartition>> entry : byEntity.entrySet()) {
      String entityType = entry.getKey();
      List<SearchIndexPartition> entityPartitions = entry.getValue();

      if (promotedEntities.contains(entityType)) {
        continue;
      }

      boolean allDone =
          entityPartitions.stream()
              .allMatch(
                  p ->
                      p.getStatus() == PartitionStatus.COMPLETED
                          || p.getStatus() == PartitionStatus.FAILED);

      if (allDone && !entityPartitions.isEmpty()) {
        boolean hasFailed =
            entityPartitions.stream().anyMatch(p -> p.getStatus() == PartitionStatus.FAILED);

        LOG.info(
            "DB reconciliation: entity '{}' all {} partitions done (hasFailed={}, job {})",
            entityType,
            entityPartitions.size(),
            hasFailed,
            jobId);

        promoteIfReady(entityType, hasFailed);
      }
    }
  }

  private void promoteIfReady(String entityType, boolean hasFailed) {
    if (promotedEntities.add(entityType)) {
      boolean success = !hasFailed;

      LOG.info(
          "Entity '{}' all partitions complete (success={}, job {})", entityType, success, jobId);

      if (onEntityComplete != null) {
        try {
          onEntityComplete.accept(entityType, success);
        } catch (Exception e) {
          LOG.error("Error in entity completion callback for '{}' (job {})", entityType, jobId, e);
        }
      }
    }
  }

  /**
   * Get the completion status for an entity.
   *
   * @param entityType The entity type
   * @return Completion status or null if not tracked
   */
  public EntityCompletionStatus getStatus(String entityType) {
    AtomicInteger total = totalPartitions.get(entityType);
    AtomicInteger completed = completedPartitions.get(entityType);
    AtomicInteger failed = failedPartitions.get(entityType);

    if (total == null) {
      return null;
    }

    return new EntityCompletionStatus(
        entityType,
        total.get(),
        completed != null ? completed.get() : 0,
        failed != null ? failed.get() : 0,
        promotedEntities.contains(entityType));
  }

  /**
   * Status record for entity completion tracking.
   */
  public record EntityCompletionStatus(
      String entityType,
      int totalPartitions,
      int completedPartitions,
      int failedPartitions,
      boolean promoted) {

    public boolean isComplete() {
      return completedPartitions >= totalPartitions;
    }

    public boolean hasFailures() {
      return failedPartitions > 0;
    }
  }
}
