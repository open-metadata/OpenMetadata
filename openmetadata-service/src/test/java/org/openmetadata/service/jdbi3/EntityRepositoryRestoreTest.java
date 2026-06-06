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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Unit tests for the iterative bulk restore + bulk soft-delete + bulk hard-delete paths
 * introduced for issue #4003. Verifies the dispatch shape that's testable without spinning
 * up the full bulk write path:
 *
 * <ul>
 *   <li>{@link EntityRepository#restoreChildren(UUID, String)} groups CONTAINS + PARENT_OF
 *       children by entity type and dispatches a single {@link
 *       EntityRepository#bulkRestoreSubtree(List, String)} call per type (instead of N
 *       recursive {@code Entity.restoreEntity} calls). The relation set matches
 *       {@code deleteChildren} so a Team / KnowledgePage / Classification hierarchy is
 *       restored the same way it was cascade-soft-deleted.
 *   <li>{@link EntityRepository#deleteChildren(List, boolean, String)} with
 *       {@code hardDelete=false} dispatches one {@link EntityRepository#bulkSoftDeleteSubtree(
 *       List, String)} call per type and with {@code hardDelete=true} dispatches one
 *       {@link EntityRepository#bulkHardDeleteSubtree(List, String)} call per type.
 *   <li>All three bulk methods bail out cleanly on null / empty inputs.
 *   <li>All three bulk methods issue a single batched {@code findToBatchAllTypes} per tree
 *       level that walks both {@code CONTAINS} and {@code PARENT_OF} so Glossary / Team /
 *       recursive-Container descendants stop silently slipping past the cascade.
 *   <li>The per-entity {@code *AdditionalChildren} hooks fire even on the "entities present
 *       but none need flipping" branch (so a re-entered cascade can reconcile HAS-related
 *       descendants), and {@code hardDeleteAdditionalChildren} + {@code
 *       bulkEntitySpecificCleanup} fire on the full bulk hard-delete path with the expected
 *       per-entity / per-batch counts.
 * </ul>
 *
 * The full bulk DB-write path (version history, updateMany, change events, entity row
 * deletes) is exercised in {@code RestoreHierarchyIT}, which runs against a real Docker
 * stack.
 */
class EntityRepositoryRestoreTest {

  private static final List<Integer> SUBTREE_RELATIONS =
      List.of(Relationship.CONTAINS.ordinal(), Relationship.PARENT_OF.ordinal());

  private CollectionDAO daoCollection;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  private static class CountingPipelineRepo extends EntityRepository<Pipeline> {
    int restoreAdditionalChildrenCalls = 0;
    int softDeleteAdditionalChildrenCalls = 0;
    int hardDeleteAdditionalChildrenCalls = 0;
    int bulkEntitySpecificCleanupCalls = 0;
    final Set<UUID> bulkRestoreInvokedWith = new HashSet<>();
    final Set<UUID> bulkSoftDeleteInvokedWith = new HashSet<>();
    final Set<UUID> bulkHardDeleteInvokedWith = new HashSet<>();

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

    @Override
    protected void softDeleteAdditionalChildren(UUID id, String updatedBy) {
      softDeleteAdditionalChildrenCalls++;
      bulkSoftDeleteInvokedWith.add(id);
    }

    @Override
    protected void hardDeleteAdditionalChildren(UUID id, String updatedBy) {
      hardDeleteAdditionalChildrenCalls++;
      bulkHardDeleteInvokedWith.add(id);
    }

    @Override
    protected void bulkEntitySpecificCleanup(List<Pipeline> entities) {
      bulkEntitySpecificCleanupCalls++;
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
    when(relationshipDAO.findTo(eq(parentId), eq(Entity.PIPELINE), eq(SUBTREE_RELATIONS)))
        .thenReturn(List.of());

    repo.restoreChildren(parentId, "user");

    verify(relationshipDAO).findTo(eq(parentId), eq(Entity.PIPELINE), eq(SUBTREE_RELATIONS));
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
    when(relationshipDAO.findTo(eq(parentId), eq(Entity.PIPELINE), eq(SUBTREE_RELATIONS)))
        .thenReturn(children);

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

    // bulkRestoreSubtree loads with Include.ALL — guard that neither the DELETED nor ALL
    // shape is invoked when the input list is empty/null.
    verify(pipelineDAO, never())
        .findEntitiesByIds(anyList(), eq(org.openmetadata.schema.type.Include.DELETED));
    verify(pipelineDAO, never()).findEntitiesByIds(anyList(), eq(Include.ALL));
    assertEquals(0, repo.restoreAdditionalChildrenCalls);
  }

  @Test
  void bulkRestoreSubtree_noEntitiesAtAll_isNoOp() {
    // loadForBulk returns an empty list (entity doesn't exist at all): bulk path bails
    // before children traversal or hook invocation.
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID id = UUID.randomUUID();
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(Include.ALL))).thenReturn(List.of());

    repo.bulkRestoreSubtree(List.of(id), "user");

    verify(pipelineDAO, atLeastOnce()).findEntitiesByIds(anyList(), eq(Include.ALL));
    assertEquals(0, repo.restoreAdditionalChildrenCalls);
  }

  @Test
  void bulkRestoreSubtree_entitiesPresentButNoneDeleted_stillRunsAdditionalChildrenHook() {
    // loadForBulk returns entities, but none are in DELETED state. Bulk path must skip
    // the deferred-store update phase but still call runRestoreAdditionalChildren — a
    // re-entered cascade may have HAS-related descendants that need reconciliation.
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID id = UUID.randomUUID();
    Pipeline pa =
        new Pipeline().withId(id).withName("a").withFullyQualifiedName("svc.a").withDeleted(false);
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(Include.ALL))).thenReturn(List.of(pa));
    when(relationshipDAO.findToBatchAllTypes(anyList(), eq(SUBTREE_RELATIONS), eq(Include.ALL)))
        .thenReturn(List.of());

    repo.bulkRestoreSubtree(List.of(id), "user");

    assertEquals(1, repo.restoreAdditionalChildrenCalls);
    assertTrue(repo.bulkRestoreInvokedWith.contains(id));
  }

  @Test
  void bulkRestoreSubtree_usesBatchedFindToOncePerLevel() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();
    Pipeline pa =
        new Pipeline().withId(a).withName("a").withFullyQualifiedName("svc.a").withDeleted(true);
    Pipeline pb =
        new Pipeline().withId(b).withName("b").withFullyQualifiedName("svc.b").withDeleted(true);
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(Include.ALL))).thenReturn(List.of(pa, pb));
    when(relationshipDAO.findToBatchAllTypes(anyList(), eq(SUBTREE_RELATIONS), eq(Include.ALL)))
        .thenReturn(List.of());

    try {
      repo.bulkRestoreSubtree(List.of(a, b), "user");
    } catch (Exception ignored) {
      // Heavy DB write path requires more wiring than this unit test mocks; we only care
      // that the per-level findTo collapse happened before any failure downstream.
    }

    ArgumentCaptor<List<String>> idsCap = captureStringList();
    verify(relationshipDAO, times(1))
        .findToBatchAllTypes(idsCap.capture(), eq(SUBTREE_RELATIONS), eq(Include.ALL));
    assertEquals(2, idsCap.getValue().size());
    assertTrue(idsCap.getValue().contains(a.toString()));
    assertTrue(idsCap.getValue().contains(b.toString()));
  }

  @Test
  void deleteChildren_softDelete_groupsByTypeAndDispatchesToBulkSoftDelete() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);

    UUID schemaA = UUID.randomUUID();
    UUID schemaB = UUID.randomUUID();
    UUID procA = UUID.randomUUID();

    List<CollectionDAO.EntityRelationshipRecord> children = new ArrayList<>();
    children.add(record(schemaA, Entity.DATABASE_SCHEMA));
    children.add(record(schemaB, Entity.DATABASE_SCHEMA));
    children.add(record(procA, Entity.STORED_PROCEDURE));

    EntityRepository<?> schemaRepo = mock(EntityRepository.class);
    EntityRepository<?> procRepo = mock(EntityRepository.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SCHEMA))
          .thenReturn(schemaRepo);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.STORED_PROCEDURE))
          .thenReturn(procRepo);

      repo.deleteChildren(children, false, "user");
    }

    ArgumentCaptor<List<UUID>> schemaIds = captureUuidList();
    verify(schemaRepo, times(1)).bulkSoftDeleteSubtree(schemaIds.capture(), eq("user"));
    assertEquals(2, schemaIds.getValue().size());
    assertTrue(schemaIds.getValue().contains(schemaA));
    assertTrue(schemaIds.getValue().contains(schemaB));

    ArgumentCaptor<List<UUID>> procIds = captureUuidList();
    verify(procRepo, times(1)).bulkSoftDeleteSubtree(procIds.capture(), eq("user"));
    assertEquals(1, procIds.getValue().size());
    assertTrue(procIds.getValue().contains(procA));
  }

  @Test
  void bulkSoftDeleteSubtree_emptyOrNullIds_isNoOp() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);

    repo.bulkSoftDeleteSubtree(null, "user");
    repo.bulkSoftDeleteSubtree(List.of(), "user");

    verify(pipelineDAO, never()).findEntitiesByIds(anyList(), eq(Include.ALL));
    assertEquals(0, repo.softDeleteAdditionalChildrenCalls);
  }

  @Test
  void bulkSoftDeleteSubtree_usesBatchedFindToOncePerLevel() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();
    Pipeline pa = new Pipeline().withId(a).withName("a").withFullyQualifiedName("svc.a");
    Pipeline pb = new Pipeline().withId(b).withName("b").withFullyQualifiedName("svc.b");
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(Include.ALL))).thenReturn(List.of(pa, pb));
    when(relationshipDAO.findToBatchAllTypes(anyList(), eq(SUBTREE_RELATIONS), eq(Include.ALL)))
        .thenReturn(List.of());

    try {
      repo.bulkSoftDeleteSubtree(List.of(a, b), "user");
    } catch (Exception ignored) {
      // Heavy DB write path is not mocked; we verify only the per-level findTo collapse.
    }

    ArgumentCaptor<List<String>> idsCap = captureStringList();
    verify(relationshipDAO, times(1))
        .findToBatchAllTypes(idsCap.capture(), eq(SUBTREE_RELATIONS), eq(Include.ALL));
    assertEquals(2, idsCap.getValue().size());
    assertTrue(idsCap.getValue().contains(a.toString()));
    assertTrue(idsCap.getValue().contains(b.toString()));
  }

  @Test
  void deleteChildren_hardDelete_groupsByTypeAndDispatchesToBulkHardDelete() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);

    UUID schemaA = UUID.randomUUID();
    UUID schemaB = UUID.randomUUID();
    UUID procA = UUID.randomUUID();

    List<CollectionDAO.EntityRelationshipRecord> children = new ArrayList<>();
    children.add(record(schemaA, Entity.DATABASE_SCHEMA));
    children.add(record(schemaB, Entity.DATABASE_SCHEMA));
    children.add(record(procA, Entity.STORED_PROCEDURE));

    EntityRepository<?> schemaRepo = mock(EntityRepository.class);
    EntityRepository<?> procRepo = mock(EntityRepository.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SCHEMA))
          .thenReturn(schemaRepo);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.STORED_PROCEDURE))
          .thenReturn(procRepo);

      repo.deleteChildren(children, true, "user");
    }

    ArgumentCaptor<List<UUID>> schemaIds = captureUuidList();
    verify(schemaRepo, times(1)).bulkHardDeleteSubtree(schemaIds.capture(), eq("user"));
    assertEquals(2, schemaIds.getValue().size());
    assertTrue(schemaIds.getValue().contains(schemaA));
    assertTrue(schemaIds.getValue().contains(schemaB));

    ArgumentCaptor<List<UUID>> procIds = captureUuidList();
    verify(procRepo, times(1)).bulkHardDeleteSubtree(procIds.capture(), eq("user"));
    assertEquals(1, procIds.getValue().size());
    assertTrue(procIds.getValue().contains(procA));

    verify(schemaRepo, never()).bulkSoftDeleteSubtree(anyList(), eq("user"));
    verify(procRepo, never()).bulkSoftDeleteSubtree(anyList(), eq("user"));
  }

  @Test
  void bulkHardDeleteSubtree_emptyOrNullIds_isNoOp() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);

    repo.bulkHardDeleteSubtree(null, "user");
    repo.bulkHardDeleteSubtree(List.of(), "user");

    verify(pipelineDAO, never()).findEntitiesByIds(anyList(), eq(Include.ALL));
    assertEquals(0, repo.hardDeleteAdditionalChildrenCalls);
    assertEquals(0, repo.bulkEntitySpecificCleanupCalls);
  }

  @Test
  void bulkHardDeleteSubtree_usesBatchedFindToOncePerLevel_includingParentOf() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();
    Pipeline pa = new Pipeline().withId(a).withName("a").withFullyQualifiedName("svc.a");
    Pipeline pb = new Pipeline().withId(b).withName("b").withFullyQualifiedName("svc.b");
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(Include.ALL))).thenReturn(List.of(pa, pb));
    when(relationshipDAO.findToBatchAllTypes(anyList(), eq(SUBTREE_RELATIONS), eq(Include.ALL)))
        .thenReturn(List.of());

    try {
      repo.bulkHardDeleteSubtree(List.of(a, b), "user");
    } catch (Exception ignored) {
      // Heavy DB write path is not mocked; we verify only the per-level findTo collapse and
      // hook invocation.
    }

    ArgumentCaptor<List<String>> idsCap = captureStringList();
    verify(relationshipDAO, times(1))
        .findToBatchAllTypes(idsCap.capture(), eq(SUBTREE_RELATIONS), eq(Include.ALL));
    assertEquals(2, idsCap.getValue().size());
    assertTrue(idsCap.getValue().contains(a.toString()));
    assertTrue(idsCap.getValue().contains(b.toString()));
  }

  @Test
  void bulkHardDeleteSubtree_callsBulkEntitySpecificCleanupAndAdditionalChildrenHooks() {
    CountingPipelineRepo repo = new CountingPipelineRepo(pipelineDAO);
    UUID a = UUID.randomUUID();
    UUID b = UUID.randomUUID();
    Pipeline pa = new Pipeline().withId(a).withName("a").withFullyQualifiedName("svc.a");
    Pipeline pb = new Pipeline().withId(b).withName("b").withFullyQualifiedName("svc.b");
    when(pipelineDAO.findEntitiesByIds(anyList(), eq(Include.ALL))).thenReturn(List.of(pa, pb));
    when(relationshipDAO.findToBatchAllTypes(anyList(), eq(SUBTREE_RELATIONS), eq(Include.ALL)))
        .thenReturn(List.of());

    CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    CollectionDAO.FieldRelationshipDAO fieldRelationshipDAO =
        mock(CollectionDAO.FieldRelationshipDAO.class);
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    CollectionDAO.UsageDAO usageDAO = mock(CollectionDAO.UsageDAO.class);
    when(daoCollection.entityExtensionDAO()).thenReturn(extensionDAO);
    when(daoCollection.fieldRelationshipDAO()).thenReturn(fieldRelationshipDAO);
    when(daoCollection.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(daoCollection.usageDAO()).thenReturn(usageDAO);

    FeedRepository feedRepository = mock(FeedRepository.class);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entityMock.when(Entity::getFeedRepository).thenReturn(feedRepository);
      repo.bulkHardDeleteSubtree(List.of(a, b), "user");
    }

    // bulkEntitySpecificCleanup is invoked once per bulk call with the whole batch.
    assertEquals(1, repo.bulkEntitySpecificCleanupCalls);
    // hardDeleteAdditionalChildren is invoked once per entity in the batch.
    assertEquals(2, repo.hardDeleteAdditionalChildrenCalls);
    assertTrue(repo.bulkHardDeleteInvokedWith.contains(a));
    assertTrue(repo.bulkHardDeleteInvokedWith.contains(b));
    // Verify the per-batch relationship + extension cleanup actually ran.
    verify(relationshipDAO, times(1)).batchDeleteRelationships(anyList(), eq(Entity.PIPELINE));
    verify(extensionDAO, times(1)).deleteAllBatch(anyList());
    verify(pipelineDAO, times(1)).deleteByIds(anyList());
  }

  private CollectionDAO.EntityRelationshipRecord record(UUID id, String type) {
    return CollectionDAO.EntityRelationshipRecord.builder().id(id).type(type).build();
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<List<UUID>> captureUuidList() {
    return ArgumentCaptor.forClass(List.class);
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<List<String>> captureStringList() {
    return ArgumentCaptor.forClass(List.class);
  }
}
