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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Unit tests for the iterative bulk restore path introduced for issue #4003. Verifies that
 * {@link EntityRepository#restoreChildren(UUID, String)} groups children by entity type and
 * dispatches a single {@link EntityRepository#bulkRestoreSubtree(List, String)} call per type
 * (instead of N recursive {@code Entity.restoreEntity} calls), and that the bulk path skips
 * empty inputs and invokes the {@code restoreAdditionalChildren} extension hook once per
 * restored entity.
 */
class EntityRepositoryRestoreTest {

  private CollectionDAO daoCollection;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  private static class CountingPipelineRepo extends EntityRepository<Pipeline> {
    int restoreAdditionalChildrenCalls = 0;
    final Set<UUID> bulkRestoreInvokedWith = new HashSet<>();

    CountingPipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}

    @Override
    protected void restoreAdditionalChildren(UUID id, String updatedBy) {
      restoreAdditionalChildrenCalls++;
      bulkRestoreInvokedWith.add(id);
    }
  }

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(daoCollection);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
  }

  @Test
  void restoreChildren_withNoChildren_isNoOp() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID parentId = UUID.randomUUID();
    when(relationshipDAO.findTo(eq(parentId), eq(Entity.PIPELINE), anyInt())).thenReturn(List.of());

    repo.restoreChildren(parentId, "user");

    verify(relationshipDAO).findTo(eq(parentId), eq(Entity.PIPELINE), anyInt());
    assertEquals(0, repo.restoreAdditionalChildrenCalls);
  }

  @Test
  void restoreChildren_groupsByTypeAndDispatchesOnceEach() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID parentId = UUID.randomUUID();

    UUID schemaA = UUID.randomUUID();
    UUID schemaB = UUID.randomUUID();
    UUID procA = UUID.randomUUID();

    List<CollectionDAO.EntityRelationshipRecord> children = new ArrayList<>();
    children.add(record(schemaA, Entity.DATABASE_SCHEMA));
    children.add(record(schemaB, Entity.DATABASE_SCHEMA));
    children.add(record(procA, Entity.STORED_PROCEDURE));
    when(relationshipDAO.findTo(eq(parentId), eq(Entity.PIPELINE), anyInt())).thenReturn(children);

    EntityRepository<?> schemaRepo = mock(EntityRepository.class);
    EntityRepository<?> procRepo = mock(EntityRepository.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SCHEMA))
          .thenReturn(schemaRepo);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.STORED_PROCEDURE))
          .thenReturn(procRepo);

      repo.restoreChildren(parentId, "user");
    }

    ArgumentCaptor<List<UUID>> schemaIds = captureUuidList();
    verify(schemaRepo, times(1)).bulkRestoreSubtree(schemaIds.capture(), eq("user"));
    assertEquals(2, schemaIds.getValue().size());
    assertTrue(schemaIds.getValue().contains(schemaA));
    assertTrue(schemaIds.getValue().contains(schemaB));

    ArgumentCaptor<List<UUID>> procIds = captureUuidList();
    verify(procRepo, times(1)).bulkRestoreSubtree(procIds.capture(), eq("user"));
    assertEquals(1, procIds.getValue().size());
    assertTrue(procIds.getValue().contains(procA));

    verify(schemaRepo, never()).restoreEntity(eq("user"), eq(schemaA));
    verify(schemaRepo, never()).restoreEntity(eq("user"), eq(schemaB));
    verify(procRepo, never()).restoreEntity(eq("user"), eq(procA));
  }

  @Test
  void bulkRestoreSubtree_emptyOrNullIds_isNoOp() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);

    repo.bulkRestoreSubtree(null, "user");
    repo.bulkRestoreSubtree(List.of(), "user");

    verify(pipelineDAO, never())
        .findEntitiesByIds(anyList(), eq(org.openmetadata.schema.type.Include.DELETED));
    assertEquals(0, repo.restoreAdditionalChildrenCalls);
  }

  @Test
  void bulkRestoreSubtree_noDeletedEntitiesFound_isNoOp() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID id = UUID.randomUUID();
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(org.openmetadata.schema.type.Include.DELETED)))
        .thenReturn(List.of());

    repo.bulkRestoreSubtree(List.of(id), "user");

    verify(pipelineDAO, atLeastOnce())
        .findEntitiesByIds(anyList(), eq(org.openmetadata.schema.type.Include.DELETED));
    assertEquals(0, repo.restoreAdditionalChildrenCalls);
  }

  private CollectionDAO.EntityRelationshipRecord record(UUID id, String type) {
    return CollectionDAO.EntityRelationshipRecord.builder().id(id).type(type).build();
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<List<UUID>> captureUuidList() {
    return ArgumentCaptor.forClass(List.class);
  }

  private static List<UUID> anyList() {
    return org.mockito.ArgumentMatchers.anyList();
  }
}
