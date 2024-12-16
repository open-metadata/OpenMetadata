package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.RetentionPolicyConfiguration;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
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

  /**
   * Batch Deletion Rationale:
   * -------------------------
   * Batch deletion to handle large datasets without overwhelming the database.
   * <p>
   * If the retention period dictates that 35,000 records need to be deleted and BATCH_SIZE is 10,000,
   * the process works as follows: [Controlled Fetch and Controlled Deletion]
   * <p>
   * 1. First Batch: Fetch and delete 10,000 records (total deleted: 10,000).
   * 2. Second Batch: Fetch and delete 10,000 records (total deleted: 20,000).
   * 3. Third Batch: Fetch and delete 10,000 records (total deleted: 30,000).
   * 4. Fourth Batch: Fetch and delete the remaining 5,000 records (total deleted: 35,000).
   * 5. Loop Ends: The next fetch returns no records, so the loop exits.
   * <p>
   * This ensures that all records beyond the retention period are deleted, even if their total count
   * exceeds the BATCH_SIZE.
   */
  @Transaction
  private void cleanActivityThreads(int retentionPeriod) {
    long cutoffMillis = getRetentionCutoffMillis(retentionPeriod);
    CollectionDAO.FeedDAO feedDAO = Entity.getCollectionDAO().feedDAO();
    FeedRepository feedRepository = Entity.getFeedRepository();

    LOG.info(
        "Initiating activity thread cleanup: Deleting 'Conversation' type threads with a retention period of {} days.",
        retentionPeriod);

    int totalDeletedThreads =
        batchDelete(
            () -> {
              // Fetch a batch of thread IDs that match the criteria
              List<UUID> threadIdsToDelete =
                  feedDAO.fetchConversationThreadIdsOlderThan(cutoffMillis, BATCH_SIZE);

              if (CommonUtil.nullOrEmpty(threadIdsToDelete)) {
                LOG.debug("No more threads to delete.");
                return 0;
              }

              // Delete each thread and its associated relationships
              List<UUID> failedDeletions = new ArrayList<>();
              for (UUID threadId : threadIdsToDelete) {
                try {
                  feedRepository.deleteThreadInternal(threadId);
                } catch (Exception e) {
                  LOG.error("Error deleting thread with ID {}: {}", threadId, e.getMessage(), e);
                  failedDeletions.add(threadId);
                }
              }

              if (!failedDeletions.isEmpty()) {
                LOG.error("Failed to delete {} threads", failedDeletions.size());
              }

              return threadIdsToDelete.size();
            });

    LOG.info(
        "Activity thread cleanup completed: {} 'Conversation' type threads deleted (retention period: {} days).",
        totalDeletedThreads,
        retentionPeriod);
  }

  private void cleanVersions(int retentionPeriod) {
    // Implement cleanVersions logic
  }

  @Transaction
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
