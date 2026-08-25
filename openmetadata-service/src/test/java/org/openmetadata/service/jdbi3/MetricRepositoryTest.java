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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricHierarchyItem;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
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
  void defaultStatusReflectsReviewersAndPreservesExplicitUpdates() {
    try (RepositoryFixture fixture = repositoryFixture()) {
      Metric withoutReviewers = new Metric();
      Metric withReviewers =
          new Metric()
              .withReviewers(
                  List.of(
                      new EntityReference()
                          .withId(UUID.randomUUID())
                          .withType(Entity.USER)
                          .withName("reviewer")));
      Metric explicitUpdate = new Metric().withEntityStatus(EntityStatus.IN_REVIEW);

      fixture.repository().setDefaultStatus(withoutReviewers, false);
      fixture.repository().setDefaultStatus(withReviewers, false);
      fixture.repository().setDefaultStatus(explicitUpdate, true);

      assertEquals(EntityStatus.APPROVED, withoutReviewers.getEntityStatus());
      assertEquals(EntityStatus.DRAFT, withReviewers.getEntityStatus());
      assertEquals(EntityStatus.IN_REVIEW, explicitUpdate.getEntityStatus());
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
