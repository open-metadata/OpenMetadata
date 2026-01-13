package org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.AggregatedCostAnalysisReportData;
import org.openmetadata.schema.analytics.DataAssetMetrics;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class AggregatedCostAnalysisReportDataAggregator
    implements Processor<
        List<AggregatedCostAnalysisReportData>,
        Map<String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>>> {
  @Getter
  private final String name =
      "[CostAnalysisWorkflow] Aggregated Cost Anlysis Report Data Aggregator";

  private final StepStats stats = new StepStats();

  public AggregatedCostAnalysisReportDataAggregator(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<AggregatedCostAnalysisReportData> process(
      Map<String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>> input,
      Map<String, Object> contextData)
      throws SearchIndexException {
    List<AggregatedCostAnalysisReportData> aggregatedCostAnalysisReportDataList = new ArrayList<>();

    try {
      for (Map.Entry<
              String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>>
          entry : input.entrySet()) {
        String entityType = entry.getKey();
        Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>
            entityTypeEntryValue = entry.getValue();
        for (Map.Entry<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>
            serviceTypeEntry : entityTypeEntryValue.entrySet()) {
          String serviceType = serviceTypeEntry.getKey();
          Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData> serviceTypeEntryValue =
              serviceTypeEntry.getValue();
          for (Map.Entry<String, CostAnalysisWorkflow.AggregatedCostAnalysisData> serviceNameEntry :
              serviceTypeEntryValue.entrySet()) {
            String serviceName = serviceNameEntry.getKey();
            CostAnalysisWorkflow.AggregatedCostAnalysisData aggregatedData =
                serviceNameEntry.getValue();

            DataAssetMetrics unusedDataAssets =
                aggregatedData
                    .unusedDataAssets()
                    .withTotalCount(
                        (double) aggregatedData.unusedDataAssets().getCount().getThreeDays())
                    .withTotalSize(
                        (double) aggregatedData.unusedDataAssets().getSize().getThreeDays());
            DataAssetMetrics frequentlyUsedDataAssets =
                aggregatedData
                    .frequentlyUsedDataAssets()
                    .withTotalCount(
                        (double)
                            aggregatedData.frequentlyUsedDataAssets().getCount().getThreeDays())
                    .withTotalSize(
                        (double)
                            aggregatedData.frequentlyUsedDataAssets().getSize().getThreeDays());

            AggregatedCostAnalysisReportData aggregatedCostAnalysisReportData =
                new AggregatedCostAnalysisReportData()
                    .withEntityType(entityType)
                    .withServiceType(serviceType)
                    .withServiceName(serviceName)
                    .withUnusedDataAssets(unusedDataAssets)
                    .withFrequentlyUsedDataAssets(frequentlyUsedDataAssets)
                    .withTotalCount(aggregatedData.totalCount())
                    .withTotalSize(aggregatedData.totalSize());

            aggregatedCostAnalysisReportDataList.add(aggregatedCostAnalysisReportData);
          }
        }
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
                      "Aggregated Cost Analysis Aggregator Encounter Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[AggregatedCostAnalysisAggregator] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return aggregatedCostAnalysisReportDataList;
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
