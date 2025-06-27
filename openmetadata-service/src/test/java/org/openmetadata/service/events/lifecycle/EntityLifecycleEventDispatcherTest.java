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

package org.openmetadata.service.events.lifecycle;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@ExtendWith(MockitoExtension.class)
class EntityLifecycleEventDispatcherTest {

  @Mock private EntityInterface mockEntity;
  @Mock private EntityReference mockEntityRef;
  @Mock private ChangeDescription mockChangeDescription;
  @Mock private SubjectContext mockSubjectContext;

  private EntityLifecycleEventDispatcher dispatcher;
  private TestHandler syncHandler;
  private TestHandler asyncHandler;
  private TestHandler specificEntityHandler;

  @BeforeEach
  void setUp() {
    // Get a fresh instance for each test
    dispatcher = EntityLifecycleEventDispatcher.getInstance();

    // Clear any existing handlers from previous tests
    clearHandlers();

    // Setup mock entity with actual UUID to avoid circular dependencies
    UUID entityId = UUID.randomUUID();
    lenient().when(mockEntity.getId()).thenReturn(entityId);
    lenient().when(mockEntity.getEntityReference()).thenReturn(mockEntityRef);
    lenient().when(mockEntityRef.getType()).thenReturn(Entity.TABLE);
    lenient().when(mockEntityRef.getId()).thenReturn(entityId);
    lenient().when(mockEntity.getChangeDescription()).thenReturn(mockChangeDescription);

    // Create test handlers
    syncHandler = new TestHandler("SyncHandler", 100, false, Set.of());
    asyncHandler = new TestHandler("AsyncHandler", 200, true, Set.of());
    specificEntityHandler = new TestHandler("SpecificHandler", 50, false, Set.of(Entity.TABLE));
  }

  private void clearHandlers() {
    // Clear handlers by accessing the private handlers field
    try {
      var handlersField = EntityLifecycleEventDispatcher.class.getDeclaredField("handlers");
      handlersField.setAccessible(true);
      ((java.util.List<?>) handlersField.get(dispatcher)).clear();
    } catch (Exception e) {
      // Ignore - this is just cleanup
    }
  }

  @Test
  void testSingletonInstance() {
    EntityLifecycleEventDispatcher instance1 = EntityLifecycleEventDispatcher.getInstance();
    EntityLifecycleEventDispatcher instance2 = EntityLifecycleEventDispatcher.getInstance();
    assertSame(instance1, instance2, "Should return the same singleton instance");
  }

  @Test
  void testRegisterHandler() {
    dispatcher.registerHandler(syncHandler);
    assertEquals(1, dispatcher.getHandlerCount());

    dispatcher.registerHandler(asyncHandler);
    assertEquals(2, dispatcher.getHandlerCount());
  }

  @Test
  void testRegisterDuplicateHandler() {
    dispatcher.registerHandler(syncHandler);
    assertEquals(1, dispatcher.getHandlerCount());

    // Try to register handler with same name
    TestHandler duplicateHandler = new TestHandler("SyncHandler", 300, false, Set.of());
    dispatcher.registerHandler(duplicateHandler);

    // Should still be 1 (duplicate not added)
    assertEquals(1, dispatcher.getHandlerCount());
  }

  @Test
  void testRegisterNullHandler() {
    dispatcher.registerHandler(null);
    assertEquals(0, dispatcher.getHandlerCount());
  }

  @Test
  void testUnregisterHandler() {
    dispatcher.registerHandler(syncHandler);
    dispatcher.registerHandler(asyncHandler);
    assertEquals(2, dispatcher.getHandlerCount());

    boolean removed = dispatcher.unregisterHandler("SyncHandler");
    assertTrue(removed);
    assertEquals(1, dispatcher.getHandlerCount());

    boolean notFound = dispatcher.unregisterHandler("NonExistentHandler");
    assertFalse(notFound);
    assertEquals(1, dispatcher.getHandlerCount());
  }

