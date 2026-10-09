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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.events.subscription.channels.DestinationConfig;

class AlertBacklogMigrationTest {
  private static final String INTERNAL = "URL targeting private/internal network not allowed";

  // Today's outbound policy refuses a metadata address; 1.13 and 2.0 built and sent through it.
  @Test
  void anEndpointThePreviousReleaseAcceptedKeepsItsBacklog() {
    assertEquals(Optional.empty(), whyNotSent("http://100.100.100.200/hook"));
  }

  // Those releases judged the host as written, so a name that starts like an address was refused.
  @Test
  void aHostWrittenLikeAnInternalAddressWasRefusedByThePreviousRelease() {
    assertEquals(Optional.of(INTERNAL), whyNotSent("http://10.example.com/hook"));
  }

  @Test
  void anInternalAddressOrAnotherSchemeWasRefused() {
    assertEquals(Optional.of(INTERNAL), whyNotSent("http://192.168.1.10/hook"));
    assertEquals(Optional.of("URL scheme not allowed: ftp"), whyNotSent("ftp://x.io/hook"));
  }

  @Test
  void aPublicEndpointWasSent() {
    assertEquals(Optional.empty(), whyNotSent("https://hooks.example.com/hook"));
  }

  // The migration keeps its own copy of the strict read so that moving the channel classes never
  // changes its code; the copy must still refuse exactly what the strict read refuses.
  @Test
  void theFrozenReadRefusesWhatTheStrictReadRefuses() {
    List<SubscriptionDestination> emails =
        List.of(
            config(EMAIL, Map.of("receivers", List.of("a@example.com"))),
            config(EMAIL, Map.of("receivers", List.of("a@example.com"), "httpMethod", "POST")),
            config(EMAIL, Map.of("receivers", "a@example.com")),
            config(EMAIL, Map.of("receivers", Map.of("to", "a@example.com"))),
            config(EMAIL, Map.of()));
    List<SubscriptionDestination> webhooks =
        List.of(
            config(WEBHOOK, Map.of("endpoint", "https://hooks.example.com/hook")),
            config(WEBHOOK, Map.of("endpoint", "https://hooks.example.com/hook", "to", "x")),
            config(WEBHOOK, Map.of("endpoint", "not a url")),
            config(WEBHOOK, Map.of("endpoint", "https://x.io", "headers", "text")),
            config(WEBHOOK, Map.of("receivers", List.of("#general"))),
            config(WEBHOOK, Map.of()));
    Set<Optional<String>> verdicts = new HashSet<>();
    for (SubscriptionDestination email : emails) {
      Optional<String> strict =
          verdict(() -> DestinationConfig.submitted(email, EmailAlertConfig.class, "email"));
      assertEquals(
          strict,
          verdict(() -> PreviousReleaseConfigRead.read(email, EmailAlertConfig.class, "email")),
          email.getConfig().toString());
      verdicts.add(strict);
    }
    for (SubscriptionDestination webhook : webhooks) {
      Optional<String> strict =
          verdict(() -> DestinationConfig.submitted(webhook, Webhook.class, "webhook"));
      assertEquals(
          strict,
          verdict(() -> PreviousReleaseConfigRead.read(webhook, Webhook.class, "webhook")),
          webhook.getConfig().toString());
      verdicts.add(strict);
    }
    assertTrue(verdicts.contains(Optional.empty()), "some fixtures are accepted");
    assertTrue(verdicts.size() > 2, "several fixtures are refused, each for its own reason");
  }

  private static Optional<String> verdict(Supplier<?> read) {
    Optional<String> refused = Optional.empty();
    try {
      read.get();
    } catch (RuntimeException e) {
      refused = Optional.of(String.valueOf(e.getMessage()));
    }
    return refused;
  }

  private static SubscriptionDestination config(
      SubscriptionDestination.SubscriptionType type, Map<String, Object> config) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(EXTERNAL)
        .withEnabled(true)
        .withConfig(config);
  }

  private static Optional<String> whyNotSent(String endpoint) {
    SubscriptionDestination webhook =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(WEBHOOK)
            .withCategory(EXTERNAL)
            .withEnabled(true)
            .withConfig(Map.of("endpoint", endpoint));
    return AlertBacklogMigration.whyThePreviousReleaseCouldNotSend(
        new EventSubscription().withEnabled(true).withDestinations(List.of(webhook)));
  }
}
