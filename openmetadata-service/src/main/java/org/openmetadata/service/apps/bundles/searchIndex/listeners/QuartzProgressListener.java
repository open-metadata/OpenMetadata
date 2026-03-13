package org.openmetadata.service.apps.bundles.searchIndex.listeners;

import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.searchIndex.QuartzOrchestratorContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedJobContext;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.JobExecutionContext;

/**
 * Progress listener for Quartz-scheduled jobs. Updates JobExecutionContext, AppRunRecord, and
 * broadcasts via WebSocket.
 */
@Slf4j
public class QuartzProgressListener implements ReindexingProgressListener {

  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;
  private static final long DB_UPDATE_INTERVAL_MS = 5000;
  private static final int ERROR_THRESHOLD = 3;

  private final JobExecutionContext jobExecutionContext;
  private final EventPublisherJob jobData;
  private final App app;
  private final Function<JobExecutionContext, AppRunRecord> jobRecordProvider;
  private final QuartzOrchestratorContext.StatusPusher statusPusher;
  private volatile long lastWebSocketUpdate = 0;
  private volatile long lastDbUpdate = 0;
  private final AtomicInteger pendingErrors = new AtomicInteger(0);
  private volatile Map<String, Object> latestDistributedMetadata;

  public QuartzProgressListener(
      JobExecutionContext jobExecutionContext,
      EventPublisherJob jobData,
      App app,
      Function<JobExecutionContext, AppRunRecord> jobRecordProvider,
      QuartzOrchestratorContext.StatusPusher statusPusher) {
    this.jobExecutionContext = jobExecutionContext;
    this.jobData = jobData;
    this.app = app;
    this.jobRecordProvider = jobRecordProvider;
    this.statusPusher = statusPusher;
  }

  @Override
  public void onJobStarted(ReindexingJobContext context) {
    jobData.setStatus(EventPublisherJob.Status.STARTED);
    jobData.setTimestamp(context.getStartTime());
    sendUpdates(true);
  }

  @Override
  public void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {
    jobData.setStatus(EventPublisherJob.Status.RUNNING);
    jobData.setBatchSize(config.batchSize());
    jobData.setConsumerThreads(config.consumerThreads());
    jobData.setProducerThreads(config.producerThreads());
    jobData.setQueueSize(config.queueSize());
    jobData.setMaxConcurrentRequests(config.maxConcurrentRequests());
    jobData.setPayLoadSize(config.payloadSize());
    sendUpdates(true);
  }

  @Override
  public void onIndexRecreationStarted(Set<String> entities) {
    LOG.info("Index recreation started for {} entities", entities.size());
  }

  @Override
  public void onEntityTypeStarted(String entityType, long totalRecords) {
    LOG.debug("Started processing entity type: {} with {} records", entityType, totalRecords);
  }

  @Override
  public void onProgressUpdate(Stats stats, ReindexingJobContext context) {
    long currentTime = System.currentTimeMillis();
    if (currentTime - lastWebSocketUpdate < WEBSOCKET_UPDATE_INTERVAL_MS) {
      return;
    }
    lastWebSocketUpdate = currentTime;

    if (pendingErrors.get() > 0) {
      pendingErrors.set(0);
      jobData.setStatus(EventPublisherJob.Status.RUNNING);
    }

    if (context instanceof DistributedJobContext distributedContext) {
      Map<String, Object> metadata = distributedContext.getDistributedMetadata();
      if (metadata != null && !metadata.isEmpty()) {
        latestDistributedMetadata = metadata;
      }
    }

    jobData.setStats(stats);
    sendUpdates(false);
  }

  @Override
  public void onEntityTypeCompleted(String entityType, StepStats entityStats) {
    LOG.debug("Completed processing entity type: {}", entityType);
  }

  @Override
  public void onError(String entityType, IndexingError error, Stats currentStats) {
    int errorCount = pendingErrors.incrementAndGet();
    jobData.setFailure(error);
    jobData.setStats(currentStats);
    if (errorCount >= ERROR_THRESHOLD) {
      jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
    }
    sendUpdates(true);
  }

