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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertDefinitionPolicy.WrittenByHand;
import org.openmetadata.service.jdbi3.EntityRepository;

/** A fresh install creates the alerts the server ships with, so every one of them must save. */
class SeedAlertsTest {

  @Test
  void everyShippedAlertPassesTheChecksOfANewAlert() throws IOException {
    List<EventSubscription> shipped =
        EntityRepository.getEntitiesFromSeedData(
            Entity.EVENT_SUBSCRIPTION,
            ".*json/data/eventsubscription/.*\\.json$",
            EventSubscription.class);

    assertFalse(shipped.isEmpty());
    shipped.forEach(
        alert ->
            assertDoesNotThrow(() -> DestinationValidation.ofANewAlert(alert), alert.getName()));
  }

  // Their rules are the system's own, and no save may compile them away.
  @Test
  void everyShippedAlertKeepsTheRulesItShipsWith() throws IOException {
    for (EventSubscription alert :
        EntityRepository.getEntitiesFromSeedData(
            Entity.EVENT_SUBSCRIPTION,
            ".*json/data/eventsubscription/.*\\.json$",
            EventSubscription.class)) {
      AlertDefinitionPolicy policy = AlertDefinitionPolicy.ofNew(alert);
      assertInstanceOf(WrittenByHand.class, policy, alert.getName());
      assertDoesNotThrow(() -> policy.prepareNew(alert), alert.getName());
    }
  }
}
