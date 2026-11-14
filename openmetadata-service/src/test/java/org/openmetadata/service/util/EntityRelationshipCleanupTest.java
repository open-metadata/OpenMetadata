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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

class EntityRelationshipCleanupTest {

  private static final int HAS = Relationship.HAS.ordinal();

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void deletesRowsPointingAtSuggestionAndKeepsValidRows() {
    UUID tableId = UUID.randomUUID();
    UUID otherTableId = UUID.randomUUID();
    UUID suggestionId = UUID.randomUUID();
    EntityRelationshipObject suggestionRow =
        row(tableId, Entity.TABLE, suggestionId, Entity.SUGGESTION);
    EntityRelationshipObject validRow = row(tableId, Entity.TABLE, otherTableId, Entity.TABLE);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.getAllRelationshipsAfter(eq(""), eq(""), eq(-1), eq(""), anyInt()))
        .thenReturn(List.of(suggestionRow, validRow));
    when(relationshipDAO.getAllRelationshipsAfter(
            eq(validRow.getFromId()), eq(validRow.getToId()), eq(HAS), eq(""), anyInt()))
        .thenReturn(List.of());
    when(relationshipDAO.delete(tableId, Entity.TABLE, suggestionId, Entity.SUGGESTION, HAS))
        .thenReturn(1);

    EntityDAO tableDAO = mock(EntityDAO.class);
    when(tableDAO.getTableName()).thenReturn("table_entity");
    when(tableDAO.findExistingIds(anyString(), anyList()))
        .thenReturn(List.of(tableId.toString(), otherTableId.toString()));
    EntityRepository tableRepository = mock(EntityRepository.class);
    when(tableRepository.getDao()).thenReturn(tableDAO);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE));
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(anyString()))
          .thenThrow(EntityNotFoundException.byMessage("no time series repository"));

      EntityRelationshipCleanup.EntityCleanupResult result =
          new EntityRelationshipCleanup(collectionDAO, false).performCleanup(10);

      assertEquals(2, result.getTotalRelationshipsScanned());
      assertEquals(1, result.getOrphanedRelationshipsFound());
      assertEquals(1, result.getRelationshipsDeleted());
      verify(relationshipDAO).delete(tableId, Entity.TABLE, suggestionId, Entity.SUGGESTION, HAS);
      verify(relationshipDAO, never())
          .delete(tableId, Entity.TABLE, otherTableId, Entity.TABLE, HAS);
    }
  }

  private static EntityRelationshipObject row(
      UUID fromId, String fromEntity, UUID toId, String toEntity) {
    return EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .fromEntity(fromEntity)
        .toId(toId.toString())
        .toEntity(toEntity)
        .relation(HAS)
        .relationType("")
        .build();
  }
}
