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
  private static final int FLUSH_OPERATION_THRESHOLD = 100;
  private static final long FLUSH_TIME_INTERVAL_MS = 5000; // 5 seconds

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

  public void recordProcess(StatsResult result) {
    process.record(result);
    checkFlush();
  }

  public void recordSink(StatsResult result) {
    sink.record(result);
    checkFlush();
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

  /** Flushes current statistics to the database using upsert. */
  public synchronized void flush() {
    if (statsDAO == null) {
      LOG.debug("Stats DAO is null, skipping flush for job {} on server {}", jobId, serverId);
      return;
    }

    try {
      statsDAO.upsert(
          recordId.toString(),
          jobId,
          serverId,
          reader.getSuccess().get(),
          reader.getFailed().get(),
          reader.getWarnings().get(),
          sink.getTotal(),
          sink.getSuccess().get(),
          sink.getFailed().get(),
          sink.getWarnings().get(),
          0L, // entityBuildFailures - tracked separately
          process.getSuccess().get(),
          process.getFailed().get(),
          process.getWarnings().get(),
          vector.getSuccess().get(),
          vector.getFailed().get(),
          vector.getWarnings().get(),
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
          reader.getSuccess().get(),
          reader.getFailed().get(),
          process.getSuccess().get(),
          process.getFailed().get(),
          sink.getSuccess().get(),
          sink.getFailed().get(),
          vector.getSuccess().get(),
          vector.getFailed().get());
    } catch (Exception e) {
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
