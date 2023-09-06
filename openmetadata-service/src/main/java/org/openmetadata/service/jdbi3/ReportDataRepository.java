package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.ReportData.ReportDataType;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class ReportDataRepository {
  public static final String COLLECTION_PATH = "/v1/analytics/report";
  public static final String REPORT_DATA_EXTENSION = "reportData.reportDataResult";
  public final CollectionDAO daoCollection;

  public ReportDataRepository(CollectionDAO dao) {
    this.daoCollection = dao;
  }

  public Response addReportData(ReportData reportData) {
    reportData.setId(UUID.randomUUID());
    daoCollection
        .reportDataTimeSeriesDao()
        .insert(
            reportData.getReportDataType().value(),
            REPORT_DATA_EXTENSION,
            "reportData",
            JsonUtils.pojoToJson(reportData));

    return Response.ok(reportData).build();
  }

  public ResultList<ReportData> getReportData(ReportDataType reportDataType, Long startTs, Long endTs) {
    List<ReportData> reportData;
    reportData =
        JsonUtils.readObjects(
            daoCollection
                .reportDataTimeSeriesDao()
                .listBetweenTimestamps(reportDataType.value(), REPORT_DATA_EXTENSION, startTs, endTs),
            ReportData.class);

    return new ResultList<>(reportData, String.valueOf(startTs), String.valueOf(endTs), reportData.size());
  }

  public void deleteReportDataAtDate(ReportDataType reportDataType, String date) throws IOException {
    // We'll check if we have data to delete before we delete it
    daoCollection.reportDataTimeSeriesDao().deleteReportDataTypeAtDate(reportDataType.value(), date);
  }
}
