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
  protected CreateDashboard createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test dashboard created by integration test");

    return request;
  }

  @Override
  protected CreateDashboard createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());

    return request;
  }

  @Override
  protected Dashboard createEntity(CreateDashboard createRequest, OpenMetadataClient client) {
    return client.dashboards().create(createRequest);
  }

  @Override
  protected Dashboard getEntity(String id, OpenMetadataClient client) {
    return client.dashboards().get(id);
  }

  @Override
  protected Dashboard getEntityByName(String fqn, OpenMetadataClient client) {
    return client.dashboards().getByName(fqn);
  }

  @Override
  protected Dashboard patchEntity(String id, Dashboard entity, OpenMetadataClient client) {
    return client.dashboards().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.dashboards().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.dashboards().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.dashboards().delete(id, params);
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
  protected ListResponse<Dashboard> listEntities(ListParams params, OpenMetadataClient client) {
    return client.dashboards().list(params);
  }

  @Override
  protected Dashboard getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.dashboards().get(id, fields);
  }

  @Override
  protected Dashboard getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.dashboards().getByName(fqn, fields);
  }

  @Override
  protected Dashboard getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.dashboards().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.dashboards().getVersionList(id);
  }

  @Override
  protected Dashboard getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.dashboards().getVersion(id.toString(), version);
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
        () -> createEntity(request, client),
        "Creating dashboard without service should fail");
  }

  @Test
  void post_dashboardWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    DashboardType[] dashboardTypes = {DashboardType.Dashboard, DashboardType.Report};

    for (DashboardType dashboardType : dashboardTypes) {
      CreateDashboard request = new CreateDashboard();
      request.setName(ns.prefix("dashboard_" + dashboardType.toString().toLowerCase()));
      request.setService(service.getFullyQualifiedName());
      request.setDashboardType(dashboardType);

      Dashboard dashboard = createEntity(request, client);
      assertNotNull(dashboard);
      assertEquals(dashboardType, dashboard.getDashboardType());
    }
  }

  @Test
  void post_dashboardWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:3000/dashboards/1");

    Dashboard dashboard = createEntity(request, client);
    assertNotNull(dashboard);
    assertEquals("http://localhost:3000/dashboards/1", dashboard.getSourceUrl());
  }

  @Test
  void post_dashboardWithCharts_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

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

    Dashboard dashboard = createEntity(request, client);
    assertNotNull(dashboard);

    // Fetch with charts field
    Dashboard fetched = client.dashboards().get(dashboard.getId().toString(), "charts");
    assertNotNull(fetched.getCharts());
    assertEquals(2, fetched.getCharts().size());
  }

  @Test
  void put_dashboardAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    // Create dashboard with initial values
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_update"));
    request.setService(service.getFullyQualifiedName());
    request.setDashboardType(DashboardType.Dashboard);

    Dashboard dashboard = createEntity(request, client);
    assertNotNull(dashboard);

    // Update attributes
    dashboard.setSourceUrl("http://localhost:3000/dashboards/updated");
    dashboard.setDescription("Updated description");

    Dashboard updated = patchEntity(dashboard.getId().toString(), dashboard, client);
    assertNotNull(updated);
    assertEquals("http://localhost:3000/dashboards/updated", updated.getSourceUrl());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dashboardInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a dashboard service
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    // Create a dashboard under the service
    CreateDashboard request = new CreateDashboard();
    request.setName(ns.prefix("dashboard_inherit_domain"));
    request.setService(service.getFullyQualifiedName());

    Dashboard dashboard = createEntity(request, client);
    assertNotNull(dashboard);
    assertNotNull(dashboard.getService());
    assertEquals(service.getFullyQualifiedName(), dashboard.getService().getFullyQualifiedName());
  }
}
