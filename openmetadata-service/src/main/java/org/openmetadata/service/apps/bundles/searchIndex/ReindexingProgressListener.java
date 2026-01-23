package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Set;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

/**
 * Listener interface for reindexing progress callbacks. Implementations can handle progress updates
 * for different purposes:
 *
 * <ul>
 *   <li>QuartzProgressListener: Updates Quartz JobExecutionContext and WebSocket
 *   <li>SlackProgressListener: Sends Slack notifications
 *   <li>LoggingProgressListener: Structured logging
 *   <li>WebSocketProgressListener: Direct WebSocket for non-Quartz scenarios
 * </ul>
 */
public interface ReindexingProgressListener {

  /** Called when reindexing job starts initialization */
  default void onJobStarted(ReindexingJobContext context) {}

  /** Called when job configuration is determined (after auto-tune) */
  default void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {}

  /** Called when index recreation begins (if recreateIndex=true) */
  default void onIndexRecreationStarted(Set<String> entities) {}

  /** Called when a specific entity type processing begins */
  default void onEntityTypeStarted(String entityType, long totalRecords) {}

  /** Called periodically with progress updates */
  default void onProgressUpdate(Stats stats, ReindexingJobContext context) {}

  /** Called when a specific entity type processing completes */
  default void onEntityTypeCompleted(String entityType, StepStats entityStats) {}

  /** Called when an error occurs during processing */
  default void onError(String entityType, IndexingError error, Stats currentStats) {}

  /** Called when job completes successfully */
  default void onJobCompleted(Stats finalStats, long elapsedMillis) {}

  /** Called when job completes with errors */
  default void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {}

  /** Called when job fails */
  default void onJobFailed(Stats currentStats, Exception error) {}

  /** Called when job is stopped by user */
  default void onJobStopped(Stats currentStats) {}

  /** Priority for ordering (lower = called first) */
  default int getPriority() {
    return 100;
  }
}
