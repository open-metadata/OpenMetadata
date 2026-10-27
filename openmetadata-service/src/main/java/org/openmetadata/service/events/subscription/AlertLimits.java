package org.openmetadata.service.events.subscription;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;

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

  private static final String RECEIVERS = "receivers";

  private AlertLimits() {}

  /**
   * Refuses a save that grows an alert past a bound, on every path that saves one. An alert
   * already stored past one stays editable, so an upgrade never locks an existing alert; it only
   * cannot grow further.
   */
  public static void requireWithin(EventSubscription original, EventSubscription updated) {
    requireNoGrowthPast(
        "destinations", destinationsOf(original), destinationsOf(updated), MAX_DESTINATIONS);
    requireNoGrowthPast("batchSize", batchSizeOf(original), batchSizeOf(updated), MAX_BATCH_SIZE);
    requireBatchSizeOfAtLeastOne(original, updated);
    requireNoDestinationGrowsPastTheReceiverLimit(original, updated);
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

  private static void requireNoGrowthPast(String field, long before, long after, long limit) {
    boolean grewPastTheLimit = after > limit && after > before;
    if (grewPastTheLimit) {
      throw new BadRequestException(
          String.format("%s must be less than or equal to %d, got %d", field, limit, after));
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

  // Each destination against what it held before; a new one held none. Each stored receiver list
  // is held once: first by the destination that keeps it, then, since a PUT carries no ids and
  // every destination of one gets a new id, by a destination under another id that sends it
  // unchanged. So re-sending an alert never makes its stored lists look new, and copying a list
  // past the limit into a second destination is still refused.
  private static void requireNoDestinationGrowsPastTheReceiverLimit(
      EventSubscription original, EventSubscription updated) {
    Map<UUID, Set<String>> byId = receiversById(original);
    Map<Set<String>, Integer> unclaimed = countOfEachList(original);
    List<SubscriptionDestination> resent = new ArrayList<>();
    for (SubscriptionDestination destination : destinations(updated)) {
      Set<String> receivers = receiversOf(destination);
      if (receivers.equals(byId.get(destination.getId()))) {
        claim(unclaimed, receivers);
      } else {
        resent.add(destination);
      }
    }
    for (SubscriptionDestination destination : resent) {
      Set<String> receivers = receiversOf(destination);
      long held =
          claim(unclaimed, receivers)
              ? receivers.size()
              : byId.getOrDefault(destination.getId(), Set.of()).size();
      requireReceiversWithin(held, receivers.size());
    }
  }

  private static boolean claim(Map<Set<String>, Integer> unclaimed, Set<String> receivers) {
    int left = unclaimed.getOrDefault(receivers, 0);
    boolean claimed = left > 0;
    if (claimed) {
      unclaimed.put(receivers, left - 1);
    }
    return claimed;
  }

  private static Map<Set<String>, Integer> countOfEachList(EventSubscription alert) {
    Map<Set<String>, Integer> counts = new HashMap<>();
    destinations(alert)
        .forEach(destination -> counts.merge(receiversOf(destination), 1, Integer::sum));
    return counts;
  }

  private static Map<UUID, Set<String>> receiversById(EventSubscription alert) {
    Map<UUID, Set<String>> byId = new HashMap<>();
    destinations(alert).stream()
        .filter(destination -> destination.getId() != null)
        .forEach(destination -> byId.put(destination.getId(), receiversOf(destination)));
    return byId;
  }

  private static long destinationsOf(EventSubscription alert) {
    return destinations(alert).size();
  }

  private static long batchSizeOf(EventSubscription alert) {
    return alert == null || alert.getBatchSize() == null ? 0 : alert.getBatchSize();
  }

  // The receivers a user typed into the destination, the only ones each send goes to as written.
  // A destination of users or teams names who to find instead, however many people that is.
  private static Set<String> receiversOf(SubscriptionDestination destination) {
    SubscriptionDestination.SubscriptionCategory category = destination.getCategory();
    boolean typedByTheUser =
        category == null || category == SubscriptionDestination.SubscriptionCategory.EXTERNAL;
    return typedByTheUser ? listedReceivers(destination) : Set.of();
  }

  private static Set<String> listedReceivers(SubscriptionDestination destination) {
    Object config = destination.getConfig();
    Object receivers =
        config == null ? null : JsonUtils.convertValue(config, Map.class).get(RECEIVERS);
    return receivers instanceof Collection<?> listed
        ? listed.stream().map(String::valueOf).collect(Collectors.toSet())
        : Set.of();
  }

  private static List<SubscriptionDestination> destinations(EventSubscription alert) {
    return alert == null || alert.getDestinations() == null ? List.of() : alert.getDestinations();
  }
}
