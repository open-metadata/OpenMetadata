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
import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

/**
 * Worker that processes a single partition of entities for search indexing.
 *
 * <p>Handles reading entities from the database within the partition's range and writing them to
 * the search index via the provided sink.
 */
@Slf4j
public class PartitionWorker {

  /** Time series entity types that need special handling */
  private static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  /** Context key for entity type */
  private static final String ENTITY_TYPE_KEY = "entityType";

  /** Context key for recreate index flag */
  private static final String RECREATE_INDEX = "recreateIndex";

  /** Context key for recreate context */
  private static final String RECREATE_CONTEXT = "recreateContext";

  /** Context key for target index */
  private static final String TARGET_INDEX_KEY = "targetIndex";

  /** Progress update interval (every N entities) */
  private static final int PROGRESS_UPDATE_INTERVAL = 100;

  private final DistributedSearchIndexCoordinator coordinator;
  private final BulkSink searchIndexSink;
  private final int batchSize;
  private final ReindexContext recreateContext;
  private final boolean recreateIndex;
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  private final IndexingFailureRecorder failureRecorder;

  public PartitionWorker(
      DistributedSearchIndexCoordinator coordinator,
      BulkSink searchIndexSink,
      int batchSize,
      ReindexContext recreateContext,
      boolean recreateIndex) {
    this(coordinator, searchIndexSink, batchSize, recreateContext, recreateIndex, null);
  }

  public PartitionWorker(
      DistributedSearchIndexCoordinator coordinator,
      BulkSink searchIndexSink,
      int batchSize,
      ReindexContext recreateContext,
      boolean recreateIndex,
      IndexingFailureRecorder failureRecorder) {
    this.coordinator = coordinator;
    this.searchIndexSink = searchIndexSink;
    this.batchSize = batchSize;
    this.recreateContext = recreateContext;
    this.recreateIndex = recreateIndex;
    this.failureRecorder = failureRecorder;
  }

  /**
   * Process a partition, indexing all entities within its range.
   *
   * @param partition The partition to process
   * @return Result containing success and failure counts
   */
  public PartitionResult processPartition(SearchIndexPartition partition) {
    String entityType = partition.getEntityType();
    long rangeStart = partition.getRangeStart();
    long rangeEnd = partition.getRangeEnd();

    LOG.info(
        "Starting partition {} for entity type {} (range: {} - {})",
        partition.getId(),
        entityType,
        rangeStart,
        rangeEnd);

    AtomicLong successCount = new AtomicLong(0);
    AtomicLong failedCount = new AtomicLong(0);
    AtomicLong processedCount = new AtomicLong(0);
    long currentOffset = rangeStart;

    try {
      // Mark partition as started
      SearchIndexPartition processing =
          partition.toBuilder()
              .status(PartitionStatus.PROCESSING)
              .startedAt(System.currentTimeMillis())
              .build();
      coordinator.updatePartitionProgress(processing);

      // Process in batches
      while (currentOffset < rangeEnd && !stopped.get()) {
        int currentBatchSize = (int) Math.min(batchSize, rangeEnd - currentOffset);

        try {
          BatchResult batchResult = processBatch(entityType, currentOffset, currentBatchSize);
          successCount.addAndGet(batchResult.successCount());
          failedCount.addAndGet(batchResult.failedCount());
          processedCount.addAndGet(batchResult.successCount() + batchResult.failedCount());

          currentOffset += currentBatchSize;

          // Update progress periodically
          if (processedCount.get() % PROGRESS_UPDATE_INTERVAL < batchSize) {
            updateProgress(
                partition,
                currentOffset,
                processedCount.get(),
                successCount.get(),
                failedCount.get());
          }

        } catch (SearchIndexException e) {
          LOG.error("Error processing batch at offset {} for {}", currentOffset, entityType, e);

          if (failureRecorder != null) {
            failureRecorder.recordReaderFailure(
                entityType, e.getMessage(), ExceptionUtils.getStackTrace(e));
          }

          failedCount.addAndGet(currentBatchSize);
          currentOffset += currentBatchSize;

          updateProgress(
              partition,
              currentOffset,
              processedCount.get(),
              successCount.get(),
              failedCount.get());
        }
      }

      if (stopped.get()) {
        LOG.info("Partition {} stopped by request", partition.getId());
        return new PartitionResult(successCount.get(), failedCount.get(), true);
      }

      // Mark partition as completed
      coordinator.completePartition(partition.getId(), successCount.get(), failedCount.get());

      LOG.info(
          "Completed partition {} for entity type {} (success: {}, failed: {})",
          partition.getId(),
          entityType,
          successCount.get(),
          failedCount.get());

      return new PartitionResult(successCount.get(), failedCount.get(), false);

    } catch (Exception e) {
      LOG.error("Fatal error processing partition {}", partition.getId(), e);
      coordinator.failPartition(partition.getId(), e.getMessage());
      return new PartitionResult(successCount.get(), failedCount.get(), false);
    }
  }

