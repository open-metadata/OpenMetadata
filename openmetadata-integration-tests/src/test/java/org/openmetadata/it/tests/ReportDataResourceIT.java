/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.text.ParseException;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.analytics.EntityReportData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for ReportData resource operations.
 *
 * <p>Tests analytics report data submission, retrieval, and deletion operations including: -
 * Submitting entity report data - Submitting web analytics user activity data - Retrieving report
 * data with date filters - Deleting report data by date - Testing data aggregation and filtering
 *
 * <p>Migrated from: org.openmetadata.service.resources.analytics.ReportDataResourceTest
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ReportDataResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String REPORT_DATA_PATH = "/v1/analytics/dataInsights/data";

  @Test
  void testSubmitEntityReportData(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("table")
            .withEntityTier("Tier.Tier1")
            .withCompletedDescriptions(5)
            .withEntityCount(20);

    ReportData reportData =
        new ReportData()
            .withTimestamp(dateToTimestamp("2024-01-15"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    submitReportData(client, reportData);

    ResultList<ReportData> reportDataList =
        getReportData(
            client, "2024-01-14", "2024-01-16", ReportData.ReportDataType.ENTITY_REPORT_DATA);

    assertNotNull(reportDataList);
    assertFalse(reportDataList.getData().isEmpty());
    // Data is deserialized as a Map from JSON, not as EntityReportData directly
    // Just verify the report data type is correct
    assertTrue(
        reportDataList.getData().stream()
            .anyMatch(
                rd ->
                    rd.getReportDataType() == ReportData.ReportDataType.ENTITY_REPORT_DATA
                        && rd.getData() != null));
  }

  @Test
  void testSubmitWebAnalyticsReportData(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    WebAnalyticUserActivityReportData webActivityData =
        new WebAnalyticUserActivityReportData()
            .withUserId(UUID.randomUUID())
            .withUserName("test_user_" + ns.shortPrefix())
            .withLastSession(dateToTimestamp("2024-01-20"));

    ReportData reportData =
        new ReportData()
            .withTimestamp(dateToTimestamp("2024-01-20"))
            .withReportDataType(ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)
            .withData(webActivityData);

    submitReportData(client, reportData);

    ResultList<ReportData> reportDataList =
        getReportData(
            client,
            "2024-01-19",
            "2024-01-21",
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);

    assertNotNull(reportDataList);
    assertFalse(reportDataList.getData().isEmpty());
    // Data is deserialized as a Map from JSON, not as WebAnalyticUserActivityReportData directly
    // Just verify the report data type is correct
    assertTrue(
        reportDataList.getData().stream()
            .anyMatch(
                rd ->
                    rd.getReportDataType()
                            == ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA
                        && rd.getData() != null));
  }

  @Test
  void testRetrieveReportDataWithDateRange(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReportData entityReportData1 =
        new EntityReportData()
            .withEntityType("dashboard")
            .withEntityTier("Tier.Tier2")
            .withCompletedDescriptions(3)
            .withEntityCount(10);

    ReportData reportData1 =
        new ReportData()
            .withTimestamp(dateToTimestamp("2024-02-10"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData1);

    EntityReportData entityReportData2 =
        new EntityReportData()
            .withEntityType("dashboard")
            .withEntityTier("Tier.Tier2")
            .withCompletedDescriptions(4)
            .withEntityCount(12);

    ReportData reportData2 =
        new ReportData()
            .withTimestamp(dateToTimestamp("2024-02-11"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData2);

    submitReportData(client, reportData1);
    submitReportData(client, reportData2);

    ResultList<ReportData> reportDataList =
        getReportData(
            client, "2024-02-10", "2024-02-12", ReportData.ReportDataType.ENTITY_REPORT_DATA);

    assertNotNull(reportDataList);
    assertFalse(reportDataList.getData().isEmpty());

    long countInDateRange =
        reportDataList.getData().stream()
            .filter(
                rd -> {
                  long timestamp = rd.getTimestamp();
                  try {
                    long startTs = dateToTimestamp("2024-02-10");
                    long endTs = dateToTimestamp("2024-02-12");
                    return timestamp >= startTs && timestamp < endTs;
                  } catch (Exception e) {
                    return false;
                  }
                })
            .count();

    assertTrue(countInDateRange >= 2);
  }

  @Test
  void testReportDataAggregation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 1; i <= 3; i++) {
      EntityReportData entityReportData =
          new EntityReportData()
              .withEntityType("table")
              .withEntityTier("Tier.Tier1")
              .withCompletedDescriptions(i * 2)
              .withEntityCount(i * 10);

      ReportData reportData =
          new ReportData()
              .withTimestamp(dateToTimestamp("2024-03-" + String.format("%02d", i + 10)))
              .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
              .withData(entityReportData);

      submitReportData(client, reportData);
    }

    ResultList<ReportData> reportDataList =
        getReportData(
            client, "2024-03-10", "2024-03-15", ReportData.ReportDataType.ENTITY_REPORT_DATA);

    assertNotNull(reportDataList);
    assertFalse(reportDataList.getData().isEmpty());

    List<ReportData> dataInRange =
        reportDataList.getData().stream()
            .filter(
                rd -> {
                  try {
                    long timestamp = rd.getTimestamp();
                    long startTs = dateToTimestamp("2024-03-10");
                    long endTs = dateToTimestamp("2024-03-15");
                    return timestamp >= startTs && timestamp < endTs;
                  } catch (Exception e) {
                    return false;
                  }
                })
            .toList();

    assertTrue(dataInRange.size() >= 3);
  }

  @Test
  void testDeleteReportDataByDate(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("topic")
            .withEntityTier("Tier.Tier3")
            .withCompletedDescriptions(7)
            .withEntityCount(25);

    ReportData reportData =
        new ReportData()
            .withTimestamp(new Date(124, Calendar.APRIL, 5, 10, 30, 0).getTime())
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    submitReportData(client, reportData);

    ResultList<ReportData> beforeDelete =
        getReportData(
            client, "2024-04-05", "2024-04-06", ReportData.ReportDataType.ENTITY_REPORT_DATA);
    long countBefore =
        beforeDelete.getData().stream()
            .filter(
                rd -> {
                  try {
                    return rd.getTimestamp() >= dateToTimestamp("2024-04-05")
                        && rd.getTimestamp() < dateToTimestamp("2024-04-06");
                  } catch (Exception e) {
                    return false;
                  }
                })
            .count();
    assertTrue(countBefore >= 1);

    deleteReportDataByDate(client, ReportData.ReportDataType.ENTITY_REPORT_DATA, "2024-04-05");

    ResultList<ReportData> afterDelete =
        getReportData(
            client, "2024-04-05", "2024-04-06", ReportData.ReportDataType.ENTITY_REPORT_DATA);
    long countAfter =
        afterDelete.getData().stream()
            .filter(
                rd -> {
                  try {
                    long timestamp = rd.getTimestamp();
                    long targetDate = dateToTimestamp("2024-04-05");
                    return isSameDay(timestamp, targetDate);
                  } catch (Exception e) {
                    return false;
                  }
                })
            .count();

    assertTrue(countAfter < countBefore);
  }

  @Test
  void testMultipleReportDataTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReportData entityReportData =
        new EntityReportData()
            .withEntityType("pipeline")
            .withEntityTier("Tier.Tier1")
            .withCompletedDescriptions(8)
            .withEntityCount(15);

    ReportData entityReport =
        new ReportData()
            .withTimestamp(dateToTimestamp("2024-05-15"))
            .withReportDataType(ReportData.ReportDataType.ENTITY_REPORT_DATA)
            .withData(entityReportData);

    WebAnalyticUserActivityReportData webActivityData =
        new WebAnalyticUserActivityReportData()
            .withUserId(UUID.randomUUID())
            .withUserName("multi_test_user_" + ns.shortPrefix())
            .withLastSession(dateToTimestamp("2024-05-15"));

    ReportData webAnalyticsReport =
        new ReportData()
            .withTimestamp(dateToTimestamp("2024-05-15"))
            .withReportDataType(ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA)
            .withData(webActivityData);

    submitReportData(client, entityReport);
    submitReportData(client, webAnalyticsReport);

    ResultList<ReportData> entityReportList =
        getReportData(
            client, "2024-05-14", "2024-05-16", ReportData.ReportDataType.ENTITY_REPORT_DATA);
    ResultList<ReportData> webAnalyticsList =
        getReportData(
            client,
            "2024-05-14",
            "2024-05-16",
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);

    assertNotNull(entityReportList);
    assertNotNull(webAnalyticsList);
    assertFalse(entityReportList.getData().isEmpty());
    assertFalse(webAnalyticsList.getData().isEmpty());
  }

  private void submitReportData(OpenMetadataClient client, ReportData reportData)
      throws OpenMetadataException {
    client.getHttpClient().execute(HttpMethod.POST, REPORT_DATA_PATH, reportData, ReportData.class);
  }

  private ResultList<ReportData> getReportData(
      OpenMetadataClient client, String startDate, String endDate, ReportData.ReportDataType type)
      throws Exception {
    long startTs = dateToTimestamp(startDate);
    long endTs = dateToTimestamp(endDate);

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("reportDataType", type.value())
            .queryParam("startTs", String.valueOf(startTs))
            .queryParam("endTs", String.valueOf(endTs))
            .build();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, REPORT_DATA_PATH, null, options);

    return OBJECT_MAPPER.readValue(response, new TypeReference<ResultList<ReportData>>() {});
  }

  private void deleteReportDataByDate(
      OpenMetadataClient client, ReportData.ReportDataType type, String date)
      throws OpenMetadataException {
    String path = REPORT_DATA_PATH + "/" + type.value() + "/" + date;
    client.getHttpClient().execute(HttpMethod.DELETE, path, null, String.class);
  }

  private long dateToTimestamp(String dateStr) throws ParseException {
    String[] parts = dateStr.split("-");
    int year = Integer.parseInt(parts[0]);
    int month = Integer.parseInt(parts[1]);
    int day = Integer.parseInt(parts[2]);

    Date date = new Date(year - 1900, month - 1, day);
    return date.getTime();
  }

  private boolean isSameDay(long timestamp1, long timestamp2) {
    Date date1 = new Date(timestamp1);
    Date date2 = new Date(timestamp2);

    return date1.getYear() == date2.getYear()
        && date1.getMonth() == date2.getMonth()
        && date1.getDate() == date2.getDate();
  }
}
