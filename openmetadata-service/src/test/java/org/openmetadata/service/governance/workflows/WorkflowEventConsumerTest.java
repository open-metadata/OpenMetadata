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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.sql.SQLException;
import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.ibatis.exceptions.PersistenceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WorkflowEventConsumerTest {

  @Mock private EventSubscription eventSubscription;
  @Mock private SubscriptionDestination subscriptionDestination;
  @Mock private WorkflowHandler workflowHandler;

  private WorkflowEventConsumer consumer;

  @BeforeEach
  void setUp() {
    when(subscriptionDestination.getType())
        .thenReturn(SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT);
    when(subscriptionDestination.getId()).thenReturn(UUID.randomUUID());

    consumer = new WorkflowEventConsumer(eventSubscription, subscriptionDestination);
  }

  @Test
  void testConstructor_RejectsInvalidSubscriptionType() {
    SubscriptionDestination invalidDestination = mock(SubscriptionDestination.class);
    when(invalidDestination.getType()).thenReturn(SubscriptionDestination.SubscriptionType.SLACK);

    assertThrows(
        IllegalArgumentException.class,
        () -> new WorkflowEventConsumer(eventSubscription, invalidDestination));
  }

  @Test
  void testSendMessage_SkipsGovernanceBotEvents() throws Exception {
    ChangeEvent event = createChangeEvent("governance-bot", EventType.ENTITY_UPDATED);

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class)) {
      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);

      assertDoesNotThrow(() -> consumer.sendMessage(event, Collections.emptySet()));

      verify(workflowHandler, never()).triggerWithSignal(anyString(), anyMap());
    }
  }

  @Test
  void testSendMessage_SkipsGovernanceBotImpersonatedEvents() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_UPDATED);
    event.setImpersonatedBy("governance-bot");

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class)) {
      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);

      assertDoesNotThrow(() -> consumer.sendMessage(event, Collections.emptySet()));

      verify(workflowHandler, never()).triggerWithSignal(anyString(), anyMap());
    }
  }

  @Test
  void testSendMessage_SuccessfulTrigger() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_UPDATED);
    EntityReference entityRef = createEntityReference();

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {

      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(anyString(), any(UUID.class), any()))
          .thenReturn(entityRef);

      doNothing().when(workflowHandler).triggerWithSignal(anyString(), anyMap());

      assertDoesNotThrow(() -> consumer.sendMessage(event, Collections.emptySet()));

      verify(workflowHandler, times(1)).triggerWithSignal(eq("table-entityUpdated"), anyMap());
    }
  }

  @Test
  void testSendMessage_RetriesOnDeadlock() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_UPDATED);
    EntityReference entityRef = createEntityReference();

    AtomicInteger callCount = new AtomicInteger(0);

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {

      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(anyString(), any(UUID.class), any()))
          .thenReturn(entityRef);

      doAnswer(
              invocation -> {
                int count = callCount.incrementAndGet();
                if (count < 3) {
                  throw new PersistenceException(
                      new SQLException("Deadlock found when trying to get lock"));
                }
                return null;
              })
          .when(workflowHandler)
          .triggerWithSignal(anyString(), anyMap());

      assertDoesNotThrow(() -> consumer.sendMessage(event, Collections.emptySet()));

      assertEquals(3, callCount.get());
    }
  }

  @Test
  void testSendMessage_RetriesOnOptimisticLockingFailure() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_UPDATED);
    EntityReference entityRef = createEntityReference();

    AtomicInteger callCount = new AtomicInteger(0);

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {

      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(anyString(), any(UUID.class), any()))
          .thenReturn(entityRef);

      doAnswer(
              invocation -> {
                int count = callCount.incrementAndGet();
                if (count < 2) {
                  throw new RuntimeException("was updated by another transaction concurrently");
                }
                return null;
              })
          .when(workflowHandler)
          .triggerWithSignal(anyString(), anyMap());

      assertDoesNotThrow(() -> consumer.sendMessage(event, Collections.emptySet()));

      assertEquals(2, callCount.get());
    }
  }

  @Test
  void testSendMessage_DoesNotRetryNonTransientErrors() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_UPDATED);
    EntityReference entityRef = createEntityReference();

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {

      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(anyString(), any(UUID.class), any()))
          .thenReturn(entityRef);

      doThrow(new RuntimeException("Some non-transient error"))
          .when(workflowHandler)
          .triggerWithSignal(anyString(), anyMap());

      assertThrows(
          EventPublisherException.class, () -> consumer.sendMessage(event, Collections.emptySet()));

      verify(workflowHandler, times(1)).triggerWithSignal(anyString(), anyMap());
    }
  }

  @Test
  void testSendMessage_FailsAfterMaxRetries() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_UPDATED);
    EntityReference entityRef = createEntityReference();

    AtomicInteger callCount = new AtomicInteger(0);

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {

      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(anyString(), any(UUID.class), any()))
          .thenReturn(entityRef);

      doAnswer(
              invocation -> {
                callCount.incrementAndGet();
                throw new PersistenceException(new SQLException("Deadlock found"));
              })
          .when(workflowHandler)
          .triggerWithSignal(anyString(), anyMap());

      assertThrows(
          EventPublisherException.class, () -> consumer.sendMessage(event, Collections.emptySet()));

      assertEquals(3, callCount.get());
    }
  }

  @Test
  void testSendMessage_SkipsInvalidEventTypes() throws Exception {
    ChangeEvent event = createChangeEvent("admin", EventType.ENTITY_DELETED);

    try (MockedStatic<WorkflowHandler> mockedHandler = mockStatic(WorkflowHandler.class)) {
      mockedHandler.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);

      assertDoesNotThrow(() -> consumer.sendMessage(event, Collections.emptySet()));

      verify(workflowHandler, never()).triggerWithSignal(anyString(), anyMap());
    }
  }

  @Test
  void testIsTransientDatabaseError_Deadlock() throws Exception {
    Exception deadlockException =
        new PersistenceException(new SQLException("Deadlock found when trying to get lock"));

    assertTrue(invokeIsTransientDatabaseError(deadlockException));
  }

  @Test
  void testIsTransientDatabaseError_LockWaitTimeout() throws Exception {
    Exception lockTimeoutException =
        new RuntimeException(new SQLException("Lock wait timeout exceeded"));

    assertTrue(invokeIsTransientDatabaseError(lockTimeoutException));
  }

  @Test
  void testIsTransientDatabaseError_ConcurrentUpdate() throws Exception {
    Exception concurrentException =
        new RuntimeException("was updated by another transaction concurrently");

    assertTrue(invokeIsTransientDatabaseError(concurrentException));
  }

  @Test
  void testIsTransientDatabaseError_OptimisticLocking() throws Exception {
    Exception optimisticException = new RuntimeException("OptimisticLockingFailureException");

    assertTrue(invokeIsTransientDatabaseError(optimisticException));
  }

  @Test
  void testIsTransientDatabaseError_RestartTransaction() throws Exception {
    Exception restartException = new RuntimeException("try restarting transaction");

    assertTrue(invokeIsTransientDatabaseError(restartException));
  }

  @Test
  void testIsTransientDatabaseError_NonTransient() throws Exception {
    Exception regularException = new RuntimeException("Some regular error");

    assertFalse(invokeIsTransientDatabaseError(regularException));
  }

  @Test
  void testIsTransientDatabaseError_NullMessage() throws Exception {
    Exception nullMessageException = new RuntimeException((String) null);

    assertFalse(invokeIsTransientDatabaseError(nullMessageException));
  }

  @Test
  void testGetEnabled() {
    when(subscriptionDestination.getEnabled()).thenReturn(true);
    assertTrue(consumer.getEnabled());

    when(subscriptionDestination.getEnabled()).thenReturn(false);
    assertFalse(consumer.getEnabled());
  }

  @Test
  void testGetSubscriptionDestination() {
    assertEquals(subscriptionDestination, consumer.getSubscriptionDestination());
  }

  @Test
  void testGetEventSubscriptionForDestination() {
    assertEquals(eventSubscription, consumer.getEventSubscriptionForDestination());
  }

  private ChangeEvent createChangeEvent(String userName, EventType eventType) {
    ChangeEvent event = new ChangeEvent();
    event.setUserName(userName);
    event.setEventType(eventType);
    event.setEntityType("table");
    event.setEntityId(UUID.randomUUID());
    event.setEntityFullyQualifiedName("test.db.schema.table");
    return event;
  }

  private EntityReference createEntityReference() {
    EntityReference ref = new EntityReference();
    ref.setId(UUID.randomUUID());
    ref.setType("table");
    ref.setName("table");
    ref.setFullyQualifiedName("test.db.schema.table");
    return ref;
  }

  private boolean invokeIsTransientDatabaseError(Throwable e) throws Exception {
    Method method =
        WorkflowEventConsumer.class.getDeclaredMethod("isTransientDatabaseError", Throwable.class);
    method.setAccessible(true);
    return (boolean) method.invoke(null, e);
  }
}
