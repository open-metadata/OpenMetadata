package org.openmetadata.service.jdbi3;

import java.util.HashMap;
import java.util.List;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.ReportData.ReportDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.ResultList;

public class ReportDataRepository extends EntityTimeSeriesRepository<ReportData> {
  public static final String COLLECTION_PATH = "/v1/analytics/report";
  public static final String REPORT_DATA_EXTENSION = "reportData.reportDataResult";

  public ReportDataRepository() {
    super(
        COLLECTION_PATH,
        Entity.getCollectionDAO().reportDataTimeSeriesDao(),
        ReportData.class,
        Entity.ENTITY_REPORT_DATA);
  }

  public ResultList<ReportData> getReportData(
      ReportDataType reportDataType, Long startTs, Long endTs) {
    List<ReportData> reportData;
    reportData =
        JsonUtils.readObjects(
            timeSeriesDao.listBetweenTimestamps(
                reportDataType.value(), REPORT_DATA_EXTENSION, startTs, endTs),
            ReportData.class);

    return new ResultList<>(
        reportData, String.valueOf(startTs), String.valueOf(endTs), reportData.size());
  }

  public void deleteReportDataAtDate(ReportDataType reportDataType, String date) {
    ((CollectionDAO.ReportDataTimeSeriesDAO) timeSeriesDao)
        .deleteReportDataTypeAtDate(reportDataType.value(), date);
    cleanUpIndex(reportDataType, date);
  }

  public void deleteReportData(ReportDataType reportDataType) {
    ((CollectionDAO.ReportDataTimeSeriesDAO) timeSeriesDao)
        .deletePreviousReportData(reportDataType.value());
    cleanUpPreviousIndex(reportDataType);
  }

  private void cleanUpIndex(ReportDataType reportDataType, String date) {
    HashMap<String, Object> params = new HashMap<>();
    params.put("date_", date);
    String scriptTxt = "doc['timestamp'].value.toLocalDate() == LocalDate.parse(params.date_);";
    searchRepository.deleteByScript(reportDataType.toString(), scriptTxt, params);
  }

  private void cleanUpPreviousIndex(ReportDataType reportDataType) {
    HashMap<String, Object> params = new HashMap<>();
    params.put("reportDataType_", reportDataType.value());
    String scriptTxt = "doc['reportDataType'].value ==  params.reportDataType_";
    searchRepository.deleteByScript(reportDataType.toString(), scriptTxt, params);
  }
}
