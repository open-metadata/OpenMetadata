package org.openmetadata.service.resources.analytics;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.analytics.EntityReportData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.analytics.ReportDataResource.ReportDataResultList;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

class ReportDataResourceTest extends OpenMetadataApplicationTest {

  private final String collectionName = "analytics/dataInsights/data";

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void report_data_admin_200() throws HttpResponseException, ParseException {
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
        getReportData("2022-10-10", "2022-10-12", ReportData.ReportDataType.ENTITY_REPORT_DATA, ADMIN_AUTH_HEADERS);

    assertNotEquals(0, reportDataList.getData().size());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
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
  @Execution(ExecutionMode.CONCURRENT)
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
            "2022-10-10", "2022-10-12", ReportData.ReportDataType.ENTITY_REPORT_DATA, INGESTION_BOT_AUTH_HEADERS);

    assertNotEquals(0, reportDataList.getData().size());
  }

  @Test
  void delete_endpoint_200() throws HttpResponseException, ParseException {
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
            .withTimestamp(new Date(122, 9, 15, 10, 10, 10).getTime())
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
            .withTimestamp(new Date(122, 9, 15, 10, 10, 10).getTime())
            .withReportDataType(ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)
            .withData(webAnalyticUserActivityReportData);

    createReportDataList.add(reportData1);
    createReportDataList.add(reportData2);

    for (ReportData reportData : createReportDataList) {
      postReportData(reportData, INGESTION_BOT_AUTH_HEADERS);
    }

    // check we have our data
    ResultList<ReportData> entityReportDataList =
        getReportData("2022-10-15", "2022-10-16", ReportData.ReportDataType.ENTITY_REPORT_DATA, ADMIN_AUTH_HEADERS);
    ResultList<ReportData> webAnalyticsReportDataList =
        getReportData(
            "2022-10-15",
            "2022-10-16",
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);
    assertNotEquals(0, entityReportDataList.getData().size());
    assertNotEquals(0, webAnalyticsReportDataList.getData().size());

    // delete the entity report data and check that it has been deleted
    deleteReportData(ReportData.ReportDataType.ENTITY_REPORT_DATA.value(), "2022-10-15", ADMIN_AUTH_HEADERS);
    entityReportDataList =
        getReportData("2022-10-15", "2022-10-16", ReportData.ReportDataType.ENTITY_REPORT_DATA, ADMIN_AUTH_HEADERS);
    assertEquals(0, entityReportDataList.getData().size());
    webAnalyticsReportDataList =
        getReportData(
            "2022-10-15",
            "2022-10-16",
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
            ADMIN_AUTH_HEADERS);
    assertNotEquals(0, webAnalyticsReportDataList.getData().size());
  }

  public void postReportData(ReportData reportData, Map<String, String> authHeader) throws HttpResponseException {
    WebTarget target = getResource(collectionName);
    TestUtils.post(target, reportData, ReportData.class, 200, authHeader);
  }

  public ResultList<ReportData> getReportData(
      String startDate, String endDate, ReportData.ReportDataType reportDataType, Map<String, String> authHeader)
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
}
