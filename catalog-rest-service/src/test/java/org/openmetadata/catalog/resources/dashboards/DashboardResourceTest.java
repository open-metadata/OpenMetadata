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
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.charts.ChartResourceTest;
import org.openmetadata.catalog.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
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
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class DashboardResourceTest extends EntityResourceTest<Dashboard> {
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static EntityReference SUPERSET_INVALID_SERVICE_REFERENCE;
  public static List<EntityReference> CHART_REFERENCES;

  public DashboardResourceTest() {
    super(Dashboard.class, DashboardList.class, "dashboards", DashboardResource.FIELDS, true, true, true);
  }


  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    EntityResourceTest.setup(test);

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
      Map<String, String> queryParams = new HashMap<>() {{put("service", service.getName());}};
      ResultList<Dashboard> list = listEntities(queryParams, adminAuthHeaders());
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
        String expectedFQN = service.getName() + "." + db.getName();
        assertEquals(expectedFQN, db.getFullyQualifiedName());
      }
    }
  }

  @Test
  public void put_DashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Dashboard dashboard = createAndCheckEntity(request, adminAuthHeaders());

    // Add description, and charts
    List<FieldChange> fields = new ArrayList<>();
    fields.add(new FieldChange().withName("description").withNewValue("newDescription"));
    fields.add(new FieldChange().withName("charts").withNewValue(CHART_REFERENCES));
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(fields);
    updateAndCheckEntity(request.withDescription("newDescription").withCharts(CHART_REFERENCES),
            OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void put_AddRemoveDashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Dashboard dashboard = createAndCheckEntity(request, adminAuthHeaders());

    // Add charts
    FieldChange charts = new FieldChange().withName("charts").withNewValue(CHART_REFERENCES);
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(singletonList(charts));
    dashboard = updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, adminAuthHeaders(),
            MINOR_UPDATE, change);
    validateDashboardCharts(dashboard, CHART_REFERENCES);

    // remove a chart
    charts = new FieldChange().withName("charts").withOldValue(List.of(CHART_REFERENCES.get(0)));
    CHART_REFERENCES.remove(0);
    change = getChangeDescription(dashboard.getVersion()).withFieldsDeleted(singletonList(charts));
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
  public Object createRequest(TestInfo test, int index, String description, String displayName, EntityReference owner) {
    return create(test, index).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Dashboard dashboard, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    CreateDashboard createRequest = (CreateDashboard) request;
    validateCommonEntityFields(getEntityInterface(dashboard), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertService(createRequest.getService(), dashboard.getService());
    validateDashboardCharts(dashboard, createRequest.getCharts());
    TestUtils.assertTags(dashboard.getFullyQualifiedName(), createRequest.getTags(), dashboard.getTags());
  }

  @Override
  public void validateUpdatedEntity(Dashboard dashboard, Object request, Map<String, String> authHeaders) throws HttpResponseException {
    validateCreatedEntity(dashboard, request, authHeaders);
  }

  @Override
  public void validatePatchedEntity(Dashboard expected, Dashboard updated, Map<String, String> authHeaders) {
  }

  @Override
  public EntityInterface<Dashboard> getEntityInterface(Dashboard entity) {
    return new DashboardEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.contains("charts")) {
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEquals(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
