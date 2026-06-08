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

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

/**
 * Worker that processes a single partition of entities for search indexing.
 *
 * <p>Handles reading entities from the database within the partition's range and writing them to
 * the search index via the provided sink.
 */
@Slf4j
public class PartitionWorker {
  private static final long MAX_CURSOR_INITIALIZATION_OFFSET = (long) Integer.MAX_VALUE + 1L;

  /** Context key for entity type */
  private static final String ENTITY_TYPE_KEY = "entityType";

  /** Context key for staged index context. */
  private static final String STAGED_CONTEXT_KEY = "recreateContext";

  /** Context key for target index */
  private static final String TARGET_INDEX_KEY = "targetIndex";

  /** Progress update interval (every N entities) */
  private static final int PROGRESS_UPDATE_INTERVAL = 100;

  /** Overall deadline for waiting on sink operations to complete */
  private static final long SINK_WAIT_DEADLINE_MS = 300_000;

  /** Timeout per flush cycle when retrying sink completion */
  private static final int FLUSH_CYCLE_SECONDS = 30;

  private final DistributedSearchIndexCoordinator coordinator;
  private final BulkSink searchIndexSink;
  private final int batchSize;
  private final ReindexContext stagedIndexContext;
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  private final IndexingFailureRecorder failureRecorder;
  private final ReindexingConfiguration reindexConfig;

  public PartitionWorker(
      DistributedSearchIndexCoordinator coordinator,
      BulkSink searchIndexSink,
      int batchSize,
      ReindexContext stagedIndexContext) {
    this(coordinator, searchIndexSink, batchSize, stagedIndexContext, null, null);
  }

  public PartitionWorker(
      DistributedSearchIndexCoordinator coordinator,
      BulkSink searchIndexSink,
      int batchSize,
      ReindexContext stagedIndexContext,
      IndexingFailureRecorder failureRecorder) {
    this(coordinator, searchIndexSink, batchSize, stagedIndexContext, failureRecorder, null);
  }

  public PartitionWorker(
      DistributedSearchIndexCoordinator coordinator,
      BulkSink searchIndexSink,
      int batchSize,
      ReindexContext stagedIndexContext,
      IndexingFailureRecorder failureRecorder,
      ReindexingConfiguration reindexConfig) {
    this.coordinator = coordinator;
    this.searchIndexSink = searchIndexSink;
    this.batchSize = batchSize;
    this.stagedIndexContext = stagedIndexContext;
    this.failureRecorder = failureRecorder;
    this.reindexConfig = reindexConfig;
  }

