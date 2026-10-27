package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;

/** Every save is held within the bounds, and an alert stored past them stays editable. */
class AlertLimitsTest {

  @Test
  void anAlertMayGrowUpToEachLimit() {
    EventSubscription atTheLimits =
        alert(destinations(AlertLimits.MAX_DESTINATIONS), AlertLimits.MAX_BATCH_SIZE);

    assertDoesNotThrow(() -> AlertLimits.requireWithin(null, atTheLimits));
  }

  @Test
  void aSaveThatGrowsPastALimitIsRefused() {
    EventSubscription stored = alert(destinations(1), 100);

    assertThrows(
        BadRequestException.class,
        () ->
            AlertLimits.requireWithin(
                stored, alert(destinations(AlertLimits.MAX_DESTINATIONS + 1), 100)));
    assertThrows(
        BadRequestException.class,
        () ->
            AlertLimits.requireWithin(
                stored, alert(destinations(1), AlertLimits.MAX_BATCH_SIZE + 1)));
    assertThrows(
        BadRequestException.class,
        () ->
            AlertLimits.requireWithin(
                stored,
                alert(List.of(emailTo(AlertLimits.MAX_RECEIVERS_PER_DESTINATION + 1)), 100)));
    assertThrows(
        BadRequestException.class,
        () ->
            AlertLimits.requireWithin(
                stored,
                alert(List.of(webhookTo(AlertLimits.MAX_RECEIVERS_PER_DESTINATION + 1)), 100)));
  }

  @Test
  void aBatchSizeBelowOneIsRefused() {
    EventSubscription stored = alert(destinations(1), 100);

    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(null, alert(destinations(1), 0)));
    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(stored, alert(destinations(1), 0)));
  }

  // One destination already past the limit does not let another grow past it.
  @Test
  void eachDestinationIsHeldToTheReceiverLimitOnItsOwn() {
    int pastTheLimit = AlertLimits.MAX_RECEIVERS_PER_DESTINATION * 2;
    SubscriptionDestination large = webhookTo(pastTheLimit);
    SubscriptionDestination small = webhookTo(10);
    EventSubscription stored = alert(List.of(large, small), 100);
    SubscriptionDestination grown = webhookTo(pastTheLimit).withId(small.getId());

    assertDoesNotThrow(() -> AlertLimits.requireWithin(stored, alert(List.of(large, small), 100)));
    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(stored, alert(List.of(large, grown), 100)));
    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(stored, alert(List.of(grown, large), 100)));
  }

  // A PUT carries no ids, so each destination it sends gets a new one.
  @Test
  void aStoredListPastTheLimitSentAgainUnderANewIdIsKept() {
    SubscriptionDestination large = webhookTo(AlertLimits.MAX_RECEIVERS_PER_DESTINATION * 2);
    EventSubscription stored = alert(List.of(large), 100);
    SubscriptionDestination resent =
        webhookTo(AlertLimits.MAX_RECEIVERS_PER_DESTINATION * 2).withId(UUID.randomUUID());

    assertDoesNotThrow(() -> AlertLimits.requireWithin(stored, alert(List.of(resent), 100)));
  }

  @Test
  void aStoredListPastTheLimitCannotBeCopiedIntoAnotherDestination() {
    int pastTheLimit = AlertLimits.MAX_RECEIVERS_PER_DESTINATION * 2;
    EventSubscription stored = alert(List.of(webhookTo(pastTheLimit), webhookTo(10)), 100);
    SubscriptionDestination first = webhookTo(pastTheLimit).withId(UUID.randomUUID());
    SubscriptionDestination second = webhookTo(pastTheLimit).withId(UUID.randomUUID());

    assertThrows(
        BadRequestException.class,
        () -> AlertLimits.requireWithin(stored, alert(List.of(first, second), 100)));
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
    return IntStream.range(0, count).mapToObj(index -> webhookTo(1)).toList();
  }

  private static SubscriptionDestination emailTo(int receivers) {
    Set<String> addresses =
        IntStream.range(0, receivers)
            .mapToObj(index -> "person" + index + "@example.com")
            .collect(Collectors.toSet());
    return external(SubscriptionDestination.SubscriptionType.EMAIL)
        .withConfig(new EmailAlertConfig().withReceivers(addresses));
  }

  private static SubscriptionDestination webhookTo(int receivers) {
    Set<String> addresses =
        IntStream.range(0, receivers)
            .mapToObj(index -> "https://hooks.example.com/" + index)
            .collect(Collectors.toSet());
    return external(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withConfig(
            new Webhook()
                .withEndpoint(URI.create("https://hooks.example.com/main"))
                .withReceivers(addresses));
  }

  private static SubscriptionDestination external(SubscriptionDestination.SubscriptionType type) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL);
  }
}
