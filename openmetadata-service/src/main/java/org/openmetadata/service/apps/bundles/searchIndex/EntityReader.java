package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Phaser;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

/**
 * Standalone reader that encapsulates all entity reading logic. Decoupled from queues and sinks —
 * delivers batches via a callback interface.
 */
@Slf4j
public class EntityReader implements AutoCloseable {

  static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  private static final int MAX_READERS_PER_ENTITY = 5;

  @FunctionalInterface
  public interface BatchCallback {
    void onBatchRead(String entityType, ResultList<?> batch, int offset)
        throws InterruptedException;
  }

  @FunctionalInterface
  interface KeysetBatchReader {
    ResultList<?> readNextKeyset(String cursor) throws SearchIndexException;
  }

  @FunctionalInterface
  interface BoundaryFinder {
    List<String> findBoundaries(int numReaders, int totalRecords);
  }

  private static final int DEFAULT_MAX_RETRY_ATTEMPTS = 3;
  private static final long DEFAULT_RETRY_BACKOFF_MS = 500;

  private final ExecutorService producerExecutor;
  private final AtomicBoolean stopped;
  private final int maxRetryAttempts;
  private final long retryBackoffMs;

  public EntityReader(ExecutorService producerExecutor, AtomicBoolean stopped) {
    this(producerExecutor, stopped, DEFAULT_MAX_RETRY_ATTEMPTS, DEFAULT_RETRY_BACKOFF_MS);
  }

  public EntityReader(
      ExecutorService producerExecutor,
      AtomicBoolean stopped,
      int maxRetryAttempts,
      long retryBackoffMs) {
    this.producerExecutor = producerExecutor;
    this.stopped = stopped;
    this.maxRetryAttempts = maxRetryAttempts;
    this.retryBackoffMs = retryBackoffMs;
  }

  /**
   * Read all entities of a given type, invoking callback for each batch.
   *
   * @param entityType The entity type to read
   * @param totalRecords Total records expected for this entity
   * @param batchSize Batch size for reading
   * @param phaser Phaser for completion tracking (readers will register/deregister)
   * @param callback Callback invoked with each batch
   * @return Number of readers submitted
   */
  public int readEntity(
      String entityType, int totalRecords, int batchSize, Phaser phaser, BatchCallback callback) {
    return readEntity(entityType, totalRecords, batchSize, phaser, callback, null, null);
  }

  public int readEntity(
      String entityType,
      int totalRecords,
      int batchSize,
      Phaser phaser,
      BatchCallback callback,
      Long timeSeriesStartTs,
      Long timeSeriesEndTs) {
    if (totalRecords <= 0) {
      return 0;
    }

    int numReaders =
        Math.min(calculateNumberOfReaders(totalRecords, batchSize), MAX_READERS_PER_ENTITY);
    phaser.bulkRegister(numReaders);

    try {
      if (TIME_SERIES_ENTITIES.contains(entityType)) {
        submitReaders(
            entityType,
            totalRecords,
            batchSize,
            numReaders,
            phaser,
            callback,
            () -> {
              PaginatedEntityTimeSeriesSource source =
                  (timeSeriesStartTs != null)
                      ? new PaginatedEntityTimeSeriesSource(
                          entityType,
                          batchSize,
                          getSearchIndexFields(entityType),
                          totalRecords,
                          timeSeriesStartTs,
                          timeSeriesEndTs)
                      : new PaginatedEntityTimeSeriesSource(
                          entityType, batchSize, getSearchIndexFields(entityType), totalRecords);
              return source::readWithCursor;
            },
            (readers, total) -> {
              List<String> cursors = new ArrayList<>();
              int perReader = total / readers;
              for (int i = 1; i < readers; i++) {
                cursors.add(RestUtil.encodeCursor(String.valueOf(i * perReader)));
              }
              return cursors;
            });
      } else {
        PaginatedEntitiesSource entSource =
            new PaginatedEntitiesSource(
                entityType, batchSize, getSearchIndexFields(entityType), totalRecords);
        submitReaders(
            entityType,
            totalRecords,
            batchSize,
            numReaders,
            phaser,
            callback,
            () -> {
              PaginatedEntitiesSource source =
                  new PaginatedEntitiesSource(
                      entityType, batchSize, getSearchIndexFields(entityType), totalRecords);
              return source::readNextKeyset;
            },
            entSource::findBoundaryCursors);
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to submit readers for {}, deregistering {} phaser parties",
          entityType,
          numReaders,
          e);
      for (int i = 0; i < numReaders; i++) {
        phaser.arriveAndDeregister();
      }
      throw e;
    }

    return numReaders;
  }

  public void stop() {
    stopped.set(true);
  }

  @Override
  public void close() {
    stop();
  }

