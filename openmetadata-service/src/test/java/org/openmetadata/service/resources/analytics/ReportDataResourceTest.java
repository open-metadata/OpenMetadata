package org.openmetadata.service.resources.analytics;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;

import java.text.ParseException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.analytics.EntityReportData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

public class ReportDataResourceTest extends OpenMetadataApplicationTest {

  private final String collectionName = "analytics/reportData";

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
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void report_data_non_auth_user_403() throws HttpResponseException, ParseException {
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
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-11"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    postReportData(reportData, INGESTION_BOT_AUTH_HEADERS);

    ResultList<ReportData> reportDataList =
        getReportData(
            "2022-10-10", "2022-10-12", ReportData.ReportDataType.ENTITY_REPORT_DATA, INGESTION_BOT_AUTH_HEADERS);
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
    return TestUtils.get(target, ReportDataResource.ReportDataResultList.class, authHeader);
  }
}
