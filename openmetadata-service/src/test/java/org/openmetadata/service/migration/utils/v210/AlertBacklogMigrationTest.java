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
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

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
