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

package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;

class DestinationValidationTest {
  private static final String USABLE = "https://hooks.example.com/ok";
  private static final String NOT_A_WEBHOOK = "ftp://saved-long-ago.example.com";

  @Test
  void everyDestinationOfANewAlertIsChecked() {
    EventSubscription alert = alertWith(webhook(USABLE), webhook(NOT_A_WEBHOOK));

    BadRequestException refused =
        assertThrows(BadRequestException.class, () -> DestinationValidation.ofANewAlert(alert));

    assertTrue(refused.getMessage().contains("Invalid webhook endpoint URL"));
  }

  @Test
  void unchangedDestinationIsNotCheckedAgain() {
    EventSubscription stored = alertWith(webhook(NOT_A_WEBHOOK));
    EventSubscription renamed = copyOf(stored).withDisplayName("Renamed");

    assertDoesNotThrow(() -> DestinationValidation.ofWhatChanged(stored, renamed));
  }

  // A PUT carries no ids, so each of its destinations gets a new one.
  @Test
  void aNewIdAloneDoesNotMakeADestinationNew() {
    EventSubscription stored = alertWith(webhook(NOT_A_WEBHOOK));
    EventSubscription put = copyOf(stored);
    put.getDestinations().getFirst().withId(UUID.randomUUID());

    assertDoesNotThrow(() -> DestinationValidation.ofWhatChanged(stored, put));
  }

  @Test
  void changedAndAddedDestinationsAreChecked() {
    EventSubscription stored = alertWith(webhook(USABLE));
    EventSubscription changed = alertWith(webhook(NOT_A_WEBHOOK));
    EventSubscription added = alertWith(webhook(USABLE), webhook(NOT_A_WEBHOOK));

    assertThrows(
        BadRequestException.class, () -> DestinationValidation.ofWhatChanged(stored, changed));
    assertThrows(
        BadRequestException.class, () -> DestinationValidation.ofWhatChanged(stored, added));
  }

  @Test
  void destinationTheUserDoesNotConfigureNeedsNoConfiguration() {
    SubscriptionDestination owners =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionType.EMAIL)
            .withCategory(SubscriptionCategory.OWNERS);

    assertDoesNotThrow(() -> DestinationValidation.ofANewAlert(alertWith(owners)));
  }

  @Test
  void endpointWrittenIntoADestinationTheUserDoesNotConfigureIsChecked() {
    SubscriptionDestination owners =
        webhook("http://169.254.169.254/latest").withCategory(SubscriptionCategory.OWNERS);

    assertThrows(
        BadRequestException.class, () -> DestinationValidation.ofANewAlert(alertWith(owners)));
  }

  // What the server ships for the activity feed and for governance workflows.
  @Test
  void systemDestinationNeedsNoConfiguration() {
    SubscriptionDestination activityFeed =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionType.ACTIVITY_FEED)
            .withCategory(SubscriptionCategory.EXTERNAL);

    assertDoesNotThrow(() -> DestinationValidation.ofANewAlert(alertWith(activityFeed)));
  }

  @Test
  void externalDestinationNeedsAConfiguration() {
    SubscriptionDestination empty = webhook(USABLE).withConfig(null);

    BadRequestException refused =
        assertThrows(
            BadRequestException.class, () -> DestinationValidation.ofANewAlert(alertWith(empty)));

    assertTrue(refused.getMessage().contains("configuration is required"));
  }

  @Test
  void registeredChannelIsAccepted() {
    EventSubscription without = alertWith(webhook(USABLE));
    EventSubscription with = copyOf(without);
    with.getDestinations().getFirst().withChannel("Webhook");

    assertDoesNotThrow(() -> DestinationValidation.ofANewAlert(with));
    assertDoesNotThrow(() -> DestinationValidation.ofWhatChanged(without, with));
  }

  @Test
  void unregisteredChannelIsRefusedNamingIt() {
    EventSubscription without = alertWith(webhook(USABLE));
    EventSubscription with = copyOf(without);
    with.getDestinations().getFirst().withChannel("not.registered.here");

    BadRequestException refused =
        assertThrows(BadRequestException.class, () -> DestinationValidation.ofANewAlert(with));
    assertTrue(refused.getMessage().contains("not.registered.here"));
    assertThrows(
        BadRequestException.class, () -> DestinationValidation.ofWhatChanged(without, with));
  }

  // A channel may leave the server, for example with the plugin that registered it.
  @Test
  void alertWhoseChannelIsNoLongerRegisteredCanStillBeRenamed() {
    EventSubscription stored = alertWith(webhook(USABLE).withChannel("not.registered.here"));
    EventSubscription renamed = copyOf(stored).withDisplayName("Renamed");

    assertDoesNotThrow(() -> DestinationValidation.ofWhatChanged(stored, renamed));
  }

  private static EventSubscription alertWith(SubscriptionDestination... destinations) {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("an-alert")
        .withDestinations(List.of(destinations));
  }

  private static EventSubscription copyOf(EventSubscription alert) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(alert), EventSubscription.class);
  }

  private static SubscriptionDestination webhook(String endpoint) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionCategory.EXTERNAL)
        .withConfig(new Webhook().withEndpoint(URI.create(endpoint)));
  }
}
