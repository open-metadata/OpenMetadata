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
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;

/**
 * Tracks partition completion per entity type during distributed RDF reindexing.
 * When all partitions for an entity complete, fires a callback so consumers can
 * promote that entity's RDF view (e.g. swap a staging graph) immediately rather
 * than waiting for the full job to finish.
 */
@Slf4j
public class RdfEntityCompletionTracker {
  private final Map<String, AtomicInteger> totalPartitions = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> completedPartitions = new ConcurrentHashMap<>();
  private final Map<String, AtomicInteger> failedPartitions = new ConcurrentHashMap<>();
  private final Set<String> promotedEntities = ConcurrentHashMap.newKeySet();
  private volatile BiConsumer<String, Boolean> onEntityComplete;
  private final UUID jobId;

  public RdfEntityCompletionTracker(UUID jobId) {
    this.jobId = jobId;
  }

  public void initializeEntity(String entityType, int partitionCount) {
    totalPartitions.put(entityType, new AtomicInteger(partitionCount));
    completedPartitions.put(entityType, new AtomicInteger(0));
    failedPartitions.put(entityType, new AtomicInteger(0));
  }

  public void setOnEntityComplete(BiConsumer<String, Boolean> callback) {
    this.onEntityComplete = callback;
  }

  public void recordPartitionComplete(String entityType, boolean partitionFailed) {
    AtomicInteger completed = completedPartitions.get(entityType);
    AtomicInteger total = totalPartitions.get(entityType);
    if (completed == null || total == null) {
      LOG.warn(
          "Received RDF partition completion for untracked entity '{}' (job {})",
          entityType,
          jobId);
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
    if (newCompleted >= totalCount) {
      AtomicInteger failed = failedPartitions.get(entityType);
      boolean hasFailed = failed != null && failed.get() > 0;
      promoteIfReady(entityType, hasFailed);
    }
  }

  public boolean isPromoted(String entityType) {
    return promotedEntities.contains(entityType);
  }

  public Set<String> getPromotedEntities() {
    return Set.copyOf(promotedEntities);
  }

  public UUID getJobId() {
    return jobId;
  }

  /**
   * Reconcile entity completion state from the partition table. Catches partition
   * completions that bypass the in-memory tracker — e.g. partitions completed by
   * a different participant server, or marked FAILED by the stale-reclaimer SQL.
   */
  public void reconcileFromDatabase(List<RdfIndexPartition> partitions) {
    Map<String, List<RdfIndexPartition>> byEntity =
        partitions.stream().collect(Collectors.groupingBy(RdfIndexPartition::getEntityType));
    for (Map.Entry<String, List<RdfIndexPartition>> entry : byEntity.entrySet()) {
      String entityType = entry.getKey();
      List<RdfIndexPartition> entityPartitions = entry.getValue();
      if (promotedEntities.contains(entityType)) {
        continue;
      }
      long completedCount =
          entityPartitions.stream()
              .filter(
                  p ->
                      p.getStatus() == PartitionStatus.COMPLETED
                          || p.getStatus() == PartitionStatus.FAILED)
              .count();
      boolean allDone = completedCount == entityPartitions.size() && !entityPartitions.isEmpty();
      if (allDone) {
        boolean hasFailed =
            entityPartitions.stream().anyMatch(p -> p.getStatus() == PartitionStatus.FAILED);
        promoteIfReady(entityType, hasFailed);
      }
    }
  }

  private void promoteIfReady(String entityType, boolean hasFailed) {
    if (promotedEntities.add(entityType)) {
      boolean success = !hasFailed;
      LOG.debug(
          "RDF entity '{}' all partitions complete (success={}, job {})",
          entityType,
          success,
          jobId);
      if (onEntityComplete != null) {
        try {
          onEntityComplete.accept(entityType, success);
        } catch (Exception e) {
          LOG.error(
              "Error in RDF entity-completion callback for '{}' (job {})", entityType, jobId, e);
        }
      }
    }
  }

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
