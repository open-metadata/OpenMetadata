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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@Slf4j
public class RdfPartitionWorker {
  private static final long MAX_CURSOR_INITIALIZATION_OFFSET = (long) Integer.MAX_VALUE + 1L;
  private static final int PROGRESS_UPDATE_INTERVAL = 100;

  private final DistributedRdfIndexCoordinator coordinator;
  private final RdfBatchProcessor batchProcessor;
  private final int batchSize;
  private final AtomicBoolean stopped = new AtomicBoolean(false);

  public RdfPartitionWorker(
      DistributedRdfIndexCoordinator coordinator, RdfBatchProcessor batchProcessor, int batchSize) {
    this.coordinator = coordinator;
    this.batchProcessor = batchProcessor;
    this.batchSize = batchSize;
  }

  public PartitionResult processPartition(RdfIndexPartition partition) {
    String entityType = partition.getEntityType();
    long currentOffset = Math.max(partition.getCursor(), partition.getRangeStart());
    long processedCount = partition.getProcessedCount();
    long successCount = partition.getSuccessCount();
    long failedCount = partition.getFailedCount();
    long relationshipFailureCount = 0;
    String lastError = null;

    try {
      String keysetCursor = initializeKeysetCursor(partition, entityType, currentOffset);
      while (currentOffset < partition.getRangeEnd()
          && !stopped.get()
          && !Thread.currentThread().isInterrupted()) {
        int currentBatchSize = (int) Math.min(batchSize, partition.getRangeEnd() - currentOffset);
        ResultList<? extends EntityInterface> resultList =
            readEntitiesKeyset(entityType, keysetCursor, currentBatchSize);

        if (resultList == null || listOrEmpty(resultList.getData()).isEmpty()) {
          break;
        }

        RdfBatchProcessor.BatchProcessingResult batchResult =
            batchProcessor.processEntities(entityType, resultList.getData(), stopped::get);

        // Reader failures are rows the source could not fully hydrate. They were
        // previously counted as failed records and dropped from the graph with no
        // diagnostic — operators saw the failure count climb with no way to find
        // the affected entities (#29211).
        //
        // An entity that DESERIALIZED but failed FIELD resolution (e.g. one
        // relationship the reindex field-set requests can't be resolved) still
        // carries its core stored data on the EntityError. Re-index it with that
        // core data so a single unresolvable field does not leave the whole entity
        // missing from RDF; its relationship edges are still rebuilt from the DB by
        // processBatchRelationships. Only rows that could not be deserialized at all
        // (no entity attached) remain hard failures. logReaderFailures attributes
        // each one (id + reason), mirroring search-index PartitionWorker.
        List<EntityError> readerFailures = listOrEmpty(resultList.getErrors());
        String readerError = logReaderFailures(entityType, readerFailures);
        List<EntityInterface> recoverable = recoverableEntities(readerFailures);
        RdfBatchProcessor.BatchProcessingResult recovered =
            recoverable.isEmpty()
                ? new RdfBatchProcessor.BatchProcessingResult(0, 0)
                : batchProcessor.processEntities(entityType, recoverable, stopped::get);
        int unrecoverable = readerFailures.size() - recoverable.size();
        long batchProcessed = resultList.getData().size() + readerFailures.size();

        processedCount += batchProcessed;
        successCount += batchResult.successCount() + recovered.successCount();
        // failedCount tracks entity-level failures only (matches the failedRecords
        // stat semantics where one record == one entity). Recovered entities indexed
        // with core data are NOT failures; only un-deserializable rows and any
        // core-index failures remain. Relationship/lineage edge failures are counted
        // separately and surfaced through relationshipFailureCount.
        failedCount += batchResult.failedCount() + recovered.failedCount() + unrecoverable;
        relationshipFailureCount +=
            batchResult.relationshipFailureCount() + recovered.relationshipFailureCount();
        currentOffset += batchProcessed;
        if (batchResult.lastError() != null) {
          lastError = batchResult.lastError();
        } else if (readerError != null) {
          lastError = readerError;
        }

        if (processedCount % PROGRESS_UPDATE_INTERVAL < batchProcessed) {
          coordinator.updatePartitionProgress(
              partition.toBuilder()
                  .cursor(currentOffset)
                  .processedCount(processedCount)
                  .successCount(successCount)
                  .failedCount(failedCount)
                  .build());
        }

        keysetCursor = resultList.getPaging() != null ? resultList.getPaging().getAfter() : null;
        if (keysetCursor == null && currentOffset < partition.getRangeEnd()) {
          keysetCursor = initializeKeysetCursor(partition, entityType, currentOffset);
          if (keysetCursor == null) {
            break;
          }
        }
      }

      if (stopped.get() || Thread.currentThread().isInterrupted()) {
        return new PartitionResult(
            processedCount, successCount, failedCount, relationshipFailureCount, true, lastError);
      }

      coordinator.completePartition(
          partition.getId(), currentOffset, processedCount, successCount, failedCount, lastError);
      return new PartitionResult(
          processedCount, successCount, failedCount, relationshipFailureCount, false, lastError);
    } catch (Exception e) {
      LOG.error("Failed to process RDF partition {}", partition.getId(), e);
      coordinator.failPartition(
          partition.getId(),
          currentOffset,
          processedCount,
          successCount,
          failedCount,
          e.getMessage());
      return new PartitionResult(
          processedCount,
          successCount,
          failedCount,
          relationshipFailureCount,
          false,
          e.getMessage());
    }
  }

