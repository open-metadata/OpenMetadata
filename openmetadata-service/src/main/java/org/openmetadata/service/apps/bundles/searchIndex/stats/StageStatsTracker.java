package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingMetrics;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Tracks statistics for each stage of the search indexing pipeline. Provides thread-safe counters
 * for reader, process, sink, and vector stages with automatic periodic flushing to the database.
 */
@Slf4j
public class StageStatsTracker {
  private static final int FLUSH_OPERATION_THRESHOLD = 500;
  private static final long FLUSH_TIME_INTERVAL_MS = 10000; // 10 seconds

  public enum Stage {
    READER,
    PROCESS,
    SINK,
    VECTOR
  }

  @Getter private final String jobId;
  @Getter private final String serverId;
  @Getter private final String entityType;
  @Getter private final UUID recordId;

  @Getter private final StageCounter reader = new StageCounter();
  @Getter private final StageCounter process = new StageCounter();
  @Getter private final StageCounter sink = new StageCounter();
  @Getter private final StageCounter vector = new StageCounter();

  private final CollectionDAO.SearchIndexServerStatsDAO statsDAO;
  private final AtomicLong operationCount = new AtomicLong(0);
  private volatile long lastFlushTime = System.currentTimeMillis();

  /** Tracks pending sink operations that have been submitted but not yet completed */
  private final AtomicLong pendingSinkOps = new AtomicLong(0);

  public StageStatsTracker(
      String jobId,
      String serverId,
      String entityType,
      CollectionDAO.SearchIndexServerStatsDAO statsDAO) {
    this.jobId = jobId;
    this.serverId = serverId;
    this.entityType = entityType;
    this.recordId = UUID.randomUUID();
    this.statsDAO = statsDAO;
  }

  public void record(Stage stage, StatsResult result) {
    switch (stage) {
      case READER -> recordReader(result);
      case PROCESS -> recordProcess(result);
      case SINK -> recordSink(result);
      case VECTOR -> recordVector(result);
    }
  }

  public void recordReader(StatsResult result) {
    reader.record(result);
    checkFlush();
  }

  public void recordReaderBatch(int successCount, int failedCount, int warningsCount) {
    recordReaderBatch(successCount, failedCount, warningsCount, 0L);
  }

  /**
   * Record a Reader batch with the wall-clock duration the batch took. Duration is the total time
   * spent in the underlying paginated DB read (listAfter + setFieldsInBulk), not including
   * downstream queue or processing time.
   */
  public void recordReaderBatch(
      int successCount, int failedCount, int warningsCount, long durationNanos) {
    reader.add(successCount, failedCount, warningsCount, durationNanos);
    checkFlush();
  }

  public void recordProcess(StatsResult result) {
    process.record(result);
    checkFlush();
  }

  /**
   * Record a Process batch (doc-build) with the wall-clock duration. Duration is the time taken
   * for the parallel doc-build join — pure CPU/serialization work, no I/O.
   */
  public void recordProcessBatch(int successCount, int failedCount, long durationNanos) {
    process.add(successCount, failedCount, 0, durationNanos);
    checkFlush();
  }

  public void recordSink(StatsResult result) {
    sink.record(result);
    pendingSinkOps.decrementAndGet();
    checkFlush();
  }

  public void recordSinkBatch(int successCount, int failedCount) {
    recordSinkBatch(successCount, failedCount, 0L);
  }

  /**
   * Record a Sink batch (OpenSearch / Elasticsearch bulk request) with the wall-clock round-trip
   * duration. Duration is measured strictly around the bulk HTTP call, so it isolates the search
   * cluster's write latency.
   */
  public void recordSinkBatch(int successCount, int failedCount, long durationNanos) {
    sink.add(successCount, failedCount, 0, durationNanos);
    checkFlush();
  }

  /**
   * Increment the pending sink operations counter. Call this when a document is submitted to the
   * async bulk sink, before the actual write completes.
   */
  public void incrementPendingSink() {
    pendingSinkOps.incrementAndGet();
  }

  /**
   * Increment pending sink operations by a batch count.
   *
   * @param count Number of documents being submitted
   */
  public void incrementPendingSink(int count) {
    pendingSinkOps.addAndGet(count);
  }

