package org.openmetadata.service.alerting;

import jakarta.ws.rs.BadRequestException;
import org.openmetadata.schema.entity.events.EventSubscription;

/**
 * The bounds on what an alert may hold and what one request may ask for, kept in one place. The
 * request schemas carry the same numbers, which a test keeps equal to these.
 */
public final class AlertLimits {

  /** The most change events an alert may ask to read at a time. */
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
