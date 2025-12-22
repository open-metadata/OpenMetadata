package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.EntityHistory;
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
  protected CreateChart createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setDescription("Test chart created by integration test");

    return request;
  }

  @Override
  protected CreateChart createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateChart request = new CreateChart();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    return request;
  }

  @Override
  protected Chart createEntity(CreateChart createRequest, OpenMetadataClient client) {
    return client.charts().create(createRequest);
  }

  @Override
  protected Chart getEntity(String id, OpenMetadataClient client) {
    return client.charts().get(id);
  }

  @Override
  protected Chart getEntityByName(String fqn, OpenMetadataClient client) {
    return client.charts().getByName(fqn);
  }

  @Override
  protected Chart patchEntity(String id, Chart entity, OpenMetadataClient client) {
    return client.charts().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.charts().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.charts().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.charts().delete(id, params);
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
  protected ListResponse<Chart> listEntities(ListParams params, OpenMetadataClient client) {
    return client.charts().list(params);
  }

  @Override
  protected Chart getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.charts().get(id, fields);
  }

  @Override
  protected Chart getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.charts().getByName(fqn, fields);
  }

  @Override
  protected Chart getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.charts().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.charts().getVersionList(id);
  }

  @Override
  protected Chart getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.charts().getVersion(id.toString(), version);
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
        Exception.class,
        () -> createEntity(request, client),
        "Creating chart without service should fail");
  }

  @Test
  void post_chartWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

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

      Chart chart = createEntity(request, client);
      assertNotNull(chart);
      assertEquals(chartType, chart.getChartType());
    }
  }

  @Test
  void post_chartWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);
    request.setSourceUrl("http://localhost:3000/charts/1");

    Chart chart = createEntity(request, client);
    assertNotNull(chart);
    assertEquals("http://localhost:3000/charts/1", chart.getSourceUrl());
  }

  @Test
  void put_chartAttributes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    // Create chart with initial values
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_update"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request, client);
    assertNotNull(chart);

    // Update attributes
    chart.setChartType(ChartType.Line);
    chart.setSourceUrl("http://localhost:3000/charts/updated");
    chart.setDescription("Updated description");

    Chart updated = patchEntity(chart.getId().toString(), chart, client);
    assertNotNull(updated);
    assertEquals(ChartType.Line, updated.getChartType());
    assertEquals("http://localhost:3000/charts/updated", updated.getSourceUrl());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void patch_chartType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_patch_type"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request, client);
    assertEquals(ChartType.Bar, chart.getChartType());

    // Patch to change chart type
    chart.setChartType(ChartType.Pie);
    Chart patched = patchEntity(chart.getId().toString(), chart, client);
    assertEquals(ChartType.Pie, patched.getChartType());
  }

  @Test
  void test_chartInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a dashboard service
    DashboardService service = DashboardServiceTestFactory.createMetabase(client, ns);

    // Create a chart under the service
    CreateChart request = new CreateChart();
    request.setName(ns.prefix("chart_inherit_domain"));
    request.setService(service.getFullyQualifiedName());
    request.setChartType(ChartType.Bar);

    Chart chart = createEntity(request, client);
    assertNotNull(chart);
    assertNotNull(chart.getService());
    assertEquals(service.getFullyQualifiedName(), chart.getService().getFullyQualifiedName());
  }
}
