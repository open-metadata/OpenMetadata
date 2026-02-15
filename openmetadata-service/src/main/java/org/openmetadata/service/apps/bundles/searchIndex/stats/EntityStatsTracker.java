package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Simple stats tracker for a single entity type. Tracks reader, process, sink, and vector stages
 * with atomic counters that flush deltas to the database.
 *
 * <p>Usage:
 * <pre>
 * EntityStatsTracker tracker = new EntityStatsTracker(jobId, serverId, "table", dao);
 * tracker.recordReader(StatsResult.SUCCESS);
 * tracker.recordProcess(StatsResult.SUCCESS);
 * tracker.recordSink(StatsResult.SUCCESS);
 * tracker.flush(); // Sends deltas to DB
 * </pre>
 */
@Slf4j
public class EntityStatsTracker {
  private static final int FLUSH_THRESHOLD = 500;
  private static final long FLUSH_INTERVAL_MS = 10000;

  @Getter private final String jobId;
  @Getter private final String serverId;
  @Getter private final String entityType;
  private final String recordId;
  private final CollectionDAO.SearchIndexServerStatsDAO statsDAO;

  // Reader stage counters
  private final AtomicLong readerSuccess = new AtomicLong();
  private final AtomicLong readerFailed = new AtomicLong();
  private final AtomicLong readerWarnings = new AtomicLong();

  // Process stage counters (entity -> search doc conversion)
  private final AtomicLong processSuccess = new AtomicLong();
  private final AtomicLong processFailed = new AtomicLong();

  // Sink stage counters (ES/OS bulk response)
  private final AtomicLong sinkSuccess = new AtomicLong();
  private final AtomicLong sinkFailed = new AtomicLong();

  // Vector stage counters
  private final AtomicLong vectorSuccess = new AtomicLong();
  private final AtomicLong vectorFailed = new AtomicLong();

  // Partition counters (for distributed mode)
  private final AtomicLong partitionsCompleted = new AtomicLong();
  private final AtomicLong partitionsFailed = new AtomicLong();

  // Flush control
  private final AtomicLong operationCount = new AtomicLong();
  private volatile long lastFlushTime = System.currentTimeMillis();

  public EntityStatsTracker(
      String jobId,
      String serverId,
      String entityType,
      CollectionDAO.SearchIndexServerStatsDAO statsDAO) {
    this.jobId = jobId;
    this.serverId = serverId;
    this.entityType = entityType;
    this.recordId = UUID.randomUUID().toString();
    this.statsDAO = statsDAO;
  }

  // Reader stage
  public void recordReader(StatsResult result) {
    switch (result) {
      case SUCCESS -> readerSuccess.incrementAndGet();
      case FAILED -> readerFailed.incrementAndGet();
      case WARNING -> readerWarnings.incrementAndGet();
    }
    maybeFlush();
  }

  public void recordReaderBatch(int success, int failed, int warnings) {
    readerSuccess.addAndGet(success);
    readerFailed.addAndGet(failed);
    readerWarnings.addAndGet(warnings);
    maybeFlush();
  }

  // Process stage
  public void recordProcess(StatsResult result) {
    switch (result) {
      case SUCCESS -> processSuccess.incrementAndGet();
      case FAILED -> processFailed.incrementAndGet();
      case WARNING -> {} // No warnings for process stage
    }
    maybeFlush();
  }

  // Sink stage
  public void recordSink(StatsResult result) {
    switch (result) {
      case SUCCESS -> sinkSuccess.incrementAndGet();
      case FAILED -> sinkFailed.incrementAndGet();
      case WARNING -> {} // No warnings for sink stage
    }
    maybeFlush();
  }

  public void recordSinkBatch(int success, int failed) {
    sinkSuccess.addAndGet(success);
    sinkFailed.addAndGet(failed);
    maybeFlush();
  }

  // Vector stage
  public void recordVector(StatsResult result) {
    switch (result) {
      case SUCCESS -> vectorSuccess.incrementAndGet();
      case FAILED -> vectorFailed.incrementAndGet();
      case WARNING -> {} // No warnings for vector stage
    }
    maybeFlush();
  }

  // Partition tracking (for distributed mode)
  public void recordPartitionCompleted() {
    partitionsCompleted.incrementAndGet();
    maybeFlush();
  }

  public void recordPartitionFailed() {
    partitionsFailed.incrementAndGet();
    maybeFlush();
  }

  private void maybeFlush() {
    long ops = operationCount.incrementAndGet();
    long now = System.currentTimeMillis();
    if (ops >= FLUSH_THRESHOLD || (now - lastFlushTime) >= FLUSH_INTERVAL_MS) {
      flush();
    }
  }

  /** Flush current deltas to database and reset counters. */
  public synchronized void flush() {
    if (statsDAO == null) {
      LOG.debug("Stats DAO is null, skipping flush for {} {}", jobId, entityType);
      return;
    }

    // Get and reset all counters atomically
    long rSuccess = readerSuccess.getAndSet(0);
    long rFailed = readerFailed.getAndSet(0);
    long rWarnings = readerWarnings.getAndSet(0);
    long pSuccess = processSuccess.getAndSet(0);
    long pFailed = processFailed.getAndSet(0);
    long sSuccess = sinkSuccess.getAndSet(0);
    long sFailed = sinkFailed.getAndSet(0);
    long vSuccess = vectorSuccess.getAndSet(0);
    long vFailed = vectorFailed.getAndSet(0);
    long partCompleted = partitionsCompleted.getAndSet(0);
    long partFailed = partitionsFailed.getAndSet(0);

    // Skip if nothing to flush
    if (rSuccess == 0
        && rFailed == 0
        && rWarnings == 0
        && pSuccess == 0
        && pFailed == 0
        && sSuccess == 0
        && sFailed == 0
        && vSuccess == 0
        && vFailed == 0
        && partCompleted == 0
        && partFailed == 0) {
      operationCount.set(0);
      lastFlushTime = System.currentTimeMillis();
      return;
    }

    try {
      statsDAO.incrementStats(
          recordId,
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
          (int) partCompleted,
          (int) partFailed,
          System.currentTimeMillis());

      operationCount.set(0);
      lastFlushTime = System.currentTimeMillis();

      LOG.debug(
          "Flushed stats for {} {}: reader={}/{}/{}, process={}/{}, sink={}/{}, vector={}/{}",
          jobId,
          entityType,
          rSuccess,
          rFailed,
          rWarnings,
          pSuccess,
          pFailed,
          sSuccess,
          sFailed,
          vSuccess,
          vFailed);
    } catch (Exception e) {
      // On failure, add the values back so they're not lost
      readerSuccess.addAndGet(rSuccess);
      readerFailed.addAndGet(rFailed);
      readerWarnings.addAndGet(rWarnings);
      processSuccess.addAndGet(pSuccess);
      processFailed.addAndGet(pFailed);
      sinkSuccess.addAndGet(sSuccess);
      sinkFailed.addAndGet(sFailed);
      vectorSuccess.addAndGet(vSuccess);
      vectorFailed.addAndGet(vFailed);
      partitionsCompleted.addAndGet(partCompleted);
      partitionsFailed.addAndGet(partFailed);
      LOG.error("Failed to flush stats for {} {}: {}", jobId, entityType, e.getMessage());
    }
  }

  /** Get current unflushed counts (for testing/debugging). */
  public long getUnflushedReaderSuccess() {
    return readerSuccess.get();
  }

  public long getUnflushedSinkSuccess() {
    return sinkSuccess.get();
  }

  public long getUnflushedSinkFailed() {
    return sinkFailed.get();
  }
}
