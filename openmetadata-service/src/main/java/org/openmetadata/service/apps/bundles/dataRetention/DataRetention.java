package org.openmetadata.service.apps.bundles.dataRetention;

import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.EntityRelationshipCleanupUtil;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataRetention extends AbstractNativeApplication {
  private static final int BATCH_SIZE = 10_000;

  private DataRetentionConfiguration dataRetentionConfiguration;
  private final CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO;
  private final Stats retentionStats = new Stats();
  private JobExecutionContext jobExecutionContext;

  private AppRunRecord.Status internalStatus = AppRunRecord.Status.COMPLETED;
  private Map<String, Object> failureDetails = null;

  private final FeedRepository feedRepository;
  private final CollectionDAO.FeedDAO feedDAO;

  public DataRetention(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
    this.eventSubscriptionDAO = collectionDAO.eventSubscriptionDAO();
    this.feedRepository = Entity.getFeedRepository();
    this.feedDAO = Entity.getCollectionDAO().feedDAO();
  }

  @Override
  public void init(App app) {
    super.init(app);
    this.dataRetentionConfiguration =
        JsonUtils.convertValue(app.getAppConfiguration(), DataRetentionConfiguration.class);
    if (CommonUtil.nullOrEmpty(this.dataRetentionConfiguration)) {
      LOG.warn("No retention policy configuration provided. Cleanup tasks will not run.");
    }
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;

    try {
      initializeStatsDefaults();
      executeCleanup(dataRetentionConfiguration);

      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, retentionStats);
      updateRecordToDbAndNotify(null);

      if (internalStatus == AppRunRecord.Status.ACTIVE_ERROR
          || internalStatus == AppRunRecord.Status.FAILED) {
        throw new RuntimeException("Partial failure occurred in DataRetention job");
      }

    } catch (Exception ex) {
      LOG.error("DataRetention job failed.", ex);
      internalStatus = AppRunRecord.Status.FAILED;

      failureDetails = new HashMap<>();
      failureDetails.put("message", ex.getMessage());
      failureDetails.put("jobStackTrace", ExceptionUtils.getStackTrace(ex));

      updateRecordToDbAndNotify(ex);
    }
  }

  private void initializeStatsDefaults() {
    StepStats jobStats =
        new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);
    retentionStats.setJobStats(jobStats);

    EntityStats entityStats = new EntityStats();
    entityStats.withAdditionalProperty("successful_sent_change_events", new StepStats());
    entityStats.withAdditionalProperty("change_events", new StepStats());
    entityStats.withAdditionalProperty("consumers_dlq", new StepStats());
    entityStats.withAdditionalProperty("activity_threads", new StepStats());

    // Add stats for relationship and hierarchy cleanup
    entityStats.withAdditionalProperty("orphaned_relationships", new StepStats());
    entityStats.withAdditionalProperty("broken_database_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_dashboard_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_api_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_messaging_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_pipeline_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_storage_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_mlmodel_entities", new StepStats());
    entityStats.withAdditionalProperty("broken_search_entities", new StepStats());

    retentionStats.setEntityStats(entityStats);
  }

  public void executeCleanup(DataRetentionConfiguration config) {
    if (config == null) {
      LOG.warn("DataRetentionConfiguration is null. Skipping cleanup.");
      return;
    }

    // Clean up orphaned relationships and broken service hierarchies
    LOG.info("Starting cleanup for orphaned relationships and broken service hierarchies.");
    cleanOrphanedRelationshipsAndHierarchies();

    int retentionPeriod = config.getChangeEventRetentionPeriod();
    LOG.info("Starting cleanup for change events with retention period: {} days.", retentionPeriod);
    cleanChangeEvents(retentionPeriod);

    int threadRetentionPeriod = config.getActivityThreadsRetentionPeriod();
    LOG.info(
        "Starting cleanup for activity threads with retention period: {} days.",
        threadRetentionPeriod);
    cleanActivityThreads(threadRetentionPeriod);
  }

  @Transaction
  private void cleanActivityThreads(int retentionPeriod) {
    LOG.info("Initiating activity threads cleanup: Retention = {} days.", retentionPeriod);
    long cutoffMillis = getRetentionCutoffMillis(retentionPeriod);

    List<UUID> threadIdsToDelete =
        feedDAO.fetchConversationThreadIdsOlderThan(cutoffMillis, BATCH_SIZE);

    if (threadIdsToDelete.isEmpty()) {
      LOG.info(
          "No activity threads found older than retention period of {} days, skipping cleanup.",
          retentionPeriod);
      return;
    }

    executeWithStatsTracking(
        "activity_threads", () -> feedRepository.deleteThreadsInBatch(threadIdsToDelete));

    LOG.info("Activity threads cleanup complete.");
  }

  @Transaction
  private void cleanChangeEvents(int retentionPeriod) {
    LOG.info("Initiating change events cleanup: Retention = {} days.", retentionPeriod);
    long cutoffMillis = getRetentionCutoffMillis(retentionPeriod);

    executeWithStatsTracking(
        "successful_sent_change_events",
        () ->
            eventSubscriptionDAO.deleteSuccessfulSentChangeEventsInBatches(
                cutoffMillis, BATCH_SIZE));

    executeWithStatsTracking(
        "change_events",
        () -> eventSubscriptionDAO.deleteChangeEventsInBatches(cutoffMillis, BATCH_SIZE));

    executeWithStatsTracking(
        "consumers_dlq",
        () -> eventSubscriptionDAO.deleteConsumersDlqInBatches(cutoffMillis, BATCH_SIZE));

    LOG.info("Change events cleanup complete.");
  }

  @Transaction
  private void cleanOrphanedRelationshipsAndHierarchies() {
    LOG.info("Initiating orphaned relationships and broken service hierarchies cleanup.");

    try {
      // Perform comprehensive cleanup using the reusable utility
      EntityRelationshipCleanupUtil cleanup =
          EntityRelationshipCleanupUtil.forActualCleanup(collectionDAO, BATCH_SIZE);
      EntityRelationshipCleanupUtil.CleanupResult result = cleanup.performComprehensiveCleanup();

      // Update stats for orphaned relationships
      updateStats(
          "orphaned_relationships", result.getRelationshipResult().getRelationshipsDeleted(), 0);

      // Update stats for each service type
      for (Map.Entry<String, Integer> entry :
          result.getHierarchyResult().getDeletedEntitiesByService().entrySet()) {
        String serviceName = entry.getKey();
        int deletedCount = entry.getValue();
        String statsKey = "broken_" + serviceName.toLowerCase() + "_entities";
        updateStats(statsKey, deletedCount, 0);
      }

      LOG.info(
          "Cleanup completed - Relationships: {}, Hierarchies: {}",
          result.getRelationshipResult().getRelationshipsDeleted(),
          result.getHierarchyResult().getTotalBrokenDeleted());

    } catch (Exception ex) {
      LOG.error("Failed to clean orphaned relationships and hierarchies", ex);
      internalStatus = AppRunRecord.Status.ACTIVE_ERROR;

      if (failureDetails == null) {
        failureDetails = new HashMap<>();
        failureDetails.put("message", ex.getMessage());
        failureDetails.put("jobStackTrace", ExceptionUtils.getStackTrace(ex));
      }
    }
  }

  private void executeWithStatsTracking(String entity, Supplier<Integer> deleteFunction) {
    int totalDeleted = 0;
    int totalFailed = 0;

    while (true) {
      try {
        int deleted = deleteFunction.get();
        totalDeleted += deleted;
        if (deleted < BATCH_SIZE) break;
      } catch (Exception ex) {
        LOG.error("Failed to clean entity: {}", entity, ex);
        totalFailed += BATCH_SIZE;
        internalStatus = AppRunRecord.Status.ACTIVE_ERROR;

        if (failureDetails == null) {
          failureDetails = new HashMap<>();
          failureDetails.put("message", ex.getMessage());
          failureDetails.put("jobStackTrace", ExceptionUtils.getStackTrace(ex));
        }
        break;
      }
    }

    updateStats(entity, totalDeleted, totalFailed);
  }

  private long getRetentionCutoffMillis(int retentionPeriodInDays) {
    return Instant.now()
        .minusMillis(Duration.ofDays(retentionPeriodInDays).toMillis())
        .toEpochMilli();
  }

  private synchronized void updateStats(String entity, int successCount, int failureCount) {
    StepStats entityStat =
        retentionStats
            .getEntityStats()
            .getAdditionalProperties()
            .getOrDefault(entity, new StepStats());

    entityStat.setTotalRecords(entityStat.getTotalRecords() + successCount + failureCount);
    entityStat.setSuccessRecords(entityStat.getSuccessRecords() + successCount);
    entityStat.setFailedRecords(entityStat.getFailedRecords() + failureCount);

    retentionStats.getEntityStats().withAdditionalProperty(entity, entityStat);

    StepStats jobStats = retentionStats.getJobStats();
    jobStats.setTotalRecords(jobStats.getTotalRecords() + successCount + failureCount);
    jobStats.setSuccessRecords(jobStats.getSuccessRecords() + successCount);
    jobStats.setFailedRecords(jobStats.getFailedRecords() + failureCount);
  }

  private void updateRecordToDbAndNotify(Exception error) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(internalStatus);

    if (failureDetails != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", failureDetails));
    }

    if (WebSocketManager.getInstance() != null) {
      WebSocketManager.getInstance()
          .broadCastMessageToAll("data_retention_app_channel", JsonUtils.pojoToJson(appRecord));
    }

    LOG.info("AppRecord before DB save: {}", JsonUtils.pojoToJson(appRecord));
    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    LOG.info("Final AppRunRecord update: {}", JsonUtils.pojoToJson(appRecord));
  }
}
