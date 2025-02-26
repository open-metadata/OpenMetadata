package org.openmetadata.service.apps.bundles.dataRetention;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataRetention extends AbstractNativeApplication {
  private static final int BATCH_SIZE = 10_000;
  private DataRetentionConfiguration dataRetentionConfiguration;
  private final CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO;

  public DataRetention(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
    this.eventSubscriptionDAO = collectionDAO.eventSubscriptionDAO();
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
    executeCleanup(dataRetentionConfiguration);
  }

  public void executeCleanup(DataRetentionConfiguration config) {
    if (CommonUtil.nullOrEmpty(config)) {
      return;
    }

    cleanChangeEvents(config.getChangeEventRetentionPeriod());
  }

  private void cleanChangeEvents(int retentionPeriod) {
    LOG.info(
        "Initiating change events cleanup: Deleting records with a retention period of {} days.",
        retentionPeriod);
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
        "Change events cleanup completed: {} successful_sent_change_events, {} change_events, and {} consumers_dlq records deleted (retention period: {} days).",
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
