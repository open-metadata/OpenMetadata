package org.openmetadata.service.resources.kpi;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.dataInsight.ChartParameterValues;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.dataInsight.type.KpiTargetType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.DataInsightChartDataType;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.dataInsight.DataInsightResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class KpiResourceTest extends EntityResourceTest<Kpi, CreateKpiRequest> {
  public KpiResourceTest() {
    super(Entity.KPI, Kpi.class, KpiResource.KpiList.class, "kpi", KpiResource.FIELDS);
    supportsEmptyDescription = false;
    supportsPatch = false;
  }

  public void setupKpi() throws IOException {
    DataInsightResourceTest dataInsightResourceTest = new DataInsightResourceTest();
    CreateDataInsightChart chartRequest =
        dataInsightResourceTest
            .createRequest(String.format("TestChart" + "%s", UUID.randomUUID()))
            .withOwner(USER1_REF)
            .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX)
            .withMetrics(
                List.of(
                    new ChartParameterValues()
                        .withName("Percentage")
                        .withChartDataType(DataInsightChartDataType.PERCENTAGE)));
    DI_CHART1 = dataInsightResourceTest.createAndCheckEntity(chartRequest, ADMIN_AUTH_HEADERS);
    KPI_TARGET = new KpiTarget().withName("Percentage").withValue("80");
  }

  @Test
  void post_testWithoutRequiredFields_4xx(TestInfo test) {
    // name is required field
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");
  }

  @Test
  void post_testWithInvalidValues_4xx() {
    String uuid = "Test2" + UUID.randomUUID();
    CreateKpiRequest create1 = createRequest(uuid);
    create1.withDataInsightChart(USER1_REF);

    assertResponseContains(
        () -> createAndCheckEntity(create1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "dataInsightChart instance for " + USER1_REF.getId() + " not found");
    CreateKpiRequest create2 = createRequest(String.format("Test%s", UUID.randomUUID()));
    KpiTarget target = new KpiTarget().withName("Test").withValue("Test");
    create2.withTargetDefinition(List.of(target));

    assertResponseContains(
        () -> createAndCheckEntity(create2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Kpi Target Definition " + target.getName() + " is not valid, metric not defined in corresponding chart");
  }

  @Test
  void createUpdate_tests_200() throws IOException {
    CreateKpiRequest create = createRequest("Test" + UUID.randomUUID());
    Kpi createdKpi = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    createdKpi = getEntity(createdKpi.getId(), KpiResource.FIELDS, ADMIN_AUTH_HEADERS);
    validateCreatedEntity(createdKpi, create, ADMIN_AUTH_HEADERS);

    KpiTarget newTarget = new KpiTarget().withName(KPI_TARGET.getName()).withValue("newValue");
    create.withTargetDefinition(List.of(newTarget));
    ChangeDescription change = getChangeDescription(createdKpi.getVersion());
    fieldUpdated(change, "targetDefinition", KPI_TARGET, newTarget);

    createdKpi = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);
    createdKpi = getEntity(createdKpi.getId(), KpiResource.FIELDS, ADMIN_AUTH_HEADERS);
    validateCreatedEntity(createdKpi, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_kpiResults_200(TestInfo test) throws IOException, ParseException {
    CreateKpiRequest create = createRequest(test);
    Kpi createdKpi = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    KpiResult kpiResult =
        new KpiResult()
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-09"))
            .withTargetResult(List.of(new KpiTarget().withName(KPI_TARGET.getName()).withValue("10")));
    putKpiResult(createdKpi.getFullyQualifiedName(), kpiResult, ADMIN_AUTH_HEADERS);

    ResultList<KpiResult> kpiResults =
        getKpiResults(
            createdKpi.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyKpiResults(kpiResults, List.of(kpiResult), 1);

    // Add new date for KpiResult
    KpiResult newKpiResult =
        new KpiResult()
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"))
            .withTargetResult(List.of(new KpiTarget().withName(KPI_TARGET.getName()).withValue("20")));
    putKpiResult(createdKpi.getFullyQualifiedName(), newKpiResult, ADMIN_AUTH_HEADERS);

    kpiResults =
        getKpiResults(
            createdKpi.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyKpiResults(kpiResults, List.of(kpiResult, newKpiResult), 2);

    // Replace kpi result for a date
    KpiResult newKpiResult1 =
        new KpiResult()
            .withTimestamp(TestUtils.dateToTimestamp("2021-09-10"))
            .withTargetResult(List.of(new KpiTarget().withName(KPI_TARGET.getName()).withValue("25")));
    putKpiResult(createdKpi.getFullyQualifiedName(), newKpiResult1, ADMIN_AUTH_HEADERS);

    createdKpi = getEntity(createdKpi.getId(), "targetDefinition", ADMIN_AUTH_HEADERS);
    // first result should be the latest date
    kpiResults =
        getKpiResults(
            createdKpi.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            ADMIN_AUTH_HEADERS);
    verifyKpiResults(kpiResults, List.of(newKpiResult1, kpiResult), 2);

    String dateStr = "2021-09-";
    List<KpiResult> kpiResultList = new ArrayList<>();
    kpiResultList.add(kpiResult);
    kpiResultList.add(newKpiResult1);
    for (int i = 11; i <= 20; i++) {
      kpiResult =
          new KpiResult()
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i))
              .withTargetResult(
                  List.of(new KpiTarget().withName(KPI_TARGET.getName()).withValue(String.valueOf(50 + i))));
      putKpiResult(createdKpi.getFullyQualifiedName(), kpiResult, ADMIN_AUTH_HEADERS);
      kpiResultList.add(kpiResult);
    }
    kpiResults =
        getKpiResults(
            createdKpi.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-20"),
            ADMIN_AUTH_HEADERS);
    verifyKpiResults(kpiResults, kpiResultList, 12);
  }

  public void putKpiResult(String fqn, KpiResult data, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/kpiResult");
    TestUtils.put(target, data, CREATED, authHeaders);
  }

  public ResultList<KpiResult> getKpiResults(String fqn, Long start, Long end, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/kpiResult");
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    return TestUtils.get(target, KpiResource.KpiResultList.class, authHeaders);
  }

  private void verifyKpiResults(
      ResultList<KpiResult> actualKpiResults, List<KpiResult> expectedKpiResults, int expectedCount) {
    assertEquals(expectedCount, actualKpiResults.getPaging().getTotal());
    assertEquals(expectedKpiResults.size(), actualKpiResults.getData().size());
    Map<Long, KpiResult> kpiResultMap = new HashMap<>();
    for (KpiResult result : actualKpiResults.getData()) {
      kpiResultMap.put(result.getTimestamp(), result);
    }
    for (KpiResult result : expectedKpiResults) {
      KpiResult storedKpiResult = kpiResultMap.get(result.getTimestamp());
      verifyKpiResult(storedKpiResult, result);
    }
  }

  private void verifyKpiResult(KpiResult expected, KpiResult actual) {
    assertEquals(expected, actual);
  }

  @Override
  public CreateKpiRequest createRequest(String name) {
    try {
      this.setupKpi();
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    return new CreateKpiRequest()
        .withName(name)
        .withDescription(name)
        .withDisplayName(name)
        .withStartDate(0L)
        .withEndDate(30L)
        .withDataInsightChart(DI_CHART1.getEntityReference())
        .withOwner(USER1_REF)
        .withMetricType(KpiTargetType.PERCENTAGE)
        .withTargetDefinition(List.of(KPI_TARGET));
  }

  @Override
  public void validateCreatedEntity(Kpi createdEntity, CreateKpiRequest request, Map<String, String> authHeaders) {
    validateCommonEntityFields(createdEntity, request, getPrincipalName(authHeaders));
    assertEquals(request.getStartDate(), createdEntity.getStartDate());
    assertEquals(request.getEndDate(), createdEntity.getEndDate());
    assertEquals(request.getDataInsightChart(), createdEntity.getDataInsightChart());
    assertEquals(request.getMetricType(), createdEntity.getMetricType());
    assertEquals(request.getTargetDefinition(), createdEntity.getTargetDefinition());
  }

  @Override
  public void compareEntities(Kpi expected, Kpi updated, Map<String, String> authHeaders) {
    validateCommonEntityFields(expected, updated, getPrincipalName(authHeaders));
    assertEquals(expected.getStartDate(), updated.getStartDate());
    assertEquals(expected.getEndDate(), updated.getEndDate());
    assertEquals(expected.getDataInsightChart(), updated.getDataInsightChart());
    assertEquals(expected.getMetricType(), updated.getMetricType());
    assertEquals(expected.getTargetDefinition(), updated.getTargetDefinition());
  }

  @Override
  public Kpi validateGetWithDifferentFields(Kpi entity, boolean byName) throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner(), entity.getDataInsightChart());
    fields = "owner,dataInsightChart"; // Not testing for kpiResult field
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner(), entity.getDataInsightChart());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {}
    // TODO fix this
  }
}
