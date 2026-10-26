package org.openmetadata.service.alerting;

import jakarta.ws.rs.BadRequestException;
import org.openmetadata.schema.entity.events.EventSubscription;

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

  /** The most receivers one email or webhook destination may list. */
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
