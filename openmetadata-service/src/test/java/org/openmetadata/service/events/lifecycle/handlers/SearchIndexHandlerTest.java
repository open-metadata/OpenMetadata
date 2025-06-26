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

package org.openmetadata.service.events.lifecycle.handlers;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@ExtendWith(MockitoExtension.class)
class SearchIndexHandlerTest {

  @Mock private SearchRepository mockSearchRepository;
  @Mock private EntityInterface mockEntity;
  @Mock private EntityInterface mockEntity2;
  @Mock private EntityReference mockEntityRef;
  @Mock private EntityReference mockEntityRef2;
  @Mock private ChangeDescription mockChangeDescription;
  @Mock private SubjectContext mockSubjectContext;

  private SearchIndexHandler searchIndexHandler;

  @BeforeEach
  void setUp() {
    searchIndexHandler = new SearchIndexHandler(mockSearchRepository);

    // Setup mock entities with actual UUIDs to avoid circular dependencies
    UUID entityId1 = UUID.randomUUID();
    UUID entityId2 = UUID.randomUUID();

    lenient().when(mockEntity.getId()).thenReturn(entityId1);
    lenient().when(mockEntity.getEntityReference()).thenReturn(mockEntityRef);
    lenient().when(mockEntityRef.getType()).thenReturn(Entity.TABLE);
    lenient().when(mockEntityRef.getId()).thenReturn(entityId1);

    lenient().when(mockEntity2.getId()).thenReturn(entityId2);
    lenient().when(mockEntity2.getEntityReference()).thenReturn(mockEntityRef2);
    lenient().when(mockEntityRef2.getType()).thenReturn(Entity.TABLE);
    lenient().when(mockEntityRef2.getId()).thenReturn(entityId2);
  }

  @Test
  void testGetHandlerName() {
    assertEquals("SearchIndexHandler", searchIndexHandler.getHandlerName());
  }

  @Test
  void testGetPriority() {
    assertEquals(10, searchIndexHandler.getPriority());
  }

  @Test
  void testIsAsync() {
    assertFalse(searchIndexHandler.isAsync());
  }

  @Test
  void testGetSupportedEntityTypes() {
    assertTrue(
        searchIndexHandler.getSupportedEntityTypes().isEmpty(),
        "SearchIndexHandler should support all entity types");
  }

