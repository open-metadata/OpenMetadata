package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.RetentionPolicyConfiguration;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;

@Slf4j
public class RetentionPolicyApp extends AbstractNativeApplication {
  private static final int BATCH_SIZE = 10_000;
  private RetentionPolicyConfiguration retentionPolicyConfiguration;
  private final CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO;

  public RetentionPolicyApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
    this.eventSubscriptionDAO = collectionDAO.eventSubscriptionDAO();
  }

  @Override
  public void init(App app) {
    super.init(app);
    this.retentionPolicyConfiguration =
        JsonUtils.convertValue(app.getAppConfiguration(), RetentionPolicyConfiguration.class);
    if (CommonUtil.nullOrEmpty(this.retentionPolicyConfiguration)) {
      LOG.warn("No retention policy configuration provided. Cleanup tasks will not run.");
    }
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    executeCleanup(retentionPolicyConfiguration);
  }

  public void executeCleanup(RetentionPolicyConfiguration config) {
    if (CommonUtil.nullOrEmpty(config)) {
      return;
    }

    cleanActivityThreads(config.getActivityThreadsRetentionPeriod());
    cleanVersions(config.getVersionsRetentionPeriod());
    cleanChangeEvents(config.getChangeEventRetentionPeriod());
  }

  private void cleanActivityThreads(int retentionPeriod) {
    // Implement cleanActivityThreads logic
  }

  private void cleanVersions(int retentionPeriod) {
    // Implement cleanVersions logic
  }

  @Transaction
  private void cleanChangeEvents(int retentionPeriod) {
    long cutoffMillis = getRetentionCutoffMillis(retentionPeriod);

    int totalDeletedSuccessfulEvents =
        batchDelete(
            () ->
                eventSubscriptionDAO.deleteSuccessfulSentChangeEventsInBatches(
                    cutoffMillis, BATCH_SIZE));

    int totalDeletedChangeEvents =
        batchDelete(
            () -> eventSubscriptionDAO.deleteChangeEventsInBatches(cutoffMillis, BATCH_SIZE));

    int totalDeletedDlq =
        batchDelete(
            () -> eventSubscriptionDAO.deleteConsumersDlqInBatches(cutoffMillis, BATCH_SIZE));

    LOG.info(
        "Deleted {} old successful_sent_change_events, {} old change_event, and {} old consumers_dlq records older than {} days for EVENT_SUBSCRIPTION.",
        totalDeletedSuccessfulEvents,
        totalDeletedChangeEvents,
        totalDeletedDlq,
        retentionPeriod);
  }

  private long getRetentionCutoffMillis(int retentionPeriodInDays) {
    return Instant.now()
        .minusMillis(Duration.ofDays(retentionPeriodInDays).toMillis())
        .toEpochMilli();
  }

  /**
   * Runs a batch delete operation in a loop until fewer than BATCH_SIZE records are deleted in a single iteration.
   */
  private int batchDelete(Supplier<Integer> deleteFunction) {
    var totalDeleted = 0;
    while (true) {
      var deletedCount = deleteFunction.get();
      totalDeleted += deletedCount;
      if (deletedCount < BATCH_SIZE) {
        break;
      }
    }
    return totalDeleted;
  }
}
