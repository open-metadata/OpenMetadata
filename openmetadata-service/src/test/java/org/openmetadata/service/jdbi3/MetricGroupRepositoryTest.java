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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RequestEntityCache;

class MetricGroupRepositoryTest {
  private CollectionDAO collectionDAO;
  private CollectionDAO.MetricGroupDAO groupDAO;
  private CollectionDAO.MetricDAO metricDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private MetricGroupRepository repository;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    groupDAO = mock(CollectionDAO.MetricGroupDAO.class);
    metricDAO = mock(CollectionDAO.MetricDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.metricGroupDAO()).thenReturn(groupDAO);
    when(collectionDAO.metricDAO()).thenReturn(metricDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(collectionDAO);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(collectionDAO));
    repository = new MetricGroupRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void genericFieldsRejectUnboundedMembershipHydration() {
    assertFalse(repository.getAllowedFields().contains("metrics"));
    assertThrows(IllegalArgumentException.class, () -> repository.getFields("metrics"));
  }

  @Test
  void metricCountUsesCountQueryWithoutHydratingMembers() {
    MetricGroup group = group("large_group");
    when(groupDAO.countNonDeletedMembers(group.getId(), Relationship.HAS.ordinal()))
        .thenReturn(12_345);

    repository.setFields(group, new Fields(Set.of("metricCount")), null);

    assertEquals(12_345, group.getMetricCount());
    verify(relationshipDAO, never())
        .findTo(group.getId(), Entity.METRIC_GROUP, Relationship.HAS.ordinal(), Entity.METRIC);
  }

  @Test
  void metricCountBulkHydrationUsesBoundedDaoChunks() {
    List<MetricGroup> groups = new ArrayList<>();
    for (int index = 0; index < 1001; index++) {
      groups.add(group("group_" + index));
    }
    when(groupDAO.countNonDeletedMembersBatch(anyList(), anyInt()))
        .thenAnswer(
            invocation ->
                invocation.<List<String>>getArgument(0).stream()
                    .map(
                        id ->
                            CollectionDAO.EntityRelationshipCount.builder()
                                .id(UUID.fromString(id))
                                .count(7)
                                .build())
                    .toList());

    repository.setFieldsInBulk(new Fields(Set.of("metricCount")), groups);

    groups.forEach(group -> assertEquals(7, group.getMetricCount()));
    ArgumentCaptor<List<String>> chunks = ArgumentCaptor.forClass(List.class);
    verify(groupDAO, times(3)).countNonDeletedMembersBatch(chunks.capture(), anyInt());
    assertEquals(List.of(500, 500, 1), chunks.getAllValues().stream().map(List::size).toList());
  }

  @Test
  void visibleMetricCountUsesMemberJsonWithoutASecondEntityLookup() {
    UUID groupId = UUID.randomUUID();
    Metric visible = metric("visible");
    Metric hidden = metric("hidden");
    when(groupDAO.countMembers(groupId, Relationship.HAS.ordinal(), "%")).thenReturn(2);
    when(groupDAO.listMemberJsons(groupId, Relationship.HAS.ordinal(), "%", 500, 0))
        .thenReturn(List.of(JsonUtils.pojoToJson(visible), JsonUtils.pojoToJson(hidden)));

    int count =
        repository.visibleMetricCount(
            groupId, reference -> visible.getId().equals(reference.getId()));

    assertEquals(1, count);
    verify(groupDAO, times(1)).listMemberJsons(groupId, Relationship.HAS.ordinal(), "%", 500, 0);
  }

  @Test
  void visibleMetricCountRejectsAnUnboundedPermissionScanBeforeLoadingMembers() {
    UUID groupId = UUID.randomUUID();
    when(groupDAO.countMembers(groupId, Relationship.HAS.ordinal(), "%"))
        .thenReturn(MetricGroupRepository.MAX_PERMISSION_FILTER_SCAN_SIZE + 1);

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> repository.visibleMetricCount(groupId, ignored -> true));

