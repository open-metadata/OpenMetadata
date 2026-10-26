package org.openmetadata.service.alerting;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;

/** Every save is held within the bounds, and an alert stored past them stays editable. */
class AlertLimitsTest {

  private static final int ORDINARY_BATCH = 100;

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