  public void stop() {
    stopped.set(true);
  }

  /**
   * Log every reader failure with the offending entity's id/FQN and reason, and return a
   * representative message for the partition's {@code lastError}. A failure whose entity
   * deserialized (recoverable) is logged at WARN — it is re-indexed with core data, not dropped.
   * A row that could not be deserialized at all is logged at ERROR — it is dropped from the graph.
   * Without this the failure count rose with no way to identify the affected entities; the only
   * other trace was a DEBUG line in {@link
   * org.openmetadata.service.jdbi3.EntityRepository#listAfterKeyset} (#29211).
   */
  private String logReaderFailures(String entityType, List<EntityError> readerFailures) {
    String representativeError = null;
    for (EntityError failure : readerFailures) {
      representativeError = failure.getMessage();
      if (failure.getEntity() instanceof EntityInterface) {
        LOG.warn(
            "RDF reindex could not fully hydrate {} entity {} — indexing core data only. Reason: {}",
            entityType,
            describeFailedEntity(failure),
            failure.getMessage());
      } else {
        LOG.error(
            "RDF reindex could not deserialize a {} row — dropping it from the graph. Reason: {}",
            entityType,
            failure.getMessage());
      }
    }
    return representativeError;
  }

  /**
   * Entities that deserialized but failed field resolution still carry their core stored data on
   * the {@link EntityError}. Return them so the indexer can re-index them with that core data
   * instead of dropping them from the graph over a single unresolvable field (#29211).
   */
  private static List<EntityInterface> recoverableEntities(List<EntityError> readerFailures) {
    List<EntityInterface> recoverable = new ArrayList<>();
    for (EntityError failure : readerFailures) {
      if (failure.getEntity() instanceof EntityInterface entity) {
        recoverable.add(entity);
      }
    }
    return recoverable;
  }

  private static String describeFailedEntity(EntityError failure) {
    Object rawEntity = failure.getEntity();
    String descriptor;
    if (rawEntity instanceof EntityInterface entity) {
      descriptor = describeEntityReference(entity);
    } else if (rawEntity != null) {
      descriptor = rawEntity.toString();
    } else {
      descriptor = "<unknown>";
    }
    return descriptor;
  }

  private static String describeEntityReference(EntityInterface entity) {
    UUID id = entity.getId();
    String descriptor = id != null ? id.toString() : "<no-id>";
    String fqn = entity.getFullyQualifiedName();
    if (fqn != null) {
      descriptor = descriptor + " (" + fqn + ")";
    }
    return descriptor;
  }

  private ResultList<? extends EntityInterface> readEntitiesKeyset(
      String entityType, String keysetCursor, int limit) throws SearchIndexException {
    List<String> fields = ReindexingUtil.getSearchIndexFields(entityType);
    PaginatedEntitiesSource source = new PaginatedEntitiesSource(entityType, limit, fields, 0);
    return source.readNextKeyset(keysetCursor);
  }

  private String initializeKeysetCursor(
      RdfIndexPartition partition, String entityType, long offset) {
    if (offset <= 0) {
      return null;
    }
    String precomputed =
        coordinator.getPartitionStartCursor(partition.getJobId(), entityType, offset);
    if (precomputed != null) {
      return precomputed;
    }
    int cursorOffset = toCursorOffset(entityType, offset);
    return Entity.getEntityRepository(entityType)
        .getCursorAtOffset(new ListFilter(Include.ALL), cursorOffset);
  }

  private int toCursorOffset(String entityType, long offset) {
    long cursorOffset = offset - 1L;
    if (cursorOffset > Integer.MAX_VALUE) {
      throw new IllegalArgumentException(
          String.format(
              "Keyset cursor initialization for entityType %s does not support offsets above %d",
              entityType, MAX_CURSOR_INITIALIZATION_OFFSET));
    }
    return Math.toIntExact(cursorOffset);
  }

  /**
   * Outcome of processing a single partition.
   *
   * @param processedCount entities + reader-error rows seen
   * @param successCount entities written successfully
   * @param failedCount entity-level failures (counts toward failedRecords stats)
   * @param relationshipFailureCount per-edge relationship/lineage failures, NOT
   *     included in failedCount because they don't map to "records"; surfaced so
   *     completion tracking and run-record reporting can still flag the partition
   * @param stopped whether the partition exited via stop signal
   * @param errorMessage representative failure message if any
   */
  public record PartitionResult(
      long processedCount,
      long successCount,
      long failedCount,
      long relationshipFailureCount,
      boolean stopped,
      String errorMessage) {

    /** Did this partition encounter any failure (entity-level or relationship)? */
    public boolean hasAnyFailure() {
      return failedCount > 0 || relationshipFailureCount > 0;
    }
  }
}