  private void submitReaders(
      String entityType,
      int totalRecords,
      int batchSize,
      int numReaders,
      Phaser phaser,
      BatchCallback callback,
      java.util.function.Supplier<KeysetBatchReader> readerFactory,
      BoundaryFinder boundaryFinder) {
    if (numReaders == 1) {
      KeysetBatchReader reader = readerFactory.get();
      producerExecutor.submit(
          () ->
              readKeysetBatches(
                  entityType, Integer.MAX_VALUE, batchSize, null, reader, phaser, callback));
      return;
    }

    List<String> boundaries = boundaryFinder.findBoundaries(numReaders, totalRecords);
    int actualReaders = boundaries.size() + 1;
    int recordsPerReader = (totalRecords + actualReaders - 1) / actualReaders;

    if (actualReaders < numReaders) {
      LOG.warn(
          "Boundary discovery for {} returned {} cursors (expected {}), using {} readers",
          entityType,
          boundaries.size(),
          numReaders - 1,
          actualReaders);
      for (int j = 0; j < numReaders - actualReaders; j++) {
        phaser.arriveAndDeregister();
      }
    }

    for (int i = 0; i < actualReaders; i++) {
      String startCursor = (i == 0) ? null : boundaries.get(i - 1);
      int limit = (i == actualReaders - 1) ? Integer.MAX_VALUE : recordsPerReader;
      KeysetBatchReader readerSource = readerFactory.get();
      final int readerLimit = limit;
      producerExecutor.submit(
          () ->
              readKeysetBatches(
                  entityType, readerLimit, batchSize, startCursor, readerSource, phaser, callback));
    }
  }

  private void readKeysetBatches(
      String entityType,
      int recordLimit,
      int batchSize,
      String startCursor,
      KeysetBatchReader batchReader,
      Phaser phaser,
      BatchCallback callback) {
    try {
      String keysetCursor = startCursor;
      int processed = 0;

      while (processed < recordLimit && !stopped.get()) {
        ResultList<?> result = readWithRetry(batchReader, keysetCursor, entityType);
        if (stopped.get()) {
          break;
        }

        if (result == null || result.getData().isEmpty()) {
          LOG.debug(
              "Reader for {} exhausted at processed={} of limit={} (empty result)",
              entityType,
              processed,
              recordLimit);
          break;
        }

        callback.onBatchRead(entityType, result, processed);

        int readCount = result.getData().size();
        int errorCount = result.getErrors() != null ? result.getErrors().size() : 0;
        int warningsCount = result.getWarningsCount() != null ? result.getWarningsCount() : 0;
        processed += readCount + errorCount + warningsCount;

        keysetCursor = result.getPaging() != null ? result.getPaging().getAfter() : null;
        if (keysetCursor == null) {
          LOG.debug(
              "Reader for {} exhausted at processed={} of limit={} (null cursor)",
              entityType,
              processed,
              recordLimit);
          break;
        }
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Interrupted during reading of {}", entityType);
    } catch (SearchIndexException e) {
      LOG.error("Error reading keyset batch for {}", entityType, e);
    } catch (Exception e) {
      if (!stopped.get()) {
        LOG.error("Error in keyset reading for {}", entityType, e);
      }
    } finally {
      phaser.arriveAndDeregister();
    }
  }

  private ResultList<?> readWithRetry(
      KeysetBatchReader batchReader, String keysetCursor, String entityType)
      throws SearchIndexException, InterruptedException {
    for (int attempt = 0; attempt <= maxRetryAttempts; attempt++) {
      try {
        return batchReader.readNextKeyset(keysetCursor);
      } catch (SearchIndexException e) {
        if (attempt >= maxRetryAttempts || !isTransientError(e)) {
          throw e;
        }
        long backoff = retryBackoffMs * (1L << attempt);
        LOG.warn(
            "Transient read failure for {} (attempt {}/{}), retrying in {}ms",
            entityType,
            attempt + 1,
            maxRetryAttempts,
            backoff);
        Thread.sleep(Math.min(backoff, 10_000));
      }
    }
    return null;
  }

  static boolean isTransientError(SearchIndexException e) {
    String msg = e.getMessage();
    if (msg == null) {
      return false;
    }
    String lower = msg.toLowerCase();
    return lower.contains("timeout")
        || lower.contains("connection")
        || lower.contains("pool exhausted")
        || lower.contains("connectexception")
        || lower.contains("sockettimeoutexception");
  }

  static List<String> getSearchIndexFields(String entityType) {
    if (TIME_SERIES_ENTITIES.contains(entityType)) {
      return List.of();
    }
    return List.of("*");
  }

  static int calculateNumberOfReaders(int totalEntityRecords, int batchSize) {
    if (batchSize <= 0) return 1;
    return (totalEntityRecords + batchSize - 1) / batchSize;
  }
}
