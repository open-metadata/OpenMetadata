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

package org.openmetadata.service.resources.metrics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Method;
import java.security.Principal;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricHierarchyContext;
import org.openmetadata.schema.api.data.MetricHierarchyItem;
import org.openmetadata.schema.api.data.MetricObservability;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

class MetricResourceTest {

  @Test
  void hierarchyFilterDistinguishesAllRootsAndOneParentsChildren() {
    UUID parentId = UUID.randomUUID();
    try (ResourceFixture fixture = resourceFixture()) {
      fixture
          .entity()
          .when(
              () -> Entity.getEntityReferenceByName(Entity.METRIC, "revenue", Include.NON_DELETED))
          .thenReturn(
              new EntityReference()
                  .withId(parentId)
                  .withType(Entity.METRIC)
                  .withFullyQualifiedName("revenue"));
      ListFilter all = new ListFilter();
      ListFilter roots = new ListFilter();
      ListFilter children = new ListFilter();

      fixture.resource().addHierarchyFilter(all, null);
      fixture.resource().addHierarchyFilter(roots, "null");
      fixture.resource().addHierarchyFilter(children, "revenue");

      assertEquals(null, all.getQueryParam("rootMetrics"));
      assertEquals("true", roots.getQueryParam("rootMetrics"));
      assertEquals(parentId.toString(), children.getQueryParam("parentMetricId"));
    }
  }

  @Test
  void hierarchyMutationDetectionUsesParentAndGroupIdentity() {
    UUID parentId = UUID.randomUUID();
    UUID groupId = UUID.randomUUID();
    Metric original =
        new Metric()
            .withParent(new EntityReference().withId(parentId))
            .withMetricGroup(new EntityReference().withId(groupId));
    Metric same =
        new Metric()
            .withParent(new EntityReference().withId(parentId).withName("renamed-parent"))
            .withMetricGroup(new EntityReference().withId(groupId).withName("renamed-group"));
    Metric moved =
        new Metric()
            .withParent(new EntityReference().withId(UUID.randomUUID()))
            .withMetricGroup(new EntityReference().withId(groupId));

    assertFalse(MetricResource.hierarchyMembershipChanged(original, same));
    assertTrue(MetricResource.hierarchyMembershipChanged(original, moved));
  }

  @Test
  void hierarchyDestinationAuthorizationCoversTheResolvedParentAndGroup() {
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
    Metric updated = new Metric().withParent(parent).withMetricGroup(group);

    assertEquals(List.of(parent, group), MetricResource.hierarchyDestinations(null, updated));
    assertEquals(
        List.of(),
        MetricResource.hierarchyDestinations(
            new Metric().withParent(parent).withMetricGroup(group), updated));
    assertEquals(List.of(), MetricResource.hierarchyDestinations(null, new Metric()));

    try (ResourceFixture fixture = resourceFixture()) {
      ArgumentCaptor<OperationContext> operations = ArgumentCaptor.forClass(OperationContext.class);
      ArgumentCaptor<ResourceContextInterface> resources =
          ArgumentCaptor.forClass(ResourceContextInterface.class);

      fixture.resource().authorizeHierarchyDestinations(mock(SecurityContext.class), null, updated);

      verify(fixture.authorizer(), times(2))
          .authorize(any(), operations.capture(), resources.capture());
      assertEquals(
          Set.of(Entity.METRIC, Entity.METRIC_GROUP),
          operations.getAllValues().stream()
              .map(OperationContext::getResource)
              .collect(Collectors.toSet()));
      assertEquals(
          Set.of(Entity.METRIC, Entity.METRIC_GROUP),
          resources.getAllValues().stream()
              .map(ResourceContextInterface::getResource)
              .collect(Collectors.toSet()));
      for (int index = 0; index < operations.getAllValues().size(); index++) {
        assertEquals(
            List.of(MetadataOperation.EDIT_ALL),
            operations
                .getAllValues()
                .get(index)
                .getOperations(resources.getAllValues().get(index)));
      }
    }
  }

