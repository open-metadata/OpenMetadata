package org.openmetadata.service.apps.bundles.searchIndex;

import java.text.DecimalFormat;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;

/**
 * Structured logger for reindexing jobs that groups related log messages
 * and provides cleaner console output.
 */
@Slf4j
public class ReindexingJobLogger {

  private final boolean isSmartReindexing;
  private final Set<String> entities;
  private final Instant startTime;
  private final Map<String, String> initializationDetails;
  private final Map<String, AtomicLong> threadStats;
  private volatile boolean hasLoggedInitialization = false;

  // Progress tracking
  private long lastProgressLog = 0;
  private static final long PROGRESS_LOG_INTERVAL_MS =
      10000; // 10 seconds for more frequent updates
  private final AtomicLong totalProcessed = new AtomicLong(0);
  private final AtomicLong totalRecords = new AtomicLong(0);
  private final AtomicLong lastProcessedCount = new AtomicLong(0);
  private final Map<String, EntityProgress> entityProgressMap = new ConcurrentHashMap<>();

  private static class EntityProgress {
    final AtomicLong processed = new AtomicLong(0);
    final AtomicLong total = new AtomicLong(0);
    final AtomicLong failed = new AtomicLong(0);
    final Instant startTime = Instant.now();
    volatile Instant lastUpdate = Instant.now();
    volatile String status = "Pending";
  }

  public ReindexingJobLogger(EventPublisherJob jobData, boolean isSmartReindexing) {
    this.isSmartReindexing = isSmartReindexing;
    this.entities = jobData.getEntities();
    this.startTime = Instant.now();
    this.initializationDetails = new HashMap<>();
    this.threadStats = new ConcurrentHashMap<>();
  }

  /**
   * Add initialization detail to be logged later as a group
   */
  public void addInitDetail(String key, Object value) {
    initializationDetails.put(key, String.valueOf(value));
  }

  /**
   * Log all initialization details as a single structured message
   */
  public void logInitialization() {
    if (hasLoggedInitialization) return;
    hasLoggedInitialization = true;

    if (isSmartReindexing) {
      // For smart reindexing, the progress monitor handles the output
      LOG.debug("Initialization complete for entities: {}", entities);
      return;
    }

    LOG.info("");
    LOG.info("=== Reindexing Job Configuration ===");
    LOG.info("Entities: {}", String.join(", ", entities));

    if (!initializationDetails.isEmpty()) {
      LOG.info("Settings:");
      initializationDetails.forEach((key, value) -> LOG.info("  • {}: {}", key, value));
    }

    LOG.info("=====================================");
    LOG.info("");
  }

  /**
   * Log consumer thread lifecycle events in a structured way
   */
  public void logConsumerLifecycle(int consumerId, boolean isStarting) {
    String key = isStarting ? "started" : "finished";
    threadStats.computeIfAbsent(key, k -> new AtomicLong(0)).incrementAndGet();

    // Only log in debug mode or if not smart reindexing
    if (!isSmartReindexing) {
      LOG.debug("Consumer {} {}", consumerId, key);
    }
  }

  /**
   * Update entity-specific progress
   */
  public void updateEntityProgress(String entityType, long processed, long total, long failed) {
    EntityProgress progress =
        entityProgressMap.computeIfAbsent(entityType, k -> new EntityProgress());
    progress.processed.set(processed);
    progress.total.set(total);
    progress.failed.set(failed);
    progress.lastUpdate = Instant.now();
    progress.status = "Processing";
  }

  /**
   * Mark an entity as started
   */
  public void markEntityStarted(String entityType) {
    EntityProgress progress =
        entityProgressMap.computeIfAbsent(entityType, k -> new EntityProgress());
    progress.status = "Processing";
    LOG.info("Started processing entity: {}", entityType);
  }

  /**
   * Mark an entity as completed
   */
  public void markEntityCompleted(String entityType) {
    EntityProgress progress = entityProgressMap.get(entityType);
    if (progress != null) {
      progress.status = "Completed";
      Duration entityDuration = Duration.between(progress.startTime, Instant.now());
      LOG.info(
          "Completed entity: {} ({} records in {})",
          entityType,
          formatNumber(progress.processed.get()),
          formatDuration(entityDuration));
    }
  }

  /**
   * Log progress in a structured way with real-time updates
   */
  public void logProgress(Stats stats) {
    if (stats == null || stats.getJobStats() == null) return;

    long currentTime = System.currentTimeMillis();
    if (currentTime - lastProgressLog < PROGRESS_LOG_INTERVAL_MS) {
      return;
    }

    long processed =
        stats.getJobStats().getSuccessRecords() != null
            ? stats.getJobStats().getSuccessRecords()
            : 0;
    long total =
        stats.getJobStats().getTotalRecords() != null ? stats.getJobStats().getTotalRecords() : 0;

    totalProcessed.set(processed);
    totalRecords.set(total);

    // Update entity-level stats from the overall stats
    if (stats.getEntityStats() != null
        && stats.getEntityStats().getAdditionalProperties() != null) {
      stats
          .getEntityStats()
          .getAdditionalProperties()
          .forEach(
              (entity, entityStatsObj) -> {
                if (entityStatsObj instanceof org.openmetadata.schema.system.StepStats) {
                  org.openmetadata.schema.system.StepStats entityStats =
                      (org.openmetadata.schema.system.StepStats) entityStatsObj;
                  updateEntityProgress(
                      entity,
                      entityStats.getSuccessRecords() != null ? entityStats.getSuccessRecords() : 0,
                      entityStats.getTotalRecords() != null ? entityStats.getTotalRecords() : 0,
                      entityStats.getFailedRecords() != null ? entityStats.getFailedRecords() : 0);
                }
              });
    }

    if (!isSmartReindexing) {
      logDetailedProgress(processed, total);
    }

    lastProgressLog = currentTime;
    lastProcessedCount.set(processed);
  }