  /**
   * Process a single batch of entities.
   *
   * @param entityType The entity type
   * @param offset Starting offset
   * @param batchSize Number of entities to process
   * @return Batch processing result
   */
  private BatchResult processBatch(String entityType, long offset, int batchSize)
      throws SearchIndexException {

    String cursor = RestUtil.encodeCursor(String.valueOf(offset));
    ResultList<?> resultList = readEntities(entityType, cursor, batchSize);

    if (resultList == null || resultList.getData() == null || resultList.getData().isEmpty()) {
      return new BatchResult(0, 0);
    }

    Map<String, Object> contextData = createContextData(entityType);

    try {
      writeToSink(entityType, resultList, contextData);
      int successCount = listOrEmpty(resultList.getData()).size();
      int failedCount = listOrEmpty(resultList.getErrors()).size();
      return new BatchResult(successCount, failedCount);
    } catch (Exception e) {
      throw new SearchIndexException(
          new org.openmetadata.schema.system.IndexingError()
              .withErrorSource(org.openmetadata.schema.system.IndexingError.ErrorSource.SINK)
              .withMessage("Failed to write batch to search index: " + e.getMessage()));
    }
  }

  /**
   * Read entities from the database.
   *
   * @param entityType The entity type
   * @param cursor Pagination cursor
   * @param limit Number of entities to read
   * @return Result list containing entities
   */
  private ResultList<?> readEntities(String entityType, String cursor, int limit)
      throws SearchIndexException {

    List<String> fields = TIME_SERIES_ENTITIES.contains(entityType) ? List.of() : List.of("*");

    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      PaginatedEntitiesSource source = new PaginatedEntitiesSource(entityType, limit, fields);
      return source.readWithCursor(cursor);
    } else {
      PaginatedEntityTimeSeriesSource source =
          new PaginatedEntityTimeSeriesSource(entityType, limit, fields);
      return source.readWithCursor(cursor);
    }
  }

  /**
   * Write entities to the search index sink.
   *
   * @param entityType The entity type
   * @param resultList The entities to write
   * @param contextData Context data for the sink
   */
  @SuppressWarnings("unchecked")
  private void writeToSink(
      String entityType, ResultList<?> resultList, Map<String, Object> contextData)
      throws Exception {

    if (!TIME_SERIES_ENTITIES.contains(entityType)) {
      List<EntityInterface> entities = (List<EntityInterface>) resultList.getData();
      searchIndexSink.write(entities, contextData);
    } else {
      List<EntityTimeSeriesInterface> entities =
          (List<EntityTimeSeriesInterface>) resultList.getData();
      searchIndexSink.write(entities, contextData);
    }
  }

  /**
   * Create context data for the sink operation.
   *
   * @param entityType The entity type
   * @return Context data map
   */
  private Map<String, Object> createContextData(String entityType) {
    Map<String, Object> contextData = new java.util.HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, entityType);
    contextData.put(RECREATE_INDEX, recreateIndex);

    if (recreateContext != null) {
      contextData.put(RECREATE_CONTEXT, recreateContext);
      recreateContext
          .getStagedIndex(entityType)
          .ifPresent(index -> contextData.put(TARGET_INDEX_KEY, index));
    }

    return contextData;
  }

  /**
   * Update partition progress in the database.
   *
   * @param partition The partition being processed
   * @param cursor Current cursor position
   * @param processed Total processed count
   * @param success Success count
   * @param failed Failed count
   */
  private void updateProgress(
      SearchIndexPartition partition, long cursor, long processed, long success, long failed) {

    SearchIndexPartition updated =
        partition.toBuilder()
            .cursor(cursor)
            .processedCount(processed)
            .successCount(success)
            .failedCount(failed)
            .build();

    coordinator.updatePartitionProgress(updated);
  }

  /**
   * Request this worker to stop processing.
   */
  public void stop() {
    stopped.set(true);
    LOG.info("Stop requested for partition worker");
  }

  /**
   * Check if this worker has been requested to stop.
   *
   * @return true if stop has been requested
   */
  public boolean isStopped() {
    return stopped.get();
  }

  /**
   * Result of processing a single batch.
   *
   * @param successCount Number of successfully indexed entities
   * @param failedCount Number of failed entities
   */
  public record BatchResult(int successCount, int failedCount) {}

  /**
   * Result of processing a partition.
   *
   * @param successCount Total successfully indexed entities
   * @param failedCount Total failed entities
   * @param wasStopped Whether processing was stopped before completion
   */
  public record PartitionResult(long successCount, long failedCount, boolean wasStopped) {}
}
