/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.alerting.channel.Delivery;
import org.openmetadata.service.alerting.channel.Destination;

class TickChannelsTest {
  private static final ChangeEvent EVENT = new ChangeEvent().withId(UUID.randomUUID());
  private static final EventSubscription ALERT = new EventSubscription().withName("alert");
  private final TickHealth health = new TickHealth();

  @Test
  void unregisteredNamedChannelIsNotAttempted() {
    Destination<ChangeEvent> unserved =
        AlertFactory.getAlert(ALERT, emailDestination().withChannel("not.registered.here"));

    Delivery delivery = deliverThrough(List.of(unserved));

    assertEquals(0, delivery.delivered(), "not attempted is not delivered");
    assertFailedUntried(
        delivery, unserved, "The channel not.registered.here is not registered on this server");
    SubscriptionStatus status = statusOf(unserved);
    assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
    assertEquals(
        "Not attempted: The channel not.registered.here is not registered on this server",
        status.getLastFailedReason());
  }

  // A configuration saved under older rules must cost this destination only, never the tick.
  @Test
  void destinationWhoseStoredConfigurationIsUnusableIsNotAttempted() {
    SubscriptionDestination savedLongAgo =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withEnabled(true)
            .withConfig(new Webhook().withEndpoint(URI.create("ftp://saved-long-ago.example.com")));
    Destination<ChangeEvent> unusable = AlertFactory.getAlert(ALERT, savedLongAgo);

    Delivery delivery = deliverThrough(List.of(unusable));

    assertEquals(0, delivery.delivered());
    assertFailedUntried(delivery, unusable, "its stored configuration is not usable");
    assertTrue(
        statusOf(unusable)
            .getLastFailedReason()
            .startsWith("Not attempted: its stored configuration is not usable"));
  }

  // Before, the first destination of a channel answered for all of them: an unusable one first
  // silenced the rest, and one further down was sent through as if it were usable. Now the usable
  // one is sent, and the unusable one fails the event for itself.
  @Test
  void anUnusableDestinationCostsOnlyItself() throws Exception {
    for (boolean unusableFirst : List.of(true, false)) {
      Destination<ChangeEvent> unusable =
          AlertFactory.getAlert(
              ALERT,
              webhookDestination().withConfig(Map.of("endpoint", "https://hooks example.com")));
      Destination<ChangeEvent> usable = publisherOf(webhookDestination());

      Delivery delivery =
          deliverThrough(unusableFirst ? List.of(unusable, usable) : List.of(usable, unusable));

      verify(usable).sendTo(any(), any());
      assertEquals(1, delivery.delivered(), "the usable one delivered");
      assertFailedUntried(delivery, unusable, "its stored configuration is not usable");
      assertEquals(SubscriptionStatus.Status.ACTIVE, statusOf(usable).getStatus());
      assertTrue(
          statusOf(unusable)
              .getLastFailedReason()
              .startsWith("Not attempted: its stored configuration is not usable"),
          statusOf(unusable).getLastFailedReason());
    }
  }

  // A channel that throws before its sends are done fails each of its destinations.
  @Test
  void aChannelWhosePreparationThrowsFailsEachOfItsDestinations() throws Exception {
    Destination<ChangeEvent> first = publisherOf(webhookDestination());
    Destination<ChangeEvent> second = publisherOf(webhookDestination());
    when(first.prepare(any(), any()))
        .thenThrow(new IllegalStateException("template helper blew up"));

    Delivery delivery = deliverThrough(List.of(first, second));

    assertEquals(0, delivery.delivered());
    assertEquals(1, delivery.failures().size(), "one channel, one failure");
    for (Destination<ChangeEvent> destination : List.of(first, second)) {
      SubscriptionStatus status = statusOf(destination);
      assertEquals(SubscriptionStatus.Status.FAILED, status.getStatus());
      assertTrue(
          status.getLastFailedReason().contains("template helper blew up"),
          status.getLastFailedReason());
    }
  }

  private static void assertFailedUntried(
      Delivery delivery, Destination<ChangeEvent> untried, String why) {
    assertEquals(1, delivery.failures().size(), "nothing went out through it, so it failed");
    Delivery.Failure failure = delivery.failures().getFirst();
    assertEquals(untried.getSubscriptionDestination().getId(), failure.destinationId());
    assertTrue(failure.reason().contains("Not attempted: " + why), failure.reason());
  }

  private Delivery deliverThrough(List<Destination<ChangeEvent>> destinations) {
    Map<UUID, Destination<ChangeEvent>> byId = new LinkedHashMap<>();
    destinations.forEach(
        destination -> byId.put(destination.getSubscriptionDestination().getId(), destination));
    return new TickChannels(ALERT, byId, health).deliver(EVENT);
  }

  private SubscriptionStatus statusOf(Destination<ChangeEvent> destination) {
    Map<UUID, SubscriptionStatus> reported = new HashMap<>();
    health.reportTo((destinationId, outcome) -> reported.put(destinationId, outcome.status()));
    return reported.get(destination.getSubscriptionDestination().getId());
  }

  private static SubscriptionDestination emailDestination() {
    return new SubscriptionDestination()
        .withType(SubscriptionDestination.SubscriptionType.EMAIL)
        .withId(UUID.randomUUID())
        .withEnabled(true);
  }

  private static SubscriptionDestination webhookDestination() {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withEnabled(true);
  }

  // Its own target, so nobody is looked up.
  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> publisherOf(SubscriptionDestination destination) {
    Destination<ChangeEvent> publisher = mock(Destination.class);
    when(publisher.getSubscriptionDestination()).thenReturn(destination);
    when(publisher.getEnabled()).thenReturn(true);
    when(publisher.requiresRecipients()).thenReturn(false);
    return publisher;
  }
}
