package org.openmetadata.service.apps.bundles.retentionPolicyApp.cleanupHandlers;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.RetentionJobContext;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.retentionPolicyApp.CleanupHandler;

@Slf4j
public class EventSubscriptionCleanupHandler implements CleanupHandler {
  private static final int TARGET_COUNT = 50;
  private static final int THRESHOLD = 100;

  @Override
  public void performCleanup(RetentionJobContext jobContext) {
    List<String> subscriptionsToClean =
        Entity.getCollectionDAO().eventSubscriptionDAO().findSubscriptionsAboveThreshold(THRESHOLD);

    for (String subscriptionId : subscriptionsToClean) {
      long recordCount =
          Entity.getCollectionDAO().eventSubscriptionDAO().getSuccessfulRecordCount(subscriptionId);

      long excessRecords = recordCount - TARGET_COUNT;
      if (excessRecords > 0) {
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .deleteOldRecords(subscriptionId, excessRecords);
      }
    }

    LOG.debug(
        "Performed cleanup for EventSubscription, retaining {} records per subscription.",
        TARGET_COUNT);
  }
}
