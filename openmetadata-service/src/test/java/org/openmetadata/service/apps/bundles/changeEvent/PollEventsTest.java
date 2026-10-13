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

package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.DIContainer;

class PollEventsTest {

  @Test
  void blankEventRowGoesToTheErrorList() {
    ChangeEvent readable =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntityType(Entity.TABLE)
            .withEventType(EventType.ENTITY_UPDATED)
            .withTimestamp(1L);
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.listWithOffset(10, 7L))
        .thenReturn(
            List.of(
                new ChangeEventRecord(8L, JsonUtils.pojoToJson(readable)),
                new ChangeEventRecord(9L, "")));
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    AlertPublisher consumer = new AlertPublisher(new DIContainer());
    consumer.eventSubscription = new EventSubscription().withId(UUID.randomUUID());
    consumer.ledger = TestLedgers.fresh();

    ResultList<ChangeEvent> polled;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      polled = consumer.pollEvents(7L, 10L);
    }

    assertEquals(
        List.of(readable.getId()), polled.getData().stream().map(ChangeEvent::getId).toList());
    assertEquals(1, polled.getErrors().size());
  }
}
