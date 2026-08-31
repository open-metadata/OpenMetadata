/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

class GlossaryTermRepositoryBulkFieldsTest {

  private CollectionDAO collectionDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private GlossaryTermRepository repository;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.glossaryTermDAO()).thenReturn(mock(CollectionDAO.GlossaryTermDAO.class));
    when(collectionDAO.relationshipTypeDAO())
        .thenReturn(mock(CollectionDAO.RelationshipTypeDAO.class));
    Entity.setCollectionDAO(collectionDAO);
    repository = new GlossaryTermRepository(false);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void setFieldsInBulkDoesNotOverwriteFreshBatchedParentReference() {
    UUID childId = UUID.randomUUID();
    UUID parentId = UUID.randomUUID();
    UUID glossaryId = UUID.randomUUID();
    EntityReference freshParent = entityReference(parentId, GLOSSARY_TERM, "Renamed.Parent");
    EntityReference staleParent = entityReference(parentId, GLOSSARY_TERM, "Original.Parent");
    EntityReference glossary = entityReference(glossaryId, GLOSSARY, "Glossary");
    GlossaryTerm child =
        new GlossaryTerm()
            .withId(childId)
            .withName("Child")
            .withFullyQualifiedName("Renamed.Parent.Child");

    CollectionDAO.EntityRelationshipObject parentRecord =
        relationship(parentId, GLOSSARY_TERM, childId, Relationship.CONTAINS);
    CollectionDAO.EntityRelationshipObject glossaryRecord =
        relationship(glossaryId, GLOSSARY, childId, Relationship.HAS);

    when(relationshipDAO.findFromBatch(
            anyList(), eq(Relationship.CONTAINS.ordinal()), eq(Include.ALL)))
        .thenReturn(List.of(parentRecord));
    when(relationshipDAO.findFromBatch(
            anyList(), eq(Relationship.HAS.ordinal()), eq(GLOSSARY), eq(Include.ALL)))
        .thenReturn(List.of(glossaryRecord));
    when(relationshipDAO.findFromBatch(
            anyList(), eq(Relationship.CONTAINS.ordinal()), eq(GLOSSARY_TERM), eq(GLOSSARY_TERM)))
        .thenReturn(List.of(parentRecord));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(GLOSSARY_TERM), eq(List.of(parentId)), eq(Include.ALL)))
          .thenReturn(List.of(freshParent));
      entityMock
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(GLOSSARY), eq(List.of(glossaryId)), eq(Include.ALL)))
          .thenReturn(List.of(glossary));
      entityMock
          .when(
              () -> Entity.getEntityReferenceById(eq(GLOSSARY_TERM), eq(parentId), eq(Include.ALL)))
          .thenReturn(staleParent);

      repository.setFieldsInBulk(new Fields(Set.of("parent")), List.of(child));
    }

    assertEquals("Renamed.Parent", child.getParent().getFullyQualifiedName());
    verify(relationshipDAO, never())
        .findFromBatch(
            anyList(), eq(Relationship.CONTAINS.ordinal()), eq(GLOSSARY_TERM), eq(GLOSSARY_TERM));
  }

  private static EntityReference entityReference(UUID id, String type, String fqn) {
    return new EntityReference().withId(id).withType(type).withFullyQualifiedName(fqn);
  }

  private static CollectionDAO.EntityRelationshipObject relationship(
      UUID fromId, String fromEntity, UUID toId, Relationship relationship) {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .fromEntity(fromEntity)
        .toEntity(GLOSSARY_TERM)
        .relation(relationship.ordinal())
        .build();
  }
}
