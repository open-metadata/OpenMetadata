/*
 *  Copyright 2024 Collate
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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class ActivityStreamRepositoryTest {

  @Test
  void insertBindsNullActorIdWhenActorIsAbsent() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    ActivityEvent event =
        baseEvent()
            // actor omitted entirely — null
            .withActor(null);

    assertDoesNotThrow(() -> repository.insert(event));

    verify(dao)
        .insert(
            eq(event.getId().toString()),
            eq(ActivityEventType.ENTITY_CREATED.value()),
            any(),
            any(),
            any(),
            any(),
            any(),
            isNull(), // actorId
            isNull(), // actorName
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any());
  }

  @Test
  void insertBindsNullActorIdButPreservesActorNameWhenIdMissing() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    // Hard-deleted-user shape: actor reference carries the userName but no id.
    ActivityEvent event =
        baseEvent().withActor(new EntityReference().withType(Entity.USER).withName("ghost-user"));

    assertDoesNotThrow(() -> repository.insert(event));

    verify(dao)
        .insert(
            eq(event.getId().toString()),
            eq(ActivityEventType.ENTITY_CREATED.value()),
            any(),
            any(),
            any(),
            any(),
            any(),
            isNull(), // actorId
            eq("ghost-user"), // actorName preserved
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any());
  }

  private ActivityEvent baseEvent() {
    EntityReference entityRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE)
            .withFullyQualifiedName("svc.db.schema.table");
    return new ActivityEvent()
        .withId(UUID.randomUUID())
        .withEventType(ActivityEventType.ENTITY_CREATED)
        .withEntity(entityRef)
        .withTimestamp(System.currentTimeMillis());
  }
}