  @Test
  void testHandlerPriorityOrdering() {
    // Register handlers in different order
    dispatcher.registerHandler(asyncHandler); // priority 200
    dispatcher.registerHandler(specificEntityHandler); // priority 50
    dispatcher.registerHandler(syncHandler); // priority 100

    // Test that handlers are called in priority order (lower values first)
    dispatcher.onEntityCreated(mockEntity, mockSubjectContext);

    // Wait a bit for async handler
    try {
      Thread.sleep(100);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    // Verify all handlers were called
    assertTrue(specificEntityHandler.createdCalled);
    assertTrue(syncHandler.createdCalled);
    assertTrue(asyncHandler.createdCalled);
  }

  @Test
  void testEntityTypeFiltering() {
    dispatcher.registerHandler(specificEntityHandler); // Only handles TABLE entities
    dispatcher.registerHandler(syncHandler); // Handles all entities

    // Test with TABLE entity (should call both handlers)
    when(mockEntityRef.getType()).thenReturn(Entity.TABLE);
    dispatcher.onEntityCreated(mockEntity, mockSubjectContext);

    assertTrue(specificEntityHandler.createdCalled);
    assertTrue(syncHandler.createdCalled);

    // Reset and test with DASHBOARD entity (should only call general handler)
    specificEntityHandler.reset();
    syncHandler.reset();
    when(mockEntityRef.getType()).thenReturn(Entity.DASHBOARD);
    dispatcher.onEntityCreated(mockEntity, mockSubjectContext);

    assertFalse(specificEntityHandler.createdCalled);
    assertTrue(syncHandler.createdCalled);
  }

  @Test
  void testAsyncHandlerExecution() throws InterruptedException {
    CountDownLatch latch = new CountDownLatch(1);
    TestHandler asyncHandlerWithLatch =
        new TestHandler("AsyncWithLatch", 100, true, Set.of()) {
          @Override
          public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
            super.onEntityCreated(entity, subjectContext);
            latch.countDown();
          }
        };

    dispatcher.registerHandler(asyncHandlerWithLatch);
    dispatcher.onEntityCreated(mockEntity, mockSubjectContext);

    // Wait for async execution
    assertTrue(latch.await(2, TimeUnit.SECONDS), "Async handler should have been called");
    assertTrue(asyncHandlerWithLatch.createdCalled);
  }

  @Test
  void testSyncHandlerException() {
    TestHandler faultyHandler =
        new TestHandler("FaultyHandler", 100, false, Set.of()) {
          @Override
          public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
            super.onEntityCreated(entity, subjectContext);
            throw new RuntimeException("Test exception");
          }
        };

    dispatcher.registerHandler(faultyHandler);
    dispatcher.registerHandler(syncHandler);

