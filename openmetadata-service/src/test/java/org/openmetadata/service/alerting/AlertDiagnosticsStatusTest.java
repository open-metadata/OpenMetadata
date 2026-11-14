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
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import org.openmetadata.service.alerting.channel.DestinationFingerprint;
import org.openmetadata.service.alerting.channel.DestinationSecrets;
import org.openmetadata.service.alerting.channel.DestinationStatuses;
import org.openmetadata.service.events.consumer.ledger.AlertRecord;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.BoundCiphertext;
import org.openmetadata.service.secrets.SecretOwner;

/** A destination's status says, before any event reaches it, that its configuration is unusable. */
class AlertDiagnosticsStatusTest {
  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String SIGNING_KEY = "/authType/secretKey";
  private static final String URL_REFUSED =
      "Not attempted: its stored configuration is not usable: URL scheme not allowed";

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

  @Test
  void anUnusableStatusFoundWhenReadCarriesNoFailureTime() {
    SubscriptionDestination writtenElsewhere =
        signedWith(BoundCiphertext.encrypt(anotherDestination(), SIGNING_KEY, "a key"));

    SubscriptionStatus read =
        statusOf(AlertDiagnostics.destinationsWithStatus(alertWith(writtenElsewhere)).getFirst());

    assertTrue(read.getConfigurationUnusable());
    assertNull(read.getLastFailedAt(), "nothing failed when it was read");
    assertNotNull(read.getTimestamp());
  }

  // A tick found a destination's configuration unusable for a reason a read cannot see. Saving
  // the alert without changing that destination leaves the verdict standing.
  @Test
  void anUnusableStatusSpeaksThroughASaveThatLeavesTheDestinationAsItWas() {
    SubscriptionDestination refused = stored(signedWith("a key"));
    SubscriptionDestination other = stored(signedWith("another key"));
    EventSubscription alert = alertWith(refused, other).withUpdatedAt(1L);
    foundUnusableByTheTick(alert, refused);

    EventSubscription renamed = alert.withDescription("renamed").withUpdatedAt(3L);
    SubscriptionStatus afterTheRename = statusOf(destinationsWithStatus(renamed).getFirst());
    EventSubscription otherEdited =
        alertWith(refused, stored(signedWith("a third key")).withId(other.getId()))
            .withId(alert.getId())
            .withUpdatedAt(4L);
    SubscriptionStatus afterTheOtherEdit = statusOf(destinationsWithStatus(otherEdited).getFirst());

    assertFoundUnusableByTheTick(afterTheRename);
    assertFoundUnusableByTheTick(afterTheOtherEdit);
  }

  @Test
  void aSecretEnteredAgainEndsTheStatusTheTickStored() {
    SubscriptionDestination refused = stored(signedWith("a key"));
    EventSubscription alert = alertWith(refused);
    foundUnusableByTheTick(alert, refused);

    SubscriptionDestination enteredAgain = stored(signedWith("a key").withId(refused.getId()));
    SubscriptionStatus read =
        statusOf(destinationsWithStatus(alertWith(enteredAgain).withId(alert.getId())).getFirst());

    assertEquals(SubscriptionStatus.Status.ACTIVE, read.getStatus());
    assertNull(read.getLastFailedReason());
  }

  @Test
  void anotherEndpointEndsTheStatusTheTickStored() {
    SubscriptionDestination refused = stored(signedWith("a key"));
    EventSubscription alert = alertWith(refused);
    foundUnusableByTheTick(alert, refused);

    SubscriptionDestination moved = JsonUtils.deepCopy(refused, SubscriptionDestination.class);
    Map<String, Object> config = new HashMap<>(JsonUtils.getMap(moved.getConfig()));
    config.put("endpoint", "https://hooks.example.com/moved");
    SubscriptionStatus read =
        statusOf(
            destinationsWithStatus(alertWith(moved.withConfig(config)).withId(alert.getId()))
                .getFirst());

    assertEquals(SubscriptionStatus.Status.ACTIVE, read.getStatus());
  }

  // Entered again, but written for another destination: the read finds it before the stored one.
  @Test
  void aSecretEnteredAgainThatStillDoesNotOpenReadsFailed() {
    SubscriptionDestination refused = stored(signedWith("a key"));
    EventSubscription alert = alertWith(refused);
    foundUnusableByTheTick(alert, refused);

    SubscriptionDestination stillUnusable =
        signedWith(BoundCiphertext.encrypt(anotherDestination(), SIGNING_KEY, "a key"))
            .withId(refused.getId());
    SubscriptionStatus read =
        statusOf(destinationsWithStatus(alertWith(stillUnusable).withId(alert.getId())).getFirst());

    assertEquals(SubscriptionStatus.Status.FAILED, read.getStatus());
    assertTrue(read.getConfigurationUnusable());
    assertTrue(read.getLastFailedReason().contains("must be entered again"));
  }

  // Stored before tick verdicts named their settings: it speaks until the next tick.
  @Test
  void anUnusableStatusStoredWithoutAFingerprintSpeaksUntilTheNextTick() {
    SubscriptionDestination refused = stored(signedWith("a key"));
    EventSubscription alert = alertWith(refused);
    health.put(
        alert.getId(),
        Map.of(refused.getId().toString(), new DestinationHealth().withStatus(foundByTheTick())));

    SubscriptionDestination enteredAgain = stored(signedWith("a key").withId(refused.getId()));
    SubscriptionStatus read =
        statusOf(destinationsWithStatus(alertWith(enteredAgain).withId(alert.getId())).getFirst());

    assertFoundUnusableByTheTick(read);
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

  private void foundUnusableByTheTick(
      EventSubscription alert, SubscriptionDestination destination) {
    health.put(
        alert.getId(),
        Map.of(
            destination.getId().toString(),
            new DestinationHealth()
                .withStatus(foundByTheTick())
                .withConfigurationFingerprint(DestinationFingerprint.of(destination))));
  }

  private static SubscriptionStatus foundByTheTick() {
    return DestinationStatuses.configurationUnusable(URL_REFUSED, 2L);
  }

  private static void assertFoundUnusableByTheTick(SubscriptionStatus read) {
    assertEquals(SubscriptionStatus.Status.FAILED, read.getStatus());
    assertTrue(read.getConfigurationUnusable());
    assertEquals(URL_REFUSED, read.getLastFailedReason());
    assertEquals(2L, read.getLastFailedAt());
  }

  private static List<SubscriptionDestination> destinationsWithStatus(EventSubscription alert) {
    return AlertDiagnostics.destinationsWithStatus(alert);
  }

  private static SubscriptionDestination stored(SubscriptionDestination destination) {
    return DestinationSecrets.encrypt(List.of(destination)).getFirst();
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
