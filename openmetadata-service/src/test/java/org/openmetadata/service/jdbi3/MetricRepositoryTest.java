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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricHierarchyItem;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.approval.ApprovalGate.Edit;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ChangeActor;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.NoopAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;

class MetricRepositoryTest {

  @Test
  void referenceComparisonHandlesNullableParentAndGroupIdentity() {
    UUID groupId = UUID.randomUUID();
    EntityReference group = new EntityReference().withId(groupId).withType(Entity.METRIC_GROUP);
    EntityReference sameGroup =
        new EntityReference().withId(groupId).withType(Entity.METRIC_GROUP).withName("renamed");
    EntityReference otherGroup =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC_GROUP);

    assertTrue(MetricRepository.sameReferenceById(null, null));
    assertTrue(MetricRepository.sameReferenceById(group, group));
    assertTrue(MetricRepository.sameReferenceById(group, sameGroup));
    assertFalse(MetricRepository.sameReferenceById(group, null));
    assertFalse(MetricRepository.sameReferenceById(null, group));
    assertFalse(MetricRepository.sameReferenceById(group, otherGroup));
  }

  @Test
  void childMetricsAlwaysInheritTheirParentGroup() {
    EntityReference parent =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC);
    EntityReference requestedGroup =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC_GROUP);
    EntityReference inheritedGroup =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC_GROUP);

    assertEquals(
        inheritedGroup,
        MetricRepository.effectiveHierarchyGroup(parent, requestedGroup, inheritedGroup));
    assertEquals(
        requestedGroup,
        MetricRepository.effectiveHierarchyGroup(null, requestedGroup, inheritedGroup));
  }

  @Test
  void selfParentIsRejectedBeforeTheUnpersistedParentReferenceIsResolved() {
    Metric metric =
        new Metric()
            .withName("revenue")
            .withFullyQualifiedName("revenue")
            .withParent(
                new EntityReference().withType(Entity.METRIC).withFullyQualifiedName("revenue"));

    IllegalArgumentException error =
        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalArgumentException.class,
            () -> MetricRepository.validateSelfParentReference(metric));

    assertTrue(error.getMessage().contains("cannot be its own parent"));
  }

  @Test
  void directHierarchyCycleIsRejected() throws NoSuchMethodException {
    UUID metricId = UUID.randomUUID();
    UUID parentId = UUID.randomUUID();
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .relationshipDAO()
              .findFrom(parentId, Entity.METRIC, Relationship.CONTAINS.ordinal(), Entity.METRIC))
          .thenReturn(List.of(relationship(metricId)));

      IllegalArgumentException error =
          invokeHierarchyValidation(fixture.repository(), metric(metricId, parentId));

      assertTrue(error.getMessage().contains("Circular reference detected"));
    }
  }

  @Test
  void transitiveHierarchyCycleIsRejected() throws NoSuchMethodException {
    UUID metricId = UUID.randomUUID();
    UUID parentId = UUID.randomUUID();
    UUID ancestorId = UUID.randomUUID();
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .relationshipDAO()
              .findFrom(parentId, Entity.METRIC, Relationship.CONTAINS.ordinal(), Entity.METRIC))
          .thenReturn(List.of(relationship(ancestorId)));
      when(fixture
              .relationshipDAO()
              .findFrom(ancestorId, Entity.METRIC, Relationship.CONTAINS.ordinal(), Entity.METRIC))
          .thenReturn(List.of(relationship(metricId)));

      IllegalArgumentException error =
          invokeHierarchyValidation(fixture.repository(), metric(metricId, parentId));

      assertTrue(error.getMessage().contains("Circular reference detected"));
    }
  }

  @Test
  void initialStageReflectsReviewersWhateverTheRequestAsks() {
    try (RepositoryFixture fixture = repositoryFixture()) {
      List<EntityReference> reviewers =
          List.of(
              new EntityReference()
                  .withId(UUID.randomUUID())
                  .withType(Entity.USER)
                  .withName("reviewer"));
      Metric withoutReviewers = new Metric();
      Metric withReviewers = new Metric().withReviewers(reviewers);
      Metric askingToSkipReview =
          new Metric().withReviewers(reviewers).withEntityStatus(EntityStatus.APPROVED);

      assertEquals(
          EntityStatus.APPROVED, fixture.repository().initialEntityStatus(withoutReviewers));
      assertEquals(EntityStatus.DRAFT, fixture.repository().initialEntityStatus(withReviewers));
      assertEquals(
          EntityStatus.DRAFT,
          fixture.repository().initialEntityStatus(askingToSkipReview),
          "a metric with reviewers cannot be created already approved");
    }
  }

  @Test
  void groupInDomainPickScansEachGroupsMembersOncePerRequest() {
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity =
            mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      MetricGroupRepository groups = mock(MetricGroupRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC_GROUP)).thenReturn(groups);
      UUID groupId = UUID.randomUUID();
      when(groups.hasVisibleMemberMatching(
              org.mockito.ArgumentMatchers.eq(groupId),
              org.mockito.ArgumentMatchers.isNull(),
              org.mockito.ArgumentMatchers.any()))
          .thenReturn(true);
      EntityReference group = new EntityReference().withId(groupId).withType(Entity.METRIC_GROUP);

      java.util.function.Predicate<EntityReference> inPick =
          fixture.repository().groupInDomainPick(java.util.Optional.empty(), metric -> true);

      // The hierarchy tests a group for its own row and again for each of its metrics.
      assertTrue(inPick.test(group));
      assertTrue(inPick.test(group));
      verify(groups, org.mockito.Mockito.times(1))
          .hasVisibleMemberMatching(
              org.mockito.ArgumentMatchers.eq(groupId),
              org.mockito.ArgumentMatchers.isNull(),
              org.mockito.ArgumentMatchers.any());
    }
  }

  @Test
  void metricWithoutReviewersStartsInDraftWhenALifecyclePlaybookOwnsItsStage() {
    try (RepositoryFixture fixture = repositoryFixture()) {
      fixture.repository().stageOwnership = new PlaybookStageOwnership();

      assertEquals(EntityStatus.DRAFT, fixture.repository().initialEntityStatus(new Metric()));
    }
  }

  @Test
  void hierarchyItemCarriesExactlyOneTypedPayload() {
    UUID metricId = UUID.randomUUID();
    UUID groupId = UUID.randomUUID();
    Metric metric = new Metric().withId(metricId).withName("revenue");
    MetricGroup group = new MetricGroup().withId(groupId).withName("profitability");

    MetricHierarchyItem metricItem =
        MetricRepository.toHierarchyItem(
            new CollectionDAO.MetricDAO.HierarchyRow(metricId, Entity.METRIC),
            Map.of(metricId, metric),
            Map.of(groupId, group));
    MetricHierarchyItem groupItem =
        MetricRepository.toHierarchyItem(
            new CollectionDAO.MetricDAO.HierarchyRow(groupId, Entity.METRIC_GROUP),
            Map.of(metricId, metric),
            Map.of(groupId, group));

    assertEquals(MetricHierarchyItem.Kind.METRIC, metricItem.getKind());
    assertNotNull(metricItem.getMetric());
    assertNull(metricItem.getGroup());
    assertEquals(MetricHierarchyItem.Kind.METRIC_GROUP, groupItem.getKind());
    assertNotNull(groupItem.getGroup());
    assertNull(groupItem.getMetric());
  }

  @Test
  void unrestrictedHierarchyPagingUsesOneBoundedPageAndCountQuery() {
    UUID metricId = UUID.randomUUID();
    List<CollectionDAO.MetricDAO.HierarchyRow> rows =
        List.of(new CollectionDAO.MetricDAO.HierarchyRow(metricId, Entity.METRIC));
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .metricDAO()
              .listHierarchy(
                  Relationship.CONTAINS.ordinal(), Relationship.HAS.ordinal(), "%margin%", 25, 50))
          .thenReturn(rows);
      when(fixture
              .metricDAO()
              .countHierarchy(
                  Relationship.CONTAINS.ordinal(), Relationship.HAS.ordinal(), "%margin%"))
          .thenReturn(12_345);

      MetricRepository.HierarchyScan scan =
          fixture.repository().scanUnrestrictedHierarchyRows(25, 50, "%margin%");

      assertEquals(rows, scan.rows());
      assertEquals(12_345, scan.total());
      verify(fixture.metricDAO())
          .listHierarchy(
              Relationship.CONTAINS.ordinal(), Relationship.HAS.ordinal(), "%margin%", 25, 50);
      verify(fixture.metricDAO())
          .countHierarchy(Relationship.CONTAINS.ordinal(), Relationship.HAS.ordinal(), "%margin%");
    }
  }

  @Test
  void assetDirectionUsesGenericLineageSetsWithUpstreamPrecedence() {
    UUID assetId = UUID.randomUUID();

    assertEquals(
        MetricAssetDirection.Direction.UPSTREAM,
        MetricRepository.assetDirection(assetId, Set.of(assetId), Set.of(assetId)));
    assertEquals(
        MetricAssetDirection.Direction.DOWNSTREAM,
        MetricRepository.assetDirection(assetId, Set.of(), Set.of(assetId)));
    assertEquals(
        MetricAssetDirection.Direction.UNRELATED,
        MetricRepository.assetDirection(assetId, Set.of(), Set.of()));
  }

  @Test
  void observabilityRejectsLinkedAssetSetsAboveTheExplicitDetailLimit() {
    UUID metricId = UUID.randomUUID();
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .relationshipDAO()
              .countFindTo(metricId, Entity.METRIC, List.of(Relationship.APPLIED_TO.ordinal())))
          .thenReturn(MetricRepository.MAX_OBSERVABILITY_ASSET_DETAILS + 1);

      IllegalArgumentException exception =
          assertThrows(
              IllegalArgumentException.class,
              () -> fixture.repository().getAssetsWithDirection(metricId));

      assertTrue(exception.getMessage().contains("paginated /assets endpoint"));
      verify(fixture.relationshipDAO(), never())
          .findToWithOffset(
              metricId, Entity.METRIC, List.of(Relationship.APPLIED_TO.ordinal()), 0, 200);
    }
  }

  @Test
  void hierarchySearchEscapesSqlWildcards() {
    assertEquals("%margin!!!%!_net%", MetricGroupRepository.buildNameLike("Margin!%_Net"));
    assertEquals("%", MetricGroupRepository.buildNameLike("  "));
  }

  @Test
  void metricCsvContractIncludesExpertsAndMetricGroupAfterExistingColumns() {
    List<String> headers =
        MetricRepository.MetricCsv.HEADERS.stream().map(header -> header.getName()).toList();

    assertEquals("parent", headers.get(headers.size() - 3));
    assertEquals("experts", headers.get(headers.size() - 2));
    assertEquals("metricGroup", headers.getLast());
  }

  @Test
  void hierarchyPayloadSanitizationRemovesRestrictedEmbeddedReferencesWithoutMutatingSource() {
    EntityReference hiddenParent =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC)
            .withName("restricted_parent")
            .withFullyQualifiedName("restricted_parent");
    EntityReference hiddenGroup =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC_GROUP)
            .withName("restricted_group")
            .withFullyQualifiedName("restricted_group");
    Metric source =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("visible_metric")
            .withParent(hiddenParent)
            .withMetricGroup(hiddenGroup);

    Metric sanitized =
        MetricRepository.sanitizeHierarchyMetric(source, ignored -> false, ignored -> false);

    assertNull(sanitized.getParent());
    assertNull(sanitized.getMetricGroup());
    assertNotNull(source.getParent());
    assertNotNull(source.getMetricGroup());
  }

  @Test
  void relationSanitizationFiltersChildrenRelatedMetricsAndStoredChangeDescriptions() {
    EntityReference hiddenParent = metricReference(UUID.randomUUID(), "restricted_parent");
    EntityReference visibleChild = metricReference(UUID.randomUUID(), "visible_child");
    EntityReference hiddenChild = metricReference(UUID.randomUUID(), "restricted_child");
    EntityReference visibleRelated = metricReference(UUID.randomUUID(), "visible_related");
    EntityReference hiddenRelated = metricReference(UUID.randomUUID(), "restricted_related");
    EntityReference visibleGroup = groupReference(UUID.randomUUID(), "visible_group");
    Metric source =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("visible_metric")
            .withParent(hiddenParent)
            .withMetricGroup(visibleGroup)
            .withChildren(new ArrayList<>(List.of(visibleChild, hiddenChild)))
            .withRelatedMetrics(new ArrayList<>(List.of(visibleRelated, hiddenRelated)))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsAdded(
                        List.of(
                            new FieldChange()
                                .withName("parent")
                                .withNewValue(JsonUtils.pojoToJson(hiddenParent)),
                            new FieldChange()
                                .withName("relatedMetrics")
                                .withNewValue(JsonUtils.pojoToJson(List.of(visibleRelated))),
                            new FieldChange()
                                .withName("description")
                                .withNewValue("a description"))))
            .withIncrementalChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("parent")
                                .withOldValue(JsonUtils.pojoToJson(hiddenParent))
                                .withNewValue(JsonUtils.pojoToJson(visibleChild)))));

    Set<UUID> hidden = Set.of(hiddenParent.getId(), hiddenChild.getId(), hiddenRelated.getId());
    Metric sanitized =
        MetricRepository.sanitizeHierarchyMetric(
            source,
            reference -> !hidden.contains(reference.getId()),
            reference -> !hidden.contains(reference.getId()));

    assertNull(sanitized.getParent());
    assertEquals(visibleGroup, sanitized.getMetricGroup());
    assertEquals(List.of(visibleChild), sanitized.getChildren());
    assertEquals(List.of(visibleRelated), sanitized.getRelatedMetrics());
    assertEquals(
        List.of("relatedMetrics", "description"),
        sanitized.getChangeDescription().getFieldsAdded().stream()
            .map(FieldChange::getName)
            .toList());
    assertEquals(List.of(), sanitized.getIncrementalChangeDescription().getFieldsUpdated());
    // the source entity is left untouched
    assertEquals(hiddenParent, source.getParent());
    assertEquals(
        List.of("parent", "relatedMetrics", "description"),
        source.getChangeDescription().getFieldsAdded().stream().map(FieldChange::getName).toList());
  }

  @Test
  void storedChangeValuesAreVisibleOnlyWhenEveryReferencedEntityIsVisible() {
    EntityReference visible = metricReference(UUID.randomUUID(), "visible_metric");
    EntityReference hidden = metricReference(UUID.randomUUID(), "restricted_metric");
    Predicate<EntityReference> canView = reference -> visible.getId().equals(reference.getId());

    assertTrue(MetricRepository.referencesOnlyVisibleEntities(null, canView));
    assertTrue(MetricRepository.referencesOnlyVisibleEntities("", canView));
    assertTrue(MetricRepository.referencesOnlyVisibleEntities("plain text", canView));
    assertTrue(MetricRepository.referencesOnlyVisibleEntities(42, canView));
    assertTrue(MetricRepository.referencesOnlyVisibleEntities("[unclosed", canView));
    assertTrue(
        MetricRepository.referencesOnlyVisibleEntities(JsonUtils.pojoToJson(visible), canView));
    assertFalse(
        MetricRepository.referencesOnlyVisibleEntities(JsonUtils.pojoToJson(hidden), canView));
    assertTrue(
        MetricRepository.referencesOnlyVisibleEntities(
            JsonUtils.pojoToJson(List.of(visible)), canView));
    assertFalse(
        MetricRepository.referencesOnlyVisibleEntities(
            JsonUtils.pojoToJson(List.of(visible, hidden)), canView));
  }

  @Test
  void aFailingVisibilityCheckPropagatesInsteadOfShowingTheChange() {
    EntityReference reference = metricReference(UUID.randomUUID(), "unchecked_metric");
    Predicate<EntityReference> failingCheck =
        ignored -> {
          throw new IllegalStateException("policy evaluation failed");
        };

    assertThrows(
        IllegalStateException.class,
        () ->
            MetricRepository.referencesOnlyVisibleEntities(
                JsonUtils.pojoToJson(reference), failingCheck));
    assertThrows(
        IllegalStateException.class,
        () ->
            MetricRepository.referencesOnlyVisibleEntities(
                JsonUtils.pojoToJson(List.of(reference)), failingCheck));
  }

  @Test
  void relationSanitizationRecountsChildrenCountWithOnlyVisibleChildren() {
    Metric metric = new Metric().withId(UUID.randomUUID()).withName("parent").withChildrenCount(2);
    UUID visibleChildId = UUID.randomUUID();
    UUID hiddenChildId = UUID.randomUUID();
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      when(fixture
              .metricDAO()
              .listChildIds(metric.getId(), Relationship.CONTAINS.ordinal(), 200, 0))
          .thenReturn(List.of(visibleChildId.toString(), hiddenChildId.toString()));
      entity
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      Entity.METRIC, List.of(visibleChildId, hiddenChildId), NON_DELETED))
          .thenReturn(
              List.of(
                  metricReference(visibleChildId, "visible_child"),
                  metricReference(hiddenChildId, "restricted_child")));

      Metric sanitized =
          fixture
              .repository()
              .sanitizeMetricRelations(
                  metric, reference -> visibleChildId.equals(reference.getId()), ignored -> true);

      assertEquals(1, sanitized.getChildrenCount());
      assertEquals(2, metric.getChildrenCount());
    }
  }

  @Test
  void pageSanitizationRecountsChildrenCountsWithOneBatchQuery() {
    Metric first = new Metric().withId(UUID.randomUUID()).withName("first").withChildrenCount(2);
    Metric second = new Metric().withId(UUID.randomUUID()).withName("second").withChildrenCount(1);
    UUID visibleChildId = UUID.randomUUID();
    UUID hiddenChildId = UUID.randomUUID();
    UUID secondChildId = UUID.randomUUID();
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      when(fixture
              .relationshipDAO()
              .findToBatch(
                  List.of(first.getId().toString(), second.getId().toString()),
                  Relationship.CONTAINS.ordinal(),
                  Entity.METRIC,
                  Entity.METRIC))
          .thenReturn(
              List.of(
                  CollectionDAO.EntityRelationshipObject.builder()
                      .fromId(first.getId().toString())
                      .toId(visibleChildId.toString())
                      .build(),
                  CollectionDAO.EntityRelationshipObject.builder()
                      .fromId(first.getId().toString())
                      .toId(hiddenChildId.toString())
                      .build(),
                  CollectionDAO.EntityRelationshipObject.builder()
                      .fromId(second.getId().toString())
                      .toId(secondChildId.toString())
                      .build()));
      entity
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      eq(Entity.METRIC),
                      argThat(
                          ids ->
                              ids.containsAll(
                                  List.of(visibleChildId, hiddenChildId, secondChildId))),
                      eq(NON_DELETED)))
          .thenReturn(
              List.of(
                  metricReference(visibleChildId, "visible_child"),
                  metricReference(hiddenChildId, "restricted_child"),
                  metricReference(secondChildId, "second_child")));

      List<Metric> sanitized =
          fixture
              .repository()
              .sanitizeMetricRelations(
                  List.of(first, second),
                  reference -> !hiddenChildId.equals(reference.getId()),
                  ignored -> true);

      assertEquals(1, sanitized.get(0).getChildrenCount());
      assertEquals(1, sanitized.get(1).getChildrenCount());
      verify(fixture.relationshipDAO(), times(1))
          .findToBatch(
              anyList(), eq(Relationship.CONTAINS.ordinal()), eq(Entity.METRIC), eq(Entity.METRIC));
    }
  }

  private static EntityReference metricReference(UUID id, String name) {
    return new EntityReference().withId(id).withType(Entity.METRIC).withName(name);
  }

  private static EntityReference groupReference(UUID id, String name) {
    return new EntityReference().withId(id).withType(Entity.METRIC_GROUP).withName(name);
  }

  @Test
  void hierarchyReferenceSearchMatchesNamesAndDisplayNamesLiterally() {
    EntityReference reference =
        new EntityReference().withName("gross_margin").withDisplayName("Gross Margin %");

    assertEquals(true, MetricGroupRepository.referenceMatchesQuery(reference, "MARGIN"));
    assertEquals(true, MetricGroupRepository.referenceMatchesQuery(reference, "%"));
    assertEquals(false, MetricGroupRepository.referenceMatchesQuery(reference, "revenue"));
  }

  @Test
  void hierarchyAggregateCountsIncludeOnlyVisibleReferences() {
    EntityReference visible = new EntityReference().withId(UUID.randomUUID());
    EntityReference restricted = new EntityReference().withId(UUID.randomUUID());

    int count =
        MetricRepository.countVisibleReferences(
            List.of(restricted, visible), reference -> reference.getId().equals(visible.getId()));

    assertEquals(1, count);
  }

  @Test
  void childrenCountSingleHydrationUsesTheNonDeletedRelationshipCount() {
    Metric parent = new Metric().withId(UUID.randomUUID()).withName("parent");
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .relationshipDAO()
              .countNonDeletedChildMetrics(parent.getId(), Relationship.CONTAINS.ordinal()))
          .thenReturn(3);

      fixture.repository().setFields(parent, new Fields(Set.of("childrenCount")), null);

      assertEquals(3, parent.getChildrenCount());
    }
  }

  @Test
  void childrenCountBulkHydrationDefaultsMissingParentsToZero() {
    Metric parentWithChildren =
        new Metric().withId(UUID.randomUUID()).withName("parent_with_children");
    Metric leaf = new Metric().withId(UUID.randomUUID()).withName("leaf");
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .relationshipDAO()
              .countNonDeletedChildMetricsBatch(
                  List.of(parentWithChildren.getId().toString(), leaf.getId().toString()),
                  Relationship.CONTAINS.ordinal()))
          .thenReturn(
              List.of(
                  CollectionDAO.EntityRelationshipCount.builder()
                      .id(parentWithChildren.getId())
                      .count(2)
                      .build()));

      fixture
          .repository()
          .setFieldsInBulk(new Fields(Set.of("childrenCount")), List.of(parentWithChildren, leaf));

      assertEquals(2, parentWithChildren.getChildrenCount());
      assertEquals(0, leaf.getChildrenCount());
    }
  }

  @Test
  void metricGroupSingleHydrationClearsAGroupDeletedAfterMembershipLookup() {
    final UUID groupId = UUID.randomUUID();
    final Metric metric =
        new Metric()
            .withId(UUID.randomUUID())
            .withMetricGroup(new EntityReference().withId(groupId).withType(Entity.METRIC_GROUP));
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      when(fixture.metricDAO().findActiveGroupId(metric.getId(), Relationship.HAS.ordinal()))
          .thenReturn(groupId.toString());
      entity
          .when(() -> Entity.getEntityReferenceById(Entity.METRIC_GROUP, groupId, NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(groupId.toString()));

      fixture.repository().setFields(metric, new Fields(Set.of("metricGroup")), null);

      assertNull(metric.getMetricGroup());
    }
  }

  @Test
  void metricGroupBulkHydrationSkipsDeletedGroupsAndKeepsActiveGroups() {
    final UUID deletedGroupId = UUID.randomUUID();
    final EntityReference activeGroup =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC_GROUP);
    final Metric metricWithDeletedGroup =
        new Metric()
            .withId(UUID.randomUUID())
            .withMetricGroup(
                new EntityReference().withId(deletedGroupId).withType(Entity.METRIC_GROUP));
    final Metric metricWithActiveGroup = new Metric().withId(UUID.randomUUID());
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      when(fixture
              .metricDAO()
              .findActiveGroups(
                  List.of(
                      metricWithDeletedGroup.getId().toString(),
                      metricWithActiveGroup.getId().toString()),
                  Relationship.HAS.ordinal()))
          .thenReturn(
              List.of(
                  CollectionDAO.EntityRelationshipObject.builder()
                      .fromId(deletedGroupId.toString())
                      .toId(metricWithDeletedGroup.getId().toString())
                      .build(),
                  CollectionDAO.EntityRelationshipObject.builder()
                      .fromId(activeGroup.getId().toString())
                      .toId(metricWithActiveGroup.getId().toString())
                      .build()));
      entity
          .when(
              () -> Entity.getEntityReferenceById(Entity.METRIC_GROUP, deletedGroupId, NON_DELETED))
          .thenThrow(EntityNotFoundException.byId(deletedGroupId.toString()));
      entity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.METRIC_GROUP, activeGroup.getId(), NON_DELETED))
          .thenReturn(activeGroup);

      fixture
          .repository()
          .setFieldsInBulk(
              new Fields(Set.of("metricGroup")),
              List.of(metricWithDeletedGroup, metricWithActiveGroup));

      assertNull(metricWithDeletedGroup.getMetricGroup());
      assertEquals(activeGroup, metricWithActiveGroup.getMetricGroup());
    }
  }

  @Test
  void parentHydrationReturnsASoftDeletedParentInsteadOfFailingThePage() {
    final UUID parentId = UUID.randomUUID();
    final EntityReference deletedParent =
        new EntityReference().withId(parentId).withType(Entity.METRIC).withDeleted(true);
    final Metric child = new Metric().withId(UUID.randomUUID());
    final Metric root = new Metric().withId(UUID.randomUUID());
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      when(fixture
              .relationshipDAO()
              .findFromBatch(
                  List.of(child.getId().toString(), root.getId().toString()),
                  Relationship.CONTAINS.ordinal(),
                  Entity.METRIC,
                  NON_DELETED))
          .thenReturn(
              List.of(
                  CollectionDAO.EntityRelationshipObject.builder()
                      .fromId(parentId.toString())
                      .toId(child.getId().toString())
                      .build()));
      entity
          .when(() -> Entity.getEntityReferencesByIds(Entity.METRIC, List.of(parentId), ALL))
          .thenReturn(List.of(deletedParent));

      fixture.repository().setFieldsInBulk(new Fields(Set.of("parent")), List.of(child, root));

      assertEquals(deletedParent, child.getParent());
      assertNull(root.getParent());
    }
  }

  @Test
  void parentHydrationOfAPageWithoutParentsLeavesThemUnset() {
    final Metric root = new Metric().withId(UUID.randomUUID());
    try (RepositoryFixture fixture = repositoryFixture()) {
      when(fixture
              .relationshipDAO()
              .findFromBatch(
                  List.of(root.getId().toString()),
                  Relationship.CONTAINS.ordinal(),
                  Entity.METRIC,
                  NON_DELETED))
          .thenReturn(List.of());

      fixture.repository().setFieldsInBulk(new Fields(Set.of("parent")), List.of(root));

      assertNull(root.getParent());
    }
  }

  @Test
  void metricGroupHydrationPropagatesUnexpectedLookupFailures() {
    final UUID groupId = UUID.randomUUID();
    final Metric metric = new Metric().withId(UUID.randomUUID());
    final IllegalStateException failure = new IllegalStateException("Group lookup unavailable");
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      when(fixture.metricDAO().findActiveGroupId(metric.getId(), Relationship.HAS.ordinal()))
          .thenReturn(groupId.toString());
      entity
          .when(() -> Entity.getEntityReferenceById(Entity.METRIC_GROUP, groupId, NON_DELETED))
          .thenThrow(failure);

      assertSame(
          failure,
          assertThrows(
              IllegalStateException.class,
              () ->
                  fixture.repository().setFields(metric, new Fields(Set.of("metricGroup")), null)));
    }
  }

  @Test
  void metricWritesUseTheActiveTransactionDAOAndRestoreTheDefaultDAOAfterward() {
    try (RepositoryFixture fixture = repositoryFixture()) {
      CollectionDAO transactionDAO = mock(CollectionDAO.class);
      CollectionDAO.MetricDAO transactionMetricDAO = mock(CollectionDAO.MetricDAO.class);
      when(transactionDAO.metricDAO()).thenReturn(transactionMetricDAO);

      assertSame(fixture.metricDAO(), fixture.repository().entityDAOForWrite());
      RepositoryTransactionContext.runWith(
          transactionDAO,
          () -> assertSame(transactionMetricDAO, fixture.repository().entityDAOForWrite()));
      assertSame(fixture.metricDAO(), fixture.repository().entityDAOForWrite());
    }
  }

  @Test
  void admitRefusesMovingAMetricIntoAGroupTheAuthorCannotEdit() {
    final Metric original =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("revenue")
            .withFullyQualifiedName("revenue");
    final EntityReference group =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC_GROUP)
            .withFullyQualifiedName("finance");
    final Metric moved = JsonUtils.deepCopy(original, Metric.class).withMetricGroup(group);
    final ChangeActor actor = ChangeActor.user("alice", null);
    final Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("denied"))
        .when(authorizer)
        .authorizeActor(
            eq(actor),
            any(),
            argThat(resource -> Entity.METRIC_GROUP.equals(resource.getResource())));
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<Entity> entity = mockStatic(Entity.class, Mockito.CALLS_REAL_METHODS)) {
      entity.when(Entity::getAuthorizer).thenReturn(authorizer);
      entity
          .when(() -> Entity.getEntityRepository(Entity.METRIC_GROUP))
          .thenReturn(mock(MetricGroupRepository.class));
      entity
          .when(
              () ->
                  Entity.getEntityReferencesByIds(
                      Entity.METRIC, List.of(original.getId()), NON_DELETED))
          .thenReturn(
              List.of(
                  new EntityReference()
                      .withId(original.getId())
                      .withType(Entity.METRIC)
                      .withFullyQualifiedName("revenue")));

      // The move is checked in the write itself: EditAll on the metric that moves passes, and on
      // the group it lands in is refused.
      assertThrows(
          AuthorizationException.class,
          () ->
              fixture
                  .repository()
                  .admit(original, moved, actor, Edit.patch(Set.of("metricGroup"))));
      verify(authorizer)
          .authorizeActor(
              eq(actor), any(), argThat(resource -> Entity.METRIC.equals(resource.getResource())));
      // A PATCH stores only the fields it names, so one naming neither parent nor group is no move,
      // even where the group the write resolves differs from the stored one.
      assertDoesNotThrow(
          () ->
              fixture
                  .repository()
                  .authorizeWrite(original, moved, actor, Edit.patch(Set.of("description"))));
    }
  }

  @Test
  void aPatchMayNotSetAssetsChildrenOrChildrenCount() {
    final Metric metric = new Metric().withId(UUID.randomUUID()).withName("revenue");
    final ChangeActor actor = ChangeActor.user("alice", null);
    try (RepositoryFixture fixture = repositoryFixture()) {
      for (final String field : List.of("assets", "children", "childrenCount")) {
        final IllegalArgumentException error =
            assertThrows(
                IllegalArgumentException.class,
                () ->
                    fixture
                        .repository()
                        .authorizePatch(
                            metric,
                            Json.createPatchBuilder()
                                .add("/" + field, Json.createArrayBuilder().build())
                                .build(),
                            actor));
        assertTrue(error.getMessage().contains(field));
      }
      // Refused before the patch is applied, so whether a guess matches a linked asset is not told.
      assertThrows(
          IllegalArgumentException.class,
          () ->
              fixture
                  .repository()
                  .authorizePatch(
                      metric,
                      Json.createPatchBuilder().test("/assets/0/name", "guess").build(),
                      actor));
      assertDoesNotThrow(
          () ->
              fixture
                  .repository()
                  .authorizePatch(
                      metric,
                      Json.createPatchBuilder().replace("/description", "updated").build(),
                      actor));
    }
  }

  @Test
  void aPatchToChildrenIsRefusedForTheAdminAccountToo() {
    final Metric metric =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("revenue")
            .withFullyQualifiedName("revenue");
    try (RepositoryFixture fixture = repositoryFixture()) {
      // REST and MCP record admin as a system actor; the refusal is about the patch, not the
      // caller.
      final IllegalArgumentException refused =
          assertThrows(
              IllegalArgumentException.class,
              () ->
                  fixture
                      .repository()
                      .previewPatch(
                          metric,
                          Json.createPatchBuilder()
                              .add("/children", Json.createArrayBuilder().build())
                              .build(),
                          ChangeActor.recorded("admin", null)));
      assertTrue(refused.getMessage().contains("children"), refused.getMessage());
    }
  }

  @Test
  void metricPatchRejectsReadingARelationIntoAnotherFieldOrATest() {
    final Metric metric = new Metric().withId(UUID.randomUUID()).withName("revenue");
    final ChangeActor actor = ChangeActor.user("alice", null);
    try (RepositoryFixture fixture = repositoryFixture()) {
      final MetricRepository repository = fixture.repository();
      for (final String from :
          List.of(
              "/parent/description",
              "/metricGroup/name",
              "/relatedMetrics/0/description",
              "/children/0/name",
              "")) {
        final JsonPatch copy = Json.createPatchBuilder().copy("/description", from).build();
        final JsonPatch move = Json.createPatchBuilder().move("/displayName", from).build();
        assertThrows(
            IllegalArgumentException.class,
            () -> repository.authorizePatch(metric, copy, actor),
            from);
        assertThrows(
            IllegalArgumentException.class,
            () -> repository.authorizePatch(metric, move, actor),
            from);
      }
      for (final String path :
          List.of("", "/parent/name", "/metricGroup", "/relatedMetrics/0/name")) {
        final JsonPatch test =
            Json.createPatchBuilder().test(path, "guess").add("/description", "x").build();
        assertThrows(
            IllegalArgumentException.class,
            () -> repository.authorizePatch(metric, test, actor),
            path);
      }
      // JSON-P matches an op name ignoring case, so an upper-case test is still a test.
      final JsonPatch upperCaseTest =
          Json.createPatch(
              Json.createArrayBuilder()
                  .add(
                      Json.createObjectBuilder()
                          .add("op", "TEST")
                          .add("path", "/parent/name")
                          .add("value", "guess"))
                  .build());
      assertThrows(
          IllegalArgumentException.class,
          () -> repository.authorizePatch(metric, upperCaseTest, actor));
      // Reordering within a relation (as jsonpatch diff tools emit) and copying plain fields still
      // pass.
      repository.authorizePatch(
          metric,
          Json.createPatchBuilder().move("/relatedMetrics/0", "/relatedMetrics/1").build(),
          actor);
      repository.authorizePatch(
          metric, Json.createPatchBuilder().copy("/displayName", "/description").build(), actor);
    }
  }

  @Test
  void asyncBulkPutRefusesACreateIntoAGroupTheImpersonatedAuthorCannotEdit() throws Exception {
    final EntityReference group =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC_GROUP)
            .withFullyQualifiedName("finance");
    final Metric created =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("revenue")
            .withFullyQualifiedName("revenue")
            .withMetricGroup(group);
    final Authorizer authorizer = mock(Authorizer.class);
    final AtomicReference<String> checkedAs = new AtomicReference<>();
    doAnswer(
            invocation -> {
              checkedAs.set(ImpersonationContext.getImpersonatedBy());
              throw new AuthorizationException("denied");
            })
        .when(authorizer)
        .authorizeActor(
            any(), any(), argThat(resource -> Entity.METRIC_GROUP.equals(resource.getResource())));
    try (RepositoryFixture fixture = repositoryFixture()) {
      // Set statically, not mocked: the job runs on a pool thread a static mock does not reach.
      Entity.setAuthorizer(authorizer);
      Entity.registerEntity(
          MetricGroup.class, Entity.METRIC_GROUP, mock(MetricGroupRepository.class));
      withNoApprovalRules();
      ImpersonationContext.setImpersonatedBy("ingestion-bot");

      final BulkOperationResult result =
          fixture
              .repository()
              .submitAsyncBulkOperation(
                  null, List.of(created), "alice", new HashMap<>(), false, new ArrayList<>(), 1)
              .get(30, TimeUnit.SECONDS);

      // The refused create fails alone, before anything is stored, and isImpersonated() on the
      // job thread still sees the request's impersonation.
      assertEquals(0, result.getNumberOfRowsPassed());
      assertEquals(
          403,
          result.getFailedRequest().getFirst().getStatus(),
          result.getFailedRequest().getFirst().getMessage());
      assertEquals("ingestion-bot", checkedAs.get());
      verify(fixture.metricDAO(), never()).insertMany(anyList());
    } finally {
      ImpersonationContext.clear();
      GovernanceApprovalRegistry.invalidate();
    }
  }

  // A bulk PUT reads the approval rules even with nothing to update.
  @SuppressWarnings("unchecked")
  private static void withNoApprovalRules() {
    final GovernanceDAOs.ChangeRequestDAO changeRequests =
        mock(GovernanceDAOs.ChangeRequestDAO.class);
    when(Entity.getCollectionDAO().changeRequestDAO()).thenReturn(changeRequests);
    when(changeRequests.workflowDefinitionEpoch()).thenReturn("none");
    final EntityRepository<WorkflowDefinition> workflows = mock(EntityRepository.class);
    when(workflows.listAll(any(), any())).thenReturn(List.of());
    Entity.registerEntity(WorkflowDefinition.class, Entity.WORKFLOW_DEFINITION, workflows);
    GovernanceApprovalRegistry.invalidate();
  }

  @Test
  void platformWideExportAppliesViewPermissionsAndDomainIsolation() throws IOException {
    Metric own = exportedMetric("campaign_clicks", "Marketing", "Clicks per campaign");
    Metric foreign =
        exportedMetric(
            "ceo_bonus_pool", "Finance", "Bonus pool of the executive board, 4.2M in FY26");
    Metric denied = exportedMetric("restricted_campaign", "Marketing", "Restricted campaign");
    SubjectContext erin = domainRestrictedSubject("Marketing");
    SubjectContext admin = adminSubject();
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<SubjectContext> subjectContext = mockStatic(SubjectContext.class);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      MetricRepository repository = Mockito.spy(fixture.repository());
      Authorizer authorizer = mockAuthorizer(entity);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      Mockito.doReturn(List.of(own, foreign, denied))
          .when(repository)
          .get(any(), anyList(), any(Fields.class), eq(Include.ALL));
      doThrow(new AuthorizationException("ViewAll denied"))
          .when(authorizer)
          .authorizeActor(
              any(), any(), argThat(context -> denied.getId().equals(context.getEntity().getId())));
      Mockito.doReturn(List.of(own, foreign, denied))
          .when(repository)
          .listAll(any(Fields.class), any(ListFilter.class));
      subjectContext.when(() -> SubjectContext.getSubjectContext("erin")).thenReturn(erin);
      subjectContext.when(() -> SubjectContext.getSubjectContext("admin")).thenReturn(admin);

      String restrictedCsv = repository.exportToCsv("*", "erin", false);
      assertTrue(restrictedCsv.contains("campaign_clicks"));
      assertFalse(
          restrictedCsv.contains("ceo_bonus_pool"),
          "a domain-confined subject must not see other domains' metrics in the export");
      assertFalse(restrictedCsv.contains("Bonus pool of the executive board"));
      assertFalse(restrictedCsv.contains("restricted_campaign"));

      String adminCsv = repository.exportToCsv("*", "admin", false);
      assertTrue(adminCsv.contains("campaign_clicks"));
      assertTrue(adminCsv.contains("ceo_bonus_pool"));
      assertTrue(adminCsv.contains("restricted_campaign"));
      assertTrue(adminCsv.contains("Bonus pool of the executive board, 4.2M in FY26"));
    }
  }

  @Test
  void platformWideExportKeepsEveryRowForASubjectWithoutTheDomainRole() throws IOException {
    Metric metric = exportedMetric("campaign_clicks", "Marketing", "Clicks per campaign");
    SubjectContext plain = unrestrictedSubject();
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<SubjectContext> subjectContext = mockStatic(SubjectContext.class);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      MetricRepository repository = Mockito.spy(fixture.repository());
      mockAuthorizer(entity);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      Mockito.doReturn(List.of(metric))
          .when(repository)
          .get(any(), anyList(), any(Fields.class), eq(Include.ALL));
      Mockito.doReturn(List.of(metric))
          .when(repository)
          .listAll(any(Fields.class), any(ListFilter.class));
      subjectContext.when(() -> SubjectContext.getSubjectContext("plain")).thenReturn(plain);

      String csv = repository.exportToCsv("*", "plain", false);

      assertTrue(csv.contains("campaign_clicks"));
      assertTrue(csv.contains("Clicks per campaign"));
    }
  }

  @Test
  void adminImportSkipsHierarchyAuthorizationAndLookups() {
    SubjectContext admin = adminSubject();
    try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class);
        MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      subjects.when(() -> SubjectContext.getSubjectContext("admin")).thenReturn(admin);
      entity
          .when(() -> Entity.getEntityRepository(Entity.METRIC))
          .thenThrow(new AssertionError("An admin row must not load hierarchy authorization data"));
      assertDoesNotThrow(
          () ->
              new MetricRepository.MetricCsv("admin")
                  .authorizeRow(
                      new Metric().withId(UUID.randomUUID()),
                      new Metric().withParent(new EntityReference())));
    }
  }

  @Test
  void importRowDefersToTheConfiguredAuthorizer() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      entity.when(Entity::getAuthorizer).thenReturn(new NoopAuthorizer());
      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank");
      stubStoredHierarchy(repository, stored);
      EntityReference parent =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("revenue");
      entity
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.METRIC, "revenue", "metricGroup", Include.NON_DELETED))
          .thenReturn(
              new Metric()
                  .withId(parent.getId())
                  .withName("revenue")
                  .withFullyQualifiedName("revenue"));

      assertDoesNotThrow(
          () ->
              nonAdminMetricCsv("anonymous")
                  .authorizeRow(stored, new Metric().withName("m_hank").withParent(parent)));
      assertDoesNotThrow(
          () ->
              nonAdminMetricCsv("anonymous")
                  .authorizeRow(null, new Metric().withName("new_metric")));
    }
  }

  private MetricRepository.MetricCsv nonAdminMetricCsv(String user) {
    return new MetricRepository.MetricCsv(user) {
      @Override
      protected boolean checksRowWrites() {
        return true;
      }
    };
  }

  private static Authorizer mockAuthorizer(MockedStatic<Entity> entity) {
    Authorizer authorizer = mock(Authorizer.class);
    entity.when(Entity::getAuthorizer).thenReturn(authorizer);
    return authorizer;
  }

  private void stubStoredHierarchy(MetricRepository repository, Metric stored) {
    // getFields on the mock returns null, so match the fields argument with the null-tolerant any()
    when(repository.get(any(), eq(stored.getId()), any(), any(Include.class), anyBoolean()))
        .thenReturn(stored);
  }

  private Metric exportedMetric(String name, String domain, String description) {
    return new Metric()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withDescription(description)
        .withDomains(List.of(domainRef(domain)));
  }

  /**
   * A subject narrowed to {@code visibleDomains}: the role predicate a real DomainOnlyAccessRole
   * subject answers true to and the domain hierarchy check answered from the given FQNs. Built as
   * a mock because the static SubjectContext mock in these tests also intercepts the private
   * static role lookup a real subject would use.
   */
  private SubjectContext domainRestrictedSubject(String... visibleDomains) {
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.isAdmin()).thenReturn(false);
    when(subject.hasDomainOnlyAccessRole()).thenReturn(true);
    when(subject.hasDomains(any()))
        .thenAnswer(invocation -> hasAnyDomain(invocation.getArgument(0), visibleDomains));
    return subject;
  }

  private SubjectContext unrestrictedSubject() {
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.isAdmin()).thenReturn(false);
    when(subject.hasDomainOnlyAccessRole()).thenReturn(false);
    return subject;
  }

  private SubjectContext adminSubject() {
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.isAdmin()).thenReturn(true);
    return subject;
  }

  private boolean hasAnyDomain(List<EntityReference> domains, String... visibleDomains) {
    return domains != null
        && domains.stream()
            .anyMatch(domain -> List.of(visibleDomains).contains(domain.getFullyQualifiedName()));
  }

  private static EntityReference domainRef(String fqn) {
    return new EntityReference().withFullyQualifiedName(fqn).withType(Entity.DOMAIN);
  }

  private RepositoryFixture repositoryFixture() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.MetricDAO metricDAO = mock(CollectionDAO.MetricDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.metricDAO()).thenReturn(metricDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(collectionDAO);
    return new RepositoryFixture(new MetricRepository(), metricDAO, relationshipDAO);
  }

  private Metric metric(UUID metricId, UUID parentId) {
    return new Metric()
        .withId(metricId)
        .withName("revenue")
        .withFullyQualifiedName("revenue")
        .withParent(
            new EntityReference()
                .withId(parentId)
                .withType(Entity.METRIC)
                .withName("parent")
                .withFullyQualifiedName("parent"));
  }

  private CollectionDAO.EntityRelationshipRecord relationship(UUID ancestorId) {
    return CollectionDAO.EntityRelationshipRecord.builder()
        .id(ancestorId)
        .type(Entity.METRIC)
        .build();
  }

  private IllegalArgumentException invokeHierarchyValidation(
      MetricRepository repository, Metric metric) throws NoSuchMethodException {
    Method validation = MetricRepository.class.getDeclaredMethod("validateHierarchy", Metric.class);
    validation.setAccessible(true);
    InvocationTargetException invocation =
        assertThrows(InvocationTargetException.class, () -> validation.invoke(repository, metric));
    return assertInstanceOf(IllegalArgumentException.class, invocation.getCause());
  }

  private record RepositoryFixture(
      MetricRepository repository,
      CollectionDAO.MetricDAO metricDAO,
      CollectionDAO.EntityRelationshipDAO relationshipDAO)
      implements AutoCloseable {
    @Override
    public void close() {
      Entity.cleanup();
    }
  }
}
