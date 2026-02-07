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

import static org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.socket.WebSocketManager;

/**
 * Aggregates distributed job statistics and broadcasts updates via WebSocket.
 *
 * <p>This component periodically polls the database for job statistics and broadcasts updates to
 * connected WebSocket clients, providing a centralized view of distributed indexing progress.
 */
@Slf4j
public class DistributedJobStatsAggregator {

  /** Default polling interval in milliseconds */
  public static final long DEFAULT_POLL_INTERVAL_MS = 1000;

  /** Minimum polling interval to avoid excessive DB load */
  private static final long MIN_POLL_INTERVAL_MS = 500;

  private final DistributedSearchIndexCoordinator coordinator;
  private final UUID jobId;
  private final UUID appId;
  private final Long appStartTime;
  private final long pollIntervalMs;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private ScheduledExecutorService scheduler;

  private ReindexingProgressListener progressListener;
  private ReindexingJobContext jobContext;
  private final AtomicReference<IndexJobStatus> lastNotifiedStatus = new AtomicReference<>();

  public DistributedJobStatsAggregator(DistributedSearchIndexCoordinator coordinator, UUID jobId) {
    this(coordinator, jobId, null, null, DEFAULT_POLL_INTERVAL_MS);
  }

  /** Constructor with custom poll interval (for testing) */
  public DistributedJobStatsAggregator(
      DistributedSearchIndexCoordinator coordinator, UUID jobId, long pollIntervalMs) {
    this(coordinator, jobId, null, null, pollIntervalMs);
  }

  public DistributedJobStatsAggregator(
      DistributedSearchIndexCoordinator coordinator,
      UUID jobId,
      UUID appId,
      Long appStartTime,
      long pollIntervalMs) {
    this.coordinator = coordinator;
    this.jobId = jobId;
    this.appId = appId;
    this.appStartTime = appStartTime;
    this.pollIntervalMs = Math.max(pollIntervalMs, MIN_POLL_INTERVAL_MS);
  }

  /**
   * Set a progress listener to receive callbacks during job execution.
   *
   * @param listener The progress listener
   * @param context The job context for listener callbacks
   */
  public void setProgressListener(
      ReindexingProgressListener listener, ReindexingJobContext context) {
    this.progressListener = listener;
    this.jobContext = context;
  }

  /** Safely convert long to int, capping at Integer.MAX_VALUE to prevent overflow */
  private static int safeToInt(long value) {
    if (value > Integer.MAX_VALUE) {
      return Integer.MAX_VALUE;
    }
    if (value < Integer.MIN_VALUE) {
      return Integer.MIN_VALUE;
    }
    return (int) value;
  }

  /**
   * Start the stats aggregation and broadcasting.
   */
  public void start() {
    if (running.compareAndSet(false, true)) {
      scheduler =
          Executors.newSingleThreadScheduledExecutor(
              Thread.ofPlatform()
                  .name("stats-aggregator-" + jobId.toString().substring(0, 8))
                  .factory());

      scheduler.scheduleAtFixedRate(
          this::aggregateAndBroadcast, 0, pollIntervalMs, TimeUnit.MILLISECONDS);

      LOG.info("Started stats aggregator for job {} with interval {}ms", jobId, pollIntervalMs);
    }
  }

