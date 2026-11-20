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

package org.openmetadata.service.events.lifecycle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityLifecycleHardDeleteTest {
  private final EntityLifecycleEventDispatcher dispatcher =
      EntityLifecycleEventDispatcher.getInstance();
  private final List<String> events = new ArrayList<>();
  private final List<String> registered = new ArrayList<>();

  @AfterEach
  void cleanup() {
    PostCommitActionQueue.clear();
    registered.forEach(dispatcher::unregisterHandler);
  }

  @Test
  void aHandlerPreparesDuringTheDeleteAndCleansUpOnlyAfterCommit() {
    register(new Handler("first", 10));
    PostCommitActionQueue.begin();

    PostCommitActionQueue.runOrDefer(dispatcher.prepareHardDelete(List.of(service())));

    assertEquals(List.of("prepare first"), events);
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertEquals(List.of("prepare first", "cleanup first"), events);
  }

  @Test
  void aCleanupIsDiscardedWhenTheDeleteRollsBack() {
    register(new Handler("first", 10));
    PostCommitActionQueue.begin();
    int checkpoint = PostCommitActionQueue.checkpoint();

    PostCommitActionQueue.runOrDefer(dispatcher.prepareHardDelete(List.of(service())));
    PostCommitActionQueue.rollbackToCheckpoint(checkpoint);
    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertEquals(List.of("prepare first"), events);
  }

  @Test
  void cleanupsRunInHandlerPriorityOrder() {
    register(new Handler("late", 90));
    register(new Handler("early", 5));

    dispatcher.prepareHardDelete(List.of(service())).run();

    assertEquals(List.of("prepare early", "prepare late", "cleanup early", "cleanup late"), events);
  }

  @Test
  void aHandlerThatFailsToPrepareDoesNotStopTheOthers() {
    register(new Handler("broken", 5).failingToPrepare());
    register(new Handler("healthy", 10));

    dispatcher.prepareHardDelete(List.of(service())).run();

    assertEquals(List.of("prepare healthy", "cleanup healthy"), events);
  }

  @Test
  void aCleanupThatFailsDoesNotStopTheOthers() {
    register(new Handler("broken", 5).failingToCleanUp());
    register(new Handler("healthy", 10));

    dispatcher.prepareHardDelete(List.of(service())).run();

    assertEquals(List.of("prepare broken", "prepare healthy", "cleanup healthy"), events);
  }

  @Test
  void aHandlerPreparesOnlyForTheEntityTypesItSupports() {
    register(new Handler("services", 10).onlyFor(Entity.DATABASE_SERVICE));

    dispatcher.prepareHardDelete(List.of(entity(Entity.TABLE), service())).run();

    assertEquals(List.of("prepare services", "cleanup services"), events);
  }

  private void register(Handler handler) {
    String name = handler.getHandlerName();
    dispatcher.unregisterHandler(name);
    dispatcher.registerHandler(handler);
    registered.add(name);
  }

  private static EntityInterface<?> service() {
    return entity(Entity.DATABASE_SERVICE);
  }

  private static EntityInterface<?> entity(String type) {
    EntityInterface<?> entity = mock(EntityInterface.class);
    EntityReference reference = new EntityReference().withId(UUID.randomUUID()).withType(type);
    when(entity.getId()).thenReturn(reference.getId());
    when(entity.getEntityReference()).thenReturn(reference);
    return entity;
  }

  private final class Handler implements EntityLifecycleEventHandler {
    private final String label;
    private final int priority;
    private boolean failToPrepare;
    private boolean failToCleanUp;
    private Set<String> types = Set.of();

    private Handler(String label, int priority) {
      this.label = label;
      this.priority = priority;
    }

    private Handler failingToPrepare() {
      failToPrepare = true;
      return this;
    }

    private Handler failingToCleanUp() {
      failToCleanUp = true;
      return this;
    }

    private Handler onlyFor(String type) {
      types = Set.of(type);
      return this;
    }

    @Override
    public Runnable prepareHardDelete(EntityInterface<?> entity) {
      if (failToPrepare) {
        throw new IllegalStateException("prepare failed");
      }
      events.add("prepare " + label);
      return () -> {
        if (failToCleanUp) {
          throw new IllegalStateException("cleanup failed");
        }
        events.add("cleanup " + label);
      };
    }

    @Override
    public String getHandlerName() {
      return "HardDeleteTest-" + label;
    }

    @Override
    public int getPriority() {
      return priority;
    }

    @Override
    public boolean isAsync() {
      return false;
    }

    @Override
    public Set<String> getSupportedEntityTypes() {
      return types;
    }
  }
}
