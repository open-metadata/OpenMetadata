package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.type.api.BulkOperationResult;
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

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

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

  @Test
  void update_chartTypeAndUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart with initial values
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_update_type_url"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setDescription("Initial description");

    Chart chart = createEntity(request);
    assertEquals(ChartType.Bar, chart.getChartType());
    assertNull(chart.getSourceUrl());

    // Update chart type and add source URL
    chart.setChartType(ChartType.Line);
    chart.setSourceUrl("http://localhost:3000/charts/updated");
    chart.setDescription("Updated description");

    Chart updated = patchEntity(chart.getId().toString(), chart);
    assertEquals(ChartType.Line, updated.getChartType());
    assertEquals("http://localhost:3000/charts/updated", updated.getSourceUrl());
    assertEquals("Updated description", updated.getDescription());

    // Update again to verify multiple updates
    updated.setChartType(ChartType.Pie);
    updated.setSourceUrl("http://localhost:3000/charts/final");

    Chart finalUpdate = patchEntity(updated.getId().toString(), updated);
    assertEquals(ChartType.Pie, finalUpdate.getChartType());
    assertEquals("http://localhost:3000/charts/final", finalUpdate.getSourceUrl());
  }

  @Test
  void patch_chartMultipleFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart with minimal fields
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_patch_multiple"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request);
    assertNull(chart.getSourceUrl());
    assertNull(chart.getDescription());

    // Patch to add multiple fields
    chart.setChartType(ChartType.Line);
    chart.setSourceUrl("http://localhost:3000/charts/1");
    chart.setDescription("Added description");

    Chart patched = patchEntity(chart.getId().toString(), chart);
    assertEquals(ChartType.Line, patched.getChartType());
    assertEquals("http://localhost:3000/charts/1", patched.getSourceUrl());
    assertEquals("Added description", patched.getDescription());

    // Patch again to modify all fields
    patched.setChartType(ChartType.Area);
    patched.setSourceUrl("http://localhost:3000/charts/2");
    patched.setDescription("Modified description");

    Chart secondPatch = patchEntity(patched.getId().toString(), patched);
    assertEquals(ChartType.Area, secondPatch.getChartType());
    assertEquals("http://localhost:3000/charts/2", secondPatch.getSourceUrl());
    assertEquals("Modified description", secondPatch.getDescription());
  }

  @Test
  void test_chartGetByFqn(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_get_by_fqn"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request);
    assertNotNull(chart.getFullyQualifiedName());

    // Get by FQN
    Chart fetched = getEntityByName(chart.getFullyQualifiedName());
    assertEquals(chart.getId(), fetched.getId());
    assertEquals(chart.getName(), fetched.getName());
    assertEquals(chart.getChartType(), fetched.getChartType());
  }

  @Test
  void test_chartFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    String chartName = ns.prefix("chart_fqn_format");
    CreateChart request = new CreateChart();
    request.setName(chartName);
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request);

    // Verify FQN format: service.chart
    String expectedFQN = service.getFullyQualifiedName() + "." + chartName;
    assertEquals(expectedFQN, chart.getFullyQualifiedName());
  }

  @Test
  void test_chartDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_display_name"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setDisplayName("My Display Chart");

    Chart chart = createEntity(request);
    assertEquals("My Display Chart", chart.getDisplayName());

    // Update display name
    chart.setDisplayName("Updated Display Name");
    Chart updated = patchEntity(chart.getId().toString(), chart);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_chartWithMultipleDashboards(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create multiple dashboards
    CreateDashboard dashboardRequest1 = new CreateDashboard();
    dashboardRequest1.setName(ns.prefix("dashboard1"));
    dashboardRequest1.setService(service.getFullyQualifiedName());
    Dashboard dashboard1 = client.dashboards().create(dashboardRequest1);

    CreateDashboard dashboardRequest2 = new CreateDashboard();
    dashboardRequest2.setName(ns.prefix("dashboard2"));
    dashboardRequest2.setService(service.getFullyQualifiedName());
    Dashboard dashboard2 = client.dashboards().create(dashboardRequest2);

    CreateDashboard dashboardRequest3 = new CreateDashboard();
    dashboardRequest3.setName(ns.prefix("dashboard3"));
    dashboardRequest3.setService(service.getFullyQualifiedName());
    Dashboard dashboard3 = client.dashboards().create(dashboardRequest3);

    // Create chart with multiple dashboards
    CreateChart chartRequest = new CreateChart();
    chartRequest.setName(ns.prefix("chart_multi_dashboards"));
    chartRequest.setService(service.getFullyQualifiedName());
    chartRequest.setChartType(ChartType.Bar);
    chartRequest.setDashboards(
        List.of(
            dashboard1.getFullyQualifiedName(),
            dashboard2.getFullyQualifiedName(),
            dashboard3.getFullyQualifiedName()));

    Chart chart = createEntity(chartRequest);

    // Verify chart has all dashboards
    Chart chartWithDashboards = client.charts().get(chart.getId().toString(), "dashboards");
    assertNotNull(chartWithDashboards.getDashboards());
    assertEquals(3, chartWithDashboards.getDashboards().size());

    // Verify each dashboard contains the chart
    for (EntityReference dashboardRef : chartWithDashboards.getDashboards()) {
      Dashboard dashboard = client.dashboards().get(dashboardRef.getId().toString(), "charts");
      assertNotNull(dashboard.getCharts());
      assertTrue(
          dashboard.getCharts().stream()
              .map(EntityReference::getId)
              .anyMatch(chart.getId()::equals));
    }

    // Update dashboards via PATCH - replace with new dashboard
    CreateDashboard dashboardRequest4 = new CreateDashboard();
    dashboardRequest4.setName(ns.prefix("dashboard4"));
    dashboardRequest4.setService(service.getFullyQualifiedName());
    Dashboard dashboard4 = client.dashboards().create(dashboardRequest4);

    chartWithDashboards.setDashboards(List.of(dashboard4.getEntityReference()));
    Chart updated = patchEntity(chart.getId().toString(), chartWithDashboards);

    // Verify dashboards were replaced
    Chart verifyChart = client.charts().get(updated.getId().toString(), "dashboards");
    assertNotNull(verifyChart.getDashboards());
    assertEquals(1, verifyChart.getDashboards().size());
    assertEquals(dashboard4.getId(), verifyChart.getDashboards().get(0).getId());

    // Verify new dashboard contains the chart
    Dashboard verifyDashboard4 = client.dashboards().get(dashboard4.getId().toString(), "charts");
    assertTrue(
        verifyDashboard4.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals));
  }

  @Test
  void test_deleteChartVerifyDashboardsUpdated(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create dashboard
    CreateDashboard dashboardRequest = new CreateDashboard();
    dashboardRequest.setName(ns.prefix("dashboard_for_deletion"));
    dashboardRequest.setService(service.getFullyQualifiedName());
    Dashboard dashboard = client.dashboards().create(dashboardRequest);

    // Create chart with dashboard
    CreateChart chartRequest = new CreateChart();
    chartRequest.setName(ns.prefix("chart_to_delete"));
    chartRequest.setService(service.getFullyQualifiedName());
    chartRequest.setChartType(ChartType.Bar);
    chartRequest.setDashboards(List.of(dashboard.getFullyQualifiedName()));

    Chart chart = createEntity(chartRequest);

    // Verify dashboard contains chart
    Dashboard dashboardWithCharts = client.dashboards().get(dashboard.getId().toString(), "charts");
    assertTrue(
        dashboardWithCharts.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals));

    // Delete chart
    deleteEntity(chart.getId().toString());

    // Verify dashboard no longer shows the deleted chart (default behavior filters deleted
    // entities)
    Dashboard afterDelete = client.dashboards().get(dashboard.getId().toString(), "charts");
    assertFalse(
        afterDelete.getCharts().stream()
            .map(EntityReference::getId)
            .anyMatch(chart.getId()::equals),
        "Deleted charts should not appear in dashboard.charts by default");
  }

  @Test
  void test_chartWithAllChartTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    ChartType[] allChartTypes =
        new ChartType[] {
          ChartType.Area,
          ChartType.Bar,
          ChartType.Line,
          ChartType.Pie,
          ChartType.Scatter,
          ChartType.Table,
          ChartType.Text,
          ChartType.BoxPlot,
          ChartType.Histogram,
          ChartType.Other
        };

    for (ChartType chartType : allChartTypes) {
      CreateChart request = new CreateChart();
      request.setName(ns.prefix("chart_type_" + chartType.value()));
      request.setService(service.getFullyQualifiedName());
      request.setChartType(chartType);

      Chart chart = createEntity(request);
      assertEquals(chartType, chart.getChartType());
    }
  }

  @Test
  void test_chartServiceTypeInheritance(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService metabaseService = DashboardServiceTestFactory.createMetabase(ns);
    DashboardService lookerService = DashboardServiceTestFactory.createLooker(ns);

    // Create chart under Metabase
    CreateChart metabaseChart = new CreateChart();
    metabaseChart.setName(ns.prefix("chart_metabase_type"));
    metabaseChart.setService(metabaseService.getFullyQualifiedName());
    metabaseChart.setChartType(ChartType.Bar);
    Chart chart1 = createEntity(metabaseChart);
    assertNotNull(chart1.getServiceType());

    // Create chart under Looker
    CreateChart lookerChart = new CreateChart();
    lookerChart.setName(ns.prefix("chart_looker_type"));
    lookerChart.setService(lookerService.getFullyQualifiedName());
    lookerChart.setChartType(ChartType.Line);
    Chart chart2 = createEntity(lookerChart);
    assertNotNull(chart2.getServiceType());

    // Verify service types are different
    assertNotEquals(chart1.getServiceType(), chart2.getServiceType());
  }

  @Test
  void test_filterChartsByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService metabaseService = DashboardServiceTestFactory.createMetabase(ns);
    DashboardService lookerService = DashboardServiceTestFactory.createLooker(ns);

    // Create charts under different services
    for (int i = 0; i < 3; i++) {
      CreateChart metabaseChart = new CreateChart();
      metabaseChart.setName(ns.prefix("metabase_chart_" + i));
      metabaseChart.setService(metabaseService.getFullyQualifiedName());
      metabaseChart.setChartType(ChartType.Bar);
      createEntity(metabaseChart);

      CreateChart lookerChart = new CreateChart();
      lookerChart.setName(ns.prefix("looker_chart_" + i));
      lookerChart.setService(lookerService.getFullyQualifiedName());
      lookerChart.setChartType(ChartType.Line);
      createEntity(lookerChart);
    }

    // List charts filtered by Metabase service
    ListParams metabaseParams = new ListParams();
    metabaseParams.setLimit(100);
    metabaseParams.addFilter("service", metabaseService.getFullyQualifiedName());
    ListResponse<Chart> metabaseCharts = listEntities(metabaseParams);

    assertTrue(metabaseCharts.getData().size() >= 3);
    for (Chart chart : metabaseCharts.getData()) {
      assertEquals(
          metabaseService.getFullyQualifiedName(), chart.getService().getFullyQualifiedName());
    }

    // List charts filtered by Looker service
    ListParams lookerParams = new ListParams();
    lookerParams.setLimit(100);
    lookerParams.addFilter("service", lookerService.getFullyQualifiedName());
    ListResponse<Chart> lookerCharts = listEntities(lookerParams);

    assertTrue(lookerCharts.getData().size() >= 3);
    for (Chart chart : lookerCharts.getData()) {
      assertEquals(
          lookerService.getFullyQualifiedName(), chart.getService().getFullyQualifiedName());
    }
  }

  @Test
  void validateGetWithDifferentFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    // Create chart with all optional fields
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setDescription("Chart for field validation");
    request.setOwners(List.of(testUser1().getEntityReference()));

    Chart chart = createEntity(request);

    // Get with no fields - should have service and serviceType, but not owners/followers
    Chart minimal = getEntity(chart.getId().toString());
    assertNotNull(minimal.getService());
    assertNotNull(minimal.getServiceType());
    assertTrue(minimal.getOwners() == null || minimal.getOwners().isEmpty());
    assertTrue(minimal.getFollowers() == null || minimal.getFollowers().isEmpty());

    // Get with owners,followers fields
    Chart withFields = getEntityWithFields(chart.getId().toString(), "owners,followers");
    assertNotNull(withFields.getService());
    assertNotNull(withFields.getServiceType());
    assertNotNull(withFields.getOwners());

    // Get by name with fields
    Chart byNameWithFields =
        getEntityByNameWithFields(chart.getFullyQualifiedName(), "owners,dashboards");
    assertNotNull(byNameWithFields.getService());
    assertNotNull(byNameWithFields.getOwners());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateChart> createRequests) {
    return SdkClients.adminClient().charts().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateChart> createRequests) {
    return SdkClients.adminClient().charts().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateChart createInvalidRequestForBulk(TestNamespace ns) {
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("invalid_chart"));
    return request;
  }

  @Test
  void test_bulkListChartsFromDifferentServices_maintainsCorrectServiceReference(TestNamespace ns) {
    // Regression test for bug where bulk loading charts incorrectly set all charts
    // to the first chart's service. This was caused by ChartRepository.fetchAndSetServices()
    // assuming all charts in a batch belong to the same service.

    // Create two different dashboard services
    DashboardService metabaseService = DashboardServiceTestFactory.createMetabase(ns);
    DashboardService lookerService = DashboardServiceTestFactory.createLooker(ns);

    // Create charts under different services
    CreateChart metabaseChartRequest = new CreateChart();
    metabaseChartRequest.setName(ns.prefix("bulk_test_metabase_chart"));
    metabaseChartRequest.setService(metabaseService.getFullyQualifiedName());
    metabaseChartRequest.setChartType(ChartType.Bar);

    CreateChart lookerChartRequest = new CreateChart();
    lookerChartRequest.setName(ns.prefix("bulk_test_looker_chart"));
    lookerChartRequest.setService(lookerService.getFullyQualifiedName());
    lookerChartRequest.setChartType(ChartType.Line);

    Chart metabaseChart = createEntity(metabaseChartRequest);
    Chart lookerChart = createEntity(lookerChartRequest);

    // Verify initial service assignments
    assertEquals(
        metabaseService.getFullyQualifiedName(),
        metabaseChart.getService().getFullyQualifiedName());
    assertEquals(
        lookerService.getFullyQualifiedName(), lookerChart.getService().getFullyQualifiedName());

    // List all charts (this uses bulk loading internally via setFieldsInBulk)
    ListParams params = new ListParams();
    params.setLimit(1000);
    params.setFields("service");
    ListResponse<Chart> allCharts = listEntities(params);

    // Find our test charts in the bulk-loaded list
    Chart foundMetabaseChart =
        allCharts.getData().stream()
            .filter(c -> c.getName().equals(metabaseChartRequest.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Metabase chart not found in list"));

    Chart foundLookerChart =
        allCharts.getData().stream()
            .filter(c -> c.getName().equals(lookerChartRequest.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Looker chart not found in list"));

    // This assertion would fail before the fix - all charts got the first chart's service
    assertEquals(
        metabaseService.getFullyQualifiedName(),
        foundMetabaseChart.getService().getFullyQualifiedName(),
        "Chart created under Metabase should retain Metabase as its service after bulk list");

    assertEquals(
        lookerService.getFullyQualifiedName(),
        foundLookerChart.getService().getFullyQualifiedName(),
        "Chart created under Looker should retain Looker as its service after bulk list");
  }
}
