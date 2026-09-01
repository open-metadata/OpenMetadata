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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.METRIC_GROUP;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Integration tests for the Metric Group container entity.
 *
 * <p>The load-bearing behaviour here is that a group organizes metrics without owning them:
 * deleting a group must leave every member metric alive. That distinction is what makes membership
 * a HAS relationship rather than CONTAINS, and it is the thing most likely to regress.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("Rollback coverage temporarily installs entity_relationship CHECK constraints")
@ExtendWith(TestNamespaceExtension.class)
public class MetricGroupResourceIT {
  private static final String ALL_RESOURCES = "All";
  private static final String GROUPS_PATH = "/v1/metricGroups";
  private static final String MYSQL_DATABASE_TYPE = "mysql";
  private static final String NON_METRIC_MEMBERSHIP_MESSAGE =
      "Metric Group membership accepts Metric entities only";
  private static final String RESTRICTED_TAG_FQN = "PII.Sensitive";
  private static final ObjectMapper JSON = new ObjectMapper();

  private MetricGroup createGroup(CreateMetricGroup create) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, GROUPS_PATH, create, MetricGroup.class);
  }

  private MetricGroup createOrUpdateGroup(CreateMetricGroup create) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, GROUPS_PATH, create, MetricGroup.class);
  }

  private static MetricGroup getGroup(String name, String fields) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            GROUPS_PATH + "/name/" + name + "?fields=" + fields,
            null,
            MetricGroup.class);
  }

  private Metric createMetric(TestNamespace ns, String name) {
    return SdkClients.adminClient()
        .metrics()
        .create(new CreateMetric().withName(ns.prefix(name)).withDescription("Group member"));
  }

  private Metric createChild(TestNamespace ns, String name, Metric parent) {
    return SdkClients.adminClient()
        .metrics()
        .create(
            new CreateMetric()
                .withName(ns.prefix(name))
                .withDescription("Group member child")
                .withParent(parent.getFullyQualifiedName()));
  }

  private Metric createRestrictedChild(TestNamespace ns, String name, Metric parent) {
    return SdkClients.adminClient()
        .metrics()
        .create(
            new CreateMetric()
                .withName(ns.prefix(name))
                .withDescription("Restricted group member child")
                .withParent(parent.getFullyQualifiedName())
                .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG_FQN))));
  }

  @Test
  void post_metricGroupWithMembers_200(TestNamespace ns) {
    Metric first = createMetric(ns, "grp_member_one");
    Metric second = createMetric(ns, "grp_member_two");

    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("profitability"))
                .withDescription("Margin, profit, and revenue-quality metrics")
                .withMetrics(
                    List.of(first.getFullyQualifiedName(), second.getFullyQualifiedName())));

    assertNotNull(group.getId());
    assertNull(group.getMetrics(), "Generic create responses must not embed group membership");

    MetricGroup fetched = getGroup(group.getName(), "metricCount");
    JsonNode members = getGroupMembers(group, 10, 0);

    assertEquals(2, fetched.getMetricCount());
    assertEquals(2, members.path("paging").path("total").asInt());
    assertEquals(2, members.path("data").size());
  }

  @Test
  void put_createAndUpdatePersistsMembershipAndSupportsFilteredReindexSearch(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Metric originalRoot = createMetric(ns, "put_original_root");
    Metric originalChild = createChild(ns, "put_original_child", originalRoot);
    Metric replacement = createMetric(ns, "put_replacement");
    String groupName = ns.prefix("put_group");

    MetricGroup created =
        createOrUpdateGroup(
            new CreateMetricGroup()
                .withName(groupName)
                .withDescription("Created through PUT")
                .withMetrics(List.of(originalRoot.getFullyQualifiedName())));

    assertNull(created.getMetrics());
    assertEquals(2, getGroup(groupName, "metricCount").getMetricCount());
    assertSubtreeGroup(originalRoot, originalChild, created);
    awaitFilteredSearchResult(created, 2);

    MetricGroup updated =
        createOrUpdateGroup(
            new CreateMetricGroup()
                .withName(groupName)
                .withDescription("Updated through PUT")
                .withMetrics(List.of(replacement.getFullyQualifiedName())));

    assertEquals(created.getId(), updated.getId());
    assertNull(updated.getMetrics());
    assertEquals("Updated through PUT", getGroup(groupName, "metricCount").getDescription());
    assertEquals(1, getGroup(groupName, "metricCount").getMetricCount());
    assertUngroupedSubtree(originalRoot, originalChild);
    assertMetricHasGroup(replacement, updated);
    awaitFilteredSearchResult(updated, 1);

    String reindexResponse = client.search().reindexEntities(List.of(updated.getEntityReference()));
    assertNotNull(reindexResponse);
    awaitFilteredSearchResult(updated, 1);
  }

  @Test
  void get_listAndByIdExposeMetricGroupsThroughGenericPublicPaths(TestNamespace ns) {
    Metric metric = createMetric(ns, "public_read_member");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("public_read_group"))
                .withDescription("Metric Group public read coverage")
                .withMetrics(List.of(metric.getFullyQualifiedName())));
    OpenMetadataClient client = SdkClients.adminClient();

    JsonNode response =
        JSON.valueToTree(
            client
                .getHttpClient()
                .execute(HttpMethod.GET, GROUPS_PATH + "?limit=1000000", null, Object.class));
    JsonNode listed = null;
    for (JsonNode candidate : response.path("data")) {
      if (group.getId().toString().equals(candidate.path("id").asText())) {
        listed = candidate;
        break;
      }
    }

    assertNotNull(listed, "Plain Metric Group list must include the newly created group");
    assertEquals(group.getName(), listed.path("name").asText());
    assertTrue(listed.path("metrics").isMissingNode() || listed.path("metrics").isNull());
    assertTrue(response.path("paging").path("total").asInt() >= 1);

    MetricGroup byId =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, GROUPS_PATH + "/" + group.getId(), null, MetricGroup.class);
    assertEquals(group.getId(), byId.getId());
    assertEquals(group.getName(), byId.getName());
    assertEquals(group.getDescription(), byId.getDescription());
    assertNull(byId.getMetrics(), "Generic get-by-id must not embed Metric membership");
  }

  @Test
  void get_versionsListAndSpecificVersionReturnPersistedSnapshots(TestNamespace ns) {
    MetricGroup created =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("public_versions_group"))
                .withDescription("Initial Metric Group description"));
    MetricGroup original = getGroup(created.getName(), "metricCount");
    MetricGroup requestedUpdate =
        JsonUtils.deepCopy(original, MetricGroup.class)
            .withDescription("Updated Metric Group description");

    patchGroup(SdkClients.adminClient(), original.getId(), original, requestedUpdate);

    MetricGroup current = getGroup(created.getName(), "metricCount");
    assertTrue(current.getVersion() > original.getVersion());
    EntityHistory history =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                GROUPS_PATH + "/" + created.getId() + "/versions",
                null,
                EntityHistory.class);
    assertTrue(history.getVersions().size() >= 2);

    MetricGroup initialVersion =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                GROUPS_PATH + "/" + created.getId() + "/versions/" + original.getVersion(),
                null,
                MetricGroup.class);
    assertEquals(original.getVersion(), initialVersion.getVersion());
    assertEquals("Initial Metric Group description", initialVersion.getDescription());
    assertEquals(List.of(), initialVersion.getMetrics());
  }

  @Test
  void delete_byNameHardDeletesGroupAndRefreshesPersistenceAndSearch(TestNamespace ns) {
    RestClient rest = RestClient.admin();
    Metric metric = createMetric(ns, "delete_by_name_member");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("delete_by_name_group"))
                .withMetrics(List.of(metric.getFullyQualifiedName())));

    awaitSearchDocument(
        rest,
        "metric_group_search_index",
        group.getId(),
        document -> assertEquals(group.getId().toString(), document.path("id").asText()));

    try (Response response =
        rest.rawDelete(
            GROUPS_PATH + "/name/" + group.getFullyQualifiedName() + "?hardDelete=true")) {
      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    }

    try (Response response = rest.rawGet(GROUPS_PATH + "/" + group.getId() + "?include=all")) {
      assertEquals(Response.Status.NOT_FOUND.getStatusCode(), response.getStatus());
    }
    awaitSearchDocumentDeletion(rest, "metric_group_search_index", group.getId());
    awaitMetricSearchDocument(rest, metric.getId(), MetricGroupResourceIT::assertNoMetricGroup);
    assertMetricHasNoVisibleGroup(metric);
    assertHierarchyShowsStandaloneMetric(metric);
  }

  @Test
  void get_metricCarriesItsGroupBackReference(TestNamespace ns) {
    Metric metric = createMetric(ns, "grp_backref");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("backref_group"))
                .withMetrics(List.of(metric.getFullyQualifiedName())));

    Metric withGroup =
        SdkClients.adminClient().metrics().get(metric.getId().toString(), "metricGroup");

    assertNotNull(withGroup.getMetricGroup(), "Metric should expose the group that holds it");
    assertEquals(group.getId(), withGroup.getMetricGroup().getId());
  }

  @Test
  void delete_metricGroupLeavesItsMetricsAlive(TestNamespace ns) {
    Metric metric = createMetric(ns, "grp_survivor");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("disposable_group"))
                .withMetrics(List.of(metric.getFullyQualifiedName())));

    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            GROUPS_PATH + "/" + group.getId() + "?hardDelete=true",
            null,
            Object.class);

    Metric survivor =
        SdkClients.adminClient().metrics().get(metric.getId().toString(), "metricGroup");

    assertNotNull(survivor, "Deleting a group must not delete the metrics it held");
    assertNull(survivor.getMetricGroup(), "The group reference should be gone once it is deleted");
  }

  @Test
  void put_addAndRemoveMetrics(TestNamespace ns) {
    Metric existing = createMetric(ns, "grp_existing");
    Metric added = createMetric(ns, "grp_added");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("membership_group"))
                .withMetrics(List.of(existing.getFullyQualifiedName())));

    BulkAssets request = new BulkAssets().withAssets(List.of(added.getEntityReference()));
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            GROUPS_PATH + "/" + group.getName() + "/metrics/add",
            request,
            Object.class);

    assertEquals(2, getGroup(group.getName(), "metricCount").getMetricCount());

    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            GROUPS_PATH + "/" + group.getName() + "/metrics/remove",
            request,
            Object.class);

    assertEquals(1, getGroup(group.getName(), "metricCount").getMetricCount());
  }

  @Test
  void put_metricGroupMembershipReturnsPartialFailureForNonMetricMembers(TestNamespace ns) {
    MetricGroup group = createGroup(new CreateMetricGroup().withName(ns.prefix("bad_members")));
    Metric metric = createMetric(ns, "valid_member");
    Table table = ShortStackFactory.table(ns);
    BulkAssets request =
        new BulkAssets()
            .withAssets(List.of(metric.getEntityReference(), table.getEntityReference()));

    BulkOperationResult result =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                GROUPS_PATH + "/" + group.getName() + "/metrics/add",
                request,
                BulkOperationResult.class);

    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(NON_METRIC_MEMBERSHIP_MESSAGE, result.getFailedRequest().getFirst().getMessage());
    assertEquals(1, getGroup(group.getName(), "metricCount").getMetricCount());
  }

  @Test
  void post_metricGroupRejectsNonMetricFqn(TestNamespace ns) {
    Table table = ShortStackFactory.table(ns);
    CreateMetricGroup create =
        new CreateMetricGroup()
            .withName(ns.prefix("bad_member_fqn"))
            .withMetrics(List.of(table.getFullyQualifiedName()));

    OpenMetadataException exception =
        assertThrows(OpenMetadataException.class, () -> createGroup(create));

    assertEquals(Response.Status.NOT_FOUND.getStatusCode(), exception.getStatusCode());
  }

  @Test
  void groupWritesRequireEditPermissionForTheCompleteMetricSubtree(TestNamespace ns) {
    Metric root = createMetric(ns, "write_auth_root");
    Metric child = createRestrictedChild(ns, "write_auth_child", root);
    MetricGroup existing =
        createGroup(new CreateMetricGroup().withName(ns.prefix("write_auth_existing")));

    withRestrictedMetricEditor(
        ns,
        editor -> {
          CreateMetricGroup post =
              new CreateMetricGroup()
                  .withName(ns.prefix("write_auth_post"))
                  .withMetrics(List.of(root.getFullyQualifiedName()));
          assertForbidden(
              () ->
                  editor
                      .getHttpClient()
                      .execute(HttpMethod.POST, GROUPS_PATH, post, MetricGroup.class));
          assertGroupNotFound(post.getName());
          assertUngroupedSubtree(root, child);

          CreateMetricGroup put =
              new CreateMetricGroup()
                  .withName(ns.prefix("write_auth_put"))
                  .withMetrics(List.of(root.getFullyQualifiedName()));
          assertForbidden(
              () ->
                  editor
                      .getHttpClient()
                      .execute(HttpMethod.PUT, GROUPS_PATH, put, MetricGroup.class));
          assertGroupNotFound(put.getName());
          assertUngroupedSubtree(root, child);

          assertForbidden(
              () -> patchGroupMembers(editor, existing, List.of(root.getEntityReference())));
          assertEquals(0, getGroup(existing.getName(), "metricCount").getMetricCount());
          assertUngroupedSubtree(root, child);

          BulkAssets request = new BulkAssets().withAssets(List.of(root.getEntityReference()));
          assertThrows(
              InvalidRequestException.class,
              () ->
                  editor
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          GROUPS_PATH + "/" + existing.getName() + "/metrics/add",
                          request,
                          BulkOperationResult.class));
          assertEquals(0, getGroup(existing.getName(), "metricCount").getMetricCount());
          assertUngroupedSubtree(root, child);

          BulkAssets adminAssignment =
              new BulkAssets().withAssets(List.of(root.getEntityReference()));
          SdkClients.adminClient()
              .getHttpClient()
              .execute(
                  HttpMethod.PUT,
                  GROUPS_PATH + "/" + existing.getName() + "/metrics/add",
                  adminAssignment,
                  BulkOperationResult.class);
          MetricGroup grouped = getGroup(existing.getName(), "metricCount");
          grouped.setMetrics(getGroupMemberReferences(existing));
          MetricGroup descriptionUpdate =
              JsonUtils.deepCopy(grouped, MetricGroup.class)
                  .withDescription("Authorized metadata-only update");
          patchGroup(editor, grouped.getId(), grouped, descriptionUpdate);
          assertEquals(
              descriptionUpdate.getDescription(),
              getGroup(existing.getName(), "metricCount").getDescription());

          assertForbidden(() -> patchGroupMembers(editor, existing, List.of()));
          assertSubtreeGroup(root, child, existing);
        });
  }

  @Test
  void metricRootReassignmentRequiresEditPermissionForTheCompleteSubtree(TestNamespace ns) {
    Metric root = createMetric(ns, "reassign_auth_root");
    Metric child = createRestrictedChild(ns, "reassign_auth_child", root);
    MetricGroup source =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("reassign_auth_source"))
                .withMetrics(List.of(root.getFullyQualifiedName())));
    MetricGroup target =
        createGroup(new CreateMetricGroup().withName(ns.prefix("reassign_auth_target")));
    Metric targetParent = createMetric(ns, "reassign_auth_parent");
    MetricGroup parentGroup =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("reassign_auth_parent_group"))
                .withMetrics(List.of(targetParent.getFullyQualifiedName())));

    withRestrictedMetricEditor(
        ns,
        editor -> {
          Metric groupUpdate = editor.metrics().get(root.getId().toString(), "metricGroup,parent");
          groupUpdate.setMetricGroup(target.getEntityReference());
          assertForbidden(() -> editor.metrics().update(root.getId().toString(), groupUpdate));
          assertSubtreeGroup(root, child, source);
          assertEquals(0, getGroup(target.getName(), "metricCount").getMetricCount());

          Metric parentUpdate = editor.metrics().get(root.getId().toString(), "metricGroup,parent");
          parentUpdate.setParent(targetParent.getEntityReference());
          assertForbidden(() -> editor.metrics().update(root.getId().toString(), parentUpdate));
          assertSubtreeGroup(root, child, source);
          assertNull(
              SdkClients.adminClient()
                  .metrics()
                  .get(root.getId().toString(), "parent")
                  .getParent());
          assertEquals(1, getGroup(parentGroup.getName(), "metricCount").getMetricCount());
        });
  }

  @Test
  void metricAssignmentsRequireEditPermissionOnEveryDestination(TestNamespace ns) {
    Metric root = createMetric(ns, "destination_auth_root");
    Metric child = createChild(ns, "destination_auth_child", root);
    Metric restrictedParent =
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix("destination_auth_parent"))
                    .withDescription("Restricted destination parent")
                    .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG_FQN))));
    MetricGroup restrictedGroup =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("destination_auth_group"))
                .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG_FQN))));

    withRestrictedMetricEditor(
        ns,
        editor -> {
          Metric groupUpdate = editor.metrics().get(root.getId().toString(), "metricGroup,parent");
          groupUpdate.setMetricGroup(restrictedGroup.getEntityReference());
          assertForbidden(() -> editor.metrics().update(root.getId().toString(), groupUpdate));
          assertUngroupedSubtree(root, child);

          Metric parentUpdate = editor.metrics().get(root.getId().toString(), "metricGroup,parent");
          parentUpdate.setParent(restrictedParent.getEntityReference());
          assertForbidden(() -> editor.metrics().update(root.getId().toString(), parentUpdate));
          assertNull(
              SdkClients.adminClient()
                  .metrics()
                  .get(root.getId().toString(), "parent")
                  .getParent());

          BulkAssets assignment = new BulkAssets().withAssets(List.of(root.getEntityReference()));
          assertForbidden(
              () ->
                  editor
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          GROUPS_PATH + "/" + restrictedGroup.getName() + "/metrics/add",
                          assignment,
                          BulkOperationResult.class));
          assertUngroupedSubtree(root, child);
        });
  }

  @Test
  void concurrentAssignmentOfOneRootLeavesExactlyOneGroupMembership(TestNamespace ns)
      throws Exception {
    Metric root = createMetric(ns, "concurrent_root");
    Metric child = createChild(ns, "concurrent_child", root);
    MetricGroup first =
        createGroup(new CreateMetricGroup().withName(ns.prefix("concurrent_first")));
    MetricGroup second =
        createGroup(new CreateMetricGroup().withName(ns.prefix("concurrent_second")));
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);

    try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
      Future<Boolean> firstResult =
          executor.submit(() -> assignGroupAfterStart(first, root, ready, start));
      Future<Boolean> secondResult =
          executor.submit(() -> assignGroupAfterStart(second, root, ready, start));
      assertTrue(ready.await(10, TimeUnit.SECONDS));
      start.countDown();
      boolean firstSucceeded = firstResult.get(30, TimeUnit.SECONDS);
      boolean secondSucceeded = secondResult.get(30, TimeUnit.SECONDS);
      assertTrue(
          firstSucceeded || secondSucceeded, "At least one concurrent assignment must succeed");
    }

    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    int firstRoot = membershipCount(jdbi, first.getId(), root.getId());
    int secondRoot = membershipCount(jdbi, second.getId(), root.getId());
    int firstChild = membershipCount(jdbi, first.getId(), child.getId());
    int secondChild = membershipCount(jdbi, second.getId(), child.getId());
    assertEquals(1, firstRoot + secondRoot);
    assertEquals(1, firstChild + secondChild);
    assertEquals(firstRoot, firstChild);
    assertEquals(secondRoot, secondChild);
    assertEquals(
        2,
        getGroup(first.getName(), "metricCount").getMetricCount()
            + getGroup(second.getName(), "metricCount").getMetricCount());
  }

  @Test
  void get_emptyGroupReportsZeroRatherThanNull(TestNamespace ns) {
    MetricGroup group = createGroup(new CreateMetricGroup().withName(ns.prefix("empty_group")));

    MetricGroup fetched = getGroup(group.getName(), "metricCount");
    MetricGroup allFields = getGroup(group.getName(), "*");
    JsonNode members = getGroupMembers(group, 10, 0);
    OpenMetadataException invalidField =
        assertThrows(OpenMetadataException.class, () -> getGroup(group.getName(), "metrics"));

    assertEquals(0, fetched.getMetricCount());
    assertNull(allFields.getMetrics());
    assertEquals(0, members.path("paging").path("total").asInt());
    assertTrue(members.path("data").isEmpty());
    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), invalidField.getStatusCode());
  }

  @Test
  void groupAssignmentIncludesTheCompleteVariantSubtree(TestNamespace ns) {
    Metric root = createMetric(ns, "subtree_root");
    Metric child = createChild(ns, "subtree_child", root);
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("subtree_group"))
                .withMetrics(List.of(root.getFullyQualifiedName())));

    Metric groupedRoot =
        SdkClients.adminClient().metrics().get(root.getId().toString(), "metricGroup");
    Metric groupedChild =
        SdkClients.adminClient().metrics().get(child.getId().toString(), "metricGroup");

    assertEquals(group.getId(), groupedRoot.getMetricGroup().getId());
    assertEquals(group.getId(), groupedChild.getMetricGroup().getId());
    assertEquals(2, getGroup(group.getName(), "metricCount").getMetricCount());
  }

  @Test
  void list_groupMembersCanPageHierarchyRootsOnly(TestNamespace ns) {
    Metric root = createMetric(ns, "page_root");
    createChild(ns, "page_child", root);
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("page_group"))
                .withMetrics(List.of(root.getFullyQualifiedName())));

    JsonNode roots =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    GROUPS_PATH + "/" + group.getId() + "/metrics?rootOnly=true&limit=1&offset=0",
                    null,
                    Object.class));
    JsonNode allMembers =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    GROUPS_PATH + "/" + group.getId() + "/metrics?limit=1&offset=0",
                    null,
                    Object.class));

    assertEquals(1, roots.get("paging").get("total").asInt());
    assertEquals(root.getId().toString(), roots.get("data").get(0).get("id").asText());
    assertEquals(2, allMembers.get("paging").get("total").asInt());
  }

  @Test
  void list_groupRootsSearchesNamesAcrossEachCompleteSubtree(TestNamespace ns) {
    Metric matchingRoot = createMetric(ns, "search_root_match");
    Metric matchingChild = createChild(ns, "search_nested_unique", matchingRoot);
    Metric otherRoot = createMetric(ns, "search_root_other");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("search_roots_group"))
                .withMetrics(
                    List.of(
                        matchingRoot.getFullyQualifiedName(), otherRoot.getFullyQualifiedName())));

    JsonNode roots =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    GROUPS_PATH
                        + "/"
                        + group.getId()
                        + "/metrics?rootOnly=true&q="
                        + matchingChild.getName()
                        + "&limit=1&offset=0",
                    null,
                    Object.class));

    assertEquals(1, roots.get("paging").get("total").asInt());
    assertEquals(matchingRoot.getId().toString(), roots.get("data").get(0).get("id").asText());
  }

  @Test
  void bulkReassignmentMovesTheWholeSubtreeAndRefreshesCounts(TestNamespace ns) {
    Metric root = createMetric(ns, "move_root");
    Metric child = createChild(ns, "move_child", root);
    MetricGroup original =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("move_original"))
                .withMetrics(List.of(root.getFullyQualifiedName())));
    MetricGroup target = createGroup(new CreateMetricGroup().withName(ns.prefix("move_target")));
    BulkAssets request = new BulkAssets().withAssets(List.of(root.getEntityReference()));

    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            GROUPS_PATH + "/" + target.getName() + "/metrics/add",
            request,
            Object.class);

    Metric movedRoot =
        SdkClients.adminClient().metrics().get(root.getId().toString(), "metricGroup");
    Metric movedChild =
        SdkClients.adminClient().metrics().get(child.getId().toString(), "metricGroup");
    assertEquals(target.getId(), movedRoot.getMetricGroup().getId());
    assertEquals(target.getId(), movedChild.getMetricGroup().getId());
    assertEquals(0, getGroup(original.getName(), "metricCount").getMetricCount());
    assertEquals(2, getGroup(target.getName(), "metricCount").getMetricCount());
  }

  @Test
  void failedMidSubtreeAssignmentRollsBackEveryMembership(TestNamespace ns) {
    Metric root = createMetric(ns, "rollback_root");
    Metric child = createChild(ns, "rollback_child", root);
    MetricGroup group = createGroup(new CreateMetricGroup().withName(ns.prefix("rollback_group")));
    BulkAssets request = new BulkAssets().withAssets(List.of(root.getEntityReference()));
    ConnectionType connectionType = currentConnectionType();
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    String constraint = "metric_membership_fail_" + suffix;
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    createMembershipFailureConstraint(jdbi, constraint, group.getId(), child.getId());
    try {
      assertThrows(
          RuntimeException.class,
          () ->
              SdkClients.adminClient()
                  .getHttpClient()
                  .execute(
                      HttpMethod.PUT,
                      GROUPS_PATH + "/" + group.getName() + "/metrics/add",
                      request,
                      Object.class));
    } finally {
      dropMembershipFailureConstraint(jdbi, connectionType, constraint);
    }

    assertEquals(0, membershipCount(jdbi, group.getId(), root.getId()));
    assertEquals(0, membershipCount(jdbi, group.getId(), child.getId()));
    assertEquals(0, getGroup(group.getName(), "metricCount").getMetricCount());
  }

  @Test
  void failedMidSubtreePatchGroupAssignmentRollsBackEveryMembership(TestNamespace ns) {
    Metric root = createMetric(ns, "patch_rollback_root");
    Metric child = createChild(ns, "patch_rollback_child", root);
    MetricGroup group =
        createGroup(new CreateMetricGroup().withName(ns.prefix("patch_rollback_group")));
    ConnectionType connectionType = currentConnectionType();
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    String constraint = "metric_patch_membership_fail_" + suffix;
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    Metric update = SdkClients.adminClient().metrics().get(root.getId().toString(), "metricGroup");
    update.setMetricGroup(group.getEntityReference());

    createMembershipFailureConstraint(jdbi, constraint, group.getId(), child.getId());
    try {
      assertThrows(
          RuntimeException.class,
          () -> SdkClients.adminClient().metrics().update(root.getId().toString(), update));
    } finally {
      dropMembershipFailureConstraint(jdbi, connectionType, constraint);
    }

    assertEquals(0, membershipCount(jdbi, group.getId(), root.getId()));
    assertEquals(0, membershipCount(jdbi, group.getId(), child.getId()));
    assertNull(
        SdkClients.adminClient()
            .metrics()
            .get(root.getId().toString(), "metricGroup")
            .getMetricGroup());
    assertNull(
        SdkClients.adminClient()
            .metrics()
            .get(child.getId().toString(), "metricGroup")
            .getMetricGroup());
  }

  @Test
  void reparentingGroupedRootMovesItsSubtreeToTheParentGroup(TestNamespace ns) {
    Metric movingRoot = createMetric(ns, "reparent_moving_root");
    Metric movingChild = createChild(ns, "reparent_moving_child", movingRoot);
    Metric targetParent = createMetric(ns, "reparent_target_parent");
    MetricGroup originalGroup =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("reparent_original_group"))
                .withMetrics(List.of(movingRoot.getFullyQualifiedName())));
    MetricGroup targetGroup =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("reparent_target_group"))
                .withMetrics(List.of(targetParent.getFullyQualifiedName())));

    Metric update =
        SdkClients.adminClient().metrics().get(movingRoot.getId().toString(), "parent,metricGroup");
    update.setParent(targetParent.getEntityReference());
    SdkClients.adminClient().metrics().update(movingRoot.getId().toString(), update);

    Metric movedRoot =
        SdkClients.adminClient().metrics().get(movingRoot.getId().toString(), "parent,metricGroup");
    Metric movedChild =
        SdkClients.adminClient().metrics().get(movingChild.getId().toString(), "metricGroup");
    assertEquals(targetParent.getId(), movedRoot.getParent().getId());
    assertEquals(targetGroup.getId(), movedRoot.getMetricGroup().getId());
    assertEquals(targetGroup.getId(), movedChild.getMetricGroup().getId());
    assertEquals(0, getGroup(originalGroup.getName(), "metricCount").getMetricCount());
    assertEquals(3, getGroup(targetGroup.getName(), "metricCount").getMetricCount());
  }

  @Test
  void hierarchySearchByNestedMetricReturnsItsGroup(TestNamespace ns) {
    Metric root = createMetric(ns, "search_group_root");
    Metric child = createChild(ns, "search_group_child", root);
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("search_group"))
                .withMetrics(List.of(root.getFullyQualifiedName())));

    JsonNode response =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=" + child.getName(),
                    null,
                    Object.class));

    assertEquals(1, response.get("paging").get("total").asInt());
    assertEquals("metricGroup", response.get("data").get(0).get("kind").asText());
    assertEquals(
        group.getId().toString(), response.get("data").get(0).get("group").get("id").asText());
    assertFalse(response.get("data").get(0).has("metric"));
  }

  @Test
  void hierarchyAndMembershipSearchMatchDisplayNames(TestNamespace ns) {
    Metric root =
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix("display_root"))
                    .withDisplayName("Friendly Revenue Root")
                    .withDescription("Root"));
    Metric child =
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix("display_child"))
                    .withDisplayName("Distinct Margin Variant")
                    .withDescription("Child")
                    .withParent(root.getFullyQualifiedName()));
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("display_group"))
                .withDisplayName("Friendly Profitability Group")
                .withMetrics(List.of(root.getFullyQualifiedName())));

    JsonNode members =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    GROUPS_PATH + "/" + group.getId() + "/metrics?q=Distinct&limit=10&offset=0",
                    null,
                    Object.class));
    assertEquals(1, members.get("paging").get("total").asInt());
    assertEquals(child.getId().toString(), members.get("data").get(0).get("id").asText());

    JsonNode byMemberDisplayName =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=Distinct&limit=10&offset=0",
                    null,
                    Object.class));
    assertEquals(1, byMemberDisplayName.get("paging").get("total").asInt());
    assertEquals(
        group.getId().toString(),
        byMemberDisplayName.get("data").get(0).get("group").get("id").asText());

    JsonNode byGroupDisplayName =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=Profitability&limit=10&offset=0",
                    null,
                    Object.class));
    assertEquals(1, byGroupDisplayName.get("paging").get("total").asInt());
    assertEquals(
        group.getId().toString(),
        byGroupDisplayName.get("data").get(0).get("group").get("id").asText());
  }

  @Test
  void groupMutationsAndHardDeleteRefreshMemberSearchDocuments(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();
    Metric metric = createMetric(ns, "search_refresh_member");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("search_refresh_group"))
                .withDescription("Initial group description")
                .withMetrics(List.of(metric.getFullyQualifiedName())));

    awaitMetricSearchDocument(
        rest,
        metric.getId(),
        document -> assertEquals(group.getId().toString(), groupId(document)));

    String originalJson = JSON.writeValueAsString(group);
    group.setName(ns.prefix("search_refresh_renamed"));
    group.setDisplayName("Renamed Metric Group");
    group.setDescription("Updated group description");
    MetricGroup updated =
        rest.patch(GROUPS_PATH, group.getId(), originalJson, group, MetricGroup.class);

    awaitMetricSearchDocument(
        rest,
        metric.getId(),
        document -> {
          JsonNode groupReference = document.path("metricGroup");
          assertEquals(updated.getName(), groupReference.path("name").asText());
          assertEquals(updated.getDisplayName(), groupReference.path("displayName").asText());
          assertEquals(
              updated.getFullyQualifiedName(), groupReference.path("fullyQualifiedName").asText());
        });
    awaitSearchDocument(
        rest,
        "metric_group_search_index",
        group.getId(),
        document ->
            assertEquals("Updated group description", document.path("description").asText()));

    rest.delete(GROUPS_PATH, group.getId());
    awaitMetricSearchDocument(rest, metric.getId(), MetricGroupResourceIT::assertNoMetricGroup);
    assertMetricHasNoVisibleGroup(metric);
    assertHierarchyShowsStandaloneMetric(metric);

    rest.restore(GROUPS_PATH, group.getId(), MetricGroup.class);
    awaitMetricSearchDocument(
        rest,
        metric.getId(),
        document -> assertEquals(group.getId().toString(), groupId(document)));
    assertMetricHasGroup(metric, group);
    assertHierarchyShowsGroup(metric, group);

    rest.hardDelete(GROUPS_PATH, group.getId());
    awaitMetricSearchDocument(rest, metric.getId(), MetricGroupResourceIT::assertNoMetricGroup);
    assertMetricHasNoVisibleGroup(metric);
    assertHierarchyShowsStandaloneMetric(metric);
  }

  @Test
  void asyncRestoreRefreshesMemberSearchDocumentsAfterCommit(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();
    Metric metric = createMetric(ns, "async_restore_member");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("async_restore_group"))
                .withMetrics(List.of(metric.getFullyQualifiedName())));

    rest.delete(GROUPS_PATH, group.getId());
    awaitMetricSearchDocument(rest, metric.getId(), MetricGroupResourceIT::assertNoMetricGroup);

    try (Response response =
        rest.rawPut(GROUPS_PATH + "/restore?async=true", Map.of("id", group.getId()))) {
      assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.getStatus());
    }

    awaitMetricSearchDocument(
        rest,
        metric.getId(),
        document -> assertEquals(group.getId().toString(), groupId(document)));
    Awaitility.await("Metric Group async restore is visible through the API")
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(() -> assertMetricHasGroup(metric, group));
    assertHierarchyShowsGroup(metric, group);
  }

  @Test
  void memberDeleteAndRestoreRefreshGroupCountsAndSearchDocument(TestNamespace ns) {
    RestClient rest = RestClient.admin();
    Metric metric = createMetric(ns, "count_refresh_member");
    MetricGroup group =
        createGroup(
            new CreateMetricGroup()
                .withName(ns.prefix("count_refresh_group"))
                .withMetrics(List.of(metric.getFullyQualifiedName())));

    awaitSearchDocument(
        rest,
        "metric_group_search_index",
        group.getId(),
        document -> assertEquals(1, document.path("metricCount").asInt()));

    SdkClients.adminClient().metrics().delete(metric.getId().toString());
    assertEquals(0, getGroup(group.getName(), "metricCount").getMetricCount());
    awaitSearchDocument(
        rest,
        "metric_group_search_index",
        group.getId(),
        document -> assertEquals(0, document.path("metricCount").asInt()));

    SdkClients.adminClient().metrics().restore(metric.getId().toString());
    assertEquals(1, getGroup(group.getName(), "metricCount").getMetricCount());
    awaitSearchDocument(
        rest,
        "metric_group_search_index",
        group.getId(),
        document -> assertEquals(1, document.path("metricCount").asInt()));

    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().metrics().delete(metric.getId().toString(), params);
    assertEquals(0, getGroup(group.getName(), "metricCount").getMetricCount());
    awaitSearchDocument(
        rest,
        "metric_group_search_index",
        group.getId(),
        document -> assertEquals(0, document.path("metricCount").asInt()));
  }

  private static void assertNoMetricGroup(JsonNode metricDocument) {
    JsonNode metricGroup = metricDocument.path("metricGroup");
    assertTrue(metricGroup.isMissingNode() || metricGroup.isNull());
  }

  private static String groupId(JsonNode metricDocument) {
    return metricDocument.path("metricGroup").path("id").asText();
  }

  private static void assertMetricHasNoVisibleGroup(Metric metric) {
    Metric fetched =
        SdkClients.adminClient().metrics().get(metric.getId().toString(), "metricGroup");
    assertNull(fetched.getMetricGroup());
  }

  private static void assertMetricHasGroup(Metric metric, MetricGroup group) {
    Metric fetched =
        SdkClients.adminClient().metrics().get(metric.getId().toString(), "metricGroup");
    assertNotNull(fetched.getMetricGroup());
    assertEquals(group.getId(), fetched.getMetricGroup().getId());
  }

  private static void assertHierarchyShowsStandaloneMetric(Metric metric) {
    JsonNode item = hierarchyItem(metric);
    assertEquals(METRIC, item.path("kind").asText());
    assertEquals(metric.getId().toString(), item.path("metric").path("id").asText());
    assertFalse(item.has("group"));
  }

  private static void assertHierarchyShowsGroup(Metric metric, MetricGroup group) {
    JsonNode item = hierarchyItem(metric);
    assertEquals(METRIC_GROUP, item.path("kind").asText());
    assertEquals(group.getId().toString(), item.path("group").path("id").asText());
    assertFalse(item.has("metric"));
  }

  private static JsonNode hierarchyItem(Metric metric) {
    JsonNode response =
        JSON.valueToTree(
            SdkClients.adminClient()
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/metrics/hierarchy?q=" + metric.getName() + "&limit=10&offset=0",
                    null,
                    Object.class));
    assertEquals(1, response.path("paging").path("total").asInt());
    return response.path("data").get(0);
  }

  private static void patchGroupMembers(
      OpenMetadataClient client, MetricGroup group, List<EntityReference> metrics) {
    MetricGroup original = getGroup(group.getName(), "metricCount");
    original.setMetrics(getGroupMemberReferences(group));
    MetricGroup updated = JsonUtils.deepCopy(original, MetricGroup.class).withMetrics(metrics);
    patchGroup(client, group.getId(), original, updated);
  }

  private static JsonNode getGroupMembers(MetricGroup group, int limit, int offset) {
    return JSON.valueToTree(
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                GROUPS_PATH + "/" + group.getId() + "/metrics?limit=" + limit + "&offset=" + offset,
                null,
                Object.class));
  }

  private static List<EntityReference> getGroupMemberReferences(MetricGroup group) {
    List<EntityReference> references = new ArrayList<>();
    for (JsonNode member : getGroupMembers(group, 1000, 0).path("data")) {
      references.add(JSON.convertValue(member, Metric.class).getEntityReference());
    }
    return references;
  }

  private static void patchGroup(
      OpenMetadataClient client, UUID groupId, MetricGroup original, MetricGroup updated) {
    String patch = JsonUtils.getJsonPatch(original, updated).toString();
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            GROUPS_PATH + "/" + groupId,
            patch,
            RequestOptions.builder()
                .header("Content-Type", MediaType.APPLICATION_JSON_PATCH_JSON)
                .build());
  }

  private static void assertUngroupedSubtree(Metric root, Metric child) {
    assertMetricHasNoVisibleGroup(root);
    assertMetricHasNoVisibleGroup(child);
  }

  private static void assertGroupNotFound(String name) {
    OpenMetadataException exception =
        assertThrows(OpenMetadataException.class, () -> getGroup(name, "metricCount"));
    assertEquals(Response.Status.NOT_FOUND.getStatusCode(), exception.getStatusCode());
  }

  private static void assertForbidden(Runnable request) {
    OpenMetadataException exception = assertThrows(OpenMetadataException.class, request::run);
    int statusCode = exception.getStatusCode();
    if (statusCode < 0 && exception.getCause() instanceof OpenMetadataException cause) {
      statusCode = cause.getStatusCode();
    }
    assertEquals(Response.Status.FORBIDDEN.getStatusCode(), statusCode);
  }

  private static void assertSubtreeGroup(Metric root, Metric child, MetricGroup group) {
    assertMetricHasGroup(root, group);
    assertMetricHasGroup(child, group);
    assertEquals(2, getGroup(group.getName(), "metricCount").getMetricCount());
  }

  private static boolean assignGroupAfterStart(
      MetricGroup group, Metric root, CountDownLatch ready, CountDownLatch start) {
    ready.countDown();
    try {
      if (!start.await(10, TimeUnit.SECONDS)) {
        throw new IllegalStateException("Concurrent assignment start barrier timed out");
      }
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              GROUPS_PATH + "/" + group.getName() + "/metrics/add",
              new BulkAssets().withAssets(List.of(root.getEntityReference())),
              BulkOperationResult.class);
      return true;
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Concurrent assignment was interrupted", exception);
    } catch (OpenMetadataException exception) {
      return false;
    }
  }

  private static void withRestrictedMetricEditor(
      TestNamespace ns, Consumer<OpenMetadataClient> assertions) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String suffix = ns.uniqueShortId();
    Rule allowCatalog =
        new Rule()
            .withName("AllowMetricGroupWrites")
            .withResources(List.of(ALL_RESOURCES))
            .withOperations(
                List.of(
                    MetadataOperation.CREATE,
                    MetadataOperation.VIEW_ALL,
                    MetadataOperation.EDIT_ALL))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyRestrictedMetricEdits =
        new Rule()
            .withName("DenyRestrictedMetricEdits")
            .withResources(List.of(METRIC, METRIC_GROUP))
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withCondition("matchAnyTag('" + RESTRICTED_TAG_FQN + "')")
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("metricGroupWritePolicy_" + suffix)
                    .withRules(List.of(allowCatalog, denyRestrictedMetricEdits)));
    try {
      Role role =
          admin
              .roles()
              .create(
                  new CreateRole()
                      .withName("metricGroupWriteRole_" + suffix)
                      .withPolicies(List.of(policy.getFullyQualifiedName())));
      try {
        String userName = "metric-group-writer-" + suffix;
        String email = userName + "@test.openmetadata.org";
        User user =
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName(userName)
                        .withEmail(email)
                        .withRoles(List.of(role.getId())));
        try {
          assertions.accept(SdkClients.createClient(email, email, new String[] {}));
        } finally {
          admin.users().delete(user.getId());
        }
      } finally {
        admin.roles().delete(role.getId());
      }
    } finally {
      admin.policies().delete(policy.getId());
    }
  }

  private static ConnectionType currentConnectionType() {
    return MYSQL_DATABASE_TYPE.equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }

  private static void createMembershipFailureConstraint(
      Jdbi jdbi, String constraint, UUID groupId, UUID metricId) {
    jdbi.useHandle(
        handle ->
            handle.execute(
                "ALTER TABLE entity_relationship ADD CONSTRAINT "
                    + constraint
                    + " CHECK (NOT (fromId = '"
                    + groupId
                    + "' AND toId = '"
                    + metricId
                    + "' AND fromEntity = '"
                    + METRIC_GROUP
                    + "' AND toEntity = '"
                    + METRIC
                    + "' AND relation = "
                    + Relationship.HAS.ordinal()
                    + "))"));
  }

  private static void dropMembershipFailureConstraint(
      Jdbi jdbi, ConnectionType connectionType, String constraint) {
    jdbi.useHandle(
        handle -> {
          if (connectionType == ConnectionType.MYSQL) {
            handle.execute("ALTER TABLE entity_relationship DROP CHECK " + constraint);
          } else {
            handle.execute("ALTER TABLE entity_relationship DROP CONSTRAINT " + constraint);
          }
        });
  }

  private static int membershipCount(Jdbi jdbi, UUID groupId, UUID metricId) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery(
                    "SELECT COUNT(*) FROM entity_relationship WHERE fromId = :groupId "
                        + "AND toId = :metricId AND fromEntity = :groupType "
                        + "AND toEntity = :metricType AND relation = :relation")
                .bind("groupId", groupId.toString())
                .bind("metricId", metricId.toString())
                .bind("groupType", METRIC_GROUP)
                .bind("metricType", METRIC)
                .bind("relation", Relationship.HAS.ordinal())
                .mapTo(Integer.class)
                .one());
  }

  private static void awaitMetricSearchDocument(
      RestClient rest, UUID metricId, Consumer<JsonNode> assertion) {
    awaitSearchDocument(rest, "metric_search_index", metricId, assertion);
  }

  private static void awaitFilteredSearchResult(MetricGroup group, int metricCount) {
    awaitSearchDocument(
        RestClient.admin(),
        "metric_group_search_index",
        group.getId(),
        document -> assertEquals(metricCount, document.path("metricCount").asInt()));
    String queryFilter =
        String.format(
            "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"id.keyword\":\"%s\"}},{\"term\":{\"metricCount\":%d}}]}}}",
            group.getId(), metricCount);
    Awaitility.await("Metric Group is returned by filtered search after reindex")
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () -> {
              String response =
                  SdkClients.adminClient()
                      .search()
                      .query("*")
                      .index("metric_group_search_index")
                      .queryFilter(queryFilter)
                      .size(1)
                      .execute();
              JsonNode hits = JSON.readTree(response).path("hits").path("hits");
              assertEquals(1, hits.size(), "Filtered Metric Group search must return one group");
              JsonNode source = hits.get(0).path("_source");
              assertEquals(group.getId().toString(), source.path("id").asText());
              assertEquals(metricCount, source.path("metricCount").asInt());
            });
  }

  private static void awaitSearchDocument(
      RestClient rest, String index, UUID id, Consumer<JsonNode> assertion) {
    Awaitility.await("Search document " + index + "/" + id + " is refreshed")
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () -> {
              try (Response response = rest.rawGet("v1/search/get/" + index + "/doc/" + id)) {
                assertEquals(200, response.getStatus());
                assertion.accept(JSON.readTree(response.readEntity(String.class)));
              }
            });
  }

  private static void awaitSearchDocumentDeletion(RestClient rest, String index, UUID id) {
    Awaitility.await("Search document " + index + "/" + id + " is deleted")
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(60))
        .untilAsserted(
            () -> {
              try (Response response = rest.rawGet("v1/search/get/" + index + "/doc/" + id)) {
                assertEquals(Response.Status.NOT_FOUND.getStatusCode(), response.getStatus());
              }
            });
  }
}
