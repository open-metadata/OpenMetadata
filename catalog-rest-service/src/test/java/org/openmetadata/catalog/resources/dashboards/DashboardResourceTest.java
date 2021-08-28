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
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.charts.ChartResourceTest;
import org.openmetadata.catalog.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.readOnlyAttribute;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class DashboardResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(DashboardResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static List<EntityReference> CHART_REFERENCES;

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(TestUtils.DASHBOARD_URL);

    DashboardService service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("looker").withServiceType(DashboardServiceType.Looker);
    service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    LOOKER_REFERENCE = EntityUtil.getEntityReference(service);
    CHART_REFERENCES = new ArrayList<>();
    for (int i=0; i < 3; i++) {
      CreateChart createChart = ChartResourceTest.create(test, i).withService(SUPERSET_REFERENCE);
      Chart chart = ChartResourceTest.createChart(createChart, adminAuthHeaders());
      CHART_REFERENCES.add(EntityUtil.getEntityReference(chart));
    }

  }

  @Test
  public void post_dashboardWithLongName_400_badRequest(TestInfo test) {
    // Create dashboard with mandatory name field empty
    CreateDashboard create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_DashboardWithoutName_400_badRequest(TestInfo test) {
    // Create Dashboard with mandatory name field empty
    CreateDashboard create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_DashboardAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateDashboard create = create(test);
    createDashboard(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validDashboards_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateDashboard create = create(test);
    createAndCheckDashboard(create, adminAuthHeaders());

    create.withName(getDashboardName(test, 1)).withDescription("description");
    createAndCheckDashboard(create, adminAuthHeaders());
  }

  @Test
  public void post_DashboardWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDashboard(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_DashboardWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDashboard(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_DashboardWithCharts_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckDashboard(create(test), CHART_REFERENCES, adminAuthHeaders());
  }

  @Test
  public void post_Dashboard_as_non_admin_401(TestInfo test) {
    CreateDashboard create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_DashboardWithoutRequiredService_4xx(TestInfo test) {
    CreateDashboard create = create(test).withService(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
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
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createDashboard(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_DashboardWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create Dashboard for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckDashboard(create(test).withService(service), adminAuthHeaders());

      // List Dashboards by filtering on service name and ensure right Dashboards are returned in the response
      DashboardList list = listDashboards("service", service.getName(), adminAuthHeaders());
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  public void get_DashboardListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listDashboards(null, null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listDashboards(null, null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listDashboards(null, null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_DashboardListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listDashboards(null, null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
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
  public void put_DashboardUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a Dashboard with POST
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withOwner(USER_OWNER1);
    createAndCheckDashboard(request, adminAuthHeaders());

    // Update Dashboard two times successfully with PUT requests
    updateAndCheckDashboard(request, OK, adminAuthHeaders());
    updateAndCheckDashboard(request, OK, adminAuthHeaders());
  }

  @Test
  public void put_DashboardCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new Dashboard with put
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckDashboard(request.withName(test.getDisplayName()).withDescription(null), CREATED, adminAuthHeaders());
  }

  @Test
  public void put_DashboardCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new Dashboard with put
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withOwner(USER_OWNER1);
    // Add Owner as admin
    createAndCheckDashboard(request, adminAuthHeaders());
    //Update the table as Owner
    updateAndCheckDashboard(request.withName(test.getDisplayName()).withDescription(null),
            CREATED, authHeaders(USER1.getEmail()));

  }

  @Test
  public void put_DashboardNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    createAndCheckDashboard(request, adminAuthHeaders());

    // Update null description with a new description
    Dashboard db = updateAndCheckDashboard(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_DashboardEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with empty description
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription("");
    createAndCheckDashboard(request, adminAuthHeaders());

    // Update empty description with a new description
    Dashboard db = updateAndCheckDashboard(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_DashboardNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription("description");
    createAndCheckDashboard(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Dashboard db = updateDashboard(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", db.getDescription());
  }

  @Test
  public void put_DashboardUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription("");
    createAndCheckDashboard(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckDashboard(request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders());

    // Remove ownership
    Dashboard db = updateAndCheckDashboard(request.withOwner(null), OK, adminAuthHeaders());
    assertNull(db.getOwner());
  }


  @Test
  public void put_DashboardChartsUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    createAndCheckDashboard(request, adminAuthHeaders());

    Dashboard dashboard = updateAndCheckDashboard(request
                    .withDescription("newDescription").withCharts(CHART_REFERENCES),
            OK, adminAuthHeaders());
    validateDashboardCharts(dashboard, CHART_REFERENCES);
    assertEquals("newDescription", dashboard.getDescription());
  }

  @Test
  public void put_AddRemoveDashboardChartsUpdate_200(TestInfo test) throws HttpResponseException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    createAndCheckDashboard(request, adminAuthHeaders());

    Dashboard dashboard = updateAndCheckDashboard(request
                    .withDescription("newDescription").withCharts(CHART_REFERENCES),
            OK, adminAuthHeaders());
    validateDashboardCharts(dashboard, CHART_REFERENCES);
    // remove a chart
    CHART_REFERENCES.remove(0);
    dashboard = updateAndCheckDashboard(request
                    .withDescription("newDescription").withCharts(CHART_REFERENCES),
            OK, adminAuthHeaders());
    validateDashboardCharts(dashboard, CHART_REFERENCES);
  }

  @Test
  public void get_nonExistentDashboard_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getDashboard(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.DASHBOARD, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_DashboardWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDashboard create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE);
    Dashboard dashboard = createAndCheckDashboard(create, adminAuthHeaders());
    validateGetWithDifferentFields(dashboard, false);
  }

  @Test
  public void get_DashboardByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateDashboard create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE);
    Dashboard dashboard = createAndCheckDashboard(create, adminAuthHeaders());
    validateGetWithDifferentFields(dashboard, true);
  }

  @Test
  public void patch_DashboardAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create Dashboard without description, owner
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    assertNull(dashboard.getDescription());
    assertNull(dashboard.getOwner());
    assertNotNull(dashboard.getService());

    dashboard = getDashboard(dashboard.getId(), "service,owner,usageSummary", adminAuthHeaders());
    dashboard.getService().setHref(null); // href is readonly and not patchable

    // Add description, owner when previously they were null
    dashboard = patchDashboardAttributesAndCheck(dashboard, "description",
            TEAM_OWNER1, adminAuthHeaders());
    dashboard.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    dashboard.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service

    // Replace description, tier, owner
    dashboard = patchDashboardAttributesAndCheck(dashboard, "description1",
            USER_OWNER1, adminAuthHeaders());
    dashboard.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    dashboard.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    patchDashboardAttributesAndCheck(dashboard, null, null, adminAuthHeaders());
  }

  @Test
  public void patch_DashboardIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure Dashboard ID can't be changed using patch
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    UUID dashboardId = dashboard.getId();
    String dashboardJson = JsonUtils.pojoToJson(dashboard);
    dashboard.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchDashboard(dashboardId, dashboardJson, dashboard, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.DASHBOARD, "id"));

    // ID can't be deleted
    dashboard.setId(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchDashboard(dashboardId, dashboardJson, dashboard, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.DASHBOARD, "id"));
  }

  @Test
  public void patch_DashboardNameChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure Dashboard name can't be changed using patch
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    String dashboardJson = JsonUtils.pojoToJson(dashboard);
    dashboard.setName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchDashboard(dashboardJson, dashboard, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.DASHBOARD, "name"));

    // Name can't be removed
    dashboard.setName(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchDashboard(dashboardJson, dashboard, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.DASHBOARD, "name"));
  }

  @Test
  public void patch_DashboardRemoveService_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure service corresponding to Dashboard can't be changed by patch operation
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    dashboard.getService().setHref(null); // Remove href from returned response as it is read-only field

    String dashboardJson = JsonUtils.pojoToJson(dashboard);
    dashboard.setService(LOOKER_REFERENCE);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchDashboard(dashboardJson, dashboard, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.DASHBOARD, "service"));

    // Service relationship can't be removed
    dashboard.setService(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchDashboard(dashboardJson, dashboard, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.DASHBOARD, "service"));
  }

  // TODO listing tables test:1
  // TODO Change service?

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
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteDashboard(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.DASHBOARD, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Dashboard createAndCheckDashboard(CreateDashboard create,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Dashboard dashboard = createDashboard(create, authHeaders);
    validateDashboard(dashboard, create.getDescription(), create.getOwner(), create.getService());
    return getAndValidate(dashboard.getId(), create, authHeaders);
  }

  public static Dashboard createAndCheckDashboard(CreateDashboard create, List<EntityReference> charts,
                                                  Map<String, String> authHeaders) throws HttpResponseException {
    create.withCharts(charts);
    Dashboard dashboard = createDashboard(create, authHeaders);
    validateDashboard(dashboard, create.getDescription(), create.getOwner(), create.getService(), charts);
    return getAndValidate(dashboard.getId(), create, authHeaders);
  }

  public static Dashboard updateAndCheckDashboard(CreateDashboard create,
                                                Status status,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Dashboard updatedDashboard = updateDashboard(create, status, authHeaders);
    validateDashboard(updatedDashboard, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly updated Dashboard and validate
    return getAndValidate(updatedDashboard.getId(), create, authHeaders);
  }

  // Make sure in GET operations the returned Dashboard has all the required information passed during creation
  public static Dashboard getAndValidate(UUID dashboardId,
                                        CreateDashboard create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    // GET the newly created Dashboard by ID and validate
    Dashboard dashboard = getDashboard(dashboardId, "service,owner,charts", authHeaders);
    validateDashboard(dashboard, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly created Dashboard by name and validate
    String fqn = dashboard.getFullyQualifiedName();
    dashboard = getDashboardByName(fqn, "service,owner,charts", authHeaders);
    return validateDashboard(dashboard, create.getDescription(), create.getOwner(), create.getService());
  }

  public static Dashboard updateDashboard(CreateDashboard create,
                                        Status status,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("dashboards"),
                          create, Dashboard.class, status, authHeaders);
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
    assertNull(dashboard.getService());
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

  private static Dashboard validateDashboard(Dashboard dashboard, String expectedDescription, 
                                            EntityReference expectedOwner, EntityReference expectedService) {
    assertNotNull(dashboard.getId());
    assertNotNull(dashboard.getHref());
    assertEquals(expectedDescription, dashboard.getDescription());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(dashboard.getOwner());
      assertEquals(expectedOwner.getId(), dashboard.getOwner().getId());
      assertEquals(expectedOwner.getType(), dashboard.getOwner().getType());
      assertNotNull(dashboard.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(dashboard.getService());
      assertEquals(expectedService.getId(), dashboard.getService().getId());
      assertEquals(expectedService.getType(), dashboard.getService().getType());
    }
    return dashboard;
  }

  private static Dashboard validateDashboard(Dashboard dashboard, String expectedDescription,
                                             EntityReference expectedOwner, EntityReference expectedService,
                                              List<EntityReference> charts) {
    assertNotNull(dashboard.getId());
    assertNotNull(dashboard.getHref());
    assertEquals(expectedDescription, dashboard.getDescription());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(dashboard.getOwner());
      assertEquals(expectedOwner.getId(), dashboard.getOwner().getId());
      assertEquals(expectedOwner.getType(), dashboard.getOwner().getType());
      assertNotNull(dashboard.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(dashboard.getService());
      assertEquals(expectedService.getId(), dashboard.getService().getId());
      assertEquals(expectedService.getType(), dashboard.getService().getType());
    }
    validateDashboardCharts(dashboard, charts);
    return dashboard;
  }

  private static void validateDashboardCharts(Dashboard dashboard, List<EntityReference> charts) {
    if (charts != null) {
      List<UUID> expectedChartReferences = new ArrayList<>();
      for (EntityReference chart: charts) {
        expectedChartReferences.add(chart.getId());
      }
      List<UUID> actualChartReferences = new ArrayList<>();
      for (EntityReference chart: dashboard.getCharts()) {
        TestUtils.validateEntityReference(chart);
        actualChartReferences.add(chart.getId());
      }
      assertTrue(actualChartReferences.containsAll(expectedChartReferences));
    }
  }

  private Dashboard patchDashboardAttributesAndCheck(Dashboard dashboard, String newDescription,
                                                EntityReference newOwner, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String dashboardJson = JsonUtils.pojoToJson(dashboard);

    // Update the table attributes
    dashboard.setDescription(newDescription);
    dashboard.setOwner(newOwner);

    // Validate information returned in patch response has the updates
    Dashboard updatedDashboard = patchDashboard(dashboardJson, dashboard, authHeaders);
    validateDashboard(updatedDashboard, dashboard.getDescription(), newOwner, null);

    // GET the table and Validate information returned
    Dashboard getDashboard = getDashboard(dashboard.getId(), "service,owner", authHeaders);
    validateDashboard(getDashboard, dashboard.getDescription(), newOwner, null);
    return updatedDashboard;
  }

  private Dashboard patchDashboard(UUID dashboardId, String originalJson, Dashboard updatedDashboard,
                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updateDashboardJson = JsonUtils.pojoToJson(updatedDashboard);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateDashboardJson);
    return TestUtils.patch(getResource("dashboards/" + dashboardId), patch, Dashboard.class, authHeaders);
  }

  private Dashboard patchDashboard(String originalJson,
                                 Dashboard updatedDashboard,
                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchDashboard(updatedDashboard.getId(), originalJson, updatedDashboard, authHeaders);
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
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getDashboard(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.DASHBOARD, id));
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
}
