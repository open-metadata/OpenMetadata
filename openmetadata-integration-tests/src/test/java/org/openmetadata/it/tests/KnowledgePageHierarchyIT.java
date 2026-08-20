/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageHierarchy;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

/**
 * Verifies that the Knowledge Center hierarchy listing path populates the {@code parent} reference
 * on every page. Before the {@code setFieldsInBulk(Fields, List<Page>)} override in {@link
 * org.openmetadata.service.jdbi3.KnowledgePageRepository}, the LIST/hierarchy path never invoked
 * {@code setFields}, so {@code parent} came back {@code null} for every page and the Knowledge
 * Center tree rendered flat.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class KnowledgePageHierarchyIT {

  private static final String KC_PATH = "v1/contextCenter/pages";
  private static final String KC_HIERARCHY_PATH = KC_PATH + "/hierarchy";
  private static final String PARENT_FIELD = "parent";
  private static final String ORGANIZATION_NAME = "Organization";

  private Page createPage(RestClient rest, CreatePage request) throws HttpResponseException {
    return rest.create(KC_PATH, request, Page.class);
  }

  private CreatePage buildCreateRequest(String name, EntityReference parent) {
    return new CreatePage()
        .withName(name)
        .withPageType(PageType.ARTICLE)
        .withDescription("This is a test Description.")
        .withPage(new Article())
        .withRelatedEntities(List.of(getOrganizationRef()))
        .withParent(parent);
  }

  private EntityReference getOrganizationRef() {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    TeamService teamService = new TeamService(adminClient.getHttpClient());
    Team org = teamService.getByName(ORGANIZATION_NAME, null);
    return org.getEntityReference();
  }

  private ResultList<Page> listPagesWithParent(RestClient rest) {
    String path = KC_PATH + "?fields=" + PARENT_FIELD + "&limit=1000000";
    try (Response response = rest.rawGet(path)) {
      assertEquals(200, response.getStatus(), "List call failed: " + response.getStatus());
      String body = response.readEntity(String.class);
      return JsonUtils.readValue(body, new TypeReference<ResultList<Page>>() {});
    }
  }

  private ResultList<PageHierarchy> listHierarchy(RestClient rest) {
    String path = KC_HIERARCHY_PATH + "?limit=1000000";
    try (Response response = rest.rawGet(path)) {
      assertEquals(200, response.getStatus(), "Hierarchy call failed: " + response.getStatus());
      String body = response.readEntity(String.class);
      return JsonUtils.readValue(body, new TypeReference<ResultList<PageHierarchy>>() {});
    }
  }

  private Page findById(ResultList<Page> pages, UUID id) {
    return pages.getData().stream()
        .filter(page -> id.equals(page.getId()))
        .findFirst()
        .orElse(null);
  }

  private boolean containsTopLevelId(ResultList<PageHierarchy> hierarchy, UUID id) {
    return hierarchy.getData().stream().anyMatch(node -> id.equals(node.getId()));
  }

  @Test
  void testListPopulatesParentForChildPage(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page parent = createPage(rest, buildCreateRequest(ns.prefix("hierarchyParent"), null));
    Page child =
        createPage(
            rest, buildCreateRequest(ns.prefix("hierarchyChild"), parent.getEntityReference()));

    ResultList<Page> listed = listPagesWithParent(rest);
    Page listedChild = findById(listed, child.getId());

    assertNotNull(listedChild, "Child page must be present in the list response");
    assertNotNull(
        listedChild.getParent(),
        "Child page parent must be populated on the list path (null without the setFieldsInBulk fix)");
    assertEquals(
        parent.getId(),
        listedChild.getParent().getId(),
        "Child page parent must point at the parent page id");
  }

  @Test
  void testHierarchyNestsChildUnderParent(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    Page parent = createPage(rest, buildCreateRequest(ns.prefix("treeParent"), null));
    Page child =
        createPage(rest, buildCreateRequest(ns.prefix("treeChild"), parent.getEntityReference()));

    ResultList<PageHierarchy> hierarchy = listHierarchy(rest);

    assertTrue(
        containsTopLevelId(hierarchy, parent.getId()),
        "Parent page must appear as a top-level hierarchy node");
    assertFalse(
        containsTopLevelId(hierarchy, child.getId()),
        "Child page must be nested under its parent, not surfaced as a top-level node "
            + "(it leaks to the root when parent is null without the fix)");
  }
}
