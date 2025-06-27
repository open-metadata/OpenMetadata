package org.openmetadata.service.resources.kpi;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import es.org.elasticsearch.client.RestClient;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.api.dataInsight.kpi.KpiDataInsightChart;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.dataInsight.type.KpiTargetType;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.resources.EntityResourceTest;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class KpiResourceTest extends EntityResourceTest<Kpi, CreateKpiRequest> {
  public KpiResourceTest() {
    super(Entity.KPI, Kpi.class, KpiResource.KpiList.class, "kpi", KpiResource.FIELDS);
    supportsPatch = false;
  }

  private void createDataAssetsDataStream() {
    DataInsightsSearchInterface searchInterface;
    Set<String> dataAssetTypes =
        Set.of(
            "table",
            "storedProcedure",
            "databaseSchema",
            "database",
            "chart",
            "dashboard",
            "dashboardDataModel",
            "pipeline",
            "topic",
            "container",
            "searchIndex",
            "mlmodel",
            "dataProduct",
            "glossaryTerm",
            "tag");
    if (Entity.getSearchRepository()
        .getSearchType()
        .equals(ElasticSearchConfiguration.SearchType.ELASTICSEARCH)) {
      searchInterface =
          new ElasticSearchDataInsightsClient(
              (RestClient) Entity.getSearchRepository().getSearchClient().getLowLevelClient(),
              Entity.getSearchRepository().getClusterAlias());
    } else {
      searchInterface =
          new OpenSearchDataInsightsClient(
              (os.org.opensearch.client.RestClient)
                  Entity.getSearchRepository().getSearchClient().getLowLevelClient(),
              Entity.getSearchRepository().getClusterAlias());
    }
    try {
      for (String dataAssetType : dataAssetTypes) {
        String dataStreamName =
            String.format("%s-%s", "di-data-assets", dataAssetType).toLowerCase();
        if (!searchInterface.dataAssetDataStreamExists(dataStreamName)) {
          searchInterface.createDataAssetsDataStream(
              dataStreamName,
              dataAssetType,
              Entity.getSearchRepository().getIndexMapping(dataAssetType),
              "en",
              7);
        }
      }
    } catch (IOException ex) {
      LOG.error("Couldn't install DataInsightsApp: Can't initialize ElasticSearch Index.", ex);
    }
  }

  public void setupKpi() {
    createDataAssetsDataStream();
    KPI_TARGET = new KpiTarget().withName("Percentage").withValue("80.0");
  }

  @Test
  void post_testWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");
  }

  @Test
  void createUpdate_tests_200() throws IOException {
    CreateKpiRequest create = createRequest("Test" + UUID.randomUUID());
    Kpi createdKpi = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    createdKpi = getEntity(createdKpi.getId(), KpiResource.FIELDS, ADMIN_AUTH_HEADERS);
    validateCreatedEntity(createdKpi, create, ADMIN_AUTH_HEADERS);
    create.withTargetValue(10d);
    ChangeDescription change = getChangeDescription(createdKpi, MINOR_UPDATE);
    fieldUpdated(change, "targetValue", KPI_TARGET.getValue(), create.getTargetValue().toString());

    createdKpi = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    createdKpi = getEntity(createdKpi.getId(), KpiResource.FIELDS, ADMIN_AUTH_HEADERS);
    validateCreatedEntity(createdKpi, create, ADMIN_AUTH_HEADERS);
  }

  @Override
  public CreateKpiRequest createRequest(String name) {
    this.setupKpi();
    return new CreateKpiRequest()
        .withName(name)
        .withDescription(name)
        .withDisplayName(name)
        .withStartDate(0L)
        .withEndDate(30L)
        .withDataInsightChart(KpiDataInsightChart.PERCENTAGE_OF_DATA_ASSET_WITH_DESCRIPTION_KPI)
        .withOwners(List.of(USER1_REF))
        .withMetricType(KpiTargetType.PERCENTAGE)
        .withTargetValue(Double.valueOf(KPI_TARGET.getValue()));
  }

  @Override
  public void validateCreatedEntity(
      Kpi createdEntity, CreateKpiRequest request, Map<String, String> authHeaders) {
    validateCommonEntityFields(createdEntity, request, getPrincipalName(authHeaders));
    assertEquals(request.getStartDate(), createdEntity.getStartDate());
    assertEquals(request.getEndDate(), createdEntity.getEndDate());
    assertReference(request.getDataInsightChart().value(), createdEntity.getDataInsightChart());
    assertEquals(request.getMetricType(), createdEntity.getMetricType());
    assertEquals(request.getTargetValue(), createdEntity.getTargetValue());
  }

  @Override
  public void compareEntities(Kpi expected, Kpi updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(expected, updated, getPrincipalName(authHeaders));
    assertEquals(expected.getStartDate(), updated.getStartDate());
    assertEquals(expected.getEndDate(), updated.getEndDate());
    assertEquals(expected.getDataInsightChart(), updated.getDataInsightChart());
    assertEquals(expected.getMetricType(), updated.getMetricType());
    assertEquals(expected.getTargetValue(), updated.getTargetValue());
  }

  @Override
  public Kpi validateGetWithDifferentFields(Kpi entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners(), entity.getDataInsightChart());
    fields = "owners,dataInsightChart"; // Not testing for kpiResult field
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners(), entity.getDataInsightChart());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("targetDefinition")) {
      assertEquals(JsonUtils.pojoToJson(expected), actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
