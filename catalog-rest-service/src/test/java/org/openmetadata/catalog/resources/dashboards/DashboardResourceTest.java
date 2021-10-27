/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.dashboards;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartEntityInterface;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardEntityInterface;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityTestHelper;
import org.openmetadata.catalog.resources.charts.ChartResourceTest;
import org.openmetadata.catalog.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class DashboardResourceTest extends EntityTestHelper<Dashboard> {
  private static final Logger LOG = LoggerFactory.getLogger(DashboardResourceTest.class);
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static EntityReference SUPERSET_INVALID_SERVICE_REFERENCE;
  public static List<EntityReference> CHART_REFERENCES;
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");

  public DashboardResourceTest() {
    super(Dashboard.class, "dashboards");
  }


  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    EntityTestHelper.setup(test);

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(TestUtils.DASHBOARD_URL);

    DashboardService service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();
    SUPERSET_INVALID_SERVICE_REFERENCE = new EntityReference().withName("invalid_superset_service")
            .withId(SUPERSET_REFERENCE.getId())
            .withType("DashboardService1");

    createService.withName("looker").withServiceType(DashboardServiceType.Looker);
    service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    LOOKER_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();
    CHART_REFERENCES = new ArrayList<>();
    for (int i=0; i < 3; i++) {
      CreateChart createChart = ChartResourceTest.create(test, i).withService(SUPERSET_REFERENCE);
      Chart chart = ChartResourceTest.createChart(createChart, adminAuthHeaders());
      CHART_REFERENCES.add(new ChartEntityInterface(chart).getEntityReference());
    }

  }

  @Test
  public void post_dashboardWithLongName_400_badRequest(TestInfo test) {
    // Create dashboard with mandatory name field empty
    CreateDashboard create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    assertResponse(() -> createDashboard(create, adminAuthHeaders()), BAD_REQUEST,
            "[name size must be between 1 and 64]");
  }

  @Test
  public void post_DashboardWithoutName_400_badRequest(TestInfo test) {
    // Create Dashboard with mandatory name field empty
    CreateDashboard create = create(test).withName("");
    assertResponse(() -> createDashboard(create, adminAuthHeaders()), BAD_REQUEST,
            "[name size must be between 1 and 64]");
  }

  @Test
  public void post_DashboardAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateDashboard create = create(test);
    createDashboard(create, adminAuthHeaders());
    assertResponse(() -> createDashboard(create, adminAuthHeaders()), CONFLICT, ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validDashboards_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateDashboard create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getDashboardName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_DashboardWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_DashboardWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Dashboard1"), adminAuthHeaders());
  }

  @Test
  public void post_DashboardWithCharts_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withCharts(CHART_REFERENCES), adminAuthHeaders());
  }

  @Test
  public void post_Dashboard_as_non_admin_401(TestInfo test) {
    CreateDashboard create = create(test);
    assertResponse(() -> createDashboard(create, authHeaders("test@open-metadata.org")), FORBIDDEN,
            "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_DashboardWithoutRequiredService_4xx(TestInfo test) {
    CreateDashboard create = create(test).withService(null);
    TestUtils.assertResponseContains(() -> createDashboard(create, adminAuthHeaders()), BAD_REQUEST,
            "service must not be null");
  }

  @Test
  public void post_DashboardWithInvalidService_4xx(TestInfo test) {
    CreateDashboard create = create(test).withService(SUPERSET_INVALID_SERVICE_REFERENCE);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, String.format("Invalid service type %s",
            SUPERSET_INVALID_SERVICE_REFERENCE.getType()));

  }

  @Test
  public void post_DashboardWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateDashboard create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_DashboardWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreateDashboard create = create(test).withOwner(owner);
    assertResponse(() -> createDashboard(create, adminAuthHeaders()), NOT_FOUND,
            entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_DashboardWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create Dashboard for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(new EntityReference().withId(service.getId())
              .withType(service.getType())), adminAuthHeaders());
      // List Dashboards by filtering on service name and ensure right Dashboards are returned in the response
      DashboardList list = listDashboards("service", service.getName(), adminAuthHeaders());
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
        String expectedFQN = service.getName() + "." + db.getName();
        assertEquals(expectedFQN, db.getFullyQualifiedName());
      }
    }
  }

  @Test
  public void get_DashboardListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    assertResponse(() -> listDashboards(null, null, -1, null, null, adminAuthHeaders()),
            BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    assertResponse(() -> listDashboards(null, null, 0, null, null, adminAuthHeaders()),
            BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    assertResponse(() -> listDashboards(null, null, 1000001, null, null, adminAuthHeaders()),
            BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_DashboardListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    assertResponse(() -> listDashboards(null, null, 1, "", "", adminAuthHeaders()),
            BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_DashboardListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of Dashboards
    int maxDashboards = 40;
    for (int i = 0; i < maxDashboards; i++) {
      createDashboard(create(test, i), adminAuthHeaders());
    }

    // List all Dashboards
    DashboardList allDashboards = listDashboards(null, null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allDashboards.getData().size();
    printDashboards(allDashboards);

    // List limit number Dashboards at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxDashboards; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllDashboards = 0;
      DashboardList forwardPage;
      DashboardList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listDashboards(null, null, limit, null, after, adminAuthHeaders());
        printDashboards(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allDashboards.getData(), forwardPage, limit, indexInAllDashboards);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listDashboards(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allDashboards.getData(), backwardPage, limit, (indexInAllDashboards - limit));
        }

        indexInAllDashboards += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllDashboards = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listDashboards(null, null, limit, before, null, adminAuthHeaders());
        printDashboards(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allDashboards.getData(), forwardPage, limit, indexInAllDashboards);
        pageCount++;
        indexInAllDashboards -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printDashboards(DashboardList list) {
    list.getData().forEach(Dashboard -> LOG.info("DB {}", Dashboard.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_DashboardChartsUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Dashboard dashboard = createAndCheckEntity(request, adminAuthHeaders());

    // Add description, and charts
    ChangeDescription change = getChangeDescription(dashboard.getVersion())
            .withFieldsAdded(Arrays.asList("description", "charts"));
    updateAndCheckEntity(request.withDescription("newDescription").withCharts(CHART_REFERENCES),
            OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_AddRemoveDashboardChartsUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Dashboard dashboard = createAndCheckEntity(request, adminAuthHeaders());

    // Add charts
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(singletonList("charts"));
    dashboard = updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, adminAuthHeaders(),
            MINOR_UPDATE, change);
    validateDashboardCharts(dashboard, CHART_REFERENCES);

    // remove a chart
    CHART_REFERENCES.remove(0);
    change = getChangeDescription(dashboard.getVersion()).withFieldsUpdated(singletonList("charts"));
    updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void get_nonExistentDashboard_404_notFound() {
    assertResponse(() -> getDashboard(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()), NOT_FOUND,
            entityNotFound(Entity.DASHBOARD, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_DashboardWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDashboard create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE).withCharts(CHART_REFERENCES);
    Dashboard dashboard = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(dashboard, false);
  }

  @Test
  public void get_DashboardByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDashboard create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE).withCharts(CHART_REFERENCES);
    Dashboard dashboard = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(dashboard, true);
  }

  @Test
  public void patch_DashboardAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create Dashboard without description, owner
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    assertNull(dashboard.getDescription());
    assertNull(dashboard.getOwner());
    assertNotNull(dashboard.getService());

    List<TagLabel> dashboardTags = singletonList(TIER_1);

    //
    // Add displayName, description, owner when previously they were null
    //
    String origJson = JsonUtils.pojoToJson(dashboard);
    dashboard.withDescription("description").withDisplayName("displayName").withOwner(TEAM_OWNER1).withTags(dashboardTags);
    ChangeDescription change = getChangeDescription(dashboard.getVersion())
            .withFieldsAdded(Arrays.asList("description", "displayName", "owner", "tags"));
    dashboard = patchEntityAndCheck(dashboard, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
    dashboard.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    dashboard.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service

    //
    // Replace displayName, description, tier, owner
    //
    dashboardTags = singletonList(USER_ADDRESS_TAG_LABEL);
    origJson = JsonUtils.pojoToJson(dashboard);
    dashboard.withDescription("description1").withDisplayName("displayName1").withOwner(USER_OWNER1)
            .withTags(dashboardTags);
    change = getChangeDescription(dashboard.getVersion())
            .withFieldsUpdated(Arrays.asList("description", "displayName", "owner", "tags"));
    dashboard = patchEntityAndCheck(dashboard, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
    dashboard.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    dashboard.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service

    //
    // Remove description, tier, owner
    //
    origJson = JsonUtils.pojoToJson(dashboard);
    dashboard.withDescription(null).withDisplayName(null).withOwner(null).withTags(null);
    change = getChangeDescription(dashboard.getVersion())
            .withFieldsDeleted(Arrays.asList("description", "displayName", "owner", "tags"));
    patchEntityAndCheck(dashboard, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void delete_emptyDashboard_200_ok(TestInfo test) throws HttpResponseException {
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    deleteDashboard(dashboard.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyDashboard_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentDashboard_404() {
    assertResponse(() -> deleteDashboard(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()), NOT_FOUND,
            entityNotFound(Entity.DASHBOARD, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Dashboard createDashboard(CreateDashboard create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("dashboards"), create, Dashboard.class, authHeaders);
  }

  /** Validate returned fields GET .../dashboards/{id}?fields="..." or GET .../dashboards/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Dashboard dashboard, boolean byName) throws HttpResponseException {
    // .../Dashboards?fields=owner
    String fields = "owner";
    dashboard = byName ? getDashboardByName(dashboard.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getDashboard(dashboard.getId(), fields, adminAuthHeaders());
    assertNotNull(dashboard.getOwner());
    assertNotNull(dashboard.getService()); // We always return the service
    assertNull(dashboard.getCharts());

    // .../Dashboards?fields=owner,service
    fields = "owner,service";
    dashboard = byName ? getDashboardByName(dashboard.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getDashboard(dashboard.getId(), fields, adminAuthHeaders());
    assertNotNull(dashboard.getOwner());
    assertNotNull(dashboard.getService());
    assertNull(dashboard.getCharts());

    // .../Dashboards?fields=owner,service,tables
    fields = "owner,service,charts,usageSummary";
    dashboard = byName ? getDashboardByName(dashboard.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getDashboard(dashboard.getId(), fields, adminAuthHeaders());
    assertNotNull(dashboard.getOwner());
    assertNotNull(dashboard.getService());
    assertNotNull(dashboard.getCharts());
    TestUtils.validateEntityReference(dashboard.getCharts());
    assertNotNull(dashboard.getUsageSummary());

  }

  private static void validateDashboardCharts(Dashboard dashboard, List<EntityReference> expectedCharts) {
    if (expectedCharts != null) {
      List<UUID> expectedChartReferences = expectedCharts.stream().map(EntityReference::getId).collect(Collectors.toList());
      List<UUID> actualChartReferences = new ArrayList<>();
      dashboard.getCharts().forEach(chart -> {
        TestUtils.validateEntityReference(chart);
        actualChartReferences.add(chart.getId());
      });
      assertEquals(expectedChartReferences.size(), actualChartReferences.size());
      assertTrue(actualChartReferences.containsAll(expectedChartReferences));
    }
  }

  public static void getDashboard(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getDashboard(id, null, authHeaders);
  }

  public static Dashboard getDashboard(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("dashboards/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Dashboard.class, authHeaders);
  }

  public static Dashboard getDashboardByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("dashboards/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Dashboard.class, authHeaders);
  }

  public static DashboardList listDashboards(String fields, String serviceParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listDashboards(fields, serviceParam, null, null, null, authHeaders);
  }

  public static DashboardList listDashboards(String fields, String serviceParam, Integer limitParam,
                                           String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("dashboards");
    target = fields != null ? target.queryParam("fields", fields): target;
    target = serviceParam != null ? target.queryParam("service", serviceParam): target;
    target = limitParam != null ? target.queryParam("limit", limitParam): target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, DashboardList.class, authHeaders);
  }

  private void deleteDashboard(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("dashboards/" + id), authHeaders);

    // Ensure deleted Dashboard does not exist
    assertResponse(() -> getDashboard(id, authHeaders), NOT_FOUND, entityNotFound(Entity.DASHBOARD, id));
  }

  public static String getDashboardName(TestInfo test) {
    return String.format("dash_%s", test.getDisplayName());
  }

  public static String getDashboardName(TestInfo test, int index) {
    return String.format("dash%d_%s", index, test.getDisplayName());
  }

  public static CreateDashboard create(TestInfo test) {
    return new CreateDashboard().withName(getDashboardName(test)).withService(SUPERSET_REFERENCE);
  }

  public static CreateDashboard create(TestInfo test, int index) {
    return new CreateDashboard().withName(getDashboardName(test, index)).withService(SUPERSET_REFERENCE);
  }

  @Override
  public Object createRequest(TestInfo test, String description, String displayName, EntityReference owner) {
    return create(test).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Dashboard dashboard, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    CreateDashboard createRequest = (CreateDashboard) request;
    validateCommonEntityFields(getEntityInterface(dashboard), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertService(createRequest.getService(), dashboard.getService());
    validateDashboardCharts(dashboard, createRequest.getCharts());
    TestUtils.validateTags(dashboard.getFullyQualifiedName(), createRequest.getTags(), dashboard.getTags());
  }

  @Override
  public void validateUpdatedEntity(Dashboard dashboard, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    validateCreatedEntity(dashboard, request, authHeaders);
  }

  @Override
  public void validatePatchedEntity(Dashboard expected, Dashboard updated, Map<String, String> authHeaders) {
  }

  @Override
  public Dashboard getEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", DashboardResource.FIELDS);
    return TestUtils.get(target, Dashboard.class, authHeaders);
  }

  @Override
  public EntityInterface<Dashboard> getEntityInterface(Dashboard entity) {
    return new DashboardEntityInterface(entity);
  }
}
