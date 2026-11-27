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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

class DestinationIdsTest {

  @Test
  void aNewAlertsDestinationsGetIdsOfTheirOwnWhateverWasSent() {
    UUID sent = UUID.randomUUID();
    List<SubscriptionDestination> destinations =
        List.of(destination(sent), destination(sent), destination(null));

    DestinationIds.assignNew(destinations);

    assertTrue(destinations.stream().noneMatch(it -> sent.equals(it.getId())));
    assertNotEquals(destinations.get(0).getId(), destinations.get(1).getId());
  }

  @Test
  void anUpdateKeepsOnlyTheIdsIssuedForTheAlertEachOnce() {
    UUID kept = UUID.randomUUID();
    EventSubscription stored = alert(destination(kept), destination(UUID.randomUUID()));
    EventSubscription updated =
        alert(
            destination(kept),
            destination(kept),
            destination(UUID.randomUUID()),
            destination(null));

    DestinationIds.forgetIdsNotIssuedHere(stored, updated);

    List<SubscriptionDestination> sent = updated.getDestinations();
    assertEquals(kept, sent.get(0).getId(), "a stored id names its destination");
    assertNull(sent.get(1).getId(), "a repeated one names nothing");
    assertNull(sent.get(2).getId(), "nor does one this alert never issued");
    assertNull(sent.get(3).getId());
  }

  private static SubscriptionDestination destination(UUID id) {
    return new SubscriptionDestination()
        .withId(id)
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL);
  }

  private static EventSubscription alert(SubscriptionDestination... destinations) {
    return new EventSubscription().withName("alert").withDestinations(List.of(destinations));
  }
}
