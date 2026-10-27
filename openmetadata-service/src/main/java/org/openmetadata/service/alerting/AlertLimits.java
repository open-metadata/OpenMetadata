package org.openmetadata.service.alerting;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

/**
 * The bounds on what an alert may hold and what one request may ask for, kept in one place
 * (ADR:2026-10-26-alerting-bounds-the-work-of-each-request-and-tick). A stored alert's bounds are
 * checked here, on every save, because PUT sends the create schema for alerts already stored past
 * them; the schemas of requests that are never stored carry their bound, which a test keeps equal
 * to these.
 */
public final class AlertLimits {

  /** The most rows one alert event listing answers, the same bound as the change event list. */
  public static final int MAX_LISTING_ROWS = 1000;

  public static final String MAX_LISTING_ROWS_MESSAGE =
      "must be less than or equal to " + MAX_LISTING_ROWS;

  /** The fewest and the most change events an alert may ask to read at a time. */
  public static final int MIN_BATCH_SIZE = 1;

  public static final int MAX_BATCH_SIZE = 1000;

  /** The most destinations one alert, or one test send, may hold. */
  public static final int MAX_DESTINATIONS = 50;

  /** The most receivers a user may type into one email or webhook destination. */
  public static final int MAX_RECEIVERS_PER_DESTINATION = 100;

  private AlertLimits() {}

  /**
   * Refuses a save that grows an alert past a bound. An alert already stored past one stays
   * editable, so an upgrade never locks an existing alert; it only cannot grow further.
   */
  public static void requireWithin(EventSubscription original, EventSubscription updated) {
    requireNoGrowthPast(
        "destinations", destinationsOf(original), destinationsOf(updated), MAX_DESTINATIONS);
    requireNoGrowthPast("batchSize", batchSizeOf(original), batchSizeOf(updated), MAX_BATCH_SIZE);
    requireBatchSizeOfAtLeastOne(original, updated);
    requireNoDestinationGrowsPastTheReceiverLimit(original, updated);
  }

  /** A test send is never stored, so each destination it sends to holds nothing yet. */
  static void requireTestSendWithin(List<SubscriptionDestination> destinations) {
    listOrEmpty(destinations)
        .forEach(destination -> requireReceiversWithin(0, StoredReceivers.of(destination).size()));
  }

  // Each receiver is a separate send for every event, so one destination may list only so many.
  // A destination that already held more keeps them, but cannot add one.
  private static void requireNoDestinationGrowsPastTheReceiverLimit(
      EventSubscription original, EventSubscription updated) {
    List<SubscriptionDestination> sent = listOrEmpty(updated.getDestinations());
    List<Long> held = StoredReceivers.of(original).heldBy(sent);
    for (int index = 0; index < sent.size(); index++) {
      requireReceiversWithin(held.get(index), StoredReceivers.of(sent.get(index)).size());
    }
  }

  private static void requireReceiversWithin(long held, long receivers) {
    boolean grewPastTheLimit = receivers > MAX_RECEIVERS_PER_DESTINATION && receivers > held;
    if (grewPastTheLimit) {
      throw new BadRequestException(
          String.format(
              "receivers must be less than or equal to %d, got %d. To reach more people, send to a"
                  + " team or to a mailing list instead of listing each address",
              MAX_RECEIVERS_PER_DESTINATION, receivers));
    }
  }

  // An alert that reads no event at a time never reads one again.
  private static void requireBatchSizeOfAtLeastOne(
      EventSubscription original, EventSubscription updated) {
    Integer batchSize = updated.getBatchSize();
    Integer before = original == null ? null : original.getBatchSize();
    boolean setBelowTheMinimum =
        batchSize != null && batchSize < MIN_BATCH_SIZE && !batchSize.equals(before);
    if (setBelowTheMinimum) {
      throw new BadRequestException(
          String.format(
              "batchSize must be greater than or equal to %d, got %d", MIN_BATCH_SIZE, batchSize));
    }
  }

  private static void requireNoGrowthPast(String field, long before, long after, long limit) {
    boolean grewPastTheLimit = after > limit && after > before;
    if (grewPastTheLimit) {
      throw new BadRequestException(
          String.format("%s must be less than or equal to %d, got %d", field, limit, after));
    }
  }

  private static long destinationsOf(EventSubscription alert) {
    return alert == null || alert.getDestinations() == null ? 0 : alert.getDestinations().size();
  }

  private static long batchSizeOf(EventSubscription alert) {
    return alert == null || alert.getBatchSize() == null ? 0 : alert.getBatchSize();
  }
}
