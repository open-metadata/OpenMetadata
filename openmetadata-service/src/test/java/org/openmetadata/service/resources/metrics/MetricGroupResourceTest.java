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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.validation.constraints.Min;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Method;
import java.security.Principal;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MetricGroupRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

class MetricGroupResourceTest {

  @Test
  void deleteByIdRefreshesMembersAfterTheDeleteCommits() {
    UUID groupId = UUID.randomUUID();
    MetricGroup snapshot = groupWithMember(groupId, "profitability");
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().getWithMembers(groupId, Include.ALL)).thenReturn(snapshot);
      when(fixture.repository().delete("alice", groupId, false, false))
          .thenReturn(
              new DeleteResponse<>(snapshot.withDeleted(true), EventType.ENTITY_SOFT_DELETED));

      Response response = fixture.resource().delete(null, securityContext("alice"), false, groupId);

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      InOrder lifecycle = inOrder(fixture.repository());
      lifecycle.verify(fixture.repository()).getWithMembers(groupId, Include.ALL);
      lifecycle.verify(fixture.repository()).delete("alice", groupId, false, false);
      lifecycle.verify(fixture.repository()).refreshMembersAfterGroupLifecycle(snapshot);
    }
  }

  @Test
  void deleteByNameRefreshesMembersAfterTheDeleteCommits() {
    String groupName = "profitability";
    MetricGroup snapshot = groupWithMember(UUID.randomUUID(), groupName);
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().getByNameWithMembers(groupName, Include.ALL)).thenReturn(snapshot);
      when(fixture.repository().deleteByName("alice", groupName, false, false))
          .thenReturn(
              new DeleteResponse<>(snapshot.withDeleted(true), EventType.ENTITY_SOFT_DELETED));

      Response response =
          fixture.resource().delete(null, securityContext("alice"), false, groupName);

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      InOrder lifecycle = inOrder(fixture.repository());
      lifecycle.verify(fixture.repository()).getByNameWithMembers(groupName, Include.ALL);
      lifecycle.verify(fixture.repository()).deleteByName("alice", groupName, false, false);
      lifecycle.verify(fixture.repository()).refreshMembersAfterGroupLifecycle(snapshot);
    }
  }

  @Test
  void restoreDelegatesMemberRefreshToThePostCommitRepositoryHook() {
    UUID groupId = UUID.randomUUID();
    MetricGroup restored = groupWithMember(groupId, "profitability").withDeleted(false);
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().restoreEntity("alice", groupId))
          .thenReturn(new PutResponse<>(Response.Status.OK, restored, EventType.ENTITY_RESTORED));

      Response response =
          fixture
              .resource()
              .restore(null, securityContext("alice"), new RestoreEntity().withId(groupId));

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      InOrder lifecycle = inOrder(fixture.repository());
      lifecycle.verify(fixture.repository()).restoreEntity("alice", groupId);
      lifecycle.verify(fixture.repository()).restoreFromSearch(restored);
      verify(fixture.repository(), never())
          .refreshMembersAfterGroupLifecycle(any(MetricGroup.class));
    }
  }

  @Test
  void memberListPreservesSearchRootFilterAndOffsetPaging() {
    UUID groupId = UUID.randomUUID();
    MetricGroup group =
        new MetricGroup()
            .withId(groupId)
            .withName("profitability")
            .withFullyQualifiedName("profitability");
    ResultList<Metric> expected =
        new ResultList<>(List.of(), new Paging().withLimit(15).withOffset(30).withTotal(0));
    try (ResourceFixture fixture = resourceFixture()) {
      SecurityContext securityContext = securityContext("alice");
      when(fixture.repository().get(any(), eq(groupId), any())).thenReturn(group);
      when(fixture.authorizer().getPermission(securityContext, "alice", Entity.METRIC))
          .thenReturn(metricViewPermission(Permission.Access.CONDITIONAL_ALLOW));
      when(fixture
              .repository()
              .listMetrics(eq(groupId), eq(15), eq(30), eq("margin"), eq(true), any()))
          .thenReturn(expected);

      ResultList<Metric> actual =
          fixture.resource().listMetrics(securityContext, groupId, "margin", true, 15, 30);

      assertEquals(expected, actual);
      verify(fixture.authorizer()).authorize(any(), any(), any());
      verify(fixture.repository())
          .listMetrics(eq(groupId), eq(15), eq(30), eq("margin"), eq(true), any());
    }
  }

  @Test
  void memberListUsesDatabasePagingForUnconditionalMetricVisibility() {
    UUID groupId = UUID.randomUUID();
    MetricGroup group =
        new MetricGroup()
            .withId(groupId)
            .withName("profitability")
            .withFullyQualifiedName("profitability");
    ResultList<Metric> expected =
        new ResultList<>(List.of(), new Paging().withLimit(15).withOffset(30).withTotal(0));
    try (ResourceFixture fixture = resourceFixture()) {
      SecurityContext securityContext = securityContext("alice");
      when(fixture.repository().get(any(), eq(groupId), any())).thenReturn(group);
      when(fixture.authorizer().getPermission(securityContext, "alice", Entity.METRIC))
          .thenReturn(metricViewPermission(Permission.Access.ALLOW));
      when(fixture.repository().listMetrics(groupId, 15, 30, "margin", false)).thenReturn(expected);

      ResultList<Metric> actual =
          fixture.resource().listMetrics(securityContext, groupId, "margin", false, 15, 30);

      assertEquals(expected, actual);
      verify(fixture.repository()).listMetrics(groupId, 15, 30, "margin", false);
      verify(fixture.repository(), never())
          .listMetrics(eq(groupId), eq(15), eq(30), eq("margin"), eq(false), any());
    }
  }

  @Test
  void genericMetricGroupResponsesNeverExposeEmbeddedMembers() {
    MetricGroup group = groupWithMember(UUID.randomUUID(), "profitability");
    Response response = Response.ok(group).build();

    Response sanitized = MetricGroupResource.withoutMembers(response);

    assertEquals(response, sanitized);
    assertNull(((MetricGroup) sanitized.getEntity()).getMetrics());
  }

  @Test
  void memberPagingParametersRejectNegativeOffsetsAndZeroLimits() throws Exception {
    Method method =
        MetricGroupResource.class.getMethod(
            "listMetrics",
            SecurityContext.class,
            UUID.class,
            String.class,
            boolean.class,
            int.class,
            int.class);
    Min limit =
        Arrays.stream(method.getParameterAnnotations()[4])
            .filter(Min.class::isInstance)
            .map(Min.class::cast)
            .findFirst()
            .orElseThrow();
    Min offset =
        Arrays.stream(method.getParameterAnnotations()[5])
            .filter(Min.class::isInstance)
            .map(Min.class::cast)
            .findFirst()
            .orElseThrow();

    assertEquals(1, limit.value());
    assertEquals(0, offset.value());
  }

  @Test
  void bulkMembershipResponseMapsFailureAndPartialSuccess() {
    try (ResourceFixture fixture = resourceFixture()) {
      BulkOperationResult failure =
          new BulkOperationResult().withStatus(ApiStatus.FAILURE).withNumberOfRowsFailed(1);
      BulkOperationResult partial =
          new BulkOperationResult()
              .withStatus(ApiStatus.PARTIAL_SUCCESS)
              .withNumberOfRowsPassed(1)
              .withNumberOfRowsFailed(1);

      assertEquals(
          Response.Status.BAD_REQUEST.getStatusCode(),
          fixture.resource().buildBulkOperationResponse(failure).getStatus());
      assertEquals(
          Response.Status.OK.getStatusCode(),
          fixture.resource().buildBulkOperationResponse(partial).getStatus());
    }
  }

  @Test
  void metadataOnlyUpdatesDoNotRequireMemberAuthorization() {
    EntityReference retained =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC).withName("margin");
    EntityReference removed =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC).withName("cost");
    EntityReference added =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC).withName("profit");
    MetricGroup original = new MetricGroup().withMetrics(List.of(retained, removed));
    MetricGroup metadataOnly = new MetricGroup().withMetrics(List.of(retained, removed));
    MetricGroup membershipUpdate = new MetricGroup().withMetrics(List.of(retained, added));

    assertEquals(List.of(), MetricGroupResource.membershipMutationTargets(original, metadataOnly));
    assertEquals(
        Set.of(removed.getId(), added.getId()),
        MetricGroupResource.membershipMutationTargets(original, membershipUpdate).stream()
            .map(EntityReference::getId)
            .collect(java.util.stream.Collectors.toSet()));
  }

  @Test
  void bulkAddDelegatesTheCallerAndPreservesDryRun() {
    String groupName = "profitability";
    EntityReference metric =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC).withName("margin");
    BulkAssets request = new BulkAssets().withAssets(List.of(metric)).withDryRun(true);
    BulkOperationResult expected =
        new BulkOperationResult().withStatus(ApiStatus.SUCCESS).withDryRun(true);
    try (ResourceFixture fixture = resourceFixture()) {
      when(fixture.repository().getByName(any(), eq(groupName), any()))
          .thenReturn(
              new MetricGroup()
                  .withId(UUID.randomUUID())
                  .withName(groupName)
                  .withFullyQualifiedName(groupName));
      when(fixture.repository().hierarchySubtree(metric)).thenReturn(List.of(metric));
      when(fixture
              .repository()
              .bulkAddMetrics(
                  eq(groupName),
                  argThat(
                      authorized ->
                          Boolean.TRUE.equals(authorized.getDryRun())
                              && authorized.getAssets().equals(List.of(metric))),
                  eq("alice")))
          .thenReturn(expected);

      Response response =
          fixture.resource().bulkAddMetrics(null, securityContext("alice"), groupName, request);

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      assertEquals(expected, response.getEntity());
      verify(fixture.repository())
          .bulkAddMetrics(
              eq(groupName),
              argThat(
                  authorized ->
                      Boolean.TRUE.equals(authorized.getDryRun())
                          && authorized.getAssets().equals(List.of(metric))),
              eq("alice"));
    }
  }

  @Test
  void constructorRegistersTheMetricGroupEntityContract() {
    try (ResourceFixture fixture = resourceFixture()) {
      fixture.entity().verify(() -> Entity.getEntityRepository(Entity.METRIC_GROUP));
      fixture.entity().verify(() -> Entity.getEntityClassFromType(Entity.METRIC_GROUP));
      fixture
          .entity()
          .verify(() -> Entity.registerResourcePermissions(Entity.METRIC_GROUP, List.of()));
      assertNotNull(fixture.resource());
    }
  }

  private SecurityContext securityContext(String name) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(name);
    SecurityContext context = mock(SecurityContext.class);
    when(context.getUserPrincipal()).thenReturn(principal);
    return context;
  }

  private MetricGroup groupWithMember(UUID id, String name) {
    EntityReference member =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.METRIC)
            .withName("margin")
            .withFullyQualifiedName("margin");
    return new MetricGroup()
        .withId(id)
        .withName(name)
        .withFullyQualifiedName(name)
        .withMetrics(List.of(member));
  }

  private ResourcePermission metricViewPermission(Permission.Access access) {
    return new ResourcePermission()
        .withResource(Entity.METRIC)
        .withPermissions(
            List.of(
                new Permission().withOperation(MetadataOperation.VIEW_BASIC).withAccess(access)));
  }

  private ResourceFixture resourceFixture() {
    MockedStatic<Entity> entity = mockStatic(Entity.class);
    MetricGroupRepository repository = mock(MetricGroupRepository.class);
    Authorizer authorizer = mock(Authorizer.class);
    when(repository.getAllowedFields()).thenReturn(Set.of("id", "metricCount"));
    when(repository.getFields(anyString()))
        .thenReturn(org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
    entity.when(() -> Entity.getEntityRepository(Entity.METRIC_GROUP)).thenReturn(repository);
    entity
        .when(() -> Entity.getEntityClassFromType(Entity.METRIC_GROUP))
        .thenReturn(MetricGroup.class);
    try {
      return new ResourceFixture(
          new MetricGroupResource(authorizer, mock(Limits.class)), repository, authorizer, entity);
    } catch (RuntimeException exception) {
      entity.close();
      throw exception;
    }
  }

  private record ResourceFixture(
      MetricGroupResource resource,
      MetricGroupRepository repository,
      Authorizer authorizer,
      MockedStatic<Entity> entity)
      implements AutoCloseable {
    @Override
    public void close() {
      entity.close();
    }
  }
}
