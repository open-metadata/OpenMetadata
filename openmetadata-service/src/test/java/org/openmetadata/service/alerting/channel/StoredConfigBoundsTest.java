package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.alerting.audience.Recipient;
import org.openmetadata.service.alerting.audience.WebhookRecipient;
import org.openmetadata.service.alerting.channel.webhook.WebhookAddresses;

/** What a stored alert may hold, and that checking or sending it costs in proportion to its size. */
class StoredConfigBoundsTest {

  private static final int MANY_DESTINATIONS = 32_000;
  private static final int MANY_RECEIVERS = 2_000;

  @Test
  void checkingWhatChangedIsLinearInTheDestinations() {
    EventSubscription stored = alertWith(distinctActivityFeeds(MANY_DESTINATIONS));
    EventSubscription described =
        alertWith(stored.getDestinations()).withDescription("only the description changed");

    assertTimeoutPreemptively(
        Duration.ofSeconds(10), () -> DestinationValidation.ofWhatChanged(stored, described));
  }

  @Test
  void eachReceiverIsSentToWithoutCopyingEveryOtherReceiver() {
    Set<String> receivers =
        IntStream.range(0, MANY_RECEIVERS)
            .mapToObj(index -> "https://hooks.example.com/" + index)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    Webhook webhook = new Webhook().withReceivers(receivers);

    Set<Recipient> recipients =
        new WebhookAddresses(config -> null)
            .configured(webhook, external(SubscriptionType.WEBHOOK));

    assertEquals(MANY_RECEIVERS, recipients.size());
    for (Recipient recipient : recipients) {
      Set<String> carried = ((WebhookRecipient) recipient).getWebhook().getReceivers();
      assertTrue(carried == null || carried.isEmpty(), "a receiver's webhook carries the others");
    }
  }

  private static List<SubscriptionDestination> distinctActivityFeeds(int count) {
    return IntStream.range(0, count)
        .mapToObj(
            depth ->
                new SubscriptionDestination()
                    .withId(UUID.randomUUID())
                    .withType(SubscriptionType.ACTIVITY_FEED)
                    .withCategory(SubscriptionCategory.EXTERNAL)
                    .withDownstreamDepth(depth))
        .toList();
  }

  private static SubscriptionDestination external(SubscriptionType type) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(SubscriptionCategory.EXTERNAL);
  }

  private static EventSubscription alertWith(List<SubscriptionDestination> destinations) {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("an-alert")
        .withDestinations(destinations);
  }
}