  /**
   * Stop the stats aggregation.
   */
  public void stop() {
    if (running.compareAndSet(true, false)) {
      if (scheduler != null) {
        scheduler.shutdown();
        try {
          if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
            scheduler.shutdownNow();
          }
        } catch (InterruptedException e) {
          scheduler.shutdownNow();
          Thread.currentThread().interrupt();
        }
      }
      LOG.info("Stopped stats aggregator for job {}", jobId);
    }
  }

  /**
   * Check if the aggregator is running.
   *
   * @return true if running
   */
  public boolean isRunning() {
    return running.get();
  }

  /**
   * Aggregate stats from the database and broadcast via WebSocket.
   */
  private void aggregateAndBroadcast() {
    try {
      LOG.debug("Stats aggregator polling for job {}", jobId);
      SearchIndexJob job = coordinator.getJobWithAggregatedStats(jobId);
      if (job == null) {
        LOG.warn("Job {} not found, stopping aggregator", jobId);
        stop();
        return;
      }

      LOG.debug(
          "Aggregated stats from DB for job {}: processed={}, success={}, failed={}, status={}",
          jobId,
          job.getProcessedRecords(),
          job.getSuccessRecords(),
          job.getFailedRecords(),
          job.getStatus());

      // Convert to WebSocket message format
      AppRunRecord appRecord = convertToAppRunRecord(job);

      // Broadcast via WebSocket
      broadcastStats(appRecord);

      // Notify progress listener
      notifyProgressListener(job);

      // Note: Do NOT auto-stop when job is terminal. The executor will call stop()
      // after ensuring final stats are broadcast with forceUpdate(). This prevents
      // a race condition where the aggregator stops before all partition stats are
      // committed to the database.
      if (job.isTerminal()) {
        LOG.info(
            "Job {} is in terminal state {}, waiting for executor to stop aggregator",
            jobId,
            job.getStatus());
      }

    } catch (Exception e) {
      LOG.error("Error aggregating stats for job {}", jobId, e);
    }
  }

  /**
   * Notify the progress listener about job status and progress.
   *
   * @param job The current job state
   */
  private void notifyProgressListener(SearchIndexJob job) {
    if (progressListener == null || jobContext == null) {
      return;
    }

    try {
      Stats stats = convertToStats(job);
      IndexJobStatus currentStatus = job.getStatus();
      IndexJobStatus previousStatus = lastNotifiedStatus.get();

      // Always notify progress updates
      progressListener.onProgressUpdate(stats, jobContext);

      // Notify status transitions only once
      if (currentStatus != previousStatus) {
        lastNotifiedStatus.set(currentStatus);

        long elapsedMillis =
            job.getStartedAt() != null ? System.currentTimeMillis() - job.getStartedAt() : 0;

        switch (currentStatus) {
          case COMPLETED -> progressListener.onJobCompleted(stats, elapsedMillis);
          case COMPLETED_WITH_ERRORS -> progressListener.onJobCompletedWithErrors(
              stats, elapsedMillis);
          case FAILED -> progressListener.onJobFailed(
              stats,
              new RuntimeException(
                  job.getErrorMessage() != null
                      ? job.getErrorMessage()
                      : "Distributed job failed"));
          case STOPPED -> progressListener.onJobStopped(stats);
          default -> {
            /* No special notification for other states */
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Error notifying progress listener for job {}", jobId, e);
    }
  }

  /**
   * Convert SearchIndexJob to Stats format for listener callbacks.
   *
   * @param job The distributed job
   * @return Stats object
   */
  private Stats convertToStats(SearchIndexJob job) {
    Stats stats = new Stats();

    // Try to get aggregated server stats for accurate reader/sink breakdown
    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats serverStatsAggr = null;
    try {
      serverStatsAggr =
          coordinator
              .getCollectionDAO()
              .searchIndexServerStatsDAO()
              .getAggregatedStats(job.getId().toString());
    } catch (Exception e) {
      LOG.debug("Could not fetch aggregated server stats for job {}", job.getId(), e);
    }

    StepStats jobStats = new StepStats();
    jobStats.setTotalRecords(safeToInt(job.getTotalRecords()));
    jobStats.setSuccessRecords(safeToInt(job.getSuccessRecords()));
    jobStats.setFailedRecords(safeToInt(job.getFailedRecords()));
    stats.setJobStats(jobStats);

    EntityStats entityStats = new EntityStats();
    if (job.getEntityStats() != null) {
      for (Map.Entry<String, SearchIndexJob.EntityTypeStats> entry :
          job.getEntityStats().entrySet()) {
        SearchIndexJob.EntityTypeStats es = entry.getValue();
        StepStats stepStats = new StepStats();
        stepStats.setTotalRecords(safeToInt(es.getTotalRecords()));
        stepStats.setSuccessRecords(safeToInt(es.getSuccessRecords()));
        stepStats.setFailedRecords(safeToInt(es.getFailedRecords()));
        entityStats.getAdditionalProperties().put(entry.getKey(), stepStats);
      }
    }
    stats.setEntityStats(entityStats);

    StepStats readerStats = new StepStats();
    readerStats.setTotalRecords(safeToInt(job.getTotalRecords()));
    if (serverStatsAggr != null) {
      readerStats.setSuccessRecords(safeToInt(serverStatsAggr.readerSuccess()));
      readerStats.setFailedRecords(safeToInt(serverStatsAggr.readerFailed()));
      readerStats.setWarningRecords(safeToInt(serverStatsAggr.readerWarnings()));
    } else {
      readerStats.setSuccessRecords(safeToInt(job.getProcessedRecords()));
      readerStats.setFailedRecords(0);
      readerStats.setWarningRecords(0);
    }
    stats.setReaderStats(readerStats);

    // Process stats - building search index documents from entities
    StepStats processStats = new StepStats();
    if (serverStatsAggr != null) {
      long processTotal = serverStatsAggr.processSuccess() + serverStatsAggr.processFailed();
      processStats.setTotalRecords(safeToInt(processTotal));
      processStats.setSuccessRecords(safeToInt(serverStatsAggr.processSuccess()));
      processStats.setFailedRecords(safeToInt(serverStatsAggr.processFailed()));
    } else {
      // Fallback: assume all read records were processed successfully
      processStats.setTotalRecords(safeToInt(job.getProcessedRecords()));
      processStats.setSuccessRecords(safeToInt(job.getProcessedRecords()));
      processStats.setFailedRecords(0);
    }
    stats.setProcessStats(processStats);

    // Sink stats - writing to search index (only includes successfully processed docs)
    StepStats sinkStats = new StepStats();
    if (serverStatsAggr != null) {
      long sinkTotal = serverStatsAggr.sinkSuccess() + serverStatsAggr.sinkFailed();
      sinkStats.setTotalRecords(safeToInt(sinkTotal));
      sinkStats.setSuccessRecords(safeToInt(serverStatsAggr.sinkSuccess()));
      sinkStats.setFailedRecords(safeToInt(serverStatsAggr.sinkFailed()));
    } else {
      sinkStats.setTotalRecords(safeToInt(job.getProcessedRecords()));
      sinkStats.setSuccessRecords(safeToInt(job.getSuccessRecords()));
      sinkStats.setFailedRecords(safeToInt(job.getFailedRecords()));
    }
    stats.setSinkStats(sinkStats);

    // Vector stats - generating and indexing vector embeddings
    StepStats vectorStats = new StepStats();
    if (serverStatsAggr != null) {
      long vectorTotal = serverStatsAggr.vectorSuccess() + serverStatsAggr.vectorFailed();
      vectorStats.setTotalRecords(safeToInt(vectorTotal));
      vectorStats.setSuccessRecords(safeToInt(serverStatsAggr.vectorSuccess()));
      vectorStats.setFailedRecords(safeToInt(serverStatsAggr.vectorFailed()));
    } else {
      vectorStats.setTotalRecords(0);
      vectorStats.setSuccessRecords(0);
      vectorStats.setFailedRecords(0);
    }
    stats.setVectorStats(vectorStats);

    return stats;
  }

  /**
   * Convert SearchIndexJob to AppRunRecord format for WebSocket compatibility.
   *
   * @param job The distributed job
   * @return AppRunRecord in the format expected by the UI
   */
  private AppRunRecord convertToAppRunRecord(SearchIndexJob job) {
    // Reuse the shared conversion logic for consistent stats
    Stats stats = convertToStats(job);

    // Create AppRunRecord
    AppRunRecord appRecord = new AppRunRecord();
    // Use the actual app ID so frontend can match the record for live updates
    appRecord.setAppId(appId != null ? appId : UUID.randomUUID());
    appRecord.setStatus(convertStatus(job.getStatus()));
    appRecord.setRunType("SearchIndexApp");
    // Use the app's start time so frontend can match the record
    appRecord.setStartTime(appStartTime != null ? appStartTime : job.getStartedAt());
    appRecord.setEndTime(job.getCompletedAt());
    appRecord.setTimestamp(job.getUpdatedAt());

    // Add stats as success context
    SuccessContext successContext = new SuccessContext();
    successContext.withAdditionalProperty("stats", stats);

    // Add distributed-specific metadata
    successContext.withAdditionalProperty("distributedJobId", job.getId().toString());
    successContext.withAdditionalProperty("progressPercent", job.getProgressPercent());
    if (job.getEntityStats() != null) {
      successContext.withAdditionalProperty("entityTypeCount", job.getEntityStats().size());
    }

    // Add per-server stats to show distributed processing
    if (job.getServerStats() != null && !job.getServerStats().isEmpty()) {
      successContext.withAdditionalProperty("serverStats", job.getServerStats());
      successContext.withAdditionalProperty("serverCount", job.getServerStats().size());
    }

    // Add aggregated server stats from the dedicated table for more accurate sink stats
    try {
      CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats serverStatsAggr =
          coordinator
              .getCollectionDAO()
              .searchIndexServerStatsDAO()
              .getAggregatedStats(job.getId().toString());
      if (serverStatsAggr != null) {
        successContext.withAdditionalProperty("aggregatedServerStats", serverStatsAggr);
      }
    } catch (Exception e) {
      LOG.debug("Could not fetch aggregated server stats for job {}", job.getId(), e);
    }

    appRecord.setSuccessContext(successContext);

    return appRecord;
  }

  /**
   * Convert IndexJobStatus to AppRunRecord.Status.
   *
   * @param status The distributed job status
   * @return Corresponding AppRunRecord status
   */
  private AppRunRecord.Status convertStatus(IndexJobStatus status) {
    return switch (status) {
      case INITIALIZING, READY -> AppRunRecord.Status.PENDING;
      case RUNNING -> AppRunRecord.Status.RUNNING;
      case COMPLETED -> AppRunRecord.Status.SUCCESS;
      case COMPLETED_WITH_ERRORS -> AppRunRecord.Status.ACTIVE_ERROR;
      case FAILED -> AppRunRecord.Status.FAILED;
      case STOPPING -> AppRunRecord.Status.STOP_IN_PROGRESS;
      case STOPPED -> AppRunRecord.Status.STOPPED;
    };
  }

  /**
   * Broadcast stats via WebSocket.
   *
   * @param appRecord The app run record to broadcast
   */
  private void broadcastStats(AppRunRecord appRecord) {
    WebSocketManager wsManager = WebSocketManager.getInstance();
    if (wsManager != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      wsManager.broadCastMessageToAll(SEARCH_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
      LOG.info(
          "Broadcast distributed job stats via WebSocket - job: {}, progress: {}%, status: {}, "
              + "success: {}, failed: {}",
          jobId,
          appRecord.getSuccessContext().getAdditionalProperties().get("progressPercent"),
          appRecord.getStatus(),
          appRecord.getSuccessContext().getAdditionalProperties().get("stats") != null
              ? ((Stats) appRecord.getSuccessContext().getAdditionalProperties().get("stats"))
                  .getJobStats()
                  .getSuccessRecords()
              : 0,
          appRecord.getSuccessContext().getAdditionalProperties().get("stats") != null
              ? ((Stats) appRecord.getSuccessContext().getAdditionalProperties().get("stats"))
                  .getJobStats()
                  .getFailedRecords()
              : 0);
    } else {
      LOG.warn("WebSocket manager not available, skipping distributed job broadcast");
    }
  }

  /**
   * Force an immediate stats broadcast.
   */
  public void forceUpdate() {
    if (running.get() && scheduler != null && !scheduler.isShutdown()) {
      // Schedule immediate execution if scheduler is running
      scheduler.execute(this::aggregateAndBroadcast);
    } else {
      // Call directly if scheduler is not available
      aggregateAndBroadcast();
    }
  }

  /**
   * Get the current aggregated stats without broadcasting.
   *
   * @return The current job with aggregated stats
   */
  public SearchIndexJob getCurrentStats() {
    return coordinator.getJobWithAggregatedStats(jobId);
  }
}
