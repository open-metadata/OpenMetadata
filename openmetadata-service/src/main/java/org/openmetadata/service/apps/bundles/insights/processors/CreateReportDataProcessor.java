package org.openmetadata.service.apps.bundles.insights.processors;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class CreateReportDataProcessor implements Processor<List<ReportData>, List<?>> {
  @Getter private final String name;
  private final StepStats stats = new StepStats();

  public CreateReportDataProcessor(int total, String name) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
    this.name = name;
  }

  @Override
  public List<ReportData> process(List<?> input, Map<String, Object> contextData)
      throws SearchIndexException {
    List<ReportData> reportDataList = new ArrayList<>();
    try {
      // TODO: Branch different ReportDataType process instead of having a generic Object.
      ReportData.ReportDataType reportDataType =
          (ReportData.ReportDataType) contextData.get("ReportDataType");
      Long timestamp = (Long) contextData.get(TIMESTAMP_KEY);

      for (Object eventData : input) {
        ReportData reportData =
            new ReportData()
                .withReportDataType(reportDataType)
                .withTimestamp(timestamp)
                .withData(eventData);

        reportDataList.add(reportData);
      }
      updateStats(input.size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.size())
              .withFailedCount(input.size())
              .withSuccessCount(0)
              .withMessage("Create Report Data Processor Encounter Failure.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[CreateReportDataProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return reportDataList;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