  @Test
  void metricPatchRejectsRelationshipDerivedFieldsAndDetectsHierarchyPaths() {
    jakarta.json.JsonPatch assets =
        Json.createPatchBuilder().add("/assets", Json.createArrayBuilder().build()).build();
    jakarta.json.JsonPatch children =
        Json.createPatchBuilder().add("/children", Json.createArrayBuilder().build()).build();
    jakarta.json.JsonPatch childrenCount =
        Json.createPatchBuilder().add("/childrenCount", 2).build();
    jakarta.json.JsonPatch parent =
        Json.createPatchBuilder()
            .add(
                "/parent",
                Json.createObjectBuilder().add("id", UUID.randomUUID().toString()).build())
            .build();

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class, () -> MetricResource.validateMetricPatch(assets));

    assertTrue(exception.getMessage().contains("assets"));
    assertThrows(
        IllegalArgumentException.class, () -> MetricResource.validateMetricPatch(children));
    assertThrows(
        IllegalArgumentException.class, () -> MetricResource.validateMetricPatch(childrenCount));
    assertTrue(MetricResource.patchMutatesHierarchy(parent));
    assertFalse(MetricResource.patchMutatesHierarchy(assets));
  }

  @Test
  void hierarchyEndpointsPreserveIndependentZeroSizedPages() throws Exception {
    Method hierarchy =
        MetricResource.class.getMethod(
            "getHierarchyContext",
            jakarta.ws.rs.core.SecurityContext.class,
            UUID.class,
            int.class,
            int.class,
            int.class,
            int.class);

    Min childLimit =
        Arrays.stream(hierarchy.getParameterAnnotations()[2])
            .filter(Min.class::isInstance)
            .map(Min.class::cast)
            .findFirst()
            .orElseThrow();
    Min siblingLimit =
        Arrays.stream(hierarchy.getParameterAnnotations()[4])
            .filter(Min.class::isInstance)
            .map(Min.class::cast)
            .findFirst()
            .orElseThrow();

    assertEquals(0, childLimit.value());
    assertEquals(0, siblingLimit.value());
  }

  @Test
  void hierarchyContextDelegatesZeroLimitsWithoutCoercion() {
    UUID metricId = UUID.randomUUID();
    MetricHierarchyContext expected = new MetricHierarchyContext();
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().get(any(), eq(metricId), any()))
          .thenReturn(
              new Metric().withId(metricId).withName("revenue").withFullyQualifiedName("revenue"));
      when(fixture
              .repository()
              .getHierarchyContext(eq(metricId), eq(0), eq(4), eq(0), eq(7), any(), any()))
          .thenReturn(expected);

      MetricHierarchyContext actual =
          fixture
              .resource()
              .getHierarchyContext(
                  mock(jakarta.ws.rs.core.SecurityContext.class), metricId, 0, 4, 0, 7);

      assertEquals(expected, actual);
      verify(fixture.repository())
          .getHierarchyContext(eq(metricId), eq(0), eq(4), eq(0), eq(7), any(), any());
    }
  }

  @Test
  void hierarchyListAuthorizesAndPreservesOffsetPaging() {
    ResultList<MetricHierarchyItem> expected =
        new ResultList<>(List.of(), new Paging().withLimit(25).withOffset(50).withTotal(0));
    try (ResourceFixture fixture = resourceFixture()) {
      SecurityContext securityContext = securityContext("alice");
      when(fixture.authorizer().getPermission(securityContext, "alice", Entity.METRIC))
          .thenReturn(viewPermission(Entity.METRIC, Permission.Access.CONDITIONAL_ALLOW));
      when(fixture.authorizer().getPermission(securityContext, "alice", Entity.METRIC_GROUP))
          .thenReturn(viewPermission(Entity.METRIC_GROUP, Permission.Access.ALLOW));
      when(fixture.repository().listHierarchy(eq(25), eq(50), eq("margin"), any(), any()))
          .thenReturn(expected);

      ResultList<MetricHierarchyItem> actual =
          fixture.resource().listHierarchy(securityContext, "margin", 25, 50);

      assertEquals(expected, actual);
      verify(fixture.repository()).listHierarchy(eq(25), eq(50), eq("margin"), any(), any());
      verify(fixture.authorizer()).authorize(any(), any(), any());
    }
  }

  @Test
  void hierarchyListUsesDatabasePagingWhenMetricsAndGroupsAreUnconditionallyVisible() {
    ResultList<MetricHierarchyItem> expected =
        new ResultList<>(List.of(), new Paging().withLimit(25).withOffset(50).withTotal(0));
    try (ResourceFixture fixture = resourceFixture()) {
      SecurityContext securityContext = securityContext("alice");
      when(fixture.authorizer().getPermission(securityContext, "alice", Entity.METRIC))
          .thenReturn(viewPermission(Entity.METRIC, Permission.Access.ALLOW));
      when(fixture.authorizer().getPermission(securityContext, "alice", Entity.METRIC_GROUP))
          .thenReturn(viewPermission(Entity.METRIC_GROUP, Permission.Access.ALLOW));
      when(fixture.repository().listHierarchy(25, 50, "margin")).thenReturn(expected);

      ResultList<MetricHierarchyItem> actual =
          fixture.resource().listHierarchy(securityContext, "margin", 25, 50);

      assertEquals(expected, actual);
      verify(fixture.repository()).listHierarchy(25, 50, "margin");
      verify(fixture.repository(), never())
          .listHierarchy(eq(25), eq(50), eq("margin"), any(), any());
    }
  }

  @Test
  void assetsListRejectsMissingMetricBeforeScanningRelationships() {
    UUID metricId = UUID.randomUUID();
    EntityNotFoundException missing = EntityNotFoundException.byId(metricId.toString());
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().get(any(), eq(metricId), any())).thenThrow(missing);

      EntityNotFoundException thrown =
          assertThrows(
              EntityNotFoundException.class,
              () ->
                  fixture
                      .resource()
                      .getAssets(
                          null, mock(SecurityContext.class), metricId, 20, 0, null, null, null));

      assertEquals(missing, thrown);
      verify(fixture.repository(), never())
          .listAssets(eq(metricId), anyInt(), anyInt(), any(), any(), any(), any());
    }
  }

  @Test
  void observabilityRejectsMissingMetricBeforeScanningRelationships() {
    UUID metricId = UUID.randomUUID();
    EntityNotFoundException missing = EntityNotFoundException.byId(metricId.toString());
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().get(any(), eq(metricId), any())).thenThrow(missing);

      EntityNotFoundException thrown =
          assertThrows(
              EntityNotFoundException.class,
              () ->
                  fixture.resource().getObservability(null, mock(SecurityContext.class), metricId));

      assertEquals(missing, thrown);
      verify(fixture.repository(), never()).getAssetsWithDirection(metricId);
      verify(fixture.repository(), never()).getObservability(eq(metricId), any(), any());
    }
  }

  @Test
  void observabilityReusesTheAuthorizedLinkedAssets() {
    UUID metricId = UUID.randomUUID();
    EntityReference table =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE)
            .withName("orders")
            .withFullyQualifiedName("service.database.schema.orders");
    List<MetricAssetDirection> linkedAssets =
        List.of(
            new MetricAssetDirection()
                .withAsset(table)
                .withDirection(MetricAssetDirection.Direction.UPSTREAM));
    MetricObservability expected = new MetricObservability();
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().get(any(), eq(metricId), any()))
          .thenReturn(new Metric().withId(metricId).withName("revenue"));
      when(fixture.repository().getAssetsWithDirection(metricId)).thenReturn(linkedAssets);
      when(fixture.repository().getObservability(metricId, linkedAssets, Set.of(table.getId())))
          .thenReturn(expected);

      MetricObservability actual =
          fixture.resource().getObservability(null, mock(SecurityContext.class), metricId);

      assertEquals(expected, actual);
      verify(fixture.repository(), times(1)).getAssetsWithDirection(metricId);
      verify(fixture.repository()).getObservability(metricId, linkedAssets, Set.of(table.getId()));
    }
  }

  @Test
  void customUnitsRequireMetricViewBeforeReadingCatalogValues() {
    SecurityContext securityContext = securityContext("alice");
    AuthorizationException denied = new AuthorizationException("denied");
    try (ResourceFixture fixture = resourceFixture()) {
      doThrow(denied)
          .when(fixture.authorizer())
          .authorize(eq(securityContext), any(OperationContext.class), any());

      AuthorizationException thrown =
          assertThrows(
              AuthorizationException.class,
              () -> fixture.resource().getCustomUnitsOfMeasurement(securityContext));

      assertEquals(denied, thrown);
      ArgumentCaptor<OperationContext> operation = ArgumentCaptor.forClass(OperationContext.class);
      ArgumentCaptor<ResourceContextInterface> resource =
          ArgumentCaptor.forClass(ResourceContextInterface.class);
      verify(fixture.authorizer())
          .authorize(eq(securityContext), operation.capture(), resource.capture());
      assertEquals(Entity.METRIC, operation.getValue().getResource());
      assertEquals(
          List.of(MetadataOperation.VIEW_BASIC),
          operation.getValue().getOperations(resource.getValue()));
      verify(fixture.repository(), never()).getDistinctCustomUnitsOfMeasurement();
    }
  }

  @Test
  void bulkResponseAndAuthorizationFailureMergingCoverAllStatuses() {
    EntityReference denied =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE).withName("orders");
    BulkResponse denial = new BulkResponse().withRequest(denied).withMessage("denied");
    try (ResourceFixture fixture = resourceFixture()) {
      BulkOperationResult partial =
          fixture
              .resource()
              .mergeAuthorizationFailures(
                  new BulkOperationResult()
                      .withStatus(ApiStatus.SUCCESS)
                      .withNumberOfRowsProcessed(1)
                      .withNumberOfRowsPassed(1),
                  List.of(denial));
      BulkOperationResult failure =
          fixture
              .resource()
              .mergeAuthorizationFailures(
                  new BulkOperationResult().withStatus(ApiStatus.SUCCESS), List.of(denial));
      BulkOperationResult dryRun =
          fixture.resource().emptyBulkResult(new BulkAssets().withDryRun(true));

      assertEquals(ApiStatus.PARTIAL_SUCCESS, partial.getStatus());
      assertEquals(2, partial.getNumberOfRowsProcessed());
      assertEquals(1, partial.getNumberOfRowsFailed());
      assertEquals(ApiStatus.FAILURE, failure.getStatus());
      assertEquals(1, failure.getNumberOfRowsProcessed());
      assertEquals(ApiStatus.SUCCESS, dryRun.getStatus());
      assertTrue(dryRun.getDryRun());
      assertEquals(
          Response.Status.BAD_REQUEST.getStatusCode(),
          fixture.resource().buildBulkOperationResponse(failure).getStatus());
      assertEquals(
          Response.Status.OK.getStatusCode(),
          fixture.resource().buildBulkOperationResponse(partial).getStatus());
    }
  }

  @Test
  void constructorRegistersTheMetricEntityContract() {
    try (ResourceFixture fixture = resourceFixture()) {
      fixture.entity().verify(() -> Entity.getEntityRepository(Entity.METRIC));
      fixture.entity().verify(() -> Entity.getEntityClassFromType(Entity.METRIC));
      fixture.entity().verify(() -> Entity.registerResourcePermissions(Entity.METRIC, List.of()));
      assertNotNull(fixture.resource());
      assertFalse(fixture.resource().getRepository().getAllowedFields().isEmpty());
    }
  }

  private SecurityContext securityContext(String name) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(name);
    SecurityContext context = mock(SecurityContext.class);
    when(context.getUserPrincipal()).thenReturn(principal);
    return context;
  }

  private ResourcePermission viewPermission(String resource, Permission.Access access) {
    return new ResourcePermission()
        .withResource(resource)
        .withPermissions(
            List.of(
                new Permission().withOperation(MetadataOperation.VIEW_BASIC).withAccess(access)));
  }

  private ResourceFixture resourceFixture() {
    MockedStatic<Entity> entity = mockStatic(Entity.class);
    MetricRepository repository = mock(MetricRepository.class);
    Authorizer authorizer = mock(Authorizer.class);
    when(repository.getAllowedFields())
        .thenReturn(Set.of("id", "parent", "children", "relatedMetrics"));
    when(repository.getFields(anyString()))
        .thenReturn(org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
    entity.when(() -> Entity.getEntityRepository(Entity.METRIC)).thenReturn(repository);
    entity.when(() -> Entity.getEntityClassFromType(Entity.METRIC)).thenReturn(Metric.class);
    try {
      return new ResourceFixture(
          new MetricResource(authorizer, mock(Limits.class)), repository, authorizer, entity);
    } catch (RuntimeException exception) {
      entity.close();
      throw exception;
    }
  }

  private record ResourceFixture(
      MetricResource resource,
      MetricRepository repository,
      Authorizer authorizer,
      MockedStatic<Entity> entity)
      implements AutoCloseable {
    @Override
    public void close() {
      entity.close();
    }
  }
}
