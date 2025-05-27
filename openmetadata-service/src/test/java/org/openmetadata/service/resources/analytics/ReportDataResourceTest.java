package org.openmetadata.service.resources.analytics;

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.openmetadata.schema.type.DataReportIndex.ENTITY_REPORT_DATA_INDEX;
import static org.openmetadata.schema.type.DataReportIndex.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.Response;
import es.org.elasticsearch.client.RestClient;
import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.analytics.EntityReportData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.analytics.ReportDataResource.ReportDataResultList;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class ReportDataResourceTest extends OpenMetadataApplicationTest {

  public static final String JSON_QUERY =
      "{\"query\":{\"bool\":{\"filter\":{\"script\":{\"script\":"
          + "{\"source\":\"doc['timestamp'].value.toLocalDate() == LocalDate.parse(params.now);\",\"lang\":\"painless\",\"params\":{\"now\":\"%s\"}}}}}}}";
  private final String collectionName = "analytics/dataInsights/data";

  @Test
  void report_data_admin_200() throws ParseException, IOException {
    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("table")
            .withEntityTier("Tier.Tier1")
            .withCompletedDescriptions(1)
            .withEntityCount(11);

    ReportData reportData =
        new ReportData()
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-11"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    postReportData(reportData, ADMIN_AUTH_HEADERS);

    ResultList<ReportData> reportDataList =
        getReportData(
            "2022-10-10",
            "2022-10-13",
            ReportData.ReportDataType.ENTITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);

    assertNotEquals(0, reportDataList.getData().size());
  }

  @Test
  void report_data_non_auth_user_403() throws ParseException {
    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("table")
            .withEntityTier("Tier.Tier1")
            .withCompletedDescriptions(1)
            .withEntityCount(11);

    ReportData reportData =
        new ReportData()
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-11"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    TestUtils.assertResponse(
        () -> postReportData(reportData, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.CREATE)));
  }

  @Test
  void report_data_bot_200() throws HttpResponseException, ParseException {
    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("table")
            .withEntityTier("Tier.Tier1")
            .withCompletedDescriptions(1)
            .withEntityCount(11);

    ReportData reportData =
        new ReportData()
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-13"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    postReportData(reportData, INGESTION_BOT_AUTH_HEADERS);

    ResultList<ReportData> reportDataList =
        getReportData(
            "2022-10-12",
            "2022-10-14",
            ReportData.ReportDataType.ENTITY_REPORT_DATA,
            INGESTION_BOT_AUTH_HEADERS);

    assertNotEquals(0, reportDataList.getData().size());
  }

  @Test
  void delete_endpoint_200() throws ParseException, IOException {
    List<ReportData> createReportDataList = new ArrayList<>();

    // create some entity report data
    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("table")
            .withEntityTier("Tier.Tier1")
            .withCompletedDescriptions(1)
            .withEntityCount(11);
    ReportData reportData1 =
        new ReportData()
            .withTimestamp(new Date(122, Calendar.OCTOBER, 15, 10, 10, 10).getTime())
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    // create some web analytic user activity report data
    WebAnalyticUserActivityReportData webAnalyticUserActivityReportData =
        new WebAnalyticUserActivityReportData()
            .withUserId(UUID.randomUUID())
            .withUserName("testUser")
            .withLastSession(TestUtils.dateToTimestamp("2022-10-13"));
    ReportData reportData2 =
        new ReportData()
            .withTimestamp(new Date(122, Calendar.OCTOBER, 15, 10, 10, 10).getTime())
            .withReportDataType(ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)
            .withData(webAnalyticUserActivityReportData);

    createReportDataList.add(reportData1);
    createReportDataList.add(reportData2);

    for (ReportData reportData : createReportDataList) {
      postReportData(reportData, INGESTION_BOT_AUTH_HEADERS);
    }

    // check we have our data
    ResultList<ReportData> entityReportDataList =
        getReportData(
            "2022-10-15",
            "2022-10-16",
            ReportData.ReportDataType.ENTITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);
    ResultList<ReportData> webAnalyticsReportDataList =
        getReportData(
            "2022-10-15",
            "2022-10-16",
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);
    assertNotEquals(0, entityReportDataList.getData().size());
    assertNotEquals(0, webAnalyticsReportDataList.getData().size());
    List<String> indices = new ArrayList<>();
    indices.add(ENTITY_REPORT_DATA_INDEX.value());
    indices.add(WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX.value());
    for (String index : indices) {
      String jsonQuery = String.format(JSON_QUERY, "2022-10-15");
      assertDocumentCountEquals(jsonQuery, index, 1);
    }

    // delete the entity report data and check that it has been deleted
    deleteReportData(
        ReportData.ReportDataType.ENTITY_REPORT_DATA.value(), "2022-10-15", ADMIN_AUTH_HEADERS);
    entityReportDataList =
        getReportData(
            "2022-10-15",
            "2022-10-16",
            ReportData.ReportDataType.ENTITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);
    assertEquals(0, entityReportDataList.getData().size());
    // Check document has been deleted from elasticsearch
    String jsonQuery = String.format(JSON_QUERY, "2022-10-15");
    assertDocumentCountEquals(jsonQuery, ENTITY_REPORT_DATA_INDEX.value(), 0);
    webAnalyticsReportDataList =
        getReportData(
            "2022-10-15",
            "2022-10-16",
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);
    assertNotEquals(0, webAnalyticsReportDataList.getData().size());
  }

  public void postReportData(ReportData reportData, Map<String, String> authHeader)
      throws HttpResponseException {
    WebTarget target = getResource(collectionName);
    TestUtils.post(target, reportData, ReportData.class, 200, authHeader);
  }

  public ResultList<ReportData> getReportData(
      String startDate,
      String endDate,
      ReportData.ReportDataType reportDataType,
      Map<String, String> authHeader)
      throws HttpResponseException, ParseException {
    WebTarget target = getResource(collectionName);
    target = target.queryParam("startTs", TestUtils.dateToTimestamp(startDate));
    target = target.queryParam("endTs", TestUtils.dateToTimestamp(endDate));
    target = target.queryParam("reportDataType", reportDataType);
    return TestUtils.get(target, ReportDataResultList.class, authHeader);
  }

  private void deleteReportData(String reportDataType, String date, Map<String, String> authHeader)
      throws HttpResponseException {
    String path = String.format("/%s/%s", reportDataType, date);
    WebTarget target = getResource(collectionName).path(path);
    TestUtils.delete(target, authHeader);
  }

  private JsonNode runSearchQuery(String query, String index) throws IOException {
    RestClient searchClient = getSearchClient();
    Response response;
    Request request =
        new Request(
            "POST",
            String.format(
                "/%s/_search",
                Entity.getSearchRepository().getIndexOrAliasName(String.valueOf(index))));
    request.setJsonEntity(query);
    try {
      response = searchClient.performRequest(request);
    } finally {
      searchClient.close();
    }
    return new ObjectMapper().readTree(response.getEntity().getContent());
  }

  private void assertDocumentCountEquals(String query, String index, Integer count)
      throws IOException {
    // async client will return a future which we don't have access to, hence sleep
    JsonNode json = runSearchQuery(query, index);
    Integer docCount = json.get("hits").get("total").get("value").asInt();
    assertEquals(count, docCount);
  }
}
