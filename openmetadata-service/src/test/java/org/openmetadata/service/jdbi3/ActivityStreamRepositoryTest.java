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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

class ActivityStreamRepositoryTest {

  private SimpleMeterRegistry meterRegistry;

  @BeforeEach
  void registerMeters() {
    meterRegistry = new SimpleMeterRegistry();
    Metrics.addRegistry(meterRegistry);
  }

  @AfterEach
  void unregisterMeters() {
    Metrics.removeRegistry(meterRegistry);
    meterRegistry.close();
  }

  @Test
  void buildActorReferenceCountsSystemEventWhenUserNameMissing() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    ChangeEvent changeEvent = changeEventWith(/* userName */ null);
    EntityInterface entity = tableEntity();

    repository.createFromChangeEvent(changeEvent, entity);

    Counter counter =
        meterRegistry
            .find("activity_stream.unresolved_actor")
            .tag("kind", "system_event")
            .counter();
    assertEquals(1.0, counter.count());
  }

  @Test
  void buildActorReferenceCountsHardDeletedWhenUserNotFound() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    ChangeEvent changeEvent = changeEventWith("ghost-user");
    EntityInterface entity = tableEntity();

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "ghost-user", Include.ALL))
          .thenThrow(new EntityNotFoundException("ghost"));

      repository.createFromChangeEvent(changeEvent, entity);
    }

    Counter counter =
        meterRegistry
            .find("activity_stream.unresolved_actor")
            .tag("kind", "hard_deleted")
            .counter();
    assertEquals(1.0, counter.count());
  }

  private static ChangeEvent changeEventWith(String userName) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_CREATED)
        .withEntityType(Entity.TABLE)
        .withEntityId(UUID.randomUUID())
        .withTimestamp(System.currentTimeMillis())
        .withUserName(userName);
  }

  private static EntityInterface tableEntity() {
    return new Table().withId(UUID.randomUUID()).withFullyQualifiedName("svc.db.schema.table");
  }

  @Test
  void insertBindsNullActorIdWhenActorIsAbsent() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    ActivityEvent event =
        baseEvent()
            // actor omitted entirely — null
            .withActor(null);

    assertDoesNotThrow(() -> repository.insert(event));

    CollectionDAO.ActivityStreamRow row = captureSingleRow(dao);
    assertEquals(event.getId().toString(), row.id());
    assertEquals(ActivityEventType.ENTITY_CREATED.value(), row.eventType());
    assertNull(row.actorId());
    assertNull(row.actorName());
  }

  @Test
  void insertBindsNullActorIdButPreservesActorNameWhenIdMissing() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    // Hard-deleted-user shape: actor reference carries the userName but no id.
    ActivityEvent event =
        baseEvent().withActor(new EntityReference().withType(Entity.USER).withName("ghost-user"));

    assertDoesNotThrow(() -> repository.insert(event));

    CollectionDAO.ActivityStreamRow row = captureSingleRow(dao);
    assertNull(row.actorId());
    assertEquals("ghost-user", row.actorName());
  }

  @Test
  void insertDelegatesToSingleElementBatch() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    repository.insert(baseEvent());

    assertEquals(1, captureRows(dao).size());
  }

  @Test
  void insertBatchSkipsNullsAndNoOpsOnEmpty() {
    CollectionDAO.ActivityStreamDAO dao = mock(CollectionDAO.ActivityStreamDAO.class);
    ActivityStreamRepository repository = new ActivityStreamRepository(dao);

    repository.insertBatch(Arrays.asList(baseEvent(), null, baseEvent()));
    assertEquals(2, captureRows(dao).size());

    repository.insertBatch(List.of());
    repository.insertBatch(null);
    // empty/null are no-ops
    verify(dao, times(1)).insertBatch(any());
  }

  private static CollectionDAO.ActivityStreamRow captureSingleRow(
      CollectionDAO.ActivityStreamDAO dao) {
    List<CollectionDAO.ActivityStreamRow> rows = captureRows(dao);
    assertEquals(1, rows.size());
    return rows.get(0);
  }

  @SuppressWarnings("unchecked")
  private static List<CollectionDAO.ActivityStreamRow> captureRows(
      CollectionDAO.ActivityStreamDAO dao) {
    ArgumentCaptor<List<CollectionDAO.ActivityStreamRow>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(dao).insertBatch(captor.capture());
    return captor.getValue();
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
