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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.openmetadata.service.alerting.channel.DestinationStatuses;
import org.openmetadata.service.events.consumer.ledger.AlertRecord;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.BoundCiphertext;
import org.openmetadata.service.secrets.SecretOwner;

/** A destination's status says, before any event reaches it, that its configuration is unusable. */
class AlertDiagnosticsStatusTest {
  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String SIGNING_KEY = "/authType/secretKey";

  private final Map<UUID, Map<String, DestinationHealth>> health = new HashMap<>();
  private MockedStatic<AlertRecord> records;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
    records = mockStatic(AlertRecord.class);
    records.when(() -> AlertRecord.healthOf(any())).thenReturn(health);
  }

  @AfterEach
  void tearDown() {
    records.close();
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void aDestinationWhoseSecretDoesNotOpenReadsFailedWithTheValueToEnterAgain() {
    SubscriptionDestination writtenElsewhere =
        signedWith(BoundCiphertext.encrypt(anotherDestination(), SIGNING_KEY, "a key"));
    SubscriptionDestination earlierRelease = signedWith(Fernet.getInstance().encrypt("a key"));
    SubscriptionDestination usable = signedWith("a key entered in the clear");
    SubscriptionDestination switchedOff =
        signedWith(BoundCiphertext.encrypt(anotherDestination(), SIGNING_KEY, "a key"))
            .withEnabled(false);

    List<SubscriptionDestination> read =
        AlertDiagnostics.destinationsWithStatus(
            alertWith(writtenElsewhere, earlierRelease, usable, switchedOff));

    SubscriptionStatus unusable = statusOf(read.get(0));
    assertEquals(SubscriptionStatus.Status.FAILED, unusable.getStatus());
    assertTrue(
        unusable.getLastFailedReason().contains("The value at '/authType/secretKey'"),
        unusable.getLastFailedReason());
    assertTrue(unusable.getLastFailedReason().contains("must be entered again"));
    assertTrue(unusable.getConfigurationUnusable());
    assertEquals(SubscriptionStatus.Status.FAILED, statusOf(read.get(1)).getStatus());
    assertEquals(SubscriptionStatus.Status.ACTIVE, statusOf(read.get(2)).getStatus());
    assertNull(statusOf(read.get(2)).getLastFailedReason());
    assertNull(statusOf(read.get(2)).getConfigurationUnusable());
    assertEquals(SubscriptionStatus.Status.DISABLED, statusOf(read.get(3)).getStatus());
  }

  @Test
  void aSendWaitingForARetryKeepsItsStatusAndIsNotAnUnusableConfiguration() {
    SubscriptionDestination usable = signedWith("a key entered in the clear");
    EventSubscription alert = alertWith(usable);
    SubscriptionStatus failedSend =
        new SubscriptionStatus()
            .withStatus(SubscriptionStatus.Status.AWAITING_RETRY)
            .withLastFailedReason("Webhook failed with status: 503");
    health.put(
        alert.getId(),
        Map.of(usable.getId().toString(), new DestinationHealth().withStatus(failedSend)));

    SubscriptionStatus read = statusOf(AlertDiagnostics.destinationsWithStatus(alert).getFirst());

    assertEquals(SubscriptionStatus.Status.AWAITING_RETRY, read.getStatus());
    assertEquals("Webhook failed with status: 503", read.getLastFailedReason());
    assertNull(read.getConfigurationUnusable());
  }

  // The last tick found the configuration unusable. It speaks until the alert is saved again; once
  // it is, with secrets that open, the alert reads Active before the next tick.
  @Test
  void anUnusableStatusTheLastTickStoredSpeaksUntilTheAlertIsSavedAgain() {
    SubscriptionDestination destination = signedWith("a key entered again");
    EventSubscription alert = alertWith(destination).withUpdatedAt(1L);
    SubscriptionStatus storedByTheTick =
        DestinationStatuses.configurationUnusable(
            "Not attempted: its stored configuration is not usable: URL scheme not allowed", 2L);
    health.put(
        alert.getId(),
        Map.of(
            destination.getId().toString(), new DestinationHealth().withStatus(storedByTheTick)));

    SubscriptionStatus beforeTheSave =
        statusOf(AlertDiagnostics.destinationsWithStatus(alert).getFirst());
    SubscriptionStatus afterTheSave =
        statusOf(AlertDiagnostics.destinationsWithStatus(alert.withUpdatedAt(3L)).getFirst());

    assertEquals(SubscriptionStatus.Status.FAILED, beforeTheSave.getStatus());
    assertTrue(beforeTheSave.getConfigurationUnusable());
    assertEquals(SubscriptionStatus.Status.ACTIVE, afterTheSave.getStatus());
    assertNull(afterTheSave.getLastFailedReason());
  }

  @Test
  void theHealthOfEveryListedAlertIsReadInOneGo() {
    EventSubscription first = alertWith(signedWith("a key"));
    EventSubscription second = alertWith(signedWith("another key"));

    AlertDiagnostics.setDestinationStatuses(List.of(first, second));

    records.verify(() -> AlertRecord.healthOf(List.of(first.getId(), second.getId())), times(1));
    records.verify(() -> AlertRecord.healthOf(any()), times(1));
    assertEquals(
        SubscriptionStatus.Status.ACTIVE,
        statusOf(second.getDestinations().getFirst()).getStatus());
  }

  private static SubscriptionStatus statusOf(SubscriptionDestination destination) {
    return JsonUtils.convertValue(destination.getStatusDetails(), SubscriptionStatus.class);
  }

  private static SecretOwner anotherDestination() {
    return SecretOwner.builder("alertdestination").id(UUID.randomUUID()).build();
  }

  private static EventSubscription alertWith(SubscriptionDestination... destinations) {
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("alert")
        .withEnabled(true)
        .withDestinations(List.of(destinations));
  }

  private static SubscriptionDestination signedWith(String secretKey) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionCategory.EXTERNAL)
        .withEnabled(true)
        .withConfig(
            Map.of(
                "endpoint",
                "https://hooks.example.com/signed",
                "authType",
                Map.of("type", "bearer", "secretKey", secretKey)));
  }
}