  /**
   * Process a partition, indexing all entities within its range.
   *
   * @param partition The partition to process
   * @return Result containing success and failure counts
   */
  public PartitionResult processPartition(SearchIndexPartition partition) {
    // Reindex worker threads opt out of the Redis-backed entity cache. Cache hit rate during a
    // bulk reindex is ~0 (every entity read exactly once) and the write-through tax is ~2-3M
    // Redis ops per 580k-entity reindex; on an unhealthy Redis the indexer crawls at ~0.6 r/s
    // because every relationship lookup pays a 300ms timeout. Bypassing for the duration of
    // the partition keeps the reindex independent of cache health and removes the unwanted
    // write-through pollution. Other code paths (UI requests, etc.) on other threads keep
    // using the cache normally.
    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skip()) {
      return processPartitionInternal(partition);
    }
  }

  private PartitionResult processPartitionInternal(SearchIndexPartition partition) {
    String entityType = SearchIndexEntityTypes.normalizeEntityType(partition.getEntityType());
    long rangeStart = partition.getRangeStart();
    long rangeEnd = partition.getRangeEnd();

    LOG.info(
        "Starting partition {} for entity type {} (range: {} - {})",
        partition.getId(),
        entityType,
        rangeStart,
        rangeEnd);

    if (stopped.get() || Thread.currentThread().isInterrupted()) {
      LOG.info("Skipping partition {} because worker is already stopped", partition.getId());
      return new PartitionResult(0, 0, true);
    }

    AtomicLong successCount = new AtomicLong(0);
    AtomicLong failedCount = new AtomicLong(0);
    AtomicLong readerFailedCount = new AtomicLong(0);
    AtomicLong warningsCount = new AtomicLong(0);
    AtomicLong processedCount = new AtomicLong(0);
    long currentOffset = rangeStart;

    // Create stats tracker for this partition
    StageStatsTracker statsTracker =
        new StageStatsTracker(
            partition.getJobId().toString(),
            ServerIdentityResolver.getInstance().getServerId(),
            entityType,
            coordinator.getCollectionDAO().searchIndexServerStatsDAO());

    try {
      // Mark partition as started
      SearchIndexPartition processing =
          partition.toBuilder()
              .status(PartitionStatus.PROCESSING)
              .startedAt(System.currentTimeMillis())
              .build();
      coordinator.updatePartitionProgress(processing);

      // Initialize keyset cursor for efficient pagination (avoids OFFSET degradation)
      long cursorInitStart = System.currentTimeMillis();
      String keysetCursor = initializeKeysetCursor(partition, rangeStart);
      LOG.debug(
          "initializeKeysetCursor for {} offset={} took {}ms",
          entityType,
          rangeStart,
          System.currentTimeMillis() - cursorInitStart);

      // Process in batches
      while (currentOffset < rangeEnd
          && !stopped.get()
          && !Thread.currentThread().isInterrupted()) {
        int currentBatchSize = (int) Math.min(batchSize, rangeEnd - currentOffset);

        try {
          BatchResult batchResult =
              processBatch(entityType, keysetCursor, currentBatchSize, statsTracker);
          // Check for stop/interrupt after DB read completes
          if (stopped.get() || Thread.currentThread().isInterrupted()) {
            break;
          }
          successCount.addAndGet(batchResult.successCount());
          failedCount.addAndGet(batchResult.failedCount());
          warningsCount.addAndGet(batchResult.warningsCount());
          processedCount.addAndGet(
              batchResult.successCount() + batchResult.failedCount() + batchResult.warningsCount());

          currentOffset += currentBatchSize;
          keysetCursor = batchResult.nextCursor();

          // Update progress periodically
          if (processedCount.get() % PROGRESS_UPDATE_INTERVAL < batchSize) {
            updateProgress(
                partition,
                currentOffset,
                processedCount.get(),
                successCount.get(),
                failedCount.get());
          }

          // If keyset cursor exhausted, recompute or stop
          if (keysetCursor == null && currentOffset < rangeEnd) {
            keysetCursor = initializeKeysetCursor(partition, currentOffset);
            if (keysetCursor == null) {
              LOG.debug(
                  "{} partition {} data exhausted at offset {} (rangeEnd: {}), "
                      + "missing {} records. processedCount={}",
                  entityType,
                  partition.getId(),
                  currentOffset,
                  rangeEnd,
                  rangeEnd - currentOffset,
                  processedCount.get());
              break;
            }
          }

        } catch (SearchIndexException e) {
          LOG.error("Error processing batch at offset {} for {}", currentOffset, entityType, e);

          boolean isReaderFailure =
              e.getIndexingError() != null
                  && e.getIndexingError().getErrorSource()
                      == org.openmetadata.schema.system.IndexingError.ErrorSource.READER;

          int batchFailedCount =
              e.getIndexingError() != null && e.getIndexingError().getFailedCount() != null
                  ? e.getIndexingError().getFailedCount()
                  : currentBatchSize;

          if (isReaderFailure) {
            if (statsTracker != null) {
              statsTracker.recordReaderBatch(0, batchFailedCount, 0);
            }
            if (failureRecorder != null) {
              failureRecorder.recordReaderFailure(
                  entityType, e.getMessage(), ExceptionUtils.getStackTrace(e));
            }
            readerFailedCount.addAndGet(batchFailedCount);
          } else {
            if (statsTracker != null) {
              statsTracker.recordSinkBatch(0, batchFailedCount);
            }
            if (failureRecorder != null) {
              failureRecorder.recordSinkFailure(
                  entityType,
                  "BATCH",
                  "batch_at_offset_" + currentOffset,
                  e.getMessage(),
                  ExceptionUtils.getStackTrace(e));
            }
          }

          failedCount.addAndGet(batchFailedCount);
          processedCount.addAndGet(batchFailedCount);
          currentOffset += currentBatchSize;

          // Recompute keyset cursor after failure
          if (currentOffset < rangeEnd) {
            keysetCursor = initializeKeysetCursor(partition, currentOffset);
            if (keysetCursor == null) {
              break;
            }
          }

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
        // Wait briefly for async sink operations to complete and update tracker
        waitForSinkOperations(statsTracker);
        return new PartitionResult(
            successCount.get(),
            failedCount.get(),
            true,
            readerFailedCount.get(),
            warningsCount.get());
      }

      // Wait for async sink operations to complete and flush stats to DB
      // IMPORTANT: This must happen BEFORE marking partition complete, otherwise
      // the coordinator may aggregate stats before they're written to the database
      long waitStart = System.currentTimeMillis();
      waitForSinkOperations(statsTracker);
      LOG.debug("waitForSinkOperations took {}ms", System.currentTimeMillis() - waitStart);

      // Adjust partition counts to include process-stage failures.
      // BatchResult.successCount counts entities READ, not entities successfully PROCESSED.
      // Process failures happen async in addEntity() and are tracked by StageStatsTracker.
      long processFailed =
          statsTracker != null ? statsTracker.getProcess().getCumulativeFailed().get() : 0;
      if (processFailed > 0) {
        long adjustment = Math.min(processFailed, successCount.get());
        if (adjustment > 0) {
          successCount.addAndGet(-adjustment);
          failedCount.addAndGet(adjustment);
        }
      }

      // Mark partition as completed (stats are now in the database)
      coordinator.completePartition(partition.getId(), successCount.get(), failedCount.get());

      long expectedRecords = rangeEnd - rangeStart;
      long actualProcessed = successCount.get() + failedCount.get();
      LOG.info(
          "Completed partition {} for entity type {} (success: {}, failed: {}, readerFailed: {}, processFailed: {}, warnings: {})",
          partition.getId(),
          entityType,
          successCount.get(),
          failedCount.get(),
          readerFailedCount.get(),
          processFailed,
          warningsCount.get());
      if (actualProcessed < expectedRecords) {
        LOG.debug(
            "{} partition {} processed fewer records than expected: "
                + "actual={}, expected={}, gap={}, range=[{},{})",
            entityType,
            partition.getId(),
            actualProcessed,
            expectedRecords,
            expectedRecords - actualProcessed,
            rangeStart,
            rangeEnd);
      }

      return new PartitionResult(
          successCount.get(),
          failedCount.get(),
          false,
          readerFailedCount.get(),
          warningsCount.get());

    } catch (Exception e) {
      LOG.error("Fatal error processing partition {}", partition.getId(), e);
      coordinator.failPartition(partition.getId(), e.getMessage());
      waitForSinkOperations(statsTracker);
      return new PartitionResult(
          successCount.get(),
          failedCount.get(),
          false,
          readerFailedCount.get(),
          warningsCount.get());
    }
  }

  /**
   * Wait for pending async sink operations to complete, then flush stats.
   * This ensures that stats from async bulk callbacks are captured before the tracker is abandoned.
   *
   * <p>When vector indexing is enabled, the sink may have long-running vector embedding tasks.
   * We wait for both:
   * <ul>
   *   <li>The StageStatsTracker's pending operations (for stats accuracy)</li>
   * </ul>
   *
   * @param statsTracker The stats tracker to flush after waiting
   */
  private void waitForSinkOperations(StageStatsTracker statsTracker) {
    // Flush the bulk processor to send any pending documents immediately
    // Without this, documents wait for the periodic flush interval (5 seconds)
    searchIndexSink.flushAndAwait(FLUSH_CYCLE_SECONDS);

    // Check if there are pending vector tasks - if so, we need a longer timeout
    int pendingVectorTasks = searchIndexSink.getPendingVectorTaskCount();
    boolean hasVectorTasks = pendingVectorTasks > 0;

    if (hasVectorTasks) {
      LOG.debug(
          "Waiting for {} pending vector tasks before completing partition for entity {}",
          pendingVectorTasks,
          statsTracker.getEntityType());

      boolean vectorComplete = searchIndexSink.awaitVectorCompletion(120);
      if (!vectorComplete) {
        LOG.warn(
            "Timed out waiting for vector completion, {} tasks still pending for entity {}",
            searchIndexSink.getPendingVectorTaskCount(),
            statsTracker.getEntityType());
      }
    }

    // Wait for all sink callbacks with retries. The bulk processor is shared across
    // partition workers, so slow batches from other entity types (e.g. testCaseResult
    // writes taking 70+ seconds) can delay our callbacks. Instead of a single fixed
    // timeout, retry flush cycles until all pending operations complete.
    long deadline = System.currentTimeMillis() + SINK_WAIT_DEADLINE_MS;
    int retryCount = 0;
    long previousPending = statsTracker.getPendingSinkOps();
    int staleRetries = 0;

    while (statsTracker.getPendingSinkOps() > 0 && System.currentTimeMillis() < deadline) {
      long remainingMs = deadline - System.currentTimeMillis();
      long waitMs = Math.min(30_000, remainingMs);

      if (statsTracker.awaitSinkCompletion(waitMs)) {
        break;
      }

      if (statsTracker.getPendingSinkOps() > 0 && System.currentTimeMillis() < deadline) {
        retryCount++;
        long currentPending = statsTracker.getPendingSinkOps();
        LOG.info(
            "Retry {} - {} sink operations still pending for entity {}, re-flushing bulk processor",
            retryCount,
            currentPending,
            statsTracker.getEntityType());
        searchIndexSink.flushAndAwait(FLUSH_CYCLE_SECONDS);

        if (currentPending == previousPending) {
          staleRetries++;
          if (staleRetries >= 3) {
            LOG.warn(
                "Pending sink ops stuck at {} for entity {} after {} retries with no progress. "
                    + "Reconciling early (callbacks likely lost).",
                currentPending,
                statsTracker.getEntityType(),
                staleRetries);
            break;
          }
        } else {
          staleRetries = 0;
        }
        previousPending = currentPending;
      }
    }

    if (statsTracker.getPendingSinkOps() > 0) {
      LOG.warn(
          "Reconciling {} pending sink operations after {} retries for entity {} "
              + "(bulk processor was flushed, treating as successful)",
          statsTracker.getPendingSinkOps(),
          retryCount,
          statsTracker.getEntityType());
      statsTracker.reconcilePendingSinkOps();
    }

    statsTracker.flush();
  }

  /**
   * Process a single batch of entities.
   *
   * @param entityType The entity type
   * @param offset Starting offset
   * @param batchSize Number of entities to process
   * @param statsTracker Optional stats tracker for vector stats
   * @return Batch processing result
   */
  private BatchResult processBatch(
      String entityType, String keysetCursor, int batchSize, StageStatsTracker statsTracker)
      throws SearchIndexException {

    long readStartNanos = System.nanoTime();
    ResultList<?> resultList = readEntitiesKeyset(entityType, keysetCursor, batchSize);
    long readDurationNanos = System.nanoTime() - readStartNanos;

    int readSuccessCount = resultList != null ? listOrEmpty(resultList.getData()).size() : 0;
    int readErrorCount = resultList != null ? listOrEmpty(resultList.getErrors()).size() : 0;
    int warningsCount =
        (resultList != null && resultList.getWarningsCount() != null)
            ? resultList.getWarningsCount()
            : 0;
    String nextCursor =
        (resultList != null && resultList.getPaging() != null)
            ? resultList.getPaging().getAfter()
            : null;

    if (statsTracker != null) {
      // Reader timing = wall-clock time of the keyset DB read (listAfter + setFieldsInBulk
      // hydration). This isolates DB latency from downstream queue / process / sink work.
      statsTracker.recordReaderBatch(
          readSuccessCount, readErrorCount, warningsCount, readDurationNanos);
    }

    recordReaderFailures(entityType, resultList, readErrorCount);
    recordRelationshipWarnings(entityType, resultList);

    if (readSuccessCount == 0) {
      LOG.debug(
          "{} read={}ms returned no indexable rows (warnings={}, errors={})",
          entityType,
          readDurationNanos / 1_000_000L,
          warningsCount,
          readErrorCount);
      return new BatchResult(0, readErrorCount, warningsCount, nextCursor);
    }

    Map<String, Object> contextData = createContextData(entityType, statsTracker);

    long readMs = readDurationNanos / 1_000_000L;
    try {
      long writeStartMs = System.currentTimeMillis();
      writeToSink(entityType, resultList, contextData);
      long writeMs = System.currentTimeMillis() - writeStartMs;
      LOG.debug(
          "{} read={}ms write={}ms total={}ms records={}",
          entityType,
          readMs,
          writeMs,
          readMs + writeMs,
          readSuccessCount);
      return new BatchResult(readSuccessCount, readErrorCount, warningsCount, nextCursor);
    } catch (Exception e) {
      throw new SearchIndexException(
          new org.openmetadata.schema.system.IndexingError()
              .withErrorSource(org.openmetadata.schema.system.IndexingError.ErrorSource.SINK)
              .withSubmittedCount(readSuccessCount)
              .withFailedCount(readSuccessCount)
              .withMessage("Failed to write batch to search index: " + e.getMessage()));
    }
  }

  /**
   * Persist per-entity reader failures so that downstream tooling (e.g. the failures dashboard)
   * can show which specific records the reader could not hydrate. Runs whether or not the batch
   * has any successful rows — losing failure diagnostics for "all-error" batches would defeat
   * the point of the recorder.
   */
  private void recordReaderFailures(
      String entityType, ResultList<?> resultList, int readErrorCount) {
    if (failureRecorder == null || readErrorCount == 0 || resultList == null) {
      return;
    }
    for (EntityError entityError : listOrEmpty(resultList.getErrors())) {
      Object rawEntity = entityError.getEntity();
      String entityId = null;
      if (rawEntity instanceof EntityInterface) {
        UUID id = ((EntityInterface) rawEntity).getId();
        if (id != null) {
          entityId = id.toString();
        }
      } else if (rawEntity != null) {
        entityId = rawEntity.toString();
      }
      if (entityId == null) {
        // Time-series readers (EntityTimeSeriesRepository) build EntityError without an id —
        // they only have access to the JSON row, not the entity reference. Per-entity recording
        // requires an id, so log at DEBUG (not WARN) to avoid spamming logs for every error in
        // large time-series batches.
        LOG.debug(
            "No entityId on reader failure for entityType={} — skipping per-entity record. message={}",
            entityType,
            entityError.getMessage());
        continue;
      }
      failureRecorder.recordReaderEntityFailure(
          entityType, entityId, null, entityError.getMessage());
    }
  }

  /**
   * Persist stale-relationship warnings (records read but not indexable because their parent is
   * gone) to the failures table, tagged {@code READER_RELATIONSHIP_WARNING}. These are not
   * failures and never count against the job's failure total — they are recorded only so an
   * operator can find and clean up the orphaned rows from the failures dashboard.
   */
  private void recordRelationshipWarnings(String entityType, ResultList<?> resultList) {
    if (failureRecorder == null || resultList == null) {
      return;
    }
    for (EntityError warning : listOrEmpty(resultList.getWarnings())) {
      Object rawEntity = warning.getEntity();
      String entityId = null;
      String entityFqn = null;
      if (rawEntity instanceof EntityInterface entity) {
        UUID id = entity.getId();
        entityId = id != null ? id.toString() : null;
        entityFqn = entity.getFullyQualifiedName();
      }
      failureRecorder.recordRelationshipWarning(
          entityType, entityId, entityFqn, warning.getMessage());
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
  private ResultList<?> readEntitiesKeyset(String entityType, String keysetCursor, int limit)
      throws SearchIndexException {
    String normalizedEntityType = SearchIndexEntityTypes.normalizeEntityType(entityType);

    // Selective fields avoid running expensive field fetchers that are stripped out before
    // indexing.
    List<String> fields = ReindexingUtil.getSearchIndexFields(normalizedEntityType);

    if (!SearchIndexEntityTypes.isTimeSeriesEntity(normalizedEntityType)) {
      PaginatedEntitiesSource source =
          new PaginatedEntitiesSource(normalizedEntityType, limit, fields, 0);
      return source.readNextKeyset(keysetCursor);
    } else {
      Long filterStartTs = null;
      Long filterEndTs = null;
      if (reindexConfig != null) {
        long startTs = reindexConfig.getTimeSeriesStartTs(normalizedEntityType);
        if (startTs > 0) {
          filterStartTs = startTs;
          filterEndTs = System.currentTimeMillis();
        }
      }
      PaginatedEntityTimeSeriesSource source =
          (filterStartTs != null)
              ? new PaginatedEntityTimeSeriesSource(
                  normalizedEntityType, limit, fields, filterStartTs, filterEndTs)
              : new PaginatedEntityTimeSeriesSource(normalizedEntityType, limit, fields, 0);
      return source.readWithCursor(keysetCursor);
    }
  }

  private String initializeKeysetCursor(SearchIndexPartition partition, long offset) {
    if (offset <= 0) {
      return null;
    }
    String entityType = SearchIndexEntityTypes.normalizeEntityType(partition.getEntityType());
    if (SearchIndexEntityTypes.isTimeSeriesEntity(entityType)) {
      return RestUtil.encodeCursor(String.valueOf(offset));
    }
    // Fast path: coordinator precomputed boundary cursors for every partition's
    // rangeStart at job initialization (single keyset walk per entity type, O(N) total).
    // Only the partition's first call lands on a known rangeStart value; mid-partition
    // recomputes (after batch failure) won't hit this path and fall through to the
    // OFFSET-based fallback below. Cache lookup is scoped by jobId to avoid stale hits
    // from a previous job that ran on the same server.
    String precomputed =
        coordinator.getPartitionStartCursor(partition.getJobId(), entityType, offset);
    if (precomputed != null) {
      return precomputed;
    }
    int cursorOffset = toCursorOffset(entityType, offset);
    ListFilter filter = new ListFilter(Include.ALL);
    String cursor = Entity.getEntityRepository(entityType).getCursorAtOffset(filter, cursorOffset);
    if (cursor == null) {
      LOG.debug(
          "getCursorAtOffset returned null for {} at offset {} (cursorOffset={})",
          entityType,
          offset,
          cursorOffset);
    }
    return cursor;
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
    String normalizedEntityType = SearchIndexEntityTypes.normalizeEntityType(entityType);

    if (!SearchIndexEntityTypes.isTimeSeriesEntity(normalizedEntityType)) {
      List<EntityInterface> entities = (List<EntityInterface>) resultList.getData();
      ReindexingUtil.populateDocBuildContext(contextData, normalizedEntityType, entities);
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
   * @param statsTracker Optional stats tracker for vector stats
   * @return Context data map
   */
  private Map<String, Object> createContextData(String entityType, StageStatsTracker statsTracker) {
    String normalizedEntityType = SearchIndexEntityTypes.normalizeEntityType(entityType);
    Map<String, Object> contextData = new java.util.HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, normalizedEntityType);

    if (statsTracker != null) {
      contextData.put(BulkSink.STATS_TRACKER_CONTEXT_KEY, statsTracker);
    }

    if (stagedIndexContext == null) {
      throw new IllegalStateException(
          "Staged index context is required for distributed reindexing");
    }

    String targetIndex =
        stagedIndexContext
            .getStagedIndex(normalizedEntityType)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No staged index configured for entity type: " + normalizedEntityType));
    contextData.put(STAGED_CONTEXT_KEY, stagedIndexContext);
    contextData.put(TARGET_INDEX_KEY, targetIndex);

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
            .status(PartitionStatus.PROCESSING)
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

  public boolean isStopped() {
    return stopped.get();
  }

  public record BatchResult(
      int successCount, int failedCount, int warningsCount, String nextCursor) {}

  public record PartitionResult(
      long successCount,
      long failedCount,
      boolean wasStopped,
      long readerFailed,
      long readerWarnings) {
    public PartitionResult(long successCount, long failedCount, boolean wasStopped) {
      this(successCount, failedCount, wasStopped, 0, 0);
    }

    public PartitionResult(
        long successCount, long failedCount, boolean wasStopped, long readerFailed) {
      this(successCount, failedCount, wasStopped, readerFailed, 0);
    }
  }
}
