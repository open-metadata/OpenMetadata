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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityLifecyclePostCommitTest {
  private static final String HANDLER_NAME = "PostCommitTestHandler";
  private final EntityLifecycleEventDispatcher dispatcher =
      EntityLifecycleEventDispatcher.getInstance();
  private final RecordingHandler handler = new RecordingHandler();

  @BeforeEach
  void registerHandler() {
    dispatcher.unregisterHandler(HANDLER_NAME);
    dispatcher.registerHandler(handler);
  }

  @AfterEach
  void cleanup() {
    PostCommitActionQueue.clear();
    dispatcher.unregisterHandler(HANDLER_NAME);
  }

  @Test
  void synchronousLifecycleHandlerRunsOnlyAfterCommit() {
    final EntityInterface entity = mock(EntityInterface.class);
    final EntityReference reference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY_TERM);
    when(entity.getId()).thenReturn(reference.getId());
    when(entity.getEntityReference()).thenReturn(reference);
    PostCommitActionQueue.begin();

    dispatcher.onEntityCreated(entity, null);

    assertFalse(handler.wasCreated());
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertTrue(handler.wasCreated());
  }

  private static final class RecordingHandler implements EntityLifecycleEventHandler {
    private boolean created;

    @Override
    public void onEntityCreated(final EntityInterface entity, final SubjectContext subjectContext) {
      created = true;
    }

    @Override
    public String getHandlerName() {
      return HANDLER_NAME;
    }

    @Override
    public boolean isAsync() {
      return false;
    }

    private boolean wasCreated() {
      return created;
    }
  }
}
