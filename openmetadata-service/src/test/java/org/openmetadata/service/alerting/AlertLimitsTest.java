package org.openmetadata.service.alerting;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;

/** Every save is held within the bounds, and an alert stored past them stays editable. */
class AlertLimitsTest {

  private static final int ORDINARY_BATCH = 100;
  private static final int LIMIT = AlertLimits.MAX_RECEIVERS_PER_DESTINATION;
  private static final int PAST_THE_LIMIT = LIMIT + 50;
  private static final String MAIN = "main";
  private static final String MOVED = "moved";
  private static final String COPY = "copy";

  @Test
  void anAlertMayGrowUpToEachLimit() {
    EventSubscription atTheLimits =
        alert(destinations(AlertLimits.MAX_DESTINATIONS), AlertLimits.MAX_BATCH_SIZE);

    assertDoesNotThrow(() -> AlertLimits.requireWithin(null, atTheLimits));
  }

  @Test
  void aSaveThatGrowsPastALimitIsRefused() {
    EventSubscription stored = alert(destinations(1), ORDINARY_BATCH);

    assertThrows(
        BadRequestException.class,
        () ->
            AlertLimits.requireWithin(
                stored, alert(destinations(AlertLimits.MAX_DESTINATIONS + 1), ORDINARY_BATCH)));
    assertThrows(
        BadRequestException.class,
        () ->
            AlertLimits.requireWithin(
                stored, alert(destinations(1), AlertLimits.MAX_BATCH_SIZE + 1)));
  }

  @Test
  void aBatchSizeBelowOneIsRefused() {
    EventSubscription stored = alert(destinations(1), ORDINARY_BATCH);

    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(null, alert(destinations(1), 0)));
    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(stored, alert(destinations(1), 0)));
  }

  @Test
  void anAlertStoredPastTheLimitsCanStillBeEdited() {
    EventSubscription stored =
        alert(destinations(AlertLimits.MAX_DESTINATIONS + 10), AlertLimits.MAX_BATCH_SIZE + 500);
    EventSubscription described =
        alert(stored.getDestinations(), stored.getBatchSize()).withDescription("edited");

    assertDoesNotThrow(() -> AlertLimits.requireWithin(stored, described));
  }

  @Test
  void aNewDestinationOrATestSendTakesUpToTheReceiverLimit() {
    EventSubscription atTheLimit =
        alert(List.of(webhookTo(UUID.randomUUID(), receivers(LIMIT), MAIN)), ORDINARY_BATCH);
    EventSubscription pastIt =
        alert(List.of(webhookTo(UUID.randomUUID(), receivers(LIMIT + 1), MAIN)), ORDINARY_BATCH);

    assertDoesNotThrow(() -> AlertLimits.requireWithin(null, atTheLimit));
    BadRequestException refused =
        assertThrows(BadRequestException.class, () -> AlertLimits.requireWithin(null, pastIt));
    assertTrue(refused.getMessage().contains(String.valueOf(LIMIT)), refused.getMessage());
    assertDoesNotThrow(() -> AlertLimits.requireTestSendWithin(atTheLimit.getDestinations()));
    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireTestSendWithin(pastIt.getDestinations()));
  }

  // An alert saved before the limit existed keeps its receivers through edits of the destination,
  // including a PUT, which gives every destination it sends a new id.
  @Test
  void aDestinationStoredPastTheReceiverLimitCanStillBeEdited() {
    Set<String> stored = receivers(PAST_THE_LIMIT);
    UUID id = UUID.randomUUID();
    EventSubscription alert = alert(List.of(webhookTo(id, stored, MAIN)), ORDINARY_BATCH);
    Set<String> oneFewer = new HashSet<>(stored);
    oneFewer.remove(stored.iterator().next());

    assertDoesNotThrow(() -> sendAgain(alert, webhookTo(id, stored, MOVED)));
    assertDoesNotThrow(() -> sendAgain(alert, webhookTo(id, oneFewer, MAIN)));
    assertDoesNotThrow(() -> sendAgain(alert, webhookTo(UUID.randomUUID(), stored, MOVED)));
  }

  @Test
  void aDestinationCannotGrowPastTheReceiverLimit() {
    UUID id = UUID.randomUUID();
    EventSubscription alert =
        alert(List.of(webhookTo(id, receivers(PAST_THE_LIMIT), MAIN)), ORDINARY_BATCH);

    assertThrows(
        BadRequestException.class,
        () -> sendAgain(alert, webhookTo(id, receivers(PAST_THE_LIMIT + 1), MAIN)));
  }

  @Test
  void aStoredListPastTheLimitCannotBeCopiedIntoAnotherDestination() {
    Set<String> stored = receivers(PAST_THE_LIMIT);
    UUID id = UUID.randomUUID();
    SubscriptionDestination kept = webhookTo(id, stored, MAIN);
    SubscriptionDestination moved = webhookTo(id, stored, MOVED);
    SubscriptionDestination copy = webhookTo(UUID.randomUUID(), stored, COPY);
    EventSubscription alert = alert(List.of(kept), ORDINARY_BATCH);

    for (List<SubscriptionDestination> sent :
        List.of(
            List.of(kept, copy), List.of(copy, kept), List.of(moved, copy), List.of(copy, moved))) {
      assertThrows(
          BadRequestException.class,
          () -> AlertLimits.requireWithin(alert, alert(sent, ORDINARY_BATCH)),
          "a copy was accepted");
    }
  }

  private static void sendAgain(EventSubscription stored, SubscriptionDestination destination) {
    AlertLimits.requireWithin(stored, alert(List.of(destination), ORDINARY_BATCH));
  }

  private static Set<String> receivers(int count) {
    return IntStream.range(0, count)
        .mapToObj(index -> "https://hooks.example.com/receiver/" + index)
        .collect(Collectors.toSet());
  }

  private static SubscriptionDestination webhookTo(
      UUID id, Set<String> receivers, String endpoint) {
    return new SubscriptionDestination()
        .withId(id)
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(
            new Webhook()
                .withEndpoint(URI.create("https://hooks.example.com/" + endpoint))
                .withReceivers(receivers));
  }

  private static EventSubscription alert(List<SubscriptionDestination> destinations, int batch) {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("an-alert")
        .withBatchSize(batch)
        .withDestinations(destinations);
  }

  private static List<SubscriptionDestination> destinations(int count) {
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                new SubscriptionDestination()
                    .withId(UUID.randomUUID())
                    .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                    .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                    .withConfig(
                        new Webhook()
                            .withEndpoint(URI.create("https://hooks.example.com/" + index))))
        .toList();
  }
}
