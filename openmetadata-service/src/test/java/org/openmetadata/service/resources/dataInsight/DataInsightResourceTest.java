package org.openmetadata.service.resources.dataInsight;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ParallelizeTest;

@ParallelizeTest
public class DataInsightResourceTest extends EntityResourceTest<DataInsightChart, CreateDataInsightChart> {
  public DataInsightResourceTest() {
    super(
        Entity.DATA_INSIGHT_CHART,
        DataInsightChart.class,
        DataInsightChartResource.DataInsightChartList.class,
        "dataInsight",
        DataInsightChartResource.FIELDS);
  }

  @Test
  void post_data_insight_chart_entity_200(TestInfo test) throws IOException {
    CreateDataInsightChart create = createRequest(test);
    create.withName("dataChartTest");
    DataInsightChart dataInsightChart = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    dataInsightChart = getEntity(dataInsightChart.getId(), ADMIN_AUTH_HEADERS);
    validateCreatedEntity(dataInsightChart, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_data_insight_4x(TestInfo test) {
    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name must not be null");
  }

  @Override
  public CreateDataInsightChart createRequest(String name) {
    return new CreateDataInsightChart()
        .withName(name)
        .withDescription(name)
        .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);
  }

  @Override
  public void validateCreatedEntity(
      DataInsightChart createdEntity, CreateDataInsightChart request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(DataInsightChart expected, DataInsightChart updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public DataInsightChart validateGetWithDifferentFields(DataInsightChart entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner());
    fields = "owner";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}
}
