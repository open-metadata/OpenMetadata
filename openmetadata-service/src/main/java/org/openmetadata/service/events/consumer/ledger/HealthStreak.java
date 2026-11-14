package org.openmetadata.service.events.consumer.ledger;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.SubscriptionStatus;

/**
 * Counts, per destination, the ticks in a row that failed and since when. A tick that delivered,
 * or in which the destination was not attempted, ends the run: not being attempted is not failing.
 */
public final class HealthStreak {

  private HealthStreak() {}

  public static DestinationHealth after(
      DestinationHealth previous, DestinationOutcome outcomeOfThisTick) {
    SubscriptionStatus statusOfThisTick = outcomeOfThisTick.status();
    DestinationHealth result = new DestinationHealth().withStatus(statusOfThisTick);
    if (outcomeOfThisTick.kind() == DestinationOutcome.Kind.FAILED) {
      result
          .withConsecutiveFailedTicks(failedTicksBefore(previous) + 1)
          .withFailingSince(failingSince(previous, statusOfThisTick));
      sayForHowLong(result);
    } else {
      result.withConsecutiveFailedTicks(0);
    }
    return result;
  }

  // The status is the last tick's, as its shape expects, so an endpoint that fails every tick
  // would read like one that failed once. The reason says for how long it has been failing.
  private static void sayForHowLong(DestinationHealth failing) {
    boolean notTheFirstTick = failing.getConsecutiveFailedTicks() > 1;
    if (notTheFirstTick && failing.getFailingSince() != null) {
      String since =
          Instant.ofEpochMilli(failing.getFailingSince())
              .truncatedTo(ChronoUnit.MINUTES)
              .toString();
      SubscriptionStatus status = failing.getStatus();
      status.withLastFailedReason(
          String.format(
              "%s, failing for %d ticks since %s",
              status.getLastFailedReason(), failing.getConsecutiveFailedTicks(), since));
    }
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
