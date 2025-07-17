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

package org.openmetadata.service.resources.charts;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.charts.ChartResource.ChartList;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class ChartResourceTest extends EntityResourceTest<Chart, CreateChart> {
  private final DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();

  public ChartResourceTest() {
    super(Entity.CHART, Chart.class, ChartList.class, "charts", ChartResource.FIELDS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_chartWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_chartWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {METABASE_REFERENCE.getName(), LOOKER_REFERENCE.getName()};

    // Create chart for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List charts by filtering on service name and ensure right charts in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);
      ResultList<Chart> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Chart chart : list.getData()) {
        assertEquals(service, chart.getService().getName());
      }
    }
  }

  @Test
  void update_chart_200(TestInfo test) throws IOException {
    ChartType type1 = ChartType.Bar;
    ChartType type2 = ChartType.Line;

    // Create with no url, description and chart type.
    CreateChart request =
        createRequest(test)
            .withService(METABASE_REFERENCE.getName())
            .withSourceUrl(null)
            .withDescription(null)
            .withChartType(null);
    Chart chart = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Set url, description and chart type.
    ChangeDescription change = getChangeDescription(chart, MINOR_UPDATE);
    chart.withChartType(type1).withSourceUrl("url1").withDescription("desc1");
    fieldAdded(change, "description", "desc1");
    fieldAdded(change, "chartType", type1);
    fieldAdded(change, "sourceUrl", "url1");

    chart =
        updateAndCheckEntity(
            request.withDescription("desc1").withChartType(type1).withSourceUrl("url1"),
            OK,
            ADMIN_AUTH_HEADERS,
            MINOR_UPDATE,
            change);

    // Update description, chartType and chart url and verify update
    change = getChangeDescription(chart, MINOR_UPDATE);
    chart.withChartType(type2).withSourceUrl("url2").withDescription("desc2");

    fieldUpdated(change, "description", "desc1", "desc2");
    fieldUpdated(change, "chartType", type1, type2);
    fieldUpdated(change, "sourceUrl", "url1", "url2");

    updateAndCheckEntity(
        request.withDescription("desc2").withChartType(type2).withSourceUrl("url2"),
        OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void patch_chart_200(TestInfo test) throws IOException {
    ChartType type1 = ChartType.Bar;
    ChartType type2 = ChartType.Line;

    // Create with no url, description and chart type.
    CreateChart request =
        createRequest(test)
            .withService(METABASE_REFERENCE.getName())
            .withSourceUrl(null)
            .withDescription(null)
            .withChartType(null);
    Chart chart = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(chart);

    // Set url, description and chart type.
    ChangeDescription change = getChangeDescription(chart, MINOR_UPDATE);
    chart.withChartType(type1).withSourceUrl("url1").withDescription("desc1");
    fieldAdded(change, "description", "desc1");
    fieldAdded(change, "chartType", type1);
    fieldAdded(change, "sourceUrl", "url1");
    chart = patchEntityAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update description, chartType and chart url and verify patch
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(chart);
    change = getChangeDescription(chart, MINOR_UPDATE);
    fieldUpdated(change, "description", "desc1", "desc2");
    fieldUpdated(change, "chartType", type1, type2);
    fieldUpdated(change, "sourceUrl", "url1", "url2");
    chart.withChartType(type2).withSourceUrl("url2").withDescription("desc2");
    patchEntityAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a dashboard service, carry it forward from the chart
    CreateDashboardService createService =
        serviceTest.createRequest(test).withDomain(DOMAIN.getFullyQualifiedName());
    DashboardService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a chart without domain and ensure it inherits domain from the parent
    CreateChart create = createRequest("chart").withService(service.getFullyQualifiedName());
    assertDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create dashboard service with owner data consumer
    CreateDashboardService createDashboardService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    DashboardService service = serviceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create chart under it
    createEntity(
        createRequest("chart").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Override
  @Execution(ExecutionMode.CONCURRENT)
  public Chart validateGetWithDifferentFields(Chart chart, boolean byName)
      throws HttpResponseException {
    String fields = "";
    chart =
        byName
            ? getEntityByName(chart.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(chart.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(chart.getService(), chart.getServiceType());
    assertListNull(chart.getOwners(), chart.getFollowers());
    assertTrue(chart.getTags().isEmpty());

    // .../charts?fields=owners
    fields = "owners,followers,tags";
    chart =
        byName
            ? getEntityByName(chart.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(chart.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(chart.getService(), chart.getServiceType());
    // Checks for other owners, tags, and followers is done in the base class
    return chart;
  }

  @Override
  public CreateChart createRequest(String name) {
    return new CreateChart()
        .withName(name)
        .withService(getContainer().getName())
        .withChartType(ChartType.Area);
  }

  @Override
  public EntityReference getContainer() {
    return METABASE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Chart entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      Chart chart, CreateChart createRequest, Map<String, String> authHeaders) {
    assertNotNull(chart.getServiceType());
    assertReference(createRequest.getService(), chart.getService());
    assertEquals(createRequest.getChartType(), chart.getChartType());
    assertEquals(createRequest.getSourceUrl(), chart.getSourceUrl());
  }

  @Test
  void patch_usingFqn_chart_200(TestInfo test) throws IOException {
    ChartType type1 = ChartType.Bar;
    ChartType type2 = ChartType.Line;

    // Create with no url, description and chart type.
    CreateChart request =
        createRequest(test)
            .withService(METABASE_REFERENCE.getName())
            .withSourceUrl(null)
            .withDescription(null)
            .withChartType(null);
    Chart chart = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(chart);

    // Set url, description and chart type.
    ChangeDescription change = getChangeDescription(chart, MINOR_UPDATE);
    chart.withChartType(type1).withSourceUrl("url1").withDescription("desc1");
    fieldAdded(change, "description", "desc1");
    fieldAdded(change, "chartType", type1);
    fieldAdded(change, "sourceUrl", "url1");
    chart =
        patchEntityUsingFqnAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update description, chartType and chart url and verify patch
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(chart);
    change = getChangeDescription(chart, MINOR_UPDATE);
    fieldUpdated(change, "description", "desc1", "desc2");
    fieldUpdated(change, "chartType", type1, type2);
    fieldUpdated(change, "sourceUrl", "url1", "url2");
    chart.withChartType(type2).withSourceUrl("url2").withDescription("desc2");
    patchEntityUsingFqnAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  public void testChartWithDashboards() throws IOException {
    DashboardResourceTest dashboardResourceTest = new DashboardResourceTest();
    // Create a new CreateChart request with a populated "dashboards" field
    CreateChart request =
        createRequest("chartWithDashboards")
            .withService(METABASE_REFERENCE.getName())
            .withDashboards(DASHBOARD_REFERENCES);
    Chart chart = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Validate that the created Chart entity has the expected "dashboards" field
    assertNotNull(chart.getDashboards());
    assertEquals(3, chart.getDashboards().size());
    assertEquals("dashboard0", chart.getDashboards().get(0).getName());
    assertEquals("dashboard1", chart.getDashboards().get(1).getName());
    assertEquals("dashboard2", chart.getDashboards().get(2).getName());

    // Check that each dashboard  contains the newly created chart in their charts field
    for (EntityReference dashboardRef : chart.getDashboards()) {
      Dashboard dashboard =
          dashboardResourceTest.getEntity(dashboardRef.getId(), "charts", ADMIN_AUTH_HEADERS);
      assertNotNull(dashboard.getCharts());
      assertTrue(
          dashboard.getCharts().stream()
              .map(EntityReference::getId)
              .anyMatch(chart.getId()::equals));
    }

    // Create a new Dashboard entity
    CreateDashboard createDashboardRequest =
        new CreateDashboard().withName("dashboard3").withService(METABASE_REFERENCE.getName());
    Dashboard dashboard3 =
        dashboardResourceTest.createAndCheckEntity(createDashboardRequest, ADMIN_AUTH_HEADERS);

    // Update the "dashboards" field of the Chart entity with PATCH request with newly created
    // dashboard3
    String originalJson = JsonUtils.pojoToJson(chart);
    ChangeDescription change = getChangeDescription(chart, MINOR_UPDATE);
    fieldDeleted(change, "dashboards", chart.getDashboards());
    fieldAdded(change, "dashboards", List.of(dashboard3.getEntityReference()));
    chart.withDashboards(List.of(dashboard3.getEntityReference()));
    chart = patchEntityAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Retrieve the Chart entity and validate that the retrieved entity has the updated "dashboards"
    // field
    chart = getEntity(chart.getId(), "dashboards", ADMIN_AUTH_HEADERS);
    assertNotNull(chart.getDashboards());
    assertEquals(1, chart.getDashboards().size());
    assertEquals("dashboard3", chart.getDashboards().get(0).getName());

    // Verify dashboard3 contains the respective chart
    dashboard3 = dashboardResourceTest.getEntity(dashboard3.getId(), "charts", ADMIN_AUTH_HEADERS);
    assertTrue(
        dashboard3.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals));

    // Create a new Dashboard entity
    createDashboardRequest =
        new CreateDashboard().withName("dashboard4").withService(METABASE_REFERENCE.getName());
    Dashboard dashboard4 =
        dashboardResourceTest.createAndCheckEntity(createDashboardRequest, ADMIN_AUTH_HEADERS);

    // Update the "dashboards" field of the Chart entity with PUT request with newly created
    // dashboard4
    change = getChangeDescription(chart, MINOR_UPDATE);
    fieldDeleted(change, "dashboards", chart.getDashboards());
    fieldAdded(change, "dashboards", List.of(dashboard4.getEntityReference()));
    chart.withDashboards(List.of(dashboard4.getEntityReference()));
    updateAndCheckEntity(
        request.withDashboards(List.of(dashboard4.getEntityReference().getFullyQualifiedName())),
        OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);

    // Verify dashboard4 contains the respective chart
    dashboard4 = dashboardResourceTest.getEntity(dashboard4.getId(), "charts", ADMIN_AUTH_HEADERS);
    assertTrue(
        dashboard4.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals));

    // Delete the chart
    deleteEntity(chart.getId(), ADMIN_AUTH_HEADERS);
    // Check that dashboard4  does not contain the deleted chart in their charts field
    dashboard4 = dashboardResourceTest.getEntity(dashboard4.getId(), "charts", ADMIN_AUTH_HEADERS);
    assertTrue(
        dashboard4.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals));
  }

  @Override
  public void compareEntities(Chart expected, Chart patched, Map<String, String> authHeaders) {
    assertReference(expected.getService(), patched.getService());
    assertEquals(expected.getChartType(), patched.getChartType());
    assertEquals(expected.getSourceUrl(), patched.getSourceUrl());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("chartType")) {
      ChartType expectedChartType = ChartType.fromValue(expected.toString());
      ChartType actualChartType = ChartType.fromValue(actual.toString());
      assertEquals(expectedChartType, actualChartType);
    } else if (fieldName.contains("dashboards")) {
      assertEntityReferencesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
