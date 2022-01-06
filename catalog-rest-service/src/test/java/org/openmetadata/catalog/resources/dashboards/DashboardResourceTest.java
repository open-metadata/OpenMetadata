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

package org.openmetadata.catalog.resources.dashboards;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.invalidServiceEntity;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.core.Response;
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

public class DashboardResourceTest extends EntityResourceTest<Dashboard> {
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static EntityReference SUPERSET_INVALID_SERVICE_REFERENCE;
  public static List<EntityReference> CHART_REFERENCES;

  public DashboardResourceTest() {
    super(
        Entity.DASHBOARD,
        Dashboard.class,
        DashboardList.class,
        "dashboards",
        DashboardResource.FIELDS,
        true,
        true,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);

    CreateDashboardService createService =
        new CreateDashboardService()
            .withName("superset")
            .withServiceType(DashboardServiceType.Superset)
            .withDashboardUrl(TestUtils.DASHBOARD_URL);

    DashboardService service = new DashboardServiceResourceTest().createEntity(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();
    SUPERSET_INVALID_SERVICE_REFERENCE =
        new EntityReference()
            .withName("invalid_superset_service")
            .withId(SUPERSET_REFERENCE.getId())
            .withType("DashboardService1");

    createService.withName("looker").withServiceType(DashboardServiceType.Looker);
    service = new DashboardServiceResourceTest().createEntity(createService, adminAuthHeaders());
    LOOKER_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();
    CHART_REFERENCES = new ArrayList<>();
    ChartResourceTest chartResourceTest = new ChartResourceTest();
    for (int i = 0; i < 3; i++) {
      CreateChart createChart = chartResourceTest.create(test, i).withService(SUPERSET_REFERENCE);
      Chart chart = chartResourceTest.createEntity(createChart, adminAuthHeaders());
      CHART_REFERENCES.add(new ChartEntityInterface(chart).getEntityReference());
    }
  }

  @Test
  void post_validDashboards_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateDashboard create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  void post_DashboardWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  void post_DashboardWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Dashboard1"), adminAuthHeaders());
  }

