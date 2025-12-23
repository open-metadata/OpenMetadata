package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.datainsight.DataInsightChartService;

/**
 * Integration tests for DataInsightChart entity operations.
 *
 * <p>Tests data insight chart CRUD operations, field-based queries, and listing.
 *
 * <p>Migrated from: org.openmetadata.service.resources.datainsight.DataInsightChartResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DataInsightChartResourceIT
    extends BaseEntityIT<DataInsightChart, CreateDataInsightChart> {

  public DataInsightChartResourceIT() {
    supportsPatch = false;
    supportsFollowers = false;
    supportsTags = false;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsDomains = false;
  }

  @Override
  protected CreateDataInsightChart createMinimalRequest(TestNamespace ns) {
    return new CreateDataInsightChart()
        .withName(ns.prefix("data_insight_chart"))
        .withDescription("Test data insight chart created by integration test")
        .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);
  }

  @Override
  protected CreateDataInsightChart createRequest(String name, TestNamespace ns) {
    return new CreateDataInsightChart()
        .withName(name)
        .withDescription("Test data insight chart")
        .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);
  }

  @Override
  protected DataInsightChart createEntity(CreateDataInsightChart createRequest) {
    return getDataInsightChartService().create(createRequest);
  }

  @Override
  protected DataInsightChart getEntity(String id) {
    return getDataInsightChartService().get(id);
  }

  @Override
  protected DataInsightChart getEntityByName(String fqn) {
    return getDataInsightChartService().getByName(fqn);
  }

  @Override
  protected DataInsightChart patchEntity(String id, DataInsightChart entity) {
    return getDataInsightChartService().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    getDataInsightChartService().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    getDataInsightChartService().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    getDataInsightChartService().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "dataInsightChart";
  }

  @Override
  protected void validateCreatedEntity(
      DataInsightChart entity, CreateDataInsightChart createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    if (createRequest.getDisplayName() != null) {
      assertEquals(createRequest.getDisplayName(), entity.getDisplayName());
    }

    assertEquals(createRequest.getDataIndexType(), entity.getDataIndexType());

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain chart name");
  }

  @Override
  protected ListResponse<DataInsightChart> listEntities(ListParams params) {
    return getDataInsightChartService().list(params);
  }

  @Override
  protected DataInsightChart getEntityWithFields(String id, String fields) {
    return getDataInsightChartService().get(id, fields);
  }

  @Override
  protected DataInsightChart getEntityByNameWithFields(String fqn, String fields) {
    return getDataInsightChartService().getByName(fqn, fields);
  }

  @Override
  protected DataInsightChart getEntityIncludeDeleted(String id) {
    return getDataInsightChartService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return getDataInsightChartService().getVersionList(id);
  }

  @Override
  protected DataInsightChart getVersion(UUID id, Double version) {
    return getDataInsightChartService().getVersion(id.toString(), version);
  }

  @Test
  void post_dataInsightChartWithoutRequiredFields_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    assertThrows(
        Exception.class,
        () -> createEntity(new CreateDataInsightChart().withName(null)),
        "Creating data insight chart without name should fail");

    assertThrows(
        Exception.class,
        () ->
            createEntity(
                new CreateDataInsightChart()
                    .withName(ns.prefix("chart_no_index"))
                    .withDescription("Test")
                    .withDataIndexType(null)),
        "Creating data insight chart without dataIndexType should fail");
  }

  @Test
  void post_dataInsightChartWithAllFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDataInsightChart request =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_full"))
            .withDisplayName("Complete Data Insight Chart")
            .withDescription("Fully configured data insight chart")
            .withDataIndexType(DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX)
            .withOwners(List.of(testUser1Ref()));

    DataInsightChart chart = createEntity(request);
    assertNotNull(chart);
    assertNotNull(chart.getId());
    assertEquals("Complete Data Insight Chart", chart.getDisplayName());
    assertEquals(
        DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX, chart.getDataIndexType());
  }

  @Test
  void get_dataInsightChartWithFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDataInsightChart request =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_fields"))
            .withDescription("Chart for field testing")
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX)
            .withOwners(List.of(testUser1Ref()));

    DataInsightChart created = createEntity(request);
    String entityId = created.getId().toString();

    DataInsightChart withoutFields = getEntity(entityId);
    assertTrue(withoutFields.getOwners() == null || withoutFields.getOwners().isEmpty());

    DataInsightChart withOwners = getEntityWithFields(entityId, "owners");
    assertNotNull(withOwners.getOwners());
    assertFalse(withOwners.getOwners().isEmpty());
  }

  @Test
  void test_listDataInsightCharts(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDataInsightChart request1 =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_list_1"))
            .withDescription("First chart")
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);

    CreateDataInsightChart request2 =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_list_2"))
            .withDescription("Second chart")
            .withDataIndexType(DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX);

    createEntity(request1);
    createEntity(request2);

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<DataInsightChart> response = listEntities(params);

    assertNotNull(response);
    assertTrue(response.getData().size() >= 2);
  }

  @Test
  void test_dataInsightChartUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String chartName = ns.prefix("unique_chart");
    CreateDataInsightChart request1 =
        new CreateDataInsightChart()
            .withName(chartName)
            .withDescription("First chart")
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);

    DataInsightChart chart1 = createEntity(request1);
    assertNotNull(chart1);

    CreateDataInsightChart request2 =
        new CreateDataInsightChart()
            .withName(chartName)
            .withDescription("Duplicate chart")
            .withDataIndexType(DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate data insight chart should fail");
  }

  @Test
  void test_dataInsightChartDataIndexTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDataInsightChart entityReportRequest =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_entity_report"))
            .withDescription("Entity report chart")
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);

    DataInsightChart entityReportChart = createEntity(entityReportRequest);
    assertEquals(DataReportIndex.ENTITY_REPORT_DATA_INDEX, entityReportChart.getDataIndexType());

    CreateDataInsightChart webAnalyticRequest =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_web_analytic"))
            .withDescription("Web analytic chart")
            .withDataIndexType(DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX);

    DataInsightChart webAnalyticChart = createEntity(webAnalyticRequest);
    assertEquals(
        DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX,
        webAnalyticChart.getDataIndexType());

    CreateDataInsightChart userReportRequest =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_web_user"))
            .withDescription("Web user report chart")
            .withDataIndexType(DataReportIndex.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX);

    DataInsightChart userReportChart = createEntity(userReportRequest);
    assertEquals(
        DataReportIndex.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX,
        userReportChart.getDataIndexType());
  }

  @Test
  void test_createDataInsightChartWithDifferentIndexTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DataReportIndex[] indexTypes = {
      DataReportIndex.ENTITY_REPORT_DATA_INDEX,
      DataReportIndex.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX,
      DataReportIndex.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX
    };

    int count = 0;
    for (DataReportIndex indexType : indexTypes) {
      CreateDataInsightChart request =
          new CreateDataInsightChart()
              .withName(ns.prefix("chart_type_" + count++))
              .withDescription("Chart with " + indexType.value())
              .withDataIndexType(indexType);

      DataInsightChart chart = createEntity(request);
      assertNotNull(chart);
      assertEquals(indexType, chart.getDataIndexType());
    }
  }

  @Test
  void get_dataInsightChartByName_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String chartName = ns.prefix("chart_by_name");
    CreateDataInsightChart request =
        new CreateDataInsightChart()
            .withName(chartName)
            .withDescription("Chart for name lookup")
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);

    DataInsightChart created = createEntity(request);
    assertNotNull(created);

    DataInsightChart fetchedByName = getEntityByName(created.getFullyQualifiedName());
    assertNotNull(fetchedByName);
    assertEquals(created.getId(), fetchedByName.getId());
    assertEquals(created.getName(), fetchedByName.getName());
    assertEquals(created.getDataIndexType(), fetchedByName.getDataIndexType());
  }

  @Test
  void delete_dataInsightChart_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDataInsightChart request =
        new CreateDataInsightChart()
            .withName(ns.prefix("chart_delete"))
            .withDescription("Chart to delete")
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);

    DataInsightChart created = createEntity(request);
    assertNotNull(created);
    String chartId = created.getId().toString();

    deleteEntity(chartId);

    DataInsightChart deleted = getEntityIncludeDeleted(chartId);
    assertNotNull(deleted);
    assertTrue(deleted.getDeleted());
  }

  @Override
  @Test
  @org.junit.jupiter.api.Disabled(
      "DataInsightChart PUT expects CreateDataInsightChart, not entity - needs SDK update")
  void test_sdkCRUDOperations(TestNamespace ns) {}

  @Override
  @Test
  @org.junit.jupiter.api.Disabled(
      "DataInsightChart PUT expects CreateDataInsightChart, not entity - needs SDK update")
  void testBulkFluentAPI(TestNamespace ns) {}

  private DataInsightChartService getDataInsightChartService() {
    return new DataInsightChartService(SdkClients.adminClient().getHttpClient());
  }
}
