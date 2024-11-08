package org.openmetadata.service.events.scheduled;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.service.Entity;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@Slf4j
public class EventSubscriptionCleanupJob implements Job {
  private static final int TARGET_COUNT = 50;
  private static final int THRESHOLD = 100;

  @Override
  public void execute(JobExecutionContext context) throws JobExecutionException {
    performCleanup();
  }

  @Transaction
  public static void performCleanup() {
    List<String> subscriptionsToClean =
        Entity.getCollectionDAO().eventSubscriptionDAO().findSubscriptionsAboveThreshold(THRESHOLD);

    for (String subscriptionId : subscriptionsToClean) {
      int recordCount =
          Entity.getCollectionDAO().eventSubscriptionDAO().getRecordCount(subscriptionId);

      int excessRecords = recordCount - TARGET_COUNT;
      if (excessRecords > 0) {
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .deleteOldRecords(subscriptionId, excessRecords);
      }
    }
    LOG.debug(
        "Performed cleanup for subscriptions, retaining {} records per subscription.",
        TARGET_COUNT);
  }
}
