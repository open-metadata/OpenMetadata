package org.openmetadata.service.alerting;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.alerting.channel.ChannelResolution;

/**
 * The bounds on what an alert may hold and what one request may ask for, kept in one place
 * (ADR:2026-10-26-alerting-bounds-the-work-of-each-request-and-tick). A stored alert's bounds are
 * checked here, on every save, because PUT sends the create schema for alerts already stored past
 * them; the schemas of requests that are never stored carry their bound, which a test keeps equal
 * to these.
 */
@Slf4j
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

  /** The most receivers, addresses or names, one destination may list. */
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

  /** A test send is never stored, so it may hold no receivers past the limit. */
  static void requireTestSendWithin(List<SubscriptionDestination> destinations) {
    requireReceiversWithin(0, destinations);
  }

  // Each receiver, typed address or name looked up, costs work on every event. The alert may hold
  // no more receivers past the limit, summed over its destinations, than it already held: so an
  // alert stored past it keeps or trims them on any save, PUT included, but cannot add one, copy
  // them into another destination, or move them to make room.
  private static void requireNoDestinationGrowsPastTheReceiverLimit(
      EventSubscription original, EventSubscription updated) {
    long held = original == null ? 0 : pastTheReceiverLimit(original.getDestinations());
    requireReceiversWithin(held, updated.getDestinations());
  }

  private static void requireReceiversWithin(
      long held, List<SubscriptionDestination> destinations) {
    boolean grewPastTheLimit = pastTheReceiverLimit(destinations) > held;
    if (grewPastTheLimit) {
      throw new BadRequestException(
          String.format(
              "receivers must be less than or equal to %d, got %d. To reach more people, send to a"
                  + " team or to a mailing list instead of listing each one",
              MAX_RECEIVERS_PER_DESTINATION, mostReceivers(destinations)));
    }
  }

  private static long pastTheReceiverLimit(List<SubscriptionDestination> destinations) {
    return listOrEmpty(destinations).stream()
        .mapToLong(
            destination -> Math.max(0, receiversOf(destination) - MAX_RECEIVERS_PER_DESTINATION))
        .sum();
  }

  private static long mostReceivers(List<SubscriptionDestination> destinations) {
    return listOrEmpty(destinations).stream().mapToLong(AlertLimits::receiversOf).max().orElse(0);
  }

  // A configuration a channel cannot read lists none here; destination validation refuses it
  // when it is new.
  private static long receiversOf(SubscriptionDestination destination) {
    long receivers = 0;
    try {
      receivers = listedBy(destination).size();
    } catch (IllegalArgumentException unreadable) {
      LOG.debug("Destination {} lists no receivers it can read", destination.getId(), unreadable);
    }
    return receivers;
  }

  private static Set<String> listedBy(SubscriptionDestination destination) {
    Set<String> receivers =
        ChannelResolution.of(destination)
            .channel()
            .map(channel -> channel.configRules().receiversOf(destination))
            .map(SubscriptionAction::getReceivers)
            .orElse(null);
    return receivers == null ? Set.of() : receivers;
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