  @Test
  void testOnEntityCreated() {
    searchIndexHandler.onEntityCreated(mockEntity, mockSubjectContext);

    verify(mockSearchRepository).createEntityIndex(mockEntity);
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntityCreatedWithException() {
    doThrow(new RuntimeException("Search indexing failed"))
        .when(mockSearchRepository)
        .createEntityIndex(mockEntity);

    // Should not throw exception but log it
    assertDoesNotThrow(() -> searchIndexHandler.onEntityCreated(mockEntity, mockSubjectContext));

    verify(mockSearchRepository).createEntityIndex(mockEntity);
  }

  @Test
  void testOnEntityUpdatedWithEntity() {
    searchIndexHandler.onEntityUpdated(mockEntity, mockChangeDescription, mockSubjectContext);

    verify(mockSearchRepository).updateEntityIndex(mockEntity);
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntityUpdatedWithEntityReference() {
    searchIndexHandler.onEntityUpdated(mockEntityRef, mockSubjectContext);

    verify(mockSearchRepository).updateEntity(mockEntityRef);
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntityUpdatedWithException() {
    doThrow(new RuntimeException("Search update failed"))
        .when(mockSearchRepository)
        .updateEntityIndex(mockEntity);

    // Should not throw exception but log it
    assertDoesNotThrow(
        () ->
            searchIndexHandler.onEntityUpdated(
                mockEntity, mockChangeDescription, mockSubjectContext));

    verify(mockSearchRepository).updateEntityIndex(mockEntity);
  }

  @Test
  void testOnEntityDeleted() {
    searchIndexHandler.onEntityDeleted(mockEntity, mockSubjectContext);

    verify(mockSearchRepository).deleteEntityIndex(mockEntity);
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntityDeletedWithException() {
    doThrow(new RuntimeException("Search deletion failed"))
        .when(mockSearchRepository)
        .deleteEntityIndex(mockEntity);

    // Should not throw exception but log it
    assertDoesNotThrow(() -> searchIndexHandler.onEntityDeleted(mockEntity, mockSubjectContext));

    verify(mockSearchRepository).deleteEntityIndex(mockEntity);
  }

  @Test
  void testOnEntitySoftDeletedOrRestored() {
    // Test soft delete
    searchIndexHandler.onEntitySoftDeletedOrRestored(mockEntity, true, mockSubjectContext);
    verify(mockSearchRepository).softDeleteOrRestoreEntityIndex(mockEntity, true);

    // Test restore
    searchIndexHandler.onEntitySoftDeletedOrRestored(mockEntity, false, mockSubjectContext);
    verify(mockSearchRepository).softDeleteOrRestoreEntityIndex(mockEntity, false);

    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntitySoftDeletedOrRestoredWithException() {
    doThrow(new RuntimeException("Soft delete failed"))
        .when(mockSearchRepository)
        .softDeleteOrRestoreEntityIndex(mockEntity, true);

    // Should not throw exception but log it
    assertDoesNotThrow(
        () ->
            searchIndexHandler.onEntitySoftDeletedOrRestored(mockEntity, true, mockSubjectContext));

    verify(mockSearchRepository).softDeleteOrRestoreEntityIndex(mockEntity, true);
  }

  @Test
  void testOnEntitiesCreatedEmpty() {
    searchIndexHandler.onEntitiesCreated(List.of(), mockSubjectContext);
    searchIndexHandler.onEntitiesCreated(null, mockSubjectContext);

    verifyNoInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntitiesCreatedSameType() {
    List<EntityInterface> entities = List.of(mockEntity, mockEntity2);

    searchIndexHandler.onEntitiesCreated(entities, mockSubjectContext);

    verify(mockSearchRepository).createEntitiesIndex(entities);
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntitiesCreatedMixedTypes() {
    // Setup different entity types
    when(mockEntityRef2.getType()).thenReturn(Entity.DASHBOARD);

    List<EntityInterface> entities = List.of(mockEntity, mockEntity2);

    searchIndexHandler.onEntitiesCreated(entities, mockSubjectContext);

    // Should call createEntitiesIndex twice - once for each entity type
    verify(mockSearchRepository).createEntitiesIndex(List.of(mockEntity));
    verify(mockSearchRepository).createEntitiesIndex(List.of(mockEntity2));
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testOnEntitiesCreatedWithFallback() {
    List<EntityInterface> entities = List.of(mockEntity, mockEntity2);

    // Make bulk operation fail
    doThrow(new RuntimeException("Bulk indexing failed"))
        .when(mockSearchRepository)
        .createEntitiesIndex(entities);

    searchIndexHandler.onEntitiesCreated(entities, mockSubjectContext);

    // Should fallback to individual creation
    verify(mockSearchRepository).createEntitiesIndex(entities);
    verify(mockSearchRepository).createEntityIndex(mockEntity);
    verify(mockSearchRepository).createEntityIndex(mockEntity2);
    verifyNoMoreInteractions(mockSearchRepository);
  }

  @Test
  void testNullEntityHandling() {
    // Test with null entities - should handle gracefully without calling SearchRepository
    searchIndexHandler.onEntityCreated(null, mockSubjectContext);
    searchIndexHandler.onEntityUpdated(
        (EntityInterface) null, mockChangeDescription, mockSubjectContext);
    searchIndexHandler.onEntityUpdated((EntityReference) null, mockSubjectContext);
    searchIndexHandler.onEntityDeleted(null, mockSubjectContext);
    searchIndexHandler.onEntitySoftDeletedOrRestored(null, true, mockSubjectContext);

    verifyNoInteractions(mockSearchRepository);
  }

  @Test
  void testConstructor() {
    SearchIndexHandler handler = new SearchIndexHandler(mockSearchRepository);
    assertNotNull(handler);
    assertEquals("SearchIndexHandler", handler.getHandlerName());
  }
}
