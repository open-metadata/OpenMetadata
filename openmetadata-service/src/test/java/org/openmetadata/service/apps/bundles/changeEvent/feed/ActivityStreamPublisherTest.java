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

package org.openmetadata.service.apps.bundles.changeEvent.feed;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.ActivityStreamRepository;

@ExtendWith(MockitoExtension.class)
class ActivityStreamPublisherTest {

  @Mock private EventSubscription eventSubscription;
  @Mock private SubscriptionDestination subscriptionDestination;

  @BeforeEach
  void setUp() {
    when(subscriptionDestination.getType())
        .thenReturn(SubscriptionDestination.SubscriptionType.ACTIVITY_FEED);
  }

  @Test
  void constructorRejectsIllegalDestinationType() {
    when(subscriptionDestination.getType())
        .thenReturn(SubscriptionDestination.SubscriptionType.EMAIL);

    assertThrows(
        IllegalArgumentException.class,
        () -> new ActivityStreamPublisher(eventSubscription, subscriptionDestination));
  }

  @Test
  void requiresRecipientsIsDisabled() {
    try (MockedConstruction<ActivityStreamRepository> ignored =
        mockConstruction(ActivityStreamRepository.class)) {
      ActivityStreamPublisher publisher =
          new ActivityStreamPublisher(eventSubscription, subscriptionDestination);

      assertFalse(publisher.requiresRecipients());
    }
  }

  @Test
  void sendMessageSkipsInternalEntityTypes() throws EventPublisherException {
    try (MockedConstruction<ActivityStreamRepository> ignored =
        mockConstruction(ActivityStreamRepository.class)) {
      ActivityStreamPublisher publisher =
          new ActivityStreamPublisher(eventSubscription, subscriptionDestination);

      ChangeEvent event = createChangeEvent(Entity.TASK, createTableEntity());

      assertDoesNotThrow(() -> publisher.sendMessage(event, Collections.emptySet()));
    }
  }

  @Test
  void sendMessageSkipsWhenEntityMissing() throws EventPublisherException {
    try (MockedConstruction<ActivityStreamRepository> repositoryConstruction =
        mockConstruction(ActivityStreamRepository.class)) {
      ActivityStreamPublisher publisher =
          new ActivityStreamPublisher(eventSubscription, subscriptionDestination);

      ChangeEvent event = createChangeEvent(Entity.TABLE, null);

      assertDoesNotThrow(() -> publisher.sendMessage(event, Collections.emptySet()));

      ActivityStreamRepository repository = repositoryConstruction.constructed().getFirst();
      verify(repository, never()).createFieldEventsFromChangeEvent(any(), any());
    }
  }

  @Test
  void sendMessageCreatesActivityEvents() throws EventPublisherException {
    try (MockedConstruction<ActivityStreamRepository> repositoryConstruction =
        mockConstruction(
            ActivityStreamRepository.class,
            (repository, context) ->
                when(repository.createFieldEventsFromChangeEvent(any(), any()))
                    .thenReturn(List.of(new ActivityEvent().withId(UUID.randomUUID()))))) {
      ActivityStreamPublisher publisher =
          new ActivityStreamPublisher(eventSubscription, subscriptionDestination);

      ChangeEvent event = createChangeEvent(Entity.TABLE, createTableEntity());

      assertDoesNotThrow(() -> publisher.sendMessage(event, Collections.emptySet()));

      ActivityStreamRepository repository = repositoryConstruction.constructed().getFirst();
      verify(repository).createFieldEventsFromChangeEvent(any(), any());
    }
  }

  @Test
  void sendMessageParsesSerializedEntityPayload() throws EventPublisherException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<ActivityStreamRepository> repositoryConstruction =
            mockConstruction(
                ActivityStreamRepository.class,
                (repository, context) ->
                    when(repository.createFieldEventsFromChangeEvent(any(), any()))
                        .thenReturn(List.of(new ActivityEvent().withId(UUID.randomUUID()))))) {
      entityMock.when(() -> Entity.getEntityClassFromType(Entity.TABLE)).thenReturn(Table.class);
      ActivityStreamPublisher publisher =
          new ActivityStreamPublisher(eventSubscription, subscriptionDestination);

      ChangeEvent event =
          createChangeEvent(Entity.TABLE, JsonUtils.pojoToJson(createTableEntity()));

      assertDoesNotThrow(() -> publisher.sendMessage(event, Collections.emptySet()));

      ActivityStreamRepository repository = repositoryConstruction.constructed().getFirst();
      verify(repository).createFieldEventsFromChangeEvent(any(), any());
    }
  }

  @Test
  void sendMessageWrapsRepositoryErrors() {
    try (MockedConstruction<ActivityStreamRepository> repositoryConstruction =
        mockConstruction(
            ActivityStreamRepository.class,
            (repository, context) ->
                when(repository.createFieldEventsFromChangeEvent(any(), any()))
                    .thenThrow(new RuntimeException("unexpected error")))) {
      ActivityStreamPublisher publisher =
          new ActivityStreamPublisher(eventSubscription, subscriptionDestination);

      when(subscriptionDestination.getId()).thenReturn(UUID.randomUUID());

      ChangeEvent event = createChangeEvent(Entity.TABLE, createTableEntity());

      assertThrows(
          EventPublisherException.class,
          () -> publisher.sendMessage(event, Collections.emptySet()));

      ActivityStreamRepository repository = repositoryConstruction.constructed().getFirst();
      verify(repository).createFieldEventsFromChangeEvent(any(), any());
    }
  }

  private static ChangeEvent createChangeEvent(String entityType, Object entity) {
    ChangeEvent event = new ChangeEvent();
    event.setEntityType(entityType);
    event.setEntityId(UUID.randomUUID());
    event.setEntityFullyQualifiedName("test.db.schema.entity");
    event.setEntity(entity);
    event.setUserName("admin");

    return event;
  }

  private static Table createTableEntity() {
    return new Table().withId(UUID.randomUUID()).withFullyQualifiedName("test.db.schema.entity");
  }
}
