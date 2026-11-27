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

package org.openmetadata.service.alerting;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.consumer.ledger.AlertRecord;

/** Every listed alert's destinations show their current status, read in one go. */
class AlertDiagnosticsStatusTest {
  private final Map<UUID, Map<String, DestinationHealth>> health = new HashMap<>();
  private MockedStatic<AlertRecord> records;

  @BeforeEach
  void setUp() {
    records = mockStatic(AlertRecord.class);
    records.when(() -> AlertRecord.healthOf(any())).thenReturn(health);
  }

  @AfterEach
  void tearDown() {
    records.close();
  }

  @Test
  void everyListedAlertGetsItsOwnHealthFromOneRead() {
    EventSubscription first = alertWith(destination());
    EventSubscription second = alertWith(destination());
    SubscriptionStatus failed =
        new SubscriptionStatus()
            .withStatus(SubscriptionStatus.Status.FAILED)
            .withLastFailedReason("Webhook failed with status: 500");
    health.put(
        second.getId(),
        Map.of(
            second.getDestinations().getFirst().getId().toString(),
            new DestinationHealth().withStatus(failed)));

    AlertDiagnostics.setDestinationStatuses(List.of(first, second));

    assertEquals(
        SubscriptionStatus.Status.ACTIVE, statusOf(first.getDestinations().getFirst()).getStatus());
    assertEquals(failed, statusOf(second.getDestinations().getFirst()));
    records.verify(() -> AlertRecord.healthOf(List.of(first.getId(), second.getId())), times(1));
    records.verify(() -> AlertRecord.healthOf(any()), times(1));
  }

  @Test
  void eachDestinationShowsItsOwnStatus() {
    SubscriptionDestination failing = destination();
    SubscriptionDestination neverSent = destination();
    SubscriptionDestination switchedOff = destination().withEnabled(false);
    EventSubscription alert = alertWith(failing, neverSent, switchedOff);
    SubscriptionStatus failed =
        new SubscriptionStatus()
            .withStatus(SubscriptionStatus.Status.AWAITING_RETRY)
            .withLastFailedReason("Webhook failed with status: 503");
    health.put(
        alert.getId(),
        Map.of(failing.getId().toString(), new DestinationHealth().withStatus(failed)));
    EventSubscription another = alertWith(destination());

    AlertDiagnostics.setDestinationStatuses(List.of(alert, another));

    assertEquals(failed, statusOf(failing));
    assertEquals(SubscriptionStatus.Status.ACTIVE, statusOf(neverSent).getStatus());
    assertEquals(SubscriptionStatus.Status.DISABLED, statusOf(switchedOff).getStatus());
    assertEquals(
        SubscriptionStatus.Status.ACTIVE,
        statusOf(another.getDestinations().getFirst()).getStatus());
  }

  private static SubscriptionStatus statusOf(SubscriptionDestination destination) {
    return JsonUtils.convertValue(destination.getStatusDetails(), SubscriptionStatus.class);
  }

  private static EventSubscription alertWith(SubscriptionDestination... destinations) {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("alert")
        .withEnabled(true)
        .withDestinations(List.of(destinations));
  }

  private static SubscriptionDestination destination() {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionCategory.EXTERNAL)
        .withEnabled(true)
        .withConfig(Map.of("endpoint", "https://hooks.example.com/hook"));
  }
}
