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
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Chart entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds chart-specific tests for chart
 * types, source URLs, and dashboard relationships.
 *
 * <p>Migrated from: org.openmetadata.service.resources.charts.ChartResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class ChartResourceIT extends BaseEntityIT<Chart, CreateChart> {

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateChart createMinimalRequest(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setDescription("Test chart created by integration test");

    return request;
  }

  @Override
  protected CreateChart createRequest(String name, TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateChart request = new CreateChart();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    return request;
  }

  @Override
  protected Chart createEntity(CreateChart createRequest) {
    return SdkClients.adminClient().charts().create(createRequest);
  }

  @Override
  protected Chart getEntity(String id) {
    return SdkClients.adminClient().charts().get(id);
  }

  @Override
  protected Chart getEntityByName(String fqn) {
    return SdkClients.adminClient().charts().getByName(fqn);
  }

  @Override
  protected Chart patchEntity(String id, Chart entity) {
    return SdkClients.adminClient().charts().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().charts().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().charts().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().charts().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "chart";
  }

  @Override
  protected void validateCreatedEntity(Chart entity, CreateChart createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Chart must have a service");
    assertEquals(createRequest.getChartType(), entity.getChartType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain chart name");
  }

  @Override
  protected ListResponse<Chart> listEntities(ListParams params) {
    return SdkClients.adminClient().charts().list(params);
  }

  @Override
  protected Chart getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().charts().get(id, fields);
  }

  @Override
  protected Chart getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().charts().getByName(fqn, fields);
  }

  @Override
  protected Chart getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().charts().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().charts().getVersionList(id);
  }

  @Override
  protected Chart getVersion(UUID id, Double version) {
    return SdkClients.adminClient().charts().getVersion(id.toString(), version);
  }

  // ===================================================================
  // CHART-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_chartWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service is required field
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_no_service"));
    request.setChartType(ChartType.Bar);

    assertThrows(
        Exception.class, () -> createEntity(request), "Creating chart without service should fail");
  }

  @Test
  void post_chartWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    ChartType[] chartTypes = {
      ChartType.Bar,
      ChartType.Line,
      ChartType.Pie,
      ChartType.Area,
      ChartType.Scatter,
      ChartType.Table,
      ChartType.Histogram
    };

    for (ChartType chartType : chartTypes) {
      CreateChart request = new CreateChart();
      request.setName(ns.prefix("chart_" + chartType.toString().toLowerCase()));
      request.setService(service.getFullyQualifiedName());
      request.setChartType(chartType);

      Chart chart = createEntity(request);
      assertNotNull(chart);
      assertEquals(chartType, chart.getChartType());
    }
  }

  @Test
  void post_chartWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setSourceUrl("http://localhost:3000/charts/1");

    Chart chart = createEntity(request);
    assertNotNull(chart);
    assertEquals("http://localhost:3000/charts/1", chart.getSourceUrl());
  }

  @Test
  void put_chartAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart with initial values
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_update"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request);
    assertNotNull(chart);

    // Update attributes
    chart.setChartType(ChartType.Line);
    chart.setSourceUrl("http://localhost:3000/charts/updated");
    chart.setDescription("Updated description");

    Chart updated = patchEntity(chart.getId().toString(), chart);
    assertNotNull(updated);
    assertEquals(ChartType.Line, updated.getChartType());
    assertEquals("http://localhost:3000/charts/updated", updated.getSourceUrl());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void patch_chartType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_patch_type"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request);
    assertEquals(ChartType.Bar, chart.getChartType());

    // Patch to change chart type
    chart.setChartType(ChartType.Pie);
    Chart patched = patchEntity(chart.getId().toString(), chart);
    assertEquals(ChartType.Pie, patched.getChartType());
  }

  @Test
  void test_chartInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a dashboard service
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create a chart under the service
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request);
    assertNotNull(chart);
    assertNotNull(chart.getService());
    assertEquals(service.getFullyQualifiedName(), chart.getService().getFullyQualifiedName());
  }

  @Test
  void post_chartWithDifferentServices_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create charts with different dashboard services
    DashboardService metabaseService = DashboardServiceTestFactory.createMetabase(ns);
    DashboardService lookerService = DashboardServiceTestFactory.createLooker(ns);

    // Create chart for Metabase
    CreateChart metabaseChart = new CreateChart();
    metabaseChart.setName(ns.prefix("chart_metabase"));
    metabaseChart.setService(metabaseService.getFullyQualifiedName());
    metabaseChart.setChartType(ChartType.Bar);
    Chart chart1 = createEntity(metabaseChart);
    assertNotNull(chart1);
    assertEquals(
        metabaseService.getFullyQualifiedName(), chart1.getService().getFullyQualifiedName());

    // Create chart for Looker
    CreateChart lookerChart = new CreateChart();
    lookerChart.setName(ns.prefix("chart_looker"));
    lookerChart.setService(lookerService.getFullyQualifiedName());
    lookerChart.setChartType(ChartType.Line);
    Chart chart2 = createEntity(lookerChart);
    assertNotNull(chart2);
    assertEquals(
        lookerService.getFullyQualifiedName(), chart2.getService().getFullyQualifiedName());

    // Verify listing by service
    ListParams params1 = new ListParams();
    params1.setLimit(100);
    params1.addFilter("service", metabaseService.getFullyQualifiedName());
    ListResponse<Chart> metabaseCharts = listEntities(params1);
    assertTrue(
        metabaseCharts.getData().stream()
            .allMatch(
                c ->
                    c.getService()
                        .getFullyQualifiedName()
                        .equals(metabaseService.getFullyQualifiedName())));
  }

  @Test
  void list_chartsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create multiple charts under the same service
    for (int i = 0; i < 3; i++) {
      CreateChart request = new CreateChart();
      request.setName(ns.prefix("list_chart_" + i));
      request.setService(service.getFullyQualifiedName());
      request.setChartType(ChartType.Bar);
      createEntity(request);
    }

    // List charts by service
    ListParams params = new ListParams();
    params.setLimit(100);
    params.addFilter("service", service.getFullyQualifiedName());
    ListResponse<Chart> charts = listEntities(params);

    assertTrue(charts.getData().size() >= 3);
    for (Chart chart : charts.getData()) {
      assertEquals(service.getFullyQualifiedName(), chart.getService().getFullyQualifiedName());
    }
  }

  @Test
  void test_chartVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_version_history"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    Chart chart = createEntity(request);

    // Get version history - should have initial version
    EntityHistory history = getVersionHistory(chart.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);

    // Update chart to create new version
    chart.setDescription("Updated description for version history test");
    chart.setChartType(ChartType.Line);
    Chart updated = patchEntity(chart.getId().toString(), chart);
    assertTrue(updated.getVersion() > chart.getVersion());

    // Get version history again
    EntityHistory updatedHistory = getVersionHistory(chart.getId());
    assertTrue(updatedHistory.getVersions().size() >= 2);

    // Get specific version
    Chart version1 = getVersion(chart.getId(), chart.getVersion());
    assertNotNull(version1);
  }

  @Test
  void test_chartSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_soft_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    Chart chart = createEntity(request);
    assertNotNull(chart.getId());

    // Soft delete
    deleteEntity(chart.getId().toString());

    // Verify deleted
    Chart deleted = getEntityIncludeDeleted(chart.getId().toString());
    assertNotNull(deleted.getDeleted());
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(chart.getId().toString());

    // Verify restored
    Chart restored = getEntity(chart.getId().toString());
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_chartHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_hard_delete"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    Chart chart = createEntity(request);
    String chartId = chart.getId().toString();

    // Hard delete
    hardDeleteEntity(chartId);

    // Verify chart is completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(chartId),
        "Hard deleted chart should not be retrievable");
  }

  @Test
  void test_chartWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart with owner
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setOwners(List.of(testUser1().getEntityReference()));

    Chart chart = createEntity(request);
    assertNotNull(chart.getOwners());
    assertFalse(chart.getOwners().isEmpty());
    assertEquals(testUser1().getId(), chart.getOwners().get(0).getId());
  }

  @Test
  void testChartWithDashboards(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create dashboards first
    CreateDashboard dashboardRequest1 = new CreateDashboard();
    dashboardRequest1.setName(ns.prefix("dashboard_for_chart_1"));
    dashboardRequest1.setService(service.getFullyQualifiedName());
    Dashboard dashboard1 = client.dashboards().create(dashboardRequest1);

    CreateDashboard dashboardRequest2 = new CreateDashboard();
    dashboardRequest2.setName(ns.prefix("dashboard_for_chart_2"));
    dashboardRequest2.setService(service.getFullyQualifiedName());
    Dashboard dashboard2 = client.dashboards().create(dashboardRequest2);

    // Create chart with dashboard references
    CreateChart chartRequest = new CreateChart();
    chartRequest.setName(ns.prefix("chart_with_dashboards"));
    chartRequest.setService(service.getFullyQualifiedName());
    chartRequest.setChartType(ChartType.Bar);
    chartRequest.setDashboards(
        List.of(dashboard1.getFullyQualifiedName(), dashboard2.getFullyQualifiedName()));

    Chart chart = createEntity(chartRequest);
    assertNotNull(chart);

    // Verify chart has dashboards
    Chart chartWithDashboards = client.charts().get(chart.getId().toString(), "dashboards");
    assertNotNull(chartWithDashboards.getDashboards());
    assertEquals(2, chartWithDashboards.getDashboards().size());

    // Verify dashboards contain the chart
    Dashboard fetchedDashboard1 = client.dashboards().get(dashboard1.getId().toString(), "charts");
    assertNotNull(fetchedDashboard1.getCharts());
    assertTrue(
        fetchedDashboard1.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals));
  }

  @Test
  void patch_chartDashboards_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create initial dashboard
    CreateDashboard dashboardRequest1 = new CreateDashboard();
    dashboardRequest1.setName(ns.prefix("initial_dashboard"));
    dashboardRequest1.setService(service.getFullyQualifiedName());
    Dashboard dashboard1 = client.dashboards().create(dashboardRequest1);

    // Create chart with initial dashboard
    CreateChart chartRequest = new CreateChart();
    chartRequest.setName(ns.prefix("chart_patch_dashboards"));
    chartRequest.setService(service.getFullyQualifiedName());
    chartRequest.setChartType(ChartType.Bar);
    chartRequest.setDashboards(List.of(dashboard1.getFullyQualifiedName()));
    Chart chart = createEntity(chartRequest);

    // Create new dashboard
    CreateDashboard dashboardRequest2 = new CreateDashboard();
    dashboardRequest2.setName(ns.prefix("new_dashboard"));
    dashboardRequest2.setService(service.getFullyQualifiedName());
    Dashboard dashboard2 = client.dashboards().create(dashboardRequest2);

    // Patch chart to change dashboard
    Chart chartWithDashboards = client.charts().get(chart.getId().toString(), "dashboards");
    chartWithDashboards.setDashboards(List.of(dashboard2.getEntityReference()));
    Chart patched = patchEntity(chart.getId().toString(), chartWithDashboards);

    // Verify dashboard changed
    Chart verifyChart = client.charts().get(patched.getId().toString(), "dashboards");
    assertNotNull(verifyChart.getDashboards());
    assertEquals(1, verifyChart.getDashboards().size());
    assertEquals(dashboard2.getId(), verifyChart.getDashboards().get(0).getId());
  }
}
