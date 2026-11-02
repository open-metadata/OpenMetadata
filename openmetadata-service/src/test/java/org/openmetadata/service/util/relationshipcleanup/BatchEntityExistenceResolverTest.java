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

package org.openmetadata.service.util.relationshipcleanup;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ConversationRepository;
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs;

class BatchEntityExistenceResolverTest {

  @Test
  void resolvesConversationExistenceThroughConversationRepository() {
    final UUID existingId = UUID.randomUUID();
    final UUID missingId = UUID.randomUUID();
    final ConversationRepository conversationRepository = mock(ConversationRepository.class);
    final BatchEntityExistenceResolver resolver =
        new BatchEntityExistenceResolver(Map.of(), Map.of());
    when(conversationRepository.exists(existingId)).thenReturn(true);
    when(conversationRepository.exists(missingId)).thenReturn(false);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getConversationRepository).thenReturn(conversationRepository);

      assertTrue(resolver.exists(existingId, Entity.CONVERSATION));
      assertFalse(resolver.exists(missingId, Entity.CONVERSATION));
    }
  }

  @Test
  void failsOpenWhenConversationExistenceCannotBeResolved() {
    final UUID conversationId = UUID.randomUUID();
    final ConversationRepository conversationRepository = mock(ConversationRepository.class);
    final BatchEntityExistenceResolver resolver =
        new BatchEntityExistenceResolver(Map.of(), Map.of());
    when(conversationRepository.exists(conversationId))
        .thenThrow(new IllegalStateException("database unavailable"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getConversationRepository).thenReturn(conversationRepository);

      assertTrue(resolver.exists(conversationId, Entity.CONVERSATION));
    }
  }

  @Test
  void resolvesSuggestionExistenceThroughSuggestionDao() {
    final UUID existingId = UUID.randomUUID();
    final UUID missingId = UUID.randomUUID();
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final WorkflowDocStoreDAOs.SuggestionDAO suggestionDAO =
        mock(WorkflowDocStoreDAOs.SuggestionDAO.class);
    final BatchEntityExistenceResolver resolver =
        new BatchEntityExistenceResolver(Map.of(), Map.of());
    when(collectionDAO.suggestionDAO()).thenReturn(suggestionDAO);
    when(suggestionDAO.findById(existingId)).thenReturn("{}");
    when(suggestionDAO.findById(missingId)).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertTrue(resolver.exists(existingId, Entity.SUGGESTION));
      assertFalse(resolver.exists(missingId, Entity.SUGGESTION));
    }
  }

  @Test
  void failsOpenWhenSuggestionExistenceCannotBeResolved() {
    final UUID suggestionId = UUID.randomUUID();
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final BatchEntityExistenceResolver resolver =
        new BatchEntityExistenceResolver(Map.of(), Map.of());
    when(collectionDAO.suggestionDAO()).thenThrow(new IllegalStateException("table missing"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertTrue(resolver.exists(suggestionId, Entity.SUGGESTION));
    }
  }
}