  /**
   * Wait for all pending sink operations to complete.
   *
   * @param timeoutMs Maximum time to wait in milliseconds
   * @return true if all operations completed, false if timed out
   */
  public boolean awaitSinkCompletion(long timeoutMs) {
    long deadline = System.currentTimeMillis() + timeoutMs;
    long sleepMs = 50;
    while (pendingSinkOps.get() > 0) {
      if (System.currentTimeMillis() >= deadline) {
        LOG.debug(
            "Await cycle expired with {} pending sink operations for job {} entity {}",
            pendingSinkOps.get(),
            jobId,
            entityType);
        return false;
      }
      try {
        Thread.sleep(sleepMs);
        // reduces CPU waste from thousands of wakeups across partition workers.
        sleepMs = Math.min(sleepMs * 2, 200);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return false;
      }
    }
    return true;
  }

  /** Get the count of pending sink operations. */
  public long getPendingSinkOps() {
    return pendingSinkOps.get();
  }

  /**
   * Reconcile any remaining pending sink operations by recording them as successful. This should
   * only be called after the bulk processor has been flushed — at that point, submitted records are
   * either written or would have been reported as failures through the error handler. Pending ops
   * that remain are callbacks that didn't fire in time, not actual write failures.
   */
  public void reconcilePendingSinkOps() {
    long remaining = pendingSinkOps.getAndSet(0);
    if (remaining > 0) {
      sink.add((int) remaining, 0, 0);
      LOG.info(
          "Reconciled {} pending sink operations as successful for job {} entity {}",
          remaining,
          jobId,
          entityType);
    }
  }

  public void recordVector(StatsResult result) {
    vector.record(result);
    checkFlush();
  }

  /**
   * Record a Vector batch (embedding API call) with the wall-clock duration. Duration isolates
   * the embedding service round-trip from local doc-build and bulk write.
   */
  public void recordVectorBatch(int successCount, int failedCount, long durationNanos) {
    vector.add(successCount, failedCount, 0, durationNanos);
    checkFlush();
  }

  /**
   * Add wall-clock duration to a stage without changing its success/failed/warning counters.
   * Used when a stage's count records arrive per-entity (via {@link #recordProcess} /
   * {@link #recordSink}) but the meaningful timing is the per-batch wall-clock the caller
   * measured around the parallel join or the bulk request. Avoids double-counting.
   */
  public void addStageTime(Stage stage, long durationNanos) {
    if (durationNanos <= 0) {
      return;
    }
    switch (stage) {
      case READER -> reader.getTotalTimeNanos().addAndGet(durationNanos);
      case PROCESS -> process.getTotalTimeNanos().addAndGet(durationNanos);
      case SINK -> sink.getTotalTimeNanos().addAndGet(durationNanos);
      case VECTOR -> vector.getTotalTimeNanos().addAndGet(durationNanos);
    }
  }

  /** Increments operation count and flushes if threshold or time interval is reached. */
  private void checkFlush() {
    long currentOps = operationCount.incrementAndGet();
    long currentTime = System.currentTimeMillis();

    if (currentOps >= FLUSH_OPERATION_THRESHOLD
        || (currentTime - lastFlushTime) >= FLUSH_TIME_INTERVAL_MS) {
      flush();
    }
  }

