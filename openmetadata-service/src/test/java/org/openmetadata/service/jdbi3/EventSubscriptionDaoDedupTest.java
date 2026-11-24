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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO.FailedEventRow;

class EventSubscriptionDaoDedupTest {

  @Test
  void distinctLastIndexesCollapsesDuplicateKeysKeepingLast() {
    List<String> changeEventIds = List.of("event-a", "event-a");
    List<String> subscriptionIds = List.of("sub-1", "sub-1");

    List<Integer> kept = EventSubscriptionDAO.distinctLastIndexes(changeEventIds, subscriptionIds);

    assertEquals(List.of(1), kept, "duplicate (change_event_id, subscription_id) keeps last index");
  }

  @Test
  void distinctLastIndexesKeepsAllWhenNoDuplicates() {
    List<String> changeEventIds = List.of("event-a", "event-b", "event-a");
    List<String> subscriptionIds = List.of("sub-1", "sub-1", "sub-2");

    List<Integer> kept = EventSubscriptionDAO.distinctLastIndexes(changeEventIds, subscriptionIds);

    assertEquals(List.of(0, 1, 2), kept, "distinct composite keys are all kept, in order");
  }

  @Test
  void distinctLastIndexesIsDrivenByCompositeKeyNotChangeEventAlone() {
    List<String> changeEventIds = List.of("event-a", "event-a");
    List<String> subscriptionIds = List.of("sub-1", "sub-2");

    List<Integer> kept = EventSubscriptionDAO.distinctLastIndexes(changeEventIds, subscriptionIds);

    assertEquals(
        List.of(0, 1), kept, "same change event for different subscriptions is not a duplicate");
  }

  @Test
  void pickByIndexSelectsRequestedElements() {
    List<String> source = List.of("a", "b", "c");

    assertEquals(List.of("a", "c"), EventSubscriptionDAO.pickByIndex(source, List.of(0, 2)));
    assertEquals(List.of("b"), EventSubscriptionDAO.pickByIndex(source, List.of(1)));
  }

  @Test
  void lastIndexOfEachKeyKeepsTheLastInTheOrderKeysFirstAppear() {
    assertEquals(List.of(2, 1), EventSubscriptionDAO.lastIndexOfEachKey(List.of("a", "b", "a")));
    assertEquals(List.of(), EventSubscriptionDAO.lastIndexOfEachKey(List.of()));
  }

  // Whatever the caller hands it, the batch writes one row per key: the last one.
  @Test
  void failedEventBatchWritesTheLastRowOfEachKey() {
    EventSubscriptionDAO dao = mock(EventSubscriptionDAO.class);
    doCallRealMethod().when(dao).batchUpsertFailedEvents(anyString(), anyList());

    dao.batchUpsertFailedEvents(
        "alert",
        List.of(
            new FailedEventRow("a", "first", "SUBSCRIBER"),
            new FailedEventRow("b", "other", "PUBLISHER"),
            new FailedEventRow("a", "last", "SUBSCRIBER")));

    verify(dao)
        .batchUpsertFailedEventsInternal(
            List.of("alert", "alert"),
            List.of("a", "b"),
            List.of("last", "other"),
            List.of("SUBSCRIBER", "PUBLISHER"));
  }
}