  @Test
  void post_DashboardWithCharts_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withCharts(CHART_REFERENCES), adminAuthHeaders());
  }

  @Test
  void post_Dashboard_as_non_admin_401(TestInfo test) {
    CreateDashboard create = create(test);
    assertResponse(
        () -> createDashboard(create, authHeaders("test@open-metadata.org")),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_DashboardWithoutRequiredService_4xx(TestInfo test) {
    CreateDashboard create = create(test).withService(null);
    TestUtils.assertResponseContains(
        () -> createDashboard(create, adminAuthHeaders()), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_DashboardWithInvalidService_4xx(TestInfo test) {
    CreateDashboard create = create(test).withService(SUPERSET_INVALID_SERVICE_REFERENCE);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createDashboard(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(
        exception, BAD_REQUEST, invalidServiceEntity(SUPERSET_INVALID_SERVICE_REFERENCE.getType(), Entity.DASHBOARD));
  }

  @Test
  void post_DashboardWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create Dashboard for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          create(test).withService(new EntityReference().withId(service.getId()).withType(service.getType())),
          adminAuthHeaders());
      // List Dashboards by filtering on service name and ensure right Dashboards in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Dashboard> list = listEntities(queryParams, adminAuthHeaders());
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
        String expectedFQN = service.getName() + "." + db.getName();
        assertEquals(expectedFQN, db.getFullyQualifiedName());
      }
    }
  }

  @Test
  void put_DashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Dashboard dashboard = createAndCheckEntity(request, adminAuthHeaders());

    // Add description, and charts
    List<FieldChange> fields = new ArrayList<>();
    fields.add(new FieldChange().withName("description").withNewValue("newDescription"));
    fields.add(new FieldChange().withName("charts").withNewValue(CHART_REFERENCES));
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(fields);
    updateAndCheckEntity(
        request.withDescription("newDescription").withCharts(CHART_REFERENCES),
        OK,
        adminAuthHeaders(),
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_AddRemoveDashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Dashboard dashboard = createAndCheckEntity(request, adminAuthHeaders());

    // Add charts
    FieldChange charts = new FieldChange().withName("charts").withNewValue(CHART_REFERENCES);
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(singletonList(charts));
    dashboard =
        updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, adminAuthHeaders(), MINOR_UPDATE, change);
    validateDashboardCharts(dashboard, CHART_REFERENCES);

    // remove a chart
    charts = new FieldChange().withName("charts").withOldValue(List.of(CHART_REFERENCES.get(0)));
    CHART_REFERENCES.remove(0);
    change = getChangeDescription(dashboard.getVersion()).withFieldsDeleted(singletonList(charts));
    updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void delete_emptyDashboard_200_ok(TestInfo test) throws HttpResponseException {
    Dashboard dashboard = createDashboard(create(test), adminAuthHeaders());
    deleteEntity(dashboard.getId(), adminAuthHeaders());
  }

  @Test
  void delete_nonEmptyDashboard_4xx() {
    // TODO
  }

  @Test
  void delete_put_Dashboard_200(TestInfo test) throws IOException {
    CreateDashboard request = create(test).withDescription("");
    Dashboard dashboard = createEntity(request, adminAuthHeaders());

    // Delete
    deleteEntity(dashboard.getId(), adminAuthHeaders());

    ChangeDescription change = getChangeDescription(dashboard.getVersion());
    change.setFieldsUpdated(
        Arrays.asList(
            new FieldChange().withName("deleted").withNewValue(false).withOldValue(true),
            new FieldChange().withName("description").withNewValue("updatedDescription").withOldValue("")));

    // PUT with updated description
    updateAndCheckEntity(
        request.withDescription("updatedDescription"), Response.Status.OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  public Dashboard createDashboard(CreateDashboard create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("dashboards"), create, Dashboard.class, authHeaders);
  }

  /** Validate returned fields GET .../dashboards/{id}?fields="..." or GET .../dashboards/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Dashboard dashboard, boolean byName) throws HttpResponseException {
    // .../Dashboards?fields=owner
    String fields = "owner";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getEntity(dashboard.getId(), fields, adminAuthHeaders());
    // We always return the service
    assertListNotNull(dashboard.getOwner(), dashboard.getService(), dashboard.getServiceType());
    assertListNull(dashboard.getCharts(), dashboard.getUsageSummary());

    // .../Dashboards?fields=owner,service,tables
    fields = "owner,charts,usageSummary";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getEntity(dashboard.getId(), fields, adminAuthHeaders());
    assertListNotNull(
        dashboard.getOwner(),
        dashboard.getService(),
        dashboard.getServiceType(),
        dashboard.getCharts(),
        dashboard.getUsageSummary());
    TestUtils.validateEntityReference(dashboard.getCharts());
  }

  private static void validateDashboardCharts(Dashboard dashboard, List<EntityReference> expectedCharts) {
    if (expectedCharts != null) {
      List<UUID> expectedChartReferences =
          expectedCharts.stream().map(EntityReference::getId).collect(Collectors.toList());
      List<UUID> actualChartReferences = new ArrayList<>();
      dashboard
          .getCharts()
          .forEach(
              chart -> {
                TestUtils.validateEntityReference(chart);
                actualChartReferences.add(chart.getId());
              });
      assertEquals(expectedChartReferences.size(), actualChartReferences.size());
      assertTrue(actualChartReferences.containsAll(expectedChartReferences));
    }
  }

  public CreateDashboard create(TestInfo test) {
    return create(getEntityName(test));
  }

  public CreateDashboard create(String entityName) {
    return new CreateDashboard().withName(entityName).withService(SUPERSET_REFERENCE);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner)
        .withCharts(CHART_REFERENCES);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    CreateDashboard createDashboard = (CreateDashboard) createRequest;
    return createDashboard.getService();
  }

  @Override
  public void validateCreatedEntity(Dashboard dashboard, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateDashboard createRequest = (CreateDashboard) request;
    validateCommonEntityFields(
        getEntityInterface(dashboard),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertNotNull(dashboard.getServiceType());
    assertService(createRequest.getService(), dashboard.getService());
    validateDashboardCharts(dashboard, createRequest.getCharts());
    TestUtils.validateTags(createRequest.getTags(), dashboard.getTags());
  }

  @Override
  public void validateUpdatedEntity(Dashboard dashboard, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(dashboard, request, authHeaders);
  }

  @Override
  public void compareEntities(Dashboard expected, Dashboard updated, Map<String, String> authHeaders) {}

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
