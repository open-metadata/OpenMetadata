package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.RetentionPolicyConfiguration;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;

@Slf4j
public class RetentionPolicyApp extends AbstractNativeApplication {
  private static RetentionPolicyConfiguration retentionPolicyConfiguration;

  public RetentionPolicyApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    retentionPolicyConfiguration =
        JsonUtils.convertValue(app.getAppConfiguration(), RetentionPolicyConfiguration.class);
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    executeCleanup(retentionPolicyConfiguration);
  }

  public void executeCleanup(RetentionPolicyConfiguration retentionPolicyConfiguration) {
    if (CommonUtil.nullOrEmpty(retentionPolicyConfiguration)) {
      return;
    }

    RetentionPolicyConfiguration.Entity entity = retentionPolicyConfiguration.getEntity();
    RetentionPolicyConfiguration.RetentionPeriod retentionPeriod =
        retentionPolicyConfiguration.getRetentionPeriod();

    switch (entity) {
      case EVENT_SUBSCRIPTION -> eventSubscriptionCleanupHandler(retentionPeriod);
      default -> throw new IllegalArgumentException("Unknown entity type: " + entity);
    }
  }

  private long getRetentionPeriodInMilliseconds(
      RetentionPolicyConfiguration.RetentionPeriod retentionPeriod) {
    return switch (retentionPeriod) {
      case ONE_WEEK -> getRetentionCutoffMillis(Duration.ofDays(7).toMillis());
      case TWO_WEEKS -> getRetentionCutoffMillis(Duration.ofDays(14).toMillis());
      case ONE_MONTH -> getRetentionCutoffMillis(Duration.ofDays(30).toMillis());
      case THREE_MONTHS -> getRetentionCutoffMillis(Duration.ofDays(90).toMillis());
      case SIX_MONTHS -> getRetentionCutoffMillis(Duration.ofDays(180).toMillis());
    };
  }

  private long getRetentionCutoffMillis(long durationMillis) {
    return Instant.now().minusMillis(durationMillis).toEpochMilli();
  }

  private void eventSubscriptionCleanupHandler(
      RetentionPolicyConfiguration.RetentionPeriod retentionPeriod) {
    long retentionPeriodInMilliseconds = getRetentionPeriodInMilliseconds(retentionPeriod);
    final int BATCH_SIZE = 10_000;

    // Delete old records from successful_sent_change_events
    int totalDeletedSuccessfulEvents =
        batchDelete(
            () ->
                Entity.getCollectionDAO()
                    .eventSubscriptionDAO()
                    .deleteSuccessfulSentChangeEventsInBatches(
                        retentionPeriodInMilliseconds, BATCH_SIZE));

    // Delete old records from change_event
    int totalDeletedChangeEvents =
        batchDelete(
            () ->
                Entity.getCollectionDAO()
                    .eventSubscriptionDAO()
                    .deleteChangeEventsInBatches(retentionPeriodInMilliseconds, BATCH_SIZE));

    // Delete old records from consumers_dlq
    int totalDeletedDlq =
        batchDelete(
            () ->
                Entity.getCollectionDAO()
                    .eventSubscriptionDAO()
                    .deleteConsumersDlqInBatches(retentionPeriodInMilliseconds, BATCH_SIZE));

    LOG.info(
        "Deleted {} old successful_sent_change_events, {} old change_event, and {} old consumers_dlq records older than {} for EVENT_SUBSCRIPTION.",
        totalDeletedSuccessfulEvents,
        totalDeletedChangeEvents,
        totalDeletedDlq,
        retentionPeriod);
  }

  /**
   * Helper method to run a chunked delete operation until no more large batches are returned.
   * The Supplier should execute a single batch delete and return the number of records deleted.
   */
  private int batchDelete(Supplier<Integer> deleteFunction) {
    int totalDeleted = 0;
    while (true) {
      int deletedCount = deleteFunction.get();
      totalDeleted += deletedCount;

      if (deletedCount < 10_000) { // If less than BATCH_SIZE were deleted, stop
        break;
      }
    }
    return totalDeleted;
  }
}
