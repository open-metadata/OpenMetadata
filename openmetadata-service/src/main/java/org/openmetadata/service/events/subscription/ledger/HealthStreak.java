package org.openmetadata.service.events.subscription.ledger;

import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.SubscriptionStatus;

/** Counts, per destination, the ticks in a row that failed and since when. */
final class HealthStreak {

  private HealthStreak() {}

  static DestinationHealth after(DestinationHealth previous, SubscriptionStatus statusOfThisTick) {
    DestinationHealth result = new DestinationHealth().withStatus(statusOfThisTick);
    if (isFailing(statusOfThisTick)) {
      result
          .withConsecutiveFailedTicks(failedTicksBefore(previous) + 1)
          .withFailingSince(failingSince(previous, statusOfThisTick));
    } else {
      result.withConsecutiveFailedTicks(0);
    }
    return result;
  }

  static boolean isFailing(SubscriptionStatus status) {
    return status.getStatus() == SubscriptionStatus.Status.FAILED
        || status.getStatus() == SubscriptionStatus.Status.AWAITING_RETRY;
  }

  private static int failedTicksBefore(DestinationHealth previous) {
    boolean wasFailing = previous != null && previous.getConsecutiveFailedTicks() != null;
    return wasFailing ? previous.getConsecutiveFailedTicks() : 0;
  }

  private static Long failingSince(DestinationHealth previous, SubscriptionStatus status) {
    boolean alreadyFailing = previous != null && previous.getFailingSince() != null;
    return alreadyFailing ? previous.getFailingSince() : status.getTimestamp();
  }
}
