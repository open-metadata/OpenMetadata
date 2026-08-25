package org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.RawCostAnalysisReportData;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class RawCostAnalysisReportDataProcessor
    implements Processor<
        List<RawCostAnalysisReportData>, List<CostAnalysisWorkflow.CostAnalysisTableData>> {
  private final StepStats stats = new StepStats();

  public RawCostAnalysisReportDataProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<RawCostAnalysisReportData> process(
      List<CostAnalysisWorkflow.CostAnalysisTableData> input, Map<String, Object> contextData)
      throws SearchIndexException {
    List<RawCostAnalysisReportData> rawCostAnalysisReportDataList = new ArrayList<>();
    try {
      for (CostAnalysisWorkflow.CostAnalysisTableData tableData : input) {
        RawCostAnalysisReportData rawCostAnalysisReportData =
            new RawCostAnalysisReportData()
                .withEntity(tableData.table().getEntityReference())
                .withLifeCycle(tableData.oLifeCycle().orElse(null))
                .withSizeInByte(tableData.oSize().orElse(null));

        rawCostAnalysisReportDataList.add(rawCostAnalysisReportData);
      }
      updateStats(input.size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.size())
              .withFailedCount(input.size())
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Raw Cost Analysis Processor Encounter Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[RawCostAnalysisProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return rawCostAnalysisReportDataList;
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
