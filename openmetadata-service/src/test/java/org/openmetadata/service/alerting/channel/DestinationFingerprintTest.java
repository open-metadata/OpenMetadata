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

package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

class DestinationFingerprintTest {
  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String SIGNING_KEY = "a signing key";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  // Taken from the stored form: neither the secret's value nor its decrypted form is hashed.
  @Test
  void itIsTakenFromTheStoredSettingsAndNeverFromASecret() {
    SubscriptionDestination stored = stored(signed(SIGNING_KEY));
    String secretAsStored = secretKeyOf(stored);

    String fingerprint = DestinationFingerprint.of(stored);

    assertTrue(secretAsStored.startsWith(Fernet.FERNET_PREFIX), secretAsStored);
    assertEquals(64, fingerprint.length());
    assertNotEquals(DestinationFingerprint.of(signed(SIGNING_KEY)), fingerprint);
    assertNotEquals(
        DestinationFingerprint.of(DestinationSecrets.decrypted(stored)),
        fingerprint,
        "the decrypted settings read differently");
  }

  @Test
  void itsIdStatusSwitchAndEmptyValuesAreNotSettings() {
    SubscriptionDestination stored = stored(signed(SIGNING_KEY));
    SubscriptionDestination sameSettings =
        JsonUtils.deepCopy(stored, SubscriptionDestination.class);
    Map<String, Object> config = new LinkedHashMap<>(configOf(sameSettings));
    config.put("headers", Map.of());
    config.put("queryParams", null);
    sameSettings
        .withId(UUID.randomUUID())
        .withEnabled(false)
        .withStatusDetails(new SubscriptionStatus().withStatus(SubscriptionStatus.Status.FAILED))
        .withConfig(config);

    assertEquals(DestinationFingerprint.of(stored), DestinationFingerprint.of(sameSettings));
  }

  @Test
  void aSecretEncryptedAgainChangesIt() {
    SubscriptionDestination stored = stored(signed(SIGNING_KEY));
    SubscriptionDestination enteredAgain = stored(signed(SIGNING_KEY).withId(stored.getId()));

    assertNotEquals(secretKeyOf(stored), secretKeyOf(enteredAgain));
    assertNotEquals(DestinationFingerprint.of(stored), DestinationFingerprint.of(enteredAgain));
  }

  @Test
  void aSaveThatSendsTheMaskBackLeavesItAsItWas() {
    SubscriptionDestination stored = stored(signed(SIGNING_KEY));
    SubscriptionDestination sentBack = DestinationSecrets.mask(List.of(stored)).getFirst();

    DestinationSecrets.restore(
        new EventSubscription().withDestinations(List.of(stored)),
        new EventSubscription().withDestinations(List.of(sentBack)));

    assertEquals(DestinationFingerprint.of(stored), DestinationFingerprint.of(sentBack));
  }

  @Test
  void anotherEndpointChangesIt() {
    SubscriptionDestination stored = stored(signed(SIGNING_KEY));
    SubscriptionDestination moved = JsonUtils.deepCopy(stored, SubscriptionDestination.class);
    Map<String, Object> config = new LinkedHashMap<>(configOf(moved));
    config.put("endpoint", "https://hooks.example.com/moved");
    moved.withConfig(config);

    assertNotEquals(DestinationFingerprint.of(stored), DestinationFingerprint.of(moved));
  }

  private static SubscriptionDestination stored(SubscriptionDestination destination) {
    return DestinationSecrets.encrypt(List.of(destination)).getFirst();
  }

  private static SubscriptionDestination signed(String secretKey) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionCategory.EXTERNAL)
        .withEnabled(true)
        .withConfig(
            new LinkedHashMap<>(
                Map.of(
                    "endpoint",
                    "https://hooks.example.com/signed",
                    "authType",
                    Map.of("type", "bearer", "secretKey", secretKey))));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> configOf(SubscriptionDestination destination) {
    return JsonUtils.convertValue(destination.getConfig(), Map.class);
  }

  @SuppressWarnings("unchecked")
  private static String secretKeyOf(SubscriptionDestination destination) {
    return (String) ((Map<String, Object>) configOf(destination).get("authType")).get("secretKey");
  }
}
