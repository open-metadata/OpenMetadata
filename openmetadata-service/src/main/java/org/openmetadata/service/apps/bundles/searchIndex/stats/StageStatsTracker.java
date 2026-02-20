package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
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
    reader.add(successCount, failedCount, warningsCount);
    checkFlush();
  }

  public void recordProcess(StatsResult result) {
    process.record(result);
    checkFlush();
  }

  public void recordSink(StatsResult result) {
    sink.record(result);
    pendingSinkOps.decrementAndGet();
    checkFlush();
  }

  public void recordSinkBatch(int successCount, int failedCount) {
    sink.add(successCount, failedCount, 0);
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
    while (pendingSinkOps.get() > 0) {
      if (System.currentTimeMillis() >= deadline) {
        LOG.warn(
            "Timed out waiting for {} pending sink operations for job {} entity {}",
            pendingSinkOps.get(),
            jobId,
            entityType);
        return false;
      }
      try {
        Thread.sleep(10);
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

  public void recordVector(StatsResult result) {
    vector.record(result);
    checkFlush();
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
    long pSuccess = process.getSuccess().getAndSet(0);
    long pFailed = process.getFailed().getAndSet(0);
    long sSuccess = sink.getSuccess().getAndSet(0);
    long sFailed = sink.getFailed().getAndSet(0);
    long vSuccess = vector.getSuccess().getAndSet(0);
    long vFailed = vector.getFailed().getAndSet(0);

    // Skip if nothing to flush
    if (rSuccess == 0
        && rFailed == 0
        && rWarnings == 0
        && pSuccess == 0
        && pFailed == 0
        && sSuccess == 0
        && sFailed == 0
        && vSuccess == 0
        && vFailed == 0) {
      operationCount.set(0);
      lastFlushTime = System.currentTimeMillis();
      return;
    }

    try {
      statsDAO.incrementStats(
          recordId.toString(),
          jobId,
          serverId,
          entityType,
          rSuccess,
          rFailed,
          rWarnings,
          sSuccess,
          sFailed,
          pSuccess,
          pFailed,
          vSuccess,
          vFailed,
          0, // partitionsCompleted - tracked separately
          0, // partitionsFailed - tracked separately
          System.currentTimeMillis());

      operationCount.set(0);
      lastFlushTime = System.currentTimeMillis();

      LOG.debug(
          "Flushed stats for job {} entity {} on server {}: reader={}/{}, process={}/{}, sink={}/{}, vector={}/{}",
          jobId,
          entityType,
          serverId,
          rSuccess,
          rFailed,
          pSuccess,
          pFailed,
          sSuccess,
          sFailed,
          vSuccess,
          vFailed);
    } catch (Exception e) {
      // On failure, add the values back so they're not lost
      reader.getSuccess().addAndGet(rSuccess);
      reader.getFailed().addAndGet(rFailed);
      reader.getWarnings().addAndGet(rWarnings);
      process.getSuccess().addAndGet(pSuccess);
      process.getFailed().addAndGet(pFailed);
      sink.getSuccess().addAndGet(sSuccess);
      sink.getFailed().addAndGet(sFailed);
      vector.getSuccess().addAndGet(vSuccess);
      vector.getFailed().addAndGet(vFailed);
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
