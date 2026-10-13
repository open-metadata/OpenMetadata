/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;

class EventSubscriptionMapperTest {

  /** A request has no place for rules, so the alert built from it carries none and a save keeps them. */
  @Test
  void aRequestLeavesRulesAbsent() {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName("alert")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"));

    EventSubscription alert = new EventSubscriptionMapper().createToEntity(request, "admin");

    assertEquals(List.of("table"), alert.getFilteringRules().getResources());
    assertNull(alert.getFilteringRules().getRules());
    assertNull(alert.getFilteringRules().getActions());
  }
}