  private void logDetailedProgress(long processed, long total) {
    Duration elapsed = Duration.between(startTime, Instant.now());
    double percentage = total > 0 ? (processed * 100.0 / total) : 0;

    LOG.info("");
    LOG.info("=== Reindexing Progress Update ===");
    LOG.info(
        "Overall: {}/{} ({}) - Elapsed: {}",
        formatNumber(processed),
        formatNumber(total),
        formatPercentage(percentage),
        formatDuration(elapsed));

    // Calculate throughput and ETA
    if (elapsed.getSeconds() > 0 && processed > 0) {
      double throughput = processed / (double) elapsed.getSeconds();
      LOG.info("Throughput: {} records/sec", formatNumber((long) throughput));

      // Calculate ETA
      if (total > processed) {
        long remaining = total - processed;
        long etaSeconds = (long) (remaining / throughput);
        LOG.info("Estimated time remaining: {}", formatDuration(Duration.ofSeconds(etaSeconds)));
      }
    }

    // Show per-entity progress
    if (!entityProgressMap.isEmpty()) {
      LOG.info("");
      LOG.info("Entity progress:");
      entityProgressMap.forEach(
          (entity, progress) -> {
            long entityProcessed = progress.processed.get();
            long entityTotal = progress.total.get();
            long entityFailed = progress.failed.get();

            if (entityTotal > 0) {
              double entityPercentage = (entityProcessed * 100.0) / entityTotal;
              String failedInfo =
                  entityFailed > 0 ? String.format(" (%d failed)", entityFailed) : "";
              LOG.info(
                  "  • {}: {}/{} ({}) - {}{}",
                  entity,
                  formatNumber(entityProcessed),
                  formatNumber(entityTotal),
                  formatPercentage(entityPercentage),
                  progress.status,
                  failedInfo);
            }
          });
    }

    LOG.info("==================================");
  }

  /**
   * Log job completion with summary
   */
  public void logCompletion(Stats finalStats) {
    if (isSmartReindexing) {
      // Smart reindexing uses its own progress monitor for completion
      return;
    }

    Duration elapsed = Duration.between(startTime, Instant.now());
    LOG.info("");
    LOG.info("=== Reindexing Job Completed ===");
    LOG.info("Total time: {}", formatDuration(elapsed));

    if (finalStats != null && finalStats.getJobStats() != null) {
      long success =
          finalStats.getJobStats().getSuccessRecords() != null
              ? finalStats.getJobStats().getSuccessRecords()
              : 0;
      long failed =
          finalStats.getJobStats().getFailedRecords() != null
              ? finalStats.getJobStats().getFailedRecords()
              : 0;
      long total =
          finalStats.getJobStats().getTotalRecords() != null
              ? finalStats.getJobStats().getTotalRecords()
              : 0;

      LOG.info("Records processed: {}", formatNumber(total));
      LOG.info("Successful: {}", formatNumber(success));
      if (failed > 0) {
        LOG.info("Failed: {}", formatNumber(failed));
      }

      // Show detailed per-entity stats
      if (!entityProgressMap.isEmpty()) {
        LOG.info("");
        LOG.info("Per-entity breakdown:");
        entityProgressMap.forEach(
            (entity, progress) -> {
              long entityProcessed = progress.processed.get();
              long entityFailed = progress.failed.get();
              Duration entityDuration = Duration.between(progress.startTime, progress.lastUpdate);

              if (entityProcessed > 0 || entityFailed > 0) {
                String status =
                    entityFailed > 0
                        ? String.format(
                            "%s records (%d failed)", formatNumber(entityProcessed), entityFailed)
                        : formatNumber(entityProcessed) + " records";
                LOG.info(
                    "  • {}: {} - Duration: {}", entity, status, formatDuration(entityDuration));
              }
            });
      }
    }

    LOG.info("=================================");
    LOG.info("");
  }

  /**
   * Log errors in a structured way
   */
  public void logError(String context, Throwable error) {
    LOG.error("Error during {}: {}", context, error.getMessage(), error);
  }

  /**
   * Log warnings in a structured way
   */
  public void logWarning(String message, Object... args) {
    LOG.warn(message, args);
  }

  private String formatNumber(long number) {
    return String.format("%,d", number);
  }

  private String formatPercentage(double percentage) {
    return new DecimalFormat("#0.0").format(percentage) + "%";
  }

  private String formatDuration(Duration duration) {
    long seconds = duration.getSeconds();
    if (seconds < 60) {
      return seconds + "s";
    } else if (seconds < 3600) {
      return String.format("%dm %ds", seconds / 60, seconds % 60);
    } else {
      return String.format("%dh %dm", seconds / 3600, (seconds % 3600) / 60);
    }
  }
}
