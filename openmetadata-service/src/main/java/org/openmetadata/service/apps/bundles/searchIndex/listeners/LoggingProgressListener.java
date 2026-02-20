package org.openmetadata.service.apps.bundles.searchIndex.listeners;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobLogger;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;

/**
 * Progress listener that provides structured logging output using ReindexingJobLogger. This
 * listener formats progress updates, entity completions, and job summaries in a readable format.
 */
@Slf4j
public class LoggingProgressListener implements ReindexingProgressListener {

  private ReindexingJobLogger logger;
  private boolean isSmartReindexing;

  public LoggingProgressListener() {
    // Logger will be initialized when job is configured
  }

  @Override
  public void onJobStarted(ReindexingJobContext context) {
    LOG.info(
        "Reindexing job started - Job ID: {}, Source: {}, Distributed: {}",
        context.getJobId(),
        context.getSource(),
        context.isDistributed());
  }

  @Override
  public void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {
    this.isSmartReindexing = config.isSmartReindexing();
    this.logger = createLogger(config);

    logger.addInitDetail("Batch Size", config.batchSize());
    logger.addInitDetail("Consumer Threads", config.consumerThreads());
    logger.addInitDetail("Producer Threads", config.producerThreads());
    logger.addInitDetail("Queue Size", config.queueSize());
    logger.addInitDetail("Max Concurrent Requests", config.maxConcurrentRequests());
    logger.addInitDetail("Payload Size", formatBytes(config.payloadSize()));
    logger.addInitDetail("Auto-tune", config.autoTune() ? "Enabled" : "Disabled");
    logger.addInitDetail("Recreate Index", config.recreateIndex() ? "Yes" : "No");
    logger.addInitDetail("Distributed Mode", config.useDistributedIndexing() ? "Yes" : "No");

    logger.logInitialization();
  }

  @Override
  public void onIndexRecreationStarted(Set<String> entities) {
    LOG.info("Starting index recreation for {} entity types", entities.size());
    if (LOG.isDebugEnabled()) {
      LOG.debug("Entities to recreate: {}", String.join(", ", entities));
    }
  }

  @Override
  public void onEntityTypeStarted(String entityType, long totalRecords) {
    if (logger != null) {
      logger.markEntityStarted(entityType);
    } else {
      LOG.info("Started processing entity: {} ({} records)", entityType, totalRecords);
    }
  }

  @Override
  public void onProgressUpdate(Stats stats, ReindexingJobContext context) {
    if (logger != null) {
      logger.logProgress(stats);
    }
  }

  @Override
  public void onEntityTypeCompleted(String entityType, StepStats entityStats) {
    if (logger != null) {
      logger.markEntityCompleted(entityType);
    } else {
      long success = entityStats.getSuccessRecords() != null ? entityStats.getSuccessRecords() : 0;
      long failed = entityStats.getFailedRecords() != null ? entityStats.getFailedRecords() : 0;
      LOG.info("Completed entity: {} - Success: {}, Failed: {}", entityType, success, failed);
    }
  }

  @Override
  public void onError(String entityType, IndexingError error, Stats currentStats) {
    if (logger != null) {
      logger.logWarning(
          "Error during indexing of {}: {} - Source: {}",
          entityType,
          error.getMessage(),
          error.getErrorSource());
    } else {
      LOG.warn(
          "Indexing error for {}: {} - Source: {}",
          entityType,
          error.getMessage(),
          error.getErrorSource());
    }
  }

  @Override
  public void onJobCompleted(Stats finalStats, long elapsedMillis) {
    if (logger != null) {
      logger.logCompletion(finalStats);
    } else {
      logCompletionSummary(finalStats, elapsedMillis, false);
    }
  }

  @Override
  public void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {
    if (logger != null) {
      logger.logCompletion(finalStats);
    }
    logCompletionSummary(finalStats, elapsedMillis, true);
  }

  @Override
  public void onJobFailed(Stats currentStats, Exception error) {
    if (logger != null) {
      logger.logError("reindexing execution", error);
    } else {
      LOG.error("Reindexing job failed: {}", error.getMessage(), error);
    }

    if (currentStats != null && currentStats.getJobStats() != null) {
      LOG.error(
          "Failure state - Processed: {}, Success: {}, Failed: {}",
          currentStats.getJobStats().getTotalRecords(),
          currentStats.getJobStats().getSuccessRecords(),
          currentStats.getJobStats().getFailedRecords());
    }
  }

  @Override
  public void onJobStopped(Stats currentStats) {
    LOG.info("Reindexing job stopped by user request");
    if (currentStats != null && currentStats.getJobStats() != null) {
      LOG.info(
          "Progress at stop - Total: {}, Success: {}, Failed: {}",
          currentStats.getJobStats().getTotalRecords(),
          currentStats.getJobStats().getSuccessRecords(),
          currentStats.getJobStats().getFailedRecords());
    }
  }

  @Override
  public int getPriority() {
    return 30;
  }

  private ReindexingJobLogger createLogger(ReindexingConfiguration config) {
    return new ReindexingJobLoggerAdapter(config.entities(), config.isSmartReindexing());
  }

  private void logCompletionSummary(Stats finalStats, long elapsedMillis, boolean hasErrors) {
    long seconds = elapsedMillis / 1000;

    if (finalStats != null && finalStats.getJobStats() != null) {
      long total =
          finalStats.getJobStats().getTotalRecords() != null
              ? finalStats.getJobStats().getTotalRecords()
              : 0;
      long success =
          finalStats.getJobStats().getSuccessRecords() != null
              ? finalStats.getJobStats().getSuccessRecords()
              : 0;
      long failed =
          finalStats.getJobStats().getFailedRecords() != null
              ? finalStats.getJobStats().getFailedRecords()
              : 0;

      double rate = seconds > 0 ? (double) success / seconds : 0;

      if (hasErrors) {
        LOG.warn(
            "Reindexing completed WITH ERRORS in {}s - Total: {}, Success: {}, Failed: {}, Rate: {:.1f}/s",
            seconds,
            total,
            success,
            failed,
            rate);
      } else {
        LOG.info(
            "Reindexing completed successfully in {}s - Total: {}, Success: {}, Rate: {:.1f}/s",
            seconds,
            total,
            success,
            rate);
      }
    } else {
      LOG.info("Reindexing completed in {}s", seconds);
    }
  }

  private String formatBytes(long bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    } else if (bytes < 1024 * 1024) {
      return String.format("%.1f KB", bytes / 1024.0);
    } else {
      return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }
  }

  /**
   * Internal adapter to create ReindexingJobLogger without EventPublisherJob dependency. This
   * allows the logging listener to work independently of Quartz infrastructure.
   */
  private static class ReindexingJobLoggerAdapter extends ReindexingJobLogger {

    ReindexingJobLoggerAdapter(Set<String> entities, boolean isSmartReindexing) {
      super(createMinimalJobData(entities), isSmartReindexing);
    }

    private static org.openmetadata.schema.system.EventPublisherJob createMinimalJobData(
        Set<String> entities) {
      return new org.openmetadata.schema.system.EventPublisherJob().withEntities(entities);
    }
  }
}