  @Override
  public void onJobCompleted(Stats finalStats, long elapsedMillis) {
    jobData.setStatus(EventPublisherJob.Status.COMPLETED);
    jobData.setStats(finalStats);
    sendUpdates(true);
    LOG.info(
        "Reindexing completed in {}s - Total: {}, Success: {}, Failed: {}",
        elapsedMillis / 1000,
        finalStats.getJobStats().getTotalRecords(),
        finalStats.getJobStats().getSuccessRecords(),
        finalStats.getJobStats().getFailedRecords());
  }

  @Override
  public void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {
    jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
    jobData.setStats(finalStats);
    sendUpdates(true);
    LOG.warn(
        "Reindexing completed with errors in {}s - Total: {}, Success: {}, Failed: {}",
        elapsedMillis / 1000,
        finalStats.getJobStats().getTotalRecords(),
        finalStats.getJobStats().getSuccessRecords(),
        finalStats.getJobStats().getFailedRecords());
  }

  @Override
  public void onJobFailed(Stats currentStats, Exception error) {
    jobData.setStatus(EventPublisherJob.Status.FAILED);
    jobData.setStats(currentStats);
    jobData.setFailure(
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(error.getMessage()));
    sendUpdates(true);
    LOG.error("Reindexing failed", error);
  }

  @Override
  public void onJobStopped(Stats currentStats) {
    jobData.setStatus(EventPublisherJob.Status.STOPPED);
    jobData.setStats(currentStats);
    sendUpdates(true);
    LOG.info("Reindexing stopped by user request");
  }

  @Override
  public int getPriority() {
    return 10;
  }

  private void sendUpdates(boolean force) {
    try {
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, SEARCH_INDEX_JOB_BROADCAST_CHANNEL);

      updateRecordAndNotify(force);
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats", ex);
    }
  }

  private void updateRecordAndNotify(boolean forceDbUpdate) {
    AppRunRecord appRecord = getUpdatedAppRunRecord();

    persistToDb(appRecord, forceDbUpdate);
    broadcastViaWebSocket(appRecord);
  }

  private void persistToDb(AppRunRecord appRecord, boolean force) {
    if (statusPusher == null) {
      return;
    }
    long currentTime = System.currentTimeMillis();
    if (!force && currentTime - lastDbUpdate < DB_UPDATE_INTERVAL_MS) {
      return;
    }
    lastDbUpdate = currentTime;
    try {
      statusPusher.push(jobExecutionContext, appRecord, true);
    } catch (Exception ex) {
      LOG.error("Failed to persist app run record to database", ex);
    }
  }

  private void broadcastViaWebSocket(AppRunRecord appRecord) {
    if (WebSocketManager.getInstance() != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      WebSocketManager.getInstance()
          .broadCastMessageToAll(SEARCH_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
    }
  }

  private AppRunRecord getUpdatedAppRunRecord() {
    AppRunRecord appRecord = readExistingRecord();
    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));

    if (jobData.getStats() != null) {
      SuccessContext ctx = appRecord.getSuccessContext();
      if (ctx == null) {
        ctx = new SuccessContext();
      }
      ctx.withAdditionalProperty("stats", jobData.getStats());

      Map<String, Object> metadata = latestDistributedMetadata;
      if (metadata != null) {
        for (Map.Entry<String, Object> entry : metadata.entrySet()) {
          ctx.withAdditionalProperty(entry.getKey(), entry.getValue());
        }
      }

      appRecord.setSuccessContext(ctx);
    }

    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }

    return appRecord;
  }

  private AppRunRecord readExistingRecord() {
    if (jobRecordProvider != null) {
      try {
        AppRunRecord existing = jobRecordProvider.apply(jobExecutionContext);
        if (existing != null) {
          return existing;
        }
      } catch (Exception ex) {
        LOG.debug("Could not read existing job record from context", ex);
      }
    }
    AppRunRecord fallback = new AppRunRecord();
    fallback.setAppId(app != null ? app.getId() : null);
    fallback.setStartTime(jobData.getTimestamp());
    return fallback;
  }

  /** Get the current job data for external access */
  public EventPublisherJob getJobData() {
    return jobData;
  }
}