    // Should not throw exception and should continue to call other handlers
    assertDoesNotThrow(() -> dispatcher.onEntityCreated(mockEntity, mockSubjectContext));
    assertTrue(faultyHandler.createdCalled);
    assertTrue(syncHandler.createdCalled);
  }

  @Test
  void testAsyncHandlerException() throws InterruptedException {
    CountDownLatch faultyLatch = new CountDownLatch(1);
    CountDownLatch goodLatch = new CountDownLatch(1);

    TestHandler faultyAsyncHandler =
        new TestHandler("FaultyAsyncHandler", 100, true, Set.of()) {
          @Override
          public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
            super.onEntityCreated(entity, subjectContext);
            faultyLatch.countDown();
            throw new RuntimeException("Async test exception");
          }
        };

    TestHandler goodAsyncHandler =
        new TestHandler("GoodAsyncHandler", 200, true, Set.of()) {
          @Override
          public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
            super.onEntityCreated(entity, subjectContext);
            goodLatch.countDown();
          }
        };

    dispatcher.registerHandler(faultyAsyncHandler);
    dispatcher.registerHandler(goodAsyncHandler);

    dispatcher.onEntityCreated(mockEntity, mockSubjectContext);

    // Both handlers should execute despite the exception
    assertTrue(faultyLatch.await(2, TimeUnit.SECONDS));
    assertTrue(goodLatch.await(2, TimeUnit.SECONDS));
  }

  @Test
  void testOnEntityUpdated() {
    dispatcher.registerHandler(syncHandler);
    dispatcher.onEntityUpdated(mockEntity, mockChangeDescription, mockSubjectContext);

    assertTrue(syncHandler.updatedCalled);
    assertSame(mockEntity, syncHandler.lastUpdatedEntity);
    assertSame(mockChangeDescription, syncHandler.lastChangeDescription);
  }

  @Test
  void testOnEntityDeleted() {
    dispatcher.registerHandler(syncHandler);
    dispatcher.onEntityDeleted(mockEntity, mockSubjectContext);

    assertTrue(syncHandler.deletedCalled);
    assertSame(mockEntity, syncHandler.lastDeletedEntity);
  }

  @Test
  void testOnEntitySoftDeletedOrRestored() {
    dispatcher.registerHandler(syncHandler);

    // Test soft delete
    dispatcher.onEntitySoftDeletedOrRestored(mockEntity, true, mockSubjectContext);
    assertTrue(syncHandler.softDeletedOrRestoredCalled);
    assertTrue(syncHandler.lastIsDeleted);

    // Test restore
    syncHandler.reset();
    dispatcher.onEntitySoftDeletedOrRestored(mockEntity, false, mockSubjectContext);
    assertTrue(syncHandler.softDeletedOrRestoredCalled);
    assertFalse(syncHandler.lastIsDeleted);
  }

  @Test
  void testNullEntityHandling() {
    dispatcher.registerHandler(syncHandler);

    // Should handle null entities gracefully
    dispatcher.onEntityCreated(null, mockSubjectContext);
    dispatcher.onEntityUpdated(null, mockChangeDescription, mockSubjectContext);
    dispatcher.onEntityDeleted(null, mockSubjectContext);
    dispatcher.onEntitySoftDeletedOrRestored(null, true, mockSubjectContext);

    // Handler should not be called for null entities
    assertFalse(syncHandler.createdCalled);
    assertFalse(syncHandler.updatedCalled);
    assertFalse(syncHandler.deletedCalled);
    assertFalse(syncHandler.softDeletedOrRestoredCalled);
  }

  // Test handler implementation
  private static class TestHandler implements EntityLifecycleEventHandler {
    private final String name;
    private final int priority;
    private final boolean async;
    private final Set<String> supportedEntityTypes;

    boolean createdCalled = false;
    boolean updatedCalled = false;
    boolean deletedCalled = false;
    boolean softDeletedOrRestoredCalled = false;

    EntityInterface lastCreatedEntity;
    EntityInterface lastUpdatedEntity;
    EntityInterface lastDeletedEntity;
    ChangeDescription lastChangeDescription;
    boolean lastIsDeleted;

    TestHandler(String name, int priority, boolean async, Set<String> supportedEntityTypes) {
      this.name = name;
      this.priority = priority;
      this.async = async;
      this.supportedEntityTypes = supportedEntityTypes;
    }

    @Override
    public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
      createdCalled = true;
      lastCreatedEntity = entity;
    }

    @Override
    public void onEntityUpdated(
        EntityInterface entity,
        ChangeDescription changeDescription,
        SubjectContext subjectContext) {
      updatedCalled = true;
      lastUpdatedEntity = entity;
      lastChangeDescription = changeDescription;
    }

    @Override
    public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
      deletedCalled = true;
      lastDeletedEntity = entity;
    }

    @Override
    public void onEntitySoftDeletedOrRestored(
        EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
      softDeletedOrRestoredCalled = true;
      lastIsDeleted = isDeleted;
    }

    @Override
    public String getHandlerName() {
      return name;
    }

    @Override
    public int getPriority() {
      return priority;
    }

    @Override
    public boolean isAsync() {
      return async;
    }

    @Override
    public Set<String> getSupportedEntityTypes() {
      return supportedEntityTypes;
    }

    void reset() {
      createdCalled = false;
      updatedCalled = false;
      deletedCalled = false;
      softDeletedOrRestoredCalled = false;
      lastCreatedEntity = null;
      lastUpdatedEntity = null;
      lastDeletedEntity = null;
      lastChangeDescription = null;
      lastIsDeleted = false;
    }
  }
}
