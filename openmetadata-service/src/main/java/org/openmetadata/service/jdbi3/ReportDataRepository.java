package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.ReportData.ReportDataType;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class ReportDataRepository {
  public static final String COLLECTION_PATH = "/v1/analytics/report";
  public static final String REPORT_DATA_EXTENSION = "reportData.reportDataResult";
  public final CollectionDAO daoCollection;

  public ReportDataRepository(CollectionDAO dao) {
    this.daoCollection = dao;
  }

  @Transaction
  public Response addReportData(ReportData reportData) throws IOException {
    reportData.setId(UUID.randomUUID());

    daoCollection
        .entityExtensionTimeSeriesDao()
        .insert(
            EntityUtil.getCheckSum(reportData.getReportDataType().value()),
            REPORT_DATA_EXTENSION,
            "reportData",
            JsonUtils.pojoToJson(reportData));

    return Response.ok(reportData).build();
  }

  public ResultList<ReportData> getReportData(ReportDataType reportDataType, Long startTs, Long endTs)
      throws IOException {
    List<ReportData> reportData;
    reportData =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(EntityUtil.getCheckSum(reportDataType.value()), REPORT_DATA_EXTENSION, startTs, endTs),
            ReportData.class);

    return new ResultList<>(reportData, String.valueOf(startTs), String.valueOf(endTs), reportData.size());
  }
}
