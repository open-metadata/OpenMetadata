package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.DashboardType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Dashboard entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds dashboard-specific tests for
 * dashboard types, charts, and data models.
 *
 * <p>Migrated from: org.openmetadata.service.resources.dashboards.DashboardResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DashboardResourceIT extends BaseEntityIT<Dashboard, CreateDashboard> {

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDashboard createMinimalRequest(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test dashboard created by integration test");

    return request;
  }

  @Override
  protected CreateDashboard createRequest(String name, TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());

    return request;
  }

  @Override
  protected Dashboard createEntity(CreateDashboard createRequest) {
    return SdkClients.adminClient().dashboards().create(createRequest);
  }

  @Override
  protected Dashboard getEntity(String id) {
    return SdkClients.adminClient().dashboards().get(id);
  }

  @Override
  protected Dashboard getEntityByName(String fqn) {
    return SdkClients.adminClient().dashboards().getByName(fqn);
  }

  @Override
  protected Dashboard patchEntity(String id, Dashboard entity) {
    return SdkClients.adminClient().dashboards().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().dashboards().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().dashboards().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().dashboards().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "dashboard";
  }

  @Override
  protected void validateCreatedEntity(Dashboard entity, CreateDashboard createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Dashboard must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain dashboard name");
  }

  @Override
  protected ListResponse<Dashboard> listEntities(ListParams params) {
    return SdkClients.adminClient().dashboards().list(params);
  }

  @Override
  protected Dashboard getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().dashboards().get(id, fields);
  }

  @Override
  protected Dashboard getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().dashboards().getByName(fqn, fields);
  }

  @Override
  protected Dashboard getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().dashboards().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().dashboards().getVersionList(id);
  }

  @Override
  protected Dashboard getVersion(UUID id, Double version) {
    return SdkClients.adminClient().dashboards().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DASHBOARD-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_dashboardWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service is required field
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_no_service"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating dashboard without service should fail");
  }

  @Test
  void post_dashboardWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    DashboardType[] dashboardTypes = {DashboardType.Dashboard, DashboardType.Report};

    for (DashboardType dashboardType : dashboardTypes) {
      CreateDashboard request = new CreateDashboard();
      request.setName(ns.prefix("dashboard_" + dashboardType.toString().toLowerCase()));
      request.setService(service.getFullyQualifiedName());
      request.setDashboardType(dashboardType);

      Dashboard dashboard = createEntity(request);
      assertNotNull(dashboard);
      assertEquals(dashboardType, dashboard.getDashboardType());
    }
  }

  @Test
  void post_dashboardWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:3000/dashboards/1");

    Dashboard dashboard = createEntity(request);
    assertNotNull(dashboard);
    assertEquals("http://localhost:3000/dashboards/1", dashboard.getSourceUrl());
  }

  @Test
  void post_dashboardWithCharts_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create charts first
    CreateChart chartRequest1 = new CreateChart();
    chartRequest1.setName(ns.prefix("chart1"));
    chartRequest1.setService(service.getFullyQualifiedName());
    chartRequest1.setChartType(ChartType.Bar);
    Chart chart1 = client.charts().create(chartRequest1);

    CreateChart chartRequest2 = new CreateChart();
    chartRequest2.setName(ns.prefix("chart2"));
    chartRequest2.setService(service.getFullyQualifiedName());
    chartRequest2.setChartType(ChartType.Line);
    Chart chart2 = client.charts().create(chartRequest2);

    // Create dashboard with charts
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_with_charts"));
    request.setService(service.getFullyQualifiedName());
    request.setCharts(List.of(chart1.getFullyQualifiedName(), chart2.getFullyQualifiedName()));

    Dashboard dashboard = createEntity(request);
    assertNotNull(dashboard);

    // Fetch with charts field
    Dashboard fetched = client.dashboards().get(dashboard.getId().toString(), "charts");
    assertNotNull(fetched.getCharts());
    assertEquals(2, fetched.getCharts().size());
  }

  @Test
  void put_dashboardAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create dashboard with initial values
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_update"));
    request.setService(service.getFullyQualifiedName());
    request.setDashboardType(DashboardType.Dashboard);

    Dashboard dashboard = createEntity(request);
    assertNotNull(dashboard);

    // Update attributes
    dashboard.setSourceUrl("http://localhost:3000/dashboards/updated");
    dashboard.setDescription("Updated description");

    Dashboard updated = patchEntity(dashboard.getId().toString(), dashboard);
    assertNotNull(updated);
    assertEquals("http://localhost:3000/dashboards/updated", updated.getSourceUrl());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dashboardInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a dashboard service
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create a dashboard under the service
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_inherit_domain"));
    request.setService(service.getFullyQualifiedName());

    Dashboard dashboard = createEntity(request);
    assertNotNull(dashboard);
    assertNotNull(dashboard.getService());
    assertEquals(service.getFullyQualifiedName(), dashboard.getService().getFullyQualifiedName());
  }

  @Test
  void post_dashboardWithInvalidService_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String nonExistentServiceFqn = "non_existent_dashboard_service_" + UUID.randomUUID();
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_invalid_service"));
    request.setService(nonExistentServiceFqn);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating dashboard with non-existent service should fail");
  }

  @Test
  void put_dashboardChartsUpdate_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create charts
    CreateChart chartRequest = new CreateChart();
    chartRequest.setName(ns.prefix("chart_for_update"));
    chartRequest.setService(service.getFullyQualifiedName());
    chartRequest.setChartType(ChartType.Bar);
    Chart chart = client.charts().create(chartRequest);

    // Create dashboard without charts
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_add_charts"));
    request.setService(service.getFullyQualifiedName());

    Dashboard dashboard = createEntity(request);

    // Fetch with charts field
    Dashboard fetched = client.dashboards().get(dashboard.getId().toString(), "charts");

    // Add chart to dashboard
    fetched.setCharts(List.of(chart.getEntityReference()));
    Dashboard updated = patchEntity(fetched.getId().toString(), fetched);

    // Verify chart added
    Dashboard verify = client.dashboards().get(updated.getId().toString(), "charts");
    assertNotNull(verify.getCharts());
    assertEquals(1, verify.getCharts().size());
    assertEquals(chart.getId(), verify.getCharts().get(0).getId());
  }

  @Test
  void put_addRemoveDashboardChartsUpdate_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create two charts
    CreateChart chartRequest1 = new CreateChart();
    chartRequest1.setName(ns.prefix("chart_add_remove_1"));
    chartRequest1.setService(service.getFullyQualifiedName());
    chartRequest1.setChartType(ChartType.Bar);
    Chart chart1 = client.charts().create(chartRequest1);

    CreateChart chartRequest2 = new CreateChart();
    chartRequest2.setName(ns.prefix("chart_add_remove_2"));
    chartRequest2.setService(service.getFullyQualifiedName());
    chartRequest2.setChartType(ChartType.Line);
    Chart chart2 = client.charts().create(chartRequest2);

    // Create dashboard with chart1
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_add_remove_charts"));
    request.setService(service.getFullyQualifiedName());
    request.setCharts(List.of(chart1.getFullyQualifiedName()));

    Dashboard dashboard = createEntity(request);
    Dashboard fetched = client.dashboards().get(dashboard.getId().toString(), "charts");
    assertEquals(1, fetched.getCharts().size());

    // Replace chart1 with chart2
    fetched.setCharts(List.of(chart2.getEntityReference()));
    Dashboard updated = patchEntity(fetched.getId().toString(), fetched);

    Dashboard verify = client.dashboards().get(updated.getId().toString(), "charts");
    assertEquals(1, verify.getCharts().size());
    assertEquals(chart2.getId(), verify.getCharts().get(0).getId());
  }

  @Test
  void list_dashboardsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create multiple dashboards under the same service
    for (int i = 0; i < 5; i++) {
      CreateDashboard request = new CreateDashboard();
      request.setName(ns.prefix("dashboard_list_" + i));
      request.setService(service.getFullyQualifiedName());
      createEntity(request);
    }

    // List dashboards by service
    ListParams params = new ListParams();
    params.setLimit(100);
    params.setService(service.getFullyQualifiedName());

    ListResponse<Dashboard> response = listEntities(params);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 5);

    // Verify all returned dashboards belong to the service
    for (Dashboard dashboard : response.getData()) {
      assertEquals(service.getFullyQualifiedName(), dashboard.getService().getFullyQualifiedName());
    }
  }

  @Test
  void test_dashboardVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_versions"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Version 1");

    Dashboard dashboard = createEntity(request);
    Double v1 = dashboard.getVersion();

    // Update description
    dashboard.setDescription("Version 2");
    Dashboard v2Dashboard = patchEntity(dashboard.getId().toString(), dashboard);
    assertTrue(v2Dashboard.getVersion() > v1);

    // Get version history
    EntityHistory history = client.dashboards().getVersionList(dashboard.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_dashboardWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setOwners(List.of(testUser1().getEntityReference()));

    Dashboard dashboard = createEntity(request);
    assertNotNull(dashboard);

    // Verify owner
    Dashboard fetched = client.dashboards().get(dashboard.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
    assertTrue(fetched.getOwners().stream().anyMatch(o -> o.getId().equals(testUser1().getId())));
  }

  @Test
  void test_dashboardSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create dashboard
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_delete_restore"));
    request.setService(service.getFullyQualifiedName());

    Dashboard dashboard = createEntity(request);
    String dashboardId = dashboard.getId().toString();

    // Soft delete
    deleteEntity(dashboardId);

    // Verify deleted
    assertThrows(
        Exception.class,
        () -> getEntity(dashboardId),
        "Deleted dashboard should not be retrievable");

    // Get with include=deleted
    Dashboard deleted = getEntityIncludeDeleted(dashboardId);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(dashboardId);

    // Verify restored
    Dashboard restored = getEntity(dashboardId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_dashboardHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create dashboard
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_hard_delete"));
    request.setService(service.getFullyQualifiedName());

    Dashboard dashboard = createEntity(request);
    String dashboardId = dashboard.getId().toString();

    // Hard delete
    hardDeleteEntity(dashboardId);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(dashboardId),
        "Hard deleted dashboard should not be retrievable");
  }

  @Test
  void test_chartWithMultipleDashboards(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create a shared chart
    CreateChart chartRequest = new CreateChart();
    chartRequest.setName(ns.prefix("shared_chart"));
    chartRequest.setService(service.getFullyQualifiedName());
    chartRequest.setChartType(ChartType.Pie);
    Chart sharedChart = client.charts().create(chartRequest);

    // Create two dashboards that share the chart
    CreateDashboard request1 = new CreateDashboard();
    request1.setName(ns.prefix("dashboard_shared_chart_1"));
    request1.setService(service.getFullyQualifiedName());
    request1.setCharts(List.of(sharedChart.getFullyQualifiedName()));
    Dashboard dashboard1 = createEntity(request1);

    CreateDashboard request2 = new CreateDashboard();
    request2.setName(ns.prefix("dashboard_shared_chart_2"));
    request2.setService(service.getFullyQualifiedName());
    request2.setCharts(List.of(sharedChart.getFullyQualifiedName()));
    Dashboard dashboard2 = createEntity(request2);

    // Verify both dashboards have the chart
    Dashboard fetched1 = client.dashboards().get(dashboard1.getId().toString(), "charts");
    Dashboard fetched2 = client.dashboards().get(dashboard2.getId().toString(), "charts");

    assertEquals(1, fetched1.getCharts().size());
    assertEquals(1, fetched2.getCharts().size());
    assertEquals(sharedChart.getId(), fetched1.getCharts().get(0).getId());
    assertEquals(sharedChart.getId(), fetched2.getCharts().get(0).getId());

    // Delete dashboard1 and verify chart still exists
    deleteEntity(dashboard1.getId().toString());

    // Chart should still be accessible
    Chart chartAfterDelete = client.charts().get(sharedChart.getId().toString());
    assertNotNull(chartAfterDelete);

    // Dashboard2 should still have the chart
    Dashboard fetched2After = client.dashboards().get(dashboard2.getId().toString(), "charts");
    assertEquals(1, fetched2After.getCharts().size());
  }

  @Test
  void test_listDashboardsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create multiple dashboards
    for (int i = 0; i < 3; i++) {
      CreateDashboard request = new CreateDashboard();
      request.setName(ns.prefix("dashboard_list_" + i));
      request.setService(service.getFullyQualifiedName());
      createEntity(request);
    }

    // List dashboards
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Dashboard> response = listEntities(params);
    assertNotNull(response);

    // Verify we have at least our 3 dashboards
    long serviceCount =
        response.getData().stream()
            .filter(
                d -> d.getService().getFullyQualifiedName().equals(service.getFullyQualifiedName()))
            .count();
    assertTrue(serviceCount >= 3);
  }

  @Test
  void test_dashboardGetByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_by_name"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Dashboard for getByName test");

    Dashboard dashboard = createEntity(request);

    // Get by FQN
    Dashboard fetched = getEntityByName(dashboard.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(dashboard.getId(), fetched.getId());
    assertEquals(dashboard.getName(), fetched.getName());
  }

  @Test
  void test_dashboardFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    String dashboardName = ns.prefix("dashboard_fqn");
    request.setName(dashboardName);
    request.setService(service.getFullyQualifiedName());

    Dashboard dashboard = createEntity(request);

    // Verify FQN format: service.dashboard
    String expectedFQN = service.getFullyQualifiedName() + "." + dashboardName;
    assertEquals(expectedFQN, dashboard.getFullyQualifiedName());
  }

  @Test
  void test_dashboardDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_display"));
    request.setService(service.getFullyQualifiedName());
    request.setDisplayName("My Display Dashboard");

    Dashboard dashboard = createEntity(request);
    assertEquals("My Display Dashboard", dashboard.getDisplayName());

    // Update display name
    dashboard.setDisplayName("Updated Display Name");
    Dashboard updated = patchEntity(dashboard.getId().toString(), dashboard);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }
}
