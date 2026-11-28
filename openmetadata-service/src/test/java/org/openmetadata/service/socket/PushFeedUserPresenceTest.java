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
package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

class PushFeedUserPresenceTest {
  private final UUID userId = UUID.randomUUID();

  @Test
  void aUserThatIsNotFoundAmongTheUndeletedIsGone() {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityReferenceById(Entity.USER, userId, Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(userId.toString()));

      assertTrue(PushFeedUserPresence.isGone(userId));
    }
  }

  @Test
  void aUserThatIsFoundIsNotGone() {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityReferenceById(Entity.USER, userId, Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(userId));

      assertFalse(PushFeedUserPresence.isGone(userId));
    }
  }

  /** A failed read is not a deletion: closing on it would end sockets the UI never reopens. */
  @Test
  void aLookupThatFailsIsNotADeletion() {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityReferenceById(Entity.USER, userId, Include.NON_DELETED))
          .thenThrow(new IllegalStateException("connection pool exhausted"));

      assertFalse(PushFeedUserPresence.isGone(userId));
    }
  }
}
