package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.core.Response;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.ReportData.ReportDataType;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class ReportDataRepository {
  public static final String COLLECTION_PATH = "/v1/analytics/report";
  public static final String REPORT_DATA_EXTENSION = "reportData.reportDataResult";
  public final CollectionDAO daoCollection;
  private static final Map<String, String> reportDataKeyMap =
      Map.of(
          ReportDataType.ENTITY_REPORT_DATA.value(), "entityType",
          ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(), "entityFqn",
          ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(), "userName");

  public ReportDataRepository(CollectionDAO dao) {
    this.daoCollection = dao;
  }

  @Transaction
  public Response addReportData(ReportData reportData) throws IOException {
    String storedReportData = getReportDataByType(reportData);
    reportData.setId(UUID.randomUUID());

    if (storedReportData != null) {
      HashMap<String, Object> data = (HashMap<String, Object>) reportData.getData();

      daoCollection
          .entityExtensionTimeSeriesDao()
          .updateReportExtensionAtTimestampByKeyInternal(
              data.get(reportDataKeyMap.get(reportData.getReportDataType().value())).toString(),
              reportData.getReportDataType().value(),
              reportData.getReportDataType().value(),
              REPORT_DATA_EXTENSION,
              JsonUtils.pojoToJson(reportData),
              reportData.getTimestamp(),
              getMySQLCondition(reportDataKeyMap.get(reportData.getReportDataType().value())),
              getPSQLCondition(reportDataKeyMap.get(reportData.getReportDataType().value())));
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              reportData.getReportDataType().value(),
              REPORT_DATA_EXTENSION,
              "reportData",
              JsonUtils.pojoToJson(reportData));
    }

    return Response.ok(reportData).build();
  }

  private String getMySQLCondition(String key) {
    return String.format(
        "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.reportDataType')) = :reportDataType AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.data.%s')) = :value",
        key);
  }

  private String getPSQLCondition(String key) {
    return String.format("AND json->>'reportDataType' = :reportDataType " + "AND json->'data'->>'%s' = :value", key);
  }

  public String getReportDataByType(ReportData reportData) {
    HashMap<String, Object> data = (HashMap<String, Object>) reportData.getData();

    return daoCollection
        .entityExtensionTimeSeriesDao()
        .getReportExtensionAtTimestampByKeyInternal(
            data.get(reportDataKeyMap.get(reportData.getReportDataType().value())).toString(),
            reportData.getReportDataType().value(),
            FullyQualifiedName.buildHash(reportData.getReportDataType().value()),
            REPORT_DATA_EXTENSION,
            reportData.getTimestamp(),
            getMySQLCondition(reportDataKeyMap.get(reportData.getReportDataType().value())),
            getPSQLCondition(reportDataKeyMap.get(reportData.getReportDataType().value())));
  }

  public ResultList<ReportData> getReportData(ReportDataType reportDataType, Long startTs, Long endTs)
      throws IOException {
    List<ReportData> reportData;
    reportData =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(reportDataType.value(), REPORT_DATA_EXTENSION, startTs, endTs),
            ReportData.class);

    return new ResultList<>(reportData, String.valueOf(startTs), String.valueOf(endTs), reportData.size());
  }
}
