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

package org.openmetadata.service.resources.dashboards;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_DELETED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertEntityReferenceNames;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.charts.ChartResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DashboardResourceTest extends EntityResourceTest<Dashboard, CreateDashboard> {
  public static final String SUPERSET_INVALID_SERVICE = "invalid_superset_service";
  private final ChartResourceTest chartResourceTest = new ChartResourceTest();

  public DashboardResourceTest() {
    super(
        Entity.DASHBOARD,
        Dashboard.class,
        DashboardList.class,
        "dashboards",
        DashboardResource.FIELDS);
    supportsSearchIndex = true;
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_DashboardWithCharts_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withCharts(CHART_REFERENCES), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_DashboardWithoutRequiredService_4xx(TestInfo test) {
    CreateDashboard create = createRequest(test).withService(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_DashboardWithInvalidService_4xx(TestInfo test) {
    CreateDashboard create = createRequest(test).withService(SUPERSET_INVALID_SERVICE);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.DASHBOARD_SERVICE, SUPERSET_INVALID_SERVICE));
  }

  @Test
  void post_DashboardWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {METABASE_REFERENCE, LOOKER_REFERENCE};

    // Create Dashboard for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          createRequest(test).withService(service.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);
      // List Dashboards by filtering on service name and ensure right Dashboards in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<Dashboard> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
        String expectedFQN = FullyQualifiedName.add(service.getFullyQualifiedName(), db.getName());
        assertEquals(expectedFQN, db.getFullyQualifiedName());
      }
    }
  }

  @Test
  void put_DashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = createRequest(test).withDescription(null).withCharts(null);
    Dashboard dashboard = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description, and charts
    ChangeDescription change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, "charts", CHART_REFERENCES);
    updateAndCheckEntity(
        request.withDescription("newDescription").withCharts(CHART_REFERENCES),
        OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_AddRemoveDashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = createRequest(test).withDescription(null).withCharts(null);
    Dashboard dashboard = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add charts
    ChangeDescription change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldAdded(change, "charts", CHART_REFERENCES);
    dashboard =
        updateAndCheckEntity(
            request.withCharts(CHART_REFERENCES), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEntityReferenceNames(CHART_REFERENCES, dashboard.getCharts());

    // remove a chart
    change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldDeleted(change, "charts", List.of(CHART_REFERENCES.get(0)));
    CHART_REFERENCES.remove(0);
    updateAndCheckEntity(
        request.withCharts(CHART_REFERENCES), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a Dashboard service, carry it forward from the dashboard
    DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();
    CreateDashboardService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    DashboardService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a dashboard without domain and ensure it inherits domain from the parent
    CreateDashboard create =
        createRequest("dashboard").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a dashboard service with owner data consumer
    DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    DashboardService service = serviceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create dashboard under it
    createEntity(
        createRequest("dashboard").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void test_deleteDashboard_chartBelongsToSingleDashboard_chartIsDeleted_thenRestored(TestInfo test)
      throws IOException {
    // Create charts first using ChartResourceTest
    List<String> chartFqns = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateChart createChart =
          chartResourceTest.createRequest(test, i).withService(METABASE_REFERENCE.getName());
      Chart chart = chartResourceTest.createEntity(createChart, ADMIN_AUTH_HEADERS);
      chartFqns.add(chart.getFullyQualifiedName());
    }

    // Create a dashboard with these charts
    CreateDashboard create =
        createRequest(test)
            .withService(METABASE_REFERENCE.getFullyQualifiedName())
            .withCharts(chartFqns);
    Dashboard dashboard = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Verify the dashboard has charts
    assertNotNull(dashboard.getCharts());
    assertFalse(dashboard.getCharts().isEmpty());

    // Store all chart IDs for verification after dashboard deletion
    List<EntityReference> charts = dashboard.getCharts();

    // For each chart, verify it belongs only to this dashboard
    for (EntityReference chartRef : charts) {
      // Get the chart entity with dashboards field included
      Chart chart = chartResourceTest.getEntity(chartRef.getId(), "dashboards", ADMIN_AUTH_HEADERS);

      // Check chart has exactly one dashboard
      assertEquals(
          1,
          chart.getDashboards().size(),
          "Chart should belong to exactly one dashboard before deletion test");

      // Verify it's the dashboard we created
      assertEquals(
          dashboard.getId(),
          chart.getDashboards().getFirst().getId(),
          "Chart should belong to our test dashboard");
    }

    // Delete the dashboard
    dashboard = deleteAndCheckEntity(dashboard, ADMIN_AUTH_HEADERS);

    // Now verify that the charts are actually soft deleted and not hard deleted
    List<Chart> deletedCharts = new ArrayList<>();
    for (EntityReference chartRef : charts) {
      // Get the chart with include=deleted
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.DELETED.value());

      Chart deletedChart =
          chartResourceTest.getEntity(chartRef.getId(), queryParams, "", ADMIN_AUTH_HEADERS);

      // Verify the chart is marked as deleted
      assertTrue(deletedChart.getDeleted(), "Chart should be marked as deleted");
      assertEquals(
          chartRef.getId(), deletedChart.getId(), "Found chart should match the original chart ID");
      deletedCharts.add(deletedChart);
    }

    // Restore the dashboard
    ChangeDescription change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldUpdated(change, FIELD_DELETED, true, false);
    restoreAndCheckEntity(dashboard, ADMIN_AUTH_HEADERS, change);

    // Verify charts are also restored when their parent dashboard is restored
    for (Chart deletedChart : deletedCharts) {
      // Verify chart is accessible again
      Chart restoredChart =
          chartResourceTest.getEntity(deletedChart.getId(), "dashboards", ADMIN_AUTH_HEADERS);
      assertFalse(
          restoredChart.getDeleted(),
          "Chart should not be marked as deleted after dashboard restoration");

      // Verify chart is associated with the restored dashboard
      assertEquals(
          1,
          restoredChart.getDashboards().size(),
          "Chart should have exactly one dashboard after restoration");
      assertEquals(
          dashboard.getId(),
          restoredChart.getDashboards().getFirst().getId(),
          "Chart should be associated with the restored dashboard");
    }
  }

  @Test
  void test_chartWithMultipleDashboards_deleteAndRestoreOneDashboard(TestInfo test)
      throws IOException {
    // Create charts first using ChartResourceTest
    List<String> chartFqns = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateChart createChart =
          chartResourceTest.createRequest(test, i).withService(METABASE_REFERENCE.getName());
      Chart chart = chartResourceTest.createEntity(createChart, ADMIN_AUTH_HEADERS);
      chartFqns.add(chart.getFullyQualifiedName());
    }

    // Create first dashboard with all charts
    CreateDashboard create1 =
        createRequest(getEntityName(test) + "-first")
            .withService(METABASE_REFERENCE.getFullyQualifiedName())
            .withCharts(chartFqns);
    Dashboard dashboard1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Create second dashboard with the same charts
    CreateDashboard create2 =
        createRequest(getEntityName(test) + "-second")
            .withService(METABASE_REFERENCE.getFullyQualifiedName())
            .withCharts(chartFqns);
    final Dashboard dashboard2 = createAndCheckEntity(create2, ADMIN_AUTH_HEADERS);

    // Store all chart IDs for verification after dashboard deletion
    List<EntityReference> charts = dashboard1.getCharts();

    // Delete the first dashboard
    final Dashboard deletedDashboard1 = deleteAndCheckEntity(dashboard1, ADMIN_AUTH_HEADERS);

    // Verify charts are still accessible (not deleted)
    for (EntityReference chartRef : charts) {
      // Get the chart entity with dashboards field included
      Chart chart = chartResourceTest.getEntity(chartRef.getId(), "dashboards", ADMIN_AUTH_HEADERS);

      // Check chart still exists
      assertNotNull(chart);

      // Verify the chart itself isn't deleted
      assertFalse(chart.getDeleted(), "Chart should not be marked as deleted");

      // Count non-deleted dashboards
      long nonDeletedDashboards =
          chart.getDashboards().stream().filter(d -> !Boolean.TRUE.equals(d.getDeleted())).count();
      assertEquals(
          1,
          nonDeletedDashboards,
          "Chart should belong to exactly one non-deleted dashboard after first dashboard deletion");

      // Verify one of the dashboards is the non-deleted second dashboard
      boolean hasSecondDashboard =
          chart.getDashboards().stream()
              .anyMatch(
                  d ->
                      d.getId().equals(dashboard2.getId()) && !Boolean.TRUE.equals(d.getDeleted()));
      assertTrue(hasSecondDashboard, "Chart should still belong to second test dashboard");
    }

    // Restore the first dashboard
    ChangeDescription change = getChangeDescription(deletedDashboard1, MINOR_UPDATE);
    fieldUpdated(change, FIELD_DELETED, true, false);
    restoreAndCheckEntity(deletedDashboard1, ADMIN_AUTH_HEADERS, change);

    // Verify charts now have associations with both dashboards
    for (EntityReference chartRef : charts) {
      // Get the chart entity with dashboards field included
      Chart chart = chartResourceTest.getEntity(chartRef.getId(), "dashboards", ADMIN_AUTH_HEADERS);

      // Verify chart is still not deleted
      assertFalse(chart.getDeleted(), "Chart should not be marked as deleted");

      // Count non-deleted dashboards - should be 2 now
      long nonDeletedDashboards =
          chart.getDashboards().stream().filter(d -> !Boolean.TRUE.equals(d.getDeleted())).count();
      assertEquals(
          2,
          nonDeletedDashboards,
          "Chart should belong to two non-deleted dashboards after first dashboard restoration");

      // Verify both dashboards are associated with the chart
      boolean hasFirstDashboard =
          chart.getDashboards().stream()
              .anyMatch(
                  d ->
                      d.getId().equals(deletedDashboard1.getId())
                          && !Boolean.TRUE.equals(d.getDeleted()));
      boolean hasSecondDashboard =
          chart.getDashboards().stream()
              .anyMatch(
                  d ->
                      d.getId().equals(dashboard2.getId()) && !Boolean.TRUE.equals(d.getDeleted()));
      assertTrue(
          hasFirstDashboard,
          "Chart should be associated with the first dashboard after restoration");
      assertTrue(hasSecondDashboard, "Chart should still be associated with the second dashboard");
    }

    // Now delete both dashboards
    deleteEntity(deletedDashboard1.getId(), true, false, ADMIN_AUTH_HEADERS);
    deleteEntity(dashboard2.getId(), true, false, ADMIN_AUTH_HEADERS);

    // Verify charts are now soft deleted
    for (EntityReference chartRef : charts) {
      // Verify chart cannot be retrieved normally
      assertResponse(
          () -> chartResourceTest.getEntity(chartRef.getId(), "", ADMIN_AUTH_HEADERS),
          NOT_FOUND,
          entityNotFound(Entity.CHART, chartRef.getId()));

      // Verify chart can be retrieved with include=deleted parameter
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.DELETED.value());

      Chart deletedChart =
          chartResourceTest.getEntity(chartRef.getId(), queryParams, "", ADMIN_AUTH_HEADERS);

      // Verify the chart is marked as deleted
      assertTrue(
          deletedChart.getDeleted(),
          "Chart should be marked as deleted after all dashboards are deleted");
      assertEquals(
          chartRef.getId(), deletedChart.getId(), "Found chart should match the original chart ID");
    }
  }

  @Override
  public Dashboard validateGetWithDifferentFields(Dashboard dashboard, boolean byName)
      throws HttpResponseException {
    String fields = "";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboard.getId(), fields, ADMIN_AUTH_HEADERS);
    // We always return the service
    assertListNotNull(dashboard.getService(), dashboard.getServiceType());
    assertListNull(
        dashboard.getOwners(),
        dashboard.getCharts(),
        dashboard.getFollowers(),
        dashboard.getUsageSummary());
    assertTrue(dashboard.getTags().isEmpty());

    fields = "owners,charts,followers,tags,usageSummary";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboard.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dashboard.getService(), dashboard.getServiceType());
    assertListNotNull(dashboard.getUsageSummary());
    TestUtils.validateEntityReferences(dashboard.getCharts(), true);
    // Checks for other owner, tags, and followers is done in the base class
    return dashboard;
  }

  @Override
  public CreateDashboard createRequest(String name) {
    return new CreateDashboard()
        .withName(name)
        .withService(getContainer().getName())
        .withCharts(CHART_REFERENCES);
  }

  @Override
  public EntityReference getContainer() {
    return METABASE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Dashboard entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      Dashboard dashboard, CreateDashboard createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertNotNull(dashboard.getServiceType());
    assertReference(createRequest.getService(), dashboard.getService());
    assertEntityReferenceNames(createRequest.getCharts(), dashboard.getCharts());
    TestUtils.validateTags(createRequest.getTags(), dashboard.getTags());
  }

  @Override
  public void compareEntities(
      Dashboard expected, Dashboard updated, Map<String, String> authHeaders) {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.contains("charts")) {
      assertEntityNamesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