    assertTrue(exception.getMessage().contains("Narrow the query"));
    verify(groupDAO, never()).listMemberJsons(groupId, Relationship.HAS.ordinal(), "%", 500, 0);
  }

  @Test
  void unrestrictedMemberPagingUsesOneBoundedPageAndCountQuery() {
    UUID groupId = UUID.randomUUID();
    Metric first = metric("margin");
    Metric second = metric("gross_margin");
    when(groupDAO.listMemberJsons(groupId, Relationship.HAS.ordinal(), "%margin%", 25, 50))
        .thenReturn(List.of(JsonUtils.pojoToJson(first), JsonUtils.pojoToJson(second)));
    when(groupDAO.countMembers(groupId, Relationship.HAS.ordinal(), "%margin%")).thenReturn(12_345);

    MetricGroupRepository.MemberScan scan =
        repository.scanUnrestrictedMemberIds(groupId, 25, 50, "margin", false);

    assertEquals(List.of(first.getId(), second.getId()), scan.ids());
    assertEquals(12_345, scan.total());
    verify(groupDAO).listMemberJsons(groupId, Relationship.HAS.ordinal(), "%margin%", 25, 50);
    verify(groupDAO).countMembers(groupId, Relationship.HAS.ordinal(), "%margin%");
    verify(groupDAO, never())
        .listMemberJsons(groupId, Relationship.HAS.ordinal(), "%margin%", 500, 0);
  }

  @Test
  void unrestrictedRootPagingUsesRootPageAndCountQueries() {
    UUID groupId = UUID.randomUUID();
    Metric root = metric("margin");
    when(groupDAO.listRootMemberJsonsPage(
            groupId, Relationship.HAS.ordinal(), Relationship.CONTAINS.ordinal(), "%", 10, 20))
        .thenReturn(List.of(JsonUtils.pojoToJson(root)));
    when(groupDAO.countRootMembersPage(
            groupId, Relationship.HAS.ordinal(), Relationship.CONTAINS.ordinal(), "%"))
        .thenReturn(321);

    MetricGroupRepository.MemberScan scan =
        repository.scanUnrestrictedMemberIds(groupId, 10, 20, null, true);

    assertEquals(List.of(root.getId()), scan.ids());
    assertEquals(321, scan.total());
    verify(groupDAO)
        .listRootMemberJsonsPage(
            groupId, Relationship.HAS.ordinal(), Relationship.CONTAINS.ordinal(), "%", 10, 20);
    verify(groupDAO)
        .countRootMembersPage(
            groupId, Relationship.HAS.ordinal(), Relationship.CONTAINS.ordinal(), "%");
  }

  @Test
  void transactionBoundSubtreeAssignmentPropagatesMidMutationFailures() {
    EntityReference originalGroup = group("original").getEntityReference();
    EntityReference targetGroup = group("target").getEntityReference();
    EntityReference root = metric("root").getEntityReference();
    EntityReference child = metric("child").getEntityReference();
    CollectionDAO.EntityRelationshipRecord originalMembership =
        CollectionDAO.EntityRelationshipRecord.builder()
            .id(originalGroup.getId())
            .type(Entity.METRIC_GROUP)
            .build();
    when(relationshipDAO.findFrom(
            root.getId(), Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of(originalMembership));
    when(relationshipDAO.findFrom(
            child.getId(), Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of(originalMembership));
    doThrow(new IllegalStateException("database rejected child membership"))
        .when(relationshipDAO)
        .insert(
            targetGroup.getId(),
            child.getId(),
            Entity.METRIC_GROUP,
            Entity.METRIC,
            Relationship.HAS.ordinal());

    assertThrows(
        IllegalStateException.class,
        () ->
            MetricGroupRepository.assignHierarchyGroup(
                relationshipDAO, List.of(root, child), targetGroup));

    verify(relationshipDAO)
        .delete(
            originalGroup.getId(),
            Entity.METRIC_GROUP,
            root.getId(),
            Entity.METRIC,
            Relationship.HAS.ordinal());
    verify(relationshipDAO)
        .insert(
            targetGroup.getId(),
            root.getId(),
            Entity.METRIC_GROUP,
            Entity.METRIC,
            Relationship.HAS.ordinal());
    verify(relationshipDAO)
        .insert(
            targetGroup.getId(),
            child.getId(),
            Entity.METRIC_GROUP,
            Entity.METRIC,
            Relationship.HAS.ordinal());
  }

  @Test
  void currentTransactionAssignmentLocksTheSubtreeInStableOrderBeforeMutation() {
    CollectionDAO.MetricDAO metricDAO = mock(CollectionDAO.MetricDAO.class);
    EntityReference root =
        metric("root")
            .withId(UUID.fromString("00000000-0000-0000-0000-000000000002"))
            .getEntityReference();
    EntityReference child =
        metric("child")
            .withId(UUID.fromString("00000000-0000-0000-0000-000000000001"))
            .getEntityReference();
    EntityReference targetGroup = group("target").getEntityReference();
    when(relationshipDAO.findFrom(
            root.getId(), Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of());
    when(relationshipDAO.findFrom(
            child.getId(), Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of());

    MetricGroupRepository.MembershipChange change =
        MetricGroupRepository.assignHierarchyGroupWithLock(
            metricDAO, relationshipDAO, List.of(root, child), targetGroup);

    InOrder mutationOrder = inOrder(metricDAO, relationshipDAO);
    mutationOrder
        .verify(metricDAO)
        .lockForGroupAssignment(
            List.of(
                "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"));
    mutationOrder
        .verify(relationshipDAO)
        .findFrom(root.getId(), Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP);
    mutationOrder
        .verify(relationshipDAO)
        .insert(
            targetGroup.getId(),
            root.getId(),
            Entity.METRIC_GROUP,
            Entity.METRIC,
            Relationship.HAS.ordinal());
    assertEquals(List.of(root, child), change.metrics());
    assertEquals(Set.of(targetGroup), change.groups());
  }

  @Test
  void currentTransactionAssignmentReadsTheSubtreeThroughTheTransactionDao() {
    UUID rootId = UUID.randomUUID();
    UUID childId = UUID.randomUUID();
    Metric root = metric("root").withId(rootId);
    Metric child = metric("child").withId(childId);
    EntityReference targetGroup = group("target").getEntityReference();
    CollectionDAO transactionDAO = mock(CollectionDAO.class);
    CollectionDAO.MetricDAO transactionMetricDAO = mock(CollectionDAO.MetricDAO.class);
    CollectionDAO.EntityRelationshipDAO transactionRelationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(transactionDAO.metricDAO()).thenReturn(transactionMetricDAO);
    when(transactionDAO.relationshipDAO()).thenReturn(transactionRelationshipDAO);
    when(transactionMetricDAO.listDescendantSeedIds(rootId, Relationship.CONTAINS.ordinal()))
        .thenReturn(List.of(childId.toString()));
    when(transactionMetricDAO.listDescendantSeedIds(childId, Relationship.CONTAINS.ordinal()))
        .thenReturn(List.of());
    when(transactionMetricDAO.findEntitiesByIds(List.of(rootId, childId), NON_DELETED))
        .thenReturn(List.of(root, child));
    when(transactionRelationshipDAO.findFrom(
            rootId, Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of());
    when(transactionRelationshipDAO.findFrom(
            childId, Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of());
    AtomicReference<MetricGroupRepository.MembershipChange> change = new AtomicReference<>();

    RepositoryTransactionContext.runWith(
        transactionDAO,
        () -> change.set(repository.assignHierarchyGroupInCurrentTransaction(rootId, targetGroup)));

    assertEquals(
        List.of(root.getEntityReference(), child.getEntityReference()), change.get().metrics());
    verify(transactionMetricDAO)
        .lockForGroupAssignment(
            List.of(rootId.toString(), childId.toString()).stream().sorted().toList());
    verify(metricDAO, never()).listDescendantSeedIds(rootId, Relationship.CONTAINS.ordinal());
  }

  @Test
  void repeatedPreparationAcceptsAnAlreadyExpandedRootSubtree() {
    EntityReference root = metric("root").getEntityReference();
    EntityReference child = metric("child").getEntityReference();

    MetricGroupRepository.validateRequestedHierarchyMembers(
        List.of(root, child), Set.of(root.getId(), child.getId()));
  }

  @Test
  void hierarchySelectionRejectsAChildWithoutItsRoot() {
    EntityReference child = metric("child").getEntityReference();

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                MetricGroupRepository.validateRequestedHierarchyMembers(List.of(child), Set.of()));

    assertEquals("Metric 'child' is not a hierarchy root", exception.getMessage());
  }

  @Test
  void putPreparationRecognizesExistingMembershipByStableNameBeforeIdIsKnown() {
    MetricGroup target = new MetricGroup().withName("profitability");
    EntityReference sameByName =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC_GROUP)
            .withName("profitability")
            .withFullyQualifiedName("profitability");
    EntityReference other =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC_GROUP)
            .withName("growth")
            .withFullyQualifiedName("growth");

    assertEquals(true, MetricGroupRepository.referencesTargetGroup(sameByName, target));
    assertEquals(false, MetricGroupRepository.referencesTargetGroup(other, target));

    target.setId(sameByName.getId());
    target.setName("renamed-after-resolution");
    assertEquals(true, MetricGroupRepository.referencesTargetGroup(sameByName, target));
  }

  @Test
  void hardDeleteRetainsMembersForPostCommitRefresh() {
    MetricGroup group = group("deleted_group");
    EntityReference member = metric("member").getEntityReference();
    List<EntityReference> queriedMembers = new ArrayList<>(List.of(member));

    MetricGroupRepository.retainMembersForPostDelete(group, queriedMembers);
    queriedMembers.clear();

    assertEquals(List.of(member), group.getMetrics());
  }

  @Test
  void restoredGroupSearchDispatchPrecedesItsMemberRefresh() {
    MetricGroup group = group("restored_group").withDeleted(false);
    EntityReference member = metric("member").getEntityReference();
    group.setMetrics(List.of(member));
    when(relationshipDAO.findFrom(
            member.getId(), Entity.METRIC, Relationship.HAS.ordinal(), Entity.METRIC_GROUP))
        .thenReturn(List.of());
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<EntityRepository> cache = mockStatic(EntityRepository.class);
        MockedStatic<RequestEntityCache> requestCache = mockStatic(RequestEntityCache.class);
        MockedStatic<RdfUpdater> rdf = mockStatic(RdfUpdater.class)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);

      repository.restoreFromSearch(group);

      InOrder restoreDispatch = inOrder(dispatcher);
      restoreDispatch.verify(dispatcher).onEntitySoftDeletedOrRestored(group, false, null);
      restoreDispatch.verify(dispatcher).onEntityUpdated(member, null);
      verify(dispatcher, never()).onEntityUpdated(group.getEntityReference(), null);
      cache.verify(
          () ->
              EntityRepository.invalidateCacheForEntity(
                  Entity.METRIC, member.getId(), member.getFullyQualifiedName()));
      requestCache.verify(
          () ->
              RequestEntityCache.invalidate(
                  Entity.METRIC, member.getId(), member.getFullyQualifiedName()));
      cache.verify(
          () ->
              EntityRepository.invalidateCacheForEntity(Entity.METRIC_GROUP, group.getId(), null));
    }
  }

  @Test
  void replacingMembersRefreshesTheEditedGroupSearchDocument() {
    EntityReference originalMember =
        metric("original_member").getEntityReference().withType(Entity.METRIC);
    EntityReference replacementMember =
        metric("replacement_member").getEntityReference().withType(Entity.METRIC);
    MetricGroup original =
        group("edited_group").withUpdatedBy("admin").withMetrics(List.of(originalMember));
    MetricGroup updated =
        new MetricGroup()
            .withId(original.getId())
            .withName(original.getName())
            .withFullyQualifiedName(original.getFullyQualifiedName())
            .withUpdatedBy("admin")
            .withMetrics(List.of(replacementMember));
    when(relationshipDAO.findFrom(
            updated.getMetrics().getFirst().getId(),
            Entity.METRIC,
            Relationship.HAS.ordinal(),
            Entity.METRIC_GROUP))
        .thenReturn(List.of());
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);

    try (MockedStatic<EntityLifecycleEventDispatcher> lifecycle =
            mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<EntityRepository> cache = mockStatic(EntityRepository.class);
        MockedStatic<RequestEntityCache> requestCache = mockStatic(RequestEntityCache.class);
        MockedStatic<RdfUpdater> rdf = mockStatic(RdfUpdater.class)) {
      lifecycle.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      MetricGroupRepository.MetricGroupUpdater updater =
          repository.new MetricGroupUpdater(original, updated, EntityRepository.Operation.PUT);

      updater.entitySpecificUpdate(false);
      updater.runDeferredReactOperations();

      verify(dispatcher).onEntityUpdated(updated.getEntityReference(), null);
    }
  }

  private MetricGroup group(String name) {
    return new MetricGroup().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }

  private Metric metric(String name) {
    return new Metric().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }
}