  /** Flushes current statistics to the database using increment (delta approach). */
  public synchronized void flush() {
    if (statsDAO == null) {
      LOG.debug("Stats DAO is null, skipping flush for job {} on server {}", jobId, serverId);
      return;
    }

    // Get and reset counters atomically for delta-based update
    long rSuccess = reader.getSuccess().getAndSet(0);
    long rFailed = reader.getFailed().getAndSet(0);
    long rWarnings = reader.getWarnings().getAndSet(0);
    long rTimeNanos = reader.getTotalTimeNanos().getAndSet(0);
    long pSuccess = process.getSuccess().getAndSet(0);
    long pFailed = process.getFailed().getAndSet(0);
    long pWarnings = process.getWarnings().getAndSet(0);
    long pTimeNanos = process.getTotalTimeNanos().getAndSet(0);
    long sSuccess = sink.getSuccess().getAndSet(0);
    long sFailed = sink.getFailed().getAndSet(0);
    long sTimeNanos = sink.getTotalTimeNanos().getAndSet(0);
    long vSuccess = vector.getSuccess().getAndSet(0);
    long vFailed = vector.getFailed().getAndSet(0);
    long vTimeNanos = vector.getTotalTimeNanos().getAndSet(0);

    long rTimeMs = rTimeNanos / 1_000_000L;
    long pTimeMs = pTimeNanos / 1_000_000L;
    long sTimeMs = sTimeNanos / 1_000_000L;
    long vTimeMs = vTimeNanos / 1_000_000L;

    // Skip if nothing to flush
    if (rSuccess == 0
        && rFailed == 0
        && rWarnings == 0
        && pSuccess == 0
        && pFailed == 0
        && pWarnings == 0
        && sSuccess == 0
        && sFailed == 0
        && vSuccess == 0
        && vFailed == 0
        && rTimeMs == 0
        && pTimeMs == 0
        && sTimeMs == 0
        && vTimeMs == 0) {
      operationCount.set(0);
      lastFlushTime = System.currentTimeMillis();
      return;
    }

    ReindexingMetrics metrics = ReindexingMetrics.getInstance();
    if (metrics != null) {
      if (rSuccess > 0) metrics.recordStageSuccess("reader", entityType, rSuccess);
      if (rFailed > 0) metrics.recordStageFailed("reader", entityType, rFailed);
      if (rWarnings > 0) metrics.recordStageWarnings("reader", entityType, rWarnings);
      if (pSuccess > 0) metrics.recordStageSuccess("process", entityType, pSuccess);
      if (pFailed > 0) metrics.recordStageFailed("process", entityType, pFailed);
      if (pWarnings > 0) metrics.recordStageWarnings("process", entityType, pWarnings);
      if (sSuccess > 0) metrics.recordStageSuccess("sink", entityType, sSuccess);
      if (sFailed > 0) metrics.recordStageFailed("sink", entityType, sFailed);
      if (vSuccess > 0) metrics.recordStageSuccess("vector", entityType, vSuccess);
      if (vFailed > 0) metrics.recordStageFailed("vector", entityType, vFailed);
    }

    try {
      statsDAO.incrementStats(
          recordId.toString(),
          jobId,
          serverId,
          entityType,
          rSuccess,
          rFailed,
          rWarnings + pWarnings,
          sSuccess,
          sFailed,
          pSuccess,
          pFailed,
          vSuccess,
          vFailed,
          rTimeMs,
          pTimeMs,
          sTimeMs,
          vTimeMs,
          0, // partitionsCompleted - tracked separately
          0, // partitionsFailed - tracked separately
          System.currentTimeMillis());

      operationCount.set(0);
      lastFlushTime = System.currentTimeMillis();

      LOG.debug(
          "Flushed stats for job {} entity {} on server {}: reader={}/{} ({}ms), process={}/{} ({}ms), sink={}/{} ({}ms), vector={}/{} ({}ms)",
          jobId,
          entityType,
          serverId,
          rSuccess,
          rFailed,
          rTimeMs,
          pSuccess,
          pFailed,
          pTimeMs,
          sSuccess,
          sFailed,
          sTimeMs,
          vSuccess,
          vFailed,
          vTimeMs);
    } catch (Exception e) {
      // On failure, add the values back so they're not lost
      reader.getSuccess().addAndGet(rSuccess);
      reader.getFailed().addAndGet(rFailed);
      reader.getWarnings().addAndGet(rWarnings);
      reader.getTotalTimeNanos().addAndGet(rTimeNanos);
      process.getSuccess().addAndGet(pSuccess);
      process.getFailed().addAndGet(pFailed);
      process.getWarnings().addAndGet(pWarnings);
      process.getTotalTimeNanos().addAndGet(pTimeNanos);
      sink.getSuccess().addAndGet(sSuccess);
      sink.getFailed().addAndGet(sFailed);
      sink.getTotalTimeNanos().addAndGet(sTimeNanos);
      vector.getSuccess().addAndGet(vSuccess);
      vector.getFailed().addAndGet(vFailed);
      vector.getTotalTimeNanos().addAndGet(vTimeNanos);
      LOG.error(
          "Failed to flush stats for job {} on server {}: {}", jobId, serverId, e.getMessage(), e);
    }
  }

  /** Resets all counters to zero. Typically called when starting a new indexing run. */
  public void reset() {
    reader.reset();
    process.reset();
    sink.reset();
    vector.reset();
    operationCount.set(0);
    lastFlushTime = System.currentTimeMillis();
  }
}
