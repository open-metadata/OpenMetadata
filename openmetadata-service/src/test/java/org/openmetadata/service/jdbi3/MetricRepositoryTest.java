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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricHierarchyItem;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
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
  void platformWideExportNarrowsRowsToTheSubjectDomains() throws IOException {
    Metric own = exportedMetric("campaign_clicks", "Marketing", "Clicks per campaign");
    Metric foreign =
        exportedMetric(
            "ceo_bonus_pool", "Finance", "Bonus pool of the executive board, 4.2M in FY26");
    SubjectContext erin = domainRestrictedSubject("Marketing");
    SubjectContext admin = adminSubject();
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<SubjectContext> subjectContext = mockStatic(SubjectContext.class)) {
      MetricRepository repository = Mockito.spy(fixture.repository());
      Mockito.doReturn(List.of(own, foreign))
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

      String adminCsv = repository.exportToCsv("*", "admin", false);
      assertTrue(adminCsv.contains("campaign_clicks"));
      assertTrue(adminCsv.contains("ceo_bonus_pool"));
      assertTrue(adminCsv.contains("Bonus pool of the executive board, 4.2M in FY26"));
    }
  }

  @Test
  void platformWideExportKeepsEveryRowForASubjectWithoutTheDomainRole() throws IOException {
    Metric metric = exportedMetric("campaign_clicks", "Marketing", "Clicks per campaign");
    SubjectContext plain = unrestrictedSubject();
    try (RepositoryFixture fixture = repositoryFixture();
        MockedStatic<SubjectContext> subjectContext = mockStatic(SubjectContext.class)) {
      MetricRepository repository = Mockito.spy(fixture.repository());
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
  void importRowAuthorizesAnUpdateAgainstTheStoredMetric() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      AtomicReference<OperationContext> operation = new AtomicReference<>();
      AtomicReference<ResourceContextInterface> context = new AtomicReference<>();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                operation.set(invocation.getArgument(1));
                context.set(invocation.getArgument(2));
                return null;
              });

      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank");
      Metric incoming = new Metric().withName("m_hank");
      new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming);

      assertEquals(
          List.of(MetadataOperation.EDIT_ALL), operation.get().getOperations(context.get()));
      assertEquals(Entity.METRIC, context.get().getResource());
      assertInstanceOf(ResourceContext.class, context.get());
    }
  }

  @Test
  void importRowAuthorizesACreateAgainstTheIncomingMetric() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      AtomicReference<OperationContext> operation = new AtomicReference<>();
      AtomicReference<ResourceContextInterface> context = new AtomicReference<>();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                operation.set(invocation.getArgument(1));
                context.set(invocation.getArgument(2));
                return null;
              });

      Metric incoming = new Metric().withName("new_finance_metric");
      new MetricRepository.MetricCsv("erin").authorizeRow(null, incoming);

      assertEquals(List.of(MetadataOperation.CREATE), operation.get().getOperations(context.get()));
      assertInstanceOf(CreateResourceContext.class, context.get());
      assertSame(incoming, context.get().getEntity());
    }
  }

  @Test
  void importRowPropagatesTheAuthorizationDenial() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenThrow(new AuthorizationException("operation EditAll denied by test policy"));

      Metric stored = new Metric().withId(UUID.randomUUID()).withName("ceo_bonus_pool");
      Metric incoming = new Metric().withName("ceo_bonus_pool");

      AuthorizationException thrown =
          assertThrows(
              AuthorizationException.class,
              () -> new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming));
      assertTrue(thrown.getMessage().contains("EditAll denied"));
    }
  }

  @Test
  void importRowAuthorizesTheSubtreeAndDestinationsOfAMove() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      List<OperationContext> operations = new ArrayList<>();
      List<ResourceContextInterface> contexts = new ArrayList<>();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                operations.add(invocation.getArgument(1));
                contexts.add(invocation.getArgument(2));
                return null;
              });

      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank");
      stubStoredHierarchy(repository, stored);
      EntityReference self =
          new EntityReference()
              .withId(stored.getId())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("m_hank");
      when(repository.hierarchySubtree(stored.getId())).thenReturn(List.of(self));
      EntityReference parent =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("revenue");
      EntityReference group =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.METRIC_GROUP)
              .withFullyQualifiedName("profitability");
      Metric incoming = new Metric().withName("m_hank").withParent(parent).withMetricGroup(group);

      new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming);

      // The same authorizations a PATCH of this move faces: the row target, the old subtree, then
      // each new destination with its own entity type.
      assertEquals(4, contexts.size());
      for (int index = 1; index < contexts.size(); index++) {
        assertEquals(
            List.of(MetadataOperation.EDIT_ALL),
            operations.get(index).getOperations(contexts.get(index)));
      }
      assertEquals(Entity.METRIC, contexts.get(1).getResource());
      assertEquals(Entity.METRIC, contexts.get(2).getResource());
      assertEquals(Entity.METRIC_GROUP, contexts.get(3).getResource());
    }
  }

  @Test
  void importRowPropagatesADeniedHierarchyDestination() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank");
      stubStoredHierarchy(repository, stored);
      EntityReference self =
          new EntityReference()
              .withId(stored.getId())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("m_hank");
      when(repository.hierarchySubtree(stored.getId())).thenReturn(List.of(self));
      EntityReference parent =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("revenue");
      AtomicInteger calls = new AtomicInteger();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                // Calls: row target, subtree, destination. Only the destination may deny here.
                if (calls.incrementAndGet() == 3) {
                  throw new AuthorizationException(
                      "operation EditAll denied by test policy on the destination");
                }
                return null;
              });

      Metric incoming = new Metric().withName("m_hank").withParent(parent);

      AuthorizationException thrown =
          assertThrows(
              AuthorizationException.class,
              () -> new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming));
      assertTrue(thrown.getMessage().contains("destination"));
    }
  }

  @Test
  void importRowWithoutHierarchyChangeSkipsDestinationChecks() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      AtomicInteger calls = new AtomicInteger();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                calls.incrementAndGet();
                return null;
              });

      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank");
      stubStoredHierarchy(repository, stored);
      Metric incoming = new Metric().withName("m_hank").withDescription("new description");

      new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming);

      // Only the row-target check: no subtree or destination lookups for a plain field update.
      assertEquals(1, calls.get());
    }
  }

  @Test
  void importRowSkipsHierarchyChecksForUnchangedParentedMetric() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      EntityReference parent =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("revenue");
      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank").withParent(parent);
      stubStoredHierarchy(repository, stored);
      AtomicInteger calls = new AtomicInteger();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                calls.incrementAndGet();
                return null;
              });

      // The row carries the parent the stored metric already has, as an unchanged export would.
      Metric incoming = new Metric().withName("m_hank").withParent(parent);
      new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming);

      assertEquals(
          1,
          calls.get(),
          "re-importing an unchanged parented metric must cost only the row-target check");
      verify(repository, never()).hierarchySubtree(any());
    }
  }

  @Test
  void importRowAuthorizesSubtreeWhenAParentedMetricMovesToRoot() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      MetricRepository repository = mock(MetricRepository.class);
      entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
      List<OperationContext> operations = new ArrayList<>();
      List<ResourceContextInterface> contexts = new ArrayList<>();
      authorizer
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                operations.add(invocation.getArgument(1));
                contexts.add(invocation.getArgument(2));
                return null;
              });
      EntityReference parent =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("revenue");
      Metric stored = new Metric().withId(UUID.randomUUID()).withName("m_hank").withParent(parent);
      stubStoredHierarchy(repository, stored);
      EntityReference self =
          new EntityReference()
              .withId(stored.getId())
              .withType(Entity.METRIC)
              .withFullyQualifiedName("m_hank");
      when(repository.hierarchySubtree(stored.getId())).thenReturn(List.of(self));

      // The parent column is empty, so the metric moves to the root — the move PATCH authorizes
      // only with EditAll on the subtree being moved.
      Metric incoming = new Metric().withName("m_hank");
      new MetricRepository.MetricCsv("erin").authorizeRow(stored, incoming);

      assertEquals(2, contexts.size());
      assertEquals(
          List.of(MetadataOperation.EDIT_ALL), operations.get(1).getOperations(contexts.get(1)));
      assertEquals(Entity.METRIC, contexts.get(1).getResource());
    }
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
