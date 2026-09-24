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

package org.openmetadata.service.events.subscription.channels.builtin;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.service.events.subscription.channels.Channels;

/** Each channel judges the configuration of a destination, knowing who configured it. */
class ConfigRulesTest {

  @Test
  void externalWebhookNeedsAConfiguration() {
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> validate(destination(SubscriptionType.WEBHOOK, SubscriptionCategory.EXTERNAL)));

    assertTrue(refused.getMessage().contains("configuration is required"));
  }

  @Test
  void externalWebhookWithAnEmptyConfigurationIsRefused() {
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () ->
                validate(
                    destination(SubscriptionType.SLACK, SubscriptionCategory.EXTERNAL)
                        .withConfig(Map.of())));

    assertTrue(refused.getMessage().contains("configuration is empty"));
  }

  @Test
  void internalWebhookNeedsNoConfiguration() {
    assertDoesNotThrow(
        () -> validate(destination(SubscriptionType.SLACK, SubscriptionCategory.OWNERS)));
  }

  // The API can write an endpoint into any destination, whatever the form shows.
  @Test
  void endpointOfAnInternalWebhookIsStillChecked() {
    SubscriptionDestination owners =
        destination(SubscriptionType.WEBHOOK, SubscriptionCategory.OWNERS)
            .withConfig(Map.of("endpoint", "http://169.254.169.254/latest", "extra", true));

    assertThrows(BadRequestException.class, () -> validate(owners));
  }

  @Test
  void externalEmailNeedsReceivers() {
    SubscriptionDestination noReceivers =
        destination(SubscriptionType.EMAIL, SubscriptionCategory.EXTERNAL)
            .withConfig(new EmailAlertConfig().withReceivers(Set.of()));

    assertThrows(BadRequestException.class, () -> validate(noReceivers));
    assertThrows(
        BadRequestException.class,
        () -> validate(destination(SubscriptionType.EMAIL, SubscriptionCategory.EXTERNAL)));
  }

  @Test
  void internalEmailNeedsNothing() {
    assertDoesNotThrow(
        () -> validate(destination(SubscriptionType.EMAIL, SubscriptionCategory.FOLLOWERS)));
  }

  // The system alerts send to the activity feed and to governance workflows, which need nothing.
  @Test
  void sinkChannelsNeedNoConfiguration() {
    for (SubscriptionType sink :
        List.of(
            SubscriptionType.ACTIVITY_FEED, SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT)) {
      assertDoesNotThrow(() -> validate(destination(sink, SubscriptionCategory.EXTERNAL)));
    }
  }

  private static void validate(SubscriptionDestination destination) {
    Channels.required(destination).configRules().validate(destination);
  }

  private static SubscriptionDestination destination(
      SubscriptionType type, SubscriptionCategory category) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(category);
  }
}
